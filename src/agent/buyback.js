"use strict";

const crypto = require("crypto");
const { isAddress } = require("./addresses");
const { assertTreasuryFloor } = require("./governance");
const {
  assertSafePublicReply,
  readSafeTextFile,
  writeSafeTextFile
} = require("./safety");

const BUYBACK_LEDGER_PATH = "memory/buybacks.json";
const DEFAULT_PAIRED_WETH = "0x4200000000000000000000000000000000000006";
const WETH_AMOUNT_PATTERN = /^\d+(\.\d{1,4})?$/;
const MAX_SLIPPAGE_OVERRIDE_BPS = 500;
const WEI_PER_ETH = 10n ** 18n;

function wethAmountToWei(amount) {
  if (amount === null || amount === undefined) return null;
  const str = String(amount).trim();
  if (!/^\d+(\.\d+)?$/.test(str)) return null;
  const [whole, frac = ""] = str.split(".");
  const fracPadded = (frac + "0".repeat(18)).slice(0, 18);
  try {
    return BigInt(whole + fracPadded);
  } catch {
    return null;
  }
}

// --- ledger helpers ------------------------------------------------------

function defaultLedger() {
  return { buybacks: [] };
}

function loadBuybackLedger(repoRoot) {
  try {
    const parsed = JSON.parse(readSafeTextFile(repoRoot, BUYBACK_LEDGER_PATH));
    if (parsed && Array.isArray(parsed.buybacks)) return parsed;
    return defaultLedger();
  } catch {
    return defaultLedger();
  }
}

function saveBuybackLedger(repoRoot, ledger) {
  const value = ledger && Array.isArray(ledger.buybacks) ? ledger : defaultLedger();
  writeSafeTextFile(
    repoRoot,
    BUYBACK_LEDGER_PATH,
    `${JSON.stringify(value, null, 2)}\n`
  );
  return value;
}

// --- idempotency ---------------------------------------------------------

function weekStartFromDate(dateInput) {
  const date = dateInput instanceof Date ? new Date(dateInput.getTime()) : new Date(dateInput || Date.now());
  if (Number.isNaN(date.getTime())) return "1970-01-05"; // first Monday of the unix epoch week
  // align to UTC Monday 00:00
  const day = date.getUTCDay(); // 0 = Sunday
  const offsetToMonday = (day + 6) % 7;
  date.setUTCDate(date.getUTCDate() - offsetToMonday);
  date.setUTCHours(0, 0, 0, 0);
  return date.toISOString().slice(0, 10);
}

function buybackIdempotencyKey(cycle, weekStart) {
  const cycleKey = String(cycle ?? "0");
  const weekKey = String(weekStart || "");
  const hash = crypto
    .createHash("sha256")
    .update(`orbit-buyback:${cycleKey}:${weekKey}`)
    .digest("hex");
  return hash.slice(0, 32);
}

// --- D-018 / D-014 precondition gate -------------------------------------

function isBuybackEnabled(config = {}, state = {}) {
  const buyback = (config && config.buyback) || {};
  if (!buyback.enabled) {
    return { ok: false, reason: "ORBIT_ENABLE_BUYBACK is not true" };
  }
  if (state.preLaunchVerified !== true) {
    return { ok: false, reason: "state.preLaunchVerified is not true (D-018 pre-launch gate)" };
  }
  const tokenAddress = state.tokenAddress || (state.token && state.token.address);
  if (!tokenAddress || typeof tokenAddress !== "string" || !isAddress(tokenAddress)) {
    return { ok: false, reason: "state.tokenAddress is not set or not a valid address" };
  }
  if (!buyback.routerAddress || !isAddress(buyback.routerAddress)) {
    return { ok: false, reason: "buyback router address is not configured" };
  }
  const paired = buyback.pairedTokenAddress || DEFAULT_PAIRED_WETH;
  if (!isAddress(paired)) {
    return { ok: false, reason: "paired token address (WETH) is not a valid address" };
  }
  return { ok: true };
}

// --- validation helpers --------------------------------------------------

function normalizeWethAmount(raw) {
  const value = String(raw == null ? "" : raw).trim();
  if (!WETH_AMOUNT_PATTERN.test(value)) {
    throw new Error("wethAmount must be a decimal string with at most 4 decimals");
  }
  const num = Number.parseFloat(value);
  if (!Number.isFinite(num) || num <= 0) {
    throw new Error("wethAmount must be a positive number");
  }
  return { string: value, number: num };
}

function assertWeeklyMaxNotExceeded(buybackConfig, wethAmount) {
  const cap = Number.parseFloat(buybackConfig.weeklyMaxWeth || "0");
  if (!Number.isFinite(cap) || cap <= 0) return;
  if (wethAmount.number > cap) {
    throw new Error(`wethAmount ${wethAmount.string} exceeds weeklyMaxWeth ${cap}`);
  }
}

