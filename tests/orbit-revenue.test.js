"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const orbitRevenue = require("../src/cli/orbit-revenue");

function tempRepo() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "orbit-rev-cli-"));
}

function writeJson(repoRoot, relativePath, value) {
  const full = path.join(repoRoot, relativePath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, `${JSON.stringify(value, null, 2)}\n`);
}

class CollectingStream {
  constructor() {
    this.chunks = [];
  }
  write(chunk) {
    this.chunks.push(String(chunk));
    return true;
  }
  toString() {
    return this.chunks.join("");
  }
}

// ---------------------------------------------------------------------------
// parseArgv
// ---------------------------------------------------------------------------

test("parseArgv: no args -> defaults", () => {
  const flags = orbitRevenue.parseArgv(["node", "orbit-revenue.js"]);
  assert.equal(flags.json, false);
  assert.equal(flags.help, false);
  assert.equal(flags.repoRoot, null);
});

test("parseArgv: --json sets json true", () => {
  const flags = orbitRevenue.parseArgv(["node", "orbit-revenue.js", "--json"]);
  assert.equal(flags.json, true);
  assert.equal(flags.help, false);
});

test("parseArgv: --help / -h set help true", () => {
  const f1 = orbitRevenue.parseArgv(["node", "orbit-revenue.js", "--help"]);
  const f2 = orbitRevenue.parseArgv(["node", "orbit-revenue.js", "-h"]);
  assert.equal(f1.help, true);
  assert.equal(f2.help, true);
});

test("parseArgv: --repo-root accepts space-separated or equal form", () => {
  const f1 = orbitRevenue.parseArgv(["node", "orbit-revenue.js", "--repo-root", "/tmp/x"]);
  const f2 = orbitRevenue.parseArgv(["node", "orbit-revenue.js", "--repo-root=/tmp/y"]);
  assert.equal(f1.repoRoot, "/tmp/x");
  assert.equal(f2.repoRoot, "/tmp/y");
});

test("parseArgv: --repo-root without value leaves repoRoot null", () => {
  // a bare --repo-root followed by another flag should not consume it
  const flags = orbitRevenue.parseArgv(["node", "orbit-revenue.js", "--repo-root", "--json"]);
  assert.equal(flags.repoRoot, null);
  assert.equal(flags.json, true);
});

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

test("main: --help prints help text and exits 0", () => {
  const stdout = new CollectingStream();
  const stderr = new CollectingStream();
  const code = orbitRevenue.main(
    ["node", "orbit-revenue.js", "--help"],
    { stdout, stderr, env: {} }
  );
  assert.equal(code, 0);
  assert.ok(stdout.toString().includes("orbit-revenue"));
  assert.equal(stderr.toString(), "");
});

test("main: no state.json or treasury.json in repo emits empty summary and exit 0", () => {
  const repoRoot = tempRepo();
  const stdout = new CollectingStream();
  const stderr = new CollectingStream();
  const code = orbitRevenue.main(
    ["node", "orbit-revenue.js", "--repo-root", repoRoot],
    { stdout, stderr, env: {} }
  );
  assert.equal(code, 0);
  const out = stdout.toString();
  assert.ok(out.includes("=== Orbit Revenue Summary ==="));
  assert.ok(out.includes("Status: 0 active stream"));
});

test("main: populated state + treasury prints expected sections", () => {
  const repoRoot = tempRepo();
  writeJson(repoRoot, "memory/state.json", {
    problemLab: {
      experiments: [{
        id: "exp-foo",
        status: "bounded_live",
        hypothesis: "test",
        streamType: "ai_routing_margin",
        budgetWei: "1000",
        spentWei: "100",
        createdAt: "2026-05-01T00:00:00.000Z"
      }]
    },
    revenueExplorer: {
      draftProposals: [{
        id: "draft-foo",
        archetypeId: "ai_routing_margin_expansion",
        streamType: "ai_routing_margin",
        hypothesis: "expand",
        draftedAt: "2026-05-20T00:00:00.000Z"
      }]
    }
  });
  writeJson(repoRoot, "memory/treasury.json", {
    revenue: {
      streams: [{
        id: "ai-routing-margin",
        type: "ai_routing_margin",
        status: "active",
        lifetimeRevenueWei: "123",
        createdAt: "2026-04-01T00:00:00.000Z"
      }]
    }
  });
  const stdout = new CollectingStream();
  const stderr = new CollectingStream();
  const code = orbitRevenue.main(
    ["node", "orbit-revenue.js", "--repo-root", repoRoot],
    { stdout, stderr, env: {} }
  );
  assert.equal(code, 0);
  const out = stdout.toString();
  assert.ok(out.includes("ai-routing-margin"));
  assert.ok(out.includes("exp-foo"));
  assert.ok(out.includes("draft-foo"));
});

test("main: --json emits parseable JSON", () => {
  const repoRoot = tempRepo();
  writeJson(repoRoot, "memory/state.json", {});
  writeJson(repoRoot, "memory/treasury.json", {});
  const stdout = new CollectingStream();
  const stderr = new CollectingStream();
  const code = orbitRevenue.main(
    ["node", "orbit-revenue.js", "--json", "--repo-root", repoRoot],
    { stdout, stderr, env: {} }
  );
  assert.equal(code, 0);
  const out = stdout.toString();
  // strip trailing newline and parse
  const parsed = JSON.parse(out);
  assert.equal(typeof parsed.generatedAt, "string");
  assert.ok(parsed.streams);
  assert.ok(parsed.experiments);
});

test("main: malformed state.json doesn't crash, falls back to empty summary", () => {
  const repoRoot = tempRepo();
  fs.mkdirSync(path.join(repoRoot, "memory"), { recursive: true });
  fs.writeFileSync(path.join(repoRoot, "memory/state.json"), "not-json-at-all");
  const stdout = new CollectingStream();
  const stderr = new CollectingStream();
  const code = orbitRevenue.main(
    ["node", "orbit-revenue.js", "--repo-root", repoRoot],
    { stdout, stderr, env: {} }
  );
  assert.equal(code, 0);
  const out = stdout.toString();
  assert.ok(out.includes("Status: 0 active stream"));
});
