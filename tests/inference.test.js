"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { infer } = require("../src/agent/inference");
const aiRoutingMargin = require("../src/agent/ai-routing-margin");

function mkTmpRepo() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "inference-test-"));
}

function config(overrides = {}) {
  return {
    repoRoot: mkTmpRepo(),
    aiDailyBudgetUsd: 5,
    aiMonthlyBudgetUsd: 100,
    aiInputUsdPerMillion: 0.15,
    aiOutputUsdPerMillion: 0.6,
    publicBaseUrl: "",
    env: { ORBIT_AI_ROUTING_MARGIN_BPS: "500" },
    ...overrides
  };
}

test("inference falls through to the next configured provider", async () => {
  const originalFetch = global.fetch;
  const calls = [];

  global.fetch = async (url) => {
    calls.push(String(url));
    if (calls.length === 1) {
      return {
        ok: false,
        status: 503,
        async text() {
          return "first provider failed";
        }
      };
    }

    return {
      ok: true,
      async json() {
        return {
          choices: [
            {
              message: {
                content: "second provider answered",
                tool_calls: []
              },
              finish_reason: "stop"
            }
          ],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 }
        };
      }
    };
  };

  try {
    const result = await infer(config({
      aiProviders: [
        {
          name: "first",
          label: "First",
          apiKey: "first-key",
          apiBase: "https://first.example/v1",
          model: "first-model",
          chatPath: "/chat/completions",
          priority: 1
        },
        {
          name: "second",
          label: "Second",
          apiKey: "second-key",
          apiBase: "https://second.example/v1",
          model: "second-model",
          chatPath: "/chat/completions",
          priority: 2
        }
      ]
    }), [
      { role: "user", content: "context", context: {} }
    ], []);

    assert.equal(result.fallback, false);
    assert.equal(result.provider.route, "private-ai-route-2");
    assert.equal(result.providerErrors.length, 1);
    assert.equal(calls[0], "https://first.example/v1/chat/completions");
    assert.equal(calls[1], "https://second.example/v1/chat/completions");
  } finally {
    global.fetch = originalFetch;
  }
});

test("inference redacts provider failure messages before fallback proof", async () => {
  const originalFetch = global.fetch;

  global.fetch = async () => ({
    ok: false,
    status: 401,
    async text() {
      return "bad key apiKey: \"abcdefghijklmnopqrstuvwxyz123456\"";
    }
  });

  try {
    const result = await infer(config({
      aiProviders: [
        {
          name: "only",
          label: "Only",
          apiKey: "only-key",
          apiBase: "https://only.example/v1",
          model: "only-model",
          chatPath: "/chat/completions",
          priority: 1
        }
      ]
    }), [
      { role: "user", content: "context", context: {} }
    ], []);

    assert.equal(result.fallback, true);
    assert.equal(result.providerErrors[0].error, "AI route failed");
    assert.doesNotMatch(result.providerErrors[0].error, /abcdefghijklmnopqrstuvwxyz123456/);
  } finally {
    global.fetch = originalFetch;
  }
});

test("provider extra headers cannot override Authorization", async () => {
  const originalFetch = global.fetch;
  let authorization = "";
  let lowerAuthorization = "";

  global.fetch = async (_url, options) => {
    authorization = options.headers.Authorization;
    lowerAuthorization = options.headers.authorization;
    return {
      ok: true,
      async json() {
        return {
          choices: [
            {
              message: {
                content: "ok",
                tool_calls: []
              },
              finish_reason: "stop"
            }
          ],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 }
        };
      }
    };
  };

  try {
    const result = await infer(config({
      aiProviders: [
        {
          name: "only",
          label: "Only",
          apiKey: "real-key",
          apiBase: "https://only.example/v1",
          model: "only-model",
          chatPath: "/chat/completions",
          extraHeaders: {
            Authorization: "Bearer attacker-key",
            authorization: "Bearer lower-attacker-key"
          },
          priority: 1
        }
      ]
    }), [
      { role: "user", content: "context", context: {} }
    ], []);

    assert.equal(result.fallback, false);
    assert.equal(authorization, "Bearer real-key");
    assert.equal(lowerAuthorization, undefined);
  } finally {
    global.fetch = originalFetch;
  }
});

