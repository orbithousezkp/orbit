"use strict";

const fs = require("fs");
const path = require("path");
const { base } = require("viem/chains");
const { assertAddress, assertPrivateKey, isAddress } = require("./addresses");
const safes = require("./safes");
const { assertStateWriteSafe } = require("./state-guard");
const { TREASURY_PATH, loadTreasury, revenueClaimStatus, saveTreasury, syncRevenuePolicy } = require("./treasury");

const SECONDS_PER_DAY = 86_400;

// S-LAUNCH-1: persistent marker file written when an on-chain launch
// succeeded but persistLaunchOnceFired could not write Layer 1. The marker
// is the operator-facing alert path — the AI tool result alone is
// insufficient because nobody downstream branches on the
// "launched_but_persist_failed" status today. See writeLaunchPersistFailure.
const LAUNCH_PERSIST_FAILURE_PATH = "memory/launch-persist-failure.json";

// Test seam: callers may inject a factory that replaces makeClanker so
// integration tests can simulate a successful on-chain deploy without
// touching the SDK or RPC. Production callers MUST NOT set this — leaving
// it null routes through the real makeClanker path. The seam is exported
// via __setClankerFactoryForTests so test files have an explicit, audited
// entry point and so a typo in a fixture cannot accidentally override the
// real path.
let _clankerFactoryOverride = null;
function __setClankerFactoryForTests(factory) {
  _clankerFactoryOverride = factory;
}

// Resolve the Fee Receive Safe per D-019. Prefer the new ORBIT_TREASURY_SAFE
// (via safes.addressOf) and fall back to legacy ORBIT_TREASURY_ADDRESS during
// migration so a partially-configured operator still gets a working launch
// path. Callers that need a guaranteed Safe address should treat null as a
// hard misconfiguration.
//
// Bug F: paired with treasurySafeFromEnv() so readiness() can flag operators
// who never set ORBIT_TREASURY_SAFE even when the legacy var is set. The
// legacy fallback is preserved here as a migration aid, but readiness()
// independently checks for the Safe-only address and pushes
// "ORBIT_TREASURY_SAFE" into missing when it is absent.
function resolveTreasuryAddress(config, env) {
  const safeAddr = safes.addressOf(env || process.env, "fee-receive");
  if (safeAddr) return safeAddr;
  if (config && isAddress(config.treasuryAddress)) return config.treasuryAddress;
  return config && config.treasuryAddress ? config.treasuryAddress : "";
}

// Returns ONLY the validated ORBIT_TREASURY_SAFE address (Safe-from-env).
// Returns null when ORBIT_TREASURY_SAFE is absent or not a valid EVM address,
// regardless of any legacy ORBIT_TREASURY_ADDRESS fallback. Used by readiness
// to flag operators who have not migrated to the Safe-based topology even
// when the legacy var is still present (Bug F).
function treasurySafeFromEnv(env) {
  return safes.addressOf(env || process.env, "fee-receive");
}

