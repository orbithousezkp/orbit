"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  DEFAULT_PER_PROVIDER_CEILING_USD,
  initCostLedger,
  recordProviderCost,
  checkProviderCeiling,
  pickFailoverProvider,
  costSnapshot
} = require("../src/agent/ai-cost-ceiling");

// F-2.3 (PLAN/ROADMAP_EXPANSION.md): per-provider cost ceiling with
// automatic failover. Pure tracker — caller records cost after each AI
// call, checks before next call, fails over to next provider when one
// blows its cap.

test("DEFAULT_PER_PROVIDER_CEILING_USD is a positive number", () => {
  assert.equal(typeof DEFAULT_PER_PROVIDER_CEILING_USD, "number");
  assert.ok(DEFAULT_PER_PROVIDER_CEILING_USD > 0);
});

test("initCostLedger: empty ledger keyed by provider list", () => {
  const ledger = initCostLedger(["p1", "p2"]);
  assert.equal(ledger.providers.p1.totalUsd, 0);
  assert.equal(ledger.providers.p2.totalUsd, 0);
  assert.equal(ledger.providers.p1.ceilingUsd, DEFAULT_PER_PROVIDER_CEILING_USD);
});

test("initCostLedger: per-provider ceiling override via options.ceilings", () => {
  const ledger = initCostLedger(["p1", "p2"], { ceilings: { p1: 5.0, p2: 1.5 } });
  assert.equal(ledger.providers.p1.ceilingUsd, 5.0);
  assert.equal(ledger.providers.p2.ceilingUsd, 1.5);
});

test("initCostLedger: missing per-provider ceiling falls back to default", () => {
  const ledger = initCostLedger(["p1", "p2"], { ceilings: { p1: 3.0 } });
  assert.equal(ledger.providers.p1.ceilingUsd, 3.0);
  assert.equal(ledger.providers.p2.ceilingUsd, DEFAULT_PER_PROVIDER_CEILING_USD);
});

test("recordProviderCost: accumulates totalUsd per provider", () => {
  let ledger = initCostLedger(["p1"]);
  ledger = recordProviderCost(ledger, "p1", 0.10);
  ledger = recordProviderCost(ledger, "p1", 0.25);
  assert.equal(ledger.providers.p1.totalUsd, 0.35);
});

test("recordProviderCost: increments callCount", () => {
  let ledger = initCostLedger(["p1"]);
  ledger = recordProviderCost(ledger, "p1", 0.10);
  ledger = recordProviderCost(ledger, "p1", 0.10);
  ledger = recordProviderCost(ledger, "p1", 0.10);
  assert.equal(ledger.providers.p1.callCount, 3);
});

test("recordProviderCost: unknown provider → no-op (no auto-create)", () => {
  const ledger = initCostLedger(["p1"]);
  const after = recordProviderCost(ledger, "ghost", 0.10);
  assert.equal(after.providers.ghost, undefined);
});

test("recordProviderCost: pure — input ledger not mutated", () => {
  const original = initCostLedger(["p1"]);
  const after = recordProviderCost(original, "p1", 0.5);
  assert.equal(original.providers.p1.totalUsd, 0);
  assert.equal(after.providers.p1.totalUsd, 0.5);
});

test("recordProviderCost: negative cost is a no-op (defense)", () => {
  let ledger = initCostLedger(["p1"]);
  ledger = recordProviderCost(ledger, "p1", -1.0);
  assert.equal(ledger.providers.p1.totalUsd, 0);
});

test("checkProviderCeiling: provider under cap → ok:true with remaining", () => {
  let ledger = initCostLedger(["p1"], { ceilings: { p1: 1.00 } });
  ledger = recordProviderCost(ledger, "p1", 0.30);
  const result = checkProviderCeiling(ledger, "p1");
  assert.equal(result.ok, true);
  assert.equal(result.totalUsd, 0.30);
  assert.equal(result.ceilingUsd, 1.00);
  assert.equal(result.remainingUsd, 0.70);
});

test("checkProviderCeiling: provider at cap → ok:false kind=exhausted", () => {
  let ledger = initCostLedger(["p1"], { ceilings: { p1: 1.00 } });
  ledger = recordProviderCost(ledger, "p1", 1.00);
  const result = checkProviderCeiling(ledger, "p1");
  assert.equal(result.ok, false);
  assert.equal(result.kind, "exhausted");
});

