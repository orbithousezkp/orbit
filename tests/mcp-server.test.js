"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { handleMessage, PROTOCOL_VERSION, SERVER_INFO } = require("../packages/orbit-mcp-server/src/server");
const { adapt } = require("../packages/orbit-mcp-server/src/sdk-adapter");
const { defineTools, listToolsManifest, callTool } = require("../packages/orbit-mcp-server/src/tools");
const { listResources, readResource } = require("../packages/orbit-mcp-server/src/resources");

function writeJson(repoRoot, relativePath, value) {
  const full = path.join(repoRoot, relativePath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, `${JSON.stringify(value, null, 2)}\n`);
}

function writeJsonl(repoRoot, relativePath, lines) {
  const full = path.join(repoRoot, relativePath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, lines.map((l) => JSON.stringify(l)).join("\n") + "\n");
}

function tempRepo() {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "orbit-mcp-"));
  writeJson(repoRoot, "memory/state.json", {
    cycle: 7,
    born: "2026-05-20T00:00:00.000Z",
    lastActive: "2026-05-25T00:00:00.000Z",
    lastStatus: "completed"
  });
  writeJson(repoRoot, "memory/infrastructure.json", {
    product: { name: "Orbit", category: "agent control plane" },
    activePhase: { id: "phase-1", name: "Launch", status: "active" },
    blockedUntilApproved: []
  });
  writeJson(repoRoot, "memory/governance.json", {
    externalSpend: { mode: "owner_approval_required", allowedWithoutApproval: ["gas"] }
  });
  writeJson(repoRoot, "memory/treasury.json", {
    token: { symbol: "ORBIT", launchStatus: "planned" },
    fees: { perCycleCapWei: "1000000000000000000" }
  });
  writeJsonl(repoRoot, "memory/cycles.jsonl", [
    { cycle: 5, status: "completed", at: "2026-05-22T00:00:00Z" },
    { cycle: 6, status: "completed", at: "2026-05-23T00:00:00Z" },
    { cycle: 7, status: "completed", at: "2026-05-24T00:00:00Z" }
  ]);
  return repoRoot;
}

test("handleMessage initialize returns serverInfo and protocolVersion", () => {
  const ctx = { adapter: adapt(tempRepo()), tools: defineTools(adapt(tempRepo())) };
  const response = JSON.parse(handleMessage({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} }, ctx));
  assert.equal(response.result.protocolVersion, PROTOCOL_VERSION);
  assert.equal(response.result.serverInfo.name, SERVER_INFO.name);
  assert.ok(response.result.capabilities.tools);
  assert.ok(response.result.capabilities.resources);
});

test("handleMessage notifications/initialized returns null (no response)", () => {
  const ctx = { adapter: adapt(tempRepo()), tools: [] };
  assert.equal(handleMessage({ jsonrpc: "2.0", method: "notifications/initialized" }, ctx), null);
});

test("handleMessage tools/list returns 6 tools with schemas", () => {
  const adapter = adapt(tempRepo());
  const ctx = { adapter, tools: defineTools(adapter) };
  const response = JSON.parse(handleMessage({ jsonrpc: "2.0", id: 2, method: "tools/list" }, ctx));
  const names = response.result.tools.map((t) => t.name);
  assert.deepEqual(names.sort(), [
    "getCycles",
    "getDashboardProjection",
    "getFederationPeers",
    "getRefusals",
    "getReceipt",
    "getTreasury"
  ].sort());
  for (const tool of response.result.tools) {
    assert.equal(typeof tool.description, "string");
    assert.equal(typeof tool.inputSchema, "object");
  }
});

test("handleMessage tools/call getCycles returns recent cycles newest-first", () => {
  const adapter = adapt(tempRepo());
  const ctx = { adapter, tools: defineTools(adapter) };
  const response = JSON.parse(handleMessage({
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: { name: "getCycles", arguments: { limit: 10 } }
  }, ctx));
  const payload = JSON.parse(response.result.content[0].text);
  assert.equal(payload[0].cycle, 7);
  assert.equal(payload[2].cycle, 5);
});

test("handleMessage tools/call getTreasury returns treasury snapshot", () => {
  const adapter = adapt(tempRepo());
  const ctx = { adapter, tools: defineTools(adapter) };
  const response = JSON.parse(handleMessage({
    jsonrpc: "2.0",
    id: 4,
    method: "tools/call",
    params: { name: "getTreasury", arguments: {} }
  }, ctx));
  const payload = JSON.parse(response.result.content[0].text);
  assert.equal(payload.token.symbol, "ORBIT");
});

test("handleMessage tools/call getDashboardProjection returns the slim shape", () => {
  const adapter = adapt(tempRepo());
  const ctx = { adapter, tools: defineTools(adapter) };
  const response = JSON.parse(handleMessage({
    jsonrpc: "2.0",
    id: 5,
    method: "tools/call",
    params: { name: "getDashboardProjection", arguments: {} }
  }, ctx));
  const slim = JSON.parse(response.result.content[0].text);
  assert.equal(slim.schema, "orbit-dashboard/1");
  assert.equal(slim.lifecycle.cycle, 7);
  assert.ok(slim.missions);
});

