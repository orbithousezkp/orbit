"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  orderProviders,
  recordSuccess,
  recordFailure,
  routingSnapshot,
  FAILURE_THRESHOLD,
  DEMOTION_DURATION_MS,
  PROMOTION_CLEAN_STRETCH_MS,
  PROMOTION_STEP
} = require("../src/agent/ai-routing");

function fixedRandom(value) {
  return () => value;
}

test("orderProviders preserves order when routing is empty", () => {
  const providers = [{ name: "p1" }, { name: "p2" }, { name: "p3" }];
  const ordered = orderProviders({}, providers, 0, fixedRandom(0.5));
  assert.deepEqual(ordered.map((p) => p.name), ["p1", "p2", "p3"]);
});

test("orderProviders puts higher weight first", () => {
  const routing = {
    providers: {
      p1: { weight: 0.5 },
      p2: { weight: 1.0 }
    }
  };
  const providers = [{ name: "p1" }, { name: "p2" }];
  const ordered = orderProviders(routing, providers, 0, fixedRandom(0.5));
  assert.equal(ordered[0].name, "p2");
});

test("orderProviders treats demoted provider as zero weight", () => {
  const now = Date.parse("2026-05-25T00:00:00Z");
  const routing = {
    providers: {
      p1: { weight: 1.0, demoteUntil: "2026-05-25T01:00:00Z" },
      p2: { weight: 0.5 }
    }
  };
  const ordered = orderProviders(routing, [{ name: "p1" }, { name: "p2" }], now, fixedRandom(0.5));
  assert.equal(ordered[0].name, "p2");
});

test("recordSuccess promotes after clean stretch > 24h", () => {
  const now = Date.parse("2026-05-25T00:00:00Z");
  const routing = {
    providers: {
      p1: {
        weight: 0.5,
        lastFailureAt: new Date(now - PROMOTION_CLEAN_STRETCH_MS - 1000).toISOString()
      }
    }
  };
  recordSuccess(routing, "p1", {}, now);
  assert.equal(routing.providers.p1.weight, 0.75);
});

test("recordSuccess does not promote if failure was recent", () => {
  const now = Date.parse("2026-05-25T00:00:00Z");
  const routing = {
    providers: {
      p1: {
        weight: 0.5,
        lastFailureAt: new Date(now - 60_000).toISOString()
      }
    }
  };
  recordSuccess(routing, "p1", {}, now);
  assert.equal(routing.providers.p1.weight, 0.5);
});

test("recordSuccess clears expired demotion", () => {
  const now = Date.parse("2026-05-25T00:00:00Z");
  const routing = {
    providers: {
      p1: { weight: 0, demoteUntil: new Date(now - 1).toISOString() }
    }
  };
  recordSuccess(routing, "p1", {}, now);
  assert.equal(routing.providers.p1.demoteUntil, null);
});

test("recordFailure demotes after threshold consecutive failures", () => {
  const now = Date.parse("2026-05-25T00:00:00Z");
  const routing = { providers: {} };
  for (let i = 0; i < FAILURE_THRESHOLD; i += 1) {
    recordFailure(routing, "p1", { reason: "timeout" }, now + i);
  }
  const p = routing.providers.p1;
  assert.equal(p.weight, 0);
  const until = Date.parse(p.demoteUntil);
  assert.ok(until >= now + DEMOTION_DURATION_MS);
});

test("recordFailure rolling counter resets on success", () => {
  const now = Date.parse("2026-05-25T00:00:00Z");
  const routing = { providers: {} };
  recordFailure(routing, "p1", {}, now);
  recordFailure(routing, "p1", {}, now + 1);
  assert.equal(routing.providers.p1.rollingFailures, 2);
  recordSuccess(routing, "p1", {}, now + 2);
  assert.equal(routing.providers.p1.rollingFailures, 0);
});

test("recordSuccess updates moving-average latency", () => {
  const now = Date.parse("2026-05-25T00:00:00Z");
  const routing = { providers: {} };
  recordSuccess(routing, "p1", { latencyMs: 1000 }, now);
  recordSuccess(routing, "p1", { latencyMs: 2000 }, now + 1);
  const avg = routing.providers.p1.avgLatencyMs;
  assert.ok(avg > 1000 && avg < 2000);
});

test("routingSnapshot returns serializable plain object", () => {
  const routing = { providers: {} };
  recordSuccess(routing, "p1", { latencyMs: 500 });
  recordFailure(routing, "p2", { reason: "x" });
  const snap = routingSnapshot(routing);
  assert.ok(snap.providers.p1);
  assert.ok(snap.providers.p2);
  JSON.stringify(snap); // must not throw
});
