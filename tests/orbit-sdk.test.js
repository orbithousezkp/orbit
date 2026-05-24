"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const {
  adoptionChecklist,
  createOrbitClient,
  exportBundle,
  readCapabilities,
  readInfrastructure,
  readPassport,
  readReceipts,
  readStatus,
  readWalletPolicy
} = require("../packages/orbit-sdk");

function writeJson(repoRoot, relativePath, value) {
  const full = path.join(repoRoot, relativePath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, `${JSON.stringify(value, null, 2)}\n`);
}

function tempRepo() {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "orbit-sdk-test-"));
  writeJson(repoRoot, "memory/infrastructure.json", {
    product: {
      name: "Orbit",
      category: "GitHub-native agent infrastructure",
      problem: "Repos need agent control planes.",
      solution: "Expose passport, capabilities, receipts, memory, permissions, and lifecycle."
    },
    activePhase: { id: "foundation-control-plane", name: "Foundation Control Plane", status: "active" },
    layers: [
      { id: "github-intake", name: "GitHub Intake", status: "active" },
      { id: "wallet-policy", name: "Wallet Policy", status: "active" },
      { id: "sdk-cli-access", name: "SDK And CLI Access", status: "planned" }
    ],
    surfaces: [
      { id: "repo-control-plane", name: "Repository Control Plane", status: "active" },
      { id: "sdk-cli", name: "SDK And CLI", status: "planned" }
    ],
    capabilities: [
      { id: "identity", name: "Identity", status: "active" },
      { id: "proofs", name: "Proof Receipts", status: "active" },
      { id: "zk", name: "ZK Receipts", status: "planned" }
    ],
    commands: [
      { name: "@orbit status", status: "planned" }
    ],
    access: [
      { id: "cli", name: "CLI", status: "active" },
      { id: "sdk", name: "SDK", status: "planned" }
    ],
    wallet: {
      approvalMode: "owner_approval_required",
      publicViewOnly: true,
      noPrivateKeys: true,
      blockedLiveActions: ["wallet spending", "signing"]
    },
    receipts: { current: "runtime/proofs/" },
    blockedUntilApproved: ["Live wallet signing"]
  });
  writeJson(repoRoot, "memory/roadmap.json", {
    currentLevel: { id: "level-1", name: "Safe Autonomy" }
  });
  fs.writeFileSync(path.join(repoRoot, "memory/identity.md"), "# Orbit\n\nAgent infrastructure.\n");
  writeJson(repoRoot, "memory/state.json", {
    cycle: 4,
    born: "2026-01-01T00:00:00.000Z",
    lastActive: "2026-01-02T00:00:00.000Z",
    lastStatus: "completed",
    firstWakeIntroComplete: true
  });
  writeJson(repoRoot, "memory/tasks.json", {
    tasks: [{ id: "task-1", title: "Build SDK", status: "open" }]
  });
  writeJson(repoRoot, "memory/knowledge.json", {
    entries: [{ id: "mem-1", title: "SDK", content: "Read-only contract.", kind: "product" }]
  });
  writeJson(repoRoot, "memory/governance.json", {
    externalSpend: {
      mode: "owner_approval_required",
      approvalIssueLabel: "orbit:approval",
      approvalAcceptedLabel: "orbit:approved",
      approvalRejectedLabel: "orbit:rejected",
      allowedWithoutApproval: ["gas"]
    },
    hardRules: ["No live wallet signing without approval."]
  });
  writeJson(repoRoot, "memory/treasury.json", {
    ai: {
      dailyBudgetUsd: 5,
      monthlyBudgetUsd: 100,
      reserveUsd: 1,
      purchasePolicy: {
        mode: "owner_approved_manual_credit_top_up",
        liveApiPurchase: false
      }
    },
    revenue: {
      cadence: "weekly_performance",
      claimIntervalDays: 7,
      performanceWindowDays: 7,
      operatorShareBps: 2000,
      treasuryShareBps: 8000
    },
    token: {
      name: "Orbit",
      symbol: "ORBIT",
      launchStatus: "planned"
    }
  });
  fs.writeFileSync(path.join(repoRoot, "memory/cycles.jsonl"), `${JSON.stringify({ cycle: 4, timestamp: "2026-01-02T00:00:00.000Z", result: "done" })}\n`);
  writeJson(repoRoot, "runtime/proofs/2026-01-02/proof.json", {
    cycle: 4,
    startedAt: "2026-01-02T00:00:00.000Z",
    finishedAt: "2026-01-02T00:01:00.000Z",
    trigger: { type: "mandatory" },
    filesChanged: ["packages/orbit-sdk/index.js"],
    result: "SDK built",
    steps: [{ step: 1 }]
  });
  fs.mkdirSync(path.join(repoRoot, ".github/workflows"), { recursive: true });
  fs.writeFileSync(path.join(repoRoot, ".github/workflows/orbit-cycle.yml"), "name: Orbit Cycle\n");
  fs.writeFileSync(path.join(repoRoot, ".github/workflows/orbit-event.yml"), "name: Orbit Event\n");
  return repoRoot;
}

