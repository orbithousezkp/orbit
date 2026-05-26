"use strict";

// clanker.js carries the only code that actually deploys a token and
// records the launch. Layer 1 (persistLaunchOnceFired) and its alert
// path (writeLaunchPersistFailure) are load-bearing parts of the
// "fires exactly once" guarantee. Existing tests cover the
// outer gate (clanker-gate.test.js, launch-idempotency.test.js); these
// pin the persistence functions themselves.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  persistLaunchOnceFired,
  writeLaunchPersistFailure,
  hasLaunchPersistFailure,
  rewardSplit,
  treasurySafeFromEnv
} = require("../src/agent/clanker");

function tempRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "orbit-clanker-test-"));
  fs.mkdirSync(path.join(dir, "memory"), { recursive: true });
  return dir;
}

function readState(repoRoot) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, "memory/state.json"), "utf-8"));
}

test("persistLaunchOnceFired sets the flag from a missing file (cold start)", () => {
  const repoRoot = tempRepo();
  const result = persistLaunchOnceFired(repoRoot);
  assert.deepEqual(result, { ok: true });
  assert.equal(readState(repoRoot).launchOnceFired, true);
});

test("persistLaunchOnceFired preserves all other state fields when flipping the flag", () => {
  const repoRoot = tempRepo();
  fs.writeFileSync(
    path.join(repoRoot, "memory/state.json"),
    JSON.stringify({ cycle: 42, born: "2026-01-01T00:00:00Z", aiRouting: { providers: {} } }, null, 2)
  );
  persistLaunchOnceFired(repoRoot);
  const next = readState(repoRoot);
  assert.equal(next.cycle, 42);
  assert.equal(next.born, "2026-01-01T00:00:00Z");
  assert.deepEqual(next.aiRouting, { providers: {} });
  assert.equal(next.launchOnceFired, true);
});

test("persistLaunchOnceFired is idempotent (re-call from launchOnceFired=true is safe)", () => {
  const repoRoot = tempRepo();
  persistLaunchOnceFired(repoRoot);
  assert.doesNotThrow(() => persistLaunchOnceFired(repoRoot));
  assert.equal(readState(repoRoot).launchOnceFired, true);
});

test("persistLaunchOnceFired refuses to write when state.json is unparseable (PARSE_FAILED)", () => {
  // Critical fail-closed behavior — without this, a corrupt state file
  // would be overwritten by a bare {launchOnceFired:true}, destroying
  // cycle/born/aiRouting/etc.
  const repoRoot = tempRepo();
  const statePath = path.join(repoRoot, "memory/state.json");
  fs.writeFileSync(statePath, "{ this is not json");
  const originalBytes = fs.readFileSync(statePath, "utf-8");
  assert.throws(
    () => persistLaunchOnceFired(repoRoot),
    (err) => err.code === "PARSE_FAILED"
  );
  // Original bytes preserved on refusal.
  assert.equal(fs.readFileSync(statePath, "utf-8"), originalBytes);
});

test("persistLaunchOnceFired requires repoRoot (NO_REPO_ROOT)", () => {
  assert.throws(
    () => persistLaunchOnceFired(""),
    (err) => err.code === "NO_REPO_ROOT"
  );
  assert.throws(
    () => persistLaunchOnceFired(null),
    (err) => err.code === "NO_REPO_ROOT"
  );
});

test("persistLaunchOnceFired leaves no .tmp file behind on success", () => {
  const repoRoot = tempRepo();
  persistLaunchOnceFired(repoRoot);
  const memEntries = fs.readdirSync(path.join(repoRoot, "memory"));
  assert.deepEqual(memEntries.filter((n) => n.endsWith(".tmp")), []);
});

test("writeLaunchPersistFailure swallows errors (the alert path must never throw)", () => {
  // This function is called when Layer 1 already failed. If IT throws too,
  // the upstream caller sees the wrong error.
  const result = writeLaunchPersistFailure("", { reason: "test" });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "no_repo_root");
});

test("writeLaunchPersistFailure writes a JSON marker that hasLaunchPersistFailure can detect", () => {
  const repoRoot = tempRepo();
  const result = writeLaunchPersistFailure(repoRoot, {
    reason: "tmp_write_failed",
    timestamp: "2026-06-01T00:00:00Z"
  });
  assert.equal(result.ok, true);
  assert.equal(hasLaunchPersistFailure(repoRoot), true);
  assert.equal(hasLaunchPersistFailure(tempRepo()), false);
});

test("rewardSplit enforces operatorBps in [0, 10000] and computes treasuryBps", () => {
  assert.deepEqual(rewardSplit({ operatorRevenueBps: 500 }), {
    operatorBps: 500,
    treasuryBps: 9500
  });
  assert.deepEqual(rewardSplit({ operatorRevenueBps: 0 }), {
    operatorBps: 0,
    treasuryBps: 10000
  });
  assert.throws(() => rewardSplit({ operatorRevenueBps: -1 }), /between 0 and 10000/);
  assert.throws(() => rewardSplit({ operatorRevenueBps: 10001 }), /between 0 and 10000/);
  assert.throws(() => rewardSplit({ operatorRevenueBps: 1.5 }), /between 0 and 10000/);
  assert.throws(() => rewardSplit({ operatorRevenueBps: "500" }), /between 0 and 10000/);
});

test("treasurySafeFromEnv returns null when ORBIT_TREASURY_SAFE is unset or invalid", () => {
  assert.equal(treasurySafeFromEnv({}), null);
  assert.equal(treasurySafeFromEnv({ ORBIT_TREASURY_SAFE: "not an address" }), null);
});

test("treasurySafeFromEnv returns the address when ORBIT_TREASURY_SAFE is a valid EVM address", () => {
  const addr = "0x1111111111111111111111111111111111111111";
  const got = treasurySafeFromEnv({ ORBIT_TREASURY_SAFE: addr });
  // safes.addressOf canonicalizes; the result should equal the input
  // ignoring case.
  assert.ok(typeof got === "string");
  assert.equal(String(got).toLowerCase(), addr);
});

test("treasurySafeFromEnv ignores legacy ORBIT_TREASURY_ADDRESS (Bug F: forced migration)", () => {
  // The legacy var must not satisfy the Safe-from-env check, even when
  // the legacy address resolves elsewhere. readiness() depends on this.
  const got = treasurySafeFromEnv({
    ORBIT_TREASURY_ADDRESS: "0x2222222222222222222222222222222222222222"
  });
  assert.equal(got, null);
});
