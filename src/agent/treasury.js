"use strict";

const { aiFoodPolicy, publicPurchaseProviderName } = require("./ai-food");
const { assertSafeTextForWrite, readSafeTextFile, writeSafeTextFile } = require("./safety");

const TREASURY_PATH = "memory/treasury.json";
const CYCLES_PATH = "memory/cycles.jsonl";
const DAY_MS = 86_400_000;
const MAX_LEDGER_ENTRIES = 500;
const MAX_REFILL_ENTRIES = 100;
const CREDIT_PURCHASE_MODE = "owner_approved_manual_credit_top_up";
const REVENUE_CADENCE = "weekly_performance";

function dayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function monthKey(date = new Date()) {
  return date.toISOString().slice(0, 7);
}

function defaultTreasury(config) {
  const purchaseProvider = publicPurchaseProviderName();
  return {
    ai: {
      dailyBudgetUsd: config.aiDailyBudgetUsd,
      monthlyBudgetUsd: config.aiMonthlyBudgetUsd,
      inputUsdPerMillion: config.aiInputUsdPerMillion,
      outputUsdPerMillion: config.aiOutputUsdPerMillion,
      reserveUsd: 0,
      providerCredits: [
        {
          provider: purchaseProvider,
          creditsUrl: "",
          balanceUsd: null,
          lastCheckedAt: null
        }
      ],
      purchasePolicy: {
        provider: purchaseProvider,
        creditsUrl: "",
        mode: CREDIT_PURCHASE_MODE,
        liveApiPurchase: false,
        notes: "Inference route order is private and separate from AI-credit purchases. Credit purchases are restricted to the configured owner-approved provider."
      },
      pendingTopUps: [],
      refills: [],
      ledger: []
    },
    revenue: {
      operatorShareBps: config.operatorRevenueBps,
      treasuryShareBps: 10000 - config.operatorRevenueBps,
      payoutAsset: "configured-paired-token",
      cadence: REVENUE_CADENCE,
      claimIntervalDays: config.revenueClaimIntervalDays,
      performanceWindowDays: config.revenuePerformanceWindowDays,
      minCompletedCycles: config.revenueMinCompletedCycles,
      minProductiveCycles: config.revenueMinProductiveCycles,
      minProductiveRatio: config.revenueMinProductiveRatio,
      operatorRecipientEnv: "ORBIT_OPERATOR_REVENUE_ADDRESS",
      treasuryRecipientEnv: "ORBIT_TREASURY_ADDRESS",
      lastClaimAttemptAt: null,
      lastClaimSentAt: null,
      lastClaimResult: null
    },
    token: {
      name: config.tokenName,
      symbol: config.tokenSymbol,
      launchStatus: "not_launched",
      address: null,
      txHash: null,
      launchedAt: null,
      launchRequest: null
    }
  };
}

function deepMerge(base, override) {
  if (!override || typeof override !== "object" || Array.isArray(override)) return base;
  const merged = { ...base };
  for (const [key, value] of Object.entries(override)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      merged[key] = deepMerge(base[key] || {}, value);
    } else {
      merged[key] = value;
    }
  }
  return merged;
}

function loadTreasury(repoRoot, config) {
  const defaults = defaultTreasury(config);
  try {
    return deepMerge(defaults, JSON.parse(readSafeTextFile(repoRoot, TREASURY_PATH)));
  } catch {
    return defaults;
  }
}

function saveTreasury(repoRoot, treasury) {
  writeSafeTextFile(repoRoot, TREASURY_PATH, `${JSON.stringify(treasury, null, 2)}\n`);
}

function estimateUsageCostUsd(config, usage = {}) {
  const inputTokens = Number(usage.prompt_tokens || usage.input_tokens || 0);
  const outputTokens = Number(usage.completion_tokens || usage.output_tokens || 0);
  const inputUsd = (inputTokens / 1_000_000) * config.aiInputUsdPerMillion;
  const outputUsd = (outputTokens / 1_000_000) * config.aiOutputUsdPerMillion;
  return Number((inputUsd + outputUsd).toFixed(8));
}

