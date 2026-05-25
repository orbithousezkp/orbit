"use strict";

// S-REVENUE-3: identity-capture (Goodhart) detector.
//
// Detects the failure mode named in REVENUE_EXPLORER.md §11 "Identity capture /
// Goodhart detection" and called out in §12 anti-pattern #2 ("Treasury >
// realized utility"). When treasury keeps growing while qualitative health
// signals (adopter count, adopter trust, spec-implementation count) decline,
// the entity is plausibly being captured by its own success metric — i.e.
// optimizing the number it is rewarded on at the expense of the identity that
// gave the number meaning.
//
// This module is intentionally a pure, side-effect-free analyzer. The caller
// (the revenue explorer surface) is responsible for assembling the time
// series from various sources (treasury.streams[].lifetimeRevenueWei
// timestamps, market-signals.jsonl rows for issue_reaction_index /
// adopter_ai_spend_by_bucket, adopters-registry.json) and passing them in.
//
// The output is a *risk index*, NOT a kill switch. Qualitative signals are
// noisy; the index is a warning surface for the dashboard and the cycle note.
// A hard auto-kill on this signal alone would be exactly the single-metric
// failure mode it is meant to flag.

const DEFAULT_LOOKBACK_DAYS = 90;
const DEFAULT_WARNING_THRESHOLD = 0.6;
const DEFAULT_MIN_DATA_POINTS = 8;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const LOOKBACK_MIN = 14;
const LOOKBACK_MAX = 365;
const MIN_DATA_POINTS_MIN = 4;
const MIN_DATA_POINTS_MAX = 50;

// Numbers above this magnitude get squashed to log10(value) before correlation
// to keep Spearman ranks numerically stable for wei-scale inputs. The rank
// transform itself is monotone-invariant so log10 is mathematically free; the
// guard exists for the BigInt-string ingestion path where the raw number
// would not fit Number range.
const LARGE_NUMBER_THRESHOLD = 1e15;

function loadConfig(env) {
  const source = env || process.env;

  let lookbackDays = DEFAULT_LOOKBACK_DAYS;
  const rawLookback = source.ORBIT_CAPTURE_LOOKBACK_DAYS;
  if (rawLookback !== undefined && rawLookback !== null && String(rawLookback).trim() !== "") {
    const parsed = Number(rawLookback);
    if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
      throw new Error(
        `identity-capture: ORBIT_CAPTURE_LOOKBACK_DAYS must be an integer, got: ${rawLookback}`
      );
    }
    if (parsed < LOOKBACK_MIN || parsed > LOOKBACK_MAX) {
      throw new Error(
        `identity-capture: ORBIT_CAPTURE_LOOKBACK_DAYS must be in [${LOOKBACK_MIN}, ${LOOKBACK_MAX}], got: ${parsed}`
      );
    }
    lookbackDays = parsed;
  }

  let warningThreshold = DEFAULT_WARNING_THRESHOLD;
  const rawThreshold = source.ORBIT_CAPTURE_WARNING_THRESHOLD;
  if (rawThreshold !== undefined && rawThreshold !== null && String(rawThreshold).trim() !== "") {
    const parsed = Number(rawThreshold);
    if (!Number.isFinite(parsed)) {
      throw new Error(
        `identity-capture: ORBIT_CAPTURE_WARNING_THRESHOLD must be a finite number, got: ${rawThreshold}`
      );
    }
    if (parsed < 0 || parsed > 1) {
      throw new Error(
        `identity-capture: ORBIT_CAPTURE_WARNING_THRESHOLD must be in [0, 1], got: ${parsed}`
      );
    }
    warningThreshold = parsed;
  }

  let minDataPoints = DEFAULT_MIN_DATA_POINTS;
  const rawMin = source.ORBIT_CAPTURE_MIN_DATA_POINTS;
  if (rawMin !== undefined && rawMin !== null && String(rawMin).trim() !== "") {
    const parsed = Number(rawMin);
    if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
      throw new Error(
        `identity-capture: ORBIT_CAPTURE_MIN_DATA_POINTS must be an integer, got: ${rawMin}`
      );
    }
    if (parsed < MIN_DATA_POINTS_MIN || parsed > MIN_DATA_POINTS_MAX) {
      throw new Error(
        `identity-capture: ORBIT_CAPTURE_MIN_DATA_POINTS must be in [${MIN_DATA_POINTS_MIN}, ${MIN_DATA_POINTS_MAX}], got: ${parsed}`
      );
    }
    minDataPoints = parsed;
  }

  return { lookbackDays, warningThreshold, minDataPoints };
}

