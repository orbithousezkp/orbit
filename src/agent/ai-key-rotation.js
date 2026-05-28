"use strict";

// T-6 (STABILITY_SECURITY.md §2): advisory-only AI key rotation reminder.
//
// Tracks state.aiKeyRotation.lastRotatedAt against a 90-day default interval.
// Returns { due, status, ageDays, advisory: true }. Caller (cycle) opens an
// idempotent GitHub issue with label `orbit:rotation-due` when due. This
// module NEVER auto-blocks AI work — by design (see [[feedback-performance-based-ai-routing]]
// in user memory: key rotation is advisory only, never auto-block a working provider).

const DAY_MS = 24 * 60 * 60 * 1000;
const AI_KEY_ROTATION_INTERVAL_DAYS = 90;
const AI_KEY_ROTATION_INTERVAL_MS = AI_KEY_ROTATION_INTERVAL_DAYS * DAY_MS;
const ROTATION_ISSUE_LABEL = "orbit:rotation-due";

function evaluateAiKeyRotation(state = {}, now = new Date()) {
  const rotation = (state && state.aiKeyRotation) || {};
  const intervalDays = Number.isFinite(rotation.intervalDays) && rotation.intervalDays > 0
    ? rotation.intervalDays
    : AI_KEY_ROTATION_INTERVAL_DAYS;
  const intervalMs = intervalDays * DAY_MS;

  const lastRotatedAtRaw = rotation.lastRotatedAt;
  if (!lastRotatedAtRaw || typeof lastRotatedAtRaw !== "string") {
    return { due: false, status: "unknown", advisory: true, intervalDays };
  }
  const lastRotatedAtMs = Date.parse(lastRotatedAtRaw);
  if (Number.isNaN(lastRotatedAtMs)) {
    return { due: false, status: "unknown", advisory: true, intervalDays };
  }
  const nowMs = now instanceof Date ? now.getTime() : Number(now);
  const ageMs = nowMs - lastRotatedAtMs;
  const ageDays = Math.floor(ageMs / DAY_MS);
  if (ageMs > intervalMs) {
    return {
      due: true,
      status: "due",
      advisory: true,
      ageDays,
      ageMs,
      intervalDays,
      intervalMs,
      lastRotatedAt: lastRotatedAtRaw
    };
  }
  return {
    due: false,
    status: "fresh",
    advisory: true,
    ageDays,
    ageMs,
    intervalDays,
    intervalMs,
    lastRotatedAt: lastRotatedAtRaw
  };
}

module.exports = {
  AI_KEY_ROTATION_INTERVAL_DAYS,
  AI_KEY_ROTATION_INTERVAL_MS,
  ROTATION_ISSUE_LABEL,
  evaluateAiKeyRotation
};
