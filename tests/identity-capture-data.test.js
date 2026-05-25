"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const {
  gatherCaptureInputs,
  loadQualitativeSignals,
  loadTreasuryGrowthSeries
} = require("../src/agent/identity-capture-data");

function tmpDir(label) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `orbit-ic-data-${label || ""}-`));
}

function rm(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
}

test("loadTreasuryGrowthSeries with no treasury.json returns []", () => {
  const dir = tmpDir("no-tj");
  try {
    fs.mkdirSync(path.join(dir, "memory"), { recursive: true });
    const series = loadTreasuryGrowthSeries(dir, 90, new Date("2026-05-25T00:00:00Z"));
    assert.deepEqual(series, []);
  } finally {
    rm(dir);
  }
});

test("loadTreasuryGrowthSeries with synthesizable streams returns single point", () => {
  const dir = tmpDir("synth");
  try {
    fs.mkdirSync(path.join(dir, "memory"), { recursive: true });
    fs.writeFileSync(
      path.join(dir, "memory", "treasury.json"),
      JSON.stringify({
        revenue: {
          streams: [
            { id: "a", lifetimeRevenueWei: "1000" },
            { id: "b", lifetimeRevenueWei: "2000" }
          ]
        }
      })
    );
    const now = new Date("2026-05-25T00:00:00Z");
    const series = loadTreasuryGrowthSeries(dir, 90, now);
    assert.equal(series.length, 1);
    assert.equal(series[0].treasuryWei, "3000");
    // Stamped near `now`.
    const tsMs = Date.parse(series[0].ts);
    assert.ok(Math.abs(tsMs - now.getTime()) < 1000);
  } finally {
    rm(dir);
  }
});

test("loadTreasuryGrowthSeries handles invalid repoRoot defensively", () => {
  assert.deepEqual(loadTreasuryGrowthSeries(null, 90, new Date()), []);
  assert.deepEqual(loadTreasuryGrowthSeries("", 90, new Date()), []);
});

test("loadQualitativeSignals with no signals file returns empty series", () => {
  const dir = tmpDir("no-sig");
  try {
    fs.mkdirSync(path.join(dir, "memory"), { recursive: true });
    const out = loadQualitativeSignals(dir, 90, new Date("2026-05-25T00:00:00Z"));
    assert.deepEqual(out.adopterCount, []);
    assert.deepEqual(out.adopterTrustScore, []);
    assert.deepEqual(out.specImplementationCount, []);
  } finally {
    rm(dir);
  }
});

test("loadQualitativeSignals extracts adopterCount + adopterTrustScore from issue_reaction_index rows", () => {
  const dir = tmpDir("sig");
  try {
    fs.mkdirSync(path.join(dir, "memory"), { recursive: true });
    const rows = [
      {
        kind: "issue_reaction_index",
        ts: "2026-05-20T00:00:00Z",
        repos: [
          { repo: "a/a", score: 3 },
          { repo: "b/b", score: 7 }
        ]
      },
      {
        kind: "issue_reaction_index",
        ts: "2026-05-22T00:00:00Z",
        repos: [
          { repo: "a/a", score: 4 },
          { repo: "b/b", score: 8 },
          { repo: "c/c", score: 9 }
        ]
      },
      // unrelated kind — must be ignored
      {
        kind: "weth_inflow_24h",
        ts: "2026-05-23T00:00:00Z",
        valueWei: "1000"
      }
    ];
    fs.writeFileSync(
      path.join(dir, "memory", "market-signals.jsonl"),
      rows.map((r) => JSON.stringify(r)).join("\n") + "\n"
    );
    const out = loadQualitativeSignals(dir, 90, new Date("2026-05-25T00:00:00Z"));
    assert.equal(out.adopterCount.length, 2);
    assert.equal(out.adopterTrustScore.length, 2);
    assert.equal(out.adopterCount[0].value, 2);
    assert.equal(out.adopterCount[1].value, 3);
    // mean of (3,7) = 5; mean of (4,8,9) = 7
    assert.equal(out.adopterTrustScore[0].value, 5);
    assert.equal(out.adopterTrustScore[1].value, 7);
  } finally {
    rm(dir);
  }
});

test("loadQualitativeSignals reads specImplementationCount from adopters-registry.json", () => {
  const dir = tmpDir("spec");
  try {
    fs.mkdirSync(path.join(dir, "memory"), { recursive: true });
    fs.writeFileSync(
      path.join(dir, "memory", "adopters-registry.json"),
      JSON.stringify({
        schema: "orbit-adopters/1",
        updatedAt: "2026-05-23T00:00:00Z",
        adopters: [
          { repo: "a/a", status: "verified", adopted: true },
          { repo: "b/b", status: "verified", adopted: true },
          { repo: "c/c", status: "handshake-pending", adopted: false }
        ]
      })
    );
    const out = loadQualitativeSignals(dir, 90, new Date("2026-05-25T00:00:00Z"));
    assert.equal(out.specImplementationCount.length, 1);
    assert.equal(out.specImplementationCount[0].value, 2);
  } finally {
    rm(dir);
  }
});

test("gatherCaptureInputs combines treasuryGrowth + qualitativeSignals", () => {
  const dir = tmpDir("combine");
  try {
    fs.mkdirSync(path.join(dir, "memory"), { recursive: true });
    fs.writeFileSync(
      path.join(dir, "memory", "treasury.json"),
      JSON.stringify({ revenue: { streams: [{ id: "a", lifetimeRevenueWei: "5" }] } })
    );
    fs.writeFileSync(
      path.join(dir, "memory", "market-signals.jsonl"),
      JSON.stringify({
        kind: "issue_reaction_index",
        ts: "2026-05-22T00:00:00Z",
        repos: [{ repo: "a/a", score: 2 }]
      }) + "\n"
    );
    const out = gatherCaptureInputs(dir, { ORBIT_CAPTURE_LOOKBACK_DAYS: "90" }, new Date("2026-05-25T00:00:00Z"));
    assert.ok(Array.isArray(out.treasuryGrowth));
    assert.ok(out.treasuryGrowth.length >= 1);
    assert.ok(out.qualitativeSignals);
    assert.ok(Array.isArray(out.qualitativeSignals.adopterCount));
    assert.equal(out.qualitativeSignals.adopterCount.length, 1);
  } finally {
    rm(dir);
  }
});
