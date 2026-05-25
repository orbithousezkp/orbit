"use strict";

// S-REVENUE-3: Sybil / wash-trading floor.
//
// Background:
//   MYX lost ~$170M to a Sybil exploit (an attacker funded many fresh wallets
//   from one source and drained an airdrop). Independent research on Base /
//   Uniswap v3 pools estimates ~70% of low-cap pool volume is wash trading
//   between addresses controlled by the same operator.
//
//   Any Orbit transition that PRODUCES SPEND (revenue surface, airdrop, fee
//   distribution, mission payout) must therefore satisfy a per-funder gate:
//     1. A minimum number of UNIQUE funder addresses contributed.
//     2. No single funder dominates (concentration cap, default 50%).
//     3. Every contributing wallet is at least N days old (defends against
//        the cheapest Sybil class: fresh wallets funded out of one tap).
//
// This module is a PURE gate. It performs no I/O. The caller is responsible
// for fetching `firstSeenAt` per funder (typically by checking the address's
// first on-chain nonce via viem RPC, then caching it). The caller then hands
// the resulting array to `evaluateFunders` or `assertSybilFloorMet`.

const DEFAULT_MIN_WALLET_AGE_DAYS = 30;
const DEFAULT_MIN_UNIQUE_FUNDERS = 3;
const DEFAULT_MAX_CONCENTRATION_BPS = 5000; // 50%

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const BPS_DENOM = 10000n;

function parseIntInRange(raw, min, max, name) {
  const trimmed = String(raw).trim();
  if (!/^-?\d+$/.test(trimmed)) {
    throw new Error(`${name} must be an integer, got: ${raw}`);
  }
  const n = Number(trimmed);
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new Error(`${name} must be an integer in [${min}, ${max}], got: ${raw}`);
  }
  return n;
}

function loadConfig(env) {
  const source = env || process.env;

  let minWalletAgeDays = DEFAULT_MIN_WALLET_AGE_DAYS;
  const rawAge = source.ORBIT_SYBIL_MIN_WALLET_AGE_DAYS;
  if (rawAge !== undefined && rawAge !== null && String(rawAge).trim() !== "") {
    minWalletAgeDays = parseIntInRange(rawAge, 0, 365, "ORBIT_SYBIL_MIN_WALLET_AGE_DAYS");
  }

  let minUniqueFunders = DEFAULT_MIN_UNIQUE_FUNDERS;
  const rawFunders = source.ORBIT_SYBIL_MIN_UNIQUE_FUNDERS;
  if (rawFunders !== undefined && rawFunders !== null && String(rawFunders).trim() !== "") {
    minUniqueFunders = parseIntInRange(rawFunders, 1, 100, "ORBIT_SYBIL_MIN_UNIQUE_FUNDERS");
  }

  let maxConcentrationBps = DEFAULT_MAX_CONCENTRATION_BPS;
  const rawConc = source.ORBIT_SYBIL_MAX_CONCENTRATION_BPS;
  if (rawConc !== undefined && rawConc !== null && String(rawConc).trim() !== "") {
    maxConcentrationBps = parseIntInRange(rawConc, 100, 10000, "ORBIT_SYBIL_MAX_CONCENTRATION_BPS");
  }

  return { minWalletAgeDays, minUniqueFunders, maxConcentrationBps };
}

function normalizeAddress(addr) {
  if (typeof addr !== "string") return null;
  const trimmed = addr.trim();
  if (trimmed === "") return null;
  return trimmed.toLowerCase();
}

function uniqueAddresses(funders) {
  const set = new Set();
  if (!Array.isArray(funders)) return set;
  for (const f of funders) {
    if (!f || typeof f !== "object") continue;
    const lower = normalizeAddress(f.address);
    if (lower) set.add(lower);
  }
  return set;
}

function toAmountBigInt(value) {
  if (typeof value === "bigint") {
    return value < 0n ? 0n : value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value) || !Number.isInteger(value) || value < 0) return 0n;
    return BigInt(value);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!/^\d+$/.test(trimmed)) return 0n;
    try { return BigInt(trimmed); } catch { return 0n; }
  }
  return 0n;
}

function maxConcentration(funders) {
  if (!Array.isArray(funders) || funders.length === 0) return 0;
  // Aggregate amounts per lowercased address so multiple rows for the same
  // funder do not artificially deflate the concentration metric.
  const totals = new Map();
  let sum = 0n;
  for (const f of funders) {
    if (!f || typeof f !== "object") continue;
    const lower = normalizeAddress(f.address);
    if (!lower) continue;
    const amt = toAmountBigInt(f.amountWei);
    sum += amt;
    totals.set(lower, (totals.get(lower) || 0n) + amt);
  }
  if (sum === 0n) return 0;
  let max = 0n;
  for (const amt of totals.values()) {
    if (amt > max) max = amt;
  }
  return Number((max * BPS_DENOM) / sum);
}

function checkWalletAge(funder, minAgeDays, now) {
  const nowMs = (now instanceof Date ? now : new Date(now)).getTime();
  const raw = funder && funder.firstSeenAt;
  if (raw === undefined || raw === null || raw === "") {
    return { ok: false, ageDays: 0, reason: "no_first_seen_data" };
  }
  let seenMs;
  if (raw instanceof Date) {
    seenMs = raw.getTime();
  } else if (typeof raw === "number") {
    seenMs = raw;
  } else if (typeof raw === "string") {
    seenMs = Date.parse(raw);
  } else {
    return { ok: false, ageDays: 0, reason: "no_first_seen_data" };
  }
  if (!Number.isFinite(seenMs)) {
    return { ok: false, ageDays: 0, reason: "no_first_seen_data" };
  }
  const ageDays = Math.floor((nowMs - seenMs) / MS_PER_DAY);
  if (ageDays < minAgeDays) {
    return { ok: false, ageDays, reason: "wallet_too_young" };
  }
  return { ok: true, ageDays };
}

