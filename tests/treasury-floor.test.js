"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { assertTreasuryFloor } = require("../src/agent/governance");

test("assertTreasuryFloor returns ok when no floor policy is set", () => {
  const result = assertTreasuryFloor({
    state: {},
    config: {},
    amountWei: "1000000000000000000",
    actionType: "buyback"
  });
  assert.equal(result.ok, true);
  assert.equal(result.floorWei, null);
});

test("assertTreasuryFloor rejects invalid amount", () => {
  const result = assertTreasuryFloor({
    state: {},
    amountWei: "not-a-number",
    actionType: "buyback"
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "treasury_floor_invalid_amount");
});

test("assertTreasuryFloor rejects negative amount", () => {
  const result = assertTreasuryFloor({
    state: {},
    amountWei: "-1",
    actionType: "buyback"
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "treasury_floor_invalid_amount");
});

test("hardCapPerCycleWei rejects oversize spends", () => {
  const result = assertTreasuryFloor({
    state: {
      treasury: {
        hardCapPerCycleWei: "1000000000000000000" // 1 ETH
      }
    },
    amountWei: "2000000000000000000", // 2 ETH
    actionType: "buyback",
    actionLabel: "weekly buyback"
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "treasury_floor_hard_cap_exceeded");
  assert.ok(result.detail.includes("weekly buyback"));
});

test("maxSpendPerCycleWei rejects oversize spends", () => {
  const result = assertTreasuryFloor({
    state: {
      treasury: {
        maxSpendPerCycleWei: "500000000000000000" // 0.5 ETH
      }
    },
    amountWei: "600000000000000000", // 0.6 ETH
    actionType: "launch"
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "treasury_floor_max_per_cycle_exceeded");
});

test("hardCap takes priority over maxSpend when both are set", () => {
  const result = assertTreasuryFloor({
    state: {
      treasury: {
        hardCapPerCycleWei: "1000000000000000000",
        maxSpendPerCycleWei: "500000000000000000"
      }
    },
    amountWei: "2000000000000000000",
    actionType: "buyback"
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "treasury_floor_hard_cap_exceeded");
});

test("floor + balanceEstimate detects post-spend breach", () => {
  const result = assertTreasuryFloor({
    state: {
      treasury: {
        floorWei: "1000000000000000000", // floor: 1 ETH
        balanceEstimateWei: "1200000000000000000", // est: 1.2 ETH
        balanceEstimateAt: "2026-05-25T10:00:00Z"
      }
    },
    amountWei: "500000000000000000", // spend: 0.5 ETH -> after = 0.7 < 1.0 floor
    actionType: "buyback"
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "treasury_floor_breach");
  assert.equal(result.projectedAfterWei, "700000000000000000");
});

test("floor + balanceEstimate passes when post-spend stays above floor", () => {
  const result = assertTreasuryFloor({
    state: {
      treasury: {
        floorWei: "1000000000000000000",
        balanceEstimateWei: "2000000000000000000"
      }
    },
    amountWei: "500000000000000000",
    actionType: "buyback"
  });
  assert.equal(result.ok, true);
});

test("floor without balanceEstimate is informational only (does not reject)", () => {
  const result = assertTreasuryFloor({
    state: {
      treasury: {
        floorWei: "1000000000000000000"
      }
    },
    amountWei: "500000000000000000",
    actionType: "buyback"
  });
  assert.equal(result.ok, true);
});

test("config policy is used when state is empty", () => {
  const result = assertTreasuryFloor({
    state: {},
    config: {
      treasury: {
        maxSpendPerCycleWei: "100000000000000000"
      }
    },
    amountWei: "200000000000000000",
    actionType: "buyback"
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "treasury_floor_max_per_cycle_exceeded");
});

test("state policy takes precedence over config policy", () => {
  const result = assertTreasuryFloor({
    state: {
      treasury: { maxSpendPerCycleWei: "1000000000000000000" }
    },
    config: {
      treasury: { maxSpendPerCycleWei: "100000000000000000" }
    },
    amountWei: "500000000000000000",
    actionType: "buyback"
  });
  assert.equal(result.ok, true);
});

test("returns numeric strings (preserves precision for wei amounts)", () => {
  const result = assertTreasuryFloor({
    state: {
      treasury: {
        floorWei: "1000000000000000000",
        balanceEstimateWei: "5000000000000000000",
        maxSpendPerCycleWei: "2000000000000000000",
        hardCapPerCycleWei: "3000000000000000000"
      }
    },
    amountWei: "500000000000000000",
    actionType: "buyback"
  });
  assert.equal(result.ok, true);
  assert.equal(result.plannedWei, "500000000000000000");
  assert.equal(result.floorWei, "1000000000000000000");
});
