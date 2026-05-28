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