test("auth-optional providers omit authorization when no key is configured", async () => {
  const originalFetch = global.fetch;
  let headers = {};

  global.fetch = async (_url, options) => {
    headers = options.headers;
    return {
      ok: true,
      async json() {
        return {
          choices: [
            {
              message: {
                content: "ok",
                tool_calls: []
              },
              finish_reason: "stop"
            }
          ],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 }
        };
      }
    };
  };

  try {
    const result = await infer(config({
      aiProviders: [
        {
          name: "gateway",
          label: "Gateway",
          apiKey: "",
          requiresAuth: false,
          apiBase: "https://gateway.example/v1",
          model: "gateway-model",
          chatPath: "/chat/completions",
          authHeader: "api-key",
          authScheme: "raw",
          priority: 1
        }
      ]
    }), [
      { role: "user", content: "context", context: {} }
    ], []);

    assert.equal(result.fallback, false);
    assert.equal(headers.Authorization, undefined);
    assert.equal(headers.authorization, undefined);
    assert.equal(headers["api-key"], undefined);
  } finally {
    global.fetch = originalFetch;
  }
});

test("provider-specific auth headers use configured scheme and cannot be overridden", async () => {
  const originalFetch = global.fetch;
  let headers = {};

  global.fetch = async (_url, options) => {
    headers = options.headers;
    return {
      ok: true,
      async json() {
        return {
          choices: [
            {
              message: {
                content: "ok",
                tool_calls: []
              },
              finish_reason: "stop"
            }
          ],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 }
        };
      }
    };
  };

  try {
    const result = await infer(config({
      aiProviders: [
        {
          name: "gateway",
          label: "Gateway",
          apiKey: "real-key",
          requiresAuth: false,
          apiBase: "https://gateway.example/v1",
          model: "gateway-model",
          chatPath: "/chat/completions",
          authHeader: "api-key",
          authScheme: "raw",
          extraHeaders: {
            "api-key": "attacker-key"
          },
          priority: 1
        }
      ]
    }), [
      { role: "user", content: "context", context: {} }
    ], []);

    assert.equal(result.fallback, false);
    assert.equal(headers.Authorization, undefined);
    assert.equal(headers["api-key"], "real-key");
  } finally {
    global.fetch = originalFetch;
  }
});

test("provider headers can request identity encoding for gateways with bad gzip metadata", async () => {
  const originalFetch = global.fetch;
  let headers = {};

  global.fetch = async (_url, options) => {
    headers = options.headers;
    return {
      ok: true,
      async json() {
        return {
          choices: [
            {
              message: {
                content: "ok",
                tool_calls: []
              },
              finish_reason: "stop"
            }
          ],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 }
        };
      }
    };
  };

  try {
    const result = await infer(config({
      aiProviders: [
        {
          name: "gateway",
          label: "Gateway",
          apiKey: "",
          requiresAuth: false,
          apiBase: "https://gateway.example/v1",
          model: "gateway-model",
          chatPath: "/chat/completions",
          authHeader: "api-key",
          authScheme: "raw",
          acceptEncoding: "identity",
          priority: 1
        }
      ]
    }), [
      { role: "user", content: "context", context: {} }
    ], []);

    assert.equal(result.fallback, false);
    assert.equal(headers["Accept-Encoding"], "identity");
  } finally {
    global.fetch = originalFetch;
  }
});

test("oversized AI requests fall back before hitting the provider", async () => {
  const originalFetch = global.fetch;
  let fetchCalled = false;

  global.fetch = async () => {
    fetchCalled = true;
    throw new Error("should not call provider");
  };

  try {
    const result = await infer(config({
      aiRequestMaxBytes: 500,
      aiProviders: [
        {
          name: "only",
          label: "Only",
          apiKey: "only-key",
          apiBase: "https://only.example/v1",
          model: "only-model",
          chatPath: "/chat/completions",
          priority: 1
        }
      ]
    }), [
      { role: "user", content: "x".repeat(2_000), context: {} }
    ], []);

    assert.equal(result.fallback, true);
    assert.equal(fetchCalled, false);
    assert.equal(result.providerErrors[0].error, "AI route failed");
  } finally {
    global.fetch = originalFetch;
  }
});

test("request byte limit defaults to a provider-safe cap", () => {
  const { requestMaxBytes } = require("../src/agent/inference");

  assert.equal(requestMaxBytes({}, {}), 2_500_000);
  assert.equal(requestMaxBytes({ aiRequestMaxBytes: 123 }, {}), 123);
  assert.equal(requestMaxBytes({ aiRequestMaxBytes: 123 }, { requestMaxBytes: 456 }), 456);
});

