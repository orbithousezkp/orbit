"use strict";

const { planCycle } = require("./behavior");
const { budgetStatus, estimateUsageCostUsd, loadTreasury, saveTreasury } = require("./treasury");
const { privateAiRoute, privateProviderErrors } = require("./provider-privacy");
const { orderProviders, recordSuccess, recordFailure } = require("./ai-routing");
const aiRoutingMargin = require("./ai-routing-margin");

const DEFAULT_AI_REQUEST_MAX_BYTES = 2_500_000;
const DEFAULT_AI_REQUEST_TIMEOUT_MS = 60_000;
const WEI_PER_USD = 10n ** 18n;

// Best-effort: convert a USD float into a wei BigInt using the 1 USD = 1e18
// unit-of-account convention shared with ai-routing-margin.js. Returns 0n for
// non-positive or non-finite inputs.
function usdToWei(usd) {
  const num = Number(usd);
  if (!Number.isFinite(num) || num <= 0) return 0n;
  // Scale via micro-USD (1e6) to avoid Number-precision drift on small USD
  // values: 0.000123 USD * 1e18 round-trips through Number cleanly via 1e6.
  const microUsd = Math.round(num * 1_000_000);
  if (microUsd <= 0) return 0n;
  return BigInt(microUsd) * (WEI_PER_USD / 1_000_000n);
}

function recordRoutingMargin(config, provider, parsed) {
  // Best-effort margin tracking. Never throw — the AI call already succeeded
  // and accounting failures must not propagate to the caller.
  try {
    if (!config || !config.repoRoot) return;
    const usage = parsed && parsed.usage ? parsed.usage : {};
    const wholesaleUsd = estimateUsageCostUsd(config, usage);
    const wholesaleCostWei = usdToWei(wholesaleUsd);
    const env = (config && config.env && typeof config.env === "object") ? config.env : process.env;
    const treasury = loadTreasury(config.repoRoot, config);
    aiRoutingMargin.recordAiCall(treasury, env, {
      provider: provider && provider.name ? provider.name : null,
      model: provider && provider.model ? provider.model : null,
      promptTokens: Number(usage.prompt_tokens || usage.input_tokens || 0),
      completionTokens: Number(usage.completion_tokens || usage.output_tokens || 0),
      wholesaleCostWei,
      cycle: config && Number.isFinite(Number(config.cycle)) ? Number(config.cycle) : null,
      adopterId: config && config.adopterId ? config.adopterId : null
    });
    saveTreasury(config.repoRoot, treasury);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("ai-routing-margin: failed to record", err && err.message ? err.message : err);
  }
}

function selectedPlanDirection(plan) {
  const portfolio = plan.directionPortfolio && Array.isArray(plan.directionPortfolio.directions)
    ? plan.directionPortfolio
    : null;
  return portfolio && portfolio.choice && portfolio.choice.selected
    ? portfolio.choice.selected
    : plan.nextStep;
}

function directionLine(direction) {
  const score = Number.isFinite(direction.score) ? ` [score ${direction.score}]` : "";
  const signals = Array.isArray(direction.signals) && direction.signals.length
    ? ` (${direction.signals.join(", ")})`
    : "";
  return `${direction.direction}: ${direction.title}${score}${signals}`;
}

