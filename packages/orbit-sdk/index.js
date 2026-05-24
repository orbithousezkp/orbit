/**
 * Orbit SDK — Read Orbit's machine-readable state files programmatically.
 *
 * Zero-dependency. Works inside a cloned Orbit repo or any repo that
 * follows the Orbit data contract (see docs/data-contract.md).
 *
 * Usage:
 *   const orbit = require('@orbit-house/orbit-sdk');
 *   const sdk = orbit.create('/path/to/orbit-repo');
 *   const status = sdk.quickStatus();
 *   const passport = sdk.getPassport();
 */

const fs = require('fs');
const path = require('path');

/**
 * File registry — every machine-readable file Orbit exposes.
 * Paths are relative to the repo root.
 */
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

/**
 * Safely read and parse a JSON file. Returns null if missing or invalid.
 */
function readJson(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    return null;
  }
}

/**
 * Safely read a JSONL file. Returns array of parsed lines (skipping blanks).
 */
function readJsonl(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return raw
      .split('\n')
      .filter(line => line.trim())
      .map(line => {
        try { return JSON.parse(line); } catch { return null; }
      })
      .filter(Boolean);
  } catch (err) {
    return [];
  }
}

/**
 * Read cycle notes from memory/cycles/ directory.
 */
function readCycleNotes(repoRoot) {
  const cyclesDir = path.join(repoRoot, 'memory', 'cycles');
  try {
    const entries = fs.readdirSync(cyclesDir)
      .filter(f => f.endsWith('.md'))
      .sort();
    return entries.map(filename => {
      const filePath = path.join(cyclesDir, filename);
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const titleMatch = content.match(/^#\s+(.+)/m);
        return {
          filename,
          title: titleMatch ? titleMatch[1] : filename,
          content,
        };
      } catch {
        return { filename, title: filename, content: '' };
      }
    });
  } catch {
    return [];
  }
}

/**
 * Create an Orbit SDK instance for a given repo root.
 */
