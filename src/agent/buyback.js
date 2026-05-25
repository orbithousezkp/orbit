"use strict";

// S-BUY-1: Intelligent buyback campaign.
//
// A weekly buyback is no longer ONE swap. It is a CAMPAIGN of N small,
// randomized sub-buys spread over a 48-hour window after the owner approves
// the proposal. Each sub-buy is sized so it stays below a price-impact ceiling
// (default 0.5% / 50 bps), and times are randomized to defeat snipers who
// would otherwise front-run a predictable weekly buy.
//
// Module ownership:
//   - buyback-planner.js owns AMOUNTS (pool read + price-impact + split).
//   - buyback-scheduler.js owns TIMES (randomized schedule, "what's due now?").
//   - this module composes the two and handles approval gating, treasury
//     floor, fee-floor (S-FLOOR-1), and ledger/state persistence.
//
// Per-cycle invariant: at most ONE sub-buy fires per cycle. Even if two
// scheduled times have elapsed since the last cycle, we fire the earlier one
// and let the next cycle pick up the second. This keeps the random-spread
// property — bunching N buys in one cycle defeats the purpose.

const crypto = require("crypto");
const buybackPlanner = require("./buyback-planner");
const buybackScheduler = require("./buyback-scheduler");
const { isAddress } = require("./addresses");
const { assertTreasuryFloor } = require("./governance");
const safes = require("./safes");
const {
  assertSafePublicReply,
  readSafeTextFile,
  writeSafeTextFile
} = require("./safety");

// fee-floor is built by a parallel agent. Import defensively: if the module
// is somehow absent at load time we fall back to a no-op gate that always
// reports "met" so we don't fault-block the existing flow during partial
// deploys. Production wiring will always have the module.
let feeFloor;
try {
  // eslint-disable-next-line global-require
  feeFloor = require("./fee-floor");
} catch {
  feeFloor = {
    loadConfig() { return { floorWei: 0n, day: 0, hour: 0 }; },
    evaluateGate() { return { met: true, weekInflowWei: "0", floorWei: "0", reason: "fee_floor_module_missing" }; },
    weekInflowSince() { return 0n; },
    defaultState() { return { weekStartedAt: null, weekStartBalanceWei: "0", lastWeekBoundaryAt: null }; },
    isAtOrPastWeekBoundary() { return false; },
    startWeek(state) { return state; }
  };
}

const BUYBACK_LEDGER_PATH = "memory/buybacks.json";
const CAMPAIGN_STATE_PATH = "memory/buyback-campaign.json";
const DEFAULT_PAIRED_WETH = "0x4200000000000000000000000000000000000006";
const WETH_AMOUNT_PATTERN = /^\d+(\.\d{1,4})?$/;
const MAX_SLIPPAGE_OVERRIDE_BPS = 500;

// Locked defaults (S-BUY-1 — see task spec).
const DEFAULT_MAX_IMPACT_BPS = 50;        // 0.5%
const DEFAULT_SCHEDULE_WINDOW_HOURS = 48;
const DEFAULT_MIN_SUB_BUYS = 3;
const DEFAULT_MAX_SUB_BUYS = 10;

function parsePositiveInt(value, fallback) {
  if (value === undefined || value === null || String(value).trim() === "") return fallback;
  const n = Number.parseInt(String(value).trim(), 10);
  if (!Number.isInteger(n) || n <= 0) return fallback;
  return n;
}

function campaignOptsFromEnv(env) {
  const e = env || {};
  return {
    maxImpactBps: parsePositiveInt(e.ORBIT_BUYBACK_MAX_PRICE_IMPACT_BPS, DEFAULT_MAX_IMPACT_BPS),
    windowHours: parsePositiveInt(e.ORBIT_BUYBACK_SCHEDULE_WINDOW_HOURS, DEFAULT_SCHEDULE_WINDOW_HOURS),
    minSubBuys: parsePositiveInt(e.ORBIT_BUYBACK_MIN_SUB_BUYS, DEFAULT_MIN_SUB_BUYS),
    maxSubBuys: parsePositiveInt(e.ORBIT_BUYBACK_MAX_SUB_BUYS, DEFAULT_MAX_SUB_BUYS)
  };
}

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