test("infer threads ai routing telemetry back through result.routing (T-8 persistence)", async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: false,
    status: 502,
    async text() { return "gateway down"; }
  });

  try {
    const routing = { providers: {} };
    const result = await infer(config({
      aiProviders: [
        {
          name: "first",
          label: "First",
          apiKey: "k",
          apiBase: "https://first.example/v1",
          model: "m",
          chatPath: "/chat/completions",
          priority: 1
        }
      ]
    }), [
      { role: "user", content: "ctx", context: {} }
    ], [], routing);

    assert.equal(result.fallback, true);
    assert.equal(result.routing, routing, "result.routing must reference the passed-in routing state");
    assert.equal(routing.providers.first.rollingFailures, 1, "failure must be recorded onto the caller's routing state for cross-cycle persistence");
  } finally {
    global.fetch = originalFetch;
  }
});

test("ai-routing-margin: successful AI call records margin into the stream", async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: true,
    async json() {
      return {
        choices: [
          {
            message: { content: "ok", tool_calls: [] },
            finish_reason: "stop"
          }
        ],
        usage: { prompt_tokens: 1000, completion_tokens: 1000, total_tokens: 2000 }
      };
    }
  });

  const cfg = config({
    aiProviders: [
      {
        name: "only",
        label: "Only",
        apiKey: "only-key",
        apiBase: "https://only.example/v1",
        model: "only-model",
        chatPath: "/chat/completions",
        priority: 1
      }
    ]
  });

  try {
    const result = await infer(cfg, [
      { role: "user", content: "context", context: {} }
    ], []);

    assert.equal(result.fallback, false);
    const { loadTreasury } = require("../src/agent/treasury");
    const treasury = loadTreasury(cfg.repoRoot, cfg);
    assert.ok(Array.isArray(treasury.revenue.streams), "streams[] must exist");
    const stream = treasury.revenue.streams.find((s) => s.id === aiRoutingMargin.STREAM_ID);
    assert.ok(stream, "ai-routing-margin stream must exist");
    assert.equal(stream.type, aiRoutingMargin.STREAM_TYPE);
    assert.equal(stream.status, "experimental");
    assert.equal(stream.unitEconomics.totalCallsBilled, 1);
    assert.equal(stream.unitEconomics.marginBps, aiRoutingMargin.MARGIN_BPS_DEFAULT);
    // Wholesale = (1000/1e6)*0.15 + (1000/1e6)*0.6 = 7.5e-4 USD = 750 micro-USD.
    // Wei = 750 * (1e18 / 1e6) = 7.5e14. Margin = 7.5e14 * 500 / 10000 = 3.75e13.
    assert.equal(stream.lifetimeRevenueWei, "37500000000000");
    assert.equal(stream.unitEconomics.perCallSamples.length, 1);
    assert.equal(stream.unitEconomics.perCallSamples[0].provider, "only");
    assert.equal(stream.unitEconomics.perCallSamples[0].model, "only-model");
  } finally {
    global.fetch = originalFetch;
  }
});

test("ai-routing-margin: failed AI call does NOT record margin", async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: false,
    status: 503,
    async text() { return "down"; }
  });

  const cfg = config({
    aiProviders: [
      {
        name: "only",
        label: "Only",
        apiKey: "only-key",
        apiBase: "https://only.example/v1",
        model: "only-model",
        chatPath: "/chat/completions",
        priority: 1
      }
    ]
  });

  try {
    const result = await infer(cfg, [
      { role: "user", content: "context", context: {} }
    ], []);

    assert.equal(result.fallback, true);
    const { loadTreasury } = require("../src/agent/treasury");
    const treasury = loadTreasury(cfg.repoRoot, cfg);
    const streams = (treasury.revenue && treasury.revenue.streams) || [];
    const stream = streams.find((s) => s.id === aiRoutingMargin.STREAM_ID);
    assert.equal(stream, undefined, "no margin stream should be created on failure");
  } finally {
    global.fetch = originalFetch;
  }
});