// Average-rank assignment over a numeric series. Ties share the mean of their
// rank positions, matching the standard Spearman definition.
function spearmanRank(values) {
  if (!Array.isArray(values) || values.length === 0) return [];
  for (let i = 0; i < values.length; i += 1) {
    if (typeof values[i] !== "number" || !Number.isFinite(values[i])) {
      throw new Error(
        `identity-capture: spearmanRank requires finite numbers, got: ${values[i]} at index ${i}`
      );
    }
  }

  const indexed = values.map((value, index) => ({ value, index }));
  indexed.sort((a, b) => {
    if (a.value < b.value) return -1;
    if (a.value > b.value) return 1;
    return a.index - b.index;
  });

  const ranks = new Array(values.length);
  let i = 0;
  while (i < indexed.length) {
    let j = i;
    while (j + 1 < indexed.length && indexed[j + 1].value === indexed[i].value) {
      j += 1;
    }
    // ranks are 1-indexed; tied group spans positions i..j inclusive
    const avg = (i + 1 + (j + 1)) / 2;
    for (let k = i; k <= j; k += 1) {
      ranks[indexed[k].index] = avg;
    }
    i = j + 1;
  }
  return ranks;
}

function distinctCount(values) {
  const set = new Set();
  for (const v of values) set.add(v);
  return set.size;
}

function rankCorrelation(seriesA, seriesB) {
  if (!Array.isArray(seriesA) || !Array.isArray(seriesB)) return NaN;
  if (seriesA.length !== seriesB.length) return NaN;
  if (seriesA.length < 2) return NaN;
  if (distinctCount(seriesA) < 2 || distinctCount(seriesB) < 2) return NaN;

  const rA = spearmanRank(seriesA);
  const rB = spearmanRank(seriesB);

  const n = rA.length;
  let sumA = 0;
  let sumB = 0;
  for (let i = 0; i < n; i += 1) {
    sumA += rA[i];
    sumB += rB[i];
  }
  const meanA = sumA / n;
  const meanB = sumB / n;

  let cov = 0;
  let varA = 0;
  let varB = 0;
  for (let i = 0; i < n; i += 1) {
    const dA = rA[i] - meanA;
    const dB = rB[i] - meanB;
    cov += dA * dB;
    varA += dA * dA;
    varB += dB * dB;
  }
  if (varA === 0 || varB === 0) return NaN;
  const rho = cov / Math.sqrt(varA * varB);
  // numerical clamp — float rounding can drift outside [-1, 1] on tight runs.
  if (rho > 1) return 1;
  if (rho < -1) return -1;
  return rho;
}

function toNumberValue(raw) {
  if (typeof raw === "number") {
    if (!Number.isFinite(raw)) return null;
    if (Math.abs(raw) >= LARGE_NUMBER_THRESHOLD) {
      const abs = Math.abs(raw);
      const signed = raw < 0 ? -Math.log10(abs) : Math.log10(abs);
      return signed;
    }
    return raw;
  }
  if (typeof raw === "bigint") {
    // log10 of a BigInt via string length and leading digit
    if (raw === 0n) return 0;
    const negative = raw < 0n;
    const abs = negative ? -raw : raw;
    const str = abs.toString();
    if (str.length >= 16) {
      // approximate log10
      const leading = Number(str.slice(0, 15)) / Math.pow(10, 14);
      const exp = str.length - 1;
      const log = exp + Math.log10(leading);
      return negative ? -log : log;
    }
    const asNum = Number(abs);
    if (asNum >= LARGE_NUMBER_THRESHOLD) {
      const log = Math.log10(asNum);
      return negative ? -log : log;
    }
    return negative ? -asNum : asNum;
  }
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (trimmed === "") return null;
    // Try parsing as BigInt for wei-shaped strings; fall back to Number.
    if (/^-?\d+$/.test(trimmed)) {
      try {
        return toNumberValue(BigInt(trimmed));
      } catch {
        // fall through
      }
    }
    const asNum = Number(trimmed);
    if (!Number.isFinite(asNum)) return null;
    return toNumberValue(asNum);
  }
  return null;
}

