"use strict";

// S-BUY-1: Intelligent buyback campaign scheduler.
//
// Generates randomized sub-buy times across a 48-hour execution window and
// answers "what's the next sub-buy due?". The planner decides AMOUNTS
// (deterministic — remainder to first), the scheduler decides TIMES
// (randomized — that's the defense against front-running and pump-and-dump
// snipers watching for a single weekly buy).
//
// Time math is in milliseconds throughout. Times are surfaced as ISO-8601
// strings on the wire / in state.json (so a human can read them and so JSON
// round-trips losslessly), but the internal compare uses Date.getTime().

const HOUR_MS = 3_600_000;

function toDate(value) {
  if (value instanceof Date) return new Date(value.getTime());
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

// Pick the next random number from `rng` in [0, 1). Defaults to Math.random
// so test callers can seed determinism by injecting their own.
function defaultRng() {
  return Math.random();
}

// Generate `subBuyCount` randomized times within
// [approvedAt, approvedAt + windowHours*3600*1000].
//
// Constraints:
//   - sorted ascending
//   - all in [approvedAt, approvedAt + window]
//   - no two times closer than (windowHours / subBuyCount / 3) hours apart
//
// Algorithm: pick random offsets, sort, then walk forward and push any
// too-close neighbor to (prev + minGap). If pushing would exceed the window
// we clamp to the window end — the spec accepts overlapping AT the boundary
// because the alternative (drop a sub-buy) violates the count contract.
function generateSchedule(approvedAt, windowHours, subBuyCount, rng) {
  const start = toDate(approvedAt);
  if (!start) throw new Error("generateSchedule: approvedAt is not a valid date");
  const n = Number(subBuyCount);
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error("generateSchedule: subBuyCount must be a positive integer");
  }
  const hours = Number(windowHours);
  if (!Number.isFinite(hours) || hours <= 0) {
    throw new Error("generateSchedule: windowHours must be positive");
  }

  const windowMs = hours * HOUR_MS;
  const minGapHours = hours / n / 3;
  const minGapMs = minGapHours * HOUR_MS;
  const startMs = start.getTime();
  const endMs = startMs + windowMs;

  const pickRandom = typeof rng === "function" ? rng : defaultRng;

  // Pick n raw offsets in [0, windowMs], sort, then enforce min gap.
  const offsets = new Array(n);
  for (let i = 0; i < n; i += 1) {
    offsets[i] = Math.floor(pickRandom() * (windowMs + 1));
  }
  offsets.sort((a, b) => a - b);

  // First pass: push forward to enforce min gap from previous element.
  for (let i = 1; i < n; i += 1) {
    const minAllowed = offsets[i - 1] + minGapMs;
    if (offsets[i] < minAllowed) {
      offsets[i] = minAllowed;
    }
  }
  // Clamp to window end if we ran over.
  for (let i = 0; i < n; i += 1) {
    if (offsets[i] > windowMs) offsets[i] = windowMs;
  }

  // Second pass (rare): if clamping created equal neighbors at the end, pull
  // EARLIER neighbors back to maintain monotone order. We walk backward and
  // ensure offsets[i-1] <= offsets[i] - minGap when possible; if not possible
  // (window too tight) we accept the tie at the boundary.
  for (let i = n - 1; i > 0; i -= 1) {
    const maxAllowed = offsets[i] - minGapMs;
    if (offsets[i - 1] > maxAllowed) {
      offsets[i - 1] = Math.max(0, maxAllowed);
    }
  }
  // Re-sort defensively in case the backward pass disturbed earlier order.
  offsets.sort((a, b) => a - b);

  return offsets.map((off) => new Date(startMs + off).toISOString());
}

// Find the first sub-buy that is pending AND whose scheduledAt is in the
// past (relative to nowDate). Returns { index, subBuy } or null.
function nextDueSubBuy(campaign, nowDate) {
  if (!campaign || !Array.isArray(campaign.subBuys)) return null;
  const now = toDate(nowDate) || new Date();
  const nowMs = now.getTime();
  for (let i = 0; i < campaign.subBuys.length; i += 1) {
    const sb = campaign.subBuys[i];
    if (!sb || sb.status !== "pending") continue;
    const scheduled = toDate(sb.scheduledAt);
    if (!scheduled) continue;
    if (scheduled.getTime() <= nowMs) {
      return { index: i, subBuy: sb };
    }
  }
  return null;
}

// Mutate campaign.subBuys[subBuyIndex] with a result record. Returns the
// updated campaign for fluent use. On success: status="completed", txHash,
// completedAt. On failure: status="failed", error, failedAt.
function applyResult(campaign, subBuyIndex, result) {
  if (!campaign || !Array.isArray(campaign.subBuys)) {
    throw new Error("applyResult: campaign.subBuys is missing");
  }
  if (!Number.isInteger(subBuyIndex) || subBuyIndex < 0 || subBuyIndex >= campaign.subBuys.length) {
    throw new Error("applyResult: subBuyIndex out of range");
  }
  const sb = campaign.subBuys[subBuyIndex];
  if (!sb) {
    throw new Error("applyResult: sub-buy at index is missing");
  }
  const now = new Date().toISOString();
  if (result && result.ok) {
    sb.status = "completed";
    sb.txHash = result.txHash || null;
    sb.completedAt = result.completedAt || now;
    if (result.orbitReceived !== undefined) sb.orbitReceived = result.orbitReceived;
    if (result.wethSpent !== undefined) sb.wethSpent = result.wethSpent;
  } else {
    sb.status = "failed";
    sb.error = (result && result.error) || (result && result.reason) || "unknown_error";
    sb.failedAt = (result && result.failedAt) || now;
  }
  return campaign;
}

// True iff every sub-buy is completed OR failed (no pending left).
function isCampaignComplete(campaign) {
  if (!campaign || !Array.isArray(campaign.subBuys) || campaign.subBuys.length === 0) {
    return false;
  }
  return campaign.subBuys.every(
    (sb) => sb && (sb.status === "completed" || sb.status === "failed")
  );
}

module.exports = {
  HOUR_MS,
  generateSchedule,
  nextDueSubBuy,
  applyResult,
  isCampaignComplete
};
