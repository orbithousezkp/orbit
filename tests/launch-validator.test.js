"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  DEFAULT_MAX_DEV_BUY_BPS_OF_BALANCE,
  DEFAULT_MIN_GAS_BALANCE_WEI,
  DEFAULT_MIN_TOTAL_FEE_BPS,
  LAUNCH_NETWORKS,
  loadValidatorConfig,
  renderValidationReport,
  validateFeeFloorReady,
  validateLaunchReady,
  validateNetwork,
  validateSafesReachable,
  validateTokenConfig,
  validateWalletState
} = require("../src/agent/launch-validator");

// Address vectors reused from tests/safes.test.js. All-uppercase / all-
// lowercase hex bodies are accepted as uncheck­summed per EIP-55, so we can
// build well-formed test fixtures without re-deriving checksums.
const ADDR_A = "0xFEE0000000000000000000000000000000000FEE"; // all-upper hex letters
const ADDR_B = "0xF1001110000000000000000000000000000000F1";
const ADDR_C = "0xF2002220000000000000000000000000000000F2";
const ADDR_D = "0xF3003330000000000000000000000000000000F3";
const ADDR_E = "0xF4004440000000000000000000000000000000F4";
const ADDR_F = "0xF5005550000000000000000000000000000000F5";
const ADDR_G = "0xF6006660000000000000000000000000000000F6";
// Mixed-case bad EIP-55 vector (same as safes.test.js bad_checksum vector).
const BAD_CHECKSUM = "0xFB6916095ca1df60bB79Ce92cE3Ea74c37c5d359";

const VALID_SAFE_ENV = {
  ORBIT_TREASURY_SAFE:         ADDR_A,
  ORBIT_FLOOR_RESERVE_SAFE:    ADDR_B,
  ORBIT_PRODUCTIVE_YIELD_SAFE: ADDR_C,
  ORBIT_BUYBACK_SAFE:          ADDR_D,
  ORBIT_GROWTH_SAFE:           ADDR_E,
  ORBIT_AI_COSTS_SAFE:         ADDR_F,
  ORBIT_OPS_RUNWAY_SAFE:       ADDR_G
};

const { loadSafes } = require("../src/agent/safes");

function happyTokenConfig() {
  return {
    name: "Orbit",
    symbol: "ORBIT",
    totalSupply: "1000000000000000000000000",
    tokenAdmin: ADDR_A,
    pairedToken: ADDR_B,
    rewardRecipients: [
      { recipient: ADDR_C, bps: 9500, admin: ADDR_A, token: "Paired" },
      { recipient: ADDR_D, bps:  500, admin: ADDR_A, token: "Paired" }
    ]
  };
}

// ---------------------------------------------------------------------------
// loadValidatorConfig
// ---------------------------------------------------------------------------

test("loadValidatorConfig returns defaults when env is empty", () => {
  const cfg = loadValidatorConfig({});
  assert.equal(cfg.network, "base");
  assert.equal(cfg.minGasBalanceWei, BigInt(DEFAULT_MIN_GAS_BALANCE_WEI));
  assert.equal(cfg.maxDevBuyBpsOfBalance, DEFAULT_MAX_DEV_BUY_BPS_OF_BALANCE);
  assert.equal(cfg.expectedFeeSum, DEFAULT_MIN_TOTAL_FEE_BPS);
  assert.deepEqual(LAUNCH_NETWORKS, ["base", "base-sepolia"]);
});

test("loadValidatorConfig accepts base-sepolia network override", () => {
  const cfg = loadValidatorConfig({ ORBIT_LAUNCH_NETWORK: "base-sepolia" });
  assert.equal(cfg.network, "base-sepolia");
});

test("loadValidatorConfig throws on an unsupported network", () => {
  assert.throws(
    () => loadValidatorConfig({ ORBIT_LAUNCH_NETWORK: "ethereum" }),
    /ORBIT_LAUNCH_NETWORK/
  );
});

test("loadValidatorConfig throws on a non-numeric min gas balance", () => {
  assert.throws(
    () => loadValidatorConfig({ ORBIT_LAUNCH_MIN_GAS_BALANCE_WEI: "not-a-number" }),
    /ORBIT_LAUNCH_MIN_GAS_BALANCE_WEI/
  );
});

test("loadValidatorConfig throws when maxDevBuyBpsOfBalance > 10000", () => {
  assert.throws(
    () => loadValidatorConfig({ ORBIT_LAUNCH_MAX_DEV_BUY_BPS_OF_BALANCE: "10001" }),
    /ORBIT_LAUNCH_MAX_DEV_BUY_BPS_OF_BALANCE/
  );
});

// ---------------------------------------------------------------------------
// validateNetwork
// ---------------------------------------------------------------------------

