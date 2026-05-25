"use strict";

// S-FLOOR-1: weekly fee-floor gate.
//
// Rule:
//   On a weekly check (a configurable day-of-week + hour, default Sunday
//   00:00 UTC) compare the WETH inflow accumulated in the Fee Receive Safe
//   since the start of the week against a floor (default 0.1 ETH = 1e17 wei).
//
//   - If inflow >= floor, the on-chain actions for the week are eligible to
//     fire (treasury sweep -> bucket Safes -> buyback + operator payout).
//   - If inflow < floor, SKIP THE WEEK ENTIRELY. No rollover: the floor must
//     be cleared in a SINGLE week. Once the next week boundary passes, the
//     counter resets and the previous week's accumulated inflow is forgotten
//     for gating purposes.
//
//   This module is the source-of-truth for the gate. treasury-sweep.js and
//   clanker.js BOTH import from here so the operator-payout decision and the
//   sweep decision share one yes/no judgment per week.
//
//   buyback.js (Agent 2) imports the same API and MUST receive the locked
//   shape below — do not break the surface.

const FEE_FLOOR_WEI_DEFAULT = "100000000000000000"; // 0.1 WETH (stringified BigInt)
const WEEK_BOUNDARY_DAY_DEFAULT = 0;   // Sunday (0=Sun..6=Sat)
const WEEK_BOUNDARY_HOUR_DEFAULT = 0;  // 00:00 UTC
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_WEEK = 7 * MS_PER_DAY;

function isStringifiedBigInt(value) {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return false;
  try {
    BigInt(trimmed);
    return true;
  } catch {
    return false;
  }
}

function bigintFromInflow(value) {
  if (value === null || value === undefined) {
    throw new Error("fee-floor: weekInflowWei is required");
  }
  if (typeof value === "bigint") {
    if (value < 0n) {
      throw new Error("fee-floor: weekInflowWei must be non-negative");
    }
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value) || !Number.isInteger(value) || value < 0) {
      throw new Error("fee-floor: weekInflowWei number must be a non-negative integer");
    }
    return BigInt(value);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!/^\d+$/.test(trimmed)) {
      throw new Error(`fee-floor: weekInflowWei string is not a non-negative integer: ${value}`);
    }
    try {
      return BigInt(trimmed);
    } catch (err) {
      throw new Error(`fee-floor: weekInflowWei string cannot parse: ${err.message}`);
    }
  }
  throw new Error(`fee-floor: weekInflowWei unsupported type: ${typeof value}`);
}

function loadConfig(env) {
  const source = env || process.env;
  const rawFloor = source.ORBIT_ACTION_FEE_FLOOR_WEI;
  const rawDay = source.ORBIT_WEEK_BOUNDARY_DAY;
  const rawHour = source.ORBIT_WEEK_BOUNDARY_HOUR;

  let floorStr = FEE_FLOOR_WEI_DEFAULT;
  if (rawFloor !== undefined && rawFloor !== null && String(rawFloor).trim() !== "") {
    if (!isStringifiedBigInt(rawFloor)) {
      throw new Error(
        `ORBIT_ACTION_FEE_FLOOR_WEI must be a stringified non-negative integer, got: ${rawFloor}`
      );
    }
    floorStr = String(rawFloor).trim();
  }
  const floorWei = BigInt(floorStr);

  let day = WEEK_BOUNDARY_DAY_DEFAULT;
  if (rawDay !== undefined && rawDay !== null && String(rawDay).trim() !== "") {
    const parsed = Number(rawDay);
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 6) {
      throw new Error(`ORBIT_WEEK_BOUNDARY_DAY must be an integer in [0,6], got: ${rawDay}`);
    }
    day = parsed;
  }

  let hour = WEEK_BOUNDARY_HOUR_DEFAULT;
  if (rawHour !== undefined && rawHour !== null && String(rawHour).trim() !== "") {
    const parsed = Number(rawHour);
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 23) {
      throw new Error(`ORBIT_WEEK_BOUNDARY_HOUR must be an integer in [0,23], got: ${rawHour}`);
    }
    hour = parsed;
  }

  return { floorWei, day, hour };
}

// Return the most-recent week-boundary instant at-or-before `now`, in UTC, as
// a Date. Boundary = day-of-week === config.day AND hour === config.hour AND
// minute/second/ms zeroed.
function mostRecentWeekBoundary(now, config) {
  const dayTarget = config.day;
  const hourTarget = config.hour;
  // Anchor a UTC midnight for the current calendar day.
  const candidate = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    hourTarget,
    0, 0, 0
  ));
  // Walk back at most 7 days until candidate <= now AND candidate.getUTCDay() === dayTarget.
  for (let i = 0; i < 8; i += 1) {
    if (candidate.getTime() <= now.getTime() && candidate.getUTCDay() === dayTarget) {
      return candidate;
    }
    candidate.setTime(candidate.getTime() - MS_PER_DAY);
  }
  // Fallback (should never reach): subtract a full week from `now`.
  return new Date(now.getTime() - MS_PER_WEEK);
}

