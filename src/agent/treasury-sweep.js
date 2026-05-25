"use strict";

// Treasury weekly sweep (D-019 / TREASURY_ALLOCATION.md).
//
// Every 7 days the Fee Receive Safe is drained 100% to the 6 bucket Safes
// in the bps proportions defined here. One approval issue per sweep
// (D-014), atomic execution (all 6 legs or none).
//
// Hard-blocked behind state.preLaunchVerified per D-018. Until that flips
// AND every bucket Safe address is configured, this module returns
// `blocked_precondition` and never proposes a transfer.
//
// Spec: PLAN/SPECS/TREASURY_ALLOCATION.md
// Decision: PLAN/DECISIONS.md D-019

const crypto = require("crypto");
const feeFloor = require("./fee-floor");
const safes = require("./safes");

const TREASURY_BUCKETS_SCHEMA = "orbit-treasury-buckets/1";
const SWEEP_INTERVAL_DAYS_DEFAULT = 7;
const SWEEP_MIN_WEI_DEFAULT = 10n ** 15n; // 0.001 WETH; below this, defer

// Authoritative bucket allocation per D-019. Bps of the 95% creator-share
// inflow that lands in the Fee Receive Safe. Sum MUST equal 10000.
const BUCKETS = [
  { id: "floor-reserve",     category: "treasury",   bps: 4500, addressEnv: "ORBIT_FLOOR_RESERVE_SAFE" },
  { id: "productive-yield",  category: "treasury",   bps: 2000, addressEnv: "ORBIT_PRODUCTIVE_YIELD_SAFE" },
  { id: "buyback",           category: "business",   bps:  500, addressEnv: "ORBIT_BUYBACK_SAFE" },
  { id: "growth",            category: "business",   bps: 1500, addressEnv: "ORBIT_GROWTH_SAFE" },
  { id: "ai-costs",          category: "operations", bps: 1000, addressEnv: "ORBIT_AI_COSTS_SAFE" },
  { id: "ops-runway",        category: "operations", bps:  500, addressEnv: "ORBIT_OPS_RUNWAY_SAFE" }
];

function validateBpsSum() {
  const sum = BUCKETS.reduce((acc, b) => acc + b.bps, 0);
  if (sum !== 10000) {
    throw new Error(`treasury bucket bps must sum to 10000, got ${sum}`);
  }
}
validateBpsSum();

function bigintFromMaybeString(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "bigint") return value;
  if (typeof value === "number") {
    if (!Number.isInteger(value) || value < 0) return null;
    return BigInt(value);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!/^\d+$/.test(trimmed)) return null;
    try { return BigInt(trimmed); } catch { return null; }
  }
  return null;
}

function sweepWeekFromTimestamp(isoString) {
  const t = Date.parse(isoString);
  if (!Number.isFinite(t)) return 0;
  const epochMs = Date.UTC(2026, 0, 1); // 2026-01-01 anchor
  const elapsed = t - epochMs;
  if (elapsed < 0) return 0;
  return Math.floor(elapsed / (7 * 24 * 60 * 60 * 1000));
}

function computeSweepAmounts(receiveBalanceWei) {
  const balance = bigintFromMaybeString(receiveBalanceWei);
  if (balance === null) {
    return { ok: false, code: "sweep_balance_invalid" };
  }
  if (balance === 0n) {
    return { ok: false, code: "sweep_dust_below_minimum", balance: "0" };
  }
  const amounts = [];
  let allocated = 0n;
  for (let i = 0; i < BUCKETS.length; i += 1) {
    const bucket = BUCKETS[i];
    // Integer division to avoid floats. Remainder accumulates to the LAST
    // bucket so the per-bucket totals sum exactly to the receive balance.
    if (i === BUCKETS.length - 1) {
      const last = balance - allocated;
      amounts.push({ bucket: bucket.id, bps: bucket.bps, amountWei: last.toString() });
    } else {
      const portion = (balance * BigInt(bucket.bps)) / 10000n;
      amounts.push({ bucket: bucket.id, bps: bucket.bps, amountWei: portion.toString() });
      allocated += portion;
    }
  }
  // Sanity: sum back up.
  const sum = amounts.reduce((acc, a) => acc + BigInt(a.amountWei), 0n);
  if (sum !== balance) {
    return { ok: false, code: "sweep_amount_rounding_drift", expected: balance.toString(), got: sum.toString() };
  }
  return { ok: true, amounts, balance: balance.toString() };
}

