"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  deriveDrivers,
  opportunityDriverFit,
  scoreOpportunity,
  summarizeSurvival
} = require("../src/agent/opportunities");
const { MANDATORY_INTERVAL_MINUTES } = require("../src/agent/triggers");
const { deterministicResponse } = require("../src/agent/inference");

test("scores opportunity by reward, food cost, risk, and approval", () => {
  const score = scoreOpportunity({
    expectedRewardUsd: 150,
    estimatedFoodUsd: 8,
    risk: "low",
    approvalRequired: true
  });

  assert.equal(score, 15.94);
});

test("derives state, event, and mandatory survival drivers", () => {
  const result = deriveDrivers({
    cycleConfig: {
      trigger: {
        type: "mandatory",
        id: "regular_heartbeat"
      }
    },
    aiBudget: {
      canUseAi: true,
      dailyRemainingUsd: 5,
      monthlyRemainingUsd: 100
    },
    treasury: {
      token: { launchStatus: "not_launched" },
      revenue: { lastClaimResult: null }
    },
    issues: [{ number: 1 }],
    tasks: { tasks: [] }
  });

  assert.equal(result.survival.survivalState, "needs_income");
  assert.equal(result.mandatoryIntervalMinutes, MANDATORY_INTERVAL_MINUTES);
  assert.ok(result.drivers.some((driver) => driver.type === "state"));
  assert.ok(result.drivers.some((driver) => driver.type === "event"));
  assert.ok(result.drivers.some((driver) => driver.type === "mandatory" && driver.id === "regular_heartbeat"));
});

test("summarizes low food as critical survival state", () => {
  const result = summarizeSurvival({
    aiBudget: {
      canUseAi: true,
      dailyRemainingUsd: 0.5,
      monthlyRemainingUsd: 100
    },
    treasury: {
      token: { launchStatus: "launched" },
      revenue: { lastClaimResult: { amountUsd: 100 } }
    }
  });

  assert.equal(result.survivalState, "food_low");
});

test("mandatory heartbeat is selected when the house is otherwise stable", () => {
  const result = deriveDrivers({
    cycleConfig: {
      trigger: {
        type: "mandatory",
        id: "regular_heartbeat"
      }
    },
    aiBudget: {
      canUseAi: true,
      dailyRemainingUsd: 5,
      monthlyRemainingUsd: 100
    },
    treasury: {
      token: { launchStatus: "launched" },
      revenue: { lastClaimResult: { amountUsd: 50 } }
    },
    issues: [],
    tasks: { tasks: [] }
  });

  assert.equal(result.selectedDriver.type, "mandatory");
  assert.equal(result.selectedDriver.id, "regular_heartbeat");
});

test("state driver outranks event and mandatory drivers", () => {
  const result = deriveDrivers({
    cycleConfig: {
      trigger: {
        type: "mandatory",
        id: "regular_heartbeat"
      }
    },
    aiBudget: {
      canUseAi: false,
      dailyRemainingUsd: 0,
      monthlyRemainingUsd: 100
    },
    treasury: {
      token: { launchStatus: "not_launched" },
      revenue: { lastClaimResult: null }
    },
    issues: [{ number: 2 }],
    tasks: { tasks: [] }
  });

  assert.equal(result.selectedDriver.type, "state");
  assert.equal(result.selectedDriver.id, "food_low");
});

test("deterministic fallback inspects income opportunities for survival step", () => {
  const response = deterministicResponse({
    behaviorPlan: {
      mode: "virtual_human_household",
      primaryObjective: "survive",
      nextStep: {
        kind: "survival_opportunity",
        title: "Pursue survival opportunity: Paid repo safety audit",
        detail: "Package existing skills."
      }
    }
  }, "No AI API key is configured.");

  assert.equal(response.actions[0].tool, "income_opportunities");
  assert.equal(response.actions[1].tool, "write_cycle_note");
});

test("driver fit favors opportunities that match the wake reason", () => {
  const score = opportunityDriverFit({
    driverTypes: ["mandatory"],
    triggers: ["mandatory:regular_heartbeat"]
  }, {
    type: "mandatory",
    id: "regular_heartbeat"
  });

  assert.equal(score, 9);
});
