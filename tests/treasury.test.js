"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { loadConfig } = require("../src/agent/config");
const { buildTokenConfig, launchNativeToken, prepareClankerLaunch, rewardSplit, runRevenueCycle } = require("../src/agent/clanker");
const {
  budgetStatus,
  loadTreasury,
  recordAiUsage,
  revenueClaimStatus,
  revenuePerformanceStatus,
  saveTreasury,
  syncRevenuePolicy
} = require("../src/agent/treasury");

const ADMIN = "0x1111111111111111111111111111111111111111";
const TREASURY = "0x2222222222222222222222222222222222222222";
const OPERATOR = "0x3333333333333333333333333333333333333333";
const PRIVATE_ROUTE_BPS = 1234;
const RESERVE_BPS = 10000 - PRIVATE_ROUTE_BPS;

function tempRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "orbit-treasury-test-"));
  fs.mkdirSync(path.join(dir, "memory"), { recursive: true });
  return dir;
}

function config(overrides = {}) {
  return {
    ...loadConfig({
      ORBIT_TOKEN_ADMIN_ADDRESS: ADMIN,
      ORBIT_TREASURY_ADDRESS: TREASURY,
      ORBIT_OPERATOR_REVENUE_ADDRESS: OPERATOR,
      ORBIT_OPERATOR_REVENUE_BPS: String(PRIVATE_ROUTE_BPS)
    }),
    repoRoot: tempRepo(),
    ...overrides
  };
}

function writeCycles(repoRoot, cycles) {
  fs.writeFileSync(
    path.join(repoRoot, "memory", "cycles.jsonl"),
    cycles.map((cycle) => JSON.stringify(cycle)).join("\n") + "\n",
    "utf-8"
  );
}

function cycle(number, daysAgo, filesChanged, result = "completed useful work") {
  return {
    cycle: number,
    timestamp: new Date(Date.now() - (daysAgo * 86_400_000)).toISOString(),
    dryRun: false,
    filesChanged,
    result
  };
}

test("builds configured paired-token reward split", () => {
  const cfg = config();
  const token = buildTokenConfig(cfg, 7);

  assert.deepEqual(rewardSplit(cfg), { operatorBps: PRIVATE_ROUTE_BPS, treasuryBps: RESERVE_BPS });
  assert.equal(token.rewards.recipients[0].recipient, OPERATOR);
  assert.equal(token.rewards.recipients[0].bps, PRIVATE_ROUTE_BPS);
  assert.equal(token.rewards.recipients[0].token, "Paired");
  assert.equal(token.rewards.recipients[1].recipient, TREASURY);
  assert.equal(token.rewards.recipients[1].bps, RESERVE_BPS);
  assert.equal(token.context.messageId, "orbit-cycle-7");
});

test("prepares launch but reports missing signer configuration", () => {
  const prepared = prepareClankerLaunch(config(), 1);

  assert.equal(prepared.readyToSign, false);
  assert.equal(prepared.launchEnabled, false);
  assert.ok(prepared.missing.includes("ORBIT_WALLET_PRIVATE_KEY"));
  assert.equal(prepared.revenuePolicy.operatorSharePct, PRIVATE_ROUTE_BPS / 100);
});

test("records AI spend and enforces daily budget status", () => {
  const cfg = config({
    aiDailyBudgetUsd: 0.01,
    aiMonthlyBudgetUsd: 1,
    aiInputUsdPerMillion: 1,
    aiOutputUsdPerMillion: 1
  });

  recordAiUsage(
    cfg,
    cfg.repoRoot,
    { prompt_tokens: 5000, completion_tokens: 6000, total_tokens: 11000 },
    "private-ai-route-1",
    "unit test"
  );

  const status = budgetStatus(cfg);
  assert.equal(status.spentTodayUsd, 0.011);
  assert.equal(status.canUseAi, false);
});

test("treasury writer rejects symlinked store path", () => {
  const repoRoot = tempRepo();
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), "orbit-treasury-outside-"));
  const cfg = config({ repoRoot });
  const linkPath = path.join(repoRoot, "memory", "treasury.json");

  try {
    fs.symlinkSync(path.join(outside, "treasury.json"), linkPath);

    assert.throws(
      () => saveTreasury(repoRoot, loadTreasury(repoRoot, cfg)),
      /symbolic links/
    );
    assert.equal(fs.existsSync(path.join(outside, "treasury.json")), false);
  } finally {
    fs.rmSync(repoRoot, { recursive: true, force: true });
    fs.rmSync(outside, { recursive: true, force: true });
  }
});