test("validateNetwork maps base -> chainId 8453", () => {
  const r = validateNetwork("base");
  assert.equal(r.ok, true);
  assert.equal(r.chainId, 8453);
});

test("validateNetwork maps base-sepolia -> chainId 84532", () => {
  const r = validateNetwork("base-sepolia");
  assert.equal(r.ok, true);
  assert.equal(r.chainId, 84532);
});

test("validateNetwork rejects unknown networks", () => {
  const r = validateNetwork("ethereum");
  assert.equal(r.ok, false);
  assert.equal(r.chainId, null);
});

// ---------------------------------------------------------------------------
// validateTokenConfig
// ---------------------------------------------------------------------------

test("validateTokenConfig accepts a well-formed config with bps summing to 10000", () => {
  const r = validateTokenConfig(happyTokenConfig());
  assert.equal(r.ok, true, JSON.stringify(r.issues));
  assert.equal(r.issues.length, 0);
  assert.equal(r.summary.rewardRecipientCount, 2);
  assert.equal(r.summary.feeSumBps, 10000);
  assert.equal(r.summary.tokenAdminChecksumOk, true);
  assert.equal(r.summary.pairedTokenChecksumOk, true);
});

test("validateTokenConfig flags a missing name as error", () => {
  const cfg = happyTokenConfig();
  delete cfg.name;
  const r = validateTokenConfig(cfg);
  assert.equal(r.ok, false);
  assert.ok(r.issues.some((i) => i.field === "name" && i.severity === "error"));
});

test("validateTokenConfig flags a symbol that is too short", () => {
  const cfg = happyTokenConfig();
  cfg.symbol = "OO";
  const r = validateTokenConfig(cfg);
  assert.equal(r.ok, false);
  assert.ok(r.issues.some((i) => i.field === "symbol" && /3-10/.test(i.reason)));
});

test("validateTokenConfig flags a symbol that is too long", () => {
  const cfg = happyTokenConfig();
  cfg.symbol = "ORBITORBITX"; // 11 chars
  const r = validateTokenConfig(cfg);
  assert.equal(r.ok, false);
  assert.ok(r.issues.some((i) => i.field === "symbol" && /3-10/.test(i.reason)));
});

test("validateTokenConfig flags rewardRecipients that is not an array", () => {
  const cfg = happyTokenConfig();
  cfg.rewardRecipients = "not-an-array";
  const r = validateTokenConfig(cfg);
  assert.equal(r.ok, false);
  assert.ok(r.issues.some((i) => i.field === "rewardRecipients" && /array/.test(i.reason)));
});

test("validateTokenConfig flags bps that don't sum to 10000 and reports the actual sum", () => {
  const cfg = happyTokenConfig();
  cfg.rewardRecipients = [
    { recipient: ADDR_C, bps: 9000, admin: ADDR_A, token: "Paired" },
    { recipient: ADDR_D, bps:  500, admin: ADDR_A, token: "Paired" }
  ];
  const r = validateTokenConfig(cfg);
  assert.equal(r.ok, false);
  const sumIssue = r.issues.find((i) => i.field === "rewardRecipients[].bps");
  assert.ok(sumIssue, "expected sum issue");
  assert.match(sumIssue.reason, /9500/);
  assert.equal(r.summary.feeSumBps, 9500);
});

test("validateTokenConfig flags a rewardRecipient with bad EIP-55 mixed-case checksum", () => {
  const cfg = happyTokenConfig();
  cfg.rewardRecipients[0].recipient = BAD_CHECKSUM;
  const r = validateTokenConfig(cfg);
  assert.equal(r.ok, false);
  assert.ok(r.issues.some(
    (i) => i.field === "rewardRecipients[0].recipient" && /EIP-55/.test(i.reason)
  ));
});

test("validateTokenConfig flags a missing tokenAdmin", () => {
  const cfg = happyTokenConfig();
  delete cfg.tokenAdmin;
  const r = validateTokenConfig(cfg);
  assert.equal(r.ok, false);
  assert.ok(r.issues.some((i) => i.field === "tokenAdmin"));
  assert.equal(r.summary.tokenAdminChecksumOk, false);
});

test("validateTokenConfig flags a zero totalSupply", () => {
  const cfg = happyTokenConfig();
  cfg.totalSupply = "0";
  const r = validateTokenConfig(cfg);
  assert.equal(r.ok, false);
  assert.ok(r.issues.some((i) => i.field === "totalSupply" && /> 0/.test(i.reason)));
});

test("validateTokenConfig flags a negative totalSupply", () => {
  const cfg = happyTokenConfig();
  cfg.totalSupply = "-1";
  const r = validateTokenConfig(cfg);
  assert.equal(r.ok, false);
  assert.ok(r.issues.some((i) => i.field === "totalSupply"));
});

