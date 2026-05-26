"use strict";

// Integration test for the closed-loop self-funding demo (S-006/S-009).
//
// Scenario simulated against a fake GitHub adapter (no network):
//   cycle 1 — request_ai_food_refill creates an approval issue
//   owner posts an APPROVE comment
//   cycle 2 — record_ai_food_refill links the proof to the approval
//   plus negative paths: idempotent re-request, and non-owner approve refusal.
//
// Spec: PLAN/SPECS/CLOSED_LOOP_DEMO.md

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { executeTool } = require("../src/agent/actions");
const { loadConfig } = require("../src/agent/config");
const { loadTreasury } = require("../src/agent/treasury");

function tempRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "orbit-closed-loop-demo-"));
  fs.mkdirSync(path.join(dir, "memory"), { recursive: true });
  fs.writeFileSync(path.join(dir, "memory", "governance.json"), JSON.stringify({
    ownerUsername: "owner",
    policyVersion: 1,
    externalSpend: { mode: "owner_approval_required" }
  }, null, 2));
  fs.writeFileSync(path.join(dir, "memory", "approvals.json"), JSON.stringify({ approvals: [] }, null, 2));
  return dir;
}

function makeConfig(repoRoot) {
  return {
    ...loadConfig({
      GITHUB_REPOSITORY: "owner/orbit",
      ORBIT_OWNER_USERNAME: "owner",
      ORBIT_TREASURY_ADDRESS: "0x2222222222222222222222222222222222222222",
      ORBIT_OPERATOR_REVENUE_ADDRESS: "0x3333333333333333333333333333333333333333"
    }),
    repoRoot,
    ownerUsername: "owner",
    aiProviders: [
      { name: "route-one", label: "Route One", model: "model-one", priority: 1 },
      { name: "route-two", label: "Route Two", model: "model-two", priority: 2 },
      { name: "configured-ai-credit-provider", label: "Credit Route", model: "credit-route-model", priority: 3 }
    ]
  };
}

// Fake GitHub adapter — tracks created issues and owner comments in-memory.
// Mirrors the surface that governance.js + actions.js use:
//   createIssue, listIssues, listIssueComments.
function makeFakeGithub() {
  const issues = [];
  const commentsByNumber = new Map();
  let nextNumber = 1;

  return {
    issues,
    commentsByNumber,
    async createIssue(issue) {
      const number = nextNumber++;
      const url = `https://github.com/owner/orbit/issues/${number}`;
      const stored = {
        number,
        title: issue.title,
        body: issue.body,
        labels: Array.isArray(issue.labels) ? issue.labels : [],
        html_url: url,
        url
      };
      issues.push(stored);
      commentsByNumber.set(number, []);
      return stored;
    },
    async listIssues() {
      // Return shallow clones so callers cannot mutate the store accidentally.
      return issues.map((issue) => ({ ...issue }));
    },
    async listIssueComments(issueNumber) {
      const stored = commentsByNumber.get(issueNumber) || [];
      return stored.map((comment) => ({ ...comment }));
    },
    // Test helper — simulate a posted comment from any author.
    _postComment(issueNumber, comment) {
      const list = commentsByNumber.get(issueNumber) || [];
      list.push(comment);
      commentsByNumber.set(issueNumber, list);
    }
  };
}

