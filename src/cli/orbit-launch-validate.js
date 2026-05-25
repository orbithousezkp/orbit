#!/usr/bin/env node
"use strict";

// orbit-launch-validate
//
// Deep pre-flight validator for the Clanker launch path. Catches configuration
// and schema bugs in the tokenConfig that orbit-preflight's env-only checks
// miss. Runs offline — no on-chain calls, no signing — so it's safe to run
// any number of times.
//
// Exit code: 0 if all gates pass, 1 if any FAIL, 2 if the CLI itself errored
// before validation could complete.
//
// Usage:
//   node src/cli/orbit-launch-validate.js [--network base|base-sepolia] [--json]
//
// Flags:
//   --network <name>  override ORBIT_LAUNCH_NETWORK env (default "base")
//   --json            emit machine-readable JSON to stdout instead of human text
//   --help            print usage and exit 0
//
// The CLI is best-effort: an unreachable RPC, missing private key, or absent
// treasury.json will surface as validation issues in the report, never as a
// CLI crash. Only true infrastructure failures (validator module missing)
// produce exit code 2.

const fs = require("fs");
const path = require("path");

const REPO_ROOT = path.resolve(__dirname, "../..");
const STATE_PATH = path.join(REPO_ROOT, "memory", "state.json");

// Defensive validator require. The sibling agent owns the module; this CLI is
// useless without it, but we degrade with a clear exit-2 message rather than
// throwing a confusing MODULE_NOT_FOUND when run before that module lands.
let validator;
let validatorLoadError = null;
try {
  // eslint-disable-next-line global-require
  validator = require("../agent/launch-validator");
} catch (err) {
  validatorLoadError = err;
}

function printUsage() {
  process.stdout.write(
    [
      "orbit-launch-validate — deep pre-flight validator for the Clanker launch path",
      "",
      "Usage:",
      "  node src/cli/orbit-launch-validate.js [options]",
      "",
      "Options:",
      "  --network <name>  override ORBIT_LAUNCH_NETWORK (base | base-sepolia)",
      "  --json            emit JSON instead of human-readable text",
      "  --help            print this help and exit 0",
      "",
      "Exit codes:",
      "  0  all gates pass",
      "  1  at least one FAIL",
      "  2  CLI infrastructure failure (validator unloadable, bad flags, etc.)",
      ""
    ].join("\n")
  );
}

function parseArgv(argv) {
  const args = Array.isArray(argv) ? argv.slice(2) : [];
  const result = { network: undefined, json: false, help: false, error: null };
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a === "--help" || a === "-h") {
      result.help = true;
      continue;
    }
    if (a === "--json") {
      result.json = true;
      continue;
    }
    if (a === "--network") {
      const next = args[i + 1];
      if (next === undefined || next.startsWith("--")) {
        result.error = "--network requires a value (base | base-sepolia)";
        return result;
      }
      result.network = next;
      i += 1;
      continue;
    }
    if (a.startsWith("--network=")) {
      result.network = a.slice("--network=".length);
      continue;
    }
    result.error = `unknown argument: ${a}`;
    return result;
  }
  return result;
}

function safeReadJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch {
    return null;
  }
}

function ethToWeiString(eth) {
  // Mirror the conversion used in src/agent/clanker.js around devBuyEth: split
  // on the decimal, pad the fractional part to 18 digits, concat, BigInt.
  // Returns "0" on any malformed input rather than throwing — the validator
  // will surface the configuration problem if zero is wrong here.
  const n = Number(eth || 0);
  if (!Number.isFinite(n) || n <= 0) return "0";
  const ethStr = String(n);
  const [whole, frac = ""] = ethStr.split(".");
  const fracPadded = (frac + "0".repeat(18)).slice(0, 18);
  try {
    return BigInt(whole + fracPadded).toString();
  } catch {
    return "0";
  }
}

function chainFor(network) {
  // Lazy require so this module imports cleanly even if viem/chains is
  // missing in a degraded environment.
  // eslint-disable-next-line global-require
  const chains = require("viem/chains");
  if (network === "base-sepolia") return chains.baseSepolia;
  return chains.base;
}

function rpcUrlFor(network, env) {
  const e = env || {};
  if (network === "base-sepolia") {
    return e.BASE_SEPOLIA_RPC_URL || e.ORBIT_BASE_SEPOLIA_RPC_URL || "";
  }
  return e.BASE_RPC_URL || e.ORBIT_BASE_RPC_URL || e.RPC_URL || "";
}

async function deriveWalletAddress(privateKey) {
  if (!privateKey || typeof privateKey !== "string") return null;
  try {
    // eslint-disable-next-line global-require
    const { privateKeyToAccount } = require("viem/accounts");
    const account = privateKeyToAccount(privateKey);
    return account && account.address ? account.address : null;
  } catch {
    return null;
  }
}

