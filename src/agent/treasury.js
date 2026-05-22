"use strict";

const { aiFoodPolicy, OPENROUTER_CREDITS_URL } = require("./ai-food");
const { assertSafeTextForWrite, readSafeTextFile, writeSafeTextFile } = require("./safety");

const TREASURY_PATH = "memory/treasury.json";
const MAX_LEDGER_ENTRIES = 500;
const MAX_REFILL_ENTRIES = 100;

function dayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function monthKey(date = new Date()) {
  return date.toISOString().slice(0, 7);
}

function defaultTreasury(config) {
  return {
    ai: {
      dailyBudgetUsd: config.aiDailyBudgetUsd,
      monthlyBudgetUsd: config.aiMonthlyBudgetUsd,
      inputUsdPerMillion: config.aiInputUsdPerMillion,
      outputUsdPerMillion: config.aiOutputUsdPerMillion,
      reserveUsd: 0,
      providerCredits: [
        {
          provider: "openrouter",
          creditsUrl: OPENROUTER_CREDITS_URL,
          balanceUsd: null,
          lastCheckedAt: null
        }
      ],
      purchasePolicy: {
        provider: "openrouter",
        creditsUrl: OPENROUTER_CREDITS_URL,
        mode: "owner_approved_manual_openrouter",
        liveApiPurchase: false,
        notes: "Orbit may use FreeModel, OpenGateway, and OpenRouter for inference, but AI-credit purchase requests are restricted to OpenRouter."
      },
      pendingTopUps: [],
      refills: [],
      ledger: []
    },
    revenue: {
      operatorShareBps: config.operatorRevenueBps,
      treasuryShareBps: 10000 - config.operatorRevenueBps,
      payoutAsset: "configured-paired-token",
      cadence: "daily",
      operatorRecipientEnv: "ORBIT_OPERATOR_REVENUE_ADDRESS",
      treasuryRecipientEnv: "ORBIT_TREASURY_ADDRESS",
      lastClaimAttemptAt: null,
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

function recordAiUsage(config, repoRoot, usage, model, note) {
  const treasury = loadTreasury(repoRoot, config);
  const estimatedUsd = estimateUsageCostUsd(config, usage);
  treasury.ai.ledger = Array.isArray(treasury.ai.ledger) ? treasury.ai.ledger : [];
  treasury.ai.ledger.push({
    timestamp: new Date().toISOString(),
    model,
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

function syncRevenuePolicy(config, repoRoot = config.repoRoot) {
  const treasury = loadTreasury(repoRoot, config);
  treasury.ai.purchasePolicy = {
    ...(treasury.ai.purchasePolicy || {}),
    provider: "openrouter",
    creditsUrl: OPENROUTER_CREDITS_URL,
    mode: (treasury.ai.purchasePolicy && treasury.ai.purchasePolicy.mode) || "owner_approved_manual_openrouter",
    liveApiPurchase: false,
    notes: "Orbit may use FreeModel, OpenGateway, and OpenRouter for inference, but AI-credit purchase requests are restricted to OpenRouter."
  };
  treasury.revenue.operatorShareBps = config.operatorRevenueBps;
  treasury.revenue.treasuryShareBps = 10000 - config.operatorRevenueBps;
  treasury.revenue.payoutAsset = "configured-paired-token";
  treasury.revenue.cadence = "daily";
  treasury.token.name = config.tokenName;
  treasury.token.symbol = config.tokenSymbol;
  saveTreasury(repoRoot, treasury);
  return treasury;
}

function upsertPendingTopUp(config, repoRoot, topUp) {
  const treasury = loadTreasury(repoRoot, config);
  treasury.ai.pendingTopUps = Array.isArray(treasury.ai.pendingTopUps) ? treasury.ai.pendingTopUps : [];
  const existingIndex = treasury.ai.pendingTopUps.findIndex((item) => item.approvalId === topUp.approvalId);
  const entry = {
    provider: "openrouter",
    creditsUrl: OPENROUTER_CREDITS_URL,
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

  const entry = {
    provider: "openrouter",
    creditsUrl: OPENROUTER_CREDITS_URL,
    amountUsd: Number(amountUsd.toFixed(2)),
    approvalId: refill.approvalId || null,
    proof: refill.proof || "",
    recordedAt: new Date().toISOString()
  };
  treasury.ai.refills.push(entry);
  treasury.ai.refills = treasury.ai.refills.slice(-MAX_REFILL_ENTRIES);

  const creditIndex = treasury.ai.providerCredits.findIndex((item) => item.provider === "openrouter");
  const current = creditIndex >= 0 ? treasury.ai.providerCredits[creditIndex] : { provider: "openrouter" };
  const currentBalance = Number(current.balanceUsd);
  const balanceUsd = Number.isFinite(currentBalance)
    ? Number((currentBalance + entry.amountUsd).toFixed(2))
    : null;
  const providerCredit = {
    ...current,
    provider: "openrouter",
    creditsUrl: OPENROUTER_CREDITS_URL,
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
  spendTotals,
  syncRevenuePolicy,
  upsertPendingTopUp
};
