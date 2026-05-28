"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  DEFAULT_TIMELOCK_DURATIONS_MS,
  proposeTimelock,
  evaluateTimelock,
  extendTimelock,
  rejectTimelock,
  describeTimelock
} = require("../src/agent/timelock");

// F-5.2 (PLAN/ROADMAP_EXPANSION.md): generalized timelocks. Extends the
// handoff 7d-timelock pattern to arbitrary actions (spend levels, gate
// flips, schema migrations). Pure primitive — callers store the returned
// state in their own memory file.

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

test("DEFAULT_TIMELOCK_DURATIONS_MS has tier-keyed durations (ascending)", () => {
  const d = DEFAULT_TIMELOCK_DURATIONS_MS;
  assert.ok(d.small >= 0);
  assert.ok(d.medium >= d.small);
  assert.ok(d.large >= d.medium);
  assert.ok(d.critical >= d.large);
});

test("proposeTimelock: returns proposal with proposedAt + executeAfter + status=pending", () => {
  const now = new Date("2026-05-28T00:00:00Z");
  const proposal = proposeTimelock({
    actionId: "spend-abc123",
    actionType: "buyback",
    tier: "large"
  }, { now });
  assert.equal(proposal.actionId, "spend-abc123");
  assert.equal(proposal.tier, "large");
  assert.equal(proposal.status, "pending");
  assert.equal(proposal.proposedAt, "2026-05-28T00:00:00.000Z");
  // large default is 24h
  const expected = new Date(now.getTime() + DEFAULT_TIMELOCK_DURATIONS_MS.large);
  assert.equal(proposal.executeAfter, expected.toISOString());
});

test("proposeTimelock: deterministic — same input + now → same proposal", () => {
  const now = new Date("2026-05-28T00:00:00Z");
  const args = { actionId: "x", actionType: "treasury", tier: "medium" };
  const a = proposeTimelock(args, { now });
  const b = proposeTimelock(args, { now });
  assert.deepEqual(a, b);
});

test("proposeTimelock: unknown tier → defaults to large duration", () => {
  const now = new Date("2026-05-28T00:00:00Z");
  const proposal = proposeTimelock({ actionId: "x", actionType: "y", tier: "not-a-tier" }, { now });
  assert.equal(proposal.tier, "not-a-tier");
  const expected = new Date(now.getTime() + DEFAULT_TIMELOCK_DURATIONS_MS.large);
  assert.equal(proposal.executeAfter, expected.toISOString());
});

test("proposeTimelock: custom durations via options.durations", () => {
  const now = new Date("2026-05-28T00:00:00Z");
  const proposal = proposeTimelock(
    { actionId: "x", actionType: "y", tier: "tiny" },
    { now, durations: { tiny: HOUR_MS } }
  );
  const expected = new Date(now.getTime() + HOUR_MS);
  assert.equal(proposal.executeAfter, expected.toISOString());
});

test("evaluateTimelock: pending + before executeAfter → ok:false reason=timelock_active", () => {
  const now = new Date("2026-05-28T00:00:00Z");
  const proposal = proposeTimelock({ actionId: "x", actionType: "y", tier: "large" }, { now });
  const later = new Date(now.getTime() + DAY_MS / 2);
  const result = evaluateTimelock(proposal, { now: later });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "timelock_active");
  assert.ok(result.remainingMs > 0);
});

test("evaluateTimelock: pending + after executeAfter → ok:true reason=executable", () => {
  const now = new Date("2026-05-28T00:00:00Z");
  const proposal = proposeTimelock({ actionId: "x", actionType: "y", tier: "small" }, { now });
  const later = new Date(now.getTime() + DEFAULT_TIMELOCK_DURATIONS_MS.small + 1);
  const result = evaluateTimelock(proposal, { now: later });
  assert.equal(result.ok, true);
  assert.equal(result.reason, "executable");
  assert.equal(result.remainingMs, 0);
});