async function fetchWalletBalance(address, network, env) {
  // Returns a BigInt on success, or null on any failure (no RPC URL,
  // unreachable, malformed address, etc.). Never throws. The validator will
  // see balanceWei="0" and surface that as a wallet-state issue.
  if (!address) return null;
  const rpcUrl = rpcUrlFor(network, env);
  if (!rpcUrl) return null;
  try {
    // eslint-disable-next-line global-require
    const viem = require("viem");
    const chain = chainFor(network);
    const transport = viem.http(rpcUrl);
    const client = viem.createPublicClient({ chain, transport });
    const balance = await client.getBalance({ address });
    return typeof balance === "bigint" ? balance : BigInt(balance);
  } catch {
    return null;
  }
}

async function gatherInputs(config, env, network) {
  // Orchestrate every sub-gather behind try/catch. Partial inputs are OK —
  // the validator reports them as issues. Returns an object suitable for
  // validator.validateLaunchReady({ tokenConfig, walletState, devBuyWei,
  // safesResult, treasury, state }, env).
  const out = {
    tokenConfig: null,
    walletState: { address: "", balanceWei: "0" },
    devBuyWei: "0",
    safesResult: null,
    treasury: {},
    state: {}
  };

  // tokenConfig — best effort. buildTokenConfig() throws if the addresses
  // are missing, which is itself a validation signal.
  try {
    // eslint-disable-next-line global-require
    const clanker = require("../agent/clanker");
    out.tokenConfig = clanker.buildTokenConfig(config, 0, env);
  } catch {
    out.tokenConfig = null;
  }

  // devBuyWei — convert config.devBuyEth (float) to wei string.
  try {
    out.devBuyWei = ethToWeiString(config && config.devBuyEth);
  } catch {
    out.devBuyWei = "0";
  }

  // safesResult — direct passthrough.
  try {
    // eslint-disable-next-line global-require
    const safes = require("../agent/safes");
    out.safesResult = safes.loadSafes(env || {});
  } catch {
    out.safesResult = null;
  }

  // treasury — needs repoRoot + config. Both are best-effort.
  try {
    // eslint-disable-next-line global-require
    const treasury = require("../agent/treasury");
    out.treasury = treasury.loadTreasury(REPO_ROOT, config) || {};
  } catch {
    out.treasury = {};
  }

  // state — read memory/state.json directly. Errors fold to {} rather than
  // crashing the CLI.
  try {
    out.state = safeReadJson(STATE_PATH) || {};
  } catch {
    out.state = {};
  }

  // walletState — derive address from private key, fetch balance via RPC.
  let address = "";
  if (config && config.walletPrivateKey) {
    const derived = await deriveWalletAddress(config.walletPrivateKey);
    if (derived) address = derived;
  }
  if (!address && config && config.operatorRevenueAddress) {
    address = config.operatorRevenueAddress;
  }
  let balanceWei = "0";
  if (address) {
    const bal = await fetchWalletBalance(address, network, env);
    if (bal !== null) balanceWei = bal.toString();
  }
  out.walletState = { address, balanceWei };

  return out;
}

async function main() {
  if (validatorLoadError) {
    process.stderr.write(
      `orbit-launch-validate: validator module not available: ${validatorLoadError.message}\n` +
      "The deep launch validator at src/agent/launch-validator.js could not be loaded.\n" +
      "Cannot proceed.\n"
    );
    return 2;
  }

  const flags = parseArgv(process.argv);
  if (flags.help) {
    printUsage();
    return 0;
  }
  if (flags.error) {
    process.stderr.write(`orbit-launch-validate: ${flags.error}\n`);
    printUsage();
    return 2;
  }

  const env = { ...process.env };
  // CLI --network overrides env. Validator will normalize/validate.
  if (flags.network) env.ORBIT_LAUNCH_NETWORK = flags.network;
  const network = flags.network || env.ORBIT_LAUNCH_NETWORK || "base";

  // Load orbit config (env-driven). Failure here is infrastructure — exit 2.
  let config;
  try {
    // eslint-disable-next-line global-require
    const { loadConfig } = require("../agent/config");
    config = loadConfig(env);
  } catch (err) {
    process.stderr.write(`orbit-launch-validate: loadConfig failed: ${err.message}\n`);
    return 2;
  }

  const inputs = await gatherInputs(config, env, network);

  let result;
  try {
    result = await validator.validateLaunchReady(inputs, env);
  } catch (err) {
    process.stderr.write(`orbit-launch-validate: validator threw: ${err.message}\n`);
    return 2;
  }

  if (flags.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    try {
      process.stdout.write(`${validator.renderValidationReport(result)}\n`);
    } catch (err) {
      process.stderr.write(`orbit-launch-validate: renderValidationReport failed: ${err.message}\n`);
      return 2;
    }
  }

  const code = Number.isInteger(result && result.exitCode) ? result.exitCode : (result && result.ok ? 0 : 1);
  return code;
}

if (require.main === module) {
  main()
    .then((code) => process.exit(code))
    .catch((err) => {
      process.stderr.write(`orbit-launch-validate: fatal ${err && err.message ? err.message : err}\n`);
      process.exit(2);
    });
}

module.exports = {
  deriveWalletAddress,
  ethToWeiString,
  fetchWalletBalance,
  gatherInputs,
  main,
  parseArgv,
  printUsage
};
