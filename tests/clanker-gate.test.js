"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { launchNativeToken, runRevenueCycle } = require("../src/agent/clanker");

function tempRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "orbit-clanker-gate-test-"));
  fs.mkdirSync(path.join(dir, "memory"), { recursive: true });
  return dir;
}

// Config with launches/revenue disabled. preLaunchVerified must be supplied
// via state — these tests intentionally never set ORBIT_ENABLE_TOKEN_LAUNCH or
// ORBIT_ENABLE_REVENUE_CLAIMS so the function returns at the dry-run branch if
// the D-018 gate is opened, never reaching the live Clanker SDK.
function baseConfig(repoRoot) {
  return {
    repoRoot,
    enableTokenLaunch: false,
    enableRevenueClaims: false,
    treasuryAddress: "0x2222222222222222222222222222222222222222",
    operatorRevenueAddress: "0x3333333333333333333333333333333333333333",
    tokenAdminAddress: "0x4444444444444444444444444444444444444444",
    tokenName: "Orbit",
    tokenSymbol: "ORBIT",
    tokenDescription: "Orbit native token",
    operatorRevenueBps: 5000,
    vaultPercentage: 10,
    vaultLockupDays: 30,
    vaultVestingDays: 30,
    devBuyEth: 0,
    walletPrivateKey: "",
    baseRpcUrl: ""
  };
}

const BLOCKED_REASON = "state.preLaunchVerified is not true (D-018 pre-launch gate)";

test("launchNativeToken blocks when state.preLaunchVerified is missing", async () => {
  const result = await launchNativeToken(baseConfig(tempRepo()), 0, {});
  assert.equal(result.status, "blocked");
  assert.equal(result.ok, false);
  assert.equal(result.blocked, true);
  assert.equal(result.reason, BLOCKED_REASON);
  // No treasury file should be written under blocked path.
  assert.equal(result.address, undefined);
});

test("launchNativeToken blocks for non-boolean truthy preLaunchVerified", async () => {
  const config = baseConfig(tempRepo());

  for (const value of ["true", 1, "yes", { ok: true }]) {
    const result = await launchNativeToken(config, 0, { preLaunchVerified: value });
    assert.equal(result.status, "blocked", `value ${JSON.stringify(value)} should block`);
    assert.equal(result.blocked, true);
    assert.equal(result.reason, BLOCKED_REASON);
  }

  const explicitlyFalse = await launchNativeToken(config, 0, { preLaunchVerified: false });
  assert.equal(explicitlyFalse.status, "blocked");
});

test("launchNativeToken passes D-018 gate when verified, then falls into dry_run because launches are disabled", async () => {
  const result = await launchNativeToken(baseConfig(tempRepo()), 0, { preLaunchVerified: true });
  assert.equal(result.status, "dry_run");
  assert.ok(result.prepared, "dry_run response includes a prepared payload");
  assert.equal(result.prepared.launchEnabled, false);
  assert.equal(result.prepared.dryRun, true);
  assert.equal(result.blocked, undefined);
  assert.equal(result.reason, undefined);
});

test("runRevenueCycle blocks when state.preLaunchVerified is missing", async () => {
  const result = await runRevenueCycle(baseConfig(tempRepo()), {});
  assert.equal(result.status, "blocked");
  assert.equal(result.ok, false);
  assert.equal(result.blocked, true);
  assert.equal(result.reason, BLOCKED_REASON);
});

test("runRevenueCycle blocks for non-boolean truthy preLaunchVerified", async () => {
  const config = baseConfig(tempRepo());

  for (const value of ["true", 1, null, undefined]) {
    const result = await runRevenueCycle(config, { preLaunchVerified: value });
    assert.equal(result.status, "blocked", `value ${JSON.stringify(value)} should block`);
    assert.equal(result.blocked, true);
  }
});

test("runRevenueCycle passes D-018 gate when verified, then short-circuits at no_token because no launch is recorded", async () => {
  // With preLaunchVerified=true the function proceeds past the gate, then
  // returns "no_token" because the fresh treasury file has no token address
  // recorded — long before any live Clanker SDK call.
  //
  // S-FLOOR-1: we also need the weekly fee-floor gate to pass, which means
  // (a) the boundary check is due (feeFloor=null => first-ever => true) and
  // (b) weekly inflow >= floor (default 0.1 ETH). We give the state a
  // synthetic observed Fee Receive balance of exactly 0.1 ETH and no
  // weekStartBalance, so the inflow is 0.1 ETH which clears the floor.
  const state = {
    preLaunchVerified: true,
    treasurySweep: {
      lastObservedFeeReceiveBalanceWei: "100000000000000000"
    }
  };
  const result = await runRevenueCycle(baseConfig(tempRepo()), state);
  assert.equal(result.status, "no_token");
  assert.equal(result.blocked, undefined);
  assert.equal(result.reason, undefined);
  assert.ok(result.claimStatus, "no_token response includes claimStatus");
});
