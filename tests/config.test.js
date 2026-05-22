"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { buildAiProviders, loadConfig } = require("../src/agent/config");

function tempRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "orbit-config-test-"));
  fs.mkdirSync(path.join(dir, "memory"), { recursive: true });
  return dir;
}

test("builds arbitrary ordered AI providers from JSON config", () => {
  const providers = buildAiProviders({
    ORBIT_AI_PROVIDERS: JSON.stringify([
      {
        name: "first-anything",
        label: "First Anything",
        apiKeyEnv: "FIRST_KEY",
        apiBase: "https://first.example/v1/",
        chatPath: "/custom/chat",
        model: "first-model"
      },
      {
        name: "second-anything",
        apiKey: "inline-key",
        apiBase: "https://second.example/v1",
        model: "second-model"
      }
    ]),
    FIRST_KEY: "first-key"
  });

  assert.equal(providers.length, 2);
  assert.equal(providers[0].name, "first-anything");
  assert.equal(providers[0].apiKey, "first-key");
  assert.equal(providers[0].apiBase, "https://first.example/v1");
  assert.equal(providers[0].chatPath, "/custom/chat");
  assert.equal(providers[0].priority, 1);
  assert.equal(providers[1].name, "second-anything");
  assert.equal(providers[1].apiKey, "inline-key");
});

test("loadConfig uses the first configured provider as primary metadata", () => {
  const config = loadConfig({
    ORBIT_AI_PROVIDERS: JSON.stringify([
      {
        name: "front",
        apiKey: "front-key",
        apiBase: "https://front.example/v1",
        model: "front-model"
      },
      {
        name: "back",
        apiKey: "back-key",
        apiBase: "https://back.example/v1",
        model: "back-model"
      }
    ])
  });

  assert.equal(config.aiProviders.length, 2);
  assert.equal(config.aiApiKey, "front-key");
  assert.equal(config.aiApiBase, "https://front.example/v1");
  assert.equal(config.aiModel, "front-model");
});

test("local command execution is disabled unless explicitly configured", () => {
  const config = loadConfig({});

  assert.equal(config.allowCommands, false);
  assert.deepEqual(config.commandAllowlist, []);
});

test("invalid provider JSON leaves Orbit without an AI provider", () => {
  const config = loadConfig({
    ORBIT_AI_PROVIDERS: "not-json"
  });

  assert.equal(config.aiProviders.length, 0);
  assert.equal(config.aiApiKey, "");
});

test("builds providers from public registry plus secret key map", () => {
  const repoRoot = tempRepo();
  fs.writeFileSync(path.join(repoRoot, "memory", "ai-providers.json"), JSON.stringify({
    providers: [
      {
        name: "registry-first",
        apiKeyRef: "first",
        apiBase: "https://first.example/v1",
        model: "first-model",
        enabled: true
      },
      {
        name: "registry-disabled",
        apiKeyRef: "disabled",
        apiBase: "https://disabled.example/v1",
        model: "disabled-model",
        enabled: false
      },
      {
        name: "registry-second",
        apiKeyRef: "second",
        apiBase: "https://second.example/v1",
        model: "second-model",
        enabled: true
      }
    ]
  }, null, 2));

  const providers = buildAiProviders({
    ORBIT_AI_PROVIDER_ALLOWED_DOMAINS: "first.example,second.example",
    ORBIT_AI_PROVIDER_KEYS: JSON.stringify({
      first: "first-key",
      second: "second-key"
    })
  }, repoRoot);

  assert.equal(providers.length, 2);
  assert.equal(providers[0].name, "registry-first");
  assert.equal(providers[0].apiKey, "first-key");
  assert.equal(providers[1].name, "registry-second");
  assert.equal(providers[1].apiKey, "second-key");
});