test("closed-loop demo — happy path: request → approve comment → record", async () => {
  const repoRoot = tempRepo();
  const config = makeConfig(repoRoot);
  const github = makeFakeGithub();

  // ── Cycle 1: agent asks for a refill ───────────────────────────────────────
  const requestResult = await executeTool(config, github, 1, "request_ai_food_refill", {
    amountUsd: 25,
    reason: "monthly AI-budget reserve is low"
  });

  assert.equal(requestResult.status, "blocked_pending_owner_approval");
  assert.equal(requestResult.purchaseProvider, "configured-ai-credit-provider");
  assert.equal(github.issues.length, 1);

  const approvalIssue = github.issues[0];
  assert.match(approvalIssue.title, /^\[orbit approval\] external spend /);
  assert.ok(approvalIssue.labels.includes("orbit:approval"));
  // Body must contain the exact APPROVE command the owner needs to copy.
  assert.match(approvalIssue.body, /APPROVE ORBIT-SPEND [a-f0-9]+/);

  const approvalId = requestResult.approval.id;
  assert.equal(typeof approvalId, "string");
  assert.equal(requestResult.approval.issueNumber, approvalIssue.number);

  // Treasury reflects the pending top-up.
  const treasuryAfterRequest = loadTreasury(repoRoot, config);
  assert.equal(treasuryAfterRequest.ai.pendingTopUps.length, 1);
  assert.equal(treasuryAfterRequest.ai.pendingTopUps[0].approvalId, approvalId);
  assert.equal(treasuryAfterRequest.ai.pendingTopUps[0].amountUsd, 25);
  assert.equal(treasuryAfterRequest.ai.pendingTopUps[0].status, "pending_owner_approval");

  // ── Off-repo: owner buys credits, then posts the approve comment ─────────
  github._postComment(approvalIssue.number, {
    author: "owner",
    body: `APPROVE ORBIT-SPEND ${approvalId}`
  });

  // ── Cycle 2: agent records the refill ────────────────────────────────────
  const proofString = "https://provider.example/receipts/inv-7891 (owner-recorded)";
  const recordResult = await executeTool(config, github, 2, "record_ai_food_refill", {
    amountUsd: 25,
    approvalId,
    proof: proofString
  });

  assert.equal(recordResult.status, "recorded");
  assert.equal(recordResult.entry.approvalId, approvalId);
  assert.equal(recordResult.entry.amountUsd, 25);
  assert.equal(recordResult.entry.proof, proofString);
  assert.equal(recordResult.entry.provider, "configured-ai-credit-provider");

  // Treasury chain: refills grew, providerCredits balance bumped, pending now complete.
  const treasuryAfterRecord = loadTreasury(repoRoot, config);
  assert.equal(treasuryAfterRecord.ai.refills.length, 1);
  assert.equal(treasuryAfterRecord.ai.refills[0].approvalId, approvalId);
  assert.equal(treasuryAfterRecord.ai.refills[0].proof, proofString);
  assert.equal(treasuryAfterRecord.ai.refills[0].amountUsd, 25);

  const credit = treasuryAfterRecord.ai.providerCredits.find(
    (entry) => entry.provider === "configured-ai-credit-provider"
  );
  assert.ok(credit, "configured-ai-credit-provider entry must exist");
  assert.equal(credit.balanceUsd, 25);
  assert.equal(typeof credit.lastRefillAt, "string");

  const completedTopUp = treasuryAfterRecord.ai.pendingTopUps.find(
    (entry) => entry.approvalId === approvalId
  );
  assert.ok(completedTopUp);
  assert.equal(completedTopUp.status, "recorded_complete");
  assert.equal(typeof completedTopUp.completedAt, "string");

  // Approval store reflects the approved decision.
  const approvalsRaw = JSON.parse(
    fs.readFileSync(path.join(repoRoot, "memory", "approvals.json"), "utf-8")
  );
  const approval = approvalsRaw.approvals.find((entry) => entry.id === approvalId);
  assert.ok(approval, "approval entry must exist after record");
  assert.equal(approval.status, "approved");
  assert.equal(approval.issueNumber, approvalIssue.number);
});

test("closed-loop demo — re-requesting before approval is idempotent (one issue, one approval)", async () => {
  const repoRoot = tempRepo();
  const config = makeConfig(repoRoot);
  const github = makeFakeGithub();

  // Identical inputs across both calls — the spend fingerprint hashes
  // (category, asset, amount, recipient, notes) so the reason must match
  // for the second request to dedupe onto the first.
  const refillArgs = { amountUsd: 25, reason: "monthly AI-budget reserve is low" };
  const first = await executeTool(config, github, 1, "request_ai_food_refill", refillArgs);
  const second = await executeTool(config, github, 2, "request_ai_food_refill", refillArgs);

  // Same fingerprint → same approval id.
  assert.equal(first.approval.id, second.approval.id);
  // Only one approval issue should be created.
  assert.equal(github.issues.length, 1);
  // Only one approval row stored.
  const approvalsRaw = JSON.parse(
    fs.readFileSync(path.join(repoRoot, "memory", "approvals.json"), "utf-8")
  );
  assert.equal(approvalsRaw.approvals.length, 1);
  // Only one pending top-up tracked, with the shared approvalId.
  const treasury = loadTreasury(repoRoot, config);
  assert.equal(treasury.ai.pendingTopUps.length, 1);
  assert.equal(treasury.ai.pendingTopUps[0].approvalId, first.approval.id);
});

