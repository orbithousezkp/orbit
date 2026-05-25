"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  BUCKETS,
  TREASURY_BUCKETS_SCHEMA,
  computeSweepAmounts,
  computeSweepIdem,
  sweepWeekFromTimestamp,
  isSweepEnabled,
  bucketsMissingAddresses,
  alreadySwept,
  buildSweepProposal,
  commentApprovesSweep,
  proposeTreasurySweep,
  recordSweepExecution,
  projectTreasuryBuckets
} = require("../src/agent/treasury-sweep");

const ALL_ADDRESSES_ENV = {
  ORBIT_ENABLE_TREASURY_SWEEP: "true",
  ORBIT_TREASURY_SAFE: "0xFEE00000000000000000000000000000000000FE",
  ORBIT_FLOOR_RESERVE_SAFE: "0xF1001110000000000000000000000000000000F1",
  ORBIT_PRODUCTIVE_YIELD_SAFE: "0xF2002220000000000000000000000000000000F2",
  ORBIT_BUYBACK_SAFE: "0xF3003330000000000000000000000000000000F3",
  ORBIT_GROWTH_SAFE: "0xF4004440000000000000000000000000000000F4",
  ORBIT_AI_COSTS_SAFE: "0xF5005550000000000000000000000000000000F5",
  ORBIT_OPS_RUNWAY_SAFE: "0xF6006660000000000000000000000000000000F6"
};

const VERIFIED_STATE = {
  cycle: 100,
  preLaunchVerified: true,
  tokenAddress: "0xABCDEFabcdef0123456789012345678901234567",
  treasurySweep: {}
};

test("BUCKETS bps sum to 10000 per D-019", () => {
  const sum = BUCKETS.reduce((acc, b) => acc + b.bps, 0);
  assert.equal(sum, 10000);
});

test("BUCKETS contain the 6 named buckets in 3 categories", () => {
  const ids = BUCKETS.map((b) => b.id);
  assert.deepEqual(ids, ["floor-reserve", "productive-yield", "buyback", "growth", "ai-costs", "ops-runway"]);
  const treasury = BUCKETS.filter((b) => b.category === "treasury").map((b) => b.id);
  const business = BUCKETS.filter((b) => b.category === "business").map((b) => b.id);
  const operations = BUCKETS.filter((b) => b.category === "operations").map((b) => b.id);
  assert.deepEqual(treasury, ["floor-reserve", "productive-yield"]);
  assert.deepEqual(business, ["buyback", "growth"]);
  assert.deepEqual(operations, ["ai-costs", "ops-runway"]);
});

test("computeSweepAmounts splits 10000 wei into exact bps proportions", () => {
  const result = computeSweepAmounts("10000");
  assert.equal(result.ok, true);
  const byId = Object.fromEntries(result.amounts.map((a) => [a.bucket, a.amountWei]));
  assert.equal(byId["floor-reserve"], "4500");
  assert.equal(byId["productive-yield"], "2000");
  assert.equal(byId["buyback"], "500");
  assert.equal(byId["growth"], "1500");
  assert.equal(byId["ai-costs"], "1000");
  assert.equal(byId["ops-runway"], "500");
});

test("computeSweepAmounts sums exactly to balance even with odd-wei remainder", () => {
  // 1 wei beyond a clean split — must absorb the remainder, not lose it.
  const balance = "10003";
  const result = computeSweepAmounts(balance);
  assert.equal(result.ok, true);
  const sum = result.amounts.reduce((acc, a) => acc + BigInt(a.amountWei), 0n);
  assert.equal(sum.toString(), balance);
});

test("computeSweepAmounts rejects zero balance with dust code", () => {
  const result = computeSweepAmounts("0");
  assert.equal(result.ok, false);
  assert.equal(result.code, "sweep_dust_below_minimum");
});

test("computeSweepAmounts rejects non-integer string", () => {
  const result = computeSweepAmounts("abc");
  assert.equal(result.ok, false);
  assert.equal(result.code, "sweep_balance_invalid");
});

test("computeSweepIdem is deterministic", () => {
  const a = computeSweepIdem({ cycle: 100, sweepWeek: 21, balanceWei: "1000000000000000000" });
  const b = computeSweepIdem({ cycle: 100, sweepWeek: 21, balanceWei: "1000000000000000000" });
  assert.equal(a, b);
  assert.match(a, /^tsweep-[a-f0-9]{16}$/);
});

