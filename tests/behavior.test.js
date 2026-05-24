"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { ACTIVITY_CONTRACT, HARD_LIMITS, planCycle } = require("../src/agent/behavior");
const { deterministicResponse } = require("../src/agent/inference");
const { buildFirstWakeIntro, shouldRunFirstWakeIntro } = require("../src/agent/intro");

test("behavior contract names control-plane activities and hard limits", () => {
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
  assert.equal(plan.directionPortfolio.mode, "single_guarded_priority");
  assert.deepEqual(plan.directionPortfolio.directions.map((direction) => direction.kind), ["safety_review"]);
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
  assert.equal(plan.directionPortfolio.mode, "single_guarded_priority");
});

test("cycle plan exposes a multi-direction portfolio for ordinary safe cycles", () => {
  const plan = planCycle({
    cycleConfig: {
      trigger: {
        type: "mandatory",
        id: "regular_heartbeat"
      }
    },
    tasks: {
      tasks: [
        {
          id: "task-1",
          title: "Improve product docs",
          status: "open"
        }
      ]
    },
    issues: [
      {
        number: 7,
        title: "Can Orbit explain the roadmap?",
        safety: { safe: true },
        scamRisk: { score: 0 }
      }
    ],
    roadmap: {
      summary: {
        activePhase: {
          phaseId: "mission-control-roadmap",
          status: "active",
          checks: ["Frontend shows roadmap lanes."]
        }
      },
      phaseChecks: []
    },
    aiBudget: {
      canUseAi: true,
      dailyRemainingUsd: 5,
      monthlyRemainingUsd: 100
    },
    learningLab: {
      bestProblem: {
        title: "Maintainers need safer issue triage"
      }
    }
  });

  assert.equal(plan.directionPortfolio.mode, "multi_direction");
  assert.ok(plan.directionPortfolio.directions.length >= 5);
  assert.ok(plan.directionPortfolio.directions.some((direction) => direction.direction === "maintain"));
  assert.ok(plan.directionPortfolio.directions.some((direction) => direction.direction === "respond"));
  assert.ok(plan.directionPortfolio.directions.some((direction) => direction.direction === "grow"));
  assert.ok(plan.directionPortfolio.directions.some((direction) => direction.direction === "explore"));
  assert.ok(plan.directionPortfolio.directions.some((direction) => direction.direction === "remember"));
  assert.equal(plan.directionPortfolio.choice.mode, "multi_direction");
  assert.equal(plan.directionPortfolio.choice.mustCompareCount, 3);
  assert.ok(plan.directionPortfolio.choice.considered.length >= 3);
  assert.ok(plan.directionPortfolio.choice.selected);
  assert.ok(Number.isFinite(plan.directionPortfolio.choice.selected.score));
});

test("cycle plan advances active roadmap phase before routine memory review", () => {
  const plan = planCycle({
    roadmap: {
      currentLevel: {
        id: "level-2",
        name: "Mission Control Roadmap"
      },
      summary: {
        currentLevel: {
          id: "level-2",
          name: "Mission Control Roadmap"
        },
        activePhase: {
          phaseId: "mission-control-roadmap",
          status: "active",
          checks: ["Roadmap exists as tracked project memory."]
        }
      },
      phaseChecks: []
    },
    aiBudget: {
      canUseAi: true,
      dailyRemainingUsd: 5,
      monthlyRemainingUsd: 100
    }
  });

  assert.equal(plan.nextStep.kind, "roadmap_growth");
  assert.equal(plan.nextStep.activity, "mission_control");
  assert.match(plan.nextStep.detail, /Roadmap exists/);
});

test("cycle plan advances infrastructure before roadmap when routine queues are clear", () => {
  const plan = planCycle({
    infrastructure: {
      activePhase: {
        id: "foundation-control-plane",
        name: "Foundation Control Plane",
        status: "active",
        goal: "Make Orbit understandable as infrastructure."
      },
      capabilities: [
        { id: "agent-passport", name: "Agent Passport", status: "planned" }
      ],
      surfaces: [
        { id: "sdk-cli", name: "SDK And CLI", status: "planned" }
      ]
    },
    roadmap: {
      summary: {
        activePhase: {
          phaseId: "mission-control-roadmap",
          status: "active",
          checks: ["Roadmap exists as tracked project memory."]
        }
      }
    },
    aiBudget: {
      canUseAi: true,
      dailyRemainingUsd: 5,
      monthlyRemainingUsd: 100
    }
  });

  assert.equal(plan.nextStep.kind, "infrastructure_growth");
  assert.ok(plan.recommendedSteps.some((step) => step.kind === "roadmap_growth"));
  assert.equal(plan.directionPortfolio.choice.selected.kind, "infrastructure_growth");
});

