"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const revenueStreams = require("../src/agent/revenue-streams");
const aiRoutingMargin = require("../src/agent/ai-routing-margin");

const {
  MARGIN_BPS_DEFAULT,
  MARGIN_BPS_MAX,
  PER_CALL_SAMPLES_CAP,
  STREAM_ID,
  STREAM_TYPE,
  calculateBilled,
  calculateMargin,
  ensureAiRoutingMarginStream,
  loadMarginConfig,
  recordAiCall,
  summarizeRevenue
} = aiRoutingMargin;

function freshTreasury() {
  return { revenue: { streams: [] } };
}

test("loadMarginConfig: defaults to 500 bps (5%) when env is empty", () => {
  const cfg = loadMarginConfig({});
  assert.equal(cfg.marginBps, MARGIN_BPS_DEFAULT);
  assert.equal(cfg.enabled, true);
});

test("loadMarginConfig: reads ORBIT_AI_ROUTING_MARGIN_BPS override", () => {
  assert.equal(loadMarginConfig({ ORBIT_AI_ROUTING_MARGIN_BPS: "0" }).marginBps, 0);
  assert.equal(loadMarginConfig({ ORBIT_AI_ROUTING_MARGIN_BPS: "0" }).enabled, false);
  assert.equal(loadMarginConfig({ ORBIT_AI_ROUTING_MARGIN_BPS: "1000" }).marginBps, 1000);
  assert.equal(loadMarginConfig({ ORBIT_AI_ROUTING_MARGIN_BPS: "2000" }).marginBps, MARGIN_BPS_MAX);
});

test("loadMarginConfig: rejects negative and above-cap values", () => {
  assert.throws(() => loadMarginConfig({ ORBIT_AI_ROUTING_MARGIN_BPS: "-1" }), /must be an integer/);
  assert.throws(() => loadMarginConfig({ ORBIT_AI_ROUTING_MARGIN_BPS: "2001" }), /must be an integer/);
  assert.throws(() => loadMarginConfig({ ORBIT_AI_ROUTING_MARGIN_BPS: "not-a-number" }), /must be an integer/);
});

test("calculateMargin: returns 0 when wholesale is 0 or bps is 0", () => {
  assert.equal(calculateMargin(0n, 500), 0n);
  assert.equal(calculateMargin("0", 500), 0n);
  assert.equal(calculateMargin(1_000_000_000_000n, 0), 0n);
});

test("calculateMargin: 500 bps over 1e18 wei = 5e16 wei", () => {
  const wholesale = 10n ** 18n;
  assert.equal(calculateMargin(wholesale, 500), 5n * 10n ** 16n);
});

test("calculateMargin: floors via BigInt division", () => {
  // 1 wei * 500 / 10000 = 0 (floored)
  assert.equal(calculateMargin(1n, 500), 0n);
  // 19 wei * 500 / 10000 = 9500/10000 = 0 (floored)
  assert.equal(calculateMargin(19n, 500), 0n);
  // 20 wei * 500 / 10000 = 10000/10000 = 1
  assert.equal(calculateMargin(20n, 500), 1n);
});

test("calculateMargin: handles huge wholesale (1e30) precisely", () => {
  const huge = 10n ** 30n;
  assert.equal(calculateMargin(huge, 500), (huge * 500n) / 10000n);
  assert.equal(calculateMargin(huge, MARGIN_BPS_MAX), (huge * 2000n) / 10000n);
});

test("calculateMargin: rejects out-of-range bps", () => {
  assert.throws(() => calculateMargin(1000n, -1), /marginBps/);
  assert.throws(() => calculateMargin(1000n, 2001), /marginBps/);
  assert.throws(() => calculateMargin(1000n, 1.5), /marginBps/);
});

test("calculateMargin: rejects negative wholesale", () => {
  assert.throws(() => calculateMargin(-1n, 500), /must be >= 0/);
});

test("calculateBilled: equals wholesale + margin", () => {
  const wholesale = 10n ** 18n;
  const margin = calculateMargin(wholesale, 500);
  assert.equal(calculateBilled(wholesale, 500), wholesale + margin);
  assert.equal(calculateBilled(wholesale, 0), wholesale);
  assert.equal(calculateBilled(0n, 500), 0n);
});

