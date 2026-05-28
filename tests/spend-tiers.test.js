"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  DEFAULT_SPEND_TIERS,
  classifySpendTier,
  quorumThresholdForTier,
  tierSnapshot,
  describeSpendTier
} = require("../src/agent/spend-tiers");

// F-2.2 (PLAN/ROADMAP_EXPANSION.md): tiered spend levels.
// Classify a spend amount (wei) into small / medium / large / critical
// tier and surface the matching quorum threshold. Finer grain than
// governance.js ACTION_TIER_MAP (which is keyed by action type, not
// amount).

test("DEFAULT_SPEND_TIERS lists 4 tiers in ascending order", () => {
  assert.equal(DEFAULT_SPEND_TIERS.length, 4);
  for (let i = 1; i < DEFAULT_SPEND_TIERS.length; i++) {
    assert.ok(
      BigInt(DEFAULT_SPEND_TIERS[i].maxWei || "999999999999999999999999")
      >= BigInt(DEFAULT_SPEND_TIERS[i - 1].maxWei || "0"),
      "tier maxWei must be ascending"
    );
  }
});

test("DEFAULT_SPEND_TIERS includes small/medium/large/critical", () => {
  const names = DEFAULT_SPEND_TIERS.map((t) => t.name);
  assert.deepEqual(names, ["small", "medium", "large", "critical"]);
});

test("classifySpendTier: tiny amount → small", () => {
  const result = classifySpendTier("100000000000000"); // 0.0001 ETH
  assert.equal(result.tier, "small");
  assert.ok(result.quorumThreshold >= 1);
});

test("classifySpendTier: medium-range amount → medium", () => {
  const result = classifySpendTier("50000000000000000"); // 0.05 ETH
  assert.equal(result.tier, "medium");
});

test("classifySpendTier: large amount → large", () => {
  const result = classifySpendTier("500000000000000000"); // 0.5 ETH
  assert.equal(result.tier, "large");
});

test("classifySpendTier: huge amount → critical", () => {
  const result = classifySpendTier("5000000000000000000"); // 5 ETH
  assert.equal(result.tier, "critical");
});

test("classifySpendTier: zero amount → small", () => {
  const result = classifySpendTier("0");
  assert.equal(result.tier, "small");
});

test("classifySpendTier: malformed amount → kind=invalid_amount", () => {
  const result = classifySpendTier("not-a-number");
  assert.equal(result.ok, false);
  assert.equal(result.kind, "invalid_amount");
});

test("classifySpendTier: negative amount → kind=invalid_amount", () => {
  const result = classifySpendTier("-100");
  assert.equal(result.ok, false);
  assert.equal(result.kind, "invalid_amount");
});

test("classifySpendTier: numeric string accepted (BigInt parseable)", () => {
  const result = classifySpendTier("123456789012345678");
  assert.equal(result.ok, true);
});

test("classifySpendTier: number type accepted (converted to string)", () => {
  const result = classifySpendTier(0.0001 * 1e18); // 0.0001 ETH as number
  assert.equal(result.ok, true);
  assert.equal(result.tier, "small");
});

test("classifySpendTier: bigint type accepted", () => {
  const result = classifySpendTier(BigInt("500000000000000000"));
  assert.equal(result.tier, "large");
});

test("classifySpendTier: custom tiers via options.tiers", () => {
  const customTiers = [
    { name: "tiny", maxWei: "1000", quorumThreshold: 1 },
    { name: "big", maxWei: null, quorumThreshold: 5 }
  ];
  const small = classifySpendTier("500", { tiers: customTiers });
  assert.equal(small.tier, "tiny");
  const big = classifySpendTier("100000", { tiers: customTiers });
  assert.equal(big.tier, "big");
});

test("quorumThresholdForTier: small=1, medium=1, large=2, critical=3 (defaults)", () => {
  assert.equal(quorumThresholdForTier("small"), 1);
  assert.equal(quorumThresholdForTier("medium"), 1);
  assert.equal(quorumThresholdForTier("large"), 2);
  assert.equal(quorumThresholdForTier("critical"), 3);
});

test("quorumThresholdForTier: unknown tier → null", () => {
  assert.equal(quorumThresholdForTier("not-a-tier"), null);
  assert.equal(quorumThresholdForTier(null), null);
});

test("tierSnapshot: returns the configured tier table", () => {
  const snap = tierSnapshot();
  assert.equal(snap.length, 4);
  for (const t of snap) {
    assert.equal(typeof t.name, "string");
    assert.equal(typeof t.quorumThreshold, "number");
  }
});

test("describeSpendTier: produces a human-readable line for a classification", () => {
  const result = classifySpendTier("500000000000000000"); // 0.5 ETH → large
  const description = describeSpendTier(result);
  assert.match(description, /large/);
  assert.match(description, /quorum/i);
});

test("describeSpendTier: invalid classification → still describes", () => {
  const result = classifySpendTier("not-a-number");
  const description = describeSpendTier(result);
  assert.match(description, /invalid|unknown/i);
});
