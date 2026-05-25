"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  LEGACY_STREAM_ID,
  STREAM_STATUSES,
  defaultStream,
  deprecateStream,
  ensureStreamsArray,
  getStream,
  listActiveStreams,
  recordRevenue,
  registerStream,
  toBigIntWei
} = require("../src/agent/revenue-streams");

function legacyTreasury(overrides = {}) {
  return {
    revenue: {
      operatorShareBps: 500,
      treasuryShareBps: 9500,
      payoutAsset: "configured-paired-token",
      cadence: "weekly_performance",
      claimIntervalDays: 7,
      lastClaimSentAt: null,
      lastClaimResult: null,
      ...overrides
    }
  };
}

test("defaultStream returns the canonical shape with overrides applied", () => {
  const stream = defaultStream({
    id: "ai-routing-margin",
    type: "ai_routing_margin",
    unitEconomics: { marginBps: 700 }
  });
  assert.equal(stream.id, "ai-routing-margin");
  assert.equal(stream.type, "ai_routing_margin");
  assert.equal(stream.status, STREAM_STATUSES[0]);
  assert.equal(stream.lifetimeRevenueWei, "0");
  assert.equal(stream.lastClaim, null);
  assert.deepEqual(stream.unitEconomics, { marginBps: 700 });
  assert.equal(typeof stream.createdAt, "string");
  assert.equal(stream.sunsetCriteria, null);
});

test("defaultStream rejects unknown status values", () => {
  assert.throws(() => defaultStream({ status: "unknown" }), /stream.status/);
});

test("ensureStreamsArray promotes legacy revenue into streams[0]", () => {
  const treasury = legacyTreasury();
  const out = ensureStreamsArray(treasury);
  assert.ok(Array.isArray(out.revenue.streams));
  assert.equal(out.revenue.streams.length, 1);
  const stream = out.revenue.streams[0];
  assert.equal(stream.id, LEGACY_STREAM_ID);
  assert.equal(stream.type, "trading_fees");
  assert.equal(stream.status, "active");
  assert.equal(stream.unitEconomics.payoutAsset, "configured-paired-token");
  // Legacy fields are preserved — never deleted.
  assert.equal(out.revenue.payoutAsset, "configured-paired-token");
  assert.equal(out.revenue.operatorShareBps, 500);
});

test("ensureStreamsArray is idempotent when streams are already populated", () => {
  const treasury = legacyTreasury();
  ensureStreamsArray(treasury);
  const beforeLen = treasury.revenue.streams.length;
  const beforeFirstId = treasury.revenue.streams[0].id;
  ensureStreamsArray(treasury);
  ensureStreamsArray(treasury);
  assert.equal(treasury.revenue.streams.length, beforeLen);
  assert.equal(treasury.revenue.streams[0].id, beforeFirstId);
});

test("ensureStreamsArray records last-claim metadata from legacy lastClaimResult", () => {
  const treasury = legacyTreasury({
    lastClaimSentAt: "2026-01-01T00:00:00.000Z",
    lastClaimResult: { txHash: "0xabc" }
  });
  ensureStreamsArray(treasury);
  const claim = treasury.revenue.streams[0].lastClaim;
  assert.ok(claim);
  assert.equal(claim.ts, "2026-01-01T00:00:00.000Z");
  assert.equal(claim.txHash, "0xabc");
  assert.equal(claim.source, "legacy_clanker_trading_fees");
});

test("ensureStreamsArray skips promotion when legacy payoutAsset is missing", () => {
  const treasury = { revenue: {} };
  ensureStreamsArray(treasury);
  assert.deepEqual(treasury.revenue.streams, []);
});

test("registerStream appends and rejects duplicate ids", () => {
  const treasury = legacyTreasury();
  registerStream(treasury, {
    id: "ai-routing-margin",
    type: "ai_routing_margin",
    unitEconomics: { marginBps: 700 }
  });
  assert.equal(treasury.revenue.streams.length, 2);
  assert.throws(
    () => registerStream(treasury, { id: "ai-routing-margin", type: "ai_routing_margin" }),
    /already registered/
  );
  assert.throws(() => registerStream(treasury, { type: "ai_routing_margin" }), /id is required/);
  assert.throws(() => registerStream(treasury, { id: "x" }), /type is required/);
});

