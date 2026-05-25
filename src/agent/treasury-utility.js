"use strict";

// Treasury-utility ratio cap safeguard (S-REVENUE-2 / D-NEW-021).
//
// The Aragon defense: when aggregated balance across all Orbit-controlled
// Safes exceeds a configurable multiple of the rolling N-day operational
// spend (default 5x over 90 days), the entity has become a bigger target
// than the work it does. This module computes the ratio and proposes a
// rebate that brings holdings back to the cap. It does not execute the
// rebate. The owner gates real spend via the D-014 approval pipeline.
//
// PURE module. No I/O, no clock except what callers pass in via opts.now,
// no RPC, no file writes. BigInt for wei throughout; Number only for the
// (bounded by definition) ratio.
//
// UNIT-OF-ACCOUNT for AI spend: aligned with ai-routing-margin.js. The
// AI ledger stores USD (estimatedUsd) as a fractional number. To compare
// with wei treasury balances we scale 1 USD == 1e18 wei. That is the same
// convention the revenue-stream margin uses.

const USD_TO_WEI_SCALE = 1000000000000000000n; // 10^18
const DAY_MS = 86400000;

const DEFAULT_RATIO_CAP = 5;
const DEFAULT_WINDOW_DAYS = 90;
const DEFAULT_REBATE_TARGET = "operator";

const RATIO_CAP_MIN = 2;
const RATIO_CAP_MAX = 20;
const WINDOW_DAYS_MIN = 7;
const WINDOW_DAYS_MAX = 365;
const VALID_REBATE_TARGETS = ["operator", "growth", "split"];

// 3-decimal precision when expressing the ratio as a Number. The Number
// is only a derived view of the BigInt-precise comparison.
const RATIO_SCALE = 1000n;

function pickEnv(env) {
  return env && typeof env === "object" ? env : {};
}