test("computeSweepIdem changes with different inputs", () => {
  const a = computeSweepIdem({ cycle: 100, sweepWeek: 21, balanceWei: "1" });
  const b = computeSweepIdem({ cycle: 100, sweepWeek: 22, balanceWei: "1" });
  const c = computeSweepIdem({ cycle: 101, sweepWeek: 21, balanceWei: "1" });
  assert.notEqual(a, b);
  assert.notEqual(a, c);
  assert.notEqual(b, c);
});

test("sweepWeekFromTimestamp anchored at 2026-01-01", () => {
  assert.equal(sweepWeekFromTimestamp("2026-01-01T00:00:00.000Z"), 0);
  assert.equal(sweepWeekFromTimestamp("2026-01-08T00:00:00.000Z"), 1);
  assert.equal(sweepWeekFromTimestamp("2026-05-25T00:00:00.000Z"), 20);
});

test("isSweepEnabled rejects when ORBIT_ENABLE_TREASURY_SWEEP is not true", () => {
  const result = isSweepEnabled({}, VERIFIED_STATE, { ...ALL_ADDRESSES_ENV, ORBIT_ENABLE_TREASURY_SWEEP: "false" });
  assert.equal(result.enabled, false);
  assert.match(result.reason, /ORBIT_ENABLE_TREASURY_SWEEP/);
});

test("isSweepEnabled rejects when preLaunchVerified is not true (D-018 gate)", () => {
  const result = isSweepEnabled({}, { ...VERIFIED_STATE, preLaunchVerified: false }, ALL_ADDRESSES_ENV);
  assert.equal(result.enabled, false);
  assert.match(result.reason, /preLaunchVerified/);
});

test("isSweepEnabled rejects when any bucket address is missing", () => {
  const env = { ...ALL_ADDRESSES_ENV };
  delete env.ORBIT_AI_COSTS_SAFE;
  const result = isSweepEnabled({}, VERIFIED_STATE, env);
  assert.equal(result.enabled, false);
  assert.match(result.reason, /ai-costs/);
  assert.match(result.reason, /ORBIT_AI_COSTS_SAFE/);
});

test("isSweepEnabled enables when all gates pass", () => {
  const result = isSweepEnabled({}, VERIFIED_STATE, ALL_ADDRESSES_ENV);
  assert.equal(result.enabled, true);
});

test("bucketsMissingAddresses lists every missing bucket by id", () => {
  const env = { ...ALL_ADDRESSES_ENV };
  delete env.ORBIT_BUYBACK_SAFE;
  delete env.ORBIT_GROWTH_SAFE;
  const missing = bucketsMissingAddresses(env);
  assert.equal(missing.length, 2);
  assert.ok(missing.some((m) => m.includes("buyback")));
  assert.ok(missing.some((m) => m.includes("growth")));
});

test("alreadySwept detects a previously executed week", () => {
  const state = { treasurySweep: { history: [
    { sweepWeek: 14, status: "executed" },
    { sweepWeek: 15, status: "executed" }
  ] } };
  assert.equal(alreadySwept(state, 14), true);
  assert.equal(alreadySwept(state, 15), true);
  assert.equal(alreadySwept(state, 16), false);
});

test("alreadySwept ignores non-executed entries (e.g., proposed)", () => {
  const state = { treasurySweep: { history: [
    { sweepWeek: 14, status: "proposed" }
  ] } };
  assert.equal(alreadySwept(state, 14), false);
});

test("buildSweepProposal renders an approval issue body with idem + bucket table", () => {
  const proposal = buildSweepProposal({
    cycle: 100,
    sweepWeek: 21,
    balanceWei: "1000000",
    env: ALL_ADDRESSES_ENV,
    nowIso: "2026-05-25T12:00:00.000Z"
  });
  assert.equal(proposal.ok, true);
  assert.match(proposal.idem, /^tsweep-/);
  assert.match(proposal.proposalBody, /Treasury Sweep Proposal/);
  assert.match(proposal.proposalBody, /APPROVE ORBIT-TREASURY-SWEEP/);
  assert.match(proposal.proposalBody, /floor-reserve/);
  assert.match(proposal.proposalBody, /ops-runway/);
  // All 6 buckets present in the table
  for (const bucket of BUCKETS) {
    assert.ok(proposal.proposalBody.includes(bucket.id), `body missing ${bucket.id}`);
  }
});

test("commentApprovesSweep matches the exact APPROVE pattern from owner", () => {
  const idem = commentApprovesSweep("owner", {
    author: "owner",
    body: "APPROVE ORBIT-TREASURY-SWEEP tsweep-abc123def4567890"
  });
  assert.equal(idem, "tsweep-abc123def4567890");
});

