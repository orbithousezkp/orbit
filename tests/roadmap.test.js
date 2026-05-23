"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { executeTool } = require("../src/agent/actions");
const { planCycle } = require("../src/agent/behavior");
const { TOOLS } = require("../src/agent/tools");
const { loadRoadmap, roadmapStatus, roadmapSummary } = require("../src/agent/roadmap");

function tempRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "orbit-roadmap-test-"));
  fs.mkdirSync(path.join(dir, "memory"), { recursive: true });
  fs.writeFileSync(path.join(dir, "memory", "roadmap.json"), JSON.stringify({
    version: 2,
    northStar: "Test roadmap",
    currentLevel: {
      id: "level-2",
      name: "Mission Control Roadmap",
      status: "active"
    },
    dayOneBuild: {
      summary: "Test day one build",
      ships: ["roadmap status memory"],
      doesNotShip: ["live wallet signing"]
    },
    operatingRules: ["Pass phases with evidence."],
    lanes: [
      { id: "lane-1", name: "Safe Autonomy", status: "active" },
      { id: "lane-2", name: "Mission Control", status: "planned" }
    ],
    phaseChecks: [
      {
        phaseId: "mission-control-roadmap",
        status: "active",
        checks: ["Roadmap memory is tracked."],
        evidence: ["memory/roadmap.json"]
      }
    ],
    levels: [
      { id: "level-1", name: "Safe Autonomy", status: "active" },
      { id: "level-2", name: "Mission Control Roadmap", status: "active" },
      { id: "level-3", name: "Treasury Watchtower", status: "planned" }
    ],
    weeklyRevenueModel: {
      scope: "current_week_only",
      formula: "weeklyDistributableRevenue = weeklyGrossRevenue - refunds"
    },
    zkProofsShipNow: [
      { id: "zk-1", name: "Private Treasury Commitment Ledger", status: "planned" }
    ],
    zkProofMvp: [
      {
        id: "private-treasury-commitment-ledger",
        name: "Private Treasury Commitment Ledger",
        status: "planned"
      }
    ],
    frontierBacklog: ["MCP-style tool surface"],
    impossibleOrUnsafe: ["Guaranteed profit."],
    notImplementedYet: ["No ZK circuit is implemented yet."],
    approvalRequired: ["Wallet spending"],
    researchReferences: [
      {
        name: "Model Context Protocol tools",
        url: "https://modelcontextprotocol.io/specification/draft/server/tools",
        usedFor: "Future guarded tool surface."
      }
    ]
  }, null, 2));
  return dir;
}

function roadmapContext() {
  return {
    roadmap: roadmapStatus(tempRepo()),
    aiBudget: {
      canUseAi: true,
      dailyRemainingUsd: 5,
      monthlyRemainingUsd: 100
    }
  };
}

test("roadmap loader reads expanded roadmap scope", () => {
  const roadmap = loadRoadmap(tempRepo());

  assert.equal(roadmap.version, 2);
  assert.equal(roadmap.dayOneBuild.summary, "Test day one build");
  assert.equal(roadmap.lanes.length, 2);
  assert.equal(roadmap.phaseChecks[0].phaseId, "mission-control-roadmap");
  assert.equal(roadmap.levels.length, 3);
  assert.equal(roadmap.weeklyRevenueModel.scope, "current_week_only");
  assert.equal(roadmap.zkProofsShipNow[0].id, "zk-1");
  assert.equal(roadmap.zkProofMvp[0].name, "Private Treasury Commitment Ledger");
  assert.equal(roadmap.frontierBacklog[0], "MCP-style tool surface");
  assert.equal(roadmap.impossibleOrUnsafe[0], "Guaranteed profit.");
  assert.match(roadmap.notImplementedYet[0], /No ZK circuit/);
  assert.equal(roadmap.researchReferences[0].name, "Model Context Protocol tools");
});

test("roadmap summary identifies the expanded counts and staged ZK scope", () => {
  const summary = roadmapSummary(loadRoadmap(tempRepo()));

  assert.equal(summary.currentLevel.name, "Mission Control Roadmap");
  assert.equal(summary.nextLevel.name, "Treasury Watchtower");
  assert.equal(summary.activePhase.phaseId, "mission-control-roadmap");
  assert.equal(summary.totalLanes, 2);
  assert.equal(summary.totalZkShipNowItems, 1);
  assert.equal(summary.totalZkProofItems, 1);
  assert.equal(summary.zkCounts.planned, 1);
  assert.equal(summary.zkShipNowCounts.planned, 1);
  assert.equal(summary.weeklyRevenueScope, "current_week_only");
  assert.equal(summary.hasZkImplementation, false);
});

test("roadmap tool is available and returns roadmap status", async () => {
  const repoRoot = tempRepo();
  const tool = TOOLS.find((item) => item.name === "roadmap_status");
  const result = await executeTool({ repoRoot }, null, 1, "roadmap_status", {});

  assert.ok(tool);
  assert.equal(result.path, "memory/roadmap.json");
  assert.equal(result.summary.activePhase.phaseId, "mission-control-roadmap");
  assert.equal(result.lanes.length, 2);
  assert.equal(result.weeklyRevenueModel.scope, "current_week_only");
  assert.equal(result.zkProofsShipNow[0].id, "zk-1");
  assert.equal(result.zkProofMvp[0].status, "planned");
});

test("cycle plan can advance roadmap growth when routine queues are clear", () => {
  const plan = planCycle(roadmapContext());

  assert.equal(plan.nextStep.kind, "roadmap_growth");
  assert.equal(plan.nextStep.activity, "mission_control");
  assert.match(plan.nextStep.detail, /Do not mark a phase passed without proof/);
  assert.match(plan.nextStep.toolHint, /roadmap_status/);
  assert.equal(plan.directionPortfolio.mode, "multi_direction");
  assert.ok(plan.directionPortfolio.directions.some((direction) => direction.direction === "grow"));
});

test("cycle plan keeps open tasks ahead of roadmap growth", () => {
  const plan = planCycle({
    ...roadmapContext(),
    tasks: {
      tasks: [
        {
          id: "task-1",
          title: "Improve docs",
          status: "open"
        }
      ]
    }
  });

  assert.equal(plan.nextStep.kind, "open_task");
  assert.ok(plan.recommendedSteps.some((step) => step.kind === "roadmap_growth"));
  assert.ok(plan.directionPortfolio.directions.some((direction) => direction.kind === "roadmap_growth"));
  assert.ok(plan.directionPortfolio.directions.some((direction) => direction.direction === "maintain"));
  assert.equal(plan.directionPortfolio.choice.selected.kind, "open_task");
});

test("cycle plan keeps safe issue triage ahead of roadmap growth", () => {
  const plan = planCycle({
    ...roadmapContext(),
    issues: [
      {
        number: 8,
        title: "Question about Orbit",
        safety: { safe: true },
        scamRisk: { score: 0 }
      }
    ]
  });

  assert.equal(plan.nextStep.kind, "safe_issue_triage");
  assert.ok(plan.recommendedSteps.some((step) => step.kind === "roadmap_growth"));
  assert.ok(plan.directionPortfolio.directions.some((direction) => direction.direction === "respond"));
  assert.ok(plan.directionPortfolio.directions.some((direction) => direction.direction === "grow"));
  assert.equal(plan.directionPortfolio.choice.selected.kind, "safe_issue_triage");
});