test("cycle plan keeps open tasks and safe issues ahead of infrastructure growth", () => {
  const infrastructure = {
    activePhase: {
      id: "foundation-control-plane",
      name: "Foundation Control Plane",
      status: "active"
    }
  };
  const aiBudget = {
    canUseAi: true,
    dailyRemainingUsd: 5,
    monthlyRemainingUsd: 100
  };
  const taskPlan = planCycle({
    infrastructure,
    aiBudget,
    tasks: {
      tasks: [{ id: "task-1", title: "Fix docs", status: "open" }]
    }
  });
  const issuePlan = planCycle({
    infrastructure,
    aiBudget,
    issues: [{ number: 9, title: "Question", safety: { safe: true }, scamRisk: { score: 0 } }]
  });

  assert.equal(taskPlan.nextStep.kind, "open_task");
  assert.ok(taskPlan.recommendedSteps.some((step) => step.kind === "infrastructure_growth"));
  assert.equal(taskPlan.directionPortfolio.choice.selected.kind, "open_task");
  assert.equal(issuePlan.nextStep.kind, "safe_issue_triage");
  assert.ok(issuePlan.recommendedSteps.some((step) => step.kind === "infrastructure_growth"));
  assert.equal(issuePlan.directionPortfolio.choice.selected.kind, "safe_issue_triage");
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

test("cycle plan explores learning lab before repeating blocked routine work", () => {
  const plan = planCycle({
    cycleConfig: {
      trigger: {
        type: "mandatory",
        id: "regular_heartbeat"
      }
    },
    tasks: {
      tasks: [
        {
          id: "task-1",
          title: "Review owner feedback on README service pitch",
          status: "open",
          notes: "Wait for owner review before outreach."
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
    },
    opportunities: {
      drivers: {
        survival: {
          survivalState: "needs_income"
        }
      }
    },
    learningLab: {
      bestProblem: {
        title: "Maintainers cannot safely triage hostile AI-agent issue comments"
      },
      bestProject: {
        title: "Issue Scam Scanner GitHub Action",
        description: "Flags prompt injection and wallet drain language."
      },
      nextExperiment: {
        safeAction: "Create a local scanner package and tests."
      }
    }
  });

  assert.equal(plan.nextStep.kind, "learning_exploration");
  assert.equal(plan.nextStep.activity, "project_builder");
  assert.match(plan.nextStep.detail, /repo-local prototype/);
  assert.doesNotMatch(plan.nextStep.toolHint, /create_issue/);
});

test("deterministic fallback inspects learning lab for exploration step", () => {
  const response = deterministicResponse({
    behaviorPlan: {
      mode: "virtual_repo_control_plane",
      primaryObjective: "learn",
      nextStep: {
        kind: "learning_exploration",
        title: "Build from open-source idea: Issue Scam Scanner GitHub Action",
        detail: "Build the smallest repo-local artifact."
      }
    }
  }, "No AI API key is configured.");

  assert.equal(response.actions[0].tool, "learning_lab_status");
  assert.equal(response.actions[1].tool, "write_cycle_note");
});

test("deterministic fallback uses behavior plan next step", () => {
  const response = deterministicResponse({
    behaviorPlan: {
      mode: "virtual_repo_control_plane",
      primaryObjective: "Make one safe change.",
      nextStep: {
        title: "Continue task: Improve docs",
        detail: "Open task from memory."
      }
    }
  }, "No AI API key is configured.");

  assert.equal(response.fallback, true);
  assert.match(response.content, /Continue task: Improve docs/);
  assert.match(response.actions[0].input.body, /Behavior mode: virtual_repo_control_plane/);
  assert.match(response.actions[0].input.body, /Direction mode:/);
});

test("deterministic fallback writes multi-direction comparison when supplied", () => {
  const response = deterministicResponse({
    behaviorPlan: {
      mode: "virtual_repo_control_plane",
      primaryObjective: "Make one safe change.",
      nextStep: {
        kind: "roadmap_growth",
        title: "Advance roadmap phase",
        detail: "Find the next evidence-backed phase check."
      },
      directionPortfolio: {
        mode: "multi_direction",
        choice: {
          mustCompareCount: 3,
          rule: "Compare several safe directions.",
          selected: {
            direction: "maintain",
            kind: "open_task",
            title: "Continue task: Improve docs",
            detail: "Open task from memory.",
            score: 70,
            signals: ["open_task_present"]
          },
          considered: [
            {
              direction: "maintain",
              kind: "open_task",
              title: "Continue task: Improve docs",
              detail: "Open task from memory.",
              score: 70,
              signals: ["open_task_present"]
            },
            {
              direction: "grow",
              kind: "roadmap_growth",
              title: "Advance roadmap phase",
              detail: "Find the next evidence-backed phase check.",
              score: 56,
              signals: ["roadmap_evidence_work"]
            },
            {
              direction: "remember",
              kind: "memory_review",
              title: "Refresh durable memory",
              detail: "Look for stale notes.",
              score: 48,
              signals: ["memory_or_proof_work"]
            }
          ]
        },
        directions: []
      }
    }
  }, "No AI API key is configured.");

  assert.equal(response.fallback, true);
  assert.match(response.content, /Continue task: Improve docs/);
  assert.match(response.actions[0].input.body, /Selected direction: maintain/);
  assert.match(response.actions[0].input.body, /Directions required for comparison: 3/);
  assert.match(response.actions[0].input.body, /maintain: Continue task: Improve docs \[score 70\]/);
  assert.doesNotMatch(response.actions[0].input.body, /Selected behavior step: Advance roadmap phase/);
});

test("first wake intro runs only on the first cycle", () => {
  assert.equal(shouldRunFirstWakeIntro({ cycle: 1 }), true);
  assert.equal(shouldRunFirstWakeIntro({ cycle: 2 }), false);

  const intro = buildFirstWakeIntro({ brandName: "Orbit" }, { cycle: 1, lastActive: "2026-05-22T00:00:00.000Z" });
  assert.equal(intro.kind, "first_wake_intro");
  assert.match(intro.summary, /opens the GitHub repository control plane/);
  assert.ok(intro.modules.includes("proofs"));
});
