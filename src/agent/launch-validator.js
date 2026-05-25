"use strict";

// Deep-preflight launch validator (S-REHEARSE-1).
//
// Pure module — no I/O, no on-chain calls. Callers source the inputs:
//   - tokenConfig: the exact payload that would be sent to clanker.deploy().
//   - walletState: { address, balanceWei } as observed on-chain by the
//     caller (or supplied by a rehearsal fixture).
//   - devBuyWei: amount the launch will spend immediately, in wei.
//   - safesResult: output of src/agent/safes.js loadSafes(env).
//   - treasury, state: parsed JSON contents of memory/treasury.json and
//     memory/state.json respectively.
//
// The intent is to catch launch-config bugs BEFORE they burn real gas:
//   - rewardRecipients with bps that don't sum to 10000
//   - tokenAdmin or rewardRecipient addresses that fail EIP-55 (typo risk)
//   - a wallet balance that cannot cover devBuy + gas headroom
//   - the once-only launch flag already fired (idempotency)
//   - missing or duplicate Treasury Safes
//
// One sub-validator throwing MUST NOT abort the others — each is wrapped in
// a try/catch and any thrown error surfaces as an issue with severity
// "error". This guarantees comprehensive failure surfacing in CI: an
// operator sees every problem in one run instead of fixing them one at a
// time.

const { isStrictAddress } = require("./addresses");

const LAUNCH_NETWORKS = ["base", "base-sepolia"];
const DEFAULT_MIN_GAS_BALANCE_WEI = "10000000000000000"; // 0.01 ETH
const DEFAULT_MAX_DEV_BUY_BPS_OF_BALANCE = 5000;        // 50% of wallet
const DEFAULT_MIN_TOTAL_FEE_BPS = 10000;
const DEFAULT_MAX_TOTAL_FEE_BPS = 10000;

const CHAIN_IDS = {
  "base": 8453,
  "base-sepolia": 84532
};

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

function parsePositiveBigInt(raw, label) {
  if (raw === null || raw === undefined) {
    throw new Error(`${label}: value is required`);
  }
  const str = String(raw).trim();
  if (str === "") {
    throw new Error(`${label}: value is required`);
  }
  if (!/^[0-9]+$/.test(str)) {
    throw new Error(`${label}: must be a non-negative integer (got "${str}")`);
  }
  return BigInt(str);
}

function parseBpsInteger(raw, label) {
  const str = String(raw).trim();
  if (!/^[0-9]+$/.test(str)) {
    throw new Error(`${label}: must be an integer in [0, 10000] (got "${str}")`);
  }
  const n = Number(str);
  if (!Number.isInteger(n) || n < 0 || n > 10000) {
    throw new Error(`${label}: must be an integer in [0, 10000] (got "${str}")`);
  }
  return n;
}

function loadValidatorConfig(env) {
  const e = env || {};
  const network = (e.ORBIT_LAUNCH_NETWORK || "base").trim();
  if (!LAUNCH_NETWORKS.includes(network)) {
    throw new Error(
      `ORBIT_LAUNCH_NETWORK: must be one of ${LAUNCH_NETWORKS.join(", ")} (got "${network}")`
    );
  }
  const minGasBalanceRaw = e.ORBIT_LAUNCH_MIN_GAS_BALANCE_WEI || DEFAULT_MIN_GAS_BALANCE_WEI;
  const minGasBalanceWei = parsePositiveBigInt(
    minGasBalanceRaw,
    "ORBIT_LAUNCH_MIN_GAS_BALANCE_WEI"
  );
  const maxDevBuyRaw = e.ORBIT_LAUNCH_MAX_DEV_BUY_BPS_OF_BALANCE !== undefined
    ? e.ORBIT_LAUNCH_MAX_DEV_BUY_BPS_OF_BALANCE
    : DEFAULT_MAX_DEV_BUY_BPS_OF_BALANCE;
  const maxDevBuyBpsOfBalance = parseBpsInteger(
    maxDevBuyRaw,
    "ORBIT_LAUNCH_MAX_DEV_BUY_BPS_OF_BALANCE"
  );
  return {
    network,
    minGasBalanceWei,
    maxDevBuyBpsOfBalance,
    expectedFeeSum: DEFAULT_MIN_TOTAL_FEE_BPS
  };
}