function evaluateFunders(funders, env, opts) {
  const config = loadConfig(env);
  const now = opts && opts.now ? (opts.now instanceof Date ? opts.now : new Date(opts.now)) : new Date();
  const safeFunders = Array.isArray(funders) ? funders : [];

  const uniqueSet = uniqueAddresses(safeFunders);
  const uniqueCount = uniqueSet.size;
  const concentrationBps = maxConcentration(safeFunders);

  // Wallet-age check: one row per unique address. Pick the oldest firstSeenAt
  // seen for that address so callers can pass multiple rows safely.
  const oldestSeenByAddress = new Map();
  for (const f of safeFunders) {
    if (!f || typeof f !== "object") continue;
    const lower = normalizeAddress(f.address);
    if (!lower) continue;
    const raw = f.firstSeenAt;
    let seenMs = null;
    if (raw instanceof Date) seenMs = raw.getTime();
    else if (typeof raw === "number") seenMs = raw;
    else if (typeof raw === "string" && raw !== "") seenMs = Date.parse(raw);
    const prev = oldestSeenByAddress.get(lower);
    if (prev === undefined) {
      oldestSeenByAddress.set(lower, Number.isFinite(seenMs) ? seenMs : null);
    } else if (prev === null) {
      // keep null
    } else if (Number.isFinite(seenMs) && seenMs < prev) {
      oldestSeenByAddress.set(lower, seenMs);
    }
  }

  const walletAgeChecks = [];
  const youngAddrs = [];
  for (const [address, seenMs] of oldestSeenByAddress.entries()) {
    const synthetic = seenMs === null
      ? { address, firstSeenAt: null }
      : { address, firstSeenAt: new Date(seenMs).toISOString() };
    const result = checkWalletAge(synthetic, config.minWalletAgeDays, now);
    walletAgeChecks.push({
      address,
      ageDays: result.ageDays,
      ok: result.ok,
      ...(result.reason ? { reason: result.reason } : {})
    });
    if (!result.ok) youngAddrs.push(address);
  }

  const failures = [];
  if (uniqueCount < config.minUniqueFunders) failures.push("too_few_unique");
  if (concentrationBps > config.maxConcentrationBps) failures.push("too_concentrated");
  if (youngAddrs.length > 0) failures.push(`young_wallets:${youngAddrs.join(",")}`);

  const ok = failures.length === 0 && uniqueCount > 0;

  return {
    ok,
    uniqueCount,
    minUniqueRequired: config.minUniqueFunders,
    concentrationBps,
    maxConcentrationAllowed: config.maxConcentrationBps,
    walletAgeChecks,
    failures
  };
}

function assertSybilFloorMet(funders, env, opts) {
  const evaluation = evaluateFunders(funders, env, opts);
  if (!evaluation.ok) {
    const parts = [];
    if (evaluation.failures.includes("too_few_unique")) {
      parts.push(`only ${evaluation.uniqueCount} unique funders (need ${evaluation.minUniqueRequired})`);
    }
    if (evaluation.failures.includes("too_concentrated")) {
      parts.push(`top funder holds ${evaluation.concentrationBps} bps (max ${evaluation.maxConcentrationAllowed})`);
    }
    const youngEntry = evaluation.failures.find((f) => f.startsWith("young_wallets:"));
    if (youngEntry) {
      parts.push(`young wallets: ${youngEntry.slice("young_wallets:".length)}`);
    }
    const summary = parts.length > 0 ? parts.join("; ") : "no funders supplied";
    const err = new Error(`Sybil floor not met: ${summary}`);
    err.code = "SYBIL_FLOOR_NOT_MET";
    err.details = evaluation;
    throw err;
  }
  return evaluation;
}

function summarizeFunders(funders, env) {
  const config = loadConfig(env);
  const safeFunders = Array.isArray(funders) ? funders : [];
  const total = safeFunders.length;
  const uniqueCount = uniqueAddresses(safeFunders).size;
  const concentrationBps = maxConcentration(safeFunders);

  let totalAmount = 0n;
  for (const f of safeFunders) {
    if (!f || typeof f !== "object") continue;
    totalAmount += toAmountBigInt(f.amountWei);
  }

  // walletAge threshold: all addresses pass the min-age check.
  const evaluation = evaluateFunders(safeFunders, env);
  const walletAgeOk = evaluation.walletAgeChecks.length > 0
    && evaluation.walletAgeChecks.every((c) => c.ok);

  return {
    total,
    uniqueCount,
    concentrationBps,
    thresholdsMet: {
      unique: uniqueCount >= config.minUniqueFunders,
      concentration: concentrationBps <= config.maxConcentrationBps,
      walletAge: walletAgeOk
    },
    totalAmountWei: totalAmount.toString()
  };
}

module.exports = {
  DEFAULT_MAX_CONCENTRATION_BPS,
  DEFAULT_MIN_UNIQUE_FUNDERS,
  DEFAULT_MIN_WALLET_AGE_DAYS,
  assertSybilFloorMet,
  checkWalletAge,
  evaluateFunders,
  loadConfig,
  maxConcentration,
  summarizeFunders,
  uniqueAddresses
};