function spendTotals(treasury, now = new Date()) {
  const currentDay = dayKey(now);
  const currentMonth = monthKey(now);
  const ledger = Array.isArray(treasury.ai.ledger) ? treasury.ai.ledger : [];

  return ledger.reduce(
    (totals, entry) => {
      const amount = Number(entry.estimatedUsd || 0);
      if (String(entry.timestamp || "").startsWith(currentDay)) totals.today += amount;
      if (String(entry.timestamp || "").startsWith(currentMonth)) totals.month += amount;
      totals.lifetime += amount;
      return totals;
    },
    { today: 0, month: 0, lifetime: 0 }
  );
}

function readCycleEntries(repoRoot) {
  try {
    return readSafeTextFile(repoRoot, CYCLES_PATH)
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

function timestampMs(value) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function productiveFiles(files = []) {
  return (Array.isArray(files) ? files : []).filter((file) => {
    const normalized = String(file || "").replace(/\\/g, "/");
    if (!normalized) return false;
    if (normalized === "memory/state.json" || normalized === "memory/cycles.jsonl" || normalized === TREASURY_PATH) return false;
    if (normalized.startsWith("runtime/proofs/")) return false;
    if (normalized.startsWith("memory/cycles/")) return false;
    return true;
  });
}

function isProductiveCycle(cycle = {}) {
  const result = String(cycle.result || "").toLowerCase();
  const quietOnly = /action taken\W*none|no new action|no safe useful action|cycle finished without tool calls/.test(result);
  return productiveFiles(cycle.filesChanged).length > 0 && !quietOnly;
}

function revenuePerformanceStatus(config, repoRoot = config.repoRoot, now = new Date()) {
  const windowDays = Math.max(1, Number(config.revenuePerformanceWindowDays || 7));
  const cutoff = now.getTime() - (windowDays * DAY_MS);
  const cycles = readCycleEntries(repoRoot).filter((cycle) => {
    const timestamp = timestampMs(cycle.timestamp);
    return timestamp !== null && timestamp >= cutoff && timestamp <= now.getTime();
  });
  const completedCycles = cycles.length;
  const productiveCycles = cycles.filter(isProductiveCycle).length;
  const productiveRatio = completedCycles ? productiveCycles / completedCycles : 0;
  const thresholds = {
    minCompletedCycles: Number(config.revenueMinCompletedCycles || 0),
    minProductiveCycles: Number(config.revenueMinProductiveCycles || 0),
    minProductiveRatio: Number(config.revenueMinProductiveRatio || 0)
  };
  const reasons = [];

  if (completedCycles < thresholds.minCompletedCycles) {
    reasons.push("not_enough_completed_cycles");
  }
  if (productiveCycles < thresholds.minProductiveCycles) {
    reasons.push("not_enough_productive_cycles");
  }
  if (productiveRatio < thresholds.minProductiveRatio) {
    reasons.push("productive_ratio_too_low");
  }

  return {
    windowDays,
    completedCycles,
    productiveCycles,
    productiveRatio: Number(productiveRatio.toFixed(4)),
    thresholds,
    passed: reasons.length === 0,
    reasons
  };
}

function lastRevenueSentAt(revenue = {}) {
  if (revenue.lastClaimSentAt) return revenue.lastClaimSentAt;
  if (revenue.lastClaimResult && revenue.lastClaimResult.txHash && revenue.lastClaimAttemptAt) {
    return revenue.lastClaimAttemptAt;
  }
  return null;
}

function revenueClaimStatus(config, repoRoot = config.repoRoot, treasury = loadTreasury(repoRoot, config), now = new Date()) {
  const intervalDays = Math.max(1, Number(config.revenueClaimIntervalDays || 7));
  const lastSentAt = lastRevenueSentAt(treasury.revenue || {});
  const lastSentMs = lastSentAt ? timestampMs(lastSentAt) : null;
  const nextEligibleAt = lastSentMs === null
    ? null
    : new Date(lastSentMs + (intervalDays * DAY_MS)).toISOString();
  const cadenceReady = lastSentMs === null || now.getTime() >= lastSentMs + (intervalDays * DAY_MS);
  const performance = revenuePerformanceStatus(config, repoRoot, now);
  const reasons = [
    ...(cadenceReady ? [] : ["weekly_cadence_not_ready"]),
    ...(performance.passed ? [] : performance.reasons)
  ];

  return {
    cadence: REVENUE_CADENCE,
    intervalDays,
    lastSentAt,
    nextEligibleAt,
    cadenceReady,
    performance,
    canClaim: reasons.length === 0,
    reasons
  };
}

function budgetStatus(config, repoRoot = config.repoRoot) {
  const treasury = loadTreasury(repoRoot, config);
  const totals = spendTotals(treasury);
  const dailyRemainingUsd = Math.max(0, Number(treasury.ai.dailyBudgetUsd) - totals.today);
  const monthlyRemainingUsd = Math.max(0, Number(treasury.ai.monthlyBudgetUsd) - totals.month);
  return {
    dailyBudgetUsd: Number(treasury.ai.dailyBudgetUsd),
    monthlyBudgetUsd: Number(treasury.ai.monthlyBudgetUsd),
    spentTodayUsd: Number(totals.today.toFixed(8)),
    spentThisMonthUsd: Number(totals.month.toFixed(8)),
    lifetimeSpendUsd: Number(totals.lifetime.toFixed(8)),
    dailyRemainingUsd: Number(dailyRemainingUsd.toFixed(8)),
    monthlyRemainingUsd: Number(monthlyRemainingUsd.toFixed(8)),
    canUseAi: dailyRemainingUsd > 0 && monthlyRemainingUsd > 0,
    purchasePolicy: aiFoodPolicy(config, treasury)
  };
}

function recordAiUsage(config, repoRoot, usage, aiRoute, note) {
  const treasury = loadTreasury(repoRoot, config);
  const estimatedUsd = estimateUsageCostUsd(config, usage);
  treasury.ai.ledger = Array.isArray(treasury.ai.ledger) ? treasury.ai.ledger : [];
  treasury.ai.ledger.push({
    timestamp: new Date().toISOString(),
    aiRoute,
    note,
    promptTokens: Number(usage.prompt_tokens || usage.input_tokens || 0),
    completionTokens: Number(usage.completion_tokens || usage.output_tokens || 0),
    totalTokens: Number(usage.total_tokens || 0),
    estimatedUsd
  });
  treasury.ai.ledger = treasury.ai.ledger.slice(-MAX_LEDGER_ENTRIES);
  saveTreasury(repoRoot, treasury);
  return { path: TREASURY_PATH, estimatedUsd };
}

function sanitizeAiLedger(ledger) {
  return (Array.isArray(ledger) ? ledger : []).map((entry) => {
    const { model, ...safeEntry } = entry || {};
    return {
      ...safeEntry,
      aiRoute: safeEntry.aiRoute || "private-ai-route-1"
    };
  });
}

function sanitizeCreditEntries(entries, purchaseProvider) {
  return (Array.isArray(entries) ? entries : []).map((entry) => ({
    ...entry,
    provider: purchaseProvider,
    creditsUrl: ""
  }));
}

function syncRevenuePolicy(config, repoRoot = config.repoRoot) {
  const treasury = loadTreasury(repoRoot, config);
  const purchaseProvider = publicPurchaseProviderName();
  treasury.ai.providerCredits = sanitizeCreditEntries(treasury.ai.providerCredits, purchaseProvider);
  treasury.ai.pendingTopUps = sanitizeCreditEntries(treasury.ai.pendingTopUps, purchaseProvider);
  treasury.ai.refills = sanitizeCreditEntries(treasury.ai.refills, purchaseProvider);
  treasury.ai.ledger = sanitizeAiLedger(treasury.ai.ledger);
  treasury.ai.purchasePolicy = {
    ...(treasury.ai.purchasePolicy || {}),
    provider: purchaseProvider,
    creditsUrl: "",
    mode: CREDIT_PURCHASE_MODE,
    liveApiPurchase: false,
    notes: "Inference route order is private and separate from AI-credit purchases. Credit purchases are restricted to the configured owner-approved provider."
  };
  treasury.revenue.operatorShareBps = config.operatorRevenueBps;
  treasury.revenue.treasuryShareBps = 10000 - config.operatorRevenueBps;
  treasury.revenue.payoutAsset = "configured-paired-token";
  treasury.revenue.cadence = REVENUE_CADENCE;
  treasury.revenue.claimIntervalDays = config.revenueClaimIntervalDays;
  treasury.revenue.performanceWindowDays = config.revenuePerformanceWindowDays;
  treasury.revenue.minCompletedCycles = config.revenueMinCompletedCycles;
  treasury.revenue.minProductiveCycles = config.revenueMinProductiveCycles;
  treasury.revenue.minProductiveRatio = config.revenueMinProductiveRatio;
  treasury.token.name = config.tokenName;
  treasury.token.symbol = config.tokenSymbol;
  saveTreasury(repoRoot, treasury);
  return treasury;
}

function upsertPendingTopUp(config, repoRoot, topUp) {
  const treasury = loadTreasury(repoRoot, config);
  const purchaseProvider = publicPurchaseProviderName();
  treasury.ai.pendingTopUps = Array.isArray(treasury.ai.pendingTopUps) ? treasury.ai.pendingTopUps : [];
  const existingIndex = treasury.ai.pendingTopUps.findIndex((item) => item.approvalId === topUp.approvalId);
  const entry = {
    provider: purchaseProvider,
    creditsUrl: "",
    status: "pending_owner_approval",
    requestedAt: new Date().toISOString(),
    ...topUp,
    updatedAt: new Date().toISOString()
  };

  if (existingIndex >= 0) {
    treasury.ai.pendingTopUps[existingIndex] = {
      ...treasury.ai.pendingTopUps[existingIndex],
      ...entry
    };
  } else {
    treasury.ai.pendingTopUps.push(entry);
  }

  treasury.ai.pendingTopUps = treasury.ai.pendingTopUps.slice(-MAX_REFILL_ENTRIES);
  saveTreasury(repoRoot, treasury);
  return entry;
}

function recordAiCreditRefill(config, repoRoot, refill) {
  const amountUsd = Number(refill.amountUsd);
  if (!Number.isFinite(amountUsd) || amountUsd <= 0) {
    throw new Error("amountUsd must be a positive number");
  }
  assertSafeTextForWrite([
    refill.approvalId || "",
    refill.proof || ""
  ].join("\n"));
  const treasury = loadTreasury(repoRoot, config);
  treasury.ai.refills = Array.isArray(treasury.ai.refills) ? treasury.ai.refills : [];
  treasury.ai.providerCredits = Array.isArray(treasury.ai.providerCredits) ? treasury.ai.providerCredits : [];
  treasury.ai.pendingTopUps = Array.isArray(treasury.ai.pendingTopUps) ? treasury.ai.pendingTopUps : [];
  const purchaseProvider = publicPurchaseProviderName();

  const entry = {
    provider: purchaseProvider,
    creditsUrl: "",
    amountUsd: Number(amountUsd.toFixed(2)),
    approvalId: refill.approvalId || null,
    proof: refill.proof || "",
    recordedAt: new Date().toISOString()
  };
  treasury.ai.refills.push(entry);
  treasury.ai.refills = treasury.ai.refills.slice(-MAX_REFILL_ENTRIES);

  const creditIndex = treasury.ai.providerCredits.findIndex((item) => item.provider === purchaseProvider);
  const current = creditIndex >= 0 ? treasury.ai.providerCredits[creditIndex] : { provider: purchaseProvider };
  const currentBalance = Number(current.balanceUsd);
  const balanceUsd = Number.isFinite(currentBalance)
    ? Number((currentBalance + entry.amountUsd).toFixed(2))
    : null;
  const providerCredit = {
    ...current,
    provider: purchaseProvider,
    creditsUrl: "",
    balanceUsd,
    lastRefillAt: entry.recordedAt
  };

  if (creditIndex >= 0) treasury.ai.providerCredits[creditIndex] = providerCredit;
  else treasury.ai.providerCredits.push(providerCredit);

  if (entry.approvalId) {
    treasury.ai.pendingTopUps = treasury.ai.pendingTopUps.map((item) => (
      item.approvalId === entry.approvalId
        ? { ...item, status: "recorded_complete", completedAt: entry.recordedAt }
        : item
    ));
  }

  saveTreasury(repoRoot, treasury);
  return entry;
}

module.exports = {
  TREASURY_PATH,
  budgetStatus,
  dayKey,
  estimateUsageCostUsd,
  loadTreasury,
  recordAiUsage,
  recordAiCreditRefill,
  saveTreasury,
  revenueClaimStatus,
  revenuePerformanceStatus,
  spendTotals,
  syncRevenuePolicy,
  upsertPendingTopUp
};
