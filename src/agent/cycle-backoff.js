"use strict";

// Cycle failure backoff (Patch Set W).
//
// The cron fires every 15 min — fine for normal operation, but if the
// cycle is hard-failing (crash before line `state.lastStatus =
// "completed"` in run.js), we'd burn ~96 attempts a day on a broken
// system, fill the runner queue with red builds, and spam the error
// log. Backoff gives the runner room to breathe and the maintainer
// time to see the alert.
//
// Algorithm:
//   - Track consecutiveFailures in state.json (defaults to 0).
//   - At cycle start, if previous state.lastStatus === "running" and
//     the state is recent enough to suggest a real crash (not a fresh
//     repo / hand-edited file), increment the counter.
//   - 0–2 failures: no backoff. Cron fires normally.
//   - 3+ failures: failureBackoffUntilAt = now + computeBackoffMs(n).
//     2^(n-2) * 30min, capped at 24h.
//   - On successful complete, reset to 0 and clear failureBackoffUntilAt.
//
// Independent of the existing skip-guard's HMAC chain so we don't
// need to re-sign — this is a simple time field that the cycle
// reads at the very start.

const BACKOFF_THRESHOLD = 3;            // 3+ in a row triggers backoff
const BASE_BACKOFF_MS = 30 * 60 * 1000; // 30 min
const MAX_BACKOFF_MS = 24 * 60 * 60 * 1000; // 24 h cap

// Heuristic for "the running state is real, not a fresh repo": if
// lastActive is older than ORPHAN_MAX_AGE_MS, ignore the running flag
// — it might be a stale file from a forked clone, or a manual edit.
const ORPHAN_MAX_AGE_MS = 6 * 60 * 60 * 1000; // 6 h

function computeBackoffMs(consecutiveFailures) {
  const n = Number(consecutiveFailures) || 0;
  if (n < BACKOFF_THRESHOLD) return 0;
  const tier = n - BACKOFF_THRESHOLD;        // 0,1,2,...
  const ms = BASE_BACKOFF_MS * Math.pow(2, tier);
  return Math.min(ms, MAX_BACKOFF_MS);
}

// Detects whether a previous cycle hard-failed without completing.
// Returns true when state.lastStatus === "running" AND state.lastActive
// is recent (so we don't false-trip on a fresh repo).
function detectPriorFailure(state, options = {}) {
  if (!state || state.lastStatus !== "running") return false;
  const lastActiveIso = state.lastActive || null;
  if (!lastActiveIso) return false;
  const lastActiveMs = Date.parse(lastActiveIso);
  if (!Number.isFinite(lastActiveMs)) return false;
  const now = options.now instanceof Date ? options.now.getTime() : (options.now || Date.now());
  return (now - lastActiveMs) < ORPHAN_MAX_AGE_MS;
}

// On detection of prior failure: increment counter and (if past
// threshold) set failureBackoffUntilAt. Mutates state in place.
function applyBackoff(state, options = {}) {
  if (!state) return { tripped: false };
  const now = options.now instanceof Date ? options.now : new Date();
  const n = (Number(state.consecutiveFailures) || 0) + 1;
  state.consecutiveFailures = n;
  const delay = computeBackoffMs(n);
  if (delay > 0) {
    state.failureBackoffUntilAt = new Date(now.getTime() + delay).toISOString();
    return { tripped: true, consecutiveFailures: n, delayMs: delay, until: state.failureBackoffUntilAt };
  }
  delete state.failureBackoffUntilAt;
  return { tripped: false, consecutiveFailures: n };
}

// On successful cycle completion. Mutates state in place.
function clearBackoff(state) {
  if (!state) return;
  if (state.consecutiveFailures || state.failureBackoffUntilAt) {
    state.consecutiveFailures = 0;
    delete state.failureBackoffUntilAt;
  }
}

// Should the current cycle skip because we're in backoff?
function isBackedOff(state, options = {}) {
  if (!state || !state.failureBackoffUntilAt) return { skip: false };
  const now = options.now instanceof Date ? options.now.getTime() : (options.now || Date.now());
  const untilMs = Date.parse(state.failureBackoffUntilAt);
  if (!Number.isFinite(untilMs)) return { skip: false };
  if (now >= untilMs) return { skip: false, expired: true };
  return {
    skip: true,
    consecutiveFailures: state.consecutiveFailures || 0,
    until: state.failureBackoffUntilAt,
    remainingMs: untilMs - now
  };
}

module.exports = {
  BACKOFF_THRESHOLD,
  BASE_BACKOFF_MS,
  MAX_BACKOFF_MS,
  ORPHAN_MAX_AGE_MS,
  applyBackoff,
  clearBackoff,
  computeBackoffMs,
  detectPriorFailure,
  isBackedOff
};
