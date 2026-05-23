"use strict";

/**
 * AI Budget Ledger — public entry point.
 *
 * Re-exports the full library API from ledger.js and persist.js
 * so consumers can do:
 *
 *   const ledger = require("@orbit-house/ai-budget-ledger");
 *
 * Zero external dependencies.
 */

const {
  createLedger,
  record,
  totals,
  checkBudget,
  summarize,
  estimateCost,
  dayKey,
  monthKey,
} = require("./ledger");

const { save, load } = require("./persist");

module.exports = {
  // Core
  createLedger,
  record,
  totals,
  checkBudget,
  summarize,
  estimateCost,

  // Persistence
  save,
  load,

  // Helpers
  dayKey,
  monthKey,
};
