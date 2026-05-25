"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  DEFAULT_LOOKBACK_DAYS,
  DEFAULT_MIN_DATA_POINTS,
  DEFAULT_WARNING_THRESHOLD,
  buildTimeSeries,
  evaluateCapture,
  loadConfig,
  rankCorrelation,
  spearmanRank,
  summarizeCapture
} = require("../src/agent/identity-capture");

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-05-25T00:00:00Z");

function daysAgo(n) {
  return new Date(NOW.getTime() - n * MS_PER_DAY).toISOString();
}

// ---------------------------------------------------------------------------
// loadConfig
// ---------------------------------------------------------------------------

test("loadConfig returns defaults when env is empty", () => {
  const cfg = loadConfig({});
  assert.equal(cfg.lookbackDays, DEFAULT_LOOKBACK_DAYS);
  assert.equal(cfg.warningThreshold, DEFAULT_WARNING_THRESHOLD);
  assert.equal(cfg.minDataPoints, DEFAULT_MIN_DATA_POINTS);
});

test("loadConfig honours env overrides for all three fields", () => {
  const cfg = loadConfig({
    ORBIT_CAPTURE_LOOKBACK_DAYS: "30",
    ORBIT_CAPTURE_WARNING_THRESHOLD: "0.75",
    ORBIT_CAPTURE_MIN_DATA_POINTS: "10"
  });
  assert.equal(cfg.lookbackDays, 30);
  assert.equal(cfg.warningThreshold, 0.75);
  assert.equal(cfg.minDataPoints, 10);
});

test("loadConfig rejects out-of-range lookbackDays", () => {
  assert.throws(
    () => loadConfig({ ORBIT_CAPTURE_LOOKBACK_DAYS: "5" }),
    /must be in \[14, 365\]/
  );
  assert.throws(
    () => loadConfig({ ORBIT_CAPTURE_LOOKBACK_DAYS: "999" }),
    /must be in \[14, 365\]/
  );
});

test("loadConfig rejects out-of-range threshold and minDataPoints", () => {
  assert.throws(
    () => loadConfig({ ORBIT_CAPTURE_WARNING_THRESHOLD: "1.5" }),
    /must be in \[0, 1\]/
  );
  assert.throws(
    () => loadConfig({ ORBIT_CAPTURE_WARNING_THRESHOLD: "-0.1" }),
    /must be in \[0, 1\]/
  );
  assert.throws(
    () => loadConfig({ ORBIT_CAPTURE_MIN_DATA_POINTS: "2" }),
    /must be in \[4, 50\]/
  );
  assert.throws(
    () => loadConfig({ ORBIT_CAPTURE_MIN_DATA_POINTS: "1000" }),
    /must be in \[4, 50\]/
  );
});

test("loadConfig rejects non-numeric input", () => {
  assert.throws(
    () => loadConfig({ ORBIT_CAPTURE_LOOKBACK_DAYS: "abc" }),
    /must be an integer/
  );
});

// ---------------------------------------------------------------------------
// spearmanRank
// ---------------------------------------------------------------------------

test("spearmanRank: empty array returns empty", () => {
  assert.deepEqual(spearmanRank([]), []);
});

test("spearmanRank: sorted ascending yields [1, 2, 3]", () => {
  assert.deepEqual(spearmanRank([10, 20, 30]), [1, 2, 3]);
});

test("spearmanRank: sorted descending yields [3, 2, 1]", () => {
  assert.deepEqual(spearmanRank([30, 20, 10]), [3, 2, 1]);
});

test("spearmanRank: ties get average rank", () => {
  assert.deepEqual(spearmanRank([10, 20, 20, 30]), [1, 2.5, 2.5, 4]);
});

test("spearmanRank: multi-tie group averages correctly", () => {
  // values [5, 5, 5, 10] => ranks averaged for the three 5s = (1+2+3)/3 = 2
  assert.deepEqual(spearmanRank([5, 5, 5, 10]), [2, 2, 2, 4]);
});

// ---------------------------------------------------------------------------
// rankCorrelation
// ---------------------------------------------------------------------------

test("rankCorrelation: perfect positive yields +1", () => {
  assert.equal(rankCorrelation([1, 2, 3], [10, 20, 30]), 1);
});

test("rankCorrelation: perfect inverse yields -1", () => {
  assert.equal(rankCorrelation([1, 2, 3], [30, 20, 10]), -1);
});

test("rankCorrelation: independent-ish series stays near 0", () => {
  const rho = rankCorrelation([1, 2, 3], [5, 1, 4]);
  // [1,2,3] -> [1,2,3]; [5,1,4] -> [3,1,2]; means 2 each; cov:
  //   (1-2)(3-2)+(2-2)(1-2)+(3-2)(2-2) = -1 + 0 + 0 = -1
  // var = 2 each => rho = -1/2 = -0.5
  assert.equal(rho, -0.5);
});

test("rankCorrelation: single-point series returns NaN", () => {
  assert.equal(Number.isNaN(rankCorrelation([5], [7])), true);
  assert.equal(Number.isNaN(rankCorrelation([], [])), true);
});

