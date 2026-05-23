"use strict";

/**
 * AI Budget Ledger — core ledger module.
 *
 * Records AI API call usage, estimates cost per call, and maintains
 * daily/monthly/lifetime totals. Designed to be provider-agnostic:
 * supply your own pricing config or use built-in defaults.
 *
 * Zero external dependencies.
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function dayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function monthKey(date = new Date()) {
  return date.toISOString().slice(0, 7);
}

/**
 * Estimate the USD cost of a single API call.
 *
 * @param {object} pricing - { inputUsdPerMillion, outputUsdPerMillion }
 * @param {object} usage   - { promptTokens, completionTokens } or { prompt_tokens, completion_tokens }
 * @returns {number} estimated USD cost
 */
function estimateCost(pricing, usage = {}) {
  const inputTokens = Number(usage.promptTokens || usage.prompt_tokens || 0);
  const outputTokens = Number(usage.completionTokens || usage.completion_tokens || 0);
  const inputUsd = (inputTokens / 1_000_000) * (pricing.inputUsdPerMillion || 0);
  const outputUsd = (outputTokens / 1_000_000) * (pricing.outputUsdPerMillion || 0);
  return Number((inputUsd + outputUsd).toFixed(8));
}

// ---------------------------------------------------------------------------
// Ledger
// ---------------------------------------------------------------------------

/**
 * Create a new empty ledger.
 *
 * @param {object} opts
 * @param {number} opts.dailyBudgetUsd     - Maximum daily spend (0 = unlimited)
 * @param {number} opts.monthlyBudgetUsd   - Maximum monthly spend (0 = unlimited)
 * @param {number} opts.inputUsdPerMillion - Cost per million input tokens
 * @param {number} opts.outputUsdPerMillion - Cost per million output tokens
 * @param {number} opts.maxEntries         - Maximum ledger entries to retain (default 500)
 * @returns {object} ledger state
 */
function createLedger(opts = {}) {
  return {
    version: 1,
    pricing: {
      inputUsdPerMillion: Number(opts.inputUsdPerMillion || 0),
      outputUsdPerMillion: Number(opts.outputUsdPerMillion || 0),
    },
    limits: {
      dailyBudgetUsd: Number(opts.dailyBudgetUsd || 0),
      monthlyBudgetUsd: Number(opts.monthlyBudgetUsd || 0),
    },
    maxEntries: Number(opts.maxEntries || 500),
    entries: [],
  };
}

/**
 * Record a usage entry in the ledger.
 *
 * @param {object} ledger  - Ledger state (mutated)
 * @param {object} usage   - { promptTokens, completionTokens, note?, route?, timestamp? }
 * @returns {object} the recorded entry
 */
function record(ledger, usage = {}) {
  const pricing = ledger.pricing || { inputUsdPerMillion: 0, outputUsdPerMillion: 0 };
  const promptTokens = Number(usage.promptTokens || usage.prompt_tokens || 0);
  const completionTokens = Number(usage.completionTokens || usage.completion_tokens || 0);
  const totalTokens = promptTokens + completionTokens;
  const estimatedUsd = estimateCost(pricing, usage);
  const timestamp = usage.timestamp || new Date().toISOString();

  const entry = {
    timestamp,
    note: String(usage.note || ""),
    route: String(usage.route || ""),
    promptTokens,
    completionTokens,
    totalTokens,
    estimatedUsd,
  };

  if (!Array.isArray(ledger.entries)) {
    ledger.entries = [];
  }

  ledger.entries.push(entry);

  // Enforce max entries by dropping oldest
  while (ledger.entries.length > ledger.maxEntries) {
    ledger.entries.shift();
  }

  return entry;
}

// ---------------------------------------------------------------------------
// Totals
// ---------------------------------------------------------------------------

/**
 * Compute spend totals across time periods.
 *
 * @param {object} ledger - Ledger state
 * @param {Date}   [now]  - Current time (defaults to now)
 * @returns {{ today: number, month: number, lifetime: number, entryCount: number }}
 */
