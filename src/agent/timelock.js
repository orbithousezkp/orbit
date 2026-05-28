"use strict";

// F-5.2 (PLAN/ROADMAP_EXPANSION.md): generalized timelocks.
//
// Pattern extracted from the handoff 7d-timelock (handoff.js). Applies to
// arbitrary actions: spend tiers, gate flips, schema migrations, owner
// rotations. Pure primitive — caller stores the returned proposal in
// their own memory file (handoff.json, spend-locks.json, etc.).
//
// Lifecycle:
//   propose → pending (executeAfter set)
//      ↓ within window
//   extendTimelock → pending (executeAfter += extensionMs)
//   rejectTimelock → rejected (terminal)
//      ↓ when now >= executeAfter
//   evaluateTimelock → ok (caller marks status=executed when done)
//
// Tier → duration default (matches F-2.2 spend tier semantics):
//   small: 1h, medium: 12h, large: 24h, critical: 7d.

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const DEFAULT_TIMELOCK_DURATIONS_MS = Object.freeze({
  small: HOUR_MS,
  medium: 12 * HOUR_MS,
  large: DAY_MS,
  critical: 7 * DAY_MS
});

function durationForTier(tier, options = {}) {
  const map = (options && options.durations) || DEFAULT_TIMELOCK_DURATIONS_MS;
  if (Object.prototype.hasOwnProperty.call(map, tier)) return map[tier];
  // Unknown tier: default to large (conservative).
  return DEFAULT_TIMELOCK_DURATIONS_MS.large;
}

function proposeTimelock({ actionId, actionType, tier, payload } = {}, options = {}) {
  const now = options.now instanceof Date ? options.now : new Date();
  const durationMs = durationForTier(tier, options);
  return {
    actionId: String(actionId || ""),
    actionType: String(actionType || ""),
    tier: String(tier || ""),
    status: "pending",
    proposedAt: now.toISOString(),
    executeAfter: new Date(now.getTime() + durationMs).toISOString(),
    durationMs,
    extensionCount: 0,
    extensions: [],
    payload: payload || null
  };
}

function evaluateTimelock(proposal, options = {}) {
  if (!proposal || typeof proposal !== "object" || !proposal.status) {
    return { ok: false, reason: "invalid_proposal" };
  }
  if (proposal.status === "rejected") {
    return { ok: false, reason: "rejected" };
  }
  if (proposal.status === "executed") {
    return { ok: false, reason: "already_executed" };
  }
  if (proposal.status !== "pending") {
    return { ok: false, reason: "invalid_proposal", detail: `unknown status: ${proposal.status}` };
  }
  const now = options.now instanceof Date ? options.now : new Date();
  const executeMs = Date.parse(proposal.executeAfter);
  if (Number.isNaN(executeMs)) {
    return { ok: false, reason: "invalid_proposal", detail: "unparseable executeAfter" };
  }
  const nowMs = now.getTime();
  if (nowMs < executeMs) {
    return { ok: false, reason: "timelock_active", remainingMs: executeMs - nowMs };
  }
  return { ok: true, reason: "executable", remainingMs: 0 };
}

function extendTimelock(proposal, options = {}) {
  if (!proposal || proposal.status !== "pending") {
    return { ok: false, reason: "not_pending" };
  }
  const now = options.now instanceof Date ? options.now : new Date();
  const executeMs = Date.parse(proposal.executeAfter);
  if (Number.isNaN(executeMs)) {
    return { ok: false, reason: "invalid_proposal" };
  }
  if (now.getTime() >= executeMs) {
    return { ok: false, reason: "window_closed" };
  }
  const extensionMs = Number.isFinite(options.extensionMs) ? options.extensionMs : 0;
  if (extensionMs <= 0) {
    return { ok: false, reason: "invalid_extension" };
  }
  const nextProposal = {
    ...proposal,
    executeAfter: new Date(executeMs + extensionMs).toISOString(),
    extensionCount: (proposal.extensionCount || 0) + 1,
    extensions: [
      ...(proposal.extensions || []),
      { at: now.toISOString(), byMs: extensionMs, reason: options.reason || null }
    ]
  };
  return { ok: true, proposal: nextProposal };
}

function rejectTimelock(proposal, options = {}) {
  if (!proposal || proposal.status !== "pending") {
    return { ok: false, reason: "not_pending" };
  }
  const now = options.now instanceof Date ? options.now : new Date();
  const next = {
    ...proposal,
    status: "rejected",
    rejectedAt: now.toISOString(),
    rejectedReason: options.reason ? String(options.reason) : null
  };
  return { ok: true, proposal: next };
}

function describeTimelock(proposal) {
  if (!proposal || typeof proposal !== "object") return "invalid timelock proposal";
  const tag = proposal.tier ? `${proposal.tier} tier` : "untiered";
  if (proposal.status === "rejected") {
    return `timelock REJECTED (${tag}, action=${proposal.actionId}, reason=${proposal.rejectedReason || "n/a"})`;
  }
  if (proposal.status === "executed") {
    return `timelock EXECUTED (${tag}, action=${proposal.actionId})`;
  }
  if (proposal.status === "pending") {
    return `timelock pending — ${tag}, action=${proposal.actionId}, executable after ${proposal.executeAfter}` +
      (proposal.extensionCount ? ` (${proposal.extensionCount} extension(s))` : "");
  }
  return `timelock unknown status: ${proposal.status}`;
}

module.exports = {
  DEFAULT_TIMELOCK_DURATIONS_MS,
  describeTimelock,
  evaluateTimelock,
  extendTimelock,
  proposeTimelock,
  rejectTimelock
};