// ---------------------------------------------------------------------------
// Network
// ---------------------------------------------------------------------------

function validateNetwork(network) {
  const name = String(network || "").trim();
  if (!LAUNCH_NETWORKS.includes(name)) {
    return { ok: false, network: name, chainId: null };
  }
  return { ok: true, network: name, chainId: CHAIN_IDS[name] };
}

// ---------------------------------------------------------------------------
// Token config
// ---------------------------------------------------------------------------

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim() !== "";
}

function toBigIntOrNull(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "bigint") return value;
  const str = String(value).trim();
  if (str === "") return null;
  if (!/^-?[0-9]+$/.test(str)) return null;
  try {
    return BigInt(str);
  } catch {
    return null;
  }
}

function validateTokenConfig(tokenConfig) {
  const issues = [];
  const summary = {
    rewardRecipientCount: 0,
    feeSumBps: 0,
    tokenAdminChecksumOk: false,
    pairedTokenChecksumOk: null
  };

  if (!tokenConfig || typeof tokenConfig !== "object" || Array.isArray(tokenConfig)) {
    issues.push({
      field: "tokenConfig",
      severity: "error",
      reason: "tokenConfig must be an object"
    });
    return { ok: false, issues, summary };
  }

  // name
  if (!isNonEmptyString(tokenConfig.name)) {
    issues.push({
      field: "name",
      severity: "error",
      reason: "name is required and must be a non-empty string"
    });
  }

  // symbol — 3..10 chars, non-empty
  const symbol = tokenConfig.symbol;
  if (!isNonEmptyString(symbol)) {
    issues.push({
      field: "symbol",
      severity: "error",
      reason: "symbol is required and must be a non-empty string"
    });
  } else {
    const symLen = symbol.trim().length;
    if (symLen < 3 || symLen > 10) {
      issues.push({
        field: "symbol",
        severity: "error",
        reason: `symbol length must be 3-10 chars (got ${symLen})`
      });
    }
  }

  // totalSupply > 0 (only validated if present — some configs omit it and
  // let the SDK default apply)
  if (tokenConfig.totalSupply !== undefined && tokenConfig.totalSupply !== null) {
    const supply = toBigIntOrNull(tokenConfig.totalSupply);
    if (supply === null) {
      issues.push({
        field: "totalSupply",
        severity: "error",
        reason: "totalSupply must be a non-negative integer (bigint or string)"
      });
    } else if (supply <= 0n) {
      issues.push({
        field: "totalSupply",
        severity: "error",
        reason: `totalSupply must be > 0 (got ${supply.toString()})`
      });
    }
  }

  // tokenAdmin EIP-55
  const tokenAdmin = tokenConfig.tokenAdmin;
  if (!isNonEmptyString(tokenAdmin)) {
    issues.push({
      field: "tokenAdmin",
      severity: "error",
      reason: "tokenAdmin is required"
    });
  } else if (!isStrictAddress(tokenAdmin)) {
    issues.push({
      field: "tokenAdmin",
      severity: "error",
      reason: "tokenAdmin must be a 0x-prefixed EVM address with valid EIP-55 checksum"
    });
  } else {
    summary.tokenAdminChecksumOk = true;
  }

  // pairedToken (optional)
  if (tokenConfig.pairedToken !== undefined && tokenConfig.pairedToken !== null) {
    if (!isNonEmptyString(tokenConfig.pairedToken) || !isStrictAddress(tokenConfig.pairedToken)) {
      issues.push({
        field: "pairedToken",
        severity: "error",
        reason: "pairedToken must be a 0x-prefixed EVM address with valid EIP-55 checksum"
      });
      summary.pairedTokenChecksumOk = false;
    } else {
      summary.pairedTokenChecksumOk = true;
    }
  }

  // rewardRecipients — both flat and nested under rewards.recipients are
  // accepted (the Clanker v4 SDK uses the nested shape). The validator
  // checks whichever is present; if both, the explicit top-level wins.
  let recipients = tokenConfig.rewardRecipients;
  if (recipients === undefined && tokenConfig.rewards && Array.isArray(tokenConfig.rewards.recipients)) {
    recipients = tokenConfig.rewards.recipients;
  }

  if (!Array.isArray(recipients)) {
    issues.push({
      field: "rewardRecipients",
      severity: "error",
      reason: "rewardRecipients (or rewards.recipients) must be an array"
    });
    return { ok: issues.length === 0, issues, summary };
  }

  summary.rewardRecipientCount = recipients.length;

  if (recipients.length === 0) {
    issues.push({
      field: "rewardRecipients",
      severity: "error",
      reason: "rewardRecipients must have at least one entry"
    });
  }

  // BPS sum (BigInt math, even though individual bps fit in Number — BigInt
  // is uniform with totalSupply / wei math and avoids any temptation to mix
  // representations).
  let bpsSum = 0n;
  recipients.forEach((entry, idx) => {
    const field = `rewardRecipients[${idx}]`;
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      issues.push({
        field,
        severity: "error",
        reason: "rewardRecipient must be an object"
      });
      return;
    }
    // recipient address must be EIP-55 strict
    const rcpt = entry.recipient;
    if (!isNonEmptyString(rcpt)) {
      issues.push({
        field: `${field}.recipient`,
        severity: "error",
        reason: "recipient address is required"
      });
    } else if (!isStrictAddress(rcpt)) {
      issues.push({
        field: `${field}.recipient`,
        severity: "error",
        reason: "recipient must be a 0x-prefixed EVM address with valid EIP-55 checksum"
      });
    }

    // bps must be an integer in [0, 10000]
    const bps = entry.bps;
    if (typeof bps !== "number" || !Number.isInteger(bps) || bps < 0 || bps > 10000) {
      issues.push({
        field: `${field}.bps`,
        severity: "error",
        reason: `bps must be an integer in [0, 10000] (got ${JSON.stringify(bps)})`
      });
    } else {
      bpsSum += BigInt(bps);
    }
  });

  summary.feeSumBps = Number(bpsSum);

  if (bpsSum !== BigInt(DEFAULT_MIN_TOTAL_FEE_BPS)) {
    issues.push({
      field: "rewardRecipients[].bps",
      severity: "error",
      reason: `bps must sum to ${DEFAULT_MIN_TOTAL_FEE_BPS} (got ${bpsSum.toString()})`
    });
  }

  return {
    ok: issues.filter((i) => i.severity === "error").length === 0,
    issues,
    summary
  };
}