test("handleMessage tools/call with unknown tool returns isError", () => {
  const adapter = adapt(tempRepo());
  const ctx = { adapter, tools: defineTools(adapter) };
  const response = JSON.parse(handleMessage({
    jsonrpc: "2.0",
    id: 6,
    method: "tools/call",
    params: { name: "doesNotExist", arguments: {} }
  }, ctx));
  assert.equal(response.result.isError, true);
  assert.match(response.result.content[0].text, /unknown tool/);
});

test("handleMessage tools/call getReceipt with missing cycle param returns error in content", () => {
  const adapter = adapt(tempRepo());
  const ctx = { adapter, tools: defineTools(adapter) };
  const response = JSON.parse(handleMessage({
    jsonrpc: "2.0",
    id: 7,
    method: "tools/call",
    params: { name: "getReceipt", arguments: {} }
  }, ctx));
  const payload = JSON.parse(response.result.content[0].text);
  assert.match(payload.error, /cycle parameter must be a number/);
});

test("handleMessage resources/list includes dashboard plus cycle/receipt URIs", () => {
  const adapter = adapt(tempRepo());
  const ctx = { adapter, tools: defineTools(adapter) };
  const response = JSON.parse(handleMessage({ jsonrpc: "2.0", id: 8, method: "resources/list" }, ctx));
  const uris = response.result.resources.map((r) => r.uri);
  assert.ok(uris.includes("dashboard://current"));
  assert.ok(uris.some((u) => u.startsWith("cycle://")));
  assert.ok(uris.some((u) => u.startsWith("receipt://")));
});

test("handleMessage resources/read parses cycle://N URI", () => {
  const adapter = adapt(tempRepo());
  const ctx = { adapter, tools: defineTools(adapter) };
  const response = JSON.parse(handleMessage({
    jsonrpc: "2.0",
    id: 9,
    method: "resources/read",
    params: { uri: "cycle://6" }
  }, ctx));
  const data = JSON.parse(response.result.contents[0].text);
  assert.equal(data.cycle, 6);
});

test("handleMessage resources/read with unsupported URI returns error payload", () => {
  const adapter = adapt(tempRepo());
  const ctx = { adapter, tools: defineTools(adapter) };
  const response = JSON.parse(handleMessage({
    jsonrpc: "2.0",
    id: 10,
    method: "resources/read",
    params: { uri: "bogus://thing" }
  }, ctx));
  const data = JSON.parse(response.result.contents[0].text);
  assert.match(data.error, /unsupported resource uri/);
});

test("handleMessage unknown method returns JSON-RPC -32601", () => {
  const adapter = adapt(tempRepo());
  const ctx = { adapter, tools: defineTools(adapter) };
  const response = JSON.parse(handleMessage({ jsonrpc: "2.0", id: 11, method: "doesNotExist" }, ctx));
  assert.equal(response.error.code, -32601);
  assert.match(response.error.message, /method not found/);
});

test("handleMessage ping returns empty result", () => {
  const adapter = adapt(tempRepo());
  const ctx = { adapter, tools: defineTools(adapter) };
  const response = JSON.parse(handleMessage({ jsonrpc: "2.0", id: 12, method: "ping" }, ctx));
  assert.deepEqual(response.result, {});
});

test("getFederationPeers returns empty array when no registry exists", () => {
  const adapter = adapt(tempRepo());
  assert.deepEqual(adapter.getFederationPeers(), []);
});

test("getFederationPeers reads memory/federation.json when present", () => {
  const repoRoot = tempRepo();
  writeJson(repoRoot, "memory/federation.json", {
    peers: [
      { repo: "alice/orbit", url: "https://alice.example/.well-known/orbit.json" },
      { repo: "bob/orbit", url: "https://bob.example/.well-known/orbit.json" }
    ]
  });
  const adapter = adapt(repoRoot);
  const peers = adapter.getFederationPeers();
  assert.equal(peers.length, 2);
  assert.equal(peers[0].repo, "alice/orbit");
});

test("listToolsManifest returns name/description/inputSchema only (no handler leak)", () => {
  const adapter = adapt(tempRepo());
  const tools = defineTools(adapter);
  const manifest = listToolsManifest(tools);
  for (const item of manifest) {
    assert.equal(Object.keys(item).sort().join(","), "description,inputSchema,name");
  }
});

test("callTool catches handler exceptions and returns isError", () => {
  const tools = [{
    name: "explode",
    description: "always throws",
    handler: () => { throw new Error("boom"); }
  }];
  const result = callTool(tools, "explode", {});
  assert.equal(result.isError, true);
  assert.match(result.content[0].text, /boom/);
});