function normalizeRationale(raw) {
  const value = String(raw == null ? "" : raw).trim();
  if (!value) throw new Error("rationale is required");
  if (value.length > 280) throw new Error("rationale must be <= 280 chars");
  // safety check
  assertSafePublicReply(value);
  return value;
}

// --- approval issue body -------------------------------------------------

function buybackApprovalIssueBody({ idem, wethAmount, rationale, weekStart, cycle, dryRun, pairedToken, tokenAddress }) {
  return [
    "Orbit is requesting public owner approval to buy back $ORBIT with treasury WETH.",
    "",
    `Idempotency key: \`${idem}\``,
    `Cycle: \`${cycle}\``,
    `Week start (UTC Monday): \`${weekStart}\``,
    `WETH to spend: \`${wethAmount} WETH\``,
    `Paired token (WETH on Base): \`${pairedToken}\``,
    `$ORBIT token address: \`${tokenAddress}\``,
    `Mode: \`${dryRun ? "DRY_RUN" : "LIVE"}\``,
    "",
    `Rationale: ${rationale}`,
    "",
    "Per D-005 and D-014, no on-chain swap will happen until the owner approves this issue.",
    "Per D-018, the agent will additionally refuse if the pre-launch gate has not been verified.",
    "",
    "To approve, the configured owner must add this exact standalone comment:",
    "",
    `\`APPROVE ORBIT-BUYBACK ${idem}\``,
    "",
    "To reject, the configured owner must add this exact standalone comment:",
    "",
    `\`REJECT ORBIT-BUYBACK ${idem}\``
  ].join("\n");
}

function commentApprovesBuyback(ownerUsername, comment, idem) {
  const author = comment.author || comment.user || "";
  const owner = String(ownerUsername || "").trim();
  if (!owner) return null;
  const fromOwner = author.toLowerCase() === owner.toLowerCase();
  if (!fromOwner) return null;
  const body = comment.body || "";
  const lines = body.split(/\r?\n/).map((line) => line.trim());
  if (lines.includes(`APPROVE ORBIT-BUYBACK ${idem}`)) return "approved";
  if (lines.includes(`REJECT ORBIT-BUYBACK ${idem}`)) return "rejected";
  return null;
}

// --- propose -------------------------------------------------------------

async function proposeBuyback(config, context, params = {}) {
  const state = (context && context.state) || {};
  const gate = isBuybackEnabled(config, state);
  if (!gate.ok) {
    return {
      ok: false,
      blocked: true,
      reason: gate.reason,
      status: "blocked_precondition"
    };
  }

  const buyback = config.buyback || {};
  const wethAmount = normalizeWethAmount(params.wethAmount);
  assertWeeklyMaxNotExceeded(buyback, wethAmount);
  const rationale = normalizeRationale(params.rationale);

  const cycle = context && context.cycle != null ? context.cycle : (state.cycle || 0);
  const weekStart = weekStartFromDate(params.now || new Date());
  const idem = buybackIdempotencyKey(cycle, weekStart);

  const dryRun = buyback.dryRun !== false; // default true
  const tokenAddress = state.tokenAddress || (state.token && state.token.address) || "";
  const pairedToken = buyback.pairedTokenAddress || DEFAULT_PAIRED_WETH;

  const ledger = loadBuybackLedger(config.repoRoot);
  let entry = ledger.buybacks.find((item) => item.idem === idem);
  if (entry && entry.status !== "rejected" && entry.status !== "executed_dry") {
    // already proposed for this week; reuse
    return {
      ok: true,
      dryRun,
      proposalIssueUrl: entry.proposalIssueUrl || null,
      ledgerEntry: entry,
      idem,
      idempotent: true,
      status: "proposed_existing"
    };
  }

  const title = `[orbit buyback] propose ${wethAmount.string} WETH ${dryRun ? "(DRY_RUN)" : ""}`.trim();
  const body = buybackApprovalIssueBody({
    idem,
    wethAmount: wethAmount.string,
    rationale,
    weekStart,
    cycle,
    dryRun,
    pairedToken,
    tokenAddress
  });
  assertSafePublicReply(`${title}\n${body}`);

  let proposalIssueUrl = null;
  let proposalIssueNumber = null;
  const github = context && context.github;
  if (github && typeof github.createIssue === "function") {
    const labels = [
      buyback.approvalIssueLabel || config.approvalIssueLabel || "orbit:approval",
      "orbit:buyback"
    ].filter(Boolean);
    const issue = await github.createIssue({ title, body, labels });
    if (issue) {
      proposalIssueUrl = issue.html_url || issue.url || null;
      proposalIssueNumber = issue.number || null;
    }
  }

  const now = new Date().toISOString();
  const newEntry = {
    idem,
    cycle,
    weekStart,
    wethProposed: wethAmount.string,
    rationale,
    dryRun,
    approved: false,
    proposalIssueUrl,
    proposalIssueNumber,
    status: dryRun ? "proposed_dry" : "proposed",
    at: now
  };

  if (entry) {
    Object.assign(entry, newEntry);
  } else {
    ledger.buybacks.push(newEntry);
    entry = newEntry;
  }
  saveBuybackLedger(config.repoRoot, ledger);

  return {
    ok: true,
    dryRun,
    proposalIssueUrl,
    proposalIssueNumber,
    ledgerEntry: entry,
    idem,
    status: dryRun ? "proposed_dry" : "proposed"
  };
}

