"use strict";

// S-REVENUE-3: identity-capture data extraction.
//
// The identity-capture module is pure — it expects pre-assembled time
// series. This module is the integration boundary that walks the available
// memory artifacts to build:
//
//   - treasuryGrowth        — [{ ts, treasuryWei }]
//   - qualitativeSignals    — {
//        adopterCount: [{ ts, value }],
//        adopterTrustScore: [{ ts, value }],
//        specImplementationCount: [{ ts, value }]
//      }
//
// All readers are best-effort. Missing files / malformed JSON / unexpected
// shapes all return empty arrays. The detector handles "insufficient_data"
// gracefully — the explorer cycle MUST NOT fail if these readers break.

const fs = require("fs");
const path = require("path");

const marketSignals = require("./market-signals");

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function safeReadJson(file) {
  try {
    const raw = fs.readFileSync(file, "utf-8");
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    return null;
  }
}

function resolveNow(now) {
  if (now instanceof Date) return now.getTime();
  if (typeof now === "number" && Number.isFinite(now)) return now;
  if (typeof now === "string") {
    const t = Date.parse(now);
    if (Number.isFinite(t)) return t;
  }
  return Date.now();
}

function loadTreasuryGrowthSeries(repoRoot, lookbackDays, now) {
  // Builds a treasury-growth time series. Sources, in order of preference:
  //
  //  1. memory/treasury-snapshots/*.json — if a snapshot directory exists,
  //     each file's mtime + parsed totalRevenueWei (or sum of stream
  //     lifetimeRevenueWei) becomes a point.
  //  2. memory/treasury.json streams[].lastClaim.ts + lifetimeRevenueWei.
  //     If streams have a per-claim ledger this gives a sparse but real
  //     series; otherwise we fall through.
  //  3. synthetic single-point: current sum of lifetimeRevenueWei stamped
  //     `now`. This is the v1 fallback.
  //
  // Returns sorted-ascending [{ ts, treasuryWei }]. Empty array if no data.
  if (!repoRoot || typeof repoRoot !== "string") return [];
  const lookback = Number.isFinite(lookbackDays) && lookbackDays > 0
    ? Math.floor(lookbackDays)
    : 90;
  const nowMs = resolveNow(now);
  const cutoffMs = nowMs - lookback * MS_PER_DAY;

  const out = [];

  // (1) snapshot directory.
  const snapDir = path.join(repoRoot, "memory", "treasury-snapshots");
  try {
    const files = fs.readdirSync(snapDir).filter((f) => /\.json$/.test(f));
    for (const f of files) {
      const full = path.join(snapDir, f);
      const data = safeReadJson(full);
      if (!data || typeof data !== "object") continue;
      let ts = data.ts || data.timestamp || data.snapshotAt || null;
      if (!ts) {
        try {
          const stat = fs.statSync(full);
          ts = new Date(stat.mtimeMs).toISOString();
        } catch {
          continue;
        }
      }
      const parsedTs = Date.parse(ts);
      if (!Number.isFinite(parsedTs)) continue;
      if (parsedTs < cutoffMs || parsedTs > nowMs) continue;
      let treasuryWei = null;
      if (typeof data.totalRevenueWei === "string") {
        treasuryWei = data.totalRevenueWei;
      } else if (data.revenue && Array.isArray(data.revenue.streams)) {
        try {
          let sum = 0n;
          for (const s of data.revenue.streams) {
            if (s && typeof s.lifetimeRevenueWei === "string") {
              sum += BigInt(s.lifetimeRevenueWei);
            }
          }
          treasuryWei = sum.toString();
        } catch {
          treasuryWei = null;
        }
      }
      if (treasuryWei === null) continue;
      out.push({ ts, treasuryWei });
    }
  } catch (err) {
    // dir missing — fine.
  }

  // (2) treasury.json streams[].lastClaim ledger if any.
  if (out.length === 0) {
    const tj = safeReadJson(path.join(repoRoot, "memory", "treasury.json"));
    if (tj && tj.revenue && Array.isArray(tj.revenue.streams)) {
      let runningSum = 0n;
      const pts = [];
      for (const s of tj.revenue.streams) {
        if (!s || typeof s !== "object") continue;
        if (!s.lastClaim || typeof s.lastClaim !== "object") continue;
        const ts = s.lastClaim.ts;
        if (typeof ts !== "string") continue;
        const parsedTs = Date.parse(ts);
        if (!Number.isFinite(parsedTs)) continue;
        try {
          if (typeof s.lifetimeRevenueWei === "string") {
            runningSum += BigInt(s.lifetimeRevenueWei);
          }
        } catch {
          continue;
        }
        if (parsedTs < cutoffMs || parsedTs > nowMs) continue;
        pts.push({ ts, treasuryWei: runningSum.toString() });
      }
      for (const p of pts) out.push(p);
    }

    // (3) synthetic single point: sum streams lifetimeRevenueWei, stamped now.
    if (out.length === 0 && tj && tj.revenue && Array.isArray(tj.revenue.streams)) {
      try {
        let sum = 0n;
        for (const s of tj.revenue.streams) {
          if (s && typeof s.lifetimeRevenueWei === "string") {
            sum += BigInt(s.lifetimeRevenueWei);
          }
        }
        out.push({
          ts: new Date(nowMs).toISOString(),
          treasuryWei: sum.toString()
        });
      } catch {
        // ignore
      }
    }
  }

  out.sort((a, b) => {
    if (a.ts < b.ts) return -1;
    if (a.ts > b.ts) return 1;
    return 0;
  });
  return out;
}

