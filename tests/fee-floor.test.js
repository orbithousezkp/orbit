"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  FEE_FLOOR_WEI_DEFAULT,
  WEEK_BOUNDARY_DAY_DEFAULT,
  WEEK_BOUNDARY_HOUR_DEFAULT,
  defaultState,
  evaluateGate,
  isAtOrPastWeekBoundary,
  loadConfig,
  startWeek,
  weekInflowSince
} = require("../src/agent/fee-floor");

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

test("constants: defaults are 0.1 ETH Sunday 00:00 UTC", () => {
  assert.equal(FEE_FLOOR_WEI_DEFAULT, "100000000000000000");
  assert.equal(WEEK_BOUNDARY_DAY_DEFAULT, 0);
  assert.equal(WEEK_BOUNDARY_HOUR_DEFAULT, 0);
});

test("defaultState shape: three null/zero fields", () => {
  const seed = defaultState();
  assert.deepEqual(seed, {
    weekStartedAt: null,
    weekStartBalanceWei: "0",
    lastWeekBoundaryAt: null
  });
});

// ---------------------------------------------------------------------------
// loadConfig
// ---------------------------------------------------------------------------

test("loadConfig: empty env returns defaults", () => {
  const cfg = loadConfig({});
  assert.equal(cfg.floorWei, BigInt(FEE_FLOOR_WEI_DEFAULT));
  assert.equal(cfg.day, 0);
  assert.equal(cfg.hour, 0);
});

test("loadConfig: env overrides honored (floor + day + hour)", () => {
  const cfg = loadConfig({
    ORBIT_ACTION_FEE_FLOOR_WEI: "250000000000000000", // 0.25 ETH
    ORBIT_WEEK_BOUNDARY_DAY: "1",                      // Monday
    ORBIT_WEEK_BOUNDARY_HOUR: "14"                     // 14:00 UTC
  });
  assert.equal(cfg.floorWei, 250_000_000_000_000_000n);
  assert.equal(cfg.day, 1);
  assert.equal(cfg.hour, 14);
});

test("loadConfig: invalid day=8 throws", () => {
  assert.throws(
    () => loadConfig({ ORBIT_WEEK_BOUNDARY_DAY: "8" }),
    /ORBIT_WEEK_BOUNDARY_DAY/
  );
});

test("loadConfig: invalid day=-1 throws", () => {
  assert.throws(
    () => loadConfig({ ORBIT_WEEK_BOUNDARY_DAY: "-1" }),
    /ORBIT_WEEK_BOUNDARY_DAY/
  );
});

test("loadConfig: invalid hour=24 throws", () => {
  assert.throws(
    () => loadConfig({ ORBIT_WEEK_BOUNDARY_HOUR: "24" }),
    /ORBIT_WEEK_BOUNDARY_HOUR/
  );
});

test("loadConfig: invalid floorWei (non-numeric) throws", () => {
  assert.throws(
    () => loadConfig({ ORBIT_ACTION_FEE_FLOOR_WEI: "0.1eth" }),
    /ORBIT_ACTION_FEE_FLOOR_WEI/
  );
});

test("loadConfig: invalid floorWei (negative) throws", () => {
  assert.throws(
    () => loadConfig({ ORBIT_ACTION_FEE_FLOOR_WEI: "-100" }),
    /ORBIT_ACTION_FEE_FLOOR_WEI/
  );
});

// ---------------------------------------------------------------------------
// isAtOrPastWeekBoundary
// ---------------------------------------------------------------------------

test("isAtOrPastWeekBoundary: state=null returns true (first-ever)", () => {
  const cfg = loadConfig({});
  assert.equal(isAtOrPastWeekBoundary(null, new Date("2026-05-25T12:00:00Z"), cfg), true);
});

test("isAtOrPastWeekBoundary: state.feeFloor=null returns true (first-ever)", () => {
  const cfg = loadConfig({});
  const state = {};
  assert.equal(isAtOrPastWeekBoundary(state, new Date("2026-05-25T12:00:00Z"), cfg), true);
});

test("isAtOrPastWeekBoundary: within same week returns false", () => {
  const cfg = loadConfig({});
  // Boundary recorded at Sun 2026-05-24 00:00 UTC; ask again on Monday.
  const state = { feeFloor: { lastWeekBoundaryAt: "2026-05-24T00:00:00.000Z" } };
  assert.equal(
    isAtOrPastWeekBoundary(state, new Date("2026-05-25T12:00:00Z"), cfg),
    false
  );
});

test("isAtOrPastWeekBoundary: after next Sunday 00:00 UTC returns true", () => {
  const cfg = loadConfig({});
  // Boundary recorded last Sunday; next Sunday has now passed.
  const state = { feeFloor: { lastWeekBoundaryAt: "2026-05-24T00:00:00.000Z" } };
  assert.equal(
    isAtOrPastWeekBoundary(state, new Date("2026-05-31T00:30:00Z"), cfg),
    true
  );
});

test("isAtOrPastWeekBoundary: multi-week gap returns true", () => {
  const cfg = loadConfig({});
  // 4 weeks elapsed since last recorded boundary.
  const state = { feeFloor: { lastWeekBoundaryAt: "2026-04-26T00:00:00.000Z" } };
  assert.equal(
    isAtOrPastWeekBoundary(state, new Date("2026-05-25T12:00:00Z"), cfg),
    true
  );
});