test("ai-routing-margin: tracking failure never fails the AI call", async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: true,
    async json() {
      return {
        choices: [
          { message: { content: "ok", tool_calls: [] }, finish_reason: "stop" }
        ],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 }
      };
    }
  });

  // Force margin tracking to throw via an invalid env var.
  // recordRoutingMargin must swallow the error and let the AI call succeed.
  const cfg = config({
    env: { ORBIT_AI_ROUTING_MARGIN_BPS: "-1" }, // invalid: throws inside loadMarginConfig
    aiProviders: [
      {
        name: "only",
        label: "Only",
        apiKey: "only-key",
        apiBase: "https://only.example/v1",
        model: "only-model",
        chatPath: "/chat/completions",
        priority: 1
      }
    ]
  });

  const originalWarn = console.warn;
  const warnings = [];
  console.warn = (...args) => { warnings.push(args); };

  try {
    const result = await infer(cfg, [
      { role: "user", content: "context", context: {} }
    ], []);

    assert.equal(result.fallback, false, "AI call must still succeed even if margin tracking throws");
    assert.equal(result.content, "ok");
    assert.ok(
      warnings.some((args) => String(args[0] || "").includes("ai-routing-margin")),
      "should warn when margin tracking fails"
    );
  } finally {
    global.fetch = originalFetch;
    console.warn = originalWarn;
  }
});

// === provider timeout ========================================================

test("hung AI provider aborts at the configured timeout and falls through", async () => {
  const originalFetch = global.fetch;
  let aborted = false;

  global.fetch = (_url, options) => new Promise((_resolve, reject) => {
    // Never resolves — simulates a hung provider. Listen for the abort
    // signal so we can confirm the test setup observed the abort.
    if (options && options.signal) {
      options.signal.addEventListener("abort", () => {
        aborted = true;
        const err = new Error("aborted");
        err.name = "AbortError";
        reject(err);
      });
    }
  });

  try {
    const start = Date.now();
    const result = await infer(config({
      aiRequestTimeoutMs: 50,
      aiProviders: [
        {
          name: "hung",
          label: "Hung",
          apiKey: "k",
          apiBase: "https://hung.example/v1",
          model: "m",
          chatPath: "/chat/completions",
          priority: 1
        }
      ]
    }), [{ role: "user", content: "ctx", context: {} }], []);
    const elapsed = Date.now() - start;
    // The abort fires near 50ms; allow a generous ceiling so this isn't
    // flaky under load. The point is it doesn't hang for minutes.
    assert.ok(elapsed < 5000, `expected fast abort, got ${elapsed}ms`);
    assert.equal(aborted, true, "AbortController must have fired");
    assert.equal(result.fallback, true, "should fall through to deterministic");
  } finally {
    global.fetch = originalFetch;
  }
});

// Anthropic-shape adapter (security audit follow-up, 2026-05-29):
// providers with `shape: "anthropic"` send Anthropic-native body to
// /v1/messages and parse `content[0].text` instead of `choices[0].message.content`.
// Pairs with freemodel-cc / Anthropic direct providers.

test("anthropic-shape provider: body has system extracted + tools transformed", async () => {
  const originalFetch = global.fetch;
  let capturedBody = null;
  let capturedHeaders = null;
  global.fetch = async (_url, options) => {
    capturedBody = JSON.parse(options.body);
    capturedHeaders = options.headers;
    return {
      ok: true,
      status: 200,
      async json() {
        return {
          id: "msg_1",
          content: [{ type: "text", text: "ok hello" }],
          stop_reason: "end_turn",
          usage: { input_tokens: 10, output_tokens: 5 }
        };
      }
    };
  };
  try {
    const result = await infer(config({
      aiProviders: [
        {
          name: "freemodel",
          shape: "anthropic",
          apiBase: "https://api-cc.freemodel.dev",
          chatPath: "/v1/messages",
          model: "claude-haiku-4-5-20251001",
          authHeader: "x-api-key",
          authScheme: "raw",
          apiKey: "test-key",
          extraHeaders: { "anthropic-version": "2023-06-01" },
          priority: 1
        }
      ]
    }), [
      { role: "system", content: "you are orbit" },
      { role: "user", content: "say ok" }
    ], [
      { name: "echo", description: "Echo back", inputSchema: { type: "object", properties: { text: { type: "string" } } } }
    ]);
    assert.equal(result.fallback, false);
    assert.match(result.content, /ok hello/);
    // Body shape checks
    assert.equal(capturedBody.system, "you are orbit", "system extracted to top-level");
    assert.equal(capturedBody.messages.length, 1, "system removed from messages array");
    assert.equal(capturedBody.messages[0].role, "user");
    assert.ok(typeof capturedBody.max_tokens === "number");
    assert.ok(Array.isArray(capturedBody.tools));
    assert.equal(capturedBody.tools[0].name, "echo");
    assert.ok(capturedBody.tools[0].input_schema, "tools use input_schema not parameters");
    assert.equal(capturedBody.tools[0].input_schema.type, "object");
    // Header check — x-api-key, no Bearer
    assert.equal(capturedHeaders["x-api-key"], "test-key");
    assert.equal(capturedHeaders["anthropic-version"], "2023-06-01");
  } finally {
    global.fetch = originalFetch;
  }
});