function create(repoRoot) {
  const resolvedRoot = path.resolve(repoRoot);

  function filePath(name) {
    return path.join(resolvedRoot, FILES[name] || name);
  }

  // ── Individual file readers ──

  function getState()          { return readJson(filePath('state')); }
  function getPassport()       { return readJson(filePath('passport')); }
  function getGovernance()     { return readJson(filePath('governance')); }
  function getTreasury()       { return readJson(filePath('treasury')); }
  function getRoadmap()        { return readJson(filePath('roadmap')); }
  function getTasks()          { return readJson(filePath('tasks')); }
  function getKnowledge()      { return readJson(filePath('knowledge')); }
  function getInfrastructure() { return readJson(filePath('infrastructure')); }
  function getOpportunities()  { return readJson(filePath('opportunities')); }
  function getApprovals()      { return readJson(filePath('approvals')); }
  function getCycles()         { return readJsonl(filePath('cycles')); }
  function getCycleNotes()     { return readCycleNotes(resolvedRoot); }

  // ── Derived views ──

  /**
   * Quick status — a lightweight summary of Orbit's current state.
   */
  function quickStatus() {
    const state = getState() || {};
    const treasury = getTreasury() || {};
    const roadmap = getRoadmap() || {};
    const tasks = getTasks() || { tasks: [] };
    const ai = treasury.ai || {};
    const token = treasury.token || {};

    const openTasks = (tasks.tasks || []).filter(t => t.status === 'open' || t.status === 'blocked');
    const doneTasks = (tasks.tasks || []).filter(t => t.status === 'done');

    return {
      cycle: state.cycle || 0,
      born: state.born || null,
      lastActive: state.lastActive || null,
      lastStatus: state.lastStatus || 'unknown',
      currentLevel: roadmap.currentLevel ? roadmap.currentLevel.name : 'unknown',
      currentLevelStatus: roadmap.currentLevel ? roadmap.currentLevel.status : 'unknown',
      activeLane: roadmap.activeLane ? roadmap.activeLane.name : 'unknown',
      tokenSymbol: token.symbol || null,
      tokenLaunchStatus: token.launchStatus || 'unknown',
      openTaskCount: openTasks.length,
      completedTaskCount: doneTasks.length,
      dailyBudgetUsd: ai.dailyBudgetUsd || 0,
      monthlyBudgetUsd: ai.monthlyBudgetUsd || 0,
      ledgerEntries: ai.ledger ? ai.ledger.length : 0,
    };
  }

  /**
   * Budget summary — AI spend analysis from the treasury ledger.
   */
  function budgetSummary() {
    const treasury = getTreasury() || {};
    const ai = treasury.ai || {};
    const ledger = ai.ledger || [];

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    let spentToday = 0;
    let spentThisMonth = 0;
    let lifetimeSpend = 0;

    for (const entry of ledger) {
      const cost = entry.estimatedUsd || 0;
      lifetimeSpend += cost;

      if (entry.timestamp) {
        const ts = new Date(entry.timestamp);
        if (ts >= todayStart) spentToday += cost;
        if (ts >= monthStart) spentThisMonth += cost;
      }
    }

    return {
      dailyBudgetUsd: ai.dailyBudgetUsd || 0,
      monthlyBudgetUsd: ai.monthlyBudgetUsd || 0,
      spentTodayUsd: Math.round(spentToday * 1000000) / 1000000,
      spentThisMonthUsd: Math.round(spentThisMonth * 1000000) / 1000000,
      lifetimeSpendUsd: Math.round(lifetimeSpend * 1000000) / 1000000,
      dailyRemainingUsd: Math.round(((ai.dailyBudgetUsd || 0) - spentToday) * 1000000) / 1000000,
      monthlyRemainingUsd: Math.round(((ai.monthlyBudgetUsd || 0) - spentThisMonth) * 1000000) / 1000000,
      ledgerEntries: ledger.length,
      canUseAi: spentToday < (ai.dailyBudgetUsd || 0) && spentThisMonth < (ai.monthlyBudgetUsd || 0),
    };
  }

  /**
   * Capability list — active and planned capabilities.
   */
  function getCapabilities() {
    const infra = getInfrastructure() || {};
    const caps = infra.capabilities || infra.summary?.capabilities || [];
    return {
      active: caps.filter(c => c.status === 'active'),
      planned: caps.filter(c => c.status === 'planned'),
      all: caps,
    };
  }

  /**
   * Open tasks — work items that need attention.
   */
  function getOpenTasks() {
    const tasks = getTasks() || { tasks: [] };
    return (tasks.tasks || []).filter(t => t.status === 'open' || t.status === 'blocked');
  }

  /**
   * Blocked actions — wallet and external actions that require approval.
   */
  function getBlockedActions() {
    const governance = getGovernance() || {};
    const infra = getInfrastructure() || {};
    const infraSummary = infra.summary || infra;
    const wallet = infraSummary.wallet || {};

    return {
      approvalMode: governance.externalSpend?.mode || 'unknown',
      hardRules: governance.hardRules || [],
      allowedWithoutApproval: governance.externalSpend?.allowedWithoutApproval || [],
      blockedLiveActions: wallet.blockedLiveActions || infraSummary.walletBlockedLiveActions || [],
      approvalLabels: {
        request: governance.externalSpend?.approvalIssueLabel || 'orbit:approval',
        accepted: governance.externalSpend?.approvalAcceptedLabel || 'orbit:approved',
        rejected: governance.externalSpend?.approvalRejectedLabel || 'orbit:rejected',
      },
    };
  }

  /**
   * Latest cycle — the most recent cycle proof or note.
   */
  function getLatestCycle() {
    const notes = getCycleNotes();
    if (notes.length === 0) return null;
    return notes[notes.length - 1];
  }

  /**
   * Top opportunities — highest-scoring earning opportunities.
   */
  function getTopOpportunities(limit = 5) {
    const opps = getOpportunities() || {};
    const list = opps.opportunities || [];
    return list
      .sort((a, b) => (b.driverAdjustedScore || b.score || 0) - (a.driverAdjustedScore || a.score || 0))
      .slice(0, limit);
  }

  /**
   * Health check — verify that expected files exist and are parseable.
   */
  function healthCheck() {
    const results = {};
    for (const [name, relPath] of Object.entries(FILES)) {
      const fullPath = path.join(resolvedRoot, relPath);
      let exists = false;
      let parseable = false;
      let entryCount = null;

      try {
        fs.accessSync(fullPath, fs.constants.R_OK);
        exists = true;
      } catch {
        results[name] = { path: relPath, exists: false, parseable: false, entryCount: null };
        continue;
      }

      if (name === 'cycles') {
        const lines = readJsonl(fullPath);
        parseable = true;
        entryCount = lines.length;
      } else {
        const data = readJson(fullPath);
        parseable = data !== null;
      }

      results[name] = { path: relPath, exists, parseable, entryCount };
    }

    // Also check cycle notes directory
    const notes = getCycleNotes();
    results.cycleNotes = {
      path: 'memory/cycles/',
      exists: notes.length > 0,
      parseable: true,
      entryCount: notes.length,
    };

    return results;
  }

  /**
   * File list — all machine-readable file paths for external consumers.
   */
  function getFileList() {
    return { ...FILES, cycleNotes: 'memory/cycles/' };
  }

  return {
    // Individual readers
    getState,
    getPassport,
    getGovernance,
    getTreasury,
    getRoadmap,
    getTasks,
    getKnowledge,
    getInfrastructure,
    getOpportunities,
    getApprovals,
    getCycles,
    getCycleNotes,

    // Derived views
    quickStatus,
    budgetSummary,
    getCapabilities,
    getOpenTasks,
    getBlockedActions,
    getLatestCycle,
    getTopOpportunities,
    healthCheck,
    getFileList,

    // Metadata
    repoRoot: resolvedRoot,
    files: FILES,
  };
}

module.exports = { create, FILES };
