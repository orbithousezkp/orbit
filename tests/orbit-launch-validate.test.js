"use strict";

// Tests for src/cli/orbit-launch-validate.js
//
// We use require.cache injection to stub the sibling-owned
// src/agent/launch-validator module so this test file passes whether or not
// the real validator has landed. If/when the real module lands, the tests
// continue to assert ONLY the CLI's contract (input gathering, flag parsing,
// exit codes); they do not assert validator behavior.

const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const Module = require("node:module");

// ---------------------------------------------------------------------------
// Mock the launch-validator before the CLI module loads.
// ---------------------------------------------------------------------------

const VALIDATOR_REQUIRE_PATH = path.resolve(__dirname, "../src/agent/launch-validator.js");

function installMockValidator() {
  // Whatever was cached (real or absent), replace with a deterministic stub
  // for tests. The stub records the inputs handed to validateLaunchReady so
  // gather-input tests can assert against them.
  const captured = { calls: [] };
  const stub = {
    LAUNCH_NETWORKS: ["base", "base-sepolia"],
    loadValidatorConfig: (env) => ({
      network: (env && env.ORBIT_LAUNCH_NETWORK) || "base",
      minGasBalanceWei: "0",
      maxDevBuyBpsOfBalance: 5000,
      expectedFeeSum: "0"
    }),
    validateNetwork: (network) => ({ ok: true, network, chainId: network === "base-sepolia" ? 84532 : 8453 }),
    validateTokenConfig: () => ({ ok: true, issues: [], summary: "" }),
    validateWalletState: () => ({ ok: true, issues: [] }),
    validateSafesReachable: () => ({ ok: true, issues: [] }),
    validateFeeFloorReady: () => ({ ok: true, issues: [] }),
    validateLaunchReady: async (inputs, env) => {
      captured.calls.push({ inputs, env });
      return {
        ok: true,
        subResults: {},
        allIssues: [],
        summary: "all gates pass",
        exitCode: 0
      };
    },
    renderValidationReport: (r) => `mock-report ok=${r.ok} exitCode=${r.exitCode}`,
    __captured: captured
  };
  require.cache[VALIDATOR_REQUIRE_PATH] = {
    id: VALIDATOR_REQUIRE_PATH,
    filename: VALIDATOR_REQUIRE_PATH,
    loaded: true,
    exports: stub,
    children: [],
    paths: Module._nodeModulePaths(path.dirname(VALIDATOR_REQUIRE_PATH))
  };
  return stub;
}

// Install the mock BEFORE requiring the CLI module so its top-level require
// picks up our stub.
const mockValidator = installMockValidator();

const CLI_REQUIRE_PATH = path.resolve(__dirname, "../src/cli/orbit-launch-validate.js");
// Clear any cached CLI so it re-evaluates against our fresh validator stub.
delete require.cache[CLI_REQUIRE_PATH];
const cli = require(CLI_REQUIRE_PATH);

// ---------------------------------------------------------------------------
// parseArgv
// ---------------------------------------------------------------------------

test("parseArgv: no args -> network undefined, json false, help false", () => {
  const r = cli.parseArgv(["node", "cli"]);
  assert.equal(r.network, undefined);
  assert.equal(r.json, false);
  assert.equal(r.help, false);
  assert.equal(r.error, null);
});

test("parseArgv: --network base-sepolia sets network", () => {
  const r = cli.parseArgv(["node", "cli", "--network", "base-sepolia"]);
  assert.equal(r.network, "base-sepolia");
  assert.equal(r.error, null);
});

test("parseArgv: --network=base accepts =-form", () => {
  const r = cli.parseArgv(["node", "cli", "--network=base"]);
  assert.equal(r.network, "base");
});

test("parseArgv: --json sets json true", () => {
  const r = cli.parseArgv(["node", "cli", "--json"]);
  assert.equal(r.json, true);
});

test("parseArgv: --help sets help true", () => {
  const r = cli.parseArgv(["node", "cli", "--help"]);
  assert.equal(r.help, true);
});

test("parseArgv: unknown flag returns an error, does not crash", () => {
  const r = cli.parseArgv(["node", "cli", "--what"]);
  assert.ok(r.error, "expected error message for unknown flag");
  assert.match(r.error, /unknown argument/);
});

