"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  truncateAddress,
  relativeTime,
  nextCycleEstimate,
  formatAiUsage,
  formatReceiptBlock,
  formatRefusalRow,
  buildVerifyCommand,
  isBuildStale
} = require("../src/dashboard-format.js");

test("truncateAddress shortens 0x-prefixed addresses", () => {
  assert.equal(
    truncateAddress("0x19E7E376E7C213B7E7e7e46cc70A5dD086DAff2A"),
    "0x19E7...ff2A"
  );
  assert.equal(truncateAddress(""), "");
  assert.equal(truncateAddress("not-an-address"), "not-an-address");
  assert.equal(truncateAddress(null), "");
});

test("relativeTime renders past/future intervals", () => {
  const now = Date.parse("2026-05-24T01:00:00.000Z");
  assert.equal(relativeTime("2026-05-24T00:48:00.000Z", now), "12 min ago");
  assert.equal(relativeTime("2026-05-24T00:00:00.000Z", now), "1h ago");
  assert.equal(relativeTime("2026-05-24T01:00:30.000Z", now), "in 30s");
  assert.equal(relativeTime(null), "unknown");
  assert.equal(relativeTime("garbage"), "unknown");
});

test("nextCycleEstimate predicts next cycle from lastActive", () => {
  const now = Date.parse("2026-05-24T01:00:00.000Z");
  assert.equal(
    nextCycleEstimate("2026-05-24T00:48:00.000Z", 30, now),
    "~18 min"
  );
  assert.equal(nextCycleEstimate("2026-05-24T00:00:00.000Z", 30, now), "due now");
  assert.equal(nextCycleEstimate(null), "unknown");
});

test("formatAiUsage returns tokens and cost when present", () => {
  assert.equal(formatAiUsage({ aiTokens: 13400, aiCostUsd: 0.042 }), "13,400 tokens / $0.042");
  assert.equal(formatAiUsage({ aiTokens: 1000 }), "1,000 tokens");
  assert.equal(formatAiUsage({}), "0");
  assert.equal(formatAiUsage(null), "0");
});

test("formatReceiptBlock matches BRAND.md plain-text shape", () => {
  const block = formatReceiptBlock({
    cycle: 142,
    trigger: { type: "schedule" },
    startedAt: "2026-05-24T00:00:00Z",
    finishedAt: "2026-05-24T00:00:14Z",
    totalSteps: 6,
    filesChangedCount: 3,
    signed: true,
    signer: "0xABC0000000000000000000000000000000000DEF",
    payloadHash: "0xdead",
    path: "runtime/proofs/2026-05-24/01.json"
  });
  assert.ok(block.startsWith("ORBIT CYCLE #142"));
  assert.ok(block.includes("Trigger:    schedule"));
  assert.ok(block.includes("Started:    2026-05-24T00:00:00Z"));
  assert.ok(block.includes("Steps:      6"));
  assert.ok(block.includes("Signed by:  0xABC0000000000000000000000000000000000DEF"));
  assert.ok(block.includes("Verify:     npx @orbit-house/verifier runtime/proofs/2026-05-24/01.json"));
});

test("formatReceiptBlock marks unsigned receipts", () => {
  const block = formatReceiptBlock({ cycle: 27, totalSteps: 1, signed: false });
  assert.ok(block.includes("Signed by:  unsigned"));
});

test("buildVerifyCommand emits a copy-pasteable command", () => {
  assert.equal(
    buildVerifyCommand({ path: "runtime/proofs/2026-05-24/01.json" }),
    "npx @orbit-house/verifier runtime/proofs/2026-05-24/01.json"
  );
  assert.equal(buildVerifyCommand(null), "npx @orbit-house/verifier <receipt-url>");
});

test("isBuildStale flags old generation timestamps", () => {
  const now = Date.parse("2026-05-24T05:00:00.000Z");
  assert.equal(isBuildStale("2026-05-24T02:00:00.000Z", 2, now), true);
  assert.equal(isBuildStale("2026-05-24T04:30:00.000Z", 2, now), false);
  assert.equal(isBuildStale(null, 2, now), false);
});

test("formatRefusalRow renders display fields for a typical refusal", () => {
  const now = Date.parse("2026-05-24T01:00:00.000Z");
  const row = formatRefusalRow({
    cycle: 27,
    at: "2026-05-24T00:48:00.000Z",
    category: "scam",
    oneLineSummary: "issue body matched scam scoring threshold",
    severity: "high"
  }, now);
  assert.equal(row.cycle, "#27");
  assert.equal(row.category, "scam");
  assert.equal(row.categoryLabel, "scam");
  assert.equal(row.severity, "high");
  assert.equal(row.when, "12 min ago");
  assert.equal(row.summary, "issue body matched scam scoring threshold");
});

test("formatRefusalRow falls back gracefully on bad input", () => {
  const empty = formatRefusalRow(null);
  assert.equal(empty.cycle, "?");
  assert.equal(empty.category, "unknown");
  assert.equal(empty.severity, "medium");
  assert.equal(empty.when, "unknown");
  assert.equal(empty.summary, "");

  const partial = formatRefusalRow({ cycle: 0, category: "weird-thing", severity: "extreme" });
  assert.equal(partial.cycle, "#?");
  assert.equal(partial.category, "unknown");
  assert.equal(partial.severity, "medium");
});

test("formatRefusalRow maps approval-missing category to human label", () => {
  const row = formatRefusalRow({
    cycle: 5,
    at: "2026-05-24T00:00:00.000Z",
    category: "approval-missing",
    oneLineSummary: "external spend without approval issue",
    severity: "critical"
  }, Date.parse("2026-05-24T01:00:00.000Z"));
  assert.equal(row.category, "approval-missing");
  assert.equal(row.categoryLabel, "approval missing");
  assert.equal(row.severity, "critical");
});

test("formatRefusalRow clamps summary at 120 chars", () => {
  const long = "a".repeat(300);
  const row = formatRefusalRow({ cycle: 1, oneLineSummary: long, category: "policy", severity: "medium" });
  assert.equal(row.summary.length, 120);
});
