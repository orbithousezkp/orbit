"use strict";

// Tests for cycle-failure backoff (Patch Set W).
//
// Pure functions, easy to pin. The integration is exercised through
// detectPriorFailure + applyBackoff + isBackedOff together, since
// that's the sequence run.js calls.

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  BACKOFF_THRESHOLD,
  BASE_BACKOFF_MS,
  MAX_BACKOFF_MS,
  ORPHAN_MAX_AGE_MS,
  applyBackoff,
  clearBackoff,
  computeBackoffMs,
  detectPriorFailure,
  isBackedOff
} = require("../src/agent/cycle-backoff");

test("computeBackoffMs returns 0 below the threshold", () => {
  for (let n = 0; n < BACKOFF_THRESHOLD; n++) {
    assert.equal(computeBackoffMs(n), 0, `n=${n}`);
  }
});

test("computeBackoffMs grows exponentially from the threshold up", () => {
  assert.equal(computeBackoffMs(3), BASE_BACKOFF_MS);          // 30 min
  assert.equal(computeBackoffMs(4), BASE_BACKOFF_MS * 2);      // 1 h
  assert.equal(computeBackoffMs(5), BASE_BACKOFF_MS * 4);      // 2 h
  assert.equal(computeBackoffMs(6), BASE_BACKOFF_MS * 8);      // 4 h
  assert.equal(computeBackoffMs(7), BASE_BACKOFF_MS * 16);     // 8 h
});

test("computeBackoffMs caps at MAX_BACKOFF_MS (24h)", () => {
  // 2^(20-3) * 30min is way past 24h.
  assert.equal(computeBackoffMs(20), MAX_BACKOFF_MS);
  assert.equal(computeBackoffMs(100), MAX_BACKOFF_MS);
});

test("computeBackoffMs treats non-numeric / negative as 0", () => {
  assert.equal(computeBackoffMs(undefined), 0);
  assert.equal(computeBackoffMs(null), 0);
  assert.equal(computeBackoffMs("not a number"), 0);
  assert.equal(computeBackoffMs(-3), 0);
});

test("detectPriorFailure requires lastStatus='running' AND fresh lastActive", () => {
  const now = new Date("2026-06-01T12:00:00Z");
  // Happy path: running + recent
  assert.equal(
    detectPriorFailure({ lastStatus: "running", lastActive: "2026-06-01T11:55:00Z" }, { now }),
    true
  );
  // Stale: running but very old
  assert.equal(
    detectPriorFailure({ lastStatus: "running", lastActive: "2026-05-01T00:00:00Z" }, { now }),
    false,
    "stale running flag must not trip backoff"
  );
  // Not running
  assert.equal(
    detectPriorFailure({ lastStatus: "completed", lastActive: "2026-06-01T11:55:00Z" }, { now }),
    false
  );
  // Missing fields
  assert.equal(detectPriorFailure({ lastStatus: "running" }, { now }), false);
  assert.equal(detectPriorFailure({}, { now }), false);
  assert.equal(detectPriorFailure(null, { now }), false);
});

test("detectPriorFailure honors the 6h orphan window exactly", () => {
  const now = new Date("2026-06-01T12:00:00Z");
  const justInside = new Date(now.getTime() - ORPHAN_MAX_AGE_MS + 60_000).toISOString();
  const justOutside = new Date(now.getTime() - ORPHAN_MAX_AGE_MS - 60_000).toISOString();
  assert.equal(
    detectPriorFailure({ lastStatus: "running", lastActive: justInside }, { now }),
    true
  );
  assert.equal(
    detectPriorFailure({ lastStatus: "running", lastActive: justOutside }, { now }),
    false
  );
});

test("applyBackoff increments the counter and sets failureBackoffUntilAt past threshold", () => {
  const now = new Date("2026-06-01T12:00:00Z");
  const state = { consecutiveFailures: 2 };       // one more push and we're at threshold
  const result = applyBackoff(state, { now });
  assert.equal(state.consecutiveFailures, 3);
  assert.equal(result.tripped, true);
  assert.equal(result.delayMs, BASE_BACKOFF_MS);
  // failureBackoffUntilAt = now + 30 min
  assert.equal(state.failureBackoffUntilAt, new Date(now.getTime() + BASE_BACKOFF_MS).toISOString());
});

test("applyBackoff below threshold increments counter but does not set the backoff field", () => {
  const now = new Date("2026-06-01T12:00:00Z");
  const state = { consecutiveFailures: 0 };
  const result = applyBackoff(state, { now });
  assert.equal(state.consecutiveFailures, 1);
  assert.equal(result.tripped, false);
  assert.equal(state.failureBackoffUntilAt, undefined);
});

test("clearBackoff resets counter and removes the backoff field", () => {
  const state = {
    consecutiveFailures: 5,
    failureBackoffUntilAt: "2026-06-01T13:00:00Z"
  };
  clearBackoff(state);
  assert.equal(state.consecutiveFailures, 0);
  assert.equal(state.failureBackoffUntilAt, undefined);
});

test("clearBackoff is a no-op on a clean state (doesn't add fields)", () => {
  const state = { cycle: 1, born: "x" };
  clearBackoff(state);
  assert.deepEqual(Object.keys(state).sort(), ["born", "cycle"]);
});

test("isBackedOff returns skip:true while the timer is in the future", () => {
  const now = new Date("2026-06-01T12:00:00Z");
  const state = {
    consecutiveFailures: 3,
    failureBackoffUntilAt: new Date(now.getTime() + 10 * 60_000).toISOString()
  };
  const r = isBackedOff(state, { now });
  assert.equal(r.skip, true);
  assert.equal(r.consecutiveFailures, 3);
  assert.equal(r.remainingMs, 10 * 60_000);
});

test("isBackedOff returns skip:false (with expired flag) once the timer is past", () => {
  const now = new Date("2026-06-01T13:00:00Z");
  const state = {
    consecutiveFailures: 3,
    failureBackoffUntilAt: new Date(now.getTime() - 60_000).toISOString()
  };
  const r = isBackedOff(state, { now });
  assert.equal(r.skip, false);
  assert.equal(r.expired, true);
});

test("isBackedOff returns skip:false on missing or unparseable field", () => {
  assert.equal(isBackedOff({}, {}).skip, false);
  assert.equal(isBackedOff({ failureBackoffUntilAt: "garbage" }, {}).skip, false);
});

test("end-to-end: 3 consecutive crashes trip backoff; success clears it", () => {
  const now = new Date("2026-06-01T12:00:00Z");
  const state = { consecutiveFailures: 0, lastStatus: "running", lastActive: now.toISOString() };

  // Crash 1: detected, counter=1, no backoff
  assert.equal(detectPriorFailure(state, { now }), true);
  let r = applyBackoff(state, { now });
  assert.equal(r.tripped, false);
  assert.equal(state.consecutiveFailures, 1);

  // Crash 2: counter=2, no backoff
  r = applyBackoff(state, { now });
  assert.equal(r.tripped, false);
  assert.equal(state.consecutiveFailures, 2);

  // Crash 3: counter=3, TRIPS
  r = applyBackoff(state, { now });
  assert.equal(r.tripped, true);
  assert.equal(state.consecutiveFailures, 3);
  assert.ok(state.failureBackoffUntilAt);

  // While the timer is in the future, isBackedOff says skip
  assert.equal(isBackedOff(state, { now }).skip, true);

  // Successful cycle complete clears everything
  clearBackoff(state);
  assert.equal(state.consecutiveFailures, 0);
  assert.equal(state.failureBackoffUntilAt, undefined);
  assert.equal(isBackedOff(state, { now }).skip, false);
});