test("parseArgv: --network without value returns an error, does not crash", () => {
  const r = cli.parseArgv(["node", "cli", "--network"]);
  assert.ok(r.error, "expected error message for missing --network value");
  assert.match(r.error, /requires a value/);
});

// ---------------------------------------------------------------------------
// ethToWeiString
// ---------------------------------------------------------------------------

test("ethToWeiString: 0 -> '0'", () => {
  assert.equal(cli.ethToWeiString(0), "0");
});

test("ethToWeiString: 0.001 -> '1000000000000000'", () => {
  assert.equal(cli.ethToWeiString(0.001), "1000000000000000");
});

test("ethToWeiString: malformed -> '0'", () => {
  assert.equal(cli.ethToWeiString("not-a-number"), "0");
  assert.equal(cli.ethToWeiString(undefined), "0");
  assert.equal(cli.ethToWeiString(null), "0");
});

// ---------------------------------------------------------------------------
// deriveWalletAddress
// ---------------------------------------------------------------------------

test("deriveWalletAddress: valid private key -> EIP-55 address", async () => {
  const pk = "0x" + "11".repeat(32);
  const addr = await cli.deriveWalletAddress(pk);
  assert.ok(addr, "expected an address");
  assert.match(addr, /^0x[0-9a-fA-F]{40}$/);
});

test("deriveWalletAddress: malformed private key -> null", async () => {
  const r = await cli.deriveWalletAddress("not-a-key");
  assert.equal(r, null);
});

test("deriveWalletAddress: missing private key -> null", async () => {
  assert.equal(await cli.deriveWalletAddress(""), null);
  assert.equal(await cli.deriveWalletAddress(null), null);
  assert.equal(await cli.deriveWalletAddress(undefined), null);
});

// ---------------------------------------------------------------------------
// fetchWalletBalance
// ---------------------------------------------------------------------------

test("fetchWalletBalance: no RPC URL -> null (does not throw)", async () => {
  const r = await cli.fetchWalletBalance("0x1111111111111111111111111111111111111111", "base", {});
  assert.equal(r, null);
});

test("fetchWalletBalance: no address -> null (does not throw)", async () => {
  const r = await cli.fetchWalletBalance("", "base", { BASE_RPC_URL: "http://localhost:1" });
  assert.equal(r, null);
});

test("fetchWalletBalance: unreachable RPC -> null (does not throw)", async () => {
  // Pick a port that nothing is listening on. viem will throw; we expect null.
  const r = await cli.fetchWalletBalance(
    "0x1111111111111111111111111111111111111111",
    "base",
    { BASE_RPC_URL: "http://127.0.0.1:1/" }
  );
  assert.equal(r, null);
});

// ---------------------------------------------------------------------------
// gatherInputs
// ---------------------------------------------------------------------------

function makeBaseEnv() {
  const TEST_PK = "0x" + "11".repeat(32);
  return {
    ORBIT_AGENT_SIGNER: "0xCAFE000000000000000000000000000000000aaa",
    ORBIT_WALLET_PRIVATE_KEY: TEST_PK,
    ORBIT_OPERATOR_REVENUE_ADDRESS: "0xCAFE000000000000000000000000000000000bbb",
    ORBIT_TREASURY_SAFE:         "0x1111111111111111111111111111111111111111",
    ORBIT_FLOOR_RESERVE_SAFE:    "0x2222222222222222222222222222222222222222",
    ORBIT_PRODUCTIVE_YIELD_SAFE: "0x3333333333333333333333333333333333333333",
    ORBIT_BUYBACK_SAFE:          "0x4444444444444444444444444444444444444444",
    ORBIT_GROWTH_SAFE:           "0x5555555555555555555555555555555555555555",
    ORBIT_AI_COSTS_SAFE:         "0x6666666666666666666666666666666666666666",
    ORBIT_OPS_RUNWAY_SAFE:       "0x7777777777777777777777777777777777777777",
    ORBIT_TOKEN_NAME: "Orbit",
    ORBIT_TOKEN_SYMBOL: "ORBIT",
    ORBIT_OPERATOR_REVENUE_BPS: "500"
  };
}

