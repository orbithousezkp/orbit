"use strict";

// Revenue streams (plural). Backwards-compatible with the legacy
// `treasury.revenue` single-stream shape: on first read the legacy fields are
// promoted into `treasury.revenue.streams[0]` with id "clanker-trading-fees".
// The legacy fields are NEVER deleted — old code keeps reading them.

const STREAM_STATUSES = ["experimental", "active", "deprecated"];
const LEGACY_STREAM_ID = "clanker-trading-fees";

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toBigIntWei(amount) {
  if (typeof amount === "bigint") return amount;
  if (typeof amount === "number") {
    if (!Number.isFinite(amount)) throw new Error("amountWei must be finite");
    if (!Number.isInteger(amount)) throw new Error("amountWei must be an integer when number");
    return BigInt(amount);
  }
  if (typeof amount === "string") {
    const trimmed = amount.trim();
    if (!/^-?\d+$/.test(trimmed)) throw new Error("amountWei string must be a base-10 integer");
    return BigInt(trimmed);
  }
  throw new Error("amountWei must be a string, number, or bigint");
}

function defaultStream(overrides = {}) {
  const now = new Date().toISOString();
  const base = {
    id: null,
    type: null,
    status: STREAM_STATUSES[0],
    lifetimeRevenueWei: "0",
    lastClaim: null,
    unitEconomics: {},
    createdAt: now,
    sunsetCriteria: null
  };
  const merged = { ...base, ...(overrides || {}) };
  if (!STREAM_STATUSES.includes(merged.status)) {
    throw new Error(`stream.status must be one of ${STREAM_STATUSES.join(", ")}`);
  }
  return merged;
}

function buildLegacyStream(revenue) {
  if (!isPlainObject(revenue)) return null;
  if (!revenue.payoutAsset) return null;

  const unitEconomics = {
    operatorShareBps: revenue.operatorShareBps !== undefined ? revenue.operatorShareBps : null,
    treasuryShareBps: revenue.treasuryShareBps !== undefined ? revenue.treasuryShareBps : null,
    payoutAsset: revenue.payoutAsset || null,
    cadence: revenue.cadence || null,
    claimIntervalDays: revenue.claimIntervalDays !== undefined ? revenue.claimIntervalDays : null
  };
  let lastClaim = null;
  if (revenue.lastClaimResult || revenue.lastClaimSentAt) {
    lastClaim = {
      ts: revenue.lastClaimSentAt || revenue.lastClaimAttemptAt || null,
      amountWei: "0",
      source: "legacy_clanker_trading_fees",
      txHash: revenue.lastClaimResult && revenue.lastClaimResult.txHash ? revenue.lastClaimResult.txHash : null
    };
  }
  return defaultStream({
    id: LEGACY_STREAM_ID,
    type: "trading_fees",
    status: "active",
    lifetimeRevenueWei: "0",
    lastClaim,
    unitEconomics,
    sunsetCriteria: null
  });
}

function ensureStreamsArray(treasury) {
  if (!isPlainObject(treasury)) {
    throw new Error("treasury must be an object");
  }
  const revenue = isPlainObject(treasury.revenue) ? treasury.revenue : {};
  const streams = Array.isArray(revenue.streams) ? revenue.streams.slice() : [];

  if (streams.length === 0) {
    const legacy = buildLegacyStream(revenue);
    if (legacy) streams.push(legacy);
  }

  treasury.revenue = { ...revenue, streams };
  return treasury;
}

function findStreamIndex(treasury, streamId) {
  if (!isPlainObject(treasury) || !isPlainObject(treasury.revenue)) return -1;
  const streams = treasury.revenue.streams;
  if (!Array.isArray(streams)) return -1;
  return streams.findIndex((stream) => stream && stream.id === streamId);
}

function registerStream(treasury, stream) {
  if (!isPlainObject(stream)) throw new Error("stream must be an object");
  if (!stream.id || typeof stream.id !== "string") throw new Error("stream.id is required (string)");
  if (!stream.type || typeof stream.type !== "string") throw new Error("stream.type is required (string)");

  ensureStreamsArray(treasury);
  if (findStreamIndex(treasury, stream.id) !== -1) {
    throw new Error(`stream id already registered: ${stream.id}`);
  }
  const populated = defaultStream({ ...stream });
  treasury.revenue.streams.push(populated);
  return treasury;
}

function getStream(treasury, streamId) {
  const index = findStreamIndex(treasury, streamId);
  if (index === -1) return null;
  return treasury.revenue.streams[index];
}

function listActiveStreams(treasury) {
  if (!isPlainObject(treasury) || !isPlainObject(treasury.revenue)) return [];
  const streams = treasury.revenue.streams;
  if (!Array.isArray(streams)) return [];
  return streams.filter((stream) => stream && stream.status === "active");
}

function recordRevenue(treasury, streamId, amountWei, metadata) {
  const index = findStreamIndex(treasury, streamId);
  if (index === -1) throw new Error(`unknown stream: ${streamId}`);
  const amount = toBigIntWei(amountWei);
  if (amount <= 0n) throw new Error("amountWei must be > 0");

  const stream = treasury.revenue.streams[index];
  const current = toBigIntWei(stream.lifetimeRevenueWei || "0");
  const next = current + amount;
  const meta = isPlainObject(metadata) ? metadata : {};
  const lastClaim = {
    ts: meta.ts || new Date().toISOString(),
    amountWei: amount.toString(),
    source: meta.source || null,
    txHash: meta.txHash || null
  };

  const updated = {
    ...stream,
    lifetimeRevenueWei: next.toString(),
    lastClaim
  };
  treasury.revenue.streams[index] = updated;
  return updated;
}

function deprecateStream(treasury, streamId, reason) {
  const index = findStreamIndex(treasury, streamId);
  if (index === -1) throw new Error(`unknown stream: ${streamId}`);
  const stream = treasury.revenue.streams[index];
  const history = Array.isArray(stream.deprecationHistory) ? stream.deprecationHistory.slice() : [];
  history.push({
    ts: new Date().toISOString(),
    reason: typeof reason === "string" ? reason : null
  });
  const updated = {
    ...stream,
    status: "deprecated",
    deprecationHistory: history
  };
  treasury.revenue.streams[index] = updated;
  return updated;
}

module.exports = {
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
};