function computeSweepIdem({ cycle, sweepWeek, balanceWei }) {
  const payload = `treasury-sweep:${cycle}:${sweepWeek}:${balanceWei}`;
  const hash = crypto.createHash("sha256").update(payload).digest("hex");
  return `tsweep-${hash.slice(0, 16)}`;
}

function isSweepEnabled(config, state, env) {
  const reasons = [];
  if (env && env.ORBIT_ENABLE_TREASURY_SWEEP !== "true") reasons.push("ORBIT_ENABLE_TREASURY_SWEEP is not true");
  if (!state || state.preLaunchVerified !== true) reasons.push("state.preLaunchVerified is not true (D-018)");
  if (!state || typeof state.tokenAddress !== "string" || state.tokenAddress.length < 10) {
    reasons.push("state.tokenAddress is not set");
  }
  const blocked = bucketsBlockedReason(env);
  if (blocked !== null) reasons.push(blocked);
  if (reasons.length !== 0) {
    return { enabled: false, reason: reasons.join("; ") };
  }

  // S-FLOOR-1: weekly fee-floor gate.
  //
  // (a) Is the next week boundary due? If not, the gate cannot fire YET —
  //     fees are still accumulating in the current week, no decision time.
  // (b) Has weekly inflow met the floor? If not, SKIP THE WEEK ENTIRELY.
  //     No rollover: the floor must clear in a single week. See
  //     src/agent/fee-floor.js for the precise definition.
  //
  // Inflow basis: current Fee Receive Safe balance MINUS the balance at
  // week-start, clamped to >= 0 (a mid-week sweep can leave the current
  // balance below the snapshot — that does not count as negative inflow).
  // We read both halves from state.feeFloor + state.treasurySweep so this
  // function stays synchronous; the caller is responsible for refreshing
  // state.treasurySweep.lastObservedFeeReceiveBalanceWei before invoking us.
  const floorConfig = feeFloor.loadConfig(env);
  if (!feeFloor.isAtOrPastWeekBoundary(state, new Date(), floorConfig)) {
    return { enabled: false, reason: "fee_floor_check_not_due" };
  }
  const currentBalance = BigInt(
    (state && state.treasurySweep && state.treasurySweep.lastObservedFeeReceiveBalanceWei) || "0"
  );
  const weekInflow = feeFloor.weekInflowSince(state, currentBalance);
  const gate = feeFloor.evaluateGate(weekInflow, floorConfig);
  if (!gate.met) {
    return {
      enabled: false,
      reason: `fee_floor_not_met: weekInflow=${gate.weekInflowWei} wei < floor=${gate.floorWei} wei`
    };
  }

  return { enabled: true };
}

// S-FLOOR-1 helper: callers invoke this AFTER they decide whether to fire
// the weekly on-chain actions (sweep + buyback + operator payout) — or AFTER
// they decide to skip the week — to roll state.feeFloor forward into the
// next observation window. Thin wrapper around feeFloor.startWeek so callers
// don't need to import the fee-floor module directly.
function tryStartNewWeek(state, currentSafeBalanceWei) {
  return feeFloor.startWeek(state, new Date(), currentSafeBalanceWei);
}

function bucketsMissingAddresses(env) {
  // Route through the centralized safes module so validation rules
  // (missing / invalid / duplicate) are consistent across the codebase.
  // Note: despite the name, this returns ALL non-valid Safes (missing,
  // invalid, duplicate). Callers wanting a per-reason breakdown should use
  // bucketsBlockedReason() instead. Kept for backwards-compatibility.
  const result = safes.loadSafes(env);
  const missing = [];
  for (const safe of result.safes) {
    if (safe.valid) continue;
    if (safe.id === "fee-receive") {
      missing.push(`fee-receive (${safe.env})`);
    } else {
      missing.push(`${safe.id} (${safe.env})`);
    }
  }
  return missing;
}