function loadConfigFor(env) {
  // eslint-disable-next-line global-require
  const { loadConfig } = require("../src/agent/config");
  return loadConfig(env);
}

test("gatherInputs: full env -> returns complete inputs object", async () => {
  const env = makeBaseEnv();
  const config = loadConfigFor(env);
  const inputs = await cli.gatherInputs(config, env, "base");
  assert.ok(inputs && typeof inputs === "object");
  assert.ok(inputs.tokenConfig, "expected tokenConfig to be built");
  assert.equal(typeof inputs.devBuyWei, "string");
  assert.equal(inputs.devBuyWei, "0");
  assert.ok(inputs.safesResult, "expected safesResult");
  assert.equal(inputs.safesResult.ok, true);
  assert.ok(inputs.walletState && typeof inputs.walletState === "object");
  // RPC unreachable in tests, balance falls back to "0" — that's correct.
  assert.equal(inputs.walletState.balanceWei, "0");
  // Address derived from the test private key.
  assert.match(inputs.walletState.address, /^0x[0-9a-fA-F]{40}$/);
});

test("gatherInputs: no private key -> walletState.address may be empty or operator fallback", async () => {
  const env = makeBaseEnv();
  delete env.ORBIT_WALLET_PRIVATE_KEY;
  const config = loadConfigFor(env);
  const inputs = await cli.gatherInputs(config, env, "base");
  // With no PK, the CLI falls back to operatorRevenueAddress (per the spec).
  assert.equal(inputs.walletState.address, env.ORBIT_OPERATOR_REVENUE_ADDRESS);
  assert.equal(inputs.walletState.balanceWei, "0");
});

test("gatherInputs: no private key AND no operator addr -> walletState.address is empty", async () => {
  const env = makeBaseEnv();
  delete env.ORBIT_WALLET_PRIVATE_KEY;
  delete env.ORBIT_OPERATOR_REVENUE_ADDRESS;
  const config = loadConfigFor(env);
  const inputs = await cli.gatherInputs(config, env, "base");
  assert.equal(inputs.walletState.address, "");
  assert.equal(inputs.walletState.balanceWei, "0");
});

test("gatherInputs: RPC unreachable -> balanceWei is '0', no throw", async () => {
  const env = { ...makeBaseEnv(), BASE_RPC_URL: "http://127.0.0.1:1/" };
  const config = loadConfigFor(env);
  const inputs = await cli.gatherInputs(config, env, "base");
  assert.equal(inputs.walletState.balanceWei, "0");
});

test("gatherInputs: treasury defaults to {} on read error (no throw)", async () => {
  const env = makeBaseEnv();
  const config = loadConfigFor(env);
  // gatherInputs reads from the real repo's memory/treasury.json. Even if it
  // is missing or unreadable, the function must not throw and must return an
  // object (even if empty).
  const inputs = await cli.gatherInputs(config, env, "base");
  assert.ok(inputs.treasury && typeof inputs.treasury === "object");
});

test("gatherInputs: malformed safes env still returns a safesResult", async () => {
  const env = { ORBIT_TREASURY_SAFE: "not-an-address" };
  const config = loadConfigFor(env);
  const inputs = await cli.gatherInputs(config, env, "base");
  assert.ok(inputs.safesResult);
  assert.equal(inputs.safesResult.ok, false);
});

// ---------------------------------------------------------------------------
// main / end-to-end with mock validator
// ---------------------------------------------------------------------------

test("main: --help returns 0 and prints usage", async () => {
  const oldArgv = process.argv;
  const oldStdout = process.stdout.write;
  const captured = [];
  process.stdout.write = (chunk) => {
    captured.push(String(chunk));
    return true;
  };
  process.argv = ["node", "orbit-launch-validate", "--help"];
  try {
    const code = await cli.main();
    assert.equal(code, 0);
    assert.match(captured.join(""), /Usage:/);
  } finally {
    process.argv = oldArgv;
    process.stdout.write = oldStdout;
  }
});