test("checkProviderCeiling: provider over cap → ok:false (defense)", () => {
  let ledger = initCostLedger(["p1"], { ceilings: { p1: 1.00 } });
  ledger = recordProviderCost(ledger, "p1", 1.25);
  const result = checkProviderCeiling(ledger, "p1");
  assert.equal(result.ok, false);
  assert.equal(result.kind, "exhausted");
  assert.equal(result.remainingUsd, 0);
});

test("checkProviderCeiling: unknown provider → ok:false kind=unknown_provider", () => {
  const ledger = initCostLedger(["p1"]);
  const result = checkProviderCeiling(ledger, "ghost");
  assert.equal(result.ok, false);
  assert.equal(result.kind, "unknown_provider");
});

test("checkProviderCeiling: projected cost above remaining → kind=would_exceed", () => {
  let ledger = initCostLedger(["p1"], { ceilings: { p1: 1.00 } });
  ledger = recordProviderCost(ledger, "p1", 0.80);
  const result = checkProviderCeiling(ledger, "p1", { projectedUsd: 0.50 });
  assert.equal(result.ok, false);
  assert.equal(result.kind, "would_exceed");
  assert.equal(result.projectedUsd, 0.50);
  // Float precision: 1.0 - 0.8 ≈ 0.2 (with epsilon)
  assert.ok(Math.abs(result.remainingUsd - 0.20) < 1e-9);
});

test("pickFailoverProvider: returns first non-exhausted provider in priority order", () => {
  let ledger = initCostLedger(["p1", "p2", "p3"], { ceilings: { p1: 1.0, p2: 1.0, p3: 1.0 } });
  ledger = recordProviderCost(ledger, "p1", 1.0); // p1 exhausted
  const result = pickFailoverProvider(ledger, ["p1", "p2", "p3"]);
  assert.equal(result.ok, true);
  assert.equal(result.provider, "p2");
  assert.equal(result.skipped.length, 1);
  assert.equal(result.skipped[0].provider, "p1");
  assert.equal(result.skipped[0].reason, "exhausted");
});

test("pickFailoverProvider: all exhausted → ok:false kind=all_exhausted", () => {
  let ledger = initCostLedger(["p1", "p2"], { ceilings: { p1: 1.0, p2: 1.0 } });
  ledger = recordProviderCost(ledger, "p1", 1.0);
  ledger = recordProviderCost(ledger, "p2", 1.0);
  const result = pickFailoverProvider(ledger, ["p1", "p2"]);
  assert.equal(result.ok, false);
  assert.equal(result.kind, "all_exhausted");
  assert.equal(result.skipped.length, 2);
});

test("pickFailoverProvider: skips unknown providers", () => {
  const ledger = initCostLedger(["p1"]);
  const result = pickFailoverProvider(ledger, ["ghost", "p1"]);
  assert.equal(result.ok, true);
  assert.equal(result.provider, "p1");
});

test("pickFailoverProvider: empty priority list → ok:false", () => {
  const ledger = initCostLedger(["p1"]);
  const result = pickFailoverProvider(ledger, []);
  assert.equal(result.ok, false);
});

test("costSnapshot: per-provider {provider, totalUsd, ceilingUsd, remainingUsd, exhausted, callCount}", () => {
  let ledger = initCostLedger(["p1", "p2"], { ceilings: { p1: 1.0, p2: 2.0 } });
  ledger = recordProviderCost(ledger, "p1", 1.0);
  ledger = recordProviderCost(ledger, "p2", 0.5);
  const snap = costSnapshot(ledger);
  const p1 = snap.find((r) => r.provider === "p1");
  const p2 = snap.find((r) => r.provider === "p2");
  assert.deepEqual(p1, { provider: "p1", totalUsd: 1.0, ceilingUsd: 1.0, remainingUsd: 0, exhausted: true, callCount: 1 });
  assert.deepEqual(p2, { provider: "p2", totalUsd: 0.5, ceilingUsd: 2.0, remainingUsd: 1.5, exhausted: false, callCount: 1 });
});
