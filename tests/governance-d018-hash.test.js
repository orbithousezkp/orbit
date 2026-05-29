"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  D018_CRITERIA,
  d018CriteriaHash,
  assertPreLaunchHashIntegrity
} = require("../src/agent/governance");

// T-2: bind state.preLaunchVerified to a sha256 hash of the 8 D-018 criteria.
// When criteria drift, the hash changes; states bound to the old hash become
// invalid. This is the "sticky flag" exploit closure from STABILITY_SECURITY.md T-2.

test("D018_CRITERIA exports the canonical 8-item list", () => {
  assert.ok(Array.isArray(D018_CRITERIA), "D018_CRITERIA must be an array");
  assert.equal(D018_CRITERIA.length, 8, "D-018 has exactly 8 criteria");
  for (const c of D018_CRITERIA) {
    assert.equal(typeof c.id, "number");
    assert.equal(typeof c.label, "string");
    assert.ok(c.label.length > 0);
  }
});

test("d018CriteriaHash() returns a stable sha256 hex prefix", () => {
  const h1 = d018CriteriaHash();
  const h2 = d018CriteriaHash();
  assert.equal(h1, h2, "hash must be deterministic across calls");
  assert.match(h1, /^[0-9a-f]{16}$/, "hash is a 16-char sha256 prefix");
});

test("assertPreLaunchHashIntegrity: ok when flag false (no hash needed)", () => {
  const result = assertPreLaunchHashIntegrity({});
  assert.equal(result.ok, true);
  assert.equal(result.reason, "pre_launch_not_verified");
});

test("assertPreLaunchHashIntegrity: ok when flag true and hash matches", () => {
  const result = assertPreLaunchHashIntegrity({
    preLaunchVerified: true,
    preLaunchVerifiedHash: d018CriteriaHash()
  });
  assert.equal(result.ok, true);
  assert.equal(result.reason, "verified");
  assert.equal(result.currentHash, d018CriteriaHash());
});

test("assertPreLaunchHashIntegrity: drift detected when flag true but hash missing", () => {
  const result = assertPreLaunchHashIntegrity({
    preLaunchVerified: true
    // no preLaunchVerifiedHash
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "pre_launch_hash_missing");
  assert.equal(result.expectedHash, d018CriteriaHash());
});

test("assertPreLaunchHashIntegrity: drift detected when hash does not match current criteria", () => {
  const result = assertPreLaunchHashIntegrity({
    preLaunchVerified: true,
    preLaunchVerifiedHash: "deadbeefdeadbeef"
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "pre_launch_hash_drift");
  assert.equal(result.currentHash, "deadbeefdeadbeef");
  assert.equal(result.expectedHash, d018CriteriaHash());
});

// T-2b (security audit 2026-05-29): hash now includes explicit
// D018_CRITERIA_VERSION. Confirms a benign refactor (whitespace, label
// rephrase) is intentional via the version, not silently encoded by
// label content alone.

test("D018_CRITERIA_VERSION exported as integer", () => {
  const { D018_CRITERIA_VERSION } = require("../src/agent/governance");
  assert.equal(typeof D018_CRITERIA_VERSION, "number");
  assert.equal(Number.isInteger(D018_CRITERIA_VERSION), true);
  assert.ok(D018_CRITERIA_VERSION >= 1);
});

test("T-2b: hash incorporates version (forward-compat documentation)", () => {
  // We can't test "future version bump changes hash" without forking the
  // module, but we CAN test the structure: hash should differ from a
  // hash of bare items array (proves version is part of the input).
  const bareHash = require("crypto")
    .createHash("sha256")
    .update(JSON.stringify(D018_CRITERIA))
    .digest("hex")
    .slice(0, 16);
  assert.notEqual(d018CriteriaHash(), bareHash, "current hash must include version, not bare items");
});

// T-2/T-7d: combined gate (used by clanker + treasury-sweep + others).
const { assertPreLaunchGate, PRE_LAUNCH_MAX_AGE_MS: MAX_AGE } = require("../src/agent/governance");

test("assertPreLaunchGate: flag false → ok:false reason=pre_launch_not_verified", () => {
  const r = assertPreLaunchGate({});
  assert.equal(r.ok, false);
  assert.equal(r.reason, "pre_launch_not_verified");
});

test("assertPreLaunchGate: flag true + correct hash + fresh → ok:true", () => {
  const r = assertPreLaunchGate({
    preLaunchVerified: true,
    preLaunchVerifiedHash: d018CriteriaHash(),
    preLaunchVerifiedAt: new Date().toISOString()
  });
  assert.equal(r.ok, true);
});

test("assertPreLaunchGate: flag true but hash missing → ok:false reason=pre_launch_hash_missing", () => {
  const r = assertPreLaunchGate({
    preLaunchVerified: true,
    preLaunchVerifiedAt: new Date().toISOString()
  });
  assert.equal(r.ok, false);
  assert.equal(r.reason, "pre_launch_hash_missing");
});

test("assertPreLaunchGate: flag true but hash drift → ok:false reason=pre_launch_hash_drift", () => {
  const r = assertPreLaunchGate({
    preLaunchVerified: true,
    preLaunchVerifiedHash: "deadbeefdeadbeef",
    preLaunchVerifiedAt: new Date().toISOString()
  });
  assert.equal(r.ok, false);
  assert.equal(r.reason, "pre_launch_hash_drift");
});

test("assertPreLaunchGate: flag true but age unknown → ok:false reason=pre_launch_age_unknown", () => {
  const r = assertPreLaunchGate({
    preLaunchVerified: true,
    preLaunchVerifiedHash: d018CriteriaHash()
    // no preLaunchVerifiedAt
  });
  assert.equal(r.ok, false);
  assert.equal(r.reason, "pre_launch_age_unknown");
});

test("assertPreLaunchGate: flag true + correct hash but expired → ok:false reason=pre_launch_expired", () => {
  const stale = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
  const r = assertPreLaunchGate({
    preLaunchVerified: true,
    preLaunchVerifiedHash: d018CriteriaHash(),
    preLaunchVerifiedAt: stale
  });
  assert.equal(r.ok, false);
  assert.equal(r.reason, "pre_launch_expired");
});
