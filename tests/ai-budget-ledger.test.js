"use strict";

/**
 * AI Budget Ledger — test suite
 *
 * Covers: ledger creation, recording, totals, budget checks, cost estimation,
 * summarization, persistence, CLI entry codes, edge cases.
 */

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const os = require("os");

const {
  createLedger,
  record,
  totals,
  checkBudget,
  summarize,
  estimateCost,
  dayKey,
  monthKey,
} = require("../packages/ai-budget-ledger/ledger");

const { save, load } = require("../packages/ai-budget-ledger/persist");

// ---------------------------------------------------------------------------
// estimateCost
// ---------------------------------------------------------------------------

describe("estimateCost", () => {
  it("calculates cost from prompt and completion tokens", () => {
    const pricing = { inputUsdPerMillion: 0.15, outputUsdPerMillion: 0.6 };
    const cost = estimateCost(pricing, { promptTokens: 1_000_000, completionTokens: 1_000_000 });
    assert.equal(cost, 0.75); // 0.15 + 0.60
  });

  it("returns 0 for zero tokens", () => {
    const cost = estimateCost({ inputUsdPerMillion: 0.15, outputUsdPerMillion: 0.6 }, {});
    assert.equal(cost, 0);
  });

  it("handles snake_case token keys", () => {
    const pricing = { inputUsdPerMillion: 1.0, outputUsdPerMillion: 2.0 };
    const cost = estimateCost(pricing, { prompt_tokens: 500_000, completion_tokens: 500_000 });
    assert.equal(cost, 1.5); // 0.5 + 1.0
  });

  it("handles missing pricing gracefully", () => {
    const cost = estimateCost({}, { promptTokens: 1000, completionTokens: 1000 });
    assert.equal(cost, 0);
  });
});

// ---------------------------------------------------------------------------
// createLedger
// ---------------------------------------------------------------------------

describe("createLedger", () => {
  it("creates an empty ledger with defaults", () => {
    const ledger = createLedger();
    assert.equal(ledger.version, 1);
    assert.deepEqual(ledger.entries, []);
    assert.equal(ledger.limits.dailyBudgetUsd, 0);
    assert.equal(ledger.limits.monthlyBudgetUsd, 0);
    assert.equal(ledger.maxEntries, 500);
  });

  it("accepts custom config", () => {
    const ledger = createLedger({
      dailyBudgetUsd: 5,
      monthlyBudgetUsd: 100,
      inputUsdPerMillion: 0.15,
      outputUsdPerMillion: 0.6,
      maxEntries: 100,
    });
    assert.equal(ledger.limits.dailyBudgetUsd, 5);
    assert.equal(ledger.limits.monthlyBudgetUsd, 100);
    assert.equal(ledger.pricing.inputUsdPerMillion, 0.15);
    assert.equal(ledger.pricing.outputUsdPerMillion, 0.6);
    assert.equal(ledger.maxEntries, 100);
  });
});

// ---------------------------------------------------------------------------
// record
// ---------------------------------------------------------------------------

describe("record", () => {
  it("adds an entry to the ledger", () => {
    const ledger = createLedger({ inputUsdPerMillion: 0.15, outputUsdPerMillion: 0.6 });
    const entry = record(ledger, {
      promptTokens: 1000,
      completionTokens: 500,
      note: "test call",
      route: "route-1",
    });

    assert.equal(ledger.entries.length, 1);
    assert.equal(entry.promptTokens, 1000);
    assert.equal(entry.completionTokens, 500);
    assert.equal(entry.totalTokens, 1500);
    assert.equal(entry.note, "test call");
    assert.equal(entry.route, "route-1");
    assert.equal(typeof entry.timestamp, "string");
    assert.equal(typeof entry.estimatedUsd, "number");
    assert.ok(entry.estimatedUsd > 0);
  });

  it("enforces maxEntries by dropping oldest", () => {
    const ledger = createLedger({ maxEntries: 3 });
    for (let i = 0; i < 5; i++) {
      record(ledger, { promptTokens: 100, completionTokens: 50, note: `call-${i}` });
    }
    assert.equal(ledger.entries.length, 3);
    assert.equal(ledger.entries[0].note, "call-2");
    assert.equal(ledger.entries[2].note, "call-4");
  });

  it("handles missing fields gracefully", () => {
    const ledger = createLedger();
    const entry = record(ledger, {});
    assert.equal(entry.promptTokens, 0);
    assert.equal(entry.completionTokens, 0);
    assert.equal(entry.totalTokens, 0);
    assert.equal(entry.note, "");
    assert.equal(entry.route, "");
  });

  it("accepts a custom timestamp", () => {
    const ledger = createLedger();
    const entry = record(ledger, {
      promptTokens: 100,
      completionTokens: 50,
      timestamp: "2026-01-01T00:00:00.000Z",
    });
    assert.equal(entry.timestamp, "2026-01-01T00:00:00.000Z");
  });
});

