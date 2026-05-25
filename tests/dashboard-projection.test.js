"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const {
  createOrbitClient,
  exportBundle,
  projectForDashboard
} = require("../packages/orbit-sdk");

function writeJson(repoRoot, relativePath, value) {
  const full = path.join(repoRoot, relativePath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, `${JSON.stringify(value, null, 2)}\n`);
}

function tempRepo() {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "orbit-dashboard-"));
  writeJson(repoRoot, "memory/infrastructure.json", {
    product: { name: "Orbit", category: "GitHub-native agent infrastructure" },
    activePhase: { id: "phase-1", name: "Launch", status: "active" },
    blockedUntilApproved: ["Live wallet signing"]
  });
  writeJson(repoRoot, "memory/state.json", {
    cycle: 27,
    born: "2026-05-22T00:00:00.000Z",
    lastActive: "2026-05-24T00:00:00.000Z",
    lastStatus: "completed",
    firstWakeIntroComplete: true,
    firstSignedCycle: 25
  });
  writeJson(repoRoot, "memory/governance.json", {
    externalSpend: {
      mode: "owner_approval_required",
      allowedWithoutApproval: ["gas", "ai_call"]
    }
  });
  writeJson(repoRoot, "memory/treasury.json", {
    token: { name: "Orbit", symbol: "ORBIT", launchStatus: "planned" }
  });
  fs.writeFileSync(
    path.join(repoRoot, "memory/cycles.jsonl"),
    `${JSON.stringify({ cycle: 27, timestamp: "2026-05-24T00:00:00.000Z", result: "ok" })}\n`
  );
  return repoRoot;
}

function makeProof(overrides = {}) {
  return {
    cycle: 27,
    startedAt: "2026-05-24T00:00:00.000Z",
    finishedAt: "2026-05-24T00:01:00.000Z",
    trigger: { type: "schedule", id: "regular_heartbeat" },
    filesChanged: ["memory/state.json", "memory/cycles.jsonl"],
    result: "cycle complete",
    steps: [{ step: 1, content: "x".repeat(500) }],
    totalSteps: 1,
    ...overrides
  };
}

function makeSignedProof(overrides = {}) {
  return makeProof({
    signature: "0x" + "a".repeat(130),
    signer: "0x19E7E376E7C213B7E7e7e46cc70A5dD086DAff2A",
    signatureScheme: "eip712:orbit-cycle-proof/1",
    payloadHash: "0x" + "b".repeat(64),
    signedAt: "2026-05-24T00:01:01.000Z",
    ...overrides
  });
}

test("projectForDashboard returns slim shape with schema and digest", () => {
  const repoRoot = tempRepo();
  writeJson(repoRoot, "runtime/proofs/2026-05-24/01.json", makeSignedProof());
  const bundle = exportBundle(repoRoot, undefined, { receiptLimit: 10 });
  const slim = projectForDashboard(bundle, { gitCommit: "abc1234567890def" });

  assert.equal(slim.schema, "orbit-dashboard/1");
  assert.equal(slim.gitCommit, "abc123456789");
  assert.equal(slim.product.name, "Orbit");
  assert.equal(slim.lifecycle.cycle, 27);
  assert.equal(slim.lifecycle.lastStatus, "completed");
  assert.equal(slim.walletPolicy.approvalMode, "owner_approval_required");
  assert.equal(slim.walletPolicy.publicViewOnly, true);
  assert.equal(slim.walletPolicy.token.symbol, "ORBIT");
  assert.deepEqual(slim.permissions.allowedWithoutApproval, ["gas", "ai_call"]);
  assert.deepEqual(slim.permissions.blockedUntilApproved, ["Live wallet signing"]);
  assert.equal(slim.receipts.count, 1);
  assert.equal(slim.receipts.latest.signed, true);
  assert.equal(slim.signer, "0x19E7E376E7C213B7E7e7e46cc70A5dD086DAff2A");
  assert.ok(slim.digest);
});

test("projectForDashboard omits step bodies from receipts", () => {
  const repoRoot = tempRepo();
  writeJson(repoRoot, "runtime/proofs/2026-05-24/01.json", makeSignedProof());
  const bundle = exportBundle(repoRoot, undefined, { receiptLimit: 10 });
  const slim = projectForDashboard(bundle);
  const serialized = JSON.stringify(slim);

  assert.equal(slim.receipts.latest.totalSteps, 1);
  assert.equal(slim.receipts.latest.filesChangedCount, 2);
  assert.ok(!Array.isArray(slim.receipts.latest.steps), "steps must not be present");
  assert.ok(!serialized.includes("x".repeat(500)), "raw step content must not leak through");
});