function parseIntStrict(raw, name) {
  if (raw === undefined || raw === null) return null;
  const trimmed = String(raw).trim();
  if (trimmed === "") return null;
  if (!/^-?\d+$/.test(trimmed)) {
    throw new Error(`${name} must be an integer; received ${raw}`);
  }
  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${name} must be a finite integer; received ${raw}`);
  }
  return parsed;
}

function loadConfig(env) {
  const source = pickEnv(env);

  const ratioRaw = parseIntStrict(source.ORBIT_TREASURY_UTILITY_CAP, "ORBIT_TREASURY_UTILITY_CAP");
  const ratioCap = ratioRaw === null ? DEFAULT_RATIO_CAP : ratioRaw;
  if (ratioCap < RATIO_CAP_MIN || ratioCap > RATIO_CAP_MAX) {
    throw new Error(
      `ORBIT_TREASURY_UTILITY_CAP must be in [${RATIO_CAP_MIN}, ${RATIO_CAP_MAX}]; received ${ratioCap}`
    );
  }

  const windowRaw = parseIntStrict(
    source.ORBIT_TREASURY_UTILITY_WINDOW_DAYS,
    "ORBIT_TREASURY_UTILITY_WINDOW_DAYS"
  );
  const windowDays = windowRaw === null ? DEFAULT_WINDOW_DAYS : windowRaw;
  if (windowDays < WINDOW_DAYS_MIN || windowDays > WINDOW_DAYS_MAX) {
    throw new Error(
      `ORBIT_TREASURY_UTILITY_WINDOW_DAYS must be in [${WINDOW_DAYS_MIN}, ${WINDOW_DAYS_MAX}]; received ${windowDays}`
    );
  }

  const targetRaw = source.ORBIT_TREASURY_UTILITY_REBATE_TARGET;
  const rebateTarget =
    targetRaw === undefined || targetRaw === null || String(targetRaw).trim() === ""
      ? DEFAULT_REBATE_TARGET
      : String(targetRaw).trim();
  if (!VALID_REBATE_TARGETS.includes(rebateTarget)) {
    throw new Error(
      `ORBIT_TREASURY_UTILITY_REBATE_TARGET must be one of ${VALID_REBATE_TARGETS.join("/")}; received ${targetRaw}`
    );
  }

  return { ratioCap, windowDays, rebateTarget };
}

function toBigIntWei(value) {
  if (value === null || value === undefined) return 0n;
  if (typeof value === "bigint") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return 0n;
    if (Number.isInteger(value)) return BigInt(value);
    // Allow fractional numbers here only as a defensive fallback. Treat
    // them as truncated integers — the producer should have stored a
    // string for full precision.
    return BigInt(Math.trunc(value));
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") return 0n;
    if (!/^-?\d+$/.test(trimmed)) return 0n;
    try {
      return BigInt(trimmed);
    } catch (_err) {
      return 0n;
    }
  }
  return 0n;
}

function usdToWei(usd) {
  if (typeof usd !== "number" || !Number.isFinite(usd) || usd <= 0) return 0n;
  // Scale to micro-USD (6 decimals) then multiply by 10^12 to land on wei.
  // This preserves cent-level precision without floating-point drift.
  const micro = BigInt(Math.round(usd * 1000000));
  if (micro <= 0n) return 0n;
  return micro * 1000000000000n; // 1e12, completes the 1e18 scaling
}

function resolveNow(now) {
  if (now instanceof Date) return now;
  if (typeof now === "number" && Number.isFinite(now)) return new Date(now);
  if (typeof now === "string" && now.trim() !== "") {
    const parsed = new Date(now);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
}

function entryTimestamp(entry) {
  if (!entry || typeof entry !== "object") return null;
  const candidates = [
    entry.timestamp,
    entry.ts,
    entry.at,
    entry.recordedAt,
    entry.createdAt
  ];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const parsed = new Date(candidate);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

function entryWeiCost(entry) {
  if (!entry || typeof entry !== "object") return 0n;
  // Prefer an explicit wei field if present.
  if (entry.costWei !== undefined) return toBigIntWei(entry.costWei);
  if (entry.spendWei !== undefined) return toBigIntWei(entry.spendWei);
  if (entry.amountWei !== undefined) return toBigIntWei(entry.amountWei);
  if (entry.weiCost !== undefined) return toBigIntWei(entry.weiCost);
  // Fall back to USD-scaled-to-wei from the AI ledger convention.
  if (typeof entry.estimatedUsd === "number") return usdToWei(entry.estimatedUsd);
  if (typeof entry.usd === "number") return usdToWei(entry.usd);
  if (typeof entry.costUsd === "number") return usdToWei(entry.costUsd);
  return 0n;
}

function sumWithinWindow(entries, cutoffMs, nowMs) {
  if (!Array.isArray(entries)) return 0n;
  let total = 0n;
  for (const entry of entries) {
    const ts = entryTimestamp(entry);
    if (!ts) continue;
    const ms = ts.getTime();
    if (Number.isNaN(ms)) continue;
    if (ms < cutoffMs || ms > nowMs) continue;
    total += entryWeiCost(entry);
  }
  return total;
}

function isSpendTagged(entry) {
  if (!entry || typeof entry !== "object") return false;
  const tag = entry.kind || entry.type || entry.category;
  if (typeof tag !== "string") return false;
  const lower = tag.toLowerCase();
  return lower === "spend" || lower === "gas" || lower === "expense" || lower === "operational";
}

function rollingSpendWei(treasury, windowDays, now) {
  const safeTreasury = treasury && typeof treasury === "object" ? treasury : {};
  const days = Number.isFinite(windowDays) && windowDays > 0 ? Math.floor(windowDays) : DEFAULT_WINDOW_DAYS;
  const resolvedNow = resolveNow(now);
  const nowMs = resolvedNow.getTime();
  const cutoffMs = nowMs - days * DAY_MS;

  let total = 0n;

  // 1) AI usage. The spec calls it `treasury.ai.recentUsage[]` but the
  // on-disk treasury uses `treasury.ai.ledger[]`. Honour both.
  const ai = safeTreasury.ai && typeof safeTreasury.ai === "object" ? safeTreasury.ai : null;
  if (ai) {
    if (Array.isArray(ai.recentUsage)) {
      total += sumWithinWindow(ai.recentUsage, cutoffMs, nowMs);
    }
    if (Array.isArray(ai.ledger)) {
      total += sumWithinWindow(ai.ledger, cutoffMs, nowMs);
    }
  }

  // 2) Generic expense ledger.
  if (Array.isArray(safeTreasury.expenses)) {
    total += sumWithinWindow(safeTreasury.expenses, cutoffMs, nowMs);
  }

  // 3) Revenue-stream lastClaim entries — only if explicitly tagged as
  // spend (e.g. gas paid to execute the claim). Revenue inflows are NEVER
  // counted as operational spend.
  const revenue = safeTreasury.revenue && typeof safeTreasury.revenue === "object" ? safeTreasury.revenue : null;
  if (revenue && Array.isArray(revenue.streams)) {
    for (const stream of revenue.streams) {
      if (!stream || typeof stream !== "object") continue;
      const lastClaim = stream.lastClaim;
      if (!lastClaim || typeof lastClaim !== "object") continue;
      if (!isSpendTagged(lastClaim)) continue;
      const ts = entryTimestamp(lastClaim);
      if (!ts) continue;
      const ms = ts.getTime();
      if (ms < cutoffMs || ms > nowMs) continue;
      total += entryWeiCost(lastClaim);
    }
  }

  return total;
}

function treasuryHoldingsWei(treasury) {
  const safeTreasury = treasury && typeof treasury === "object" ? treasury : {};
  let total = 0n;

  // Spec'd source of truth: per-bucket balanceWei.
  const buckets = safeTreasury.buckets;
  if (Array.isArray(buckets)) {
    for (const bucket of buckets) {
      if (!bucket || typeof bucket !== "object") continue;
      if (bucket.balanceWei !== undefined) total += toBigIntWei(bucket.balanceWei);
      else if (bucket.balance !== undefined) total += toBigIntWei(bucket.balance);
    }
    if (total > 0n) return total;
  } else if (buckets && typeof buckets === "object" && Array.isArray(buckets.list)) {
    for (const bucket of buckets.list) {
      if (!bucket || typeof bucket !== "object") continue;
      if (bucket.balanceWei !== undefined) total += toBigIntWei(bucket.balanceWei);
      else if (bucket.balance !== undefined) total += toBigIntWei(bucket.balance);
    }
    if (total > 0n) return total;
  }

  // Fallbacks for older shapes.
  if (safeTreasury.totalHoldingsWei !== undefined) {
    return toBigIntWei(safeTreasury.totalHoldingsWei);
  }
  if (safeTreasury.totalHoldings !== undefined) {
    return toBigIntWei(safeTreasury.totalHoldings);
  }
  return 0n;
}

function ratioFromWei(treasuryWei, spendWei) {
  if (spendWei <= 0n) return Infinity;
  // (treasuryWei * 1000 / spendWei) / 1000 — 3 decimals of precision.
  const scaled = (treasuryWei * RATIO_SCALE) / spendWei;
  const num = Number(scaled) / Number(RATIO_SCALE);
  return Number.isFinite(num) ? num : Infinity;
}

function computeRatio(treasury, env, opts) {
  const config = loadConfig(env);
  const options = opts && typeof opts === "object" ? opts : {};
  const spendWei = rollingSpendWei(treasury, config.windowDays, options.now);
  const extra = options.feeReceiveBalanceWei !== undefined
    ? toBigIntWei(options.feeReceiveBalanceWei)
    : 0n;
  const treasuryWei = treasuryHoldingsWei(treasury) + extra;
  const ratio = ratioFromWei(treasuryWei, spendWei);
  const ok = spendWei > 0n;
  return {
    ratio,
    treasuryWei,
    spendWei,
    windowDays: config.windowDays,
    ok
  };
}

function isRatioOverCap(ratio, env) {
  const config = loadConfig(env);
  if (!Number.isFinite(ratio)) return false; // Infinity / NaN -> fail-safe
  return ratio > config.ratioCap;
}

function shortHash(input) {
  // Deterministic 6-char fingerprint from a string. Pure JS, no crypto.
  let h = 2166136261 >>> 0; // FNV-1a 32-bit
  const s = String(input);
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h.toString(16).padStart(8, "0").slice(0, 6);
}

function isoDayUtc(date) {
  return date.toISOString().slice(0, 10);
}

function rebateTargets(target) {
  switch (target) {
    case "growth":
      return [{ recipient: "growth-safe", bps: 10000 }];
    case "split":
      return [
        { recipient: "operator", bps: 5000 },
        { recipient: "growth-safe", bps: 5000 }
      ];
    case "operator":
    default:
      return [{ recipient: "operator", bps: 10000 }];
  }
}

function proposeRebate(treasury, ratioReport, env, opts) {
  const config = loadConfig(env);
  const options = opts && typeof opts === "object" ? opts : {};
  const now = resolveNow(options.now);
  const report = ratioReport && typeof ratioReport === "object" ? ratioReport : computeRatio(treasury, env, options);

  const spendWei = toBigIntWei(report.spendWei);
  const treasuryWei = toBigIntWei(report.treasuryWei);

  // Build the target treasury wei at the cap using BigInt math against the
  // 3-decimal-scaled ratio cap, so we never reintroduce float drift.
  const capScaled = BigInt(Math.floor(config.ratioCap * 1000));
  const targetTreasuryWei = (spendWei * capScaled) / 1000n;
  const excessWei = treasuryWei - targetTreasuryWei;

  if (spendWei <= 0n || excessWei <= 0n) {
    return {
      proposalId: null,
      proposedAt: now.toISOString(),
      amountWei: "0",
      targets: [],
      reason: "no_excess",
      ratioReport: report,
      needsOwnerApproval: false
    };
  }

  const fingerprint = shortHash(`${excessWei.toString()}|${spendWei.toString()}|${config.ratioCap}|${config.rebateTarget}`);
  const proposalId = `rebate-${isoDayUtc(now)}-${fingerprint}`;
  const ratioStr =
    Number.isFinite(report.ratio) ? String(report.ratio) : "Infinity";

  return {
    proposalId,
    proposedAt: now.toISOString(),
    amountWei: excessWei.toString(),
    targets: rebateTargets(config.rebateTarget),
    reason: `ratio=${ratioStr} > cap=${config.ratioCap}; reducing treasury holdings`,
    ratioReport: report,
    needsOwnerApproval: true
  };
}

function summarizeUtility(treasury, env, opts) {
  const config = loadConfig(env);
  const report = computeRatio(treasury, env, opts);
  const approachingCapThreshold = 0.8 * config.ratioCap;
  const isOverCap = isRatioOverCap(report.ratio, env);

  let recommendation;
  if (!Number.isFinite(report.ratio)) {
    // No data yet — we cannot recommend either way. Treat as "ok" since
    // the cap is fail-safe (does not fire without spend history).
    recommendation = "ok";
  } else if (isOverCap) {
    recommendation = "over_cap";
  } else if (report.ratio >= approachingCapThreshold) {
    recommendation = "approaching_cap";
  } else {
    recommendation = "ok";
  }

  return {
    ratio: report.ratio,
    ratioCap: config.ratioCap,
    isOverCap,
    treasuryWei: report.treasuryWei.toString(),
    spendWei: report.spendWei.toString(),
    windowDays: config.windowDays,
    recommendation,
    approachingCapThreshold
  };
}

module.exports = {
  DEFAULT_RATIO_CAP,
  DEFAULT_REBATE_TARGET,
  DEFAULT_WINDOW_DAYS,
  computeRatio,
  isRatioOverCap,
  loadConfig,
  proposeRebate,
  rollingSpendWei,
  summarizeUtility,
  treasuryHoldingsWei
};