test("keeps configured AI model priority order", () => {
  const repoRoot = tempRepo();
  fs.writeFileSync(path.join(repoRoot, "memory", "ai-providers.json"), JSON.stringify({
    providers: [
      {
        name: "freemodel",
        apiKeyRef: "freemodel",
        apiBase: "https://api.freemodel.dev/v1",
        model: "freemodel-model",
        enabled: true
      },
      {
        name: "opengateway",
        apiKeyRef: "opengateway",
        apiBase: "https://opengateway.gitlawb.com/v1/xiaomi-mimo",
        model: "mimo-v2.5-pro",
        requiresAuth: false,
        enabled: true
      },
      {
        name: "openrouter",
        apiKeyRef: "openrouter",
        apiBase: "https://openrouter.ai/api/v1",
        model: "openrouter-model",
        enabled: true
      }
    ]
  }, null, 2));

  const providers = buildAiProviders({
    ORBIT_AI_PROVIDER_KEYS: JSON.stringify({
      freemodel: "freemodel-key",
      opengateway: "opengateway-key",
      openrouter: "openrouter-key"
    })
  }, repoRoot);

  assert.deepEqual(providers.map((provider) => provider.name), [
    "freemodel",
    "opengateway",
    "openrouter"
  ]);
  assert.deepEqual(providers.map((provider) => provider.priority), [1, 2, 3]);
});

test("builds the Gitlawb OpenGateway registry provider", () => {
  const repoRoot = tempRepo();
  fs.writeFileSync(path.join(repoRoot, "memory", "ai-providers.json"), JSON.stringify({
    providers: [
      {
        name: "opengateway",
        apiKeyRef: "opengateway",
        apiBase: "https://opengateway.gitlawb.com/v1/xiaomi-mimo",
        model: "mimo-v2.5-pro",
        requiresAuth: false,
        enabled: true
      }
    ]
  }, null, 2));

  const providers = buildAiProviders({
    ORBIT_AI_PROVIDER_KEYS: JSON.stringify({
      opengateway: "opengateway-key"
    })
  }, repoRoot);

  assert.equal(providers.length, 1);
  assert.equal(providers[0].name, "opengateway");
  assert.equal(providers[0].apiBase, "https://opengateway.gitlawb.com/v1/xiaomi-mimo");
  assert.equal(providers[0].model, "mimo-v2.5-pro");
  assert.equal(providers[0].requiresAuth, false);
});

test("builds the Gitlawb OpenGateway registry provider without a key", () => {
  const repoRoot = tempRepo();
  fs.writeFileSync(path.join(repoRoot, "memory", "ai-providers.json"), JSON.stringify({
    providers: [
      {
        name: "opengateway",
        apiKeyRef: "opengateway",
        apiBase: "https://opengateway.gitlawb.com/v1/xiaomi-mimo",
        model: "mimo-v2.5-pro",
        requiresAuth: false,
        enabled: true
      }
    ]
  }, null, 2));

  const providers = buildAiProviders({}, repoRoot);

  assert.equal(providers.length, 1);
  assert.equal(providers[0].name, "opengateway");
  assert.equal(providers[0].apiKey, "");
  assert.equal(providers[0].requiresAuth, false);
});

test("public provider registry cannot redirect known provider keys to unknown domains", () => {
  const repoRoot = tempRepo();
  fs.writeFileSync(path.join(repoRoot, "memory", "ai-providers.json"), JSON.stringify({
    providers: [
      {
        name: "openrouter",
        apiKeyRef: "openrouter",
        apiBase: "https://evil.example/v1",
        model: "openrouter-model",
        enabled: true
      }
    ]
  }, null, 2));

  const providers = buildAiProviders({
    ORBIT_AI_PROVIDER_KEYS: JSON.stringify({
      openrouter: "openrouter-key"
    })
  }, repoRoot);

  assert.equal(providers.length, 0);
});

test("explicit ORBIT_AI_PROVIDERS can use custom domains", () => {
  const providers = buildAiProviders({
    ORBIT_AI_PROVIDERS: JSON.stringify([
      {
        name: "custom",
        apiKey: "custom-key",
        apiBase: "https://custom.example/v1",
        model: "custom-model"
      }
    ])
  }, tempRepo());

  assert.equal(providers.length, 1);
  assert.equal(providers[0].apiBase, "https://custom.example/v1");
});
