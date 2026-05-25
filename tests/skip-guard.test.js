"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  FLOOR_MS,
  TARGET_MIN_MS,
  TARGET_MAX_MS,
  drawNextTarget,
  evaluateSkip,
  sign,
  verify
} = require("../src/agent/skip-guard");

const cfg = { walletPrivateKey: "0xabc123", cycleTrigger: "schedule" };

function isoMinutesAgo(min) {
  return new Date(Date.now() - min * 60_000).toISOString();
}

test("non-schedule triggers bypass the guard", () => {
  const state = { lastCycleAt: isoMinutesAgo(1) };
  const r = evaluateSkip({ ...cfg, cycleTrigger: "workflow_dispatch" }, state);
  assert.equal(r.skip, false);
  assert.equal(r.reason, "trigger_bypass");
});

test("no prior cycle => run", () => {
  const r = evaluateSkip(cfg, {});
  assert.equal(r.skip, false);
  assert.equal(r.reason, "no_prior_cycle");
});

test("hard floor blocks rapid re-fire even without target", () => {
  const state = { lastCycleAt: isoMinutesAgo(5) };
  const r = evaluateSkip(cfg, state);
  assert.equal(r.skip, true);
  assert.equal(r.reason, "floor");
});

test("hard floor blocks rapid re-fire even if state values are forged", () => {
  const state = {
    lastCycleAt: isoMinutesAgo(2),
    nextCycleTargetAt: new Date(Date.now() - 1000).toISOString(),
    skipGuardSig: "00".repeat(32)
  };
  const r = evaluateSkip(cfg, state);
  assert.equal(r.skip, true);
  assert.equal(r.reason, "floor");
});

test("signed target in the future => skip with reason 'target'", () => {
  const lastCycleAt = isoMinutesAgo(25);
  const nextCycleTargetAt = new Date(Date.now() + 30 * 60_000).toISOString();
  const skipGuardSig = sign(cfg, lastCycleAt, nextCycleTargetAt);
  const r = evaluateSkip(cfg, { lastCycleAt, nextCycleTargetAt, skipGuardSig });
  assert.equal(r.skip, true);
  assert.equal(r.reason, "target");
  assert.ok(r.remainingMs > 0);
});

test("signed target in the past => run", () => {
  const lastCycleAt = isoMinutesAgo(90);
  const nextCycleTargetAt = new Date(Date.now() - 10 * 60_000).toISOString();
  const skipGuardSig = sign(cfg, lastCycleAt, nextCycleTargetAt);
  const r = evaluateSkip(cfg, { lastCycleAt, nextCycleTargetAt, skipGuardSig });
  assert.equal(r.skip, false);
  assert.equal(r.reason, "ok");
});

test("bad signature on future target => guard ignores target and runs", () => {
  const lastCycleAt = isoMinutesAgo(25);
  const nextCycleTargetAt = new Date(Date.now() + 30 * 60_000).toISOString();
  const r = evaluateSkip(cfg, {
    lastCycleAt,
    nextCycleTargetAt,
    skipGuardSig: "ff".repeat(32)
  });
  assert.equal(r.skip, false);
  assert.equal(r.reason, "bad_signature");
});

test("signature from a different key does not validate", () => {
  const otherCfg = { walletPrivateKey: "0xdeadbeef", cycleTrigger: "schedule" };
  const lastCycleAt = isoMinutesAgo(25);
  const nextCycleTargetAt = new Date(Date.now() + 30 * 60_000).toISOString();
  const sigFromOther = sign(otherCfg, lastCycleAt, nextCycleTargetAt);
  assert.equal(verify(cfg, lastCycleAt, nextCycleTargetAt, sigFromOther), false);
});

test("drawNextTarget produces a valid signed target within [30, 90] min", () => {
  const lastCycleAt = new Date().toISOString();
  const next = drawNextTarget(cfg, lastCycleAt);
  assert.equal(next.lastCycleAt, lastCycleAt);
  assert.ok(next.gapMs >= TARGET_MIN_MS);
  assert.ok(next.gapMs < TARGET_MAX_MS);
  assert.equal(verify(cfg, next.lastCycleAt, next.nextCycleTargetAt, next.skipGuardSig), true);
});

test("drawNextTarget injects randomness via injected randomFn", () => {
  const lastCycleAt = new Date().toISOString();
  const lo = drawNextTarget(cfg, lastCycleAt, () => 0);
  const hi = drawNextTarget(cfg, lastCycleAt, () => 0.999999);
  assert.equal(lo.gapMs, TARGET_MIN_MS);
  assert.ok(hi.gapMs < TARGET_MAX_MS);
  assert.ok(hi.gapMs > TARGET_MIN_MS);
});

test("FLOOR_MS is shorter than TARGET_MIN_MS so the floor is redundant on honest state", () => {
  assert.ok(FLOOR_MS < TARGET_MIN_MS);
});