test("isAtOrPastWeekBoundary: malformed timestamp treated as first-ever", () => {
  const cfg = loadConfig({});
  const state = { feeFloor: { lastWeekBoundaryAt: "not-a-date" } };
  assert.equal(
    isAtOrPastWeekBoundary(state, new Date("2026-05-25T12:00:00Z"), cfg),
    true
  );
});

test("isAtOrPastWeekBoundary: custom day=1 (Monday) boundary", () => {
  const cfg = loadConfig({ ORBIT_WEEK_BOUNDARY_DAY: "1" });
  // Last recorded boundary was Monday 2026-05-18 00:00. Today is Mon 2026-05-25 12:00 — boundary at 2026-05-25 00:00 has passed.
  const state = { feeFloor: { lastWeekBoundaryAt: "2026-05-18T00:00:00.000Z" } };
  assert.equal(
    isAtOrPastWeekBoundary(state, new Date("2026-05-25T12:00:00Z"), cfg),
    true
  );
});

// ---------------------------------------------------------------------------
// weekInflowSince
// ---------------------------------------------------------------------------

test("weekInflowSince: positive delta", () => {
  const state = { feeFloor: { weekStartBalanceWei: "100" } };
  assert.equal(weekInflowSince(state, 500n), 400n);
});

test("weekInflowSince: zero delta", () => {
  const state = { feeFloor: { weekStartBalanceWei: "500" } };
  assert.equal(weekInflowSince(state, 500n), 0n);
});

test("weekInflowSince: negative delta clamps to 0", () => {
  // A sweep mid-week could leave current balance below the week-start
  // snapshot. The gate is about NEW inflow only, so the delta must clamp.
  const state = { feeFloor: { weekStartBalanceWei: "1000" } };
  assert.equal(weekInflowSince(state, 200n), 0n);
});

test("weekInflowSince: state with no feeFloor defaults weekStart to 0", () => {
  assert.equal(weekInflowSince({}, 750n), 750n);
});

test("weekInflowSince: accepts string + number for currentBalance", () => {
  const state = { feeFloor: { weekStartBalanceWei: "100" } };
  assert.equal(weekInflowSince(state, "300"), 200n);
  assert.equal(weekInflowSince(state, 250), 150n);
});

test("weekInflowSince: rejects negative number input", () => {
  assert.throws(() => weekInflowSince({}, -5), /non-negative/);
});

// ---------------------------------------------------------------------------
// evaluateGate
// ---------------------------------------------------------------------------

test("evaluateGate: met when inflow >= floor (bigint input)", () => {
  const cfg = loadConfig({});
  const result = evaluateGate(100_000_000_000_000_000n, cfg);
  assert.equal(result.met, true);
  assert.equal(result.reason, "met");
  assert.equal(result.weekInflowWei, "100000000000000000");
  assert.equal(result.floorWei, "100000000000000000");
});

test("evaluateGate: below_floor when inflow < floor (string input)", () => {
  const cfg = loadConfig({});
  const result = evaluateGate("99999999999999999", cfg); // 1 wei short
  assert.equal(result.met, false);
  assert.equal(result.reason, "below_floor");
  assert.equal(result.weekInflowWei, "99999999999999999");
});

test("evaluateGate: number input also works", () => {
  const cfg = loadConfig({ ORBIT_ACTION_FEE_FLOOR_WEI: "1000" });
  const result = evaluateGate(1500, cfg);
  assert.equal(result.met, true);
  assert.equal(result.weekInflowWei, "1500");
  assert.equal(result.floorWei, "1000");
});

test("evaluateGate: met exactly at floor (>=, not >)", () => {
  const cfg = loadConfig({});
  const result = evaluateGate(FEE_FLOOR_WEI_DEFAULT, cfg);
  assert.equal(result.met, true);
});

// ---------------------------------------------------------------------------
// startWeek
// ---------------------------------------------------------------------------

test("startWeek: sets the three fields with the most-recent Sunday boundary", () => {
  const state = {};
  // Monday 2026-05-25 12:00 UTC — most-recent Sunday boundary is 2026-05-24 00:00 UTC.
  startWeek(state, new Date("2026-05-25T12:00:00Z"), 12345n);
  assert.equal(state.feeFloor.weekStartedAt, "2026-05-25T12:00:00.000Z");
  assert.equal(state.feeFloor.weekStartBalanceWei, "12345");
  assert.equal(state.feeFloor.lastWeekBoundaryAt, "2026-05-24T00:00:00.000Z");
});

test("startWeek: when called exactly at Sunday 00:00 UTC, boundary equals now", () => {
  const state = {};
  startWeek(state, new Date("2026-05-31T00:00:00Z"), "0");
  assert.equal(state.feeFloor.lastWeekBoundaryAt, "2026-05-31T00:00:00.000Z");
});

test("startWeek: mutates the passed state and also returns it", () => {
  const state = { cycle: 7 };
  const returned = startWeek(state, new Date("2026-05-25T00:00:00Z"), 0n);
  assert.equal(returned, state);
  assert.equal(state.cycle, 7);
  assert.ok(state.feeFloor);
});