test("projectForDashboard stays under 30KB for realistic 10-receipt bundle", () => {
  const repoRoot = tempRepo();
  for (let i = 0; i < 12; i += 1) {
    writeJson(repoRoot, `runtime/proofs/2026-05-24/${String(i).padStart(2, "0")}.json`, makeSignedProof({
      cycle: 15 + i,
      result: "cycle complete with some detail ".repeat(8),
      filesChanged: ["memory/state.json", "memory/cycles.jsonl", "memory/treasury.json", "memory/infrastructure.json"]
    }));
  }
  const bundle = exportBundle(repoRoot, undefined, { receiptLimit: 10 });
  const slim = projectForDashboard(bundle, { gitCommit: "deadbeef1234" });
  const serialized = JSON.stringify(slim);

  assert.equal(slim.receipts.list.length, 10);
  assert.ok(serialized.length < 30_000, `dashboard projection too large: ${serialized.length} bytes`);
});

test("projectForDashboard tolerates empty bundle", () => {
  const slim = projectForDashboard({});
  assert.equal(slim.schema, "orbit-dashboard/1");
  assert.equal(slim.lifecycle.cycle, 0);
  assert.equal(slim.receipts.count, 0);
  assert.equal(slim.receipts.latest, null);
  assert.equal(slim.signer, null);
  assert.deepEqual(slim.permissions.allowedWithoutApproval, []);
});

test("projectForDashboard surfaces latest signed receipt even when newest is unsigned", () => {
  const repoRoot = tempRepo();
  writeJson(repoRoot, "runtime/proofs/2026-05-24/01.json", makeSignedProof({ cycle: 25 }));
  writeJson(repoRoot, "runtime/proofs/2026-05-24/02.json", makeProof({ cycle: 26 }));
  const bundle = exportBundle(repoRoot, undefined, { receiptLimit: 10 });
  const slim = projectForDashboard(bundle);

  assert.equal(slim.receipts.latest.cycle, 26);
  assert.equal(slim.receipts.latest.signed, false);
  assert.equal(slim.receipts.latestSigned.cycle, 25);
  assert.equal(slim.signer, "0x19E7E376E7C213B7E7e7e46cc70A5dD086DAff2A");
});

test("client.projectForDashboard returns the same shape as the module function", () => {
  const repoRoot = tempRepo();
  writeJson(repoRoot, "runtime/proofs/2026-05-24/01.json", makeSignedProof());
  const client = createOrbitClient({ repoRoot });
  const slim = client.projectForDashboard({ gitCommit: "abcdef0" });

  assert.equal(slim.schema, "orbit-dashboard/1");
  assert.equal(slim.gitCommit, "abcdef0");
  assert.equal(slim.receipts.latest.signed, true);
});

function makeRefusalProof(overrides = {}) {
  return makeProof({
    cycle: overrides.cycle || 27,
    startedAt: overrides.startedAt || "2026-05-24T00:00:00.000Z",
    finishedAt: overrides.finishedAt || "2026-05-24T00:01:00.000Z",
    steps: overrides.steps || [
      {
        step: 1,
        tool: "spend",
        refused: true,
        refusalReason: "external transfer above allowedWithoutApproval threshold",
        risk: { level: "high", category: "approval-missing" }
      }
    ],
    totalSteps: (overrides.steps && overrides.steps.length) || 1,
    ...overrides
  });
}

test("projectForDashboard returns empty refusals[] when bundle has none", () => {
  const repoRoot = tempRepo();
  writeJson(repoRoot, "runtime/proofs/2026-05-24/01.json", makeSignedProof());
  const bundle = exportBundle(repoRoot, undefined, { receiptLimit: 10 });
  const slim = projectForDashboard(bundle);

  assert.ok(Array.isArray(slim.refusals), "refusals must be an array");
  assert.equal(slim.refusals.length, 0);
});

test("projectForDashboard returns empty refusals[] for empty bundle (backward compat)", () => {
  const slim = projectForDashboard({});
  assert.ok(Array.isArray(slim.refusals));
  assert.equal(slim.refusals.length, 0);
});

