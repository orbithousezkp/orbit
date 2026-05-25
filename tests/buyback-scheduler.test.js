"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  generateSchedule,
  nextDueSubBuy,
  applyResult,
  isCampaignComplete,
  HOUR_MS
} = require("../src/agent/buyback-scheduler");

// Tiny deterministic LCG so tests don't depend on Math.random.
function seededRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

// --- generateSchedule -----------------------------------------------------

test("generateSchedule: deterministic with the same seeded rng", () => {
  const t0 = "2026-05-25T00:00:00.000Z";
  const a = generateSchedule(t0, 48, 5, seededRng(42));
  const b = generateSchedule(t0, 48, 5, seededRng(42));
  assert.deepEqual(a, b);
});

test("generateSchedule: produces N times sorted ascending", () => {
  const t0 = "2026-05-25T00:00:00.000Z";
  const out = generateSchedule(t0, 48, 7, seededRng(99));
  assert.equal(out.length, 7);
  let prevMs = 0;
  for (const iso of out) {
    const ms = new Date(iso).getTime();
    assert.ok(ms >= prevMs, `times not ascending at ${iso}`);
    prevMs = ms;
  }
});

test("generateSchedule: all times within [approvedAt, approvedAt+windowHours]", () => {
  const start = new Date("2026-05-25T00:00:00Z");
  const out = generateSchedule(start, 48, 6, seededRng(7));
  const lo = start.getTime();
  const hi = lo + 48 * HOUR_MS;
  for (const iso of out) {
    const ms = new Date(iso).getTime();
    assert.ok(ms >= lo, `time ${iso} earlier than start`);
    assert.ok(ms <= hi, `time ${iso} later than window end`);
  }
});

test("generateSchedule: enforces minimum gap = window / n / 3 between neighbours when possible", () => {
  const start = new Date("2026-05-25T00:00:00Z");
  const n = 5;
  const windowHours = 48;
  const minGapMs = (windowHours / n / 3) * HOUR_MS;
  const out = generateSchedule(start, windowHours, n, seededRng(123));
  // Allow boundary saturation (last few may bunch up at window end if random
  // picks collapsed). Check all neighbours that aren't at the window boundary.
  const windowEnd = start.getTime() + windowHours * HOUR_MS;
  for (let i = 1; i < out.length; i += 1) {
    const prevMs = new Date(out[i - 1]).getTime();
    const ms = new Date(out[i]).getTime();
    if (ms === windowEnd && prevMs === windowEnd) continue; // boundary tie
    assert.ok(
      ms - prevMs >= Math.floor(minGapMs),
      `gap between ${out[i - 1]} and ${out[i]} (${ms - prevMs} ms) < min ${minGapMs} ms`
    );
  }
});

test("generateSchedule: rejects invalid subBuyCount", () => {
  assert.throws(() => generateSchedule(new Date(), 48, 0), /subBuyCount/);
  assert.throws(() => generateSchedule(new Date(), 48, -3), /subBuyCount/);
});

test("generateSchedule: rejects invalid approvedAt", () => {
  assert.throws(() => generateSchedule("not-a-date", 48, 3), /approvedAt/);
});

test("generateSchedule: rejects non-positive window", () => {
  assert.throws(() => generateSchedule(new Date(), 0, 3), /windowHours/);
});

// --- nextDueSubBuy --------------------------------------------------------

function pendingCampaign(times) {
  return {
    subBuys: times.map((iso, i) => ({
      scheduledAt: iso,
      amountWei: String(1000 + i),
      status: "pending"
    }))
  };
}

test("nextDueSubBuy: returns the earliest pending sub-buy whose time has elapsed", () => {
  const c = pendingCampaign([
    "2026-05-25T01:00:00Z",
    "2026-05-25T05:00:00Z",
    "2026-05-25T10:00:00Z"
  ]);
  const due = nextDueSubBuy(c, new Date("2026-05-25T06:00:00Z"));
  assert.ok(due);
  assert.equal(due.index, 0);
  assert.equal(due.subBuy.scheduledAt, "2026-05-25T01:00:00Z");
});