function totals(ledger, now = new Date()) {
  const currentDay = dayKey(now);
  const currentMonth = monthKey(now);
  const entries = Array.isArray(ledger.entries) ? ledger.entries : [];

  return entries.reduce(
    (acc, entry) => {
      const amount = Number(entry.estimatedUsd || 0);
      if (String(entry.timestamp || "").startsWith(currentDay)) acc.today += amount;
      if (String(entry.timestamp || "").startsWith(currentMonth)) acc.month += amount;
      acc.lifetime += amount;
      return acc;
    },
    { today: 0, month: 0, lifetime: 0, entryCount: entries.length }
  );
}

/**
 * Check whether a proposed usage would exceed daily or monthly budget.
 *
 * @param {object} ledger       - Ledger state
 * @param {object} usage        - Proposed usage { promptTokens, completionTokens }
 * @param {Date}   [now]
 * @returns {{ allowed: boolean, reason: string|null, dailyRemaining: number, monthlyRemaining: number, estimatedCost: number }}
 */
function checkBudget(ledger, usage = {}, now = new Date()) {
  const estimatedCost = estimateCost(ledger.pricing || {}, usage);
  const currentTotals = totals(ledger, now);
  const dailyLimit = ledger.limits && ledger.limits.dailyBudgetUsd ? ledger.limits.dailyBudgetUsd : 0;
  const monthlyLimit = ledger.limits && ledger.limits.monthlyBudgetUsd ? ledger.limits.monthlyBudgetUsd : 0;

  const dailyRemaining = dailyLimit > 0 ? Math.max(0, dailyLimit - currentTotals.today) : Infinity;
  const monthlyRemaining = monthlyLimit > 0 ? Math.max(0, monthlyLimit - currentTotals.month) : Infinity;

  if (dailyLimit > 0 && currentTotals.today + estimatedCost > dailyLimit) {
    return {
      allowed: false,
      reason: "daily_budget_exceeded",
      dailyRemaining,
      monthlyRemaining,
      estimatedCost,
    };
  }

  if (monthlyLimit > 0 && currentTotals.month + estimatedCost > monthlyLimit) {
    return {
      allowed: false,
      reason: "monthly_budget_exceeded",
      dailyRemaining,
      monthlyRemaining,
      estimatedCost,
    };
  }

  return {
    allowed: true,
    reason: null,
    dailyRemaining,
    monthlyRemaining,
    estimatedCost,
  };
}

/**
 * Summarize the ledger state for display.
 *
 * @param {object} ledger
 * @param {Date}   [now]
 * @returns {object} human-readable summary
 */
function summarize(ledger, now = new Date()) {
  const currentTotals = totals(ledger, now);
  const dailyLimit = ledger.limits && ledger.limits.dailyBudgetUsd ? ledger.limits.dailyBudgetUsd : 0;
  const monthlyLimit = ledger.limits && ledger.limits.monthlyBudgetUsd ? ledger.limits.monthlyBudgetUsd : 0;

  return {
    entryCount: currentTotals.entryCount,
    today: {
      spent: currentTotals.today,
      limit: dailyLimit || null,
      remaining: dailyLimit > 0 ? Math.max(0, dailyLimit - currentTotals.today) : null,
      canSpend: dailyLimit === 0 || currentTotals.today < dailyLimit,
    },
    month: {
      spent: currentTotals.month,
      limit: monthlyLimit || null,
      remaining: monthlyLimit > 0 ? Math.max(0, monthlyLimit - currentTotals.month) : null,
      canSpend: monthlyLimit === 0 || currentTotals.month < monthlyLimit,
    },
    lifetime: currentTotals.lifetime,
    pricing: { ...ledger.pricing },
  };
}

module.exports = {
  createLedger,
  record,
  totals,
  checkBudget,
  summarize,
  estimateCost,
  dayKey,
  monthKey,
};
