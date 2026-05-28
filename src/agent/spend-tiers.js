"use strict";

// F-2.2 (PLAN/ROADMAP_EXPANSION.md): tiered spend levels.
//
// Classify a spend amount (in wei) into small / medium / large / critical
// tier with an attached quorum threshold. Finer grain than the existing
// governance.js ACTION_TIER_MAP, which is keyed by action TYPE (buyback,
// merkleAnchor, etc.) — this is keyed by AMOUNT.
//
// Caller flow (separate sprint wires it into governance.requiresQuorum):
//   const tier = classifySpendTier(amountWei);
//   if (tier.ok) {
//     const threshold = tier.quorumThreshold;
//     // require `threshold` maintainer approvals before executing
//   }
//
// Pure: no fs, no governance state read. Configurable via options.tiers.

const DEFAULT_SPEND_TIERS = Object.freeze([
  { name: "small", maxWei: "10000000000000000", quorumThreshold: 1 }, // ≤ 0.01 ETH
  { name: "medium", maxWei: "100000000000000000", quorumThreshold: 1 }, // ≤ 0.1 ETH
  { name: "large", maxWei: "1000000000000000000", quorumThreshold: 2 }, // ≤ 1 ETH
  { name: "critical", maxWei: null, quorumThreshold: 3 } // > 1 ETH (no cap)
]);

function toBigIntSafe(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "bigint") return value;
  try {
    if (typeof value === "number") {
      if (!Number.isFinite(value)) return null;
      // Coerce to integer (wei must be whole)
      return BigInt(Math.trunc(value));
    }
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed === "" || !/^-?\d+$/.test(trimmed)) return null;
      return BigInt(trimmed);
    }
    return null;
  } catch {
    return null;
  }
}

function classifySpendTier(amount, options = {}) {
  const tiers = Array.isArray(options.tiers) ? options.tiers : DEFAULT_SPEND_TIERS;
  const amountWei = toBigIntSafe(amount);
  if (amountWei === null || amountWei < 0n) {
    return { ok: false, kind: "invalid_amount", input: String(amount) };
  }
  for (const tier of tiers) {
    if (tier.maxWei === null || tier.maxWei === undefined) {
      // Open-ended top tier: everything not yet matched lands here.
      return {
        ok: true,
        tier: tier.name,
        quorumThreshold: tier.quorumThreshold,
        amountWei: amountWei.toString(),
        maxWei: null
      };
    }
    const cap = toBigIntSafe(tier.maxWei);
    if (cap === null) continue;
    if (amountWei <= cap) {
      return {
        ok: true,
        tier: tier.name,
        quorumThreshold: tier.quorumThreshold,
        amountWei: amountWei.toString(),
        maxWei: tier.maxWei
      };
    }
  }
  // Should not reach here if a tier with maxWei: null exists.
  return { ok: false, kind: "no_tier_matched", amountWei: amountWei.toString() };
}

function quorumThresholdForTier(tierName, options = {}) {
  const tiers = Array.isArray(options.tiers) ? options.tiers : DEFAULT_SPEND_TIERS;
  const tier = tiers.find((t) => t.name === tierName);
  return tier ? tier.quorumThreshold : null;
}

function tierSnapshot(options = {}) {
  const tiers = Array.isArray(options.tiers) ? options.tiers : DEFAULT_SPEND_TIERS;
  return tiers.map((t) => ({
    name: t.name,
    maxWei: t.maxWei,
    quorumThreshold: t.quorumThreshold
  }));
}

function describeSpendTier(classification) {
  if (!classification || !classification.ok) {
    return `spend tier: invalid or unknown (${(classification && classification.kind) || "no_classification"})`;
  }
  const cap = classification.maxWei === null ? "unbounded" : `≤ ${classification.maxWei} wei`;
  return `spend tier: ${classification.tier} (${cap}) — quorum threshold ${classification.quorumThreshold}`;
}

module.exports = {
  DEFAULT_SPEND_TIERS,
  classifySpendTier,
  describeSpendTier,
  quorumThresholdForTier,
  tierSnapshot
};
