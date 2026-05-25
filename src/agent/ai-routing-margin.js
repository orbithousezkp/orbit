"use strict";

// AI routing margin stream.
//
// First consumer of the revenue-streams framework. When Orbit (or an adopter
// routing through Orbit) makes an AI call, Orbit takes a configurable markup
// (default 5%, env ORBIT_AI_ROUTING_MARGIN_BPS, range 0-2000 bps) over the
// wholesale provider cost. The markup accrues to a stream tracked in
// treasury.revenue.streams[].
//
// DRY-RUN REVENUE ACCOUNTING. There is no real money flowing yet:
//   1. S-GATE-1 is still open; no token launch, no adopters live.
//   2. The framework needs a real consumer to validate the abstraction.
// The stream accumulates ledger entries; treasury.json shows the projected
// revenue. A future spec defines the settlement layer (USDC/x402 or invoice
// to a Safe) once adopters are routing through Orbit.
//
// UNIT-OF-ACCOUNT: this module records margins in "wei" (BigInt). Inference
// callers convert wholesale USD into a wei-denominated amount using a
// 1 USD = 10^18 unit convention (USD scaled by 1e18). That keeps BigInt math
// precise without depending on a live price oracle, and matches the wei
// vocabulary the rest of the treasury uses. Settlement will reinterpret these
// units once a real payout asset is chosen.

const revenueStreams = require("./revenue-streams");

const MARGIN_BPS_DEFAULT = 500; // 5%
const MARGIN_BPS_MAX = 2000; // 20% hard cap
const STREAM_ID = "ai-routing-margin";
const STREAM_TYPE = "ai_routing_margin";
const PER_CALL_SAMPLES_CAP = 100;
const RECENT_SAMPLES_RETURN = 10;

function loadMarginConfig(env) {
  const source = env && typeof env === "object" ? env : {};
  const raw = source.ORBIT_AI_ROUTING_MARGIN_BPS;
  let marginBps = MARGIN_BPS_DEFAULT;
  if (raw !== undefined && raw !== null && String(raw).trim() !== "") {
    const parsed = Number.parseInt(String(raw).trim(), 10);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > MARGIN_BPS_MAX) {
      throw new Error(
        `ORBIT_AI_ROUTING_MARGIN_BPS must be an integer in [0, ${MARGIN_BPS_MAX}]; received ${raw}`
      );
    }
    marginBps = parsed;
  }
  return { marginBps, enabled: marginBps > 0 };
}

function toBigIntWei(amount) {
  if (typeof amount === "bigint") return amount;
  if (typeof amount === "number") {
    if (!Number.isFinite(amount) || !Number.isInteger(amount)) {
      throw new Error("wholesaleCostWei must be a finite integer when number");
    }
    return BigInt(amount);
  }
  if (typeof amount === "string") {
    const trimmed = amount.trim();
    if (!/^-?\d+$/.test(trimmed)) {
      throw new Error("wholesaleCostWei string must be a base-10 integer");
    }
    return BigInt(trimmed);
  }
  throw new Error("wholesaleCostWei must be a string, number, or bigint");
}

function assertMarginBps(marginBps) {
  if (!Number.isInteger(marginBps) || marginBps < 0 || marginBps > MARGIN_BPS_MAX) {
    throw new Error(`marginBps must be an integer in [0, ${MARGIN_BPS_MAX}]`);
  }
}

function calculateMargin(wholesaleCostWei, marginBps) {
  assertMarginBps(marginBps);
  const wholesale = toBigIntWei(wholesaleCostWei);
  if (wholesale < 0n) throw new Error("wholesaleCostWei must be >= 0");
  return (wholesale * BigInt(marginBps)) / 10000n;
}

function calculateBilled(wholesaleCostWei, marginBps) {
  const wholesale = toBigIntWei(wholesaleCostWei);
  const margin = calculateMargin(wholesale, marginBps);
  return wholesale + margin;
}

function ensureAiRoutingMarginStream(treasury, env) {
  revenueStreams.ensureStreamsArray(treasury);
  const { marginBps } = loadMarginConfig(env);
  const existing = revenueStreams.getStream(treasury, STREAM_ID);
  if (existing) {
    existing.unitEconomics = existing.unitEconomics && typeof existing.unitEconomics === "object"
      ? existing.unitEconomics
      : {};
    existing.unitEconomics.marginBps = marginBps;
    if (!Array.isArray(existing.unitEconomics.perCallSamples)) {
      existing.unitEconomics.perCallSamples = [];
    }
    if (!Number.isInteger(existing.unitEconomics.totalCallsBilled)) {
      existing.unitEconomics.totalCallsBilled = 0;
    }
    return existing;
  }
  revenueStreams.registerStream(treasury, {
    id: STREAM_ID,
    type: STREAM_TYPE,
    status: "experimental",
    unitEconomics: {
      marginBps,
      perCallSamples: [],
      totalCallsBilled: 0
    }
  });
  return revenueStreams.getStream(treasury, STREAM_ID);
}