// ---------------------------------------------------------------------------
// Wallet state
// ---------------------------------------------------------------------------

function validateWalletState(walletState, devBuyWei, config) {
  const issues = [];
  if (!walletState || typeof walletState !== "object") {
    issues.push({
      field: "walletState",
      severity: "error",
      reason: "walletState must be an object with balanceWei and address"
    });
    return { ok: false, issues, headroomWei: "0", devBuyBpsOfBalance: 0 };
  }

  if (!isNonEmptyString(walletState.address) || !isStrictAddress(walletState.address)) {
    issues.push({
      field: "walletState.address",
      severity: "error",
      reason: "wallet address must be a 0x-prefixed EVM address with valid EIP-55 checksum"
    });
  }

  const balance = toBigIntOrNull(walletState.balanceWei);
  if (balance === null || balance < 0n) {
    issues.push({
      field: "walletState.balanceWei",
      severity: "error",
      reason: "balanceWei must be a non-negative integer (bigint or string)"
    });
    return { ok: false, issues, headroomWei: "0", devBuyBpsOfBalance: 0 };
  }

  const dev = toBigIntOrNull(devBuyWei) ?? 0n;
  if (dev < 0n) {
    issues.push({
      field: "devBuyWei",
      severity: "error",
      reason: "devBuyWei must be non-negative"
    });
  }

  const required = dev + config.minGasBalanceWei;
  const headroom = balance - required; // may be negative

  if (balance < required) {
    issues.push({
      field: "walletState.balanceWei",
      severity: "error",
      reason:
        `balance (${balance.toString()}) is less than devBuyWei + minGasBalanceWei ` +
        `(${dev.toString()} + ${config.minGasBalanceWei.toString()} = ${required.toString()}); ` +
        `headroom=${headroom.toString()} wei`
    });
  }

  // devBuy as bps of balance — only meaningful when balance > 0 AND dev > 0.
  let devBuyBpsOfBalance = 0;
  if (balance > 0n && dev > 0n) {
    // bps = floor(dev * 10000 / balance); ceiling so we err on the side of
    // catching over-spend (10000 cap retained).
    const bpsBig = (dev * 10000n + balance - 1n) / balance;
    devBuyBpsOfBalance = bpsBig > 10000n ? 10000 : Number(bpsBig);
    if (devBuyBpsOfBalance > config.maxDevBuyBpsOfBalance) {
      issues.push({
        field: "devBuyWei",
        severity: "error",
        reason:
          `devBuyWei is ${devBuyBpsOfBalance} bps of wallet balance ` +
          `(max ${config.maxDevBuyBpsOfBalance} bps); shrink the dev buy or top up the wallet`
      });
    }
  }

  return {
    ok: issues.filter((i) => i.severity === "error").length === 0,
    issues,
    headroomWei: headroom.toString(),
    devBuyBpsOfBalance
  };
}