// --- execute -------------------------------------------------------------

function deterministicMockOrbitReceived(wethString, idem) {
  // Deterministic mock: derive an "ORBIT received" amount from the idem hash.
  // 1 WETH -> a pseudo-random number in [50_000, 150_000] of $ORBIT
  const seed = parseInt(idem.slice(0, 8), 16);
  const ratio = 50_000 + (seed % 100_000); // tokens per WETH
  const weth = Number.parseFloat(wethString) || 0;
  const amount = weth * ratio;
  // 6 decimal places to keep things tidy
  return amount.toFixed(6);
}

function syntheticDryRunTxHash(idem) {
  // 32 bytes hex = 64 chars after 0x; keep it visibly fake by starting with "dry"
  // and padding to 64 chars using the idem.
  const tag = "dry";
  const padded = `${tag}${idem}`.padEnd(64, "0").slice(0, 64);
  return `0x${padded}`;
}

async function findApprovalLabelAndComment({ github, proposalIssueNumber, ownerUsername, idem, approvalAcceptedLabel }) {
  if (!github || !proposalIssueNumber) {
    return { labeled: false, owner: false, status: "missing_github" };
  }
  let issue = null;
  if (typeof github.getIssue === "function") {
    issue = await github.getIssue(proposalIssueNumber);
  } else if (typeof github.listIssues === "function") {
    const issues = await github.listIssues({ state: "all", perPage: 100 });
    issue = issues.find((item) => item.number === proposalIssueNumber) || null;
  }
  if (!issue) return { labeled: false, owner: false, status: "issue_not_found" };

  const labels = Array.isArray(issue.labels)
    ? issue.labels.map((label) => (typeof label === "string" ? label : label && label.name) || "").map((l) => l.toLowerCase())
    : [];
  const acceptedLabel = String(approvalAcceptedLabel || "orbit:approved").toLowerCase();
  const labeled = labels.includes(acceptedLabel);

  let ownerApproved = false;
  if (typeof github.listIssueComments === "function") {
    const comments = await github.listIssueComments(proposalIssueNumber);
    for (const comment of comments) {
      const verdict = commentApprovesBuyback(ownerUsername, comment, idem);
      if (verdict === "approved") {
        ownerApproved = true;
        break;
      }
      if (verdict === "rejected") {
        return { labeled, owner: false, status: "owner_rejected" };
      }
    }
  }

  return {
    labeled,
    owner: ownerApproved,
    status: labeled && ownerApproved ? "approved" : "pending"
  };
}