test("calculateMargin/Billed accept string and number inputs", () => {
  assert.equal(calculateMargin("1000000000000000000", 500), 5n * 10n ** 16n);
  assert.equal(calculateMargin(100000, 500), 5000n);
  assert.equal(calculateBilled("100", 500), 105n);
});

test("ensureAiRoutingMarginStream: creates the stream on first call", () => {
  const treasury = freshTreasury();
  const stream = ensureAiRoutingMarginStream(treasury, {});
  assert.equal(stream.id, STREAM_ID);
  assert.equal(stream.type, STREAM_TYPE);
  assert.equal(stream.status, "experimental");
  assert.equal(stream.unitEconomics.marginBps, MARGIN_BPS_DEFAULT);
  assert.deepEqual(stream.unitEconomics.perCallSamples, []);
  assert.equal(stream.unitEconomics.totalCallsBilled, 0);
  assert.equal(treasury.revenue.streams.length, 1);
});

test("ensureAiRoutingMarginStream: idempotent on second call", () => {
  const treasury = freshTreasury();
  const a = ensureAiRoutingMarginStream(treasury, {});
  const b = ensureAiRoutingMarginStream(treasury, {});
  assert.equal(treasury.revenue.streams.length, 1);
  assert.equal(a.id, b.id);
});

test("ensureAiRoutingMarginStream: refreshes marginBps from env on re-entry", () => {
  const treasury = freshTreasury();
  ensureAiRoutingMarginStream(treasury, { ORBIT_AI_ROUTING_MARGIN_BPS: "200" });
  let stream = revenueStreams.getStream(treasury, STREAM_ID);
  assert.equal(stream.unitEconomics.marginBps, 200);

  ensureAiRoutingMarginStream(treasury, { ORBIT_AI_ROUTING_MARGIN_BPS: "1500" });
  stream = revenueStreams.getStream(treasury, STREAM_ID);
  assert.equal(stream.unitEconomics.marginBps, 1500);
});

test("ensureAiRoutingMarginStream: works transparently on a treasury with NO streams key", () => {
  // No `revenue` field at all — the helper must use ensureStreamsArray.
  const treasury = {};
  const stream = ensureAiRoutingMarginStream(treasury, {});
  assert.ok(Array.isArray(treasury.revenue.streams));
  assert.equal(stream.id, STREAM_ID);
});

test("recordAiCall: adds margin to lifetimeRevenueWei", () => {
  const treasury = freshTreasury();
  const result = recordAiCall(treasury, {}, {
    provider: "openai",
    model: "gpt-test",
    promptTokens: 100,
    completionTokens: 50,
    wholesaleCostWei: 10n ** 18n,
    cycle: 42
  });
  assert.equal(result.marginWei, 5n * 10n ** 16n);
  assert.equal(result.billedWei, 10n ** 18n + 5n * 10n ** 16n);

  const stream = revenueStreams.getStream(treasury, STREAM_ID);
  assert.equal(stream.lifetimeRevenueWei, (5n * 10n ** 16n).toString());

  // Second call accumulates.
  recordAiCall(treasury, {}, {
    provider: "openai",
    model: "gpt-test",
    wholesaleCostWei: 10n ** 18n,
    cycle: 43
  });
  const stream2 = revenueStreams.getStream(treasury, STREAM_ID);
  assert.equal(stream2.lifetimeRevenueWei, (2n * 5n * 10n ** 16n).toString());
});

test("recordAiCall: increments totalCallsBilled even when margin is 0", () => {
  const treasury = freshTreasury();
  recordAiCall(treasury, {}, { wholesaleCostWei: 0n });
  recordAiCall(treasury, {}, { wholesaleCostWei: 0n });
  const stream = revenueStreams.getStream(treasury, STREAM_ID);
  assert.equal(stream.unitEconomics.totalCallsBilled, 2);
  assert.equal(stream.lifetimeRevenueWei, "0");
  assert.equal(stream.unitEconomics.perCallSamples.length, 2);
});

test("recordAiCall: caps perCallSamples at PER_CALL_SAMPLES_CAP", () => {
  const treasury = freshTreasury();
  for (let i = 0; i < PER_CALL_SAMPLES_CAP + 25; i += 1) {
    recordAiCall(treasury, {}, {
      provider: "p",
      model: "m",
      wholesaleCostWei: 10n ** 18n,
      cycle: i
    });
  }
  const stream = revenueStreams.getStream(treasury, STREAM_ID);
  assert.equal(stream.unitEconomics.perCallSamples.length, PER_CALL_SAMPLES_CAP);
  assert.equal(stream.unitEconomics.totalCallsBilled, PER_CALL_SAMPLES_CAP + 25);
  // The most recent sample's cycle should be the last index.
  const last = stream.unitEconomics.perCallSamples[stream.unitEconomics.perCallSamples.length - 1];
  assert.equal(last.cycle, PER_CALL_SAMPLES_CAP + 24);
});