test("validateTokenConfig accepts a config that uses rewards.recipients (Clanker v4 shape)", () => {
  const cfg = happyTokenConfig();
  cfg.rewards = { recipients: cfg.rewardRecipients };
  delete cfg.rewardRecipients;
  const r = validateTokenConfig(cfg);
  assert.equal(r.ok, true, JSON.stringify(r.issues));
  assert.equal(r.summary.rewardRecipientCount, 2);
});

// ---------------------------------------------------------------------------
// validateWalletState
// ---------------------------------------------------------------------------

test("validateWalletState passes when balance > devBuy + minGas", () => {
  const cfg = loadValidatorConfig({});
  // balance = 1 ETH; devBuy = 0.1 ETH; minGas = 0.01 ETH; headroom = 0.89 ETH
  const r = validateWalletState(
    { address: ADDR_A, balanceWei: "1000000000000000000" },
    "100000000000000000",
    cfg
  );
  assert.equal(r.ok, true, JSON.stringify(r.issues));
  assert.equal(BigInt(r.headroomWei) > 0n, true);
  // 100000000000000000 / 1000000000000000000 = 1000 bps
  assert.equal(r.devBuyBpsOfBalance, 1000);
});

test("validateWalletState fails when balance < devBuy + minGas and reports negative headroom", () => {
  const cfg = loadValidatorConfig({});
  // balance = 0.05 ETH; devBuy = 0.1 ETH; minGas = 0.01 ETH; short 0.06 ETH
  const r = validateWalletState(
    { address: ADDR_A, balanceWei: "50000000000000000" },
    "100000000000000000",
    cfg
  );
  assert.equal(r.ok, false);
  assert.equal(BigInt(r.headroomWei) < 0n, true);
  assert.ok(r.issues.some((i) => /balance/.test(i.reason) && /headroom/.test(i.reason)));
});

test("validateWalletState fails when devBuy exceeds maxDevBuyBpsOfBalance", () => {
  // Default cap = 5000 bps. balance = 1 ETH, devBuy = 0.6 ETH = 6000 bps.
  const cfg = loadValidatorConfig({});
  const r = validateWalletState(
    { address: ADDR_A, balanceWei: "1000000000000000000" },
    "600000000000000000",
    cfg
  );
  assert.equal(r.ok, false);
  assert.ok(r.issues.some((i) => i.field === "devBuyWei" && /bps/.test(i.reason)));
  assert.ok(r.devBuyBpsOfBalance > 5000);
});

test("validateWalletState passes with devBuy=0 (no spend, only gas needed)", () => {
  const cfg = loadValidatorConfig({});
  const r = validateWalletState(
    { address: ADDR_A, balanceWei: DEFAULT_MIN_GAS_BALANCE_WEI },
    "0",
    cfg
  );
  assert.equal(r.ok, true, JSON.stringify(r.issues));
  assert.equal(r.devBuyBpsOfBalance, 0);
});

// ---------------------------------------------------------------------------
// validateSafesReachable
// ---------------------------------------------------------------------------

test("validateSafesReachable passes with all 7 valid Safes", () => {
  const safesResult = loadSafes(VALID_SAFE_ENV);
  assert.equal(safesResult.ok, true);
  const r = validateSafesReachable(safesResult);
  assert.equal(r.ok, true, JSON.stringify(r.issues));
  assert.equal(r.categoryCounts.treasury, 2);
  assert.equal(r.categoryCounts.business, 2);
  assert.equal(r.categoryCounts.operations, 2);
});

test("validateSafesReachable fails when one Safe is missing", () => {
  const env = { ...VALID_SAFE_ENV };
  delete env.ORBIT_AI_COSTS_SAFE;
  const r = validateSafesReachable(loadSafes(env));
  assert.equal(r.ok, false);
  assert.ok(r.issues.some((i) => /missing/.test(i.reason) && /ai-costs/.test(i.reason)));
});

test("validateSafesReachable fails when two Safes share an address (duplicate)", () => {
  const env = { ...VALID_SAFE_ENV, ORBIT_BUYBACK_SAFE: VALID_SAFE_ENV.ORBIT_GROWTH_SAFE };
  const r = validateSafesReachable(loadSafes(env));
  assert.equal(r.ok, false);
  // Either the duplicate issue OR the upstream conflict issue must surface.
  assert.ok(r.issues.some((i) => /duplicate|conflict|reused/i.test(i.reason)));
});

// ---------------------------------------------------------------------------
// validateFeeFloorReady
// ---------------------------------------------------------------------------

test("validateFeeFloorReady passes on a fresh treasury + state", () => {
  const treasury = { revenue: {}, token: { launchStatus: "not_launched" } };
  const state = { launchOnceFired: false };
  const r = validateFeeFloorReady(treasury, state);
  assert.equal(r.ok, true, JSON.stringify(r.issues));
  assert.equal(r.currentLaunchStatus, "not_launched");
  assert.equal(r.launchOnceFired, false);
});