function isAtOrPastWeekBoundary(state, nowDate, config) {
  const now = nowDate instanceof Date ? nowDate : new Date(nowDate);
  if (!state || !state.feeFloor || !state.feeFloor.lastWeekBoundaryAt) {
    return true;
  }
  const lastBoundaryMs = Date.parse(state.feeFloor.lastWeekBoundaryAt);
  if (!Number.isFinite(lastBoundaryMs)) {
    // Malformed timestamp: treat as fresh.
    return true;
  }
  const boundary = mostRecentWeekBoundary(now, config);
  return boundary.getTime() > lastBoundaryMs;
}

function evaluateGate(weekInflowWei, config) {
  const inflow = bigintFromInflow(weekInflowWei);
  const floor = config && typeof config.floorWei === "bigint"
    ? config.floorWei
    : BigInt(FEE_FLOOR_WEI_DEFAULT);
  const met = inflow >= floor;
  return {
    met,
    weekInflowWei: inflow.toString(),
    floorWei: floor.toString(),
    reason: met ? "met" : "below_floor"
  };
}

function weekInflowSince(state, currentSafeBalanceWei) {
  let current;
  if (typeof currentSafeBalanceWei === "bigint") {
    current = currentSafeBalanceWei;
  } else if (typeof currentSafeBalanceWei === "number") {
    if (!Number.isFinite(currentSafeBalanceWei) || !Number.isInteger(currentSafeBalanceWei) || currentSafeBalanceWei < 0) {
      throw new Error("fee-floor: currentSafeBalanceWei number must be a non-negative integer");
    }
    current = BigInt(currentSafeBalanceWei);
  } else if (typeof currentSafeBalanceWei === "string") {
    const trimmed = currentSafeBalanceWei.trim();
    if (!/^\d+$/.test(trimmed)) {
      throw new Error(`fee-floor: currentSafeBalanceWei string invalid: ${currentSafeBalanceWei}`);
    }
    current = BigInt(trimmed);
  } else {
    throw new Error(`fee-floor: currentSafeBalanceWei unsupported type: ${typeof currentSafeBalanceWei}`);
  }

  let weekStart = 0n;
  if (state && state.feeFloor && state.feeFloor.weekStartBalanceWei) {
    const raw = String(state.feeFloor.weekStartBalanceWei).trim();
    if (/^\d+$/.test(raw)) {
      try { weekStart = BigInt(raw); } catch { weekStart = 0n; }
    }
  }
  const delta = current - weekStart;
  // Gate is about NEW inflow only — if a sweep mid-week drove the balance
  // below the week-start snapshot, clamp to zero rather than reporting a
  // negative inflow.
  return delta < 0n ? 0n : delta;
}

function startWeek(state, nowDate, currentSafeBalanceWei) {
  if (!state || typeof state !== "object") {
    throw new Error("fee-floor.startWeek: state object is required");
  }
  const now = nowDate instanceof Date ? nowDate : new Date(nowDate);
  // We compute the active week boundary fresh from the env each time we
  // mutate state, so callers don't need to thread a config in.
  const config = loadConfig(process.env);
  const boundary = mostRecentWeekBoundary(now, config);

  let balanceStr;
  if (typeof currentSafeBalanceWei === "bigint") {
    balanceStr = currentSafeBalanceWei.toString();
  } else if (typeof currentSafeBalanceWei === "number") {
    if (!Number.isFinite(currentSafeBalanceWei) || !Number.isInteger(currentSafeBalanceWei) || currentSafeBalanceWei < 0) {
      throw new Error("fee-floor.startWeek: currentSafeBalanceWei number must be a non-negative integer");
    }
    balanceStr = String(currentSafeBalanceWei);
  } else if (typeof currentSafeBalanceWei === "string") {
    const trimmed = currentSafeBalanceWei.trim();
    if (!/^\d+$/.test(trimmed)) {
      throw new Error(`fee-floor.startWeek: currentSafeBalanceWei string invalid: ${currentSafeBalanceWei}`);
    }
    balanceStr = trimmed;
  } else {
    throw new Error(`fee-floor.startWeek: currentSafeBalanceWei unsupported type: ${typeof currentSafeBalanceWei}`);
  }

  state.feeFloor = {
    weekStartedAt: now.toISOString(),
    weekStartBalanceWei: balanceStr,
    lastWeekBoundaryAt: boundary.toISOString()
  };
  return state;
}

function defaultState() {
  return {
    weekStartedAt: null,
    weekStartBalanceWei: "0",
    lastWeekBoundaryAt: null
  };
}

module.exports = {
  FEE_FLOOR_WEI_DEFAULT,
  WEEK_BOUNDARY_DAY_DEFAULT,
  WEEK_BOUNDARY_HOUR_DEFAULT,
  defaultState,
  evaluateGate,
  isAtOrPastWeekBoundary,
  loadConfig,
  startWeek,
  weekInflowSince
};
