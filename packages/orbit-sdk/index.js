/**
 * Orbit SDK — Read-only access to Orbit's machine-readable repository state.
 *
 * Zero dependencies. Reads JSON files from a local Orbit repository checkout.
 * Every function takes an optional repoPath (defaults to cwd's parent structure).
 *
 * Companion docs:
 *   - docs/data-contract.md    — schema definitions
 *   - docs/status-query.md     — query examples (shell + Node.js)
 *   - docs/agent-passport.md   — human-readable identity
 *
 * Privacy rules enforced:
 *   - Never exposes provider names, model names, API bases, or billing routes.
 *   - Never returns private keys, seed phrases, or wallet secrets.
 *   - Read-only: no write, sign, spend, or execute operations.
 */

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// File paths relative to repo root
// ---------------------------------------------------------------------------

const FILES = {
  state:          'memory/state.json',
  passport:       'memory/passport.json',
  governance:     'memory/governance.json',
  treasury:       'memory/treasury.json',
  roadmap:        'memory/roadmap.json',
  tasks:          'memory/tasks.json',
  knowledge:      'memory/knowledge.json',
  infrastructure: 'memory/infrastructure.json',
  opportunities:  'memory/opportunities.json',
  cycles:         'memory/cycles.jsonl',
  approvals:      'memory/approvals.json',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveRepo(repoPath) {
  return repoPath || process.cwd();
}

function readJson(repoPath, relPath) {
  const full = path.join(resolveRepo(repoPath), relPath);
  const raw = fs.readFileSync(full, 'utf8');
  return JSON.parse(raw);
}

function safeReadJson(repoPath, relPath) {
  try {
    return readJson(repoPath, relPath);
  } catch (err) {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Individual file readers
// ---------------------------------------------------------------------------

/** Lifecycle state — cycle count, birth, last active, completion status. */
function readState(repoPath) {
  return readJson(repoPath, FILES.state);
}

/** Portable agent identity — capabilities, permissions, proof model, budget, token, adoption. */
function readPassport(repoPath) {
  return readJson(repoPath, FILES.passport);
}

/** Governance policy — approval model, hard rules, self-recipients. */
function readGovernance(repoPath) {
  return readJson(repoPath, FILES.governance);
}

/** Treasury — AI-call budget, ledger, revenue cadence, token state. */
function readTreasury(repoPath) {
  return readJson(repoPath, FILES.treasury);
}

/** Roadmap — levels, lanes, phases, ZK proofs, revenue model, operating rules. */
function readRoadmap(repoPath) {
  return readJson(repoPath, FILES.roadmap);
}

/** Tasks — open and completed work items. */
function readTasks(repoPath) {
  return readJson(repoPath, FILES.tasks);
}

/** Knowledge — durable facts, decisions, cycle summaries, lessons. */
function readKnowledge(repoPath) {
  return readJson(repoPath, FILES.knowledge);
}

/** Infrastructure — product registry, surfaces, capabilities, commands, access, wallet. */
function readInfrastructure(repoPath) {
  return readJson(repoPath, FILES.infrastructure);
}

/** Opportunities — survival and earning opportunities with scores. */
function readOpportunities(repoPath) {
  return readJson(repoPath, FILES.opportunities);
}

/** Approvals — pending and resolved owner approval requests. */
function readApprovals(repoPath) {
  return safeReadJson(repoPath, FILES.approvals) || { approvals: [] };
}

// ---------------------------------------------------------------------------
// Convenience queries
// ---------------------------------------------------------------------------

/**
 * Quick status summary combining state, budget, and roadmap.
 * Returns a compact object suitable for dashboards or agent context.
 */
function quickStatus(repoPath) {
  const rp = resolveRepo(repoPath);
  const state = safeReadJson(rp, FILES.state) || {};
  const treasury = safeReadJson(rp, FILES.treasury) || {};
  const roadmap = safeReadJson(rp, FILES.roadmap) || {};
  const tasks = safeReadJson(rp, FILES.tasks) || { tasks: [] };

  const now = Date.now();
  const lastActive = state.lastActive ? new Date(state.lastActive).getTime() : 0;
  const staleMinutes = lastActive ? Math.round((now - lastActive) / 60000) : null;

  const openTasks = (tasks.tasks || []).filter(t => t.status === 'open');
  const ai = treasury.ai || {};

  // Calculate lifetime and today spend from ledger
  const ledger = ai.ledger || [];
  const lifetimeSpendUsd = ledger.reduce((sum, e) => sum + (e.estimatedUsd || 0), 0);
  const todayUtc = new Date().toISOString().slice(0, 10);
  const spentTodayUsd = ledger
    .filter(e => e.timestamp && e.timestamp.startsWith(todayUtc))
    .reduce((sum, e) => sum + (e.estimatedUsd || 0), 0);

  return {
    cycle: state.cycle || 0,
    lastActive: state.lastActive || null,
    lastStatus: state.lastStatus || 'unknown',
    staleMinutes,
    currentLevel: roadmap.currentLevel ? {
      id: roadmap.currentLevel.id,
      name: roadmap.currentLevel.name,
      status: roadmap.currentLevel.status,
    } : null,
    tokenLaunchStatus: (treasury.token || {}).launchStatus || 'unknown',
    openTaskCount: openTasks.length,
    aiBudget: {
      dailyBudgetUsd: ai.dailyBudgetUsd || 0,
      monthlyBudgetUsd: ai.monthlyBudgetUsd || 0,
      lifetimeSpendUsd: Math.round(lifetimeSpendUsd * 1e6) / 1e6,
      spentTodayUsd: Math.round(spentTodayUsd * 1e6) / 1e6,
      dailyRemainingUsd: Math.round(((ai.dailyBudgetUsd || 0) - spentTodayUsd) * 1e6) / 1e6,
      canUseAi: spentTodayUsd < (ai.dailyBudgetUsd || Infinity),
    },
    revenue: treasury.revenue ? {
      cadence: treasury.revenue.cadence,
      operatorShareBps: treasury.revenue.operatorShareBps,
      treasuryShareBps: treasury.revenue.treasuryShareBps,
      lastClaimSentAt: treasury.revenue.lastClaimSentAt,
    } : null,
  };
}

/**
 * Get active capabilities from the passport.
 * Returns array of { id, name, mode, evidence }.
 */
function activeCapabilities(repoPath) {
  const passport = readPassport(repoPath);
  return (passport.capabilities || [])
    .filter(c => c.status === 'active')
    .map(c => ({ id: c.id, name: c.name, mode: c.mode, evidence: c.evidence }));
}

/**
 * Get blocked actions from the passport.
 */
function blockedActions(repoPath) {
  const passport = readPassport(repoPath);
  return passport.blockedActions || [];
}

/**
 * Check if an action category requires owner approval.
 * Returns { requiresApproval, mode, allowedWithoutApproval, hardRules }.
 */
function checkApprovalRequired(repoPath, actionCategory) {
  const gov = readGovernance(repoPath);
  const es = gov.externalSpend || {};
  const allowed = es.allowedWithoutApproval || [];
  return {
    requiresApproval: es.mode === 'owner_approval_required' && !allowed.includes(actionCategory),
    mode: es.mode || 'unknown',
    approvalIssueLabel: es.approvalIssueLabel,
    approvalAcceptedLabel: es.approvalAcceptedLabel,
    approvalCommentPrefix: es.approvalCommentPrefix,
    allowedWithoutApproval: allowed,
    hardRules: gov.hardRules || [],
  };
}

/**
 * Get open tasks, optionally filtered by priority.
 * Returns array of { id, title, priority, source, notes, createdAt }.
 */
function openTasks(repoPath, priority) {
  const tasks = readTasks(repoPath);
  let result = (tasks.tasks || []).filter(t => t.status === 'open');
  if (priority) {
    result = result.filter(t => t.priority === priority);
  }
  return result.map(t => ({
    id: t.id,
    title: t.title,
    priority: t.priority,
    source: t.source,
    notes: t.notes,
    createdAt: t.createdAt,
  }));
}

/**
 * Get budget summary with calculations.
 * Returns daily/monthly limits, lifetime spend, today spend, and remaining.
 */
function budgetSummary(repoPath) {
  const treasury = readTreasury(repoPath);
  const ai = treasury.ai || {};
  const ledger = ai.ledger || [];

  const lifetimeSpendUsd = ledger.reduce((sum, e) => sum + (e.estimatedUsd || 0), 0);
  const lifetimeTokens = ledger.reduce((sum, e) => sum + (e.totalTokens || 0), 0);
  const callCount = ledger.length;

  const todayUtc = new Date().toISOString().slice(0, 10);
  const todayEntries = ledger.filter(e => e.timestamp && e.timestamp.startsWith(todayUtc));
  const spentTodayUsd = todayEntries.reduce((sum, e) => sum + (e.estimatedUsd || 0), 0);
  const todayTokens = todayEntries.reduce((sum, e) => sum + (e.totalTokens || 0), 0);

  return {
    dailyBudgetUsd: ai.dailyBudgetUsd || 0,
    monthlyBudgetUsd: ai.monthlyBudgetUsd || 0,
    inputUsdPerMillion: ai.inputUsdPerMillion || 0,
    outputUsdPerMillion: ai.outputUsdPerMillion || 0,
    lifetimeSpendUsd: Math.round(lifetimeSpendUsd * 1e6) / 1e6,
    lifetimeTokens,
    lifetimeCalls: callCount,
    spentTodayUsd: Math.round(spentTodayUsd * 1e6) / 1e6,
    todayTokens,
    todayCalls: todayEntries.length,
    dailyRemainingUsd: Math.round(((ai.dailyBudgetUsd || 0) - spentTodayUsd) * 1e6) / 1e6,
    monthlyRemainingUsd: Math.round(((ai.monthlyBudgetUsd || 0) - lifetimeSpendUsd) * 1e6) / 1e6,
    canUseAi: spentTodayUsd < (ai.dailyBudgetUsd || Infinity),
  };
}

/**
 * Get the current revenue policy and token status.
 */
function revenueStatus(repoPath) {
  const treasury = readTreasury(repoPath);
  return {
    revenue: treasury.revenue || {},
    token: treasury.token || {},
  };
}

/**
 * Get active lanes from the roadmap.
 */
function activeLanes(repoPath) {
  const roadmap = readRoadmap(repoPath);
  return (roadmap.lanes || [])
    .filter(l => l.status === 'active')
    .map(l => ({ id: l.id, name: l.name, mission: l.mission }));
}

/**
 * Get the active phase checks from the roadmap.
 */
function activePhaseChecks(repoPath) {
  const roadmap = readRoadmap(repoPath);
  return (roadmap.phaseChecks || [])
    .filter(p => p.status === 'active')
    .map(p => ({ phaseId: p.phaseId, checks: p.checks, evidence: p.evidence }));
}

/**
 * Get knowledge entries, optionally filtered by kind or tag.
 */
function queryKnowledge(repoPath, { kind, tag, limit } = {}) {
  const knowledge = readKnowledge(repoPath);
  let entries = knowledge.entries || knowledge || [];

  if (kind) {
    entries = entries.filter(e => e.kind === kind);
  }
  if (tag) {
    entries = entries.filter(e => (e.tags || []).includes(tag));
  }
  if (limit && limit > 0) {
    entries = entries.slice(-limit);
  }

  return entries.map(e => ({
    id: e.id,
    kind: e.kind,
    title: e.title,
    content: e.content,
    tags: e.tags,
    source: e.source,
    createdAt: e.createdAt,
  }));
}

/**
 * Get the list of all machine-readable file paths and their status.
 */
function machineReadableFiles(repoPath) {
  const rp = resolveRepo(repoPath);
  const result = {};
  for (const [key, relPath] of Object.entries(FILES)) {
    const full = path.join(rp, relPath);
    let exists = false;
    let sizeBytes = 0;
    try {
      const stat = fs.statSync(full);
      exists = stat.isFile();
      sizeBytes = stat.size;
    } catch (_) {
      // file doesn't exist
    }
    result[key] = { path: relPath, exists, sizeBytes };
  }
  return result;
}

/**
 * Scan the approval queue for pending items.
 */
function pendingApprovals(repoPath) {
  const approvals = readApprovals(repoPath);
  const list = approvals.approvals || [];
  return list.filter(a => a.status === 'pending');
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  // File path map
  FILES,

  // Individual file readers
  readState,
  readPassport,
  readGovernance,
  readTreasury,
  readRoadmap,
  readTasks,
  readKnowledge,
  readInfrastructure,
  readOpportunities,
  readApprovals,

  // Convenience queries
  quickStatus,
  activeCapabilities,
  blockedActions,
  checkApprovalRequired,
  openTasks,
  budgetSummary,
  revenueStatus,
  activeLanes,
  activePhaseChecks,
  queryKnowledge,
  machineReadableFiles,
  pendingApprovals,

  // Helpers
  readJson,
  safeReadJson,
  resolveRepo,
};