test("closed-loop demo — non-owner APPROVE comment cannot close the loop", async () => {
  const repoRoot = tempRepo();
  const config = makeConfig(repoRoot);
  const github = makeFakeGithub();

  const requestResult = await executeTool(config, github, 1, "request_ai_food_refill", {
    amountUsd: 25,
    reason: "demo"
  });
  const approvalId = requestResult.approval.id;
  const approvalIssue = github.issues[0];

  // Imposter comments the exact approve line — must be rejected by commentApproves.
  github._postComment(approvalIssue.number, {
    author: "visitor",
    body: `APPROVE ORBIT-SPEND ${approvalId}`
  });

  const recordResult = await executeTool(config, github, 2, "record_ai_food_refill", {
    amountUsd: 25,
    approvalId,
    proof: "https://provider.example/receipts/inv-7892"
  });

  assert.equal(recordResult.status, "blocked_pending_owner_approval");
  assert.equal(recordResult.approvalStatus.status, "pending");

  // Nothing recorded in treasury.
  const treasury = loadTreasury(repoRoot, config);
  assert.equal(treasury.ai.refills.length, 0);
  const credit = treasury.ai.providerCredits.find(
    (entry) => entry.provider === "configured-ai-credit-provider"
  );
  // Default-seeded credit entry has balanceUsd === null until a refill bumps it.
  assert.ok(credit);
  assert.equal(credit.balanceUsd, null);
});

// Patch Set A — gap fixes documented in PLAN/SPECS/CLOSED_LOOP_DEMO.md §9

test("closed-loop demo — record returns status=rejected when owner posted REJECT", async () => {
  const repoRoot = tempRepo();
  const config = makeConfig(repoRoot);
  const github = makeFakeGithub();

  const requestResult = await executeTool(config, github, 1, "request_ai_food_refill", {
    amountUsd: 25,
    reason: "rejection path"
  });
  const approvalId = requestResult.approval.id;
  const approvalIssue = github.issues[0];

  github._postComment(approvalIssue.number, {
    author: "owner",
    body: `REJECT ORBIT-SPEND ${approvalId}`
  });

  const recordResult = await executeTool(config, github, 2, "record_ai_food_refill", {
    amountUsd: 25,
    approvalId,
    proof: "https://provider.example/receipts/rej-1"
  });

  // Gap 1: the public status must distinguish rejected from pending.
  assert.equal(recordResult.status, "rejected");
  assert.equal(recordResult.approvalStatus.status, "rejected");

  // And nothing is written to treasury when rejected.
  const treasury = loadTreasury(repoRoot, config);
  assert.equal(treasury.ai.refills.length, 0);
});

test("closed-loop demo — record is idempotent on duplicate approvalId", async () => {
  const repoRoot = tempRepo();
  const config = makeConfig(repoRoot);
  const github = makeFakeGithub();

  const requestResult = await executeTool(config, github, 1, "request_ai_food_refill", {
    amountUsd: 25,
    reason: "idempotency path"
  });
  const approvalId = requestResult.approval.id;
  const approvalIssue = github.issues[0];

  github._postComment(approvalIssue.number, {
    author: "owner",
    body: `APPROVE ORBIT-SPEND ${approvalId}`
  });

  const proofString = "https://provider.example/receipts/dup-1";
  const first = await executeTool(config, github, 2, "record_ai_food_refill", {
    amountUsd: 25,
    approvalId,
    proof: proofString
  });
  const second = await executeTool(config, github, 3, "record_ai_food_refill", {
    amountUsd: 25,
    approvalId,
    proof: proofString
  });

  assert.equal(first.status, "recorded");
  // Gap 2 + Review B-2: the duplicate call now surfaces as a distinct
  // status so callers don't mistake a dedupe for a fresh record.
  assert.equal(second.status, "already_recorded");
  assert.equal(second.created, false);
  // The entry returned by the dedupe path must still be the original entry
  // (not a stub) so any caller that cares about recordedAt/amount still works.
  assert.equal(first.entry.recordedAt, second.entry.recordedAt);
  assert.equal(second.entry.amountUsd, 25);

  const treasury = loadTreasury(repoRoot, config);
  assert.equal(treasury.ai.refills.length, 1);
  const credit = treasury.ai.providerCredits.find(
    (entry) => entry.provider === "configured-ai-credit-provider"
  );
  assert.equal(credit.balanceUsd, 25);
});