// ---------------------------------------------------------------------------
// Safes
// ---------------------------------------------------------------------------

function validateSafesReachable(safesResult) {
  const issues = [];
  const categoryCounts = { treasury: 0, business: 0, operations: 0 };

  if (!safesResult || typeof safesResult !== "object") {
    issues.push({
      field: "safesResult",
      severity: "error",
      reason: "safesResult must be the object returned by safes.loadSafes(env)"
    });
    return { ok: false, issues, categoryCounts };
  }

  const safesList = Array.isArray(safesResult.safes) ? safesResult.safes : [];

  if (safesList.length !== 7) {
    issues.push({
      field: "safes",
      severity: "error",
      reason: `expected 7 D-019 Safes (got ${safesList.length})`
    });
  }

  const missing = Array.isArray(safesResult.missing) ? safesResult.missing : [];
  if (missing.length > 0) {
    issues.push({
      field: "safes.missing",
      severity: "error",
      reason: `missing Safes: ${missing.join(", ")}`
    });
  }

  for (const safe of safesList) {
    if (!safe.valid) {
      issues.push({
        field: `safes.${safe.id}`,
        severity: "error",
        reason: `safe '${safe.id}' is not valid (reason=${safe.reason || "unknown"})`
      });
    }
    if (safe.category && categoryCounts[safe.category] !== undefined && safe.valid) {
      categoryCounts[safe.category] += 1;
    }
  }

  // Uniqueness across the 7 — loadSafes already detects this and marks
  // them as duplicate, but we re-check independently so a buggy loadSafes
  // upstream cannot mask the error.
  const seen = new Map();
  for (const safe of safesList) {
    if (!safe.address) continue;
    const key = String(safe.address).toLowerCase();
    if (!seen.has(key)) seen.set(key, []);
    seen.get(key).push(safe.id);
  }
  for (const [addr, ids] of seen.entries()) {
    if (ids.length > 1) {
      issues.push({
        field: "safes.duplicate",
        severity: "error",
        reason: `address ${addr} reused across Safes: ${ids.join(", ")}`
      });
    }
  }

  const conflicts = Array.isArray(safesResult.conflicts) ? safesResult.conflicts : [];
  if (conflicts.length > 0) {
    // Add once; loadSafes signal we forward, but de-duped against our own
    // uniqueness check above.
    issues.push({
      field: "safes.conflicts",
      severity: "error",
      reason: `loadSafes reported ${conflicts.length} conflict(s)`
    });
  }

  return {
    ok: issues.filter((i) => i.severity === "error").length === 0,
    issues,
    categoryCounts
  };
}

