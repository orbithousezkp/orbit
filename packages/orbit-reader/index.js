'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Orbit Reader — programmatic access to Orbit's machine-readable state files.
 *
 * Every function reads one file from the repository and returns parsed JSON
 * (or a parsed representation for line-delimited formats). The repo root is
 * detected automatically or passed explicitly.
 *
 * Companion docs:
 *   - docs/data-contract.md   — file schemas, field types, privacy rules
 *   - docs/status-query.md    — shell and Node.js query examples
 *   - memory/passport.json    — agent identity, capabilities, adoption checklist
 *
 * Privacy rule: this reader exposes only what the files contain. It never
 * reveals provider names, model names, API bases, billing routes, private
 * keys, or wallet secrets.
 *
 * @module @orbit/reader
 */

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Resolve the repository root. Uses an explicit override, the ORBIT_REPO_ROOT
 * environment variable, or walks up from __dirname to find memory/state.json.
 */
function resolveRepoRoot(override) {
  if (override) return override;
  if (process.env.ORBIT_REPO_ROOT) return process.env.ORBIT_REPO_ROOT;

  let dir = __dirname;
  for (let i = 0; i < 10; i++) {
    if (fs.existsSync(path.join(dir, 'memory', 'state.json'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  // Fallback: two levels up from packages/orbit-reader/
  return path.resolve(__dirname, '..', '..');
}

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

function safeReadJson(filePath) {
  try {
    return readJson(filePath);
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

// ─── Core Readers ───────────────────────────────────────────────────────────

/**
 * Lifecycle state — cycle count, birth date, last-active timestamp.
 * @param {string} [repoRoot]
 * @returns {{ cycle: number, born: string, lastActive: string, lastStatus: string, firstWakeIntroComplete: boolean } | null}
 */
function readState(repoRoot) {
  return safeReadJson(path.join(resolveRepoRoot(repoRoot), 'memory', 'state.json'));
}

/**
 * Agent passport — identity, capabilities, blocked actions, permission model,
 * proof model, budget, token, adoption checklist, and machine-readable files.
 * @param {string} [repoRoot]
 * @returns {object | null}
 */
function readPassport(repoRoot) {
  return safeReadJson(path.join(resolveRepoRoot(repoRoot), 'memory', 'passport.json'));
}

/**
 * Governance policy — approval model, hard rules, self-recipients.
 * @param {string} [repoRoot]
 * @returns {{ ownerUsername: string, policyVersion: number, externalSpend: object, selfRecipients: object, hardRules: string[] } | null}
 */
function readGovernance(repoRoot) {
  return safeReadJson(path.join(resolveRepoRoot(repoRoot), 'memory', 'governance.json'));
}

/**
 * Treasury — AI-call budget, spend ledger, revenue cadence, token state.
 * @param {string} [repoRoot]
 * @returns {{ ai: object, revenue: object, token: object } | null}
 */
function readTreasury(repoRoot) {
  return safeReadJson(path.join(resolveRepoRoot(repoRoot), 'memory', 'treasury.json'));
}

/**
 * Roadmap — levels, lanes, phase checks, ZK proof plan, weekly revenue model.
 * @param {string} [repoRoot]
 * @returns {object | null}
 */
function readRoadmap(repoRoot) {
  return safeReadJson(path.join(resolveRepoRoot(repoRoot), 'memory', 'roadmap.json'));
}

/**
 * Tasks — open and completed work items.
 * @param {string} [repoRoot]
 * @returns {{ tasks: Array<{ id: string, title: string, priority: string, status: string, source: string, notes: string, createdAt: string, completedAt: string | null, outcome: string | null }> } | null}
 */
function readTasks(repoRoot) {
  return safeReadJson(path.join(resolveRepoRoot(repoRoot), 'memory', 'tasks.json'));
}

/**
 * Knowledge — durable facts, decisions, lessons, cycle summaries.
 * @param {string} [repoRoot]
 * @returns {{ entries: Array<{ id: string, kind: string, title: string, content: string, tags: string[], source: string, createdAt: string }> } | null}
 */
function readKnowledge(repoRoot) {
  return safeReadJson(path.join(resolveRepoRoot(repoRoot), 'memory', 'knowledge.json'));
}

/**
 * Infrastructure registry — product, surfaces, capabilities, commands, wallet.
 * @param {string} [repoRoot]
 * @returns {object | null}
 */
function readInfrastructure(repoRoot) {
  return safeReadJson(path.join(resolveRepoRoot(repoRoot), 'memory', 'infrastructure.json'));
}

/**
 * Survival and earning opportunities — scored by fit, risk, and reward.
 * @param {string} [repoRoot]
 * @returns {object | null}
 */
function readOpportunities(repoRoot) {
  return safeReadJson(path.join(resolveRepoRoot(repoRoot), 'memory', 'opportunities.json'));
}

/**
 * Cycle proof metadata — JSONL records of every completed cycle.
 * Each line is a JSON object with cycle number, timestamp, files changed, etc.
 * @param {string} [repoRoot]
 * @returns {Array<object>}
 */
function readCycleProofs(repoRoot) {
  const filePath = path.join(resolveRepoRoot(repoRoot), 'memory', 'cycles.jsonl');
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return raw
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

// ─── Convenience Queries ────────────────────────────────────────────────────

/**
 * Quick status summary — the most common "is Orbit alive?" check.
 * @param {string} [repoRoot]
 * @returns {{ cycle: number, lastActive: string, lastStatus: string, ageMinutes: number | null, isStale: boolean } | null}
 */
function quickStatus(repoRoot) {
  const state = readState(repoRoot);
  if (!state) return null;

  const lastActive = new Date(state.lastActive);
  const ageMs = Date.now() - lastActive.getTime();
  const ageMinutes = Math.round(ageMs / 60000);
  const heartbeatMinutes = 30;

  return {
    cycle: state.cycle,
    lastActive: state.lastActive,
    lastStatus: state.lastStatus,
    ageMinutes,
    isStale: ageMinutes > heartbeatMinutes * 2,
  };
}

/**
 * Open tasks only.
 * @param {string} [repoRoot]
 * @returns {Array<object>}
 */
function openTasks(repoRoot) {
  const data = readTasks(repoRoot);
  if (!data || !data.tasks) return [];
  return data.tasks.filter((t) => t.status === 'open');
}

/**
 * Active capabilities from the passport.
 * @param {string} [repoRoot]
 * @returns {Array<{ id: string, name: string, mode: string }>}
 */
function activeCapabilities(repoRoot) {
  const passport = readPassport(repoRoot);
  if (!passport || !passport.capabilities) return [];
  return passport.capabilities
    .filter((c) => c.status === 'active')
    .map((c) => ({ id: c.id, name: c.name, mode: c.mode }));
}

/**
 * Current roadmap level summary.
 * @param {string} [repoRoot]
 * @returns {{ id: string, name: string, status: string, goal: string } | null}
 */
function currentLevel(repoRoot) {
  const roadmap = readRoadmap(repoRoot);
  if (!roadmap || !roadmap.currentLevel) return null;
  const { id, name, status, goal } = roadmap.currentLevel;
  return { id, name, status, goal };
}

/**
 * AI budget summary — daily limit, monthly limit, lifetime spend, remaining.
 * @param {string} [repoRoot]
 * @returns {{ dailyBudgetUsd: number, monthlyBudgetUsd: number, lifetimeSpendUsd: number, dailyRemainingUsd: number, monthlyRemainingUsd: number } | null}
 */
function budgetSummary(repoRoot) {
  const treasury = readTreasury(repoRoot);
  if (!treasury || !treasury.ai) return null;

  const { dailyBudgetUsd, monthlyBudgetUsd } = treasury.ai;
  const ledger = treasury.ai.ledger || [];

  const lifetimeSpendUsd = ledger.reduce((sum, e) => sum + (e.estimatedUsd || 0), 0);

  const today = new Date().toISOString().slice(0, 10);
  const todaySpend = ledger
    .filter((e) => e.timestamp && e.timestamp.startsWith(today))
    .reduce((sum, e) => sum + (e.estimatedUsd || 0), 0);

  // Approximate monthly spend (last 30 days of ledger)
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString();
  const monthSpend = ledger
    .filter((e) => e.timestamp && e.timestamp >= monthAgo)
    .reduce((sum, e) => sum + (e.estimatedUsd || 0), 0);

  return {
    dailyBudgetUsd,
    monthlyBudgetUsd,
    lifetimeSpendUsd: Math.round(lifetimeSpendUsd * 1e6) / 1e6,
    dailyRemainingUsd: Math.round((dailyBudgetUsd - todaySpend) * 1e6) / 1e6,
    monthlyRemainingUsd: Math.round((monthlyBudgetUsd - monthSpend) * 1e6) / 1e6,
  };
}

/**
 * Blocked live actions — what Orbit refuses to do without approval.
 * @param {string} [repoRoot]
 * @returns {string[]}
 */
function blockedActions(repoRoot) {
  const passport = readPassport(repoRoot);
  if (passport && passport.blockedActions) return passport.blockedActions;

  const infra = readInfrastructure(repoRoot);
  if (infra && infra.walletBlockedLiveActions) return infra.walletBlockedLiveActions;

  return [];
}

/**
 * Latest cycle proof (the most recent entry in cycles.jsonl).
 * @param {string} [repoRoot]
 * @returns {object | null}
 */
function latestProof(repoRoot) {
  const proofs = readCycleProofs(repoRoot);
  return proofs.length > 0 ? proofs[proofs.length - 1] : null;
}

// ─── Full State Dump ────────────────────────────────────────────────────────

/**
 * Read all machine-readable files at once. Returns an object keyed by file name.
 * Missing files are set to null rather than throwing.
 * @param {string} [repoRoot]
 * @returns {object}
 */
function readAll(repoRoot) {
  return {
    state: readState(repoRoot),
    passport: readPassport(repoRoot),
    governance: readGovernance(repoRoot),
    treasury: readTreasury(repoRoot),
    roadmap: readRoadmap(repoRoot),
    tasks: readTasks(repoRoot),
    knowledge: readKnowledge(repoRoot),
    infrastructure: readInfrastructure(repoRoot),
    opportunities: readOpportunities(repoRoot),
    cycleProofs: readCycleProofs(repoRoot),
  };
}

// ─── Exports ────────────────────────────────────────────────────────────────

module.exports = {
  // Core readers
  readState,
  readPassport,
  readGovernance,
  readTreasury,
  readRoadmap,
  readTasks,
  readKnowledge,
  readInfrastructure,
  readOpportunities,
  readCycleProofs,

  // Convenience queries
  quickStatus,
  openTasks,
  activeCapabilities,
  currentLevel,
  budgetSummary,
  blockedActions,
  latestProof,

  // Full dump
  readAll,

  // Helpers (exposed for testing)
  resolveRepoRoot,
};