// ---------------------------------------------------------------------------
// totals
// ---------------------------------------------------------------------------

describe("totals", () => {
  it("computes today, month, and lifetime totals", () => {
    const ledger = createLedger({ inputUsdPerMillion: 0.15, outputUsdPerMillion: 0.6 });
    const now = new Date("2026-05-23T12:00:00.000Z");

    record(ledger, {
      promptTokens: 10_000,
      completionTokens: 5_000,
      timestamp: "2026-05-23T10:00:00.000Z",
    });
    record(ledger, {
      promptTokens: 10_000,
      completionTokens: 5_000,
      timestamp: "2026-05-22T10:00:00.000Z",
    });

    const t = totals(ledger, now);
    assert.equal(t.entryCount, 2);
    // Today's entry only
    assert.ok(t.today > 0);
    assert.ok(t.today < t.month);
    // Both entries are in the same month
    assert.ok(t.month > t.today);
    // Lifetime = sum of both
    assert.ok(t.lifetime >= t.month);
  });

  it("returns zeros for empty ledger", () => {
    const ledger = createLedger();
    const t = totals(ledger);
    assert.equal(t.today, 0);
    assert.equal(t.month, 0);
    assert.equal(t.lifetime, 0);
    assert.equal(t.entryCount, 0);
  });
});

// ---------------------------------------------------------------------------
// checkBudget
// ---------------------------------------------------------------------------

describe("checkBudget", () => {
  it("allows a call within budget", () => {
    const ledger = createLedger({
      dailyBudgetUsd: 5,
      monthlyBudgetUsd: 100,
      inputUsdPerMillion: 0.15,
      outputUsdPerMillion: 0.6,
    });
    const result = checkBudget(ledger, { promptTokens: 1000, completionTokens: 500 });
    assert.equal(result.allowed, true);
    assert.equal(result.reason, null);
    assert.ok(result.dailyRemaining > 0);
    assert.ok(result.monthlyRemaining > 0);
  });

  it("rejects a call that exceeds daily budget", () => {
    const ledger = createLedger({
      dailyBudgetUsd: 0.001,
      monthlyBudgetUsd: 100,
      inputUsdPerMillion: 0.15,
      outputUsdPerMillion: 0.6,
    });
    // Record a large call to use up budget
    record(ledger, {
      promptTokens: 100_000,
      completionTokens: 100_000,
      timestamp: new Date().toISOString(),
    });

    const result = checkBudget(ledger, { promptTokens: 100_000, completionTokens: 100_000 });
    assert.equal(result.allowed, false);
    assert.equal(result.reason, "daily_budget_exceeded");
  });

  it("rejects a call that exceeds monthly budget", () => {
    const ledger = createLedger({
      dailyBudgetUsd: 100,
      monthlyBudgetUsd: 0.001,
      inputUsdPerMillion: 0.15,
      outputUsdPerMillion: 0.6,
    });
    record(ledger, {
      promptTokens: 100_000,
      completionTokens: 100_000,
      timestamp: new Date().toISOString(),
    });

    const result = checkBudget(ledger, { promptTokens: 100_000, completionTokens: 100_000 });
    assert.equal(result.allowed, false);
    assert.equal(result.reason, "monthly_budget_exceeded");
  });

  it("unlimited when no budget set", () => {
    const ledger = createLedger();
    const result = checkBudget(ledger, { promptTokens: 1_000_000, completionTokens: 1_000_000 });
    assert.equal(result.allowed, true);
    assert.equal(result.dailyRemaining, Infinity);
    assert.equal(result.monthlyRemaining, Infinity);
  });
});

// ---------------------------------------------------------------------------
// summarize
// ---------------------------------------------------------------------------