// ---------------------------------------------------------------------------
// Fee floor / launch idempotency
// ---------------------------------------------------------------------------

function validateFeeFloorReady(treasury, state) {
  const issues = [];

  const t = treasury && typeof treasury === "object" ? treasury : {};
  const s = state && typeof state === "object" ? state : {};

  const hasRevenue = !!(
    (t.revenue && typeof t.revenue === "object") ||
    (Array.isArray(t.streams) && t.streams.length > 0)
  );
  if (!hasRevenue) {
    issues.push({
      field: "treasury.revenue",
      severity: "error",
      reason: "treasury has neither legacy revenue object nor streams[] — revenue policy missing"
    });
  }

  const currentLaunchStatus = (t.token && t.token.launchStatus) || "not_launched";
  if (currentLaunchStatus === "launched") {
    issues.push({
      field: "treasury.token.launchStatus",
      severity: "error",
      reason: "treasury.token.launchStatus is already 'launched' — re-launch refused"
    });
  }

  const launchOnceFired = s.launchOnceFired === true;
  if (launchOnceFired) {
    issues.push({
      field: "state.launchOnceFired",
      severity: "error",
      reason: "state.launchOnceFired is true — D-019 / S-LAUNCH-1 once-only guarantee"
    });
  }

  return {
    ok: issues.filter((i) => i.severity === "error").length === 0,
    issues,
    currentLaunchStatus,
    launchOnceFired
  };
}

// ---------------------------------------------------------------------------
// Aggregate
// ---------------------------------------------------------------------------

function safeRun(label, fn) {
  try {
    return fn();
  } catch (err) {
    return {
      ok: false,
      issues: [
        {
          field: label,
          severity: "error",
          reason: `validator threw: ${err && err.message ? err.message : String(err)}`
        }
      ],
      __threw: true
    };
  }
}