// S-LAUNCH-1 Layer 1: append-only state.launchOnceFired flag.
//
// Reads memory/state.json, sets launchOnceFired=true, then writes it back —
// gated by the state-guard so an accidental rollback (prev=true, next=false)
// throws instead of silently clearing the flag.
//
// Bug A fix: on JSON parse failure of an existing state.json we REFUSE to
// write. Returning a fail-closed marker prevents data loss (the state-guard
// cannot protect us here because prev.launchOnceFired could not be read).
//
// Bug C fix: write atomically via tmp+fsync+rename so a SIGKILL between the
// treasury.json write and the state.json write cannot leave a torn state.
// Any persistence error THROWS so the caller can surface
// launched_but_persist_failed instead of silently dropping the flag.
function persistLaunchOnceFired(repoRoot) {
  if (!repoRoot) {
    const err = new Error("persistLaunchOnceFired: repoRoot is required");
    err.code = "NO_REPO_ROOT";
    throw err;
  }
  const statePath = path.resolve(repoRoot, "memory/state.json");

  // Read previous on-disk state. If state.json exists and is unparseable,
  // FAIL CLOSED — we cannot risk overwriting cycle/born/aiRouting/etc with a
  // bare {launchOnceFired: true}. A missing file (ENOENT) is fine: we start
  // from empty.
  let prev;
  let prevBytes = null;
  try {
    prevBytes = fs.readFileSync(statePath, "utf-8");
  } catch (err) {
    if (err && err.code === "ENOENT") {
      prev = {};
    } else {
      const wrapped = new Error(`persistLaunchOnceFired: read failed: ${err.message}`);
      wrapped.code = "READ_FAILED";
      throw wrapped;
    }
  }
  if (prevBytes !== null) {
    try {
      prev = JSON.parse(prevBytes);
    } catch (err) {
      const wrapped = new Error(
        `persistLaunchOnceFired: refusing to write — state.json exists but cannot be parsed (${err.message}). ` +
        "Original bytes preserved; resolve the corruption before retrying."
      );
      wrapped.code = "PARSE_FAILED";
      wrapped.reason = "parse_failed";
      throw wrapped;
    }
  }

  const next = { ...prev, launchOnceFired: true };
  assertStateWriteSafe(prev, next);

  const tmpPath = `${statePath}.tmp`;
  try {
    fs.mkdirSync(path.dirname(statePath), { recursive: true });
    const payload = `${JSON.stringify(next, null, 2)}\n`;
    const fd = fs.openSync(tmpPath, "w");
    try {
      fs.writeSync(fd, payload);
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    fs.renameSync(tmpPath, statePath);
    return { ok: true };
  } catch (err) {
    try { fs.unlinkSync(tmpPath); } catch { /* ignore cleanup failure */ }
    const wrapped = new Error(`persistLaunchOnceFired: atomic write failed: ${err.message}`);
    wrapped.code = "WRITE_FAILED";
    throw wrapped;
  }
}

function rewardSplit(config) {
  const operatorBps = config.operatorRevenueBps;
  if (!Number.isInteger(operatorBps) || operatorBps < 0 || operatorBps > 10000) {
    throw new Error("ORBIT_OPERATOR_REVENUE_BPS must be between 0 and 10000");
  }
  return {
    operatorBps,
    treasuryBps: 10000 - operatorBps
  };
}

// S-LAUNCH-1 alert path: persistent marker written when an on-chain launch
// succeeded but persistLaunchOnceFired threw. The AI tool result already
// carries status="launched_but_persist_failed" but no caller currently
// branches on it, so we also drop a marker file the next cycle (or
// preflight) can surface. Uses the same atomic write pattern as
// persistLaunchOnceFired (tmp + fsync + rename) so a SIGKILL between this
// call and the failure return cannot leave a torn marker.
//
// CRITICAL invariant: this function MUST NOT throw. We are already in a
// degraded state (Layer 1 failed). If the marker write also fails the
// AI tool result remains the source-of-truth alert and the caller still
// returns "launched_but_persist_failed" — swallowing the error here is
// the correct trade-off.
function writeLaunchPersistFailure(repoRoot, payload) {
  if (!repoRoot) return { ok: false, reason: "no_repo_root" };
  try {
    const filePath = path.resolve(repoRoot, LAUNCH_PERSIST_FAILURE_PATH);
    const tmpPath = `${filePath}.tmp`;
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const body = `${JSON.stringify(payload, null, 2)}\n`;
    const fd = fs.openSync(tmpPath, "w");
    try {
      fs.writeSync(fd, body);
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    fs.renameSync(tmpPath, filePath);
    try { fs.chmodSync(filePath, 0o644); } catch { /* chmod is best-effort */ }
    return { ok: true, path: LAUNCH_PERSIST_FAILURE_PATH };
  } catch (err) {
    // Swallow — we are the alert path for an already-failed write. Re-
    // throwing here would mask the real failure (the AI tool result).
    return { ok: false, reason: "marker_write_failed", error: err.message };
  }
}

// Operator/preflight helper. Returns true when the marker file exists on
// disk. NOT called by anything in the cycle today — exposed so future
// preflight/dashboards can surface a degraded-defense state without having
// to know the marker path.
function hasLaunchPersistFailure(repoRoot) {
  if (!repoRoot) return false;
  try {
    const filePath = path.resolve(repoRoot, LAUNCH_PERSIST_FAILURE_PATH);
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

function readiness(config, env) {
  const missing = [];
  const resolvedEnv = env || process.env;
  const treasuryAddr = resolveTreasuryAddress(config, resolvedEnv);
  if (!isAddress(config.operatorRevenueAddress)) missing.push("ORBIT_OPERATOR_REVENUE_ADDRESS");
  // Bug F: an operator who set only the legacy ORBIT_TREASURY_ADDRESS is NOT
  // ready to sign. The Safe-from-env must be present and valid even when the
  // legacy address resolved fine. Operators can satisfy both by setting
  // ORBIT_TREASURY_SAFE (which is the cleanly-migrated path).
  if (treasurySafeFromEnv(resolvedEnv) === null) missing.push("ORBIT_TREASURY_SAFE");
  if (!isAddress(treasuryAddr)) {
    if (!missing.includes("ORBIT_TREASURY_SAFE")) missing.push("ORBIT_TREASURY_SAFE");
  }
  if (!isAddress(config.tokenAdminAddress || treasuryAddr)) missing.push("ORBIT_TOKEN_ADMIN_ADDRESS");
  if (!config.walletPrivateKey) missing.push("ORBIT_WALLET_PRIVATE_KEY");

  return {
    readyToSign: missing.length === 0,
    missing
  };
}

function buildTokenConfig(config, cycle = 0, env) {
  const { operatorBps, treasuryBps } = rewardSplit(config);
  const treasuryAddr = resolveTreasuryAddress(config, env || process.env);
  // D-019: Token Admin AND the 9500-bps recipient default to the Fee Receive
  // Safe. Explicit ORBIT_TOKEN_ADMIN_ADDRESS still wins so operators can
  // override during migration.
  const tokenAdmin = assertAddress(config.tokenAdminAddress || treasuryAddr, "token admin address");
  const treasuryRecipient = assertAddress(treasuryAddr, "treasury address");
  const operatorRecipient = assertAddress(config.operatorRevenueAddress, "operator revenue address");

  const token = {
    name: config.tokenName,
    symbol: config.tokenSymbol,
    tokenAdmin,
    metadata: {
      description: config.tokenDescription,
      socialMediaUrls: [],
      auditUrls: []
    },
    context: {
      interface: "Orbit",
      platform: "GitHub Actions",
      messageId: `orbit-cycle-${cycle}`,
      id: "orbit-native-token"
    },
    rewards: {
      recipients: [
        {
          admin: tokenAdmin,
          recipient: operatorRecipient,
          bps: operatorBps,
          token: "Paired"
        },
        {
          admin: tokenAdmin,
          recipient: treasuryRecipient,
          bps: treasuryBps,
          token: "Paired"
        }
      ]
    },
    vault: {
      percentage: config.vaultPercentage,
      lockupDuration: config.vaultLockupDays * SECONDS_PER_DAY,
      vestingDuration: config.vaultVestingDays * SECONDS_PER_DAY,
      recipient: treasuryRecipient
    },
    vanity: true
  };

  if (config.tokenImageUri) token.image = config.tokenImageUri;
  if (config.devBuyEth > 0) {
    token.devBuy = {
      ethAmount: config.devBuyEth
    };
  }

  return token;
}

function prepareClankerLaunch(config, cycle = 0, env) {
  const resolvedEnv = env || process.env;
  const status = readiness(config, resolvedEnv);
  let tokenConfig = null;
  let error = null;

  try {
    tokenConfig = status.missing.includes("ORBIT_OPERATOR_REVENUE_ADDRESS") ||
      status.missing.includes("ORBIT_TREASURY_SAFE") ||
      status.missing.includes("ORBIT_TOKEN_ADMIN_ADDRESS")
      ? null
      : buildTokenConfig(config, cycle, resolvedEnv);
  } catch (caught) {
    error = caught.message;
  }

  return {
    dryRun: !config.enableTokenLaunch,
    launchEnabled: config.enableTokenLaunch,
    readyToSign: status.readyToSign,
    missing: status.missing,
    revenuePolicy: {
      operatorShareBps: config.operatorRevenueBps,
      treasuryShareBps: 10000 - config.operatorRevenueBps,
      operatorSharePct: config.operatorRevenueBps / 100,
      treasurySharePct: (10000 - config.operatorRevenueBps) / 100,
      rewardToken: "Paired",
      expectedPairedAsset: "configured paired token"
    },
    tokenConfig,
    error
  };
}

async function makeClanker(config) {
  if (typeof _clankerFactoryOverride === "function") {
    return _clankerFactoryOverride(config);
  }
  assertPrivateKey(config.walletPrivateKey, "ORBIT_WALLET_PRIVATE_KEY");
  const [{ Clanker }, viem, accounts] = await Promise.all([
    import("clanker-sdk/v4"),
    import("viem"),
    import("viem/accounts")
  ]);

  const account = accounts.privateKeyToAccount(config.walletPrivateKey);
  const transport = viem.http(config.baseRpcUrl || undefined);
  const publicClient = viem.createPublicClient({ chain: base, transport });
  const wallet = viem.createWalletClient({ account, chain: base, transport });

  return {
    account,
    clanker: new Clanker({ wallet, publicClient })
  };
}

async function launchNativeToken(config, cycle = 0, state = {}, env) {
  const resolvedEnv = env || process.env;
  if (state.preLaunchVerified !== true) {
    return {
      status: "blocked",
      ok: false,
      blocked: true,
      reason: "state.preLaunchVerified is not true (D-018 pre-launch gate)"
    };
  }

  // S-LAUNCH-1 Layer 1 enforcement: if the once-only flag is already set,
  // refuse before any other work. This is independent of treasury.json's
  // launchStatus, so even a corrupted treasury record cannot trigger a
  // second launch.
  if (state.launchOnceFired === true) {
    return {
      status: "blocked",
      ok: false,
      blocked: true,
      reason: "launch_already_fired",
      detail: "state.launchOnceFired is true; D-019 + S-LAUNCH-1 once-only guarantee"
    };
  }

  // T-1: treasury-floor guard on dev-buy ETH spend. Belt-and-braces over D-018.
  const devBuyEth = Number(config.devBuyEth || 0);
  if (devBuyEth > 0) {
    const { assertTreasuryFloor } = require("./governance");
    // Convert ETH amount (e.g. 0.001) to wei (1e15).
    const ethStr = String(devBuyEth);
    const [whole, frac = ""] = ethStr.split(".");
    const fracPadded = (frac + "0".repeat(18)).slice(0, 18);
    let plannedWei;
    try {
      plannedWei = BigInt(whole + fracPadded).toString();
    } catch {
      plannedWei = null;
    }
    if (plannedWei !== null) {
      const floorDecision = assertTreasuryFloor({
        state,
        config,
        amountWei: plannedWei,
        actionType: "token_launch_dev_buy",
        actionLabel: "clanker launch dev buy"
      });
      if (!floorDecision.ok) {
        return {
          status: "blocked_treasury_floor",
          ok: false,
          blocked: true,
          reason: floorDecision.reason,
          detail: floorDecision.detail,
          treasuryFloor: floorDecision
        };
      }
    }
  }

  const treasury = syncRevenuePolicy(config);
  if (treasury.token.launchStatus === "launched" && treasury.token.address) {
    return {
      status: "already_launched",
      address: treasury.token.address,
      txHash: treasury.token.txHash
    };
  }

  const prepared = prepareClankerLaunch(config, cycle, resolvedEnv);
  if (!config.enableTokenLaunch) {
    return {
      status: "dry_run",
      message: "Token launch is prepared but ORBIT_ENABLE_TOKEN_LAUNCH is not true.",
      prepared
    };
  }

  if (!prepared.readyToSign || !prepared.tokenConfig) {
    return {
      status: "blocked",
      message: "Token launch is enabled but required wallet/address configuration is missing.",
      prepared
    };
  }

  const { clanker } = await makeClanker(config);
  const deployment = await clanker.deploy(prepared.tokenConfig);
  if (deployment.error) throw deployment.error;

  const receipt = await deployment.waitForTransaction();
  if (receipt.error) throw receipt.error;

  treasury.token.launchStatus = "launched";
  treasury.token.address = receipt.address;
  treasury.token.txHash = deployment.txHash;
  treasury.token.launchedAt = new Date().toISOString();
  treasury.token.launchRequest = prepared.tokenConfig;
  saveTreasury(config.repoRoot, treasury);

  // Layer 1: persist append-only flag. Bug C: a failure here is now
  // load-bearing — on-chain launch already happened, but if Layer 1 cannot
  // be set we MUST surface that loudly so an operator can repair state.json
  // before a future cycle gets a chance to re-launch. We do NOT re-throw
  // (the on-chain receipt would be lost from the caller's view), but we tag
  // the return value with status="launched_but_persist_failed" and include
  // the original error so the caller can alert.
  try {
    persistLaunchOnceFired(config.repoRoot);
  } catch (persistErr) {
    const occurredAt = new Date().toISOString();
    const actionRequired = "Layer 1 (state.launchOnceFired) was NOT persisted after a successful on-chain launch. " +
      "Treasury.json correctly records launchStatus=launched (Layer 0) but state.json is missing the redundant flag. " +
      "Operator should manually set state.launchOnceFired=true and verify via `npm run orbit:preflight --strict`. " +
      "Until then, three-layer defense is degraded to one (treasury.json Layer 0 only).";
    // Best-effort persistent marker — must not throw. If the write fails we
    // still return the failure status below so the AI tool result remains
    // the alert.
    writeLaunchPersistFailure(config.repoRoot, {
      occurred_at: occurredAt,
      tx_hash: deployment.txHash,
      token_address: receipt.address,
      error: persistErr.message,
      error_code: persistErr.code || null,
      action_required: actionRequired
    });
    return {
      status: "launched_but_persist_failed",
      address: receipt.address,
      txHash: deployment.txHash,
      proofPath: TREASURY_PATH,
      markerPath: LAUNCH_PERSIST_FAILURE_PATH,
      error: persistErr.message,
      errorCode: persistErr.code || null,
      detail: "On-chain launch succeeded and treasury.json was updated, but state.launchOnceFired could NOT be persisted. " +
        "Layer 1 flag not persisted — operator must intervene. " +
        "Treasury status='launched' is the canonical record; Layer 0 + Layer 2 still prevent re-launch. " +
        "A persistent marker has been written to memory/launch-persist-failure.json; repair memory/state.json " +
        "(set launchOnceFired: true) before the next cycle."
    };
  }

  return {
    status: "launched",
    address: receipt.address,
    txHash: deployment.txHash,
    proofPath: TREASURY_PATH,
    launchOnceWrite: { ok: true }
  };
}

async function runRevenueCycle(config, state = {}) {
  if (state.preLaunchVerified !== true) {
    return {
      status: "blocked",
      ok: false,
      blocked: true,
      reason: "state.preLaunchVerified is not true (D-018 pre-launch gate)"
    };
  }
  const treasury = loadTreasury(config.repoRoot, config);
  const token = treasury.token.address;
  const operatorRecipient = config.operatorRevenueAddress;
  const claimStatus = revenueClaimStatus(config, config.repoRoot, treasury);

  if (!token) {
    return {
      status: "no_token",
      message: "No launched token address is recorded yet.",
      claimStatus
    };
  }

  assertAddress(token, "token address");
  assertAddress(operatorRecipient, "operator revenue address");

  if (!claimStatus.canClaim) {
    return {
      status: "blocked_by_revenue_policy",
      message: "Revenue sending is weekly and performance-gated.",
      claimStatus
    };
  }

  if (!config.enableRevenueClaims) {
    return {
      status: "dry_run",
      message: "Revenue claim is prepared but ORBIT_ENABLE_REVENUE_CLAIMS is not true.",
      token,
      rewardRecipient: operatorRecipient,
      claimStatus
    };
  }

  const { clanker } = await makeClanker(config);
  const result = await clanker.claimRewards({
    token,
    rewardRecipient: operatorRecipient
  });

  treasury.revenue.lastClaimAttemptAt = new Date().toISOString();
  treasury.revenue.lastClaimResult = result.error
    ? { error: result.error.message || String(result.error) }
    : { txHash: result.txHash, rewardRecipient: operatorRecipient };
  if (!result.error) {
    treasury.revenue.lastClaimSentAt = treasury.revenue.lastClaimAttemptAt;
  }
  saveTreasury(config.repoRoot, treasury);

  if (result.error) throw result.error;
  return {
    status: "claimed",
    token,
    rewardRecipient: operatorRecipient,
    txHash: result.txHash,
    proofPath: TREASURY_PATH
  };
}

module.exports = {
  __setClankerFactoryForTests,
  buildTokenConfig,
  hasLaunchPersistFailure,
  LAUNCH_PERSIST_FAILURE_PATH,
  launchNativeToken,
  persistLaunchOnceFired,
  prepareClankerLaunch,
  resolveTreasuryAddress,
  rewardSplit,
  runRevenueCycle,
  treasurySafeFromEnv,
  writeLaunchPersistFailure
};
