"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { loadConfig } = require("../src/agent/config");
const { TOOLS } = require("../src/agent/tools");

test("loadConfig defaults farcaster block to dry-run with safe defaults", () => {
  const config = loadConfig({});
  assert.ok(config.farcaster, "farcaster config block missing");
  assert.equal(config.farcaster.apiKey, "");
  assert.equal(config.farcaster.signerUuid, "");
  assert.equal(config.farcaster.fid, "");
  assert.equal(config.farcaster.dryRun, true, "dryRun must default to TRUE");
  assert.equal(config.farcaster.publicBaseUrl, "https://orbit.horse");
});

test("loadConfig respects ORBIT_FARCASTER_DRY_RUN=false", () => {
  const config = loadConfig({
    ORBIT_FARCASTER_DRY_RUN: "false",
    ORBIT_FARCASTER_NEYNAR_API_KEY: "key123",
    ORBIT_FARCASTER_SIGNER_UUID: "sig-uuid",
    ORBIT_FARCASTER_FID: "12345",
    ORBIT_PUBLIC_URL: "https://example.test"
  });
  assert.equal(config.farcaster.dryRun, false);
  assert.equal(config.farcaster.apiKey, "key123");
  assert.equal(config.farcaster.signerUuid, "sig-uuid");
  assert.equal(config.farcaster.fid, "12345");
  assert.equal(config.farcaster.publicBaseUrl, "https://example.test");
});

test("cast_to_farcaster tool is registered with documented schema", () => {
  const tool = TOOLS.find((entry) => entry.name === "cast_to_farcaster");
  assert.ok(tool, "cast_to_farcaster tool missing from TOOLS");
  assert.equal(tool.inputSchema.type, "object");
  assert.equal(tool.inputSchema.additionalProperties, false);
  assert.deepEqual(
    tool.inputSchema.properties.templateHint.enum,
    ["routine", "refusal", "approval-pending", "milestone", "buyback", "mistake"]
  );
  assert.equal(tool.inputSchema.properties.noteForReceipt.type, "string");
  assert.equal(tool.inputSchema.properties.noteForReceipt.maxLength, 240);
  assert.ok(!("text" in tool.inputSchema.properties), "tool must not accept raw text");
});

test("cast_to_farcaster handler never returns text or rendered fields", async (t) => {
  const fs = require("node:fs");
  const path = require("node:path");
  const farcasterPath = path.resolve(__dirname, "../src/agent/farcaster.js");
  if (!fs.existsSync(farcasterPath)) {
    t.skip("src/agent/farcaster.js not present yet (owned by parallel subagent)");
    return;
  }
  const { executeTool } = require("../src/agent/actions");
  const config = loadConfig({});
  const fakeFarcaster = {
    summarizeCycleForCast: () => ({ cycle: 1, finishedAt: "now" }),
    postCycleCast: async () => ({
      ok: true,
      kind: "routine",
      hash: "0xabc",
      dryRun: true,
      idempotent: false,
      blocked: false,
      status: "dry-run",
      text: "leaked text should not surface",
      rendered: { text: "also leaked" }
    })
  };
  require.cache[farcasterPath] = { id: farcasterPath, filename: farcasterPath, loaded: true, exports: fakeFarcaster };
  try {
    const output = await executeTool(config, null, 1, "cast_to_farcaster", { templateHint: "routine" });
    const keys = Object.keys(output);
    assert.ok(!keys.includes("text"), `handler leaked text key: ${keys.join(",")}`);
    assert.ok(!keys.includes("rendered"), `handler leaked rendered key: ${keys.join(",")}`);
    assert.equal(output.kind, "routine");
    assert.equal(output.dryRun, true);
  } finally {
    delete require.cache[farcasterPath];
  }
});