test("nextDueSubBuy: returns null when nothing is due yet", () => {
  const c = pendingCampaign([
    "2026-05-26T00:00:00Z",
    "2026-05-27T00:00:00Z"
  ]);
  const due = nextDueSubBuy(c, new Date("2026-05-25T00:00:00Z"));
  assert.equal(due, null);
});

test("nextDueSubBuy: skips completed/failed and returns earliest remaining pending", () => {
  const c = pendingCampaign([
    "2026-05-25T01:00:00Z",
    "2026-05-25T02:00:00Z",
    "2026-05-25T03:00:00Z"
  ]);
  c.subBuys[0].status = "completed";
  c.subBuys[0].txHash = "0xdry...";
  const due = nextDueSubBuy(c, new Date("2026-05-25T04:00:00Z"));
  assert.ok(due);
  assert.equal(due.index, 1);
});

test("nextDueSubBuy: returns null when all completed", () => {
  const c = pendingCampaign([
    "2026-05-25T01:00:00Z",
    "2026-05-25T02:00:00Z"
  ]);
  c.subBuys[0].status = "completed";
  c.subBuys[1].status = "completed";
  const due = nextDueSubBuy(c, new Date("2026-05-26T00:00:00Z"));
  assert.equal(due, null);
});

// --- applyResult ----------------------------------------------------------

test("applyResult: success path writes txHash, completedAt, status=completed", () => {
  const c = pendingCampaign(["2026-05-25T00:00:00Z", "2026-05-25T03:00:00Z"]);
  applyResult(c, 0, { ok: true, txHash: "0xabc", orbitReceived: "100.0" });
  assert.equal(c.subBuys[0].status, "completed");
  assert.equal(c.subBuys[0].txHash, "0xabc");
  assert.ok(c.subBuys[0].completedAt, "completedAt must be set");
  assert.equal(c.subBuys[0].orbitReceived, "100.0");
  // Other sub-buys untouched
  assert.equal(c.subBuys[1].status, "pending");
});

test("applyResult: failure path writes error and status=failed", () => {
  const c = pendingCampaign(["2026-05-25T00:00:00Z"]);
  applyResult(c, 0, { ok: false, error: "rpc_failed" });
  assert.equal(c.subBuys[0].status, "failed");
  assert.equal(c.subBuys[0].error, "rpc_failed");
  assert.ok(c.subBuys[0].failedAt);
});

test("applyResult: rejects out-of-range index", () => {
  const c = pendingCampaign(["2026-05-25T00:00:00Z"]);
  assert.throws(() => applyResult(c, 5, { ok: true, txHash: "0x" }), /out of range/);
  assert.throws(() => applyResult(c, -1, { ok: true, txHash: "0x" }), /out of range/);
});

// --- isCampaignComplete ---------------------------------------------------

test("isCampaignComplete: false when any sub-buy is still pending", () => {
  const c = pendingCampaign(["2026-05-25T00:00:00Z", "2026-05-25T01:00:00Z"]);
  c.subBuys[0].status = "completed";
  assert.equal(isCampaignComplete(c), false);
});

test("isCampaignComplete: true when all completed", () => {
  const c = pendingCampaign(["2026-05-25T00:00:00Z", "2026-05-25T01:00:00Z"]);
  c.subBuys[0].status = "completed";
  c.subBuys[1].status = "completed";
  assert.equal(isCampaignComplete(c), true);
});

test("isCampaignComplete: true when all completed-or-failed (no pending left)", () => {
  const c = pendingCampaign(["2026-05-25T00:00:00Z", "2026-05-25T01:00:00Z"]);
  c.subBuys[0].status = "completed";
  c.subBuys[1].status = "failed";
  assert.equal(isCampaignComplete(c), true);
});

test("isCampaignComplete: false on empty/missing campaign", () => {
  assert.equal(isCampaignComplete(null), false);
  assert.equal(isCampaignComplete({}), false);
  assert.equal(isCampaignComplete({ subBuys: [] }), false);
});