// Group every non-valid Safe by its reason and return a single string
// suitable for the isSweepEnabled.reason field. Returns null if every Safe
// is valid. Output shape:
//   "missing bucket addresses: a (ENV_A), b (ENV_B); invalid: c (ENV_C); duplicate: d (ENV_D), e (ENV_E)"
// Prefixes are omitted for reason groups with zero members. The "missing"
// group keeps the legacy "missing bucket addresses:" prefix when present
// (so existing log greps + tests still match); other groups use short
// "<reason>:" prefixes.
function bucketsBlockedReason(env) {
  const result = safes.loadSafes(env);
  const groups = new Map(); // reason -> ["id (ENV)", ...]
  for (const safe of result.safes) {
    if (safe.valid) continue;
    const reason = safe.reason || "invalid";
    const label = `${safe.id} (${safe.env})`;
    if (!groups.has(reason)) groups.set(reason, []);
    groups.get(reason).push(label);
  }
  if (groups.size === 0) return null;

  // Render in a stable order: missing first (keeps the legacy prefix
  // verbatim), then invalid, duplicate, bad_checksum, then any other.
  const ORDER = ["missing", "invalid", "duplicate", "bad_checksum"];
  const parts = [];
  const seen = new Set();
  for (const reason of ORDER) {
    if (!groups.has(reason)) continue;
    parts.push(formatReasonGroup(reason, groups.get(reason)));
    seen.add(reason);
  }
  for (const [reason, list] of groups.entries()) {
    if (seen.has(reason)) continue;
    parts.push(formatReasonGroup(reason, list));
  }
  return parts.join("; ");
}

function formatReasonGroup(reason, list) {
  if (reason === "missing") {
    // Keep legacy phrasing so existing log scrapers + tests continue to
    // match `missing bucket addresses:`.
    return `missing bucket addresses: ${list.join(", ")}`;
  }
  return `${reason}: ${list.join(", ")}`;
}

function alreadySwept(state, sweepWeek) {
  if (!state || !state.treasurySweep || !Array.isArray(state.treasurySweep.history)) return false;
  return state.treasurySweep.history.some((entry) => entry && entry.sweepWeek === sweepWeek && entry.status === "executed");
}

function buildSweepProposal({ cycle, sweepWeek, balanceWei, env, nowIso }) {
  const computed = computeSweepAmounts(balanceWei);
  if (!computed.ok) return computed;
  const idem = computeSweepIdem({ cycle, sweepWeek, balanceWei });
  const lines = [
    "## Treasury Sweep Proposal",
    "",
    `Idem: \`${idem}\``,
    `Cycle: ${cycle}`,
    `Sweep week: ${sweepWeek}`,
    `Source: Fee Receive Safe (${env.ORBIT_TREASURY_SAFE})`,
    `Balance: ${balanceWei} wei WETH`,
    "",
    "| Destination | Address | Bps | Amount (wei) |",
    "|---|---|---|---|"
  ];
  for (const item of computed.amounts) {
    const bucket = BUCKETS.find((b) => b.id === item.bucket);
    const address = env[bucket.addressEnv] || "[unset]";
    lines.push(`| ${item.bucket} | \`${address}\` | ${item.bps} | ${item.amountWei} |`);
  }
  lines.push("");
  lines.push("Per D-014, no transfers happen until the owner approves this issue.");
  lines.push("");
  lines.push(`To approve, comment exactly: \`APPROVE ORBIT-TREASURY-SWEEP ${idem}\``);
  return {
    ok: true,
    idem,
    cycle,
    sweepWeek,
    balanceWei,
    amounts: computed.amounts,
    proposalBody: lines.join("\n"),
    proposedAt: nowIso || new Date().toISOString()
  };
}

function commentApprovesSweep(ownerUsername, comment) {
  if (!comment || typeof comment !== "object") return null;
  const author = (comment.author || (comment.user && comment.user.login) || "").toLowerCase();
  if (!ownerUsername || author !== String(ownerUsername).toLowerCase()) return null;
  const body = typeof comment.body === "string" ? comment.body.trim() : "";
  const match = body.match(/^APPROVE\s+ORBIT-TREASURY-SWEEP\s+(\S+)\s*$/m);
  return match ? match[1] : null;
}

async function proposeTreasurySweep({ config, state, env, cycle, nowIso, fetchBalance, syntheticBalance }) {
  const gate = isSweepEnabled(config, state, env);
  if (!gate.enabled) {
    return { ok: false, blocked: true, reason: gate.reason, status: "blocked_precondition" };
  }
  const nowAt = nowIso || new Date().toISOString();
  const sweepWeek = sweepWeekFromTimestamp(nowAt);
  if (alreadySwept(state, sweepWeek)) {
    return { ok: false, blocked: true, code: "sweep_week_already_executed", sweepWeek };
  }
  let balanceWei;
  try {
    balanceWei = syntheticBalance !== undefined && syntheticBalance !== null
      ? bigintFromMaybeString(syntheticBalance).toString()
      : (await fetchBalance(env.ORBIT_TREASURY_SAFE)).toString();
  } catch (err) {
    return { ok: false, blocked: true, code: "sweep_balance_fetch_failed", error: err.message };
  }
  const minWei = bigintFromMaybeString(config && config.treasurySweepMinWei) || SWEEP_MIN_WEI_DEFAULT;
  if (BigInt(balanceWei) < minWei) {
    return { ok: false, blocked: true, code: "sweep_dust_below_minimum", balanceWei, minWei: minWei.toString(), sweepWeek };
  }
  const proposal = buildSweepProposal({ cycle, sweepWeek, balanceWei, env, nowIso: nowAt });
  return proposal;
}