function deterministicResponse(context, reason) {
  const plan = context.behaviorPlan || planCycle(context);
  const portfolio = plan.directionPortfolio && Array.isArray(plan.directionPortfolio.directions)
    ? plan.directionPortfolio
    : null;
  const choice = portfolio && portfolio.choice ? portfolio.choice : null;
  const selected = selectedPlanDirection(plan);
  const directionsForSummary = choice && Array.isArray(choice.considered) && choice.considered.length
    ? choice.considered
    : (portfolio && Array.isArray(portfolio.directions) ? portfolio.directions : []);
  const directionSummary = directionsForSummary.length
    ? directionsForSummary
        .slice(0, 5)
        .map(directionLine)
        .join("\n")
    : "No alternate safe directions were available.";
  const nextAction = selected
    ? `${selected.title}: ${selected.detail}`
    : "Refresh project memory and look for small documentation or test improvements.";
  const actions = [];

  if (selected && ["survival_opportunity", "survival_backlog", "earning_branch"].includes(selected.kind)) {
    actions.push({
      tool: "income_opportunities",
      input: {}
    });
  }

  if (selected && ["learning_exploration", "learning_branch"].includes(selected.kind)) {
    actions.push({
      tool: "learning_lab_status",
      input: {}
    });
  }

  if (selected && ["roadmap_growth", "roadmap_branch"].includes(selected.kind)) {
    actions.push({
      tool: "roadmap_status",
      input: {}
    });
  }

  if (selected && ["infrastructure_growth", "infrastructure_branch"].includes(selected.kind)) {
    actions.push({
      tool: "infrastructure_status",
      input: {}
    });
  }

  if (selected && ["wallet_policy", "wallet_branch"].includes(selected.kind)) {
    actions.push({
      tool: "wallet_status",
      input: {}
    });
  }

  actions.push({
    tool: "write_cycle_note",
    input: {
      title: "Deterministic local cycle",
      body: [
        "Orbit ran without an AI provider.",
        "",
        `Selected direction: ${selected && selected.direction ? selected.direction : "step"}`,
        `Selected behavior step: ${nextAction}`,
        "",
        `Direction mode: ${portfolio ? portfolio.mode : "single_step"}`,
        choice ? `Decision rule: ${choice.rule}` : "",
        choice ? `Directions required for comparison: ${choice.mustCompareCount}` : "",
        "Available directions:",
        directionSummary,
        "",
        `Behavior mode: ${plan.mode}`,
        `Primary objective: ${plan.primaryObjective}`
      ].join("\n")
    }
  });

  return {
    fallback: true,
    content: `${reason} Local deterministic planner selected: ${nextAction}`,
    actions
  };
}

function compactToolSchema(tools) {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.inputSchema
  }));
}

function safeExtraHeaders(headers = {}, protectedHeaders = ["Authorization"]) {
  const protectedNames = new Set(protectedHeaders.map((header) => String(header).toLowerCase()));
  return Object.fromEntries(
    Object.entries(headers).filter(([key]) => !protectedNames.has(key.toLowerCase()))
  );
}

function authHeaders(provider) {
  if (!provider.apiKey) return {};

  const header = provider.authHeader || "Authorization";
  const scheme = String(provider.authScheme || "bearer").toLowerCase();
  const value = scheme === "raw" ? provider.apiKey : `${scheme === "bearer" ? "Bearer" : provider.authScheme} ${provider.apiKey}`;
  return { [header]: value };
}

function providerHeaders(config, provider) {
  const headers = {
    ...safeExtraHeaders(provider.extraHeaders || {}, [provider.authHeader || "Authorization", "Authorization"]),
    ...authHeaders(provider),
    "Content-Type": "application/json",
    "HTTP-Referer": config.publicBaseUrl || "https://github.com",
    "X-Title": "Orbit"
  };

  if (provider.acceptEncoding) {
    headers["Accept-Encoding"] = provider.acceptEncoding;
  }

  return headers;
}

function requestMaxBytes(config = {}, provider = {}) {
  const configured = Number(provider.requestMaxBytes || config.aiRequestMaxBytes || DEFAULT_AI_REQUEST_MAX_BYTES);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_AI_REQUEST_MAX_BYTES;
}

function requestTimeoutMs(config = {}, provider = {}) {
  const configured = Number(provider.timeoutMs || config.aiRequestTimeoutMs || DEFAULT_AI_REQUEST_TIMEOUT_MS);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_AI_REQUEST_TIMEOUT_MS;
}

