"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  PRE_LAUNCH_MAX_AGE_MS,
  assertPreLaunchNotExpired
} = require("../src/agent/governance");

// T-7 (STABILITY_SECURITY.md): time-based expiry on state.preLaunchVerified.
// A 30-day cap forces re-verification even if the criteria (T-2 hash) have
// not changed. Defense in depth — protects against stale verifications when
// the environment drifts (deps, infra) without the criteria definition
// itself moving.

const DAY_MS = 24 * 60 * 60 * 1000;

test("PRE_LAUNCH_MAX_AGE_MS is exactly 30 days", () => {
  assert.equal(PRE_LAUNCH_MAX_AGE_MS, 30 * DAY_MS);
});

test("assertPreLaunchNotExpired: ok when flag false (nothing to expire)", () => {
  const result = assertPreLaunchNotExpired({}, new Date("2026-05-28T00:00:00Z"));
  assert.equal(result.ok, true);
  assert.equal(result.reason, "pre_launch_not_verified");
});

test("assertPreLaunchNotExpired: fail when flag true but no timestamp", () => {
  const result = assertPreLaunchNotExpired(
    { preLaunchVerified: true },
    new Date("2026-05-28T00:00:00Z")
  );
  assert.equal(result.ok, false);
  assert.equal(result.reason, "pre_launch_age_unknown");
});

test("assertPreLaunchNotExpired: ok when verified within last 30 days", () => {
  const now = new Date("2026-05-28T00:00:00Z");
  const verifiedAt = new Date(now.getTime() - 15 * DAY_MS).toISOString();
  const result = assertPreLaunchNotExpired(
    { preLaunchVerified: true, preLaunchVerifiedAt: verifiedAt },
    now
  );
  assert.equal(result.ok, true);
  assert.equal(result.reason, "verified");
  assert.equal(result.ageMs, 15 * DAY_MS);
});

test("assertPreLaunchNotExpired: fail when verified more than 30 days ago", () => {
  const now = new Date("2026-05-28T00:00:00Z");
  const verifiedAt = new Date(now.getTime() - 31 * DAY_MS).toISOString();
  const result = assertPreLaunchNotExpired(
    { preLaunchVerified: true, preLaunchVerifiedAt: verifiedAt },
    now
  );
  assert.equal(result.ok, false);
  assert.equal(result.reason, "pre_launch_expired");
  assert.equal(result.ageMs, 31 * DAY_MS);
  assert.equal(result.maxAgeMs, 30 * DAY_MS);
});

test("assertPreLaunchNotExpired: fail when verifiedAt is unparseable", () => {
  const result = assertPreLaunchNotExpired(
    { preLaunchVerified: true, preLaunchVerifiedAt: "not-a-date" },
    new Date("2026-05-28T00:00:00Z")
  );
  assert.equal(result.ok, false);
  assert.equal(result.reason, "pre_launch_age_unknown");
});

test("assertPreLaunchNotExpired: edge — exactly 30 days old is still ok", () => {
  const now = new Date("2026-05-28T00:00:00Z");
  const verifiedAt = new Date(now.getTime() - 30 * DAY_MS).toISOString();
  const result = assertPreLaunchNotExpired(
    { preLaunchVerified: true, preLaunchVerifiedAt: verifiedAt },
    now
  );
  assert.equal(result.ok, true);
  assert.equal(result.ageMs, 30 * DAY_MS);
});

test("assertPreLaunchNotExpired: uses Date.now() when no now passed", () => {
  // verifiedAt 1 second ago — should be ok regardless of system clock.
  const verifiedAt = new Date(Date.now() - 1000).toISOString();
  const result = assertPreLaunchNotExpired({
    preLaunchVerified: true,
    preLaunchVerifiedAt: verifiedAt
  });
  assert.equal(result.ok, true);
});