function sanitizeCallInfo(callInfo) {
  const info = callInfo && typeof callInfo === "object" ? callInfo : {};
  return {
    provider: typeof info.provider === "string" ? info.provider : null,
    model: typeof info.model === "string" ? info.model : null,
    promptTokens: Number.isFinite(Number(info.promptTokens)) ? Number(info.promptTokens) : 0,
    completionTokens: Number.isFinite(Number(info.completionTokens)) ? Number(info.completionTokens) : 0,
    cycle: Number.isFinite(Number(info.cycle)) ? Number(info.cycle) : null,
    adopterId: typeof info.adopterId === "string" && info.adopterId ? info.adopterId : null
  };
}

function recordAiCall(treasury, env, callInfo) {
  const stream = ensureAiRoutingMarginStream(treasury, env);
  const { marginBps } = loadMarginConfig(env);
  const wholesale = toBigIntWei((callInfo && callInfo.wholesaleCostWei) || 0n);
  const marginWei = calculateMargin(wholesale, marginBps);
  const billedWei = wholesale + marginWei;
  const sanitized = sanitizeCallInfo(callInfo);
  const ts = new Date().toISOString();

  let updatedStream = stream;
  if (marginWei > 0n) {
    updatedStream = revenueStreams.recordRevenue(treasury, STREAM_ID, marginWei, {
      source: "ai_call",
      cycle: sanitized.cycle,
      ts
    });
  }

  // recordRevenue replaced the stream object — re-fetch the live reference so
  // we mutate the array entry (not a stale shallow copy).
  const liveStream = revenueStreams.getStream(treasury, STREAM_ID) || updatedStream;
  liveStream.unitEconomics = liveStream.unitEconomics && typeof liveStream.unitEconomics === "object"
    ? liveStream.unitEconomics
    : {};
  if (!Array.isArray(liveStream.unitEconomics.perCallSamples)) {
    liveStream.unitEconomics.perCallSamples = [];
  }
  if (!Number.isInteger(liveStream.unitEconomics.totalCallsBilled)) {
    liveStream.unitEconomics.totalCallsBilled = 0;
  }
  liveStream.unitEconomics.marginBps = marginBps;
  liveStream.unitEconomics.totalCallsBilled += 1;
  liveStream.unitEconomics.perCallSamples.push({
    ts,
    provider: sanitized.provider,
    model: sanitized.model,
    promptTokens: sanitized.promptTokens,
    completionTokens: sanitized.completionTokens,
    wholesaleCostWei: wholesale.toString(),
    marginWei: marginWei.toString(),
    billedWei: billedWei.toString(),
    marginBps,
    cycle: sanitized.cycle,
    adopterId: sanitized.adopterId
  });
  if (liveStream.unitEconomics.perCallSamples.length > PER_CALL_SAMPLES_CAP) {
    liveStream.unitEconomics.perCallSamples = liveStream.unitEconomics.perCallSamples.slice(
      -PER_CALL_SAMPLES_CAP
    );
  }

  return { marginWei, billedWei, stream: liveStream };
}

function summarizeRevenue(treasury) {
  const stream = revenueStreams.getStream(treasury, STREAM_ID);
  if (!stream) {
    return {
      streamId: STREAM_ID,
      lifetimeRevenueWei: "0",
      totalCallsBilled: 0,
      avgMarginPerCallWei: "0",
      recentSamples: []
    };
  }
  const unitEconomics = stream.unitEconomics && typeof stream.unitEconomics === "object"
    ? stream.unitEconomics
    : {};
  const totalCallsBilled = Number.isInteger(unitEconomics.totalCallsBilled)
    ? unitEconomics.totalCallsBilled
    : 0;
  const lifetimeWei = (() => {
    try {
      return toBigIntWei(stream.lifetimeRevenueWei || "0");
    } catch {
      return 0n;
    }
  })();
  const avgWei = totalCallsBilled > 0 ? lifetimeWei / BigInt(totalCallsBilled) : 0n;
  const samples = Array.isArray(unitEconomics.perCallSamples)
    ? unitEconomics.perCallSamples.slice(-RECENT_SAMPLES_RETURN)
    : [];
  return {
    streamId: STREAM_ID,
    lifetimeRevenueWei: lifetimeWei.toString(),
    totalCallsBilled,
    avgMarginPerCallWei: avgWei.toString(),
    recentSamples: samples
  };
}

module.exports = {
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
};