test("rankCorrelation: zero-variance series returns NaN", () => {
  assert.equal(Number.isNaN(rankCorrelation([5, 5, 5], [1, 2, 3])), true);
});

test("rankCorrelation: mismatched lengths return NaN", () => {
  assert.equal(Number.isNaN(rankCorrelation([1, 2, 3], [1, 2])), true);
});

// ---------------------------------------------------------------------------
// buildTimeSeries
// ---------------------------------------------------------------------------

test("buildTimeSeries: filters samples outside the window", () => {
  const samples = [
    { ts: daysAgo(5), value: 10 },
    { ts: daysAgo(100), value: 20 }, // outside 90-day window
    { ts: daysAgo(15), value: 30 }
  ];
  const out = buildTimeSeries(samples, 90, NOW);
  assert.equal(out.length, 2);
  // sorted ascending by ts
  assert.equal(out[0].value, 30); // 15 days ago
  assert.equal(out[1].value, 10); // 5 days ago
});

test("buildTimeSeries: sorts ascending by timestamp", () => {
  const samples = [
    { ts: daysAgo(1), value: 1 },
    { ts: daysAgo(10), value: 10 },
    { ts: daysAgo(3), value: 3 }
  ];
  const out = buildTimeSeries(samples, 30, NOW);
  const tss = out.map(o => o.ts);
  assert.deepEqual(tss, [...tss].sort());
});

test("buildTimeSeries: converts string-bigint via log10 scaling", () => {
  const wei = "1000000000000000000"; // 1e18, an ether
  const out = buildTimeSeries(
    [{ ts: daysAgo(1), value: wei }],
    30,
    NOW
  );
  assert.equal(out.length, 1);
  // log10(1e18) = 18
  assert.ok(Math.abs(out[0].value - 18) < 1e-9);
});

test("buildTimeSeries: accepts treasuryWei as the value carrier", () => {
  const out = buildTimeSeries(
    [{ ts: daysAgo(1), treasuryWei: "10000000000000000000" }], // 1e19
    30,
    NOW
  );
  assert.equal(out.length, 1);
  assert.ok(Math.abs(out[0].value - 19) < 1e-9);
});

test("buildTimeSeries: discards malformed samples without throwing", () => {
  const samples = [
    null,
    {},
    { ts: "not-a-date", value: 5 },
    { ts: daysAgo(1) }, // no value at all
    { ts: daysAgo(2), value: 5 }
  ];
  const out = buildTimeSeries(samples, 30, NOW);
  assert.equal(out.length, 1);
  assert.equal(out[0].value, 5);
});

// ---------------------------------------------------------------------------
// evaluateCapture
// ---------------------------------------------------------------------------

function healthyDataset() {
  // Treasury rising monotonically; all qualitative signals also rising.
  const n = 12;
  const treasury = [];
  const adopters = [];
  const trust = [];
  const specs = [];
  for (let i = 0; i < n; i += 1) {
    const ts = daysAgo(n - i);
    treasury.push({ ts, treasuryWei: String(BigInt(i + 1) * BigInt("1000000000000000")) });
    adopters.push({ ts, value: i + 1 });
    trust.push({ ts, value: 0.5 + i * 0.03 });
    specs.push({ ts, value: i });
  }
  return {
    treasury,
    qualitative: {
      adopterCount: adopters,
      adopterTrustScore: trust,
      specImplementationCount: specs
    }
  };
}

function capturePatternDataset() {
  // Treasury rising; adopters flat; trust falling. Goodhart classic.
  const n = 12;
  const treasury = [];
  const adopters = [];
  const trust = [];
  const specs = [];
  for (let i = 0; i < n; i += 1) {
    const ts = daysAgo(n - i);
    treasury.push({ ts, treasuryWei: String(BigInt(i + 1) * BigInt("1000000000000000")) });
    adopters.push({ ts, value: 5 + (i % 2) * 0.01 }); // basically flat
    trust.push({ ts, value: 1.0 - i * 0.05 }); // falling
    specs.push({ ts, value: 3 });             // flat -> will be NaN, but with tiny noise...
  }
  // give specs a tiny ascending wobble so the correlation is defined but weak
  for (let i = 0; i < n; i += 1) {
    specs[i].value = 3 + (i % 3) * 0.001;
  }
  return {
    treasury,
    qualitative: {
      adopterCount: adopters,
      adopterTrustScore: trust,
      specImplementationCount: specs
    }
  };
}

function criticalDataset() {
  // Treasury rising; ALL qualitative signals falling.
  const n = 12;
  const treasury = [];
  const adopters = [];
  const trust = [];
  const specs = [];
  for (let i = 0; i < n; i += 1) {
    const ts = daysAgo(n - i);
    treasury.push({ ts, treasuryWei: String(BigInt(i + 1) * BigInt("1000000000000000")) });
    adopters.push({ ts, value: 20 - i });
    trust.push({ ts, value: 1.0 - i * 0.07 });
    specs.push({ ts, value: 10 - i });
  }
  return {
    treasury,
    qualitative: {
      adopterCount: adopters,
      adopterTrustScore: trust,
      specImplementationCount: specs
    }
  };
}