function recordSweepExecution(state, { idem, sweepWeek, cycle, amounts, txHash, status }) {
  const base = state && typeof state === "object" ? state : {};
  const sweep = base.treasurySweep && typeof base.treasurySweep === "object" ? { ...base.treasurySweep } : {};
  const history = Array.isArray(sweep.history) ? [...sweep.history] : [];
  history.push({
    idem,
    sweepWeek,
    cycle,
    amounts,
    txHash: txHash || null,
    status: status || "executed",
    executedAt: new Date().toISOString()
  });
  sweep.history = history;
  sweep.lastSweepWeek = sweepWeek;
  sweep.lastSweepAt = new Date().toISOString();
  sweep.lastSweepIdem = idem;
  return { ...base, treasurySweep: sweep };
}

// S-REVENUE-1 helper: expose the current and previous-observation Fee Receive
// Safe balance snapshots from `state.treasurySweep` + `state.feeFloor` so the
// market-signals collector can compute a 24h-ish WETH inflow signal without
// reaching into either piece of state directly. This is read-only; it never
// mutates state and never queries the chain. Returns:
//   { currentWei: "string"|null, baselineWei: "string"|null,
//     baselineSource: "feeFloor.weekStartBalanceWei"|null }
// If neither half is available, returns nulls — the caller treats that as
// "no signal yet" and skips this cycle's record.
function getFeeReceiveSafeBalanceSnapshot(state) {
  const sweep = state && state.treasurySweep;
  const feeFloorState = state && state.feeFloor;
  const currentRaw = sweep && sweep.lastObservedFeeReceiveBalanceWei;
  const baselineRaw = feeFloorState && feeFloorState.weekStartBalanceWei;
  const currentWei = (typeof currentRaw === "string" && /^\d+$/.test(currentRaw))
    ? currentRaw
    : null;
  const baselineWei = (typeof baselineRaw === "string" && /^\d+$/.test(baselineRaw))
    ? baselineRaw
    : null;
  return {
    currentWei,
    baselineWei,
    baselineSource: baselineWei !== null ? "feeFloor.weekStartBalanceWei" : null,
    weekStartedAt: feeFloorState && typeof feeFloorState.weekStartedAt === "string"
      ? feeFloorState.weekStartedAt
      : null
  };
}

function projectTreasuryBuckets(state, balanceByEnv, env) {
  const e = env || {};
  const balances = balanceByEnv || {};
  const history = (state && state.treasurySweep && Array.isArray(state.treasurySweep.history))
    ? state.treasurySweep.history
    : [];
  const lastEntry = history.length > 0 ? history[history.length - 1] : null;
  return {
    schema: TREASURY_BUCKETS_SCHEMA,
    sweep: {
      lastSweepWeek: lastEntry ? lastEntry.sweepWeek : null,
      lastSweepAt: lastEntry ? lastEntry.executedAt : null,
      lastSweepTotalWei: lastEntry
        ? lastEntry.amounts.reduce((acc, a) => acc + BigInt(a.amountWei), 0n).toString()
        : null,
      nextSweepWeek: lastEntry ? lastEntry.sweepWeek + 1 : null
    },
    list: BUCKETS.map((b) => ({
      id: b.id,
      category: b.category,
      bps: b.bps,
      address: e[b.addressEnv] || null,
      balanceWei: balances[b.addressEnv] !== undefined ? balances[b.addressEnv] : null
    }))
  };
}

module.exports = {
  BUCKETS,
  TREASURY_BUCKETS_SCHEMA,
  SWEEP_INTERVAL_DAYS_DEFAULT,
  SWEEP_MIN_WEI_DEFAULT,
  computeSweepAmounts,
  computeSweepIdem,
  sweepWeekFromTimestamp,
  isSweepEnabled,
  bucketsMissingAddresses,
  bucketsBlockedReason,
  alreadySwept,
  buildSweepProposal,
  commentApprovesSweep,
  proposeTreasurySweep,
  recordSweepExecution,
  projectTreasuryBuckets,
  tryStartNewWeek,
  getFeeReceiveSafeBalanceSnapshot
};