test("SDK reads Orbit status", () => {
  const repoRoot = tempRepo();
  const status = readStatus(repoRoot);

  assert.equal(status.product.name, "Orbit");
  assert.equal(status.lifecycle.cycle, 4);
  assert.equal(status.capabilitySummary.activeCapabilities, 2);
  assert.equal(status.latestReceipt.cycle, 4);
});

test("SDK exports agent passport with digest", () => {
  const passport = readPassport(tempRepo());

  assert.equal(passport.category, "GitHub-native agent infrastructure");
  assert.equal(passport.permissionMode, "owner_approval_required");
  assert.ok(passport.digest);
});

test("SDK reads capabilities and adoption checklist", () => {
  const repoRoot = tempRepo();
  const capabilities = readCapabilities(repoRoot);
  const adoption = adoptionChecklist(repoRoot);

  assert.equal(capabilities.summary.totalSurfaces, 2);
  assert.equal(capabilities.summary.totalCommands, 1);
  assert.equal(adoption.summary.ready, true);
});

test("SDK reads infrastructure layers and wallet policy", () => {
  const repoRoot = tempRepo();
  const infrastructure = readInfrastructure(repoRoot);
  const walletPolicy = readWalletPolicy(repoRoot);

  assert.equal(infrastructure.summary.totalLayers, 3);
  assert.equal(infrastructure.summary.totalAccess, 2);
  assert.equal(infrastructure.summary.sdkStatus, "planned");
  assert.equal(infrastructure.layers[0].name, "GitHub Intake");
  assert.equal(walletPolicy.approvalMode, "owner_approval_required");
  assert.equal(walletPolicy.publicViewOnly, true);
  assert.equal(walletPolicy.noPrivateKeys, true);
  assert.equal(walletPolicy.aiBudget.dailyBudgetUsd, 5);
  assert.equal(walletPolicy.revenue.cadence, "weekly_performance");
  assert.equal(walletPolicy.token.symbol, "ORBIT");
  assert.ok(walletPolicy.digest);
});

test("SDK reads proof receipts with digest", () => {
  const receipts = readReceipts(tempRepo(), undefined, { limit: 1 });

  assert.equal(receipts.count, 1);
  assert.equal(receipts.latest.filesChanged[0], "packages/orbit-sdk/index.js");
  assert.ok(receipts.latest.digest);
});

test("SDK client exposes full bundle", () => {
  const repoRoot = tempRepo();
  const client = createOrbitClient({ repoRoot });
  const bundle = exportBundle(repoRoot);

  assert.equal(client.readLifecycle().recordedCycles, 1);
  assert.equal(bundle.status.product.name, "Orbit");
  assert.equal(bundle.infrastructure.summary.totalLayers, 3);
  assert.equal(bundle.walletPolicy.approvalMode, "owner_approval_required");
  assert.ok(bundle.digest);
});