test("validateFeeFloorReady fails when treasury.token.launchStatus === 'launched'", () => {
  const treasury = { revenue: {}, token: { launchStatus: "launched", address: ADDR_A } };
  const state = { launchOnceFired: false };
  const r = validateFeeFloorReady(treasury, state);
  assert.equal(r.ok, false);
  assert.ok(r.issues.some((i) => i.field === "treasury.token.launchStatus"));
});

test("validateFeeFloorReady fails when state.launchOnceFired === true", () => {
  const treasury = { revenue: {}, token: { launchStatus: "not_launched" } };
  const state = { launchOnceFired: true };
  const r = validateFeeFloorReady(treasury, state);
  assert.equal(r.ok, false);
  assert.ok(r.issues.some((i) => i.field === "state.launchOnceFired"));
});

// ---------------------------------------------------------------------------
// validateLaunchReady — aggregate
// ---------------------------------------------------------------------------

function happyInputs() {
  return {
    tokenConfig: happyTokenConfig(),
    walletState: { address: ADDR_A, balanceWei: "1000000000000000000" },
    devBuyWei: "100000000000000000",
    safesResult: loadSafes(VALID_SAFE_ENV),
    treasury: { revenue: {}, token: { launchStatus: "not_launched" } },
    state: { launchOnceFired: false }
  };
}

test("validateLaunchReady returns ok:true / exit 0 when all inputs are valid", () => {
  const r = validateLaunchReady(happyInputs(), {});
  assert.equal(r.ok, true, JSON.stringify(r.allIssues));
  assert.equal(r.exitCode, 0);
  assert.match(r.summary, /^PASS: /);
});

test("validateLaunchReady returns ok:false / exit 1 when a sub-validator fails", () => {
  const inputs = happyInputs();
  inputs.tokenConfig.rewardRecipients[0].bps = 1; // sum becomes 501
  const r = validateLaunchReady(inputs, {});
  assert.equal(r.ok, false);
  assert.equal(r.exitCode, 1);
  assert.match(r.summary, /^FAIL: /);
  assert.ok(r.allIssues.some(
    (i) => i.source === "tokenConfig" && /sum/.test(i.reason)
  ));
});

test("validateLaunchReady catches a thrown sub-validator and surfaces it as an issue while running the others", () => {
  // Force validateSafesReachable to throw by passing a safesResult whose
  // .safes is a Proxy that throws on iteration. We achieve the same with a
  // getter that throws.
  const inputs = happyInputs();
  inputs.safesResult = {
    ok: true,
    safes: new Proxy([], {
      get() { throw new Error("synthetic safes failure"); }
    }),
    missing: [],
    conflicts: []
  };
  const r = validateLaunchReady(inputs, {});
  assert.equal(r.ok, false);
  // The safes sub-validator threw — its issue should appear with the
  // synthetic message.
  assert.ok(r.allIssues.some(
    (i) => i.source === "safes" && /synthetic safes failure/.test(i.reason)
  ));
  // The other validators still ran — tokenConfig was valid so it should
  // have no issues.
  assert.ok(!r.allIssues.some((i) => i.source === "tokenConfig"));
});

// ---------------------------------------------------------------------------
// renderValidationReport
// ---------------------------------------------------------------------------

test("renderValidationReport produces a multi-line string with PASS markers and summary", () => {
  const r = validateLaunchReady(happyInputs(), {});
  const out = renderValidationReport(r);
  assert.ok(out.includes("\n"));
  assert.ok(out.includes("[PASS] network"));
  assert.ok(out.includes("[PASS] tokenConfig"));
  assert.ok(out.includes("PASS:"));
  assert.ok(out.includes("exit 0"));
});

test("renderValidationReport contains no emoji or non-ASCII glyphs", () => {
  const inputs = happyInputs();
  inputs.tokenConfig.rewardRecipients[0].bps = 1;
  const r = validateLaunchReady(inputs, {});
  const out = renderValidationReport(r);
  // Strip ASCII; anything left would be non-ASCII (emoji, box-drawing,
  // smart punctuation). Project rule: report stays plain ASCII so it
  // survives every terminal / log aggregator without re-encoding.
  const nonAscii = out.replace(/[\x00-\x7F]/g, "");
  assert.equal(nonAscii, "", `non-ASCII chars found: ${JSON.stringify(nonAscii)}`);
  // And specifically: no PASS/FAIL/WARN icon glyphs (check / cross / warning).
  assert.equal(/[✅❌⚠]/.test(out), false);
  assert.ok(out.includes("[FAIL] tokenConfig"));
  assert.ok(out.includes("FAIL:"));
});