test("evaluateCapture: healthy dataset yields low risk and 'healthy'", () => {
  const ds = healthyDataset();
  const ev = evaluateCapture(ds.treasury, ds.qualitative, {}, { now: NOW });
  assert.equal(ev.ok, true);
  assert.ok(ev.captureRiskIndex < 0.3, `expected <0.3, got ${ev.captureRiskIndex}`);
  assert.equal(ev.recommendation, "healthy");
  assert.equal(ev.warning, false);
  // All correlations should be near +1 (rising together)
  for (const key of ["adopterCount", "adopterTrustScore", "specImplementationCount"]) {
    assert.ok(ev.correlations[key] > 0.9, `${key} rho=${ev.correlations[key]}`);
  }
});

test("evaluateCapture: capture pattern yields warning-grade risk", () => {
  const ds = capturePatternDataset();
  const ev = evaluateCapture(ds.treasury, ds.qualitative, {}, { now: NOW });
  assert.equal(ev.ok, true);
  // trust is strongly inverse; adopters and specs are flat-ish; the average
  // contribution should be at least in the watch/warning band.
  assert.ok(ev.captureRiskIndex > 0.2, `expected >0.2, got ${ev.captureRiskIndex}`);
  assert.ok(ev.correlations.adopterTrustScore < -0.5);
  assert.ok(["watch", "warning", "critical"].includes(ev.recommendation));
});

test("evaluateCapture: critical dataset yields 'critical' recommendation", () => {
  const ds = criticalDataset();
  const ev = evaluateCapture(ds.treasury, ds.qualitative, {}, { now: NOW });
  assert.equal(ev.ok, true);
  assert.ok(ev.captureRiskIndex >= 0.8, `expected >=0.8, got ${ev.captureRiskIndex}`);
  assert.equal(ev.recommendation, "critical");
  assert.equal(ev.warning, true);
  for (const key of ["adopterCount", "adopterTrustScore", "specImplementationCount"]) {
    assert.ok(ev.correlations[key] < -0.9, `${key} rho=${ev.correlations[key]}`);
  }
});

test("evaluateCapture: insufficient data returns ok=false with reason", () => {
  const treasury = [
    { ts: daysAgo(2), treasuryWei: "1000" },
    { ts: daysAgo(1), treasuryWei: "2000" }
  ];
  const qualitative = {
    adopterCount: [{ ts: daysAgo(2), value: 1 }, { ts: daysAgo(1), value: 2 }],
    adopterTrustScore: [{ ts: daysAgo(2), value: 0.5 }],
    specImplementationCount: []
  };
  const ev = evaluateCapture(treasury, qualitative, {}, { now: NOW });
  assert.equal(ev.ok, false);
  assert.equal(ev.reason, "insufficient_data");
  assert.equal(ev.warning, false);
});

test("evaluateCapture: warning threshold env override flips the warning flag", () => {
  const ds = capturePatternDataset();
  const lowThresh = evaluateCapture(
    ds.treasury,
    ds.qualitative,
    { ORBIT_CAPTURE_WARNING_THRESHOLD: "0.1" },
    { now: NOW }
  );
  assert.equal(lowThresh.warning, true);
});

// ---------------------------------------------------------------------------
// summarizeCapture
// ---------------------------------------------------------------------------

test("summarizeCapture: topDivergence picks the most-negative correlation", () => {
  const evaluation = {
    captureRiskIndex: 0.5,
    recommendation: "watch",
    warning: false,
    correlations: {
      adopterCount: 0.4,
      adopterTrustScore: -0.85,
      specImplementationCount: -0.2
    },
    dataPoints: { adopterCount: 12, adopterTrustScore: 12, specImplementationCount: 12 }
  };
  const s = summarizeCapture(evaluation);
  assert.equal(s.topDivergence.signal, "adopterTrustScore");
  assert.equal(s.topDivergence.correlation, -0.85);
  assert.equal(s.dataConfidence, "medium");
  assert.equal(s.riskIndex, 0.5);
  assert.equal(s.recommendation, "watch");
});

test("summarizeCapture: dataConfidence reflects sample-count band", () => {
  const low = summarizeCapture({
    captureRiskIndex: 0.1,
    recommendation: "healthy",
    warning: false,
    correlations: { adopterCount: 0.8 },
    dataPoints: { adopterCount: 4 }
  });
  assert.equal(low.dataConfidence, "low");

  const high = summarizeCapture({
    captureRiskIndex: 0.1,
    recommendation: "healthy",
    warning: false,
    correlations: { adopterCount: 0.8 },
    dataPoints: { adopterCount: 50 }
  });
  assert.equal(high.dataConfidence, "high");
});

test("summarizeCapture: handles missing/null evaluation gracefully", () => {
  const s = summarizeCapture(null);
  assert.equal(s.riskIndex, 0);
  assert.equal(s.recommendation, "healthy");
  assert.equal(s.warning, false);
  assert.equal(s.topDivergence, null);
  assert.equal(s.dataConfidence, "low");
});
