"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { ACTIVITY_CONTRACT, HARD_LIMITS, planCycle } = require("../src/agent/behavior");
const { deterministicResponse } = require("../src/agent/inference");
const { buildFirstWakeIntro, shouldRunFirstWakeIntro } = require("../src/agent/intro");

test("behavior contract names household activities and hard limits", () => {
  assert.ok(ACTIVITY_CONTRACT.length >= 8);
  assert.ok(ACTIVITY_CONTRACT.some((activity) => activity.id === "intake"));
  assert.ok(ACTIVITY_CONTRACT.some((activity) => activity.id === "token_operations"));
  assert.ok(HARD_LIMITS.some((limit) => limit.includes("No treasury transfer")));
  assert.ok(HARD_LIMITS.some((limit) => limit.includes("No approval issue")));
});

test("cycle plan reviews risky issues before ordinary task work", () => {
  const plan = planCycle({
    tasks: {
      tasks: [
        {
          id: "task-1",
          title: "Improve README",
          status: "open"
        }
      ]
    },
    issues: [
      {
        number: 4,
        title: "urgent wallet rescue",
        safety: { safe: true },
        scamRisk: { score: 90 }
      }
    ],
    aiBudget: {
      canUseAi: true,
      dailyRemainingUsd: 5,
      monthlyRemainingUsd: 100
    }
  });

  assert.equal(plan.nextStep.kind, "safety_review");
  assert.equal(plan.nextStep.blocked, true);
});

test("cycle plan checks pending owner approvals before open tasks", () => {
  const plan = planCycle({
    tasks: {
      tasks: [
        {
          id: "task-1",
          title: "Improve README",
          status: "open"
        }
      ]
    },
    governance: {
      approvals: {
        approvals: [
          {
            id: "approval-1",
            status: "pending"
          }
        ]
      }
    },
    aiBudget: {
      canUseAi: true,
      dailyRemainingUsd: 5,
      monthlyRemainingUsd: 100
    }
  });

  assert.equal(plan.nextStep.kind, "owner_approval_check");
  assert.equal(plan.recommendedSteps[1].kind, "open_task");
});

test("cycle plan can choose survival work from mandatory heartbeat", () => {
  const plan = planCycle({
    aiBudget: {
      canUseAi: true,
      dailyRemainingUsd: 5,
      monthlyRemainingUsd: 100
    },
    opportunities: {
      drivers: {
        selectedDriver: {
          type: "mandatory",
          id: "regular_heartbeat"
        },
        drivers: [
          {
            type: "mandatory",
            id: "regular_heartbeat"
          }
        ]
      },
      best: {
        title: "Proof ledger setup for other repos",
        firstSafeMove: "Package the proof workflow.",
        driverAdjustedScore: 23.17
      }
    }
  });

  assert.equal(plan.nextStep.kind, "survival_opportunity");
  assert.equal(plan.nextStep.activity, "survival_market");
  assert.match(plan.nextStep.detail, /mandatory:regular_heartbeat/);
});

test("cycle plan can choose survival work from event trigger", () => {
  const plan = planCycle({
    aiBudget: {
      canUseAi: true,
      dailyRemainingUsd: 5,
      monthlyRemainingUsd: 100
    },
    opportunities: {
      drivers: {
        selectedDriver: {
          type: "event",
          id: "front_door_activity"
        },
        drivers: [
          {
            type: "event",
            id: "front_door_activity"
          }
        ]
      },
      best: {
        title: "Paid issue triage and maintenance",
        firstSafeMove: "Risk-scan visitor request.",
        driverAdjustedScore: 17.29
      }
    }
  });

  assert.equal(plan.nextStep.kind, "survival_opportunity");
  assert.match(plan.nextStep.detail, /event:front_door_activity/);
});

test("cycle plan unblocks adjacent survival work when owner review blocks a task", () => {
  const plan = planCycle({
    tasks: {
      tasks: [
        {
          id: "task-1",
          title: "Review owner feedback on README service pitch",
          status: "open",
          notes: "README pitch is drafted. Wait for owner review before outreach."
        }
      ]
    },
    issues: [
      {
        number: 1,
        title: "Draft scope: Repo safety audit as a paid service",
        labels: ["orbit:opportunity"],
        safety: { safe: true },
        scamRisk: { score: 0 }
      }
    ],
    aiBudget: {
      canUseAi: true,
      dailyRemainingUsd: 5,
      monthlyRemainingUsd: 100
    }
  });

  assert.equal(plan.nextStep.kind, "blocked_task_unblock");
  assert.match(plan.nextStep.detail, /safe adjacent artifact/);
  assert.doesNotMatch(plan.nextStep.toolHint, /create_issue/);
});

test("cycle plan keeps survival moving for active service opportunities", () => {
  const plan = planCycle({
    issues: [
      {
        number: 1,
        title: "Draft scope: Repo safety audit as a paid service",
        labels: ["orbit:opportunity"],
        safety: { safe: true },
        scamRisk: { score: 0 }
      }
    ],
    aiBudget: {
      canUseAi: true,
      dailyRemainingUsd: 5,
      monthlyRemainingUsd: 100
    }
  });

  assert.equal(plan.nextStep.kind, "survival_backlog");
  assert.ok(plan.recommendedSteps.some((step) => step.kind === "survival_backlog"));
  assert.doesNotMatch(plan.nextStep.toolHint, /create_issue/);
});

test("deterministic fallback uses behavior plan next step", () => {
  const response = deterministicResponse({
    behaviorPlan: {
      mode: "virtual_human_household",
      primaryObjective: "Make one safe change.",
      nextStep: {
        title: "Continue task: Improve docs",
        detail: "Open task from memory."
      }
    }
  }, "No AI API key is configured.");

  assert.equal(response.fallback, true);
  assert.match(response.content, /Continue task: Improve docs/);
  assert.match(response.actions[0].input.body, /Behavior mode: virtual_human_household/);
});

test("first wake intro runs only on the first cycle", () => {
  assert.equal(shouldRunFirstWakeIntro({ cycle: 1 }), true);
  assert.equal(shouldRunFirstWakeIntro({ cycle: 2 }), false);

  const intro = buildFirstWakeIntro({ brandName: "Orbit" }, { cycle: 1, lastActive: "2026-05-22T00:00:00.000Z" });
  assert.equal(intro.kind, "first_wake_intro");
  assert.match(intro.summary, /opens the GitHub house/);
  assert.ok(intro.members.includes("diarist"));
});