test("recordAiCall: works on a treasury with no streams array (calls ensureStreamsArray)", () => {
  const treasury = {}; // truly empty
  const result = recordAiCall(treasury, {}, {
    provider: "p",
    wholesaleCostWei: 10n ** 18n,
    cycle: 1
  });
  assert.ok(Array.isArray(treasury.revenue.streams));
  assert.equal(result.marginWei, 5n * 10n ** 16n);
});

test("recordAiCall: respects env-overridden margin bps", () => {
  const treasury = freshTreasury();
  recordAiCall(treasury, { ORBIT_AI_ROUTING_MARGIN_BPS: "1000" }, {
    wholesaleCostWei: 10n ** 18n
  });
  const stream = revenueStreams.getStream(treasury, STREAM_ID);
  // 10% of 1e18 = 1e17
  assert.equal(stream.lifetimeRevenueWei, (10n ** 17n).toString());
  assert.equal(stream.unitEconomics.marginBps, 1000);
});

test("summarizeRevenue: returns zeros when no calls have been recorded", () => {
  const treasury = freshTreasury();
  const summary = summarizeRevenue(treasury);
  assert.equal(summary.streamId, STREAM_ID);
  assert.equal(summary.lifetimeRevenueWei, "0");
  assert.equal(summary.totalCallsBilled, 0);
  assert.equal(summary.avgMarginPerCallWei, "0");
  assert.deepEqual(summary.recentSamples, []);
});

test("summarizeRevenue: avg = lifetime / count after many calls", () => {
  const treasury = freshTreasury();
  for (let i = 0; i < 4; i += 1) {
    recordAiCall(treasury, {}, { wholesaleCostWei: 10n ** 18n, cycle: i });
  }
  const summary = summarizeRevenue(treasury);
  assert.equal(summary.totalCallsBilled, 4);
  // lifetime = 4 * 5e16 = 2e17; avg = 5e16
  assert.equal(summary.lifetimeRevenueWei, (4n * 5n * 10n ** 16n).toString());
  assert.equal(summary.avgMarginPerCallWei, (5n * 10n ** 16n).toString());
  // 4 < 10 cap, so recentSamples has 4 entries
  assert.equal(summary.recentSamples.length, 4);
});

test("summarizeRevenue: recentSamples returns at most 10", () => {
  const treasury = freshTreasury();
  for (let i = 0; i < 25; i += 1) {
    recordAiCall(treasury, {}, { wholesaleCostWei: 10n ** 18n, cycle: i });
  }
  const summary = summarizeRevenue(treasury);
  assert.equal(summary.recentSamples.length, 10);
  // Last sample should have the highest cycle (24).
  assert.equal(summary.recentSamples[summary.recentSamples.length - 1].cycle, 24);
});

test("recordAiCall: samples capture provider/model/tokens/cycle/adopterId", () => {
  const treasury = freshTreasury();
  recordAiCall(treasury, {}, {
    provider: "openrouter",
    model: "anthropic/claude",
    promptTokens: 1234,
    completionTokens: 567,
    wholesaleCostWei: 10n ** 18n,
    cycle: 99,
    adopterId: "adopter-xyz"
  });
  const stream = revenueStreams.getStream(treasury, STREAM_ID);
  const sample = stream.unitEconomics.perCallSamples[0];
  assert.equal(sample.provider, "openrouter");
  assert.equal(sample.model, "anthropic/claude");
  assert.equal(sample.promptTokens, 1234);
  assert.equal(sample.completionTokens, 567);
  assert.equal(sample.cycle, 99);
  assert.equal(sample.adopterId, "adopter-xyz");
  assert.equal(sample.wholesaleCostWei, (10n ** 18n).toString());
  assert.equal(sample.marginWei, (5n * 10n ** 16n).toString());
  assert.equal(sample.billedWei, (10n ** 18n + 5n * 10n ** 16n).toString());
  assert.equal(sample.marginBps, MARGIN_BPS_DEFAULT);
});
