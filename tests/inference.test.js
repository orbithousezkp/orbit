"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { infer } = require("../src/agent/inference");

function config(overrides = {}) {
  return {
    repoRoot: process.cwd(),
    aiDailyBudgetUsd: 5,
    aiMonthlyBudgetUsd: 100,
    aiInputUsdPerMillion: 0.15,
    aiOutputUsdPerMillion: 0.6,
    publicBaseUrl: "",
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
    assert.equal(result.provider.name, "second");
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
    assert.match(result.providerErrors[0].error, /\[REDACTED_SECRET\]/);
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
          name: "opengateway",
          label: "Gitlawb OpenGateway MiMo 2.5 Pro",
          apiKey: "",
          requiresAuth: false,
          apiBase: "https://opengateway.gitlawb.com/v1/xiaomi-mimo",
          model: "mimo-v2.5-pro",
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
          name: "opengateway",
          label: "Gitlawb OpenGateway MiMo 2.5 Pro",
          apiKey: "real-key",
          requiresAuth: false,
          apiBase: "https://opengateway.gitlawb.com/v1/xiaomi-mimo",
          model: "mimo-v2.5-pro",
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
          name: "opengateway",
          label: "Gitlawb OpenGateway MiMo 2.5 Pro",
          apiKey: "",
          requiresAuth: false,
          apiBase: "https://opengateway.gitlawb.com/v1/xiaomi-mimo",
          model: "mimo-v2.5-pro",
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