test("projectForDashboard projects refusals with normalized category and severity", () => {
  const repoRoot = tempRepo();
  writeJson(repoRoot, "runtime/proofs/2026-05-24/01.json", makeRefusalProof({
    cycle: 30,
    finishedAt: "2026-05-24T00:01:00.000Z",
    steps: [
      {
        step: 1,
        tool: "issue_reply",
        refused: true,
        refusalReason: "issue body matched scam scoring threshold",
        risk: { level: "critical", category: "scam" }
      }
    ]
  }));
  const bundle = exportBundle(repoRoot, undefined, { receiptLimit: 10 });
  const slim = projectForDashboard(bundle);

  assert.equal(slim.refusals.length, 1);
  const entry = slim.refusals[0];
  assert.equal(entry.cycle, 30);
  assert.equal(entry.category, "scam");
  assert.equal(entry.severity, "critical");
  assert.equal(entry.at, "2026-05-24T00:01:00.000Z");
  assert.ok(entry.oneLineSummary.startsWith("issue body matched scam"));
  assert.ok(entry.oneLineSummary.length <= 120);
});

test("projectForDashboard sorts refusals most-recent first and caps at 20", () => {
  const repoRoot = tempRepo();
  for (let i = 0; i < 30; i += 1) {
    const cycle = 10 + i;
    const isoMinute = String(i).padStart(2, "0");
    writeJson(repoRoot, `runtime/proofs/2026-05-24/${String(i).padStart(2, "0")}.json`, makeRefusalProof({
      cycle,
      finishedAt: `2026-05-24T00:${isoMinute}:00.000Z`,
      steps: [
        {
          step: 1,
          tool: "spend",
          refused: true,
          refusalReason: `refusal number ${cycle}`,
          risk: { level: "medium", category: "policy" }
        }
      ]
    }));
  }
  const bundle = exportBundle(repoRoot, undefined, { receiptLimit: 30 });
  const slim = projectForDashboard(bundle, { refusalLimit: 20 });

  assert.equal(slim.refusals.length, 20);
  const cycles = slim.refusals.map((r) => r.cycle);
  for (let i = 1; i < cycles.length; i += 1) {
    assert.ok(cycles[i - 1] >= cycles[i], `refusals must be most-recent first: ${cycles.join(",")}`);
  }
  assert.equal(slim.refusals[0].cycle, 39);
});

test("projectForDashboard sanitizes secrets and addresses from refusal summaries", () => {
  const repoRoot = tempRepo();
  writeJson(repoRoot, "runtime/proofs/2026-05-24/01.json", makeRefusalProof({
    cycle: 42,
    steps: [
      {
        step: 1,
        tool: "external_post",
        refused: true,
        refusalReason: "refusing to publish token ghp_abcdefghijklmnopqrstuvwxyz0123456789 for 0x19E7E376E7C213B7E7e7e46cc70A5dD086DAff2A",
        risk: { level: "high", category: "safety" }
      }
    ]
  }));
  const bundle = exportBundle(repoRoot, undefined, { receiptLimit: 10 });
  const slim = projectForDashboard(bundle);

  assert.equal(slim.refusals.length, 1);
  const summary = slim.refusals[0].oneLineSummary;
  assert.ok(!/ghp_[A-Za-z0-9]/.test(summary), `secret leaked: ${summary}`);
  assert.ok(!/0x19E7E376E7C213B7E7e7e46cc70A5dD086DAff2A/i.test(summary), `address leaked: ${summary}`);
  assert.ok(summary.includes("[REDACTED"), "must include redaction marker");
});

test("projectForDashboard skips refusals where redaction leaves a meaningless string", () => {
  const repoRoot = tempRepo();
  writeJson(repoRoot, "runtime/proofs/2026-05-24/01.json", makeRefusalProof({
    cycle: 50,
    steps: [
      {
        step: 1,
        tool: "external_post",
        refused: true,
        refusalReason: "0x19E7E376E7C213B7E7e7e46cc70A5dD086DAff2A",
        risk: { level: "high", category: "scam" }
      },
      {
        step: 2,
        tool: "external_post",
        refused: true,
        refusalReason: "meaningful refusal reason here",
        risk: { level: "high", category: "scam" }
      }
    ]
  }));
  const bundle = exportBundle(repoRoot, undefined, { receiptLimit: 10 });
  const slim = projectForDashboard(bundle);

  assert.equal(slim.refusals.length, 1);
  assert.ok(slim.refusals[0].oneLineSummary.includes("meaningful"));
});