test("native token launch is skipped once a launched token is recorded", async () => {
  const cfg = config({
    enableTokenLaunch: true
  });
  const treasury = loadTreasury(cfg.repoRoot, cfg);
  treasury.token.launchStatus = "launched";
  treasury.token.address = "0x4444444444444444444444444444444444444444";
  treasury.token.txHash = "0xabc";
  saveTreasury(cfg.repoRoot, treasury);

  const result = await launchNativeToken(cfg, 9, { preLaunchVerified: true });

  assert.equal(result.status, "already_launched");
  assert.equal(result.address, "0x4444444444444444444444444444444444444444");
  assert.equal(result.txHash, "0xabc");
});

test("revenue policy syncs to weekly performance cadence", () => {
  const cfg = config();
  const treasury = syncRevenuePolicy(cfg);

  assert.equal(treasury.revenue.cadence, "weekly_performance");
  assert.equal(treasury.revenue.claimIntervalDays, 7);
  assert.equal(treasury.revenue.performanceWindowDays, 7);
  assert.equal(treasury.revenue.minCompletedCycles, 3);
  assert.equal(treasury.revenue.minProductiveCycles, 1);
  assert.equal(treasury.revenue.minProductiveRatio, 0.25);
});

test("revenue performance requires enough recent productive cycles", () => {
  const cfg = config({
    revenueMinCompletedCycles: 3,
    revenueMinProductiveCycles: 2,
    revenueMinProductiveRatio: 0.5
  });
  writeCycles(cfg.repoRoot, [
    cycle(1, 1, ["memory/state.json"], "Action taken: none"),
    cycle(2, 1, ["docs/service.md"], "created a useful artifact"),
    cycle(3, 1, ["runtime/proofs/proof.json"], "proof only")
  ]);

  const status = revenuePerformanceStatus(cfg);

  assert.equal(status.completedCycles, 3);
  assert.equal(status.productiveCycles, 1);
  assert.equal(status.passed, false);
  assert.ok(status.reasons.includes("not_enough_productive_cycles"));
});

test("revenue performance ignores routine treasury-only accounting cycles", () => {
  const cfg = config({
    revenueMinCompletedCycles: 1,
    revenueMinProductiveCycles: 1,
    revenueMinProductiveRatio: 0.5
  });
  writeCycles(cfg.repoRoot, [
    cycle(1, 1, ["memory/treasury.json", "memory/state.json"], "recorded accounting only")
  ]);

  const status = revenuePerformanceStatus(cfg);

  assert.equal(status.completedCycles, 1);
  assert.equal(status.productiveCycles, 0);
  assert.equal(status.passed, false);
});

test("revenue claim is blocked until weekly cadence passes", () => {
  const cfg = config({
    revenueMinCompletedCycles: 1,
    revenueMinProductiveCycles: 1,
    revenueMinProductiveRatio: 0.5
  });
  writeCycles(cfg.repoRoot, [
    cycle(1, 1, ["docs/service.md"], "created a useful artifact")
  ]);
  const treasury = loadTreasury(cfg.repoRoot, cfg);
  treasury.revenue.lastClaimSentAt = new Date(Date.now() - (2 * 86_400_000)).toISOString();
  saveTreasury(cfg.repoRoot, treasury);

  const status = revenueClaimStatus(cfg);

  assert.equal(status.canClaim, false);
  assert.equal(status.cadence, "weekly_performance");
  assert.ok(status.reasons.includes("weekly_cadence_not_ready"));
  assert.ok(status.nextEligibleAt);
});

test("revenue claim dry run only queues after weekly and performance gates pass", async () => {
  const cfg = config({
    revenueMinCompletedCycles: 1,
    revenueMinProductiveCycles: 1,
    revenueMinProductiveRatio: 0.5,
    enableRevenueClaims: false
  });
  writeCycles(cfg.repoRoot, [
    cycle(1, 1, ["docs/service.md"], "created a useful artifact")
  ]);
  const treasury = loadTreasury(cfg.repoRoot, cfg);
  treasury.token.address = "0x4444444444444444444444444444444444444444";
  treasury.revenue.lastClaimSentAt = new Date(Date.now() - (8 * 86_400_000)).toISOString();
  saveTreasury(cfg.repoRoot, treasury);

  const result = await runRevenueCycle(cfg, { preLaunchVerified: true });

  assert.equal(result.status, "dry_run");
  assert.equal(result.claimStatus.canClaim, true);
});