function weiToWethString(wei) {
  const value = typeof wei === "bigint" ? wei : BigInt(wei || 0);
  const whole = value / 10n ** 18n;
  const frac = value % 10n ** 18n;
  const fracStr = frac.toString().padStart(18, "0").slice(0, 6).replace(/0+$/, "");
  return fracStr ? `${whole}.${fracStr}` : `${whole}`;
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

// --- campaign state helpers ----------------------------------------------
//
// Campaign state (the active randomized schedule + history of completed
// campaigns) lives in memory/buyback-campaign.json — a separate file from
// memory/buybacks.json (the proposal ledger).
//
// Design note: the task spec describes a `state.buyback` shape in state.json.
// We track the same logical shape here but in a dedicated file because
// state.json is owned by run.js's in-memory copy and would clobber our
// disk writes at end of cycle. A separate file also matches the existing
// pattern (memory/buybacks.json, memory/approvals.json) and means the
// state-write guards in run.js do not need to learn about buyback campaigns.
// Defensive default reads still tolerate a state.buyback field if a future
// run.js merge wires it in — see defaultBuybackState().

function defaultBuybackState() {
  return { activeCampaign: null, history: [] };
}

function loadCampaignState(repoRoot) {
  try {
    const parsed = JSON.parse(readSafeTextFile(repoRoot, CAMPAIGN_STATE_PATH));
    return {
      activeCampaign: parsed && parsed.activeCampaign ? parsed.activeCampaign : null,
      history: parsed && Array.isArray(parsed.history) ? parsed.history : []
    };
  } catch {
    return defaultBuybackState();
  }
}

function saveCampaignState(repoRoot, campaignState) {
  const value = {
    activeCampaign: campaignState && campaignState.activeCampaign ? campaignState.activeCampaign : null,
    history: campaignState && Array.isArray(campaignState.history) ? campaignState.history : []
  };
  writeSafeTextFile(
    repoRoot,
    CAMPAIGN_STATE_PATH,
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

// --- fee-floor gate helper -----------------------------------------------
//
// Evaluates the S-FLOOR-1 weekly fee-floor gate. Returns { met, reason,
// floorWei, weekInflowWei, detail }. Reads the current Fee Receive Safe
// balance from params.feeReceiveBalanceWei when provided (tests + future
// chain-read), otherwise from state.treasurySweep.lastObservedFeeReceiveBalanceWei
// (the treasury-sweep module persists the latest observation there).
function evaluateFeeFloor(state, params, env) {
  if (!feeFloor || typeof feeFloor.evaluateGate !== "function") {
    return { met: true, reason: "fee_floor_module_missing" };
  }
  const cfg = feeFloor.loadConfig(env || process.env);
  let observed = params && params.feeReceiveBalanceWei;
  if (observed === undefined || observed === null) {
    observed = state
      && state.treasurySweep
      && state.treasurySweep.lastObservedFeeReceiveBalanceWei;
  }
  if (observed === undefined || observed === null || String(observed) === "") {
    // No observation — treat as "not yet observed". The treasury-sweep
    // module is the authoritative observer; until it has run, we cannot
    // judge inflow. Fail-CLOSED: surface as not-met with a clear reason so
    // an operator notices.
    return {
      met: false,
      reason: "no_safe_balance_observation",
      floorWei: cfg.floorWei.toString(),
      weekInflowWei: "0"
    };
  }
  let inflow;
  try {
    inflow = feeFloor.weekInflowSince(state || {}, observed);
  } catch (err) {
    return {
      met: false,
      reason: "fee_floor_read_failed",
      detail: err && err.message ? err.message : String(err),
      floorWei: cfg.floorWei.toString(),
      weekInflowWei: "0"
    };
  }
  return feeFloor.evaluateGate(inflow, cfg);
}

// --- approval issue body -------------------------------------------------

function buybackSafeAddress(env) {
  // Source of truth for the Buyback Safe address per D-019. Returns null when
  // missing or invalid; callers decide whether to surface that to the owner.
  return safes.addressOf(env || process.env, "buyback");
}

function buybackApprovalIssueBody({
  idem,
  wethAmount,
  rationale,
  weekStart,
  cycle,
  dryRun,
  pairedToken,
  tokenAddress,
  buybackSafe,
  campaignPlan
}) {
  const lines = [
    "Orbit is requesting public owner approval for a SPLIT, RANDOMIZED $ORBIT buyback campaign.",
    "",
    `Idempotency key: \`${idem}\``,
    `Cycle: \`${cycle}\``,
    `Week start (UTC Monday): \`${weekStart}\``,
    `Total budget: \`${wethAmount} WETH\``,
    `Paired token (WETH on Base): \`${pairedToken}\``,
    `$ORBIT token address: \`${tokenAddress}\``,
    `Mode: \`${dryRun ? "DRY_RUN" : "LIVE"}\``
  ];
  if (buybackSafe) {
    lines.push(`Buyback Safe (D-019 destination): \`${buybackSafe}\``);
  }
  lines.push("");
  lines.push("Campaign plan:");
  if (campaignPlan && campaignPlan.ok) {
    lines.push(`- ${campaignPlan.subBuys.length} sub-buys (split to limit price impact)`);
    lines.push(`- Max impact per sub-buy: ${campaignPlan.maxImpactBps} bps (${(Number(campaignPlan.maxImpactBps) / 100).toFixed(2)}%)`);
    lines.push(`- Execution window: ${campaignPlan.windowHours}-hour window after approval`);
    lines.push(`- Schedule: randomized — generated and persisted AFTER owner approval`);
    lines.push(`- Sub-buy sizes (WETH): ${campaignPlan.subBuys.map((wei) => weiToWethString(wei)).join(", ")}`);
  } else {
    lines.push(`- pool plan unavailable: ${campaignPlan && campaignPlan.reason ? campaignPlan.reason : "unknown"}`);
  }
  lines.push(
    "",
    `Rationale: ${rationale}`,
    "",
    "Per D-005 and D-014, no on-chain swap will happen until the owner approves this issue.",
    "Per D-018, the agent will additionally refuse if the pre-launch gate has not been verified.",
    "Per S-FLOOR-1, the agent will additionally refuse if the weekly fee-inflow floor is not met.",
    "",
    "To approve, the configured owner must add this exact standalone comment:",
    "",
    `\`APPROVE ORBIT-BUYBACK ${idem}\``,
    "",
    "To reject, the configured owner must add this exact standalone comment:",
    "",
    `\`REJECT ORBIT-BUYBACK ${idem}\``
  );
  return lines.join("\n");
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

  // Fail-closed env resolution: if the caller supplies context.env, use it
  // verbatim; only fall back to process.env when env is absent. This lets
  // tests and programmatic callers inject without mutating global state.
  const env = context && Object.prototype.hasOwnProperty.call(context, "env")
    ? context.env
    : process.env;

  // S-FLOOR-1: gate the proposal on the weekly fee-floor. If the floor is
  // not met we DO NOT create an approval issue — there is no point asking
  // the owner to approve a campaign that the floor will block at execute
  // time anyway. The buyback simply doesn't happen this week.
  const floorGate = evaluateFeeFloor(state, params, env);
  if (!floorGate.met) {
    return {
      ok: false,
      blocked: true,
      status: "blocked",
      reason: "fee_floor_not_met",
      feeFloor: floorGate
    };
  }

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

  // Plan the campaign. The pool read is best-effort: if it fails (no pool
  // info, no RPC, V3 not implemented), we fall back to a flat split based on
  // the configured min/max sub-buy bounds so the operator still sees a
  // sensible plan in the issue body. The actual sub-buy sizing for execution
  // will re-plan against fresh reserves at first execute() call.
  const opts = campaignOptsFromEnv(env);
  const totalBudgetWei = wethAmountToWei(wethAmount.string) || 0n;

  // Pull treasury for pool info. If unavailable (test paths often don't
  // write treasury.json), surface a planning fallback rather than failing.
  let treasuryRecord = {};
  try {
    treasuryRecord = JSON.parse(readSafeTextFile(config.repoRoot, "memory/treasury.json"));
  } catch {
    treasuryRecord = {};
  }
  let poolState = { ok: false, reason: "not_attempted" };
  try {
    poolState = await buybackPlanner.readPoolState(treasuryRecord, env);
  } catch (err) {
    poolState = { ok: false, reason: "read_pool_state_threw", detail: err && err.message };
  }

  let campaignPlan;
  if (poolState.ok) {
    campaignPlan = buybackPlanner.planSubBuys(totalBudgetWei, poolState.reserveWethWei, {
      maxImpactBps: opts.maxImpactBps,
      minSubBuys: opts.minSubBuys,
      maxSubBuys: opts.maxSubBuys
    });
  } else {
    // Fallback: split into minSubBuys evenly so the approval body still
    // describes a real campaign shape. The execute() path will re-plan against
    // live reserves if available.
    campaignPlan = fallbackPlan(totalBudgetWei, opts);
    campaignPlan.fallbackReason = poolState.reason;
  }
  // Decorate plan with the options the body needs to render.
  campaignPlan.maxImpactBps = opts.maxImpactBps;
  campaignPlan.windowHours = opts.windowHours;

  const title = `[orbit buyback campaign] ${wethAmount.string} WETH split ${dryRun ? "(DRY_RUN)" : ""}`.trim();
  const buybackSafe = buybackSafeAddress(env);
  const body = buybackApprovalIssueBody({
    idem,
    wethAmount: wethAmount.string,
    rationale,
    weekStart,
    cycle,
    dryRun,
    pairedToken,
    tokenAddress,
    buybackSafe,
    campaignPlan
  });
  assertSafePublicReply(`${title}\n${body}`);

  let proposalIssueUrl = null;
  let proposalIssueNumber = null;
  const github = context && context.github;
  if (github && typeof github.createIssue === "function") {
    const labels = [
      buyback.approvalIssueLabel || config.approvalIssueLabel || "orbit:approval",
      "orbit:buyback",
      "buyback-campaign"
    ].filter(Boolean);
    const issue = await github.createIssue({ title, body, labels });
    if (issue) {
      proposalIssueUrl = issue.html_url || issue.url || null;
      proposalIssueNumber = issue.number || null;
    }
  }

  const now = new Date().toISOString();
  const plannedSubBuyAmountsWei = campaignPlan.ok && Array.isArray(campaignPlan.subBuys)
    ? campaignPlan.subBuys.map((wei) => wei.toString())
    : [];
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
    plannedSubBuyAmountsWei,
    plannedSubBuyCount: plannedSubBuyAmountsWei.length,
    plannedMaxImpactBps: opts.maxImpactBps,
    plannedWindowHours: opts.windowHours,
    poolPlanOk: Boolean(campaignPlan && campaignPlan.ok),
    poolPlanReason: campaignPlan && campaignPlan.fallbackReason ? campaignPlan.fallbackReason : null,
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

// Fallback planner used when pool state is unavailable. Splits the budget
// across minSubBuys evenly with the remainder on the first sub-buy. We do not
// try to estimate impact here because we have no reserves to compare against.
function fallbackPlan(totalBudgetWei, opts) {
  const total = BigInt(totalBudgetWei);
  if (total <= 0n) return { ok: false, reason: "total_budget_non_positive" };
  const n = Math.max(1, Number(opts.minSubBuys || DEFAULT_MIN_SUB_BUYS));
  const nBig = BigInt(n);
  const base = total / nBig;
  const remainder = total - base * nBig;
  const subBuys = new Array(n);
  for (let i = 0; i < n; i += 1) subBuys[i] = base;
  subBuys[0] = subBuys[0] + remainder;
  return {
    ok: true,
    subBuys,
    safeSingleBuySize: subBuys[0],
    plannedImpactBps: 0n,
    fallback: true
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

function syntheticDryRunTxHash(idem, suffix) {
  // 32 bytes hex = 64 chars after 0x; keep it visibly fake by starting with "dry"
  // and padding to 64 chars using the idem + optional suffix (per-sub-buy index
  // so each sub-buy has a distinct synthetic hash).
  const tag = "dry";
  const padded = `${tag}${idem}${suffix || ""}`.padEnd(64, "0").slice(0, 64);
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

// Build the active campaign object the first time we see an approved
// proposal. Pulls fresh plan amounts when possible (so reserves at execute
// time, not propose time, drive the split), falls back to ledger amounts.
async function buildActiveCampaign({ config, entry, env, nowDate, params }) {
  const opts = campaignOptsFromEnv(env);
  const totalBudgetWei = wethAmountToWei(entry.wethProposed) || 0n;

  let treasuryRecord = {};
  try {
    treasuryRecord = JSON.parse(readSafeTextFile(config.repoRoot, "memory/treasury.json"));
  } catch {
    treasuryRecord = {};
  }
  let poolState;
  try {
    poolState = await buybackPlanner.readPoolState(treasuryRecord, env);
  } catch (err) {
    poolState = { ok: false, reason: "read_pool_state_threw", detail: err && err.message };
  }

  let plan;
  if (poolState.ok) {
    plan = buybackPlanner.planSubBuys(totalBudgetWei, poolState.reserveWethWei, {
      maxImpactBps: opts.maxImpactBps,
      minSubBuys: opts.minSubBuys,
      maxSubBuys: opts.maxSubBuys
    });
  } else if (Array.isArray(entry.plannedSubBuyAmountsWei) && entry.plannedSubBuyAmountsWei.length > 0) {
    // Reuse the propose-time plan stashed in the ledger entry.
    plan = {
      ok: true,
      subBuys: entry.plannedSubBuyAmountsWei.map((s) => BigInt(s)),
      safeSingleBuySize: 0n,
      plannedImpactBps: 0n,
      fallback: true
    };
  } else {
    plan = fallbackPlan(totalBudgetWei, opts);
  }
  if (!plan.ok) return { ok: false, reason: plan.reason || "plan_failed" };

  // Allow tests to inject a deterministic rng via params.scheduleRng.
  const rng = params && typeof params.scheduleRng === "function" ? params.scheduleRng : null;
  const approvedAt = nowDate instanceof Date ? nowDate : new Date(nowDate || Date.now());
  const times = buybackScheduler.generateSchedule(
    approvedAt,
    opts.windowHours,
    plan.subBuys.length,
    rng
  );
  const subBuys = plan.subBuys.map((amountWei, i) => ({
    scheduledAt: times[i],
    amountWei: amountWei.toString(),
    status: "pending"
  }));
  return {
    ok: true,
    campaign: {
      idem: entry.idem,
      approvalIssueNumber: entry.proposalIssueNumber || null,
      approvalIssueUrl: entry.proposalIssueUrl || null,
      approvedAt: approvedAt.toISOString(),
      totalBudgetWei: totalBudgetWei.toString(),
      maxImpactBps: opts.maxImpactBps,
      windowHours: opts.windowHours,
      subBuys
    }
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
  if (!entry.approvedAt) entry.approvedAt = new Date().toISOString();

  const env = context && Object.prototype.hasOwnProperty.call(context, "env")
    ? context.env
    : process.env;

  // S-FLOOR-1 gate (also enforced at propose time, re-checked here in case
  // the floor flipped between propose and execute).
  const floorGate = evaluateFeeFloor(state, params, env);
  if (!floorGate.met) {
    entry.status = "blocked_fee_floor";
    entry.feeFloorDecision = floorGate;
    entry.lastCheckedAt = new Date().toISOString();
    saveBuybackLedger(config.repoRoot, ledger);
    return {
      ok: false,
      blocked: true,
      reason: "fee_floor_not_met",
      feeFloor: floorGate,
      status: "blocked_fee_floor",
      dryRun
    };
  }

  // T-1: treasury-floor guard. Belt-and-braces over the approval gate — even
  // an approved buyback is rejected if the planned WETH spend would breach
  // the operator-configured per-cycle cap or post-spend floor. We use the
  // NEXT sub-buy amount (not the full campaign budget) because each sub-buy
  // is an independent on-chain swap.
  const campaignState = loadCampaignState(config.repoRoot);
  const stateCampaign = (state && state.buyback && state.buyback.activeCampaign) || null;
  let activeCampaign = campaignState.activeCampaign
    || stateCampaign
    || null;

  // First call after approval: generate the randomized schedule.
  if (!activeCampaign || activeCampaign.idem !== entry.idem) {
    // approvedAt is when the owner actually approved, NOT params.now. Using
    // params.now would let a forward-jumped `now` (e.g., in tests or after a
    // long downtime) collapse the entire 48-hour window into the past on
    // first build. Use entry.approvedAt set above.
    const approvedAt = entry.approvedAt ? new Date(entry.approvedAt) : new Date();
    const built = await buildActiveCampaign({
      config,
      entry,
      env,
      nowDate: approvedAt,
      params
    });
    if (!built.ok) {
      return {
        ok: false,
        blocked: true,
        reason: built.reason || "build_campaign_failed",
        status: "blocked_plan_failed",
        dryRun
      };
    }
    activeCampaign = built.campaign;
    campaignState.activeCampaign = activeCampaign;
    saveCampaignState(config.repoRoot, campaignState);
  }

  // Find the next due sub-buy. One per cycle, even if multiple times elapsed.
  const due = buybackScheduler.nextDueSubBuy(activeCampaign, params.now || new Date());
  if (!due) {
    saveBuybackLedger(config.repoRoot, ledger);
    return {
      ok: true,
      dryRun,
      status: "no_sub_buy_due",
      blocked: false,
      idem: entry.idem,
      campaign: summarizeCampaign(activeCampaign),
      slippageBps
    };
  }

  // Treasury-floor check on THIS sub-buy's amount.
  const subBuyAmountWei = BigInt(due.subBuy.amountWei || "0");
  if (subBuyAmountWei > 0n) {
    const floorDecision = assertTreasuryFloor({
      state: state || {},
      config,
      amountWei: subBuyAmountWei.toString(),
      actionType: "buyback",
      actionLabel: `sub-buy ${due.index + 1}/${activeCampaign.subBuys.length} of ${entry.idem}`
    });
    if (!floorDecision.ok) {
      buybackScheduler.applyResult(activeCampaign, due.index, {
        ok: false,
        error: floorDecision.reason
      });
      campaignState.activeCampaign = activeCampaign;
      saveCampaignState(config.repoRoot, campaignState);
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
    const txHash = syntheticDryRunTxHash(entry.idem, String(due.index));
    const wethSpentString = weiToWethString(subBuyAmountWei);
    const orbitReceived = deterministicMockOrbitReceived(wethSpentString, entry.idem + "-" + due.index);
    buybackScheduler.applyResult(activeCampaign, due.index, {
      ok: true,
      txHash,
      orbitReceived,
      wethSpent: wethSpentString
    });

    // Archive the campaign when complete.
    let archived = false;
    if (buybackScheduler.isCampaignComplete(activeCampaign)) {
      campaignState.history = Array.isArray(campaignState.history) ? campaignState.history : [];
      campaignState.history.push({
        ...activeCampaign,
        archivedAt: new Date().toISOString()
      });
      campaignState.activeCampaign = null;
      archived = true;

      // Reflect terminal state on the ledger entry.
      entry.status = "executed_dry";
      entry.txHash = txHash;
      entry.wethSpent = entry.wethProposed;
      entry.orbitReceived = sumStringDecimals(activeCampaign.subBuys.map((sb) => sb.orbitReceived || "0"));
      entry.executedAt = new Date().toISOString();
    } else {
      campaignState.activeCampaign = activeCampaign;
      entry.status = "executing";
      entry.lastSubBuyAt = new Date().toISOString();
    }
    saveCampaignState(config.repoRoot, campaignState);
    saveBuybackLedger(config.repoRoot, ledger);

    return {
      ok: true,
      dryRun: true,
      txHash,
      wethSpent: wethSpentString,
      orbitReceived,
      slippageBps,
      idem: entry.idem,
      status: archived ? "executed_dry" : "sub_buy_executed_dry",
      subBuyIndex: due.index,
      subBuyCount: activeCampaign.subBuys.length,
      campaign: summarizeCampaign(activeCampaign)
    };
  }

  // Live path: deliberately not implemented yet — viem wallet client wiring is
  // tracked in src/agent/wallet.js. Until that helper exists, refuse to send
  // a real transaction so we cannot accidentally bypass the gate. This is the
  // D-018 belt-and-braces: even if every prior check is somehow bypassed, the
  // live router call is gated behind a missing helper.
  entry.status = "blocked_live_unavailable";
  saveBuybackLedger(config.repoRoot, ledger);
  return {
    ok: false,
    blocked: true,
    dryRun: false,
    reason: "live buyback execution is not wired; refusing to send a real transaction",
    status: "blocked_live_unavailable"
  };
}

function sumStringDecimals(values) {
  let total = 0;
  for (const v of values) {
    const n = Number.parseFloat(v || "0");
    if (Number.isFinite(n)) total += n;
  }
  return total.toFixed(6);
}

function summarizeCampaign(campaign) {
  if (!campaign || !Array.isArray(campaign.subBuys)) return null;
  return {
    idem: campaign.idem || null,
    subBuyCount: campaign.subBuys.length,
    completedCount: campaign.subBuys.filter((sb) => sb && sb.status === "completed").length,
    failedCount: campaign.subBuys.filter((sb) => sb && sb.status === "failed").length,
    pendingCount: campaign.subBuys.filter((sb) => sb && sb.status === "pending").length,
    approvedAt: campaign.approvedAt || null
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
  CAMPAIGN_STATE_PATH,
  buybackIdempotencyKey,
  buybackSafeAddress,
  campaignOptsFromEnv,
  commentApprovesBuyback,
  defaultBuybackState,
  deterministicMockOrbitReceived,
  evaluateFeeFloor,
  executeBuyback,
  formatBuybackReceipt,
  isBuybackEnabled,
  loadBuybackLedger,
  loadCampaignState,
  proposeBuyback,
  saveBuybackLedger,
  saveCampaignState,
  syntheticDryRunTxHash,
  weekStartFromDate,
  weiToWethString
};