test("projectForDashboard stays under 30KB with 100 fake refusals", () => {
  const repoRoot = tempRepo();
  const steps = [];
  for (let i = 0; i < 100; i += 1) {
    steps.push({
      step: i + 1,
      tool: "spend",
      refused: true,
      refusalReason: `refusal ${i} with a moderately long description that the dashboard could show`,
      risk: { level: "high", category: "policy" }
    });
  }
  writeJson(repoRoot, "runtime/proofs/2026-05-24/01.json", makeRefusalProof({
    cycle: 27,
    steps,
    totalSteps: 100
  }));
  const bundle = exportBundle(repoRoot, undefined, { receiptLimit: 10 });
  const slim = projectForDashboard(bundle, { gitCommit: "deadbeef1234" });
  const serialized = JSON.stringify(slim);

  assert.equal(slim.refusals.length, 20, "must cap at 20");
  assert.ok(serialized.length < 30_000, `dashboard projection too large: ${serialized.length} bytes`);
});

test("projectForDashboard treats step.risk.level=high as refusal when no explicit refused flag", () => {
  const repoRoot = tempRepo();
  writeJson(repoRoot, "runtime/proofs/2026-05-24/01.json", makeRefusalProof({
    cycle: 60,
    steps: [
      {
        step: 1,
        tool: "spend",
        reason: "treasury policy gate blocked tx",
        risk: { level: "high", category: "governance" }
      }
    ]
  }));
  const bundle = exportBundle(repoRoot, undefined, { receiptLimit: 10 });
  const slim = projectForDashboard(bundle);

  assert.equal(slim.refusals.length, 1);
  assert.equal(slim.refusals[0].category, "governance");
  assert.equal(slim.refusals[0].severity, "high");
});

test("projectForDashboard surfaces missions from memory/missions.json", () => {
  const repoRoot = tempRepo();
  writeJson(repoRoot, "memory/missions.json", {
    schema: "orbit-missions/1",
    lastScannedCycle: 27,
    lastScannedAt: "2026-05-25T00:00:00Z",
    missions: [
      {
        id: "mission-101",
        issueNumber: 101,
        issueUrl: "https://github.com/example/repo/issues/101",
        title: "Ship federation discovery",
        proposer: "alice",
        rationale: "Other orbits need to find us.",
        acceptanceCriteria: ["pr-merged", "tests-pass"],
        deadline: "2026-06-15",
        status: "open",
        createdAt: "2026-05-20T00:00:00Z",
        updatedAt: "2026-05-22T00:00:00Z"
      },
      {
        id: "mission-99",
        issueNumber: 99,
        issueUrl: "https://github.com/example/repo/issues/99",
        title: "Old shipped one",
        proposer: "bob",
        rationale: "",
        acceptanceCriteria: [],
        deadline: null,
        status: "closed",
        createdAt: "2026-05-01T00:00:00Z",
        updatedAt: "2026-05-10T00:00:00Z"
      }
    ]
  });
  const bundle = exportBundle(repoRoot, undefined, { receiptLimit: 10 });
  const slim = projectForDashboard(bundle);

  assert.ok(slim.missions, "missions slice must exist");
  assert.equal(slim.missions.schema, "orbit-missions/1");
  assert.equal(slim.missions.active, 1);
  assert.equal(slim.missions.total, 2);
  assert.equal(slim.missions.list.length, 1);
  assert.equal(slim.missions.list[0].issueNumber, 101);
  assert.equal(slim.missions.list[0].proposer, "alice");
  assert.equal(slim.missions.list[0].deadline, "2026-06-15");
  assert.equal(slim.missions.list[0].acceptanceCount, 2);
});

test("projectForDashboard returns empty missions slice when memory file missing", () => {
  const repoRoot = tempRepo();
  const bundle = exportBundle(repoRoot, undefined, { receiptLimit: 10 });
  const slim = projectForDashboard(bundle);

  assert.ok(slim.missions);
  assert.equal(slim.missions.active, 0);
  assert.equal(slim.missions.total, 0);
  assert.deepEqual(slim.missions.list, []);
});
