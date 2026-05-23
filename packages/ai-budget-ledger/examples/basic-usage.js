#!/usr/bin/env node
"use strict";

/**
 * Basic AI Budget Ledger example.
 *
 * Demonstrates:
 *   1. Creating a ledger with budget limits
 *   2. Recording AI API call entries
 *   3. Checking budget before a proposed call
 *   4. Getting a human-readable summary
 *
 * Run:  node packages/ai-budget-ledger/examples/basic-usage.js
 */

const {
  createLedger,
  record,
  totals,
  checkBudget,
  summarize,
} = require("../index");

// --- 1. Create a ledger with budget limits -------------------------------

const ledger = createLedger({
  dailyBudgetUsd: 5,
  monthlyBudgetUsd: 100,
  inputUsdPerMillion: 0.15,
  outputUsdPerMillion: 0.6,
});

console.log("=== AI Budget Ledger: Basic Usage ===\n");

// --- 2. Record some AI API calls -----------------------------------------

const entries = [
  { promptTokens: 4000, completionTokens: 500, note: "cycle 1 step 1", route: "private-route-1" },
  { promptTokens: 8000, completionTokens: 1200, note: "cycle 1 step 2", route: "private-route-1" },
  { promptTokens: 3500, completionTokens: 300, note: "cycle 2 step 1", route: "private-route-1" },
];

for (const usage of entries) {
  const entry = record(ledger, usage);
  console.log(`Recorded: ${entry.note} — $${entry.estimatedUsd.toFixed(6)}`);
}

// --- 3. Check totals -----------------------------------------------------

const t = totals(ledger);
console.log(`\nTotals after ${t.entryCount} entries:`);
console.log(`  Today:    $${t.today.toFixed(6)}`);
console.log(`  This month: $${t.month.toFixed(6)}`);
console.log(`  Lifetime: $${t.lifetime.toFixed(6)}`);

// --- 4. Budget check before next call ------------------------------------

const proposed = { promptTokens: 15000, completionTokens: 3000 };
const check = checkBudget(ledger, proposed);

console.log(`\nBudget check for proposed call (${proposed.promptTokens} in / ${proposed.completionTokens} out):`);
console.log(`  Allowed:  ${check.allowed}`);
console.log(`  Cost:     $${check.estimatedCost.toFixed(6)}`);
console.log(`  Daily remaining: $${check.dailyRemaining.toFixed(6)}`);
console.log(`  Monthly remaining: $${check.monthlyRemaining.toFixed(6)}`);
if (!check.allowed) {
  console.log(`  Reason:   ${check.reason}`);
}

// --- 5. Human-readable summary -------------------------------------------

console.log(`\n${summarize(ledger)}`);