test("main: unknown flag returns 2 (CLI infrastructure failure)", async () => {
  const oldArgv = process.argv;
  const oldStdoutWrite = process.stdout.write;
  const oldStderrWrite = process.stderr.write;
  process.stdout.write = () => true;
  process.stderr.write = () => true;
  process.argv = ["node", "orbit-launch-validate", "--whatever"];
  try {
    const code = await cli.main();
    assert.equal(code, 2);
  } finally {
    process.argv = oldArgv;
    process.stdout.write = oldStdoutWrite;
    process.stderr.write = oldStderrWrite;
  }
});

test("main: happy path with mock validator returns exitCode 0", async () => {
  const oldArgv = process.argv;
  const oldEnv = { ...process.env };
  const oldStdout = process.stdout.write;
  const oldStderr = process.stderr.write;
  const captured = [];
  process.stdout.write = (chunk) => { captured.push(String(chunk)); return true; };
  process.stderr.write = () => true;
  // Inject a fully-populated env so loadConfig succeeds and validator stub fires.
  Object.assign(process.env, makeBaseEnv());
  process.argv = ["node", "orbit-launch-validate", "--json", "--network", "base"];
  try {
    const code = await cli.main();
    assert.equal(code, 0);
    const body = captured.join("");
    // --json branch -> stdout is a parseable JSON of the validator result.
    const parsed = JSON.parse(body);
    assert.equal(parsed.exitCode, 0);
    assert.equal(parsed.ok, true);
  } finally {
    process.argv = oldArgv;
    // Restore env
    for (const k of Object.keys(process.env)) {
      if (!(k in oldEnv)) delete process.env[k];
    }
    Object.assign(process.env, oldEnv);
    process.stdout.write = oldStdout;
    process.stderr.write = oldStderr;
  }
});

test("main: human output path uses renderValidationReport", async () => {
  const oldArgv = process.argv;
  const oldEnv = { ...process.env };
  const oldStdout = process.stdout.write;
  const oldStderr = process.stderr.write;
  const captured = [];
  process.stdout.write = (chunk) => { captured.push(String(chunk)); return true; };
  process.stderr.write = () => true;
  Object.assign(process.env, makeBaseEnv());
  process.argv = ["node", "orbit-launch-validate"];
  try {
    const code = await cli.main();
    assert.equal(code, 0);
    assert.match(captured.join(""), /mock-report/);
  } finally {
    process.argv = oldArgv;
    for (const k of Object.keys(process.env)) {
      if (!(k in oldEnv)) delete process.env[k];
    }
    Object.assign(process.env, oldEnv);
    process.stdout.write = oldStdout;
    process.stderr.write = oldStderr;
  }
});

test("main: --network flag flows into env handed to validator", async () => {
  const oldArgv = process.argv;
  const oldEnv = { ...process.env };
  const oldStdout = process.stdout.write;
  const oldStderr = process.stderr.write;
  process.stdout.write = () => true;
  process.stderr.write = () => true;
  Object.assign(process.env, makeBaseEnv());
  process.argv = ["node", "orbit-launch-validate", "--network", "base-sepolia", "--json"];
  const before = mockValidator.__captured.calls.length;
  try {
    const code = await cli.main();
    assert.equal(code, 0);
    const after = mockValidator.__captured.calls.length;
    assert.ok(after > before, "validator should have been called");
    const lastCall = mockValidator.__captured.calls[after - 1];
    assert.equal(lastCall.env.ORBIT_LAUNCH_NETWORK, "base-sepolia");
  } finally {
    process.argv = oldArgv;
    for (const k of Object.keys(process.env)) {
      if (!(k in oldEnv)) delete process.env[k];
    }
    Object.assign(process.env, oldEnv);
    process.stdout.write = oldStdout;
    process.stderr.write = oldStderr;
  }
});

// ---------------------------------------------------------------------------
// printUsage smoke
// ---------------------------------------------------------------------------

test("printUsage: writes to stdout, returns nothing", () => {
  const oldWrite = process.stdout.write;
  let captured = "";
  process.stdout.write = (chunk) => { captured += String(chunk); return true; };
  try {
    cli.printUsage();
    assert.match(captured, /orbit-launch-validate/);
    assert.match(captured, /Exit codes:/);
  } finally {
    process.stdout.write = oldWrite;
  }
});