test("closed-loop demo — approval issue body links the configured purchase URL", async () => {
  const repoRoot = tempRepo();
  const baseConfig = makeConfig(repoRoot);
  const config = {
    ...baseConfig,
    aiFoodPurchaseUrl: "https://provider.example/buy-credits"
  };
  const github = makeFakeGithub();

  await executeTool(config, github, 1, "request_ai_food_refill", {
    amountUsd: 25,
    reason: "purchase url path"
  });

  const issue = github.issues[0];
  // Gap 3: owner needs a click-target to the provider in the approval issue.
  assert.match(issue.body, /Purchase URL: https:\/\/provider\.example\/buy-credits/);
});

test("closed-loop demo — record returns status=not_found when approvalId is unknown", async () => {
  const repoRoot = tempRepo();
  const config = makeConfig(repoRoot);
  const github = makeFakeGithub();

  const recordResult = await executeTool(config, github, 1, "record_ai_food_refill", {
    amountUsd: 25,
    approvalId: "never-existed-0xdeadbeef",
    proof: "https://provider.example/receipts/no-approval"
  });

  // Review L3: not_found is its own status, separate from blocked_pending_owner_approval.
  assert.equal(recordResult.status, "not_found");
  assert.equal(recordResult.approvalStatus.status, "not_found");
  assert.equal(recordResult.approval, null);
});

test("closed-loop demo — idempotent record returns created=false and does not redirty treasury", async () => {
  const repoRoot = tempRepo();
  const config = makeConfig(repoRoot);
  const github = makeFakeGithub();

  const requestResult = await executeTool(config, github, 1, "request_ai_food_refill", {
    amountUsd: 25,
    reason: "idempotency created flag"
  });
  const approvalId = requestResult.approval.id;
  github._postComment(github.issues[0].number, {
    author: "owner",
    body: `APPROVE ORBIT-SPEND ${approvalId}`
  });

  const first = await executeTool(config, github, 2, "record_ai_food_refill", {
    amountUsd: 25,
    approvalId,
    proof: "https://provider.example/receipts/created-flag-1"
  });
  const second = await executeTool(config, github, 3, "record_ai_food_refill", {
    amountUsd: 25,
    approvalId,
    proof: "https://provider.example/receipts/created-flag-1"
  });

  // Review L1: first call creates, second is the dedup branch.
  assert.equal(first.created, true);
  assert.equal(second.created, false);
  // Treasury still has exactly one refill entry and one balance bump.
  const treasury = loadTreasury(repoRoot, config);
  assert.equal(treasury.ai.refills.length, 1);
  const credit = treasury.ai.providerCredits.find(
    (entry) => entry.provider === "configured-ai-credit-provider"
  );
  assert.equal(credit.balanceUsd, 25);
  // Review L2: the approvalId is mirrored into the long-lived dedupe ring.
  assert.ok(Array.isArray(treasury.ai.recordedRefillIds));
  assert.ok(treasury.ai.recordedRefillIds.includes(approvalId));
});

test("closed-loop demo — approval issue body omits the URL row when none configured", async () => {
  const repoRoot = tempRepo();
  const config = makeConfig(repoRoot); // no aiFoodPurchaseUrl
  const github = makeFakeGithub();

  await executeTool(config, github, 1, "request_ai_food_refill", {
    amountUsd: 25,
    reason: "no purchase url path"
  });

  const issue = github.issues[0];
  // No URL row should be emitted at all when nothing is configured — the
  // owner shouldn't see a "Purchase URL: " row with empty content.
  assert.doesNotMatch(issue.body, /Purchase URL:/);
});