function buildTimeSeries(samples, windowDays, now) {
  if (!Array.isArray(samples)) return [];
  const reference = now instanceof Date ? now.getTime() : (typeof now === "number" ? now : Date.now());
  const windowMs = (typeof windowDays === "number" && Number.isFinite(windowDays) && windowDays > 0)
    ? windowDays * MS_PER_DAY
    : DEFAULT_LOOKBACK_DAYS * MS_PER_DAY;
  const cutoff = reference - windowMs;

  const out = [];
  for (const sample of samples) {
    if (!sample || typeof sample !== "object") continue;
    const rawTs = sample.ts;
    if (rawTs === undefined || rawTs === null) continue;
    const ts = new Date(rawTs);
    const tsMs = ts.getTime();
    if (!Number.isFinite(tsMs)) continue;
    if (tsMs < cutoff) continue;
    if (tsMs > reference) continue;
    // accept "value" or "treasuryWei" as the raw value carrier
    const raw = sample.value !== undefined ? sample.value : sample.treasuryWei;
    const value = toNumberValue(raw);
    if (value === null || !Number.isFinite(value)) continue;
    out.push({ ts: ts.toISOString(), value });
  }
  out.sort((a, b) => {
    if (a.ts < b.ts) return -1;
    if (a.ts > b.ts) return 1;
    return 0;
  });
  return out;
}

// Align two parallel series by taking values in their sorted-by-time order
// and truncating to the shorter length. Time stamps need not match exactly —
// the rank correlation is invariant to monotone reparametrization of the time
// axis as long as the *ordering* of samples within each series is preserved.
function alignSeries(seriesA, seriesB) {
  const n = Math.min(seriesA.length, seriesB.length);
  if (n === 0) return { a: [], b: [] };
  const a = new Array(n);
  const b = new Array(n);
  for (let i = 0; i < n; i += 1) {
    a[i] = seriesA[i].value;
    b[i] = seriesB[i].value;
  }
  return { a, b };
}