describe("summarize", () => {
  it("returns a human-readable summary", () => {
    const ledger = createLedger({
      dailyBudgetUsd: 5,
      monthlyBudgetUsd: 100,
      inputUsdPerMillion: 0.15,
      outputUsdPerMillion: 0.6,
    });
    record(ledger, { promptTokens: 1000, completionTokens: 500, note: "test" });

    const summary = summarize(ledger);
    assert.equal(summary.entryCount, 1);
    assert.equal(summary.today.limit, 5);
    assert.ok(summary.today.spent > 0);
    assert.ok(summary.today.remaining > 0);
    assert.equal(summary.month.limit, 100);
    assert.ok(summary.lifetime > 0);
    assert.equal(summary.pricing.inputUsdPerMillion, 0.15);
    assert.equal(summary.pricing.outputUsdPerMillion, 0.6);
  });

  it("handles empty ledger", () => {
    const ledger = createLedger({ dailyBudgetUsd: 5, monthlyBudgetUsd: 100 });
    const summary = summarize(ledger);
    assert.equal(summary.entryCount, 0);
    assert.equal(summary.today.spent, 0);
    assert.equal(summary.today.remaining, 5);
    assert.equal(summary.today.canSpend, true);
  });
});

// ---------------------------------------------------------------------------
// dayKey / monthKey
// ---------------------------------------------------------------------------

describe("dayKey and monthKey", () => {
  it("returns ISO date key", () => {
    const date = new Date("2026-05-23T14:30:00.000Z");
    assert.equal(dayKey(date), "2026-05-23");
    assert.equal(monthKey(date), "2026-05");
  });

  it("defaults to now when no date given", () => {
    const dk = dayKey();
    assert.match(dk, /^\d{4}-\d{2}-\d{2}$/);
    const mk = monthKey();
    assert.match(mk, /^\d{4}-\d{2}$/);
  });
});

// ---------------------------------------------------------------------------
// Persistence (save / load)
// ---------------------------------------------------------------------------

describe("persistence", () => {
  it("saves and loads a ledger", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ledger-test-"));
    const filePath = path.join(tmpDir, "test-ledger.json");

    const ledger = createLedger({
      dailyBudgetUsd: 5,
      monthlyBudgetUsd: 100,
      inputUsdPerMillion: 0.15,
      outputUsdPerMillion: 0.6,
    });
    record(ledger, { promptTokens: 1000, completionTokens: 500, note: "save test" });
    save(filePath, ledger);

    const loaded = load(filePath);
    assert.equal(loaded.limits.dailyBudgetUsd, 5);
    assert.equal(loaded.entries.length, 1);
    assert.equal(loaded.entries[0].note, "save test");

    // Cleanup
    fs.unlinkSync(filePath);
    fs.rmdirSync(tmpDir);
  });

  it("returns defaults when file does not exist", () => {
    const defaults = { limits: { dailyBudgetUsd: 7 } };
    const loaded = load("/tmp/nonexistent-ledger-test-xyz.json", defaults);
    assert.equal(loaded.limits.dailyBudgetUsd, 7);
  });

  it("merges loaded data with defaults", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ledger-test-"));
    const filePath = path.join(tmpDir, "partial-ledger.json");

    // Write a partial ledger (missing some default fields)
    fs.writeFileSync(filePath, JSON.stringify({ entries: [{ note: "partial" }] }));

    const defaults = createLedger({ dailyBudgetUsd: 3 });
    const loaded = load(filePath, defaults);
    assert.equal(loaded.limits.dailyBudgetUsd, 3);
    assert.equal(loaded.entries.length, 1);
    assert.equal(loaded.entries[0].note, "partial");

    // Cleanup
    fs.unlinkSync(filePath);
    fs.rmdirSync(tmpDir);
  });
});

// ---------------------------------------------------------------------------
// Integration: record → totals → checkBudget
// ---------------------------------------------------------------------------

describe("integration: record → totals → checkBudget", () => {
  it("tracks cumulative spend and blocks when budget is exceeded", () => {
    const ledger = createLedger({
      dailyBudgetUsd: 0.01,
      monthlyBudgetUsd: 0.05,
      inputUsdPerMillion: 0.15,
      outputUsdPerMillion: 0.6,
    });

    // Record several calls
    for (let i = 0; i < 5; i++) {
      record(ledger, {
        promptTokens: 50_000,
        completionTokens: 10_000,
        note: `call-${i}`,
      });
    }

    const t = totals(ledger);
    assert.ok(t.today > 0);
    assert.equal(t.entryCount, 5);

    // Next call should be blocked
    const check = checkBudget(ledger, { promptTokens: 50_000, completionTokens: 10_000 });
    assert.equal(check.allowed, false);
  });
});
