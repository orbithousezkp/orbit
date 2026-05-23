"use strict";

const { planCycle } = require("./behavior");
const { redactSecrets } = require("./safety");
const { budgetStatus } = require("./treasury");
const { privateAiRoute, privateProviderErrors } = require("./provider-privacy");

const DEFAULT_AI_REQUEST_MAX_BYTES = 2_500_000;

function deterministicResponse(context, reason) {
  const plan = context.behaviorPlan || planCycle(context);
  const nextAction = plan.nextStep
    ? `${plan.nextStep.title}: ${plan.nextStep.detail}`
    : "Refresh project memory and look for small documentation or test improvements.";
  const actions = [];

  if (plan.nextStep && plan.nextStep.kind === "survival_opportunity") {
    actions.push({
      tool: "income_opportunities",
      input: {}
    });
  }

  if (plan.nextStep && plan.nextStep.kind === "learning_exploration") {
    actions.push({
      tool: "learning_lab_status",
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
        `Selected behavior step: ${nextAction}`,
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

async function infer(config, messages, tools) {
  const contextMessage = messages.find((message) => message.role === "user");
  const context = contextMessage && contextMessage.context ? contextMessage.context : {};

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

  for (const [index, provider] of providers.entries()) {
    const body = {
      model: provider.model,
      messages: apiMessages,
      temperature: 0.2,
      tools: toolsSchema
    };

    try {
      const serialized = JSON.stringify(body);
      const bodyBytes = Buffer.byteLength(serialized);
      const maxBytes = requestMaxBytes(config, provider);
      if (bodyBytes > maxBytes) {
        throw new Error(`AI request body ${bodyBytes} bytes exceeds configured maximum ${maxBytes} bytes`);
      }

      const chatPath = provider.chatPath || "/chat/completions";
      const response = await fetch(`${provider.apiBase}${chatPath.startsWith("/") ? chatPath : `/${chatPath}`}`, {
        method: "POST",
        headers: providerHeaders(config, provider),
        body: serialized
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`AI API ${response.status}: ${text.slice(0, 500)}`);
      }

      const parsed = await response.json();
      const choice = parsed.choices && parsed.choices[0];
      if (!choice || !choice.message) {
        throw new Error("AI API returned no message");
      }

      return {
        fallback: false,
        provider: privateAiRoute(provider, index),
        providerErrors,
        content: choice.message.content || "",
        toolCalls: choice.message.tool_calls || [],
        finishReason: choice.finish_reason,
        usage: parsed.usage || null,
        raw: parsed
      };
    } catch (error) {
      providerErrors.push({
        ...privateAiRoute(provider, index),
        error: "AI route failed"
      });
    }
  }

  const fallback = deterministicResponse(context, "All configured AI routes failed.");
  fallback.providerErrors = privateProviderErrors(providerErrors);
  return fallback;
}

module.exports = {
  infer,
  deterministicResponse,
  authHeaders,
  providerHeaders,
  requestMaxBytes,
  safeExtraHeaders
};