test("anthropic-shape provider: response with content[].text becomes choice.message.content", async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: true,
    status: 200,
    async json() {
      return {
        content: [
          { type: "text", text: "first part" },
          { type: "text", text: "second part" }
        ],
        stop_reason: "end_turn"
      };
    }
  });
  try {
    const result = await infer(config({
      aiProviders: [
        {
          name: "anth",
          shape: "anthropic",
          apiBase: "https://x",
          chatPath: "/v1/messages",
          model: "claude-haiku-4-5-20251001",
          authHeader: "x-api-key",
          authScheme: "raw",
          apiKey: "k",
          priority: 1
        }
      ]
    }), [{ role: "user", content: "x" }], []);
    assert.equal(result.fallback, false);
    assert.equal(result.content, "first part\nsecond part");
    assert.equal(result.finishReason, "end_turn");
  } finally {
    global.fetch = originalFetch;
  }
});

test("anthropic-shape provider: tool_use blocks become tool_calls (OpenAI shape)", async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: true,
    status: 200,
    async json() {
      return {
        content: [
          { type: "text", text: "calling tool" },
          { type: "tool_use", id: "toolu_1", name: "echo", input: { text: "hi" } }
        ],
        stop_reason: "tool_use"
      };
    }
  });
  try {
    const result = await infer(config({
      aiProviders: [
        {
          name: "anth",
          shape: "anthropic",
          apiBase: "https://x",
          chatPath: "/v1/messages",
          model: "claude-haiku-4-5-20251001",
          authHeader: "x-api-key",
          authScheme: "raw",
          apiKey: "k",
          priority: 1
        }
      ]
    }), [{ role: "user", content: "x" }], []);
    assert.equal(result.fallback, false);
    assert.match(result.content, /calling tool/);
    assert.ok(Array.isArray(result.toolCalls));
    assert.equal(result.toolCalls.length, 1);
    assert.equal(result.toolCalls[0].id, "toolu_1");
    assert.equal(result.toolCalls[0].function.name, "echo");
    const args = JSON.parse(result.toolCalls[0].function.arguments);
    assert.equal(args.text, "hi");
  } finally {
    global.fetch = originalFetch;
  }
});

test("anthropic-shape provider: empty content array → 'AI API returned no message'", async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: true,
    status: 200,
    async json() {
      return { content: [], stop_reason: "end_turn" };
    }
  });
  try {
    const result = await infer(config({
      aiProviders: [
        {
          name: "anth",
          shape: "anthropic",
          apiBase: "https://x",
          chatPath: "/v1/messages",
          model: "claude-haiku-4-5-20251001",
          authHeader: "x-api-key",
          authScheme: "raw",
          apiKey: "k",
          priority: 1
        }
      ]
    }), [{ role: "user", content: "x" }], []);
    // Falls back to deterministic when the only configured provider fails.
    assert.equal(result.fallback, true);
  } finally {
    global.fetch = originalFetch;
  }
});

test("openai-shape default still works (regression check)", async () => {
  const originalFetch = global.fetch;
  let capturedBody = null;
  global.fetch = async (_url, options) => {
    capturedBody = JSON.parse(options.body);
    return {
      ok: true,
      status: 200,
      async json() {
        return {
          choices: [{ message: { role: "assistant", content: "openai still works" }, finish_reason: "stop" }]
        };
      }
    };
  };
  try {
    const result = await infer(config({
      aiProviders: [
        {
          name: "openai",
          apiBase: "https://api.openai.com/v1",
          chatPath: "/chat/completions",
          model: "gpt-4o-mini",
          apiKey: "k",
          priority: 1
        }
      ]
    }), [{ role: "user", content: "x" }], []);
    assert.equal(result.fallback, false);
    assert.equal(result.content, "openai still works");
    // Verify default OpenAI body shape preserved
    assert.equal(capturedBody.messages[0].role, "user");
    assert.equal(capturedBody.system, undefined, "no separate system field on OpenAI shape");
  } finally {
    global.fetch = originalFetch;
  }
});