test("commentApprovesSweep rejects non-owner author", () => {
  const result = commentApprovesSweep("owner", {
    author: "imposter",
    body: "APPROVE ORBIT-TREASURY-SWEEP tsweep-abc123def4567890"
  });
  assert.equal(result, null);
});

test("commentApprovesSweep rejects look-alike comment text", () => {
  const result = commentApprovesSweep("owner", {
    author: "owner",
    body: "approve orbit-treasury-sweep tsweep-abc123def4567890"
  });
  assert.equal(result, null);
});

test("proposeTreasurySweep returns blocked_precondition when preLaunchVerified is false", async () => {
  const result = await proposeTreasurySweep({
    config: {},
    state: { ...VERIFIED_STATE, preLaunchVerified: false },
    env: ALL_ADDRESSES_ENV,
    cycle: 100,
    nowIso: "2026-05-25T00:00:00.000Z",
    syntheticBalance: "1000000000000000000"
  });
  assert.equal(result.ok, false);
  assert.equal(result.blocked, true);
  assert.equal(result.status, "blocked_precondition");
  assert.match(result.reason, /preLaunchVerified/);
});

test("proposeTreasurySweep returns sweep_dust_below_minimum for balance below floor", async () => {
  const result = await proposeTreasurySweep({
    config: {},
    state: VERIFIED_STATE,
    env: ALL_ADDRESSES_ENV,
    cycle: 100,
    nowIso: "2026-05-25T00:00:00.000Z",
    syntheticBalance: "100" // way below 0.001 WETH
  });
  assert.equal(result.ok, false);
  assert.equal(result.code, "sweep_dust_below_minimum");
});

test("proposeTreasurySweep returns sweep_week_already_executed when history blocks it", async () => {
  const state = {
    ...VERIFIED_STATE,
    treasurySweep: { history: [{ sweepWeek: 20, status: "executed" }] }
  };
  const result = await proposeTreasurySweep({
    config: {},
    state,
    env: ALL_ADDRESSES_ENV,
    cycle: 100,
    nowIso: "2026-05-25T00:00:00.000Z", // week 20
    syntheticBalance: "1000000000000000000"
  });
  assert.equal(result.code, "sweep_week_already_executed");
});

test("proposeTreasurySweep returns a valid proposal when all gates pass", async () => {
  const result = await proposeTreasurySweep({
    config: {},
    state: VERIFIED_STATE,
    env: ALL_ADDRESSES_ENV,
    cycle: 100,
    nowIso: "2026-05-25T00:00:00.000Z",
    syntheticBalance: "1000000000000000000"
  });
  assert.equal(result.ok, true);
  assert.equal(result.amounts.length, 6);
  const sum = result.amounts.reduce((acc, a) => acc + BigInt(a.amountWei), 0n);
  assert.equal(sum.toString(), "1000000000000000000");
});

test("recordSweepExecution appends to history and updates last-* fields", () => {
  const before = VERIFIED_STATE;
  const after = recordSweepExecution(before, {
    idem: "tsweep-abc123",
    sweepWeek: 21,
    cycle: 100,
    amounts: [{ bucket: "floor-reserve", amountWei: "4500" }],
    txHash: "0xtx",
    status: "executed"
  });
  assert.equal(after.treasurySweep.history.length, 1);
  assert.equal(after.treasurySweep.lastSweepWeek, 21);
  assert.equal(after.treasurySweep.lastSweepIdem, "tsweep-abc123");
});

test("projectTreasuryBuckets surfaces all 6 buckets with category groupings", () => {
  const slim = projectTreasuryBuckets(VERIFIED_STATE, {}, ALL_ADDRESSES_ENV);
  assert.equal(slim.schema, TREASURY_BUCKETS_SCHEMA);
  assert.equal(slim.list.length, 6);
  const categories = new Set(slim.list.map((b) => b.category));
  assert.deepEqual([...categories].sort(), ["business", "operations", "treasury"]);
});

test("projectTreasuryBuckets includes nextSweepWeek when history exists", () => {
  const state = recordSweepExecution(VERIFIED_STATE, {
    idem: "tsweep-x",
    sweepWeek: 20,
    cycle: 100,
    amounts: [{ bucket: "floor-reserve", amountWei: "1" }],
    txHash: "0x",
    status: "executed"
  });
  const slim = projectTreasuryBuckets(state, {}, ALL_ADDRESSES_ENV);
  assert.equal(slim.sweep.lastSweepWeek, 20);
  assert.equal(slim.sweep.nextSweepWeek, 21);
});