function loadQualitativeSignals(repoRoot, lookbackDays, now) {
  // Reads memory/market-signals.jsonl via marketSignals.readSignals.
  // Extracts time series:
  //   - adopterCount: per issue_reaction_index entry, count of repos.length
  //   - adopterTrustScore: per entry, mean repo.score (proxy for trust).
  //   - specImplementationCount: read from memory/adopters-registry.json
  //     count at "now"; if registry has updatedAt entries we cannot
  //     reconstruct history, so single current point.
  const result = {
    adopterCount: [],
    adopterTrustScore: [],
    specImplementationCount: []
  };
  if (!repoRoot || typeof repoRoot !== "string") return result;

  const lookback = Number.isFinite(lookbackDays) && lookbackDays > 0
    ? Math.floor(lookbackDays)
    : 90;
  const nowMs = resolveNow(now);
  const cutoffMs = nowMs - lookback * MS_PER_DAY;
  const sinceIso = new Date(cutoffMs).toISOString();

  let signals = [];
  try {
    signals = marketSignals.readSignals(repoRoot, { since: sinceIso });
  } catch (err) {
    signals = [];
  }
  if (!Array.isArray(signals)) signals = [];

  for (const s of signals) {
    if (!s || typeof s !== "object") continue;
    if (s.kind !== "issue_reaction_index") continue;
    const ts = typeof s.ts === "string" ? s.ts : null;
    if (!ts) continue;
    const parsedTs = Date.parse(ts);
    if (!Number.isFinite(parsedTs)) continue;
    if (parsedTs < cutoffMs || parsedTs > nowMs) continue;
    const repos = Array.isArray(s.repos) ? s.repos : [];
    const adopterRepoCount = repos.length;
    let sumScore = 0;
    let nWithScore = 0;
    for (const r of repos) {
      if (r && Number.isFinite(r.score)) {
        sumScore += r.score;
        nWithScore += 1;
      }
    }
    const trustScore = nWithScore > 0 ? sumScore / nWithScore : 0;
    result.adopterCount.push({ ts, value: adopterRepoCount });
    result.adopterTrustScore.push({ ts, value: trustScore });
  }

  // specImplementationCount: current count from registry. We don't have a
  // historical ledger of registry changes, so we repeat the current count at
  // each issue_reaction_index timestamp (one point per ts). This gives the
  // detector enough aligned samples to evaluate, at the cost of a flat
  // signal — but a flat signal correctly produces near-zero correlation
  // (which the detector treats as no divergence on that axis). Better
  // than starving the detector of a third signal entirely.
  try {
    const registryFile = path.join(repoRoot, "memory", "adopters-registry.json");
    const raw = fs.readFileSync(registryFile, "utf-8");
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.adopters)) {
      const count = parsed.adopters.filter((a) => {
        if (!a || typeof a !== "object") return false;
        if (a.adopted === true) return true;
        const status = typeof a.status === "string" ? a.status : "";
        return status === "verified" || status === "adopted" || status === "active";
      }).length;
      // Find the canonical timestamps from issue_reaction_index signals;
      // these are the alignment anchors the detector will use.
      if (result.adopterCount.length > 0) {
        for (const point of result.adopterCount) {
          result.specImplementationCount.push({ ts: point.ts, value: count });
        }
      } else {
        const ts = typeof parsed.updatedAt === "string"
          ? parsed.updatedAt
          : new Date(nowMs).toISOString();
        const parsedTs = Date.parse(ts);
        if (Number.isFinite(parsedTs) && parsedTs >= cutoffMs && parsedTs <= nowMs) {
          result.specImplementationCount.push({ ts, value: count });
        }
      }
    }
  } catch (err) {
    // ignore — leave specImplementationCount empty.
  }

  // Sort each series ascending.
  for (const k of Object.keys(result)) {
    result[k].sort((a, b) => {
      if (a.ts < b.ts) return -1;
      if (a.ts > b.ts) return 1;
      return 0;
    });
  }
  return result;
}

function gatherCaptureInputs(repoRoot, env, now) {
  // Combines treasuryGrowth + qualitativeSignals into the shape that
  // identityCapture.evaluateCapture expects.
  let lookbackDays = 90;
  if (env && typeof env === "object") {
    const raw = env.ORBIT_CAPTURE_LOOKBACK_DAYS;
    if (raw !== undefined && raw !== null && String(raw).trim() !== "") {
      const parsed = Number(raw);
      if (Number.isFinite(parsed) && Number.isInteger(parsed) && parsed > 0) {
        lookbackDays = parsed;
      }
    }
  }
  const treasuryGrowth = loadTreasuryGrowthSeries(repoRoot, lookbackDays, now);
  const qualitativeSignals = loadQualitativeSignals(repoRoot, lookbackDays, now);
  return { treasuryGrowth, qualitativeSignals };
}

module.exports = {
  gatherCaptureInputs,
  loadQualitativeSignals,
  loadTreasuryGrowthSeries
};
