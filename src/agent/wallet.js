"use strict";

const { readSafeTextFile } = require("./safety");

const GOVERNANCE_PATH = "memory/governance.json";
const TREASURY_PATH = "memory/treasury.json";

function parseJson(value, fallback = {}) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function loadWallet(repoRoot) {
  return {
    governance: parseJson(readOptionalTextFile(repoRoot, GOVERNANCE_PATH), {}),
    treasury: parseJson(readOptionalTextFile(repoRoot, TREASURY_PATH), {})
  };
}

function readOptionalTextFile(repoRoot, relativePath) {
  try {
    return readSafeTextFile(repoRoot, relativePath);
  } catch {
    return "";
  }
}

function summarizeWallet(wallet = {}) {
  const governance = wallet.governance && typeof wallet.governance === "object" ? wallet.governance : {};
  const treasury = wallet.treasury && typeof wallet.treasury === "object" ? wallet.treasury : {};
  const externalSpend = governance.externalSpend && typeof governance.externalSpend === "object"
    ? governance.externalSpend
    : {};
  const selfRecipients = governance.selfRecipients && typeof governance.selfRecipients === "object"
    ? governance.selfRecipients
    : {};
  const ai = treasury.ai && typeof treasury.ai === "object" ? treasury.ai : {};
  const purchasePolicy = ai.purchasePolicy && typeof ai.purchasePolicy === "object" ? ai.purchasePolicy : {};
  const revenue = treasury.revenue && typeof treasury.revenue === "object" ? treasury.revenue : {};
  const token = treasury.token && typeof treasury.token === "object" ? treasury.token : {};

  return {
    approvalMode: externalSpend.mode || "owner_approval_required",
    approvalIssueLabel: externalSpend.approvalIssueLabel || null,
    approvalAcceptedLabel: externalSpend.approvalAcceptedLabel || null,
    approvalRejectedLabel: externalSpend.approvalRejectedLabel || null,
    allowedWithoutApproval: Array.isArray(externalSpend.allowedWithoutApproval)
      ? externalSpend.allowedWithoutApproval
      : [],
    selfRecipients: {
      treasuryEnv: selfRecipients.treasuryEnv || null,
      operatorRevenueEnv: selfRecipients.operatorRevenueEnv || null
    },
    aiBudget: {
      dailyBudgetUsd: Number(ai.dailyBudgetUsd || 0),
      monthlyBudgetUsd: Number(ai.monthlyBudgetUsd || 0),
      reserveUsd: Number(ai.reserveUsd || 0),
      purchaseMode: purchasePolicy.mode || null,
      liveApiPurchase: Boolean(purchasePolicy.liveApiPurchase)
    },
    revenue: {
      cadence: revenue.cadence || "weekly_performance",
      claimIntervalDays: Number(revenue.claimIntervalDays || 0),
      performanceWindowDays: Number(revenue.performanceWindowDays || 0),
      operatorShareBps: Number(revenue.operatorShareBps || 0),
      treasuryShareBps: Number(revenue.treasuryShareBps || 0),
      lastClaimAttemptAt: revenue.lastClaimAttemptAt || null,
      lastClaimSentAt: revenue.lastClaimSentAt || null,
      canClaim: Boolean(revenue.lastClaimResult && revenue.lastClaimResult.txHash)
    },
    token: {
      name: token.name || "",
      symbol: token.symbol || "",
      launchStatus: token.launchStatus || "unknown",
      launchedAt: token.launchedAt || null,
      configured: Boolean(token.name || token.symbol)
    },
    blockedLiveActions: [
      "wallet spending",
      "external payments",
      "signing",
      "token launch",
      "reward claims",
      "payout-route changes"
    ]
  };
}

function walletStatus(repoRoot) {
  const wallet = loadWallet(repoRoot);
  return {
    paths: [GOVERNANCE_PATH, TREASURY_PATH],
    governance: wallet.governance,
    treasury: wallet.treasury,
    summary: summarizeWallet(wallet)
  };
}

module.exports = {
  GOVERNANCE_PATH,
  TREASURY_PATH,
  loadWallet,
  summarizeWallet,
  walletStatus
};