function validateLaunchReady(inputs, env) {
  const subResults = {};
  const allIssues = [];
  let cfg = null;

  // Load config once. A failure here is its own surfaced issue but does NOT
  // abort the remaining checks — we fall back to default-shaped config so
  // wallet / token validators can still run.
  try {
    cfg = loadValidatorConfig(env);
  } catch (err) {
    allIssues.push({
      source: "config",
      field: "ORBIT_LAUNCH_*",
      severity: "error",
      reason: err.message
    });
    cfg = {
      network: "base",
      minGasBalanceWei: BigInt(DEFAULT_MIN_GAS_BALANCE_WEI),
      maxDevBuyBpsOfBalance: DEFAULT_MAX_DEV_BUY_BPS_OF_BALANCE,
      expectedFeeSum: DEFAULT_MIN_TOTAL_FEE_BPS
    };
  }

  const ins = inputs || {};

  subResults.network = safeRun("network", () => validateNetwork(cfg.network));
  subResults.tokenConfig = safeRun("tokenConfig", () => validateTokenConfig(ins.tokenConfig));
  subResults.walletState = safeRun("walletState", () =>
    validateWalletState(ins.walletState, ins.devBuyWei, cfg)
  );
  subResults.safes = safeRun("safes", () => validateSafesReachable(ins.safesResult));
  subResults.feeFloor = safeRun("feeFloor", () => validateFeeFloorReady(ins.treasury, ins.state));

  // Surface a network failure as an issue (sub-validator returns ok:false
  // without populating `issues` for the simple bool case).
  if (subResults.network && subResults.network.ok === false && !Array.isArray(subResults.network.issues)) {
    allIssues.push({
      source: "network",
      field: "network",
      severity: "error",
      reason: `unsupported network '${subResults.network.network}'`
    });
  }

  for (const [source, result] of Object.entries(subResults)) {
    if (!result) continue;
    const issues = Array.isArray(result.issues) ? result.issues : [];
    for (const issue of issues) {
      allIssues.push({
        source,
        field: issue.field,
        severity: issue.severity || "error",
        reason: issue.reason
      });
    }
  }

  const errorCount = allIssues.filter((i) => i.severity === "error").length;
  const warnCount = allIssues.filter((i) => i.severity === "warn").length;

  const ok = errorCount === 0;

  let summary;
  if (errorCount > 0) {
    summary = `FAIL: ${errorCount} issue${errorCount === 1 ? "" : "s"}`;
  } else if (warnCount > 0) {
    summary = `WARN: ${warnCount} warning${warnCount === 1 ? "" : "s"}`;
  } else {
    // Count of subvalidators that passed (5 sections + config => 6 if cfg
    // ok, otherwise 5).
    const passCount = Object.values(subResults).filter((r) => r && r.ok).length;
    summary = `PASS: ${passCount} check${passCount === 1 ? "" : "s"}`;
  }

  return {
    ok,
    subResults,
    allIssues,
    summary,
    exitCode: ok ? 0 : 1
  };
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function markerFor(result) {
  if (!result) return "FAIL";
  if (result.ok === true) {
    const warns = Array.isArray(result.issues)
      ? result.issues.filter((i) => i.severity === "warn").length
      : 0;
    return warns > 0 ? "WARN" : "PASS";
  }
  return "FAIL";
}

const SECTION_ORDER = ["network", "tokenConfig", "walletState", "safes", "feeFloor"];

function renderValidationReport(result) {
  const lines = [];
  lines.push("Orbit launch validator - deep preflight");
  lines.push("");
  for (const name of SECTION_ORDER) {
    const sub = result.subResults && result.subResults[name];
    const m = markerFor(sub);
    lines.push(`[${m}] ${name}`);
    const issues = sub && Array.isArray(sub.issues) ? sub.issues : [];
    for (const issue of issues) {
      const sev = (issue.severity || "error").toUpperCase();
      lines.push(`    - ${sev} ${issue.field}: ${issue.reason}`);
    }
    if (sub && sub.ok && issues.length === 0) {
      // Render compact one-liner summaries where useful.
      if (name === "network" && sub.network) {
        lines.push(`    - network=${sub.network} chainId=${sub.chainId}`);
      }
      if (name === "tokenConfig" && sub.summary) {
        lines.push(
          `    - recipients=${sub.summary.rewardRecipientCount} feeSumBps=${sub.summary.feeSumBps}`
        );
      }
      if (name === "walletState" && sub.headroomWei !== undefined) {
        lines.push(
          `    - headroomWei=${sub.headroomWei} devBuyBpsOfBalance=${sub.devBuyBpsOfBalance}`
        );
      }
      if (name === "safes" && sub.categoryCounts) {
        const c = sub.categoryCounts;
        lines.push(
          `    - treasury=${c.treasury} business=${c.business} operations=${c.operations}`
        );
      }
      if (name === "feeFloor") {
        lines.push(
          `    - launchStatus=${sub.currentLaunchStatus} launchOnceFired=${sub.launchOnceFired}`
        );
      }
    }
  }
  lines.push("");
  lines.push(`${result.summary} (exit ${result.exitCode})`);
  return lines.join("\n");
}

module.exports = {
  DEFAULT_MAX_DEV_BUY_BPS_OF_BALANCE,
  DEFAULT_MIN_GAS_BALANCE_WEI,
  DEFAULT_MIN_TOTAL_FEE_BPS,
  DEFAULT_MAX_TOTAL_FEE_BPS,
  LAUNCH_NETWORKS,
  loadValidatorConfig,
  renderValidationReport,
  validateFeeFloorReady,
  validateLaunchReady,
  validateNetwork,
  validateSafesReachable,
  validateTokenConfig,
  validateWalletState
};
