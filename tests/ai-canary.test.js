"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  CANARY_SILENT_AFTER_MS,
  CANARY_DEGRADED_FAILURE_THRESHOLD,
  evaluateCanaryHealth
} = require("../src/agent/ai-canary");

// F-1.4 (PLAN/ROADMAP_EXPANSION.md): pure predicate over the T-8 routing
// state. Tells the cycle which providers should get a tiny canary ping
// THIS cycle to detect silent degradation before the next real call.

const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

test("CANARY_SILENT_AFTER_MS defaults to 6 hours", () => {
  assert.equal(CANARY_SILENT_AFTER_MS, 6 * HOUR_MS);
});

test("CANARY_DEGRADED_FAILURE_THRESHOLD defaults to 2", () => {
  assert.equal(CANARY_DEGRADED_FAILURE_THRESHOLD, 2);
});

test("evaluateCanaryHealth: empty routing + provider names → all unknown, all canary-due", () => {
  const result = evaluateCanaryHealth({ providers: {} }, ["p1", "p2"], { now: new Date("2026-05-28T00:00:00Z") });
  assert.equal(result.providers.length, 2);
  for (const p of result.providers) {
    assert.equal(p.status, "unknown");
    assert.equal(p.canaryDue, true);
  }
  assert.deepEqual(result.canaryDue.sort(), ["p1", "p2"]);
});

test("evaluateCanaryHealth: provider with recent success → healthy, no canary", () => {
  const now = new Date("2026-05-28T00:00:00Z");
  const result = evaluateCanaryHealth({
    providers: {
      p1: {
        successCount: 10,
        failureCount: 0,
        rollingFailures: 0,
        lastSuccessAt: new Date(now.getTime() - 10 * MINUTE_MS).toISOString(),
        lastFailureAt: null,
        demoteUntil: null
      }
    }
  }, ["p1"], { now });
  assert.equal(result.providers[0].status, "healthy");
  assert.equal(result.providers[0].canaryDue, false);
  assert.deepEqual(result.canaryDue, []);
});

test("evaluateCanaryHealth: silent provider (no success in 6h+) → canary-due", () => {
  const now = new Date("2026-05-28T00:00:00Z");
  const result = evaluateCanaryHealth({
    providers: {
      p1: {
        successCount: 5,
        failureCount: 0,
        rollingFailures: 0,
        lastSuccessAt: new Date(now.getTime() - 7 * HOUR_MS).toISOString(),
        lastFailureAt: null,
        demoteUntil: null
      }
    }
  }, ["p1"], { now });
  assert.equal(result.providers[0].status, "silent");
  assert.equal(result.providers[0].canaryDue, true);
  assert.deepEqual(result.canaryDue, ["p1"]);
});

test("evaluateCanaryHealth: degraded (rollingFailures ≥ threshold, not yet demoted) → canary-due", () => {
  const now = new Date("2026-05-28T00:00:00Z");
  const result = evaluateCanaryHealth({
    providers: {
      p1: {
        successCount: 3,
        failureCount: 2,
        rollingFailures: 2,
        lastSuccessAt: new Date(now.getTime() - 10 * MINUTE_MS).toISOString(),
        lastFailureAt: new Date(now.getTime() - 5 * MINUTE_MS).toISOString(),
        demoteUntil: null
      }
    }
  }, ["p1"], { now });
  assert.equal(result.providers[0].status, "degraded");
  assert.equal(result.providers[0].canaryDue, true);
});

test("evaluateCanaryHealth: demoted provider → NOT canary-due (already routed around)", () => {
  const now = new Date("2026-05-28T00:00:00Z");
  const result = evaluateCanaryHealth({
    providers: {
      p1: {
        successCount: 1,
        failureCount: 5,
        rollingFailures: 5,
        lastSuccessAt: null,
        lastFailureAt: new Date(now.getTime() - 10 * MINUTE_MS).toISOString(),
        demoteUntil: new Date(now.getTime() + HOUR_MS).toISOString()
      }
    }
  }, ["p1"], { now });
  assert.equal(result.providers[0].status, "demoted");
  assert.equal(result.providers[0].canaryDue, false);
});

test("evaluateCanaryHealth: demoted with expired demoteUntil → re-evaluated as silent/healthy", () => {
  const now = new Date("2026-05-28T00:00:00Z");
  const result = evaluateCanaryHealth({
    providers: {
      p1: {
        successCount: 1,
        failureCount: 5,
        rollingFailures: 0, // reset after demote expiry
        lastSuccessAt: new Date(now.getTime() - 7 * HOUR_MS).toISOString(),
        lastFailureAt: new Date(now.getTime() - 7 * HOUR_MS).toISOString(),
        demoteUntil: new Date(now.getTime() - HOUR_MS).toISOString() // expired
      }
    }
  }, ["p1"], { now });
  assert.equal(result.providers[0].status, "silent"); // not still demoted
  assert.equal(result.providers[0].canaryDue, true);
});

test("evaluateCanaryHealth: provider not in routing state → unknown + canary-due", () => {
  const now = new Date("2026-05-28T00:00:00Z");
  const result = evaluateCanaryHealth({
    providers: {
      p1: {
        successCount: 1, failureCount: 0, rollingFailures: 0,
        lastSuccessAt: new Date(now.getTime() - MINUTE_MS).toISOString(),
        lastFailureAt: null, demoteUntil: null
      }
    }
  }, ["p1", "newcomer"], { now });
  const newcomer = result.providers.find((p) => p.name === "newcomer");
  assert.equal(newcomer.status, "unknown");
  assert.equal(newcomer.canaryDue, true);
});

test("evaluateCanaryHealth: custom silent threshold via options.silentAfterMs", () => {
  const now = new Date("2026-05-28T00:00:00Z");
  const result = evaluateCanaryHealth({
    providers: {
      p1: {
        successCount: 5, failureCount: 0, rollingFailures: 0,
        lastSuccessAt: new Date(now.getTime() - 2 * HOUR_MS).toISOString(),
        lastFailureAt: null, demoteUntil: null
      }
    }
  }, ["p1"], { now, silentAfterMs: HOUR_MS });
  assert.equal(result.providers[0].status, "silent"); // 2h > 1h custom threshold
});

test("evaluateCanaryHealth: empty provider names → empty result", () => {
  const result = evaluateCanaryHealth({ providers: {} }, [], { now: new Date() });
  assert.equal(result.providers.length, 0);
  assert.deepEqual(result.canaryDue, []);
});

test("evaluateCanaryHealth: bad inputs (null routing, null names) → graceful empty", () => {
  const result = evaluateCanaryHealth(null, null);
  assert.equal(result.providers.length, 0);
  assert.deepEqual(result.canaryDue, []);
});