test("recordRevenue updates lifetimeRevenueWei using BigInt addition", () => {
  const treasury = legacyTreasury();
  ensureStreamsArray(treasury);
  registerStream(treasury, { id: "ai-routing-margin", type: "ai_routing_margin" });
  const huge = "1000000000000000000"; // 1 ETH
  recordRevenue(treasury, "ai-routing-margin", huge, { source: "test", ts: "2026-05-25T00:00:00.000Z" });
  recordRevenue(treasury, "ai-routing-margin", "2", { source: "test" });
  const stream = getStream(treasury, "ai-routing-margin");
  assert.equal(stream.lifetimeRevenueWei, "1000000000000000002");
  assert.equal(stream.lastClaim.amountWei, "2");
  assert.equal(stream.lastClaim.source, "test");
});

test("recordRevenue accepts BigInt amounts", () => {
  const treasury = legacyTreasury();
  ensureStreamsArray(treasury);
  registerStream(treasury, { id: "stream-bigint", type: "x" });
  recordRevenue(treasury, "stream-bigint", 5n, {});
  recordRevenue(treasury, "stream-bigint", 6n, {});
  assert.equal(getStream(treasury, "stream-bigint").lifetimeRevenueWei, "11");
});

test("recordRevenue throws on zero/negative amounts and unknown streams", () => {
  const treasury = legacyTreasury();
  ensureStreamsArray(treasury);
  registerStream(treasury, { id: "stream-z", type: "t" });
  assert.throws(() => recordRevenue(treasury, "stream-z", "0", {}), /amountWei must be > 0/);
  assert.throws(() => recordRevenue(treasury, "stream-z", "-1", {}), /amountWei must be > 0/);
  assert.throws(() => recordRevenue(treasury, "unknown", "1", {}), /unknown stream/);
});

test("getStream finds by id and returns null for unknown", () => {
  const treasury = legacyTreasury();
  ensureStreamsArray(treasury);
  assert.equal(getStream(treasury, LEGACY_STREAM_ID).id, LEGACY_STREAM_ID);
  assert.equal(getStream(treasury, "does-not-exist"), null);
  assert.equal(getStream({}, "anything"), null);
});

test("listActiveStreams filters by status === active", () => {
  const treasury = legacyTreasury();
  ensureStreamsArray(treasury);
  registerStream(treasury, { id: "exp-stream", type: "exp", status: "experimental" });
  registerStream(treasury, { id: "active-2", type: "x", status: "active" });
  const active = listActiveStreams(treasury);
  assert.equal(active.length, 2);
  assert.deepEqual(active.map((s) => s.id).sort(), [LEGACY_STREAM_ID, "active-2"].sort());
});

test("deprecateStream sets status and appends deprecationHistory", () => {
  const treasury = legacyTreasury();
  ensureStreamsArray(treasury);
  registerStream(treasury, { id: "to-kill", type: "x", status: "active" });
  const updated = deprecateStream(treasury, "to-kill", "experiment failed");
  assert.equal(updated.status, "deprecated");
  assert.equal(updated.deprecationHistory.length, 1);
  assert.equal(updated.deprecationHistory[0].reason, "experiment failed");
  assert.equal(typeof updated.deprecationHistory[0].ts, "string");
  // Second deprecation appends — array stays append-only.
  deprecateStream(treasury, "to-kill", "still bad");
  assert.equal(getStream(treasury, "to-kill").deprecationHistory.length, 2);
  // Unknown stream throws.
  assert.throws(() => deprecateStream(treasury, "ghost", "x"), /unknown stream/);
});

test("toBigIntWei coerces strings, integers, and bigints", () => {
  assert.equal(toBigIntWei("12345"), 12345n);
  assert.equal(toBigIntWei(7), 7n);
  assert.equal(toBigIntWei(0n), 0n);
  assert.throws(() => toBigIntWei("not-a-number"), /must be a base-10 integer/);
  assert.throws(() => toBigIntWei(1.5), /must be an integer/);
  assert.throws(() => toBigIntWei({}), /must be a string, number, or bigint/);
});