function evaluateCapture(treasuryGrowth, qualitativeSignals, env, opts) {
  const cfg = loadConfig(env);
  const now = (opts && opts.now)
    ? (opts.now instanceof Date ? opts.now : new Date(opts.now))
    : new Date();
  const nowMs = now.getTime();

  const treasurySeries = buildTimeSeries(
    Array.isArray(treasuryGrowth) ? treasuryGrowth : [],
    cfg.lookbackDays,
    nowMs
  );

  const signalKeys = ["adopterCount", "adopterTrustScore", "specImplementationCount"];
  const builtSignals = {};
  for (const key of signalKeys) {
    const raw = qualitativeSignals && Array.isArray(qualitativeSignals[key])
      ? qualitativeSignals[key]
      : [];
    builtSignals[key] = buildTimeSeries(raw, cfg.lookbackDays, nowMs);
  }

  const correlations = {};
  const dataPoints = {};
  const insufficient = [];

  for (const key of signalKeys) {
    const aligned = alignSeries(treasurySeries, builtSignals[key]);
    dataPoints[key] = aligned.a.length;
    if (aligned.a.length < cfg.minDataPoints) {
      insufficient.push(key);
      correlations[key] = NaN;
      continue;
    }
    correlations[key] = rankCorrelation(aligned.a, aligned.b);
  }

  if (insufficient.length > 0) {
    return {
      ok: false,
      reason: "insufficient_data",
      captureRiskIndex: 0,
      warning: false,
      correlations,
      dataPoints,
      recommendation: "healthy",
      reasoning:
        "Not enough aligned samples to evaluate capture risk. " +
        `Need >= ${cfg.minDataPoints} per signal; short on: ${insufficient.join(", ")}.`
    };
  }

  // Capture risk: average over signals of max(0, -correlation), i.e. positive
  // correlations are healthy (treasury and quality move together) and
  // contribute 0; negative correlations are the danger and contribute
  // proportionally. Output is normalized to [0, 1] by definition because
  // rho is in [-1, 1] and we take only the negative half.
  //
  // The spec wording "(1 - correlation) / 2 across signals where correlation
  // < 0" matches this exactly: for rho in [-1, 0], (1 - rho) / 2 lies in
  // [0.5, 1.0], but the *contribution to the average risk* should be 0 when
  // rho >= 0, not 0.5. We interpret the spec as "only count signals with
  // rho < 0; for those, contribution is (1 - rho) / 2" — and average across
  // all signals (including the rho >= 0 ones, which contribute 0).
  let contribSum = 0;
  let worstKey = null;
  let worstCorrelation = Infinity;
  for (const key of signalKeys) {
    const rho = correlations[key];
    if (Number.isFinite(rho)) {
      if (rho < worstCorrelation) {
        worstCorrelation = rho;
        worstKey = key;
      }
      if (rho < 0) {
        contribSum += (1 - rho) / 2;
      }
    }
  }
  const captureRiskIndex = contribSum / signalKeys.length;

  let recommendation;
  if (captureRiskIndex < 0.3) recommendation = "healthy";
  else if (captureRiskIndex < 0.6) recommendation = "watch";
  else if (captureRiskIndex < 0.8) recommendation = "warning";
  else recommendation = "critical";

  const warning = captureRiskIndex >= cfg.warningThreshold;

  let reasoning;
  if (recommendation === "healthy") {
    reasoning =
      "Treasury growth aligns with qualitative health signals; no divergence detected.";
  } else if (recommendation === "watch") {
    reasoning =
      `Mild divergence — worst signal "${worstKey}" rho=${worstCorrelation.toFixed(3)}. ` +
      "Monitor; not yet a warning.";
  } else if (recommendation === "warning") {
    reasoning =
      `Treasury rising while "${worstKey}" trends opposite (rho=${worstCorrelation.toFixed(3)}). ` +
      "Possible Goodhart capture; review qualitative inputs before next spend-producing transition.";
  } else {
    reasoning =
      `Strong divergence: worst signal "${worstKey}" rho=${worstCorrelation.toFixed(3)}. ` +
      "Entity may be optimizing treasury at the expense of identity. Halt new experiments and surface to owner.";
  }

  return {
    ok: true,
    captureRiskIndex,
    warning,
    correlations,
    dataPoints,
    recommendation,
    reasoning
  };
}

function summarizeCapture(evaluation) {
  if (!evaluation || typeof evaluation !== "object") {
    return {
      riskIndex: 0,
      recommendation: "healthy",
      warning: false,
      topDivergence: null,
      dataConfidence: "low"
    };
  }
  const correlations = evaluation.correlations || {};
  const dataPoints = evaluation.dataPoints || {};

  let topSignal = null;
  let topRho = Infinity;
  for (const key of Object.keys(correlations)) {
    const rho = correlations[key];
    if (Number.isFinite(rho) && rho < topRho) {
      topRho = rho;
      topSignal = key;
    }
  }
  const topDivergence = topSignal === null
    ? null
    : { signal: topSignal, correlation: topRho };

  // confidence is driven by the *minimum* sample count across signals,
  // because the weakest signal bounds what we can claim.
  let minPoints = Infinity;
  for (const key of Object.keys(dataPoints)) {
    const n = dataPoints[key];
    if (Number.isFinite(n) && n < minPoints) minPoints = n;
  }
  let dataConfidence;
  if (!Number.isFinite(minPoints) || minPoints < 8) dataConfidence = "low";
  else if (minPoints < 20) dataConfidence = "medium";
  else dataConfidence = "high";

  return {
    riskIndex: typeof evaluation.captureRiskIndex === "number" ? evaluation.captureRiskIndex : 0,
    recommendation: evaluation.recommendation || "healthy",
    warning: evaluation.warning === true,
    topDivergence,
    dataConfidence
  };
}

module.exports = {
  DEFAULT_LOOKBACK_DAYS,
  DEFAULT_MIN_DATA_POINTS,
  DEFAULT_WARNING_THRESHOLD,
  buildTimeSeries,
  evaluateCapture,
  loadConfig,
  rankCorrelation,
  spearmanRank,
  summarizeCapture
};
