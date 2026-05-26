"use strict";

// wallet.js exposes the public, normalized view of governance.json +
// treasury.json. Everything that asks "is the wallet allowed to do X?"
// reads from summarizeWallet, so the defaults are load-bearing —
// especially approvalMode and launchStatus.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  GOVERNANCE_PATH,
  TREASURY_PATH,
  loadWallet,
  summarizeWallet,
  walletStatus
} = require("../src/agent/wallet");

function tempRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "orbit-wallet-test-"));
  fs.mkdirSync(path.join(dir, "memory"), { recursive: true });
  return dir;
}

function writeJson(repoRoot, rel, value) {
  fs.writeFileSync(path.join(repoRoot, rel), JSON.stringify(value, null, 2));
}

test("loadWallet returns empty objects when files are missing", () => {
  const repoRoot = tempRepo();
  const wallet = loadWallet(repoRoot);
  assert.deepEqual(wallet, { governance: {}, treasury: {} });
});

test("loadWallet returns empty objects when files contain malformed JSON", () => {
  const repoRoot = tempRepo();
  fs.writeFileSync(path.join(repoRoot, GOVERNANCE_PATH), "{ not valid json");
  fs.writeFileSync(path.join(repoRoot, TREASURY_PATH), "also bad");
  const wallet = loadWallet(repoRoot);
  // Defensive parse must not throw — a corrupt file should degrade to
  // empty, not crash the cycle.
  assert.deepEqual(wallet, { governance: {}, treasury: {} });
});

test("summarizeWallet defaults to owner_approval_required when nothing is configured", () => {
  // The fail-safe default — if governance.json is empty or unset, the
  // wallet must NOT be permissive. This is D-014.
  const summary = summarizeWallet({});
  assert.equal(summary.approvalMode, "owner_approval_required");
  assert.equal(summary.allowedWithoutApproval.length, 0);
  assert.equal(summary.token.launchStatus, "unknown");
  assert.equal(summary.token.configured, false);
  assert.equal(summary.revenue.canClaim, false);
  assert.equal(summary.aiBudget.liveApiPurchase, false);
});

test("summarizeWallet normalizes non-object fields to safe defaults", () => {
  // If governance is a string or treasury is null, summarizeWallet must
  // still return a fully-shaped object, not propagate the bad type.
  const summary = summarizeWallet({ governance: "bogus", treasury: null });
  assert.equal(summary.approvalMode, "owner_approval_required");
  assert.equal(summary.token.launchStatus, "unknown");
  assert.equal(Array.isArray(summary.allowedWithoutApproval), true);
});

test("summarizeWallet propagates token launch state when populated", () => {
  const summary = summarizeWallet({
    treasury: {
      token: {
        name: "Orbit",
        symbol: "ORBIT",
        launchStatus: "launched",
        launchedAt: "2026-06-01T00:00:00Z"
      }
    }
  });
  assert.equal(summary.token.launchStatus, "launched");
  assert.equal(summary.token.configured, true);
  assert.equal(summary.token.launchedAt, "2026-06-01T00:00:00Z");
});

test("summarizeWallet revenue.canClaim requires an on-chain txHash", () => {
  // A pending claim ≠ canClaim. Only a recorded txHash flips this true.
  const pendingSummary = summarizeWallet({
    treasury: {
      revenue: { lastClaimAttemptAt: "2026-06-01T00:00:00Z" }
    }
  });
  assert.equal(pendingSummary.revenue.canClaim, false);

  const claimedSummary = summarizeWallet({
    treasury: {
      revenue: { lastClaimResult: { txHash: "0xabc" } }
    }
  });
  assert.equal(claimedSummary.revenue.canClaim, true);
});

test("summarizeWallet exposes the immutable blockedLiveActions list", () => {
  // This list is the wallet's promise to itself: these actions are
  // never enabled by configuration. The shape must not drift.
  const summary = summarizeWallet({});
  for (const expected of [
    "wallet spending", "external payments", "signing",
    "token launch", "reward claims", "payout-route changes"
  ]) {
    assert.ok(
      summary.blockedLiveActions.includes(expected),
      `blockedLiveActions must include "${expected}"`
    );
  }
});

test("walletStatus returns canonical paths next to live data", () => {
  const repoRoot = tempRepo();
  writeJson(repoRoot, GOVERNANCE_PATH, { externalSpend: { mode: "owner_approval_required" } });
  writeJson(repoRoot, TREASURY_PATH, { token: { name: "Orbit", symbol: "ORBIT" } });
  const status = walletStatus(repoRoot);
  assert.deepEqual(status.paths, [GOVERNANCE_PATH, TREASURY_PATH]);
  assert.equal(status.summary.token.symbol, "ORBIT");
  assert.equal(status.summary.approvalMode, "owner_approval_required");
});
