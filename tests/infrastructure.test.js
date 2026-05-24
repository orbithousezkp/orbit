"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { executeTool } = require("../src/agent/actions");
const { gatherContext } = require("../src/agent/context");
const { deterministicResponse } = require("../src/agent/inference");
const { TOOLS } = require("../src/agent/tools");
const {
  INFRASTRUCTURE_PATH,
  infrastructureStatus,
  infrastructureSummary,
  loadInfrastructure
} = require("../src/agent/infrastructure");

function tempRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "orbit-infrastructure-test-"));
  fs.mkdirSync(path.join(dir, "memory"), { recursive: true });
  fs.writeFileSync(path.join(dir, INFRASTRUCTURE_PATH), JSON.stringify({
    version: 1,
    product: {
      name: "Orbit",
      category: "GitHub-native agent infrastructure",
      problem: "Agents need identity, permissions, memory, receipts, and lifecycle.",
      solution: "Use the repository as the control plane."
    },
    activePhase: {
      id: "foundation-control-plane",
      name: "Foundation Control Plane",
      status: "active"
    },
    surfaces: [
      { id: "repo-control-plane", name: "Repository Control Plane", status: "active" },
      { id: "agent-passport", name: "Agent Passport", status: "planned" }
    ],
    capabilities: [
      { id: "identity", name: "Identity", status: "active" },
      { id: "proofs", name: "Proof Receipts", status: "active" },
      { id: "zk-receipts", name: "ZK Policy Receipts", status: "planned" }
    ],
    commands: [
      { name: "@orbit status", status: "planned" }
    ],
    receipts: {
      current: "runtime/proofs/"
    },
    blockedUntilApproved: ["Live wallet signing"]
  }, null, 2));
  return dir;
}

test("loads infrastructure product registry", () => {
  const infrastructure = loadInfrastructure(tempRepo());

  assert.equal(infrastructure.product.name, "Orbit");
  assert.equal(infrastructure.activePhase.id, "foundation-control-plane");
  assert.equal(infrastructure.surfaces.length, 2);
  assert.equal(infrastructure.capabilities.length, 3);
  assert.equal(infrastructure.commands[0].name, "@orbit status");
});

test("summarizes infrastructure surfaces and capabilities", () => {
  const summary = infrastructureSummary(loadInfrastructure(tempRepo()));

  assert.equal(summary.category, "GitHub-native agent infrastructure");
  assert.equal(summary.activePhase.name, "Foundation Control Plane");
  assert.equal(summary.totalSurfaces, 2);
  assert.equal(summary.surfaceCounts.active, 1);
  assert.equal(summary.totalCapabilities, 3);
  assert.equal(summary.activeCapabilities, 2);
  assert.equal(summary.plannedCapabilities, 1);
  assert.equal(summary.receiptRoot, "runtime/proofs/");
});

test("infrastructure tool is available and returns product status", async () => {
  const repoRoot = tempRepo();
  const tool = TOOLS.find((item) => item.name === "infrastructure_status");
  const result = await executeTool({ repoRoot }, null, 1, "infrastructure_status", {});

  assert.ok(tool);
  assert.equal(result.path, INFRASTRUCTURE_PATH);
  assert.equal(result.summary.activePhase.id, "foundation-control-plane");
  assert.equal(result.product.solution, "Use the repository as the control plane.");
});

test("gatherContext includes infrastructure status", async () => {
  const repoRoot = tempRepo();
  for (const file of [
    "tasks.json",
    "knowledge.json",
    "treasury.json",
    "governance.json",
    "roadmap.json",
    "opportunities.json",
    "problem-lab.json",
    "project-ideas.json",
    "agent-sources.json",
    "idea-inbox.json"
  ]) {
    fs.writeFileSync(path.join(repoRoot, "memory", file), "{}");
  }

  const context = await gatherContext({
    repoRoot,
    brandName: "Orbit",
    aiProviders: [],
    dryRun: true,
    commitChanges: false,
    pushChanges: false,
    maxSteps: 1,
    githubRepository: "",
    cycleTrigger: "local",
    cycleTriggerAction: "",
    aiDailyBudgetUsd: 5,
    aiMonthlyBudgetUsd: 100,
    aiInputUsdPerMillion: 0.15,
    aiOutputUsdPerMillion: 0.6,
    enableTokenLaunch: false,
    enableRevenueClaims: false,
    tokenName: "Orbit",
    tokenSymbol: "ORBIT",
    tokenDescription: "",
    tokenImageUri: "",
    tokenAdminAddress: "",
    treasuryAddress: "",
    operatorRevenueAddress: "",
    operatorRevenueBps: 0
  });

  assert.equal(context.infrastructure.summary.category, "GitHub-native agent infrastructure");
});

test("deterministic fallback inspects infrastructure for infrastructure growth", () => {
  const response = deterministicResponse({
    behaviorPlan: {
      mode: "virtual_repo_control_plane",
      primaryObjective: "build infrastructure",
      nextStep: {
        kind: "infrastructure_growth",
        title: "Advance infrastructure phase: Foundation Control Plane",
        detail: "Expose the product registry."
      }
    }
  }, "No AI API key is configured.");

  assert.equal(response.actions[0].tool, "infrastructure_status");
  assert.equal(response.actions[1].tool, "write_cycle_note");
});
