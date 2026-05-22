"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { loadConfig } = require("../src/agent/config");
const { buildTokenConfig, launchNativeToken, prepareClankerLaunch, rewardSplit } = require("../src/agent/clanker");
const { budgetStatus, loadTreasury, recordAiUsage, saveTreasury } = require("../src/agent/treasury");

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
    "test-model",
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

  const result = await launchNativeToken(cfg, 9);

  assert.equal(result.status, "already_launched");
  assert.equal(result.address, "0x4444444444444444444444444444444444444444");
  assert.equal(result.txHash, "0xabc");
});