async function executeBuyback(config, context, params = {}) {
  const state = (context && context.state) || {};
  const gate = isBuybackEnabled(config, state);
  if (!gate.ok) {
    return {
      ok: false,
      blocked: true,
      reason: gate.reason,
      status: "blocked_precondition",
      dryRun: Boolean(config.buyback && config.buyback.dryRun !== false)
    };
  }

  const buyback = config.buyback || {};
  const dryRun = buyback.dryRun !== false; // default true

  const proposalIssueNumber = Number.parseInt(params.proposalIssueNumber, 10);
  if (!Number.isInteger(proposalIssueNumber) || proposalIssueNumber <= 0) {
    return {
      ok: false,
      blocked: true,
      reason: "proposalIssueNumber is required",
      status: "blocked_invalid_input",
      dryRun
    };
  }

  let slippageBps = Number(buyback.slippageBps || 100);
  if (params.slippageBpsOverride != null) {
    const override = Number(params.slippageBpsOverride);
    if (!Number.isInteger(override) || override <= 0 || override > MAX_SLIPPAGE_OVERRIDE_BPS) {
      return {
        ok: false,
        blocked: true,
        reason: `slippageBpsOverride must be 1..${MAX_SLIPPAGE_OVERRIDE_BPS}`,
        status: "blocked_invalid_input",
        dryRun
      };
    }
    slippageBps = override;
  }

  const ledger = loadBuybackLedger(config.repoRoot);
  const entry = ledger.buybacks.find((item) => item.proposalIssueNumber === proposalIssueNumber);
  if (!entry) {
    return {
      ok: false,
      blocked: true,
      reason: "no ledger entry for proposalIssueNumber",
      status: "blocked_no_proposal",
      dryRun
    };
  }

  // Approval gate (D-014): require both the accepted label AND owner comment match.
  const approval = await findApprovalLabelAndComment({
    github: context && context.github,
    proposalIssueNumber,
    ownerUsername: config.ownerUsername,
    idem: entry.idem,
    approvalAcceptedLabel: config.approvalAcceptedLabel
  });

  if (!approval.labeled || !approval.owner) {
    entry.approved = false;
    entry.lastCheckedAt = new Date().toISOString();
    entry.status = approval.status === "owner_rejected" ? "rejected" : "pending_approval";
    saveBuybackLedger(config.repoRoot, ledger);
    return {
      ok: false,
      blocked: true,
      reason: approval.status === "owner_rejected"
        ? "owner rejected the approval comment"
        : "approval issue missing accepted label or owner approval comment",
      status: entry.status,
      dryRun
    };
  }

  // Approved. Build receipt.
  entry.approved = true;
  entry.slippageBps = slippageBps;
  entry.approvedAt = new Date().toISOString();

  // T-1: treasury-floor guard. Belt-and-braces over the approval gate — even
  // an approved buyback is rejected if the planned WETH spend would breach the
  // operator-configured per-cycle cap or post-spend floor.
  const plannedWei = wethAmountToWei(entry.wethProposed);
  if (plannedWei !== null) {
    const floorDecision = assertTreasuryFloor({
      state: (context && context.state) || {},
      config,
      amountWei: plannedWei.toString(),
      actionType: "buyback",
      actionLabel: `weekly buyback ${entry.idem}`
    });
    if (!floorDecision.ok) {
      entry.status = "blocked_treasury_floor";
      entry.treasuryFloorDecision = floorDecision;
      entry.lastCheckedAt = new Date().toISOString();
      saveBuybackLedger(config.repoRoot, ledger);
      return {
        ok: false,
        blocked: true,
        reason: floorDecision.reason,
        detail: floorDecision.detail,
        status: "blocked_treasury_floor",
        treasuryFloor: floorDecision,
        dryRun
      };
    }
  }

  if (dryRun) {
    const txHash = syntheticDryRunTxHash(entry.idem);
    const orbitReceived = deterministicMockOrbitReceived(entry.wethProposed, entry.idem);
    entry.txHash = txHash;
    entry.wethSpent = entry.wethProposed;
    entry.orbitReceived = orbitReceived;
    entry.status = "executed_dry";
    entry.executedAt = new Date().toISOString();
    saveBuybackLedger(config.repoRoot, ledger);
    return {
      ok: true,
      dryRun: true,
      txHash,
      wethSpent: entry.wethSpent,
      orbitReceived,
      slippageBps,
      idem: entry.idem,
      status: "executed_dry"
    };
  }

  // Live path: deliberately not implemented yet — viem wallet client wiring is
  // tracked in src/agent/wallet.js. Until that helper exists, refuse to send
  // a real transaction so we cannot accidentally bypass the gate. This is the
  // D-018 belt-and-braces: even if every prior check is somehow bypassed, the
  // live router call is gated behind a missing helper.
  entry.status = "blocked_live_unavailable";
  entry.executedAt = null;
  saveBuybackLedger(config.repoRoot, ledger);
  return {
    ok: false,
    blocked: true,
    dryRun: false,
    reason: "live buyback execution is not wired; refusing to send a real transaction",
    status: "blocked_live_unavailable"
  };
}

// --- receipt formatting --------------------------------------------------

function formatBuybackReceipt(entry = {}) {
  return {
    kind: "buyback",
    idem: entry.idem || null,
    cycle: entry.cycle == null ? null : entry.cycle,
    weekStart: entry.weekStart || null,
    approved: Boolean(entry.approved),
    dryRun: Boolean(entry.dryRun),
    wethProposed: entry.wethProposed || null,
    wethSpent: entry.wethSpent || null,
    orbitReceived: entry.orbitReceived || null,
    txHash: entry.txHash || null,
    status: entry.status || "unknown",
    proposalIssueUrl: entry.proposalIssueUrl || null,
    at: entry.executedAt || entry.approvedAt || entry.at || null
  };
}

module.exports = {
  BUYBACK_LEDGER_PATH,
  buybackIdempotencyKey,
  commentApprovesBuyback,
  deterministicMockOrbitReceived,
  executeBuyback,
  formatBuybackReceipt,
  isBuybackEnabled,
  loadBuybackLedger,
  proposeBuyback,
  saveBuybackLedger,
  syntheticDryRunTxHash,
  weekStartFromDate
};