async function infer(config, messages, tools, routing) {
  const contextMessage = messages.find((message) => message.role === "user");
  const context = contextMessage && contextMessage.context ? contextMessage.context : {};
  const aiRouting = routing && typeof routing === "object" ? routing : { providers: {} };

  const providers = Array.isArray(config.aiProviders) && config.aiProviders.length
    ? config.aiProviders
    : (config.aiApiKey ? [{
        name: "default",
        label: "Default",
        apiKey: config.aiApiKey,
        apiBase: config.aiApiBase,
        model: config.aiModel,
        chatPath: "/chat/completions",
        extraHeaders: {},
        priority: 1
      }] : []);

  if (!providers.length) {
    return deterministicResponse(context, "No AI provider is configured.");
  }

  const budget = budgetStatus(config);
  if (!budget.canUseAi) {
    return deterministicResponse(
      context,
      `AI budget is exhausted for this cycle. Daily remaining: $${budget.dailyRemainingUsd}; monthly remaining: $${budget.monthlyRemainingUsd}.`
    );
  }

  const apiMessages = messages.map((message) => {
    const payload = { role: message.role, content: message.content || "" };
    if (message.tool_calls) payload.tool_calls = message.tool_calls;
    if (message.tool_call_id) payload.tool_call_id = message.tool_call_id;
    return payload;
  });

  const toolsSchema = compactToolSchema(tools).map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.input_schema
    }
  }));
  const providerErrors = [];

  // T-8: order providers by performance weights (auto-demote/promote stored
  // in state.aiRouting). Falls back to insertion order when routing is empty.
  const orderedProviders = orderProviders(aiRouting, providers);

  for (const [iterIndex, provider] of orderedProviders.entries()) {
    const originalIndex = providers.indexOf(provider);
    const index = originalIndex >= 0 ? originalIndex : iterIndex;
    const providerName = provider.name || `route_${index}`;

    // Body shape: OpenAI-compatible (default) or Anthropic-native.
    // Anthropic-shape providers (Claude direct, freemodel-cc, any
    // /v1/messages endpoint) declare `shape: "anthropic"` in
    // ORBIT_AI_PROVIDERS config. They use:
    //   - separate `system` field (extracted from system messages)
    //   - mandatory `max_tokens`
    //   - tools shaped { name, description, input_schema } (no
    //     "type":"function" wrapper)
    //   - response: { content: [{type:"text", text:"..."}], stop_reason }
    // OpenAI-shape (default) keeps the existing body/parse path.
    const isAnthropicShape = provider.shape === "anthropic";

    let body;
    if (isAnthropicShape) {
      const systemMessages = apiMessages.filter((m) => m.role === "system");
      const conversationMessages = apiMessages
        .filter((m) => m.role !== "system")
        .map((m) => ({ role: m.role, content: m.content || "" }));
      body = {
        model: provider.model,
        messages: conversationMessages,
        max_tokens: Number(provider.maxTokens || 4096),
        temperature: 0.2
      };
      if (systemMessages.length > 0) {
        body.system = systemMessages.map((m) => m.content || "").join("\n\n");
      }
      if (toolsSchema.length > 0) {
        // Anthropic tools shape: { name, description, input_schema }
        body.tools = toolsSchema.map((t) => ({
          name: t.function.name,
          description: t.function.description,
          input_schema: t.function.parameters
        }));
      }
    } else {
      body = {
        model: provider.model,
        messages: apiMessages,
        temperature: 0.2,
        // Bound the response so reasoning models (e.g. mimo-v2.5-pro)
        // don't run away with the upstream connection. Provider can
        // override via provider.maxTokens.
        max_tokens: Number(provider.maxTokens || 4096),
        tools: toolsSchema
      };
    }

    const startedAt = Date.now();
    try {
      const serialized = JSON.stringify(body);
      const bodyBytes = Buffer.byteLength(serialized);
      const maxBytes = requestMaxBytes(config, provider);
      if (bodyBytes > maxBytes) {
        throw new Error(`AI request body ${bodyBytes} bytes exceeds configured maximum ${maxBytes} bytes`);
      }

      const chatPath = provider.chatPath || "/chat/completions";
      // Bounded request: AbortController kills a hung provider after the
      // configured timeout (default 60s). Without this, a stalled
      // connection would block the cycle for ~15 min until the
      // GitHub Actions runner timeout fires.
      const timeoutMs = requestTimeoutMs(config, provider);
      const aborter = new AbortController();
      const timer = setTimeout(() => aborter.abort(), timeoutMs);
      let response;
      try {
        response = await fetch(`${provider.apiBase}${chatPath.startsWith("/") ? chatPath : `/${chatPath}`}`, {
          method: "POST",
          headers: providerHeaders(config, provider),
          body: serialized,
          signal: aborter.signal
        });
      } catch (fetchError) {
        if (fetchError && fetchError.name === "AbortError") {
          throw new Error(`AI API timeout after ${timeoutMs}ms`);
        }
        throw fetchError;
      } finally {
        clearTimeout(timer);
      }

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`AI API ${response.status}: ${text.slice(0, 500)}`);
      }

      const parsed = await response.json();

      // Anthropic-shape response parsing. Native Anthropic returns:
      //   { content: [{type:"text", text:"..."}, {type:"tool_use", ...}],
      //     stop_reason: "end_turn"|"tool_use"|... }
      // We translate this back into the OpenAI-shape `choice` the rest of
      // run.js consumes, so callers stay shape-agnostic.
      let choice;
      if (isAnthropicShape) {
        const blocks = Array.isArray(parsed.content) ? parsed.content : [];
        const textParts = blocks.filter((b) => b && b.type === "text").map((b) => b.text || "");
        const toolUseBlocks = blocks.filter((b) => b && b.type === "tool_use");
        const toolCalls = toolUseBlocks.map((b, i) => ({
          id: b.id || `call_${i}`,
          type: "function",
          function: {
            name: b.name,
            arguments: typeof b.input === "string" ? b.input : JSON.stringify(b.input || {})
          }
        }));
        if (textParts.length === 0 && toolCalls.length === 0) {
          throw new Error("AI API returned no message");
        }
        choice = {
          message: {
            role: "assistant",
            content: textParts.join("\n"),
            tool_calls: toolCalls.length > 0 ? toolCalls : undefined
          },
          finish_reason: parsed.stop_reason || "stop"
        };
        if (parsed.usage) {
          // Anthropic uses input_tokens / output_tokens; usage helper
          // already handles both shapes.
          parsed.usage = {
            prompt_tokens: parsed.usage.input_tokens,
            completion_tokens: parsed.usage.output_tokens,
            ...parsed.usage
          };
        }
      } else {
        choice = parsed.choices && parsed.choices[0];
        if (!choice || !choice.message) {
          throw new Error("AI API returned no message");
        }
      }

      const latencyMs = Date.now() - startedAt;
      recordSuccess(aiRouting, providerName, { latencyMs });

      // Best-effort: record AI routing margin (5% default markup) into the
      // treasury revenue stream. Wholesale spend accounting still happens
      // separately via treasury.recordAiUsage in run.js — this is the
      // revenue side, not the spend side. Throws are swallowed.
      recordRoutingMargin(config, provider, parsed);

      return {
        fallback: false,
        provider: privateAiRoute(provider, index),
        providerErrors,
        content: choice.message.content || "",
        toolCalls: choice.message.tool_calls || [],
        finishReason: choice.finish_reason,
        usage: parsed.usage || null,
        raw: parsed,
        routing: aiRouting
      };
    } catch (error) {
      recordFailure(aiRouting, providerName, { reason: "AI route failed" });
      // Log the actual error message (redacted) so dry-runs and ops can see
      // WHY a provider failed. The provider-privacy layer keeps the
      // public-facing surface generic ("AI route failed"); this is the
      // local-only diagnostic.
      try {
        const { redactSecrets } = require("./safety");
        const detail = redactSecrets(String(error && error.message || error));
        const cause = error && error.cause ? redactSecrets(String(error.cause.message || error.cause)) : "";
        console.error(`[orbit:ai] ${providerName} failed: ${detail}${cause ? ` (cause: ${cause})` : ""}`);
      } catch {}
      providerErrors.push({
        ...privateAiRoute(provider, index),
        error: "AI route failed"
      });
    }
  }

  const fallback = deterministicResponse(context, "All configured AI routes failed.");
  fallback.providerErrors = privateProviderErrors(providerErrors);
  fallback.routing = aiRouting;
  return fallback;
}

module.exports = {
  infer,
  deterministicResponse,
  authHeaders,
  providerHeaders,
  requestMaxBytes,
  requestTimeoutMs,
  safeExtraHeaders
};
