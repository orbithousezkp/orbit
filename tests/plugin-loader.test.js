"use strict";

/**
 * tests/plugin-loader.test.js — S-024 plugin loader unit tests.
 *
 * Pure local tests. No network calls. No writes outside os.tmpdir().
 * Every test creates its own tmpdir + manifest + plugin module so tests
 * are order-independent and parallel-safe.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const {
  CAPABILITIES,
  CAPABILITY_VALUES,
  FORBIDDEN_RESPONSE_FIELDS,
  NETWORK_TIMEOUT_DEFAULT_MS,
  NETWORK_TIMEOUT_MAX_MS,
  PLUGIN_MANIFEST_PATH,
  applyCapabilityGate,
  clampNetworkTimeout,
  invokeToolSafely,
  isPluginEnabled,
  loadPlugins,
  sanitizeToolResponse,
  validatePlugin
} = require("../src/agent/plugin-loader");

// --- fixtures --------------------------------------------------------------

function makePlugin(overrides = {}) {
  return {
    name: "@orbithouse/tool-example",
    version: "0.1.0",
    capabilities: ["read-memory"],
    tools: [
      {
        name: "echo",
        description: "echo a message",
        inputSchema: { type: "object", properties: { message: { type: "string" } } },
        handler: async (input) => ({ status: "ok", echoed: String((input && input.message) || "").slice(0, 200) })
      }
    ],
    ...overrides
  };
}

function tmpRepoRoot(prefix = "orbit-plugin-test-") {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function writeManifest(repoRoot, manifest) {
  const target = path.join(repoRoot, PLUGIN_MANIFEST_PATH);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(manifest, null, 2)}\n`, "utf-8");
}

function installPluginModule(repoRoot, pluginName, moduleSource) {
  const dir = path.join(repoRoot, "node_modules", pluginName);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify({
    name: pluginName,
    version: "0.1.0",
    main: "index.js",
    orbit: { plugin: true }
  }), "utf-8");
  fs.writeFileSync(path.join(dir, "index.js"), moduleSource, "utf-8");
}

// ---- validatePlugin -------------------------------------------------------

test("validatePlugin rejects missing name", () => {
  const p = makePlugin();
  delete p.name;
  assert.throws(() => validatePlugin(p), /plugin\.name is required/);
});

test("validatePlugin rejects missing version", () => {
  const p = makePlugin();
  delete p.version;
  assert.throws(() => validatePlugin(p), /plugin\.version is required/);
});

test("validatePlugin rejects non-semver version", () => {
  assert.throws(() => validatePlugin(makePlugin({ version: "latest" })), /must be semver/);
});

test("validatePlugin rejects missing capabilities array", () => {
  const p = makePlugin();
  delete p.capabilities;
  assert.throws(() => validatePlugin(p), /capabilities must be an array/);
});

test("validatePlugin rejects empty tools array", () => {
  assert.throws(() => validatePlugin(makePlugin({ tools: [] })), /tools must be a non-empty array/);
});

test("validatePlugin rejects an unknown capability", () => {
  assert.throws(
    () => validatePlugin(makePlugin({ capabilities: ["read-memory", "summon-demons"] })),
    /unknown capability "summon-demons"/
  );
});

test("validatePlugin rejects duplicate tool names within a plugin", () => {
  const p = makePlugin({
    tools: [
      {
        name: "echo",
        description: "x",
        inputSchema: { type: "object" },
        handler: async () => ({ status: "ok" })
      },
      {
        name: "echo",
        description: "y",
        inputSchema: { type: "object" },
        handler: async () => ({ status: "ok" })
      }
    ]
  });
  assert.throws(() => validatePlugin(p), /duplicated/);
});

test("validatePlugin rejects a tool with non-function handler", () => {
  const p = makePlugin({
    tools: [
      {
        name: "echo",
        description: "x",
        inputSchema: { type: "object" },
        handler: "not a function"
      }
    ]
  });
  assert.throws(() => validatePlugin(p), /handler must be a function/);
});

test("validatePlugin accepts a well-formed plugin", () => {
  const result = validatePlugin(makePlugin());
  assert.equal(result.name, "@orbithouse/tool-example");
  assert.deepEqual(result.capabilities, ["read-memory"]);
});

// ---- capability values + CAPABILITIES constant ---------------------------

test("CAPABILITIES exposes the frozen allowlist", () => {
  assert.equal(CAPABILITY_VALUES.length, 6);
  assert.ok(CAPABILITY_VALUES.includes(CAPABILITIES.READ_ISSUES));
  assert.ok(CAPABILITY_VALUES.includes(CAPABILITIES.WALLET));
  assert.ok(CAPABILITY_VALUES.includes(CAPABILITIES.NETWORK));
  assert.throws(() => { CAPABILITIES.NEW_CAP = "evil"; });
});

// ---- applyCapabilityGate -------------------------------------------------

test("applyCapabilityGate denies a capability not in the plugin's declared set", () => {
  const plugin = makePlugin({ capabilities: ["read-memory"] });
  const gate = applyCapabilityGate(plugin, "wallet", {});
  assert.equal(gate.ok, false);
  assert.equal(gate.reason, "capability_undeclared");
});

test("applyCapabilityGate allows a capability in the declared set", () => {
  const plugin = makePlugin({ capabilities: ["read-memory"] });
  const gate = applyCapabilityGate(plugin, "read-memory", {});
  assert.equal(gate.ok, true);
  assert.equal(gate.dryRun, false);
});

test("applyCapabilityGate denies an unknown capability", () => {
  const plugin = makePlugin({ capabilities: ["read-memory", "wallet"] });
  // Bypass validation by handcrafting; gate should still reject.
  const gate = applyCapabilityGate(plugin, "summon-demons", {});
  assert.equal(gate.ok, false);
  assert.equal(gate.reason, "capability_unknown");
});

test("applyCapabilityGate forces DRY_RUN for wallet capability unless ORBIT_PLUGIN_LIVE=true", () => {
  const plugin = makePlugin({ capabilities: ["wallet"] });
  const gateDefault = applyCapabilityGate(plugin, "wallet", {});
  assert.equal(gateDefault.ok, true);
  assert.equal(gateDefault.dryRun, true);

  const gateDisabled = applyCapabilityGate(plugin, "wallet", { ORBIT_PLUGIN_LIVE: "false" });
  assert.equal(gateDisabled.dryRun, true);

  const gateLive = applyCapabilityGate(plugin, "wallet", { ORBIT_PLUGIN_LIVE: "true" });
  assert.equal(gateLive.ok, true);
  assert.equal(gateLive.dryRun, false);
});

test("applyCapabilityGate forces DRY_RUN for network capability unless ORBIT_PLUGIN_LIVE=true", () => {
  const plugin = makePlugin({ capabilities: ["network"] });
  const gateDefault = applyCapabilityGate(plugin, "network", {});
  assert.equal(gateDefault.dryRun, true);
  const gateLive = applyCapabilityGate(plugin, "network", { ORBIT_PLUGIN_LIVE: "true" });
  assert.equal(gateLive.dryRun, false);
});

// ---- clampNetworkTimeout -------------------------------------------------

test("clampNetworkTimeout honors per-request cap and default", () => {
  assert.equal(clampNetworkTimeout(undefined), NETWORK_TIMEOUT_DEFAULT_MS);
  assert.equal(clampNetworkTimeout(0), NETWORK_TIMEOUT_DEFAULT_MS);
  assert.equal(clampNetworkTimeout(-50), NETWORK_TIMEOUT_DEFAULT_MS);
  assert.equal(clampNetworkTimeout(1000), 1000);
  assert.equal(clampNetworkTimeout(NETWORK_TIMEOUT_MAX_MS + 10_000), NETWORK_TIMEOUT_MAX_MS);
  assert.equal(clampNetworkTimeout("not a number"), NETWORK_TIMEOUT_DEFAULT_MS);
});

// ---- sanitizeToolResponse ------------------------------------------------

test("sanitizeToolResponse strips text and rendered fields recursively", () => {
  const input = {
    status: "ok",
    text: "leaked prompt",
    rendered: "<p>leaked</p>",
    nested: {
      text: "nested leak",
      rendered: "x",
      ok: true,
      list: [{ text: "inner leak", value: 5 }]
    }
  };
  const output = sanitizeToolResponse(input);
  assert.equal(output.status, "ok");
  assert.equal(output.text, undefined);
  assert.equal(output.rendered, undefined);
  assert.equal(output.nested.text, undefined);
  assert.equal(output.nested.rendered, undefined);
  assert.equal(output.nested.ok, true);
  assert.equal(output.nested.list[0].text, undefined);
  assert.equal(output.nested.list[0].value, 5);
});

test("sanitizeToolResponse preserves safe fields (status, count, echoed, lists)", () => {
  const input = {
    status: "ok",
    count: 42,
    echoed: "hello",
    flagged: false,
    items: ["a", "b", "c"]
  };
  const output = sanitizeToolResponse(input);
  assert.deepEqual(output, input);
  assert.notEqual(output, input); // fresh object
});

test("sanitizeToolResponse strips HTML markup from string values", () => {
  const output = sanitizeToolResponse({
    status: "ok",
    message: 'click <a href="javascript:evil()">here</a> now'
  });
  assert.equal(output.message, "click here now");
});

test("sanitizeToolResponse drops every field in FORBIDDEN_RESPONSE_FIELDS", () => {
  const input = {};
  for (const field of FORBIDDEN_RESPONSE_FIELDS) input[field] = "leak";
  input.kept = "ok";
  const output = sanitizeToolResponse(input);
  for (const field of FORBIDDEN_RESPONSE_FIELDS) {
    assert.equal(output[field], undefined, `field "${field}" should be stripped`);
  }
  assert.equal(output.kept, "ok");
});

// ---- isPluginEnabled -----------------------------------------------------

test("isPluginEnabled is false when ORBIT_ENABLE_PLUGINS is unset / not 'true'", () => {
  assert.equal(isPluginEnabled({}, {}), false);
  assert.equal(isPluginEnabled({}, { ORBIT_ENABLE_PLUGINS: "" }), false);
  assert.equal(isPluginEnabled({}, { ORBIT_ENABLE_PLUGINS: "false" }), false);
  assert.equal(isPluginEnabled({}, { ORBIT_ENABLE_PLUGINS: "1" }), false);
  assert.equal(isPluginEnabled({}, { ORBIT_ENABLE_PLUGINS: "TRUE" }), true);
  assert.equal(isPluginEnabled({}, { ORBIT_ENABLE_PLUGINS: "true" }), true);
});

test("isPluginEnabled respects config.plugins.enabled === true", () => {
  assert.equal(isPluginEnabled({ plugins: { enabled: true } }, {}), true);
  assert.equal(isPluginEnabled({ plugins: { enabled: false } }, {}), false);
});

// ---- loadPlugins ---------------------------------------------------------

test("loadPlugins returns empty list when ORBIT_ENABLE_PLUGINS != 'true'", () => {
  const repoRoot = tmpRepoRoot();
  writeManifest(repoRoot, { plugins: [{ name: "x", source: "x", enabled: true, capabilities: [] }] });
  const result = loadPlugins(repoRoot, { env: {} });
  assert.deepEqual(result, { plugins: [], errors: [], enabled: false });
});

test("loadPlugins returns empty list when manifest missing", () => {
  const repoRoot = tmpRepoRoot();
  const result = loadPlugins(repoRoot, { env: { ORBIT_ENABLE_PLUGINS: "true" } });
  assert.deepEqual(result, { plugins: [], errors: [], enabled: true });
});

test("loadPlugins returns empty list when no plugins are enabled", () => {
  const repoRoot = tmpRepoRoot();
  writeManifest(repoRoot, {
    plugins: [
      { name: "@orbithouse/tool-a", source: "@orbithouse/tool-a", enabled: false, capabilities: ["read-memory"] },
      { name: "@orbithouse/tool-b", source: "@orbithouse/tool-b", enabled: false, capabilities: ["read-memory"] }
    ]
  });
  const result = loadPlugins(repoRoot, { env: { ORBIT_ENABLE_PLUGINS: "true" } });
  assert.equal(result.plugins.length, 0);
  assert.equal(result.errors.length, 2);
  assert.ok(result.errors.every((e) => e.reason === "disabled_in_manifest"));
});

test("loadPlugins refuses duplicate plugin names in the manifest", () => {
  const repoRoot = tmpRepoRoot();
  writeManifest(repoRoot, {
    plugins: [
      { name: "@orbithouse/tool-x", source: "@orbithouse/tool-x", enabled: true, capabilities: ["read-memory"] },
      { name: "@orbithouse/tool-x", source: "@orbithouse/tool-x", enabled: true, capabilities: ["read-memory"] }
    ]
  });
  const result = loadPlugins(repoRoot, { env: { ORBIT_ENABLE_PLUGINS: "true" } });
  const dup = result.errors.find((e) => e.reason === "duplicate_in_manifest");
  assert.ok(dup, "expected duplicate_in_manifest error");
});

test("loadPlugins loads a real plugin module and validates its shape", () => {
  const repoRoot = tmpRepoRoot();
  const pluginName = "tool-loadtest";
  installPluginModule(
    repoRoot,
    pluginName,
    `module.exports = {
      name: "tool-loadtest",
      version: "0.1.0",
      capabilities: ["read-memory"],
      tools: [{
        name: "ping",
        description: "ping",
        inputSchema: { type: "object" },
        handler: async () => ({ status: "ok" })
      }]
    };`
  );
  writeManifest(repoRoot, {
    plugins: [
      { name: pluginName, source: pluginName, enabled: true, capabilities: ["read-memory"], version: "0.1.0", addedAt: "2026-05-24T00:00:00Z", addedBy: "test" }
    ]
  });
  const result = loadPlugins(repoRoot, { env: { ORBIT_ENABLE_PLUGINS: "true" } });
  assert.equal(result.plugins.length, 1, JSON.stringify(result.errors));
  assert.equal(result.plugins[0].name, pluginName);
  assert.equal(result.plugins[0].tools[0].name, "ping");
});

test("loadPlugins refuses a plugin that requests a capability not authorized by the manifest", () => {
  const repoRoot = tmpRepoRoot();
  const pluginName = "tool-overreach";
  installPluginModule(
    repoRoot,
    pluginName,
    `module.exports = {
      name: "tool-overreach",
      version: "0.1.0",
      capabilities: ["read-memory", "wallet"],
      tools: [{
        name: "act",
        description: "act",
        inputSchema: { type: "object" },
        handler: async () => ({ status: "ok" })
      }]
    };`
  );
  writeManifest(repoRoot, {
    plugins: [
      { name: pluginName, source: pluginName, enabled: true, capabilities: ["read-memory"] }
    ]
  });
  const result = loadPlugins(repoRoot, { env: { ORBIT_ENABLE_PLUGINS: "true" } });
  assert.equal(result.plugins.length, 0);
  const err = result.errors.find((e) => /capabilities_not_authorized/.test(e.reason));
  assert.ok(err, "expected capabilities_not_authorized error");
});

// ---- invokeToolSafely ---------------------------------------------------

test("invokeToolSafely catches thrown errors and returns { isError, reason }", async () => {
  const handler = async () => { throw new Error("boom"); };
  const result = await invokeToolSafely(handler, {}, {});
  assert.equal(result.isError, true);
  assert.equal(result.reason, "boom");
});

test("invokeToolSafely catches rejected promises", async () => {
  const handler = () => Promise.reject(new Error("rejected"));
  const result = await invokeToolSafely(handler, {}, {});
  assert.equal(result.isError, true);
  assert.equal(result.reason, "rejected");
});

test("invokeToolSafely runs successful response through sanitizeToolResponse", async () => {
  const handler = async () => ({
    status: "ok",
    text: "should be stripped",
    safe: 1
  });
  const result = await invokeToolSafely(handler, {}, {});
  assert.equal(result.status, "ok");
  assert.equal(result.text, undefined);
  assert.equal(result.safe, 1);
});