test("evaluateTimelock: rejected status → ok:false reason=rejected", () => {
  const proposal = { ...proposeTimelock({ actionId: "x", actionType: "y", tier: "large" }), status: "rejected" };
  const result = evaluateTimelock(proposal);
  assert.equal(result.ok, false);
  assert.equal(result.reason, "rejected");
});

test("evaluateTimelock: executed status → ok:false reason=already_executed", () => {
  const proposal = { ...proposeTimelock({ actionId: "x", actionType: "y", tier: "large" }), status: "executed" };
  const result = evaluateTimelock(proposal);
  assert.equal(result.ok, false);
  assert.equal(result.reason, "already_executed");
});

test("evaluateTimelock: invalid proposal shape → ok:false reason=invalid_proposal", () => {
  assert.equal(evaluateTimelock(null).ok, false);
  assert.equal(evaluateTimelock({}).ok, false);
  assert.equal(evaluateTimelock({}).reason, "invalid_proposal");
});

test("extendTimelock: pending + within window → extends executeAfter by extensionMs", () => {
  const now = new Date("2026-05-28T00:00:00Z");
  const proposal = proposeTimelock({ actionId: "x", actionType: "y", tier: "large" }, { now });
  const mid = new Date(now.getTime() + DAY_MS / 2);
  const extended = extendTimelock(proposal, { extensionMs: DAY_MS, now: mid });
  assert.equal(extended.ok, true);
  const newAfter = Date.parse(extended.proposal.executeAfter);
  const oldAfter = Date.parse(proposal.executeAfter);
  assert.equal(newAfter, oldAfter + DAY_MS);
});

test("extendTimelock: already-executable proposal → cannot extend", () => {
  const now = new Date("2026-05-28T00:00:00Z");
  const proposal = proposeTimelock({ actionId: "x", actionType: "y", tier: "small" }, { now });
  const later = new Date(now.getTime() + DEFAULT_TIMELOCK_DURATIONS_MS.small + 1);
  const result = extendTimelock(proposal, { extensionMs: DAY_MS, now: later });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "window_closed");
});

test("extendTimelock: rejected proposal → cannot extend", () => {
  const proposal = { ...proposeTimelock({ actionId: "x", actionType: "y", tier: "large" }), status: "rejected" };
  const result = extendTimelock(proposal, { extensionMs: DAY_MS });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "not_pending");
});

test("extendTimelock: tracks extensionCount + extensions[]", () => {
  const now = new Date("2026-05-28T00:00:00Z");
  let p = proposeTimelock({ actionId: "x", actionType: "y", tier: "large" }, { now });
  let mid = new Date(now.getTime() + DAY_MS / 2);
  const r1 = extendTimelock(p, { extensionMs: DAY_MS, now: mid });
  assert.equal(r1.proposal.extensionCount, 1);
  assert.equal(r1.proposal.extensions.length, 1);
  assert.equal(r1.proposal.extensions[0].byMs, DAY_MS);
});

test("rejectTimelock: pending → status=rejected", () => {
  const proposal = proposeTimelock({ actionId: "x", actionType: "y", tier: "large" });
  const result = rejectTimelock(proposal, { reason: "owner_objection" });
  assert.equal(result.ok, true);
  assert.equal(result.proposal.status, "rejected");
  assert.equal(result.proposal.rejectedReason, "owner_objection");
});

test("rejectTimelock: already executed → cannot reject", () => {
  const proposal = { ...proposeTimelock({ actionId: "x", actionType: "y", tier: "large" }), status: "executed" };
  const result = rejectTimelock(proposal);
  assert.equal(result.ok, false);
  assert.equal(result.reason, "not_pending");
});

test("describeTimelock: human-readable line for any proposal status", () => {
  const proposal = proposeTimelock({ actionId: "x", actionType: "y", tier: "large" });
  assert.match(describeTimelock(proposal), /pending|active|large/i);
});
