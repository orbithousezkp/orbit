/**
 * Orbit SDK — Read Orbit's machine-readable state files programmatically.
 *
 * Zero-dependency. Works inside a cloned Orbit repo or any repo that
 * follows the Orbit data contract (see docs/data-contract.md).
 *
 * Usage:
 *   const orbit = require('@orbit-house/sdk');
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
  missions:       'memory/missions.json',
  adopters:       'memory/adopters-registry.json',
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

    // Dashboard bundle + projection (client-side wrappers)
    exportBundle: (options) => exportBundle(resolvedRoot, undefined, options),
    projectForDashboard: (options) => projectForDashboard(exportBundle(resolvedRoot, undefined, options), options),

    // Metadata
    repoRoot: resolvedRoot,
    files: FILES,
  };
}

// ── Bundle export + dashboard projection ─────────────────────────────────────

const DASHBOARD_SCHEMA = "orbit-dashboard/1";
const DEFAULT_REFUSAL_LIMIT = 20;
const DEFAULT_MISSION_LIMIT = 20;
const DEFAULT_APPROVAL_LIMIT = 20;
const MISSION_SCHEMA = "orbit-missions/1";
const APPROVALS_SCHEMA = "orbit-approvals/1";
const ADOPTERS_SCHEMA = "orbit-adopters/1";
const PHASE_1_ADOPTER_TARGET = 5;
const PHASE_5_ADOPTER_TARGET = 50;
const REFUSAL_SUMMARY_MAX = 120;
const RESULT_SUMMARY_MAX = 240;

const SECRET_PATTERNS = [
  /\bghp_[A-Za-z0-9]{10,}\b/g,
  /\bgho_[A-Za-z0-9]{10,}\b/g,
  /\bghs_[A-Za-z0-9]{10,}\b/g,
  /\bsk-[A-Za-z0-9_-]{16,}\b/g,
  /\bxoxb-[A-Za-z0-9-]{10,}\b/g,
  /\bAKIA[0-9A-Z]{12,}\b/g,
];
const EVM_ADDRESS = /\b0x[a-fA-F0-9]{40}\b/g;

function redactInline(text) {
  if (typeof text !== "string") return "";
  let out = text;
  for (const re of SECRET_PATTERNS) {
    out = out.replace(re, "[REDACTED_SECRET]");
  }
  out = out.replace(EVM_ADDRESS, "[REDACTED_ADDRESS]");
  return out;
}

function isMeaningfulSummary(text) {
  if (!text) return false;
  const cleaned = text
    .replace(/\[REDACTED[^\]]*\]/g, "")
    .replace(/[^A-Za-z]/g, "");
  return cleaned.length >= 4;
}

function listReceiptFiles(repoRoot) {
  const proofRoot = path.join(repoRoot, "runtime", "proofs");
  if (!fs.existsSync(proofRoot)) return [];
  const files = [];
  try {
    const days = fs
      .readdirSync(proofRoot, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();
    for (const day of days) {
      const dayDir = path.join(proofRoot, day);
      const entries = fs
        .readdirSync(dayDir)
        .filter((f) => f.endsWith(".json"))
        .sort();
      for (const e of entries) {
        files.push(path.join(dayDir, e));
      }
    }
  } catch {
    // best-effort
  }
  return files;
}

function loadReceiptsSorted(repoRoot, limit) {
  const files = listReceiptFiles(repoRoot);
  const all = [];
  for (const fp of files) {
    const data = readJson(fp);
    if (!data) continue;
    const rel = path.relative(repoRoot, fp).split(path.sep).join("/");
    all.push({ ...data, path: rel });
  }
  all.sort((a, b) => {
    const cycleDelta = (b.cycle || 0) - (a.cycle || 0);
    if (cycleDelta !== 0) return cycleDelta;
    return String(b.finishedAt || "").localeCompare(String(a.finishedAt || ""));
  });
  const total = all.length;
  const cap = Number.isFinite(limit) && limit >= 0 ? all.slice(0, limit) : all;
  return { count: total, list: cap };
}

function isSignedReceipt(receipt) {
  return Boolean(
    receipt && receipt.signature && receipt.signer && receipt.payloadHash
  );
}

function projectAdoptersSlim(adoptersRegistry, options) {
  const opts = options || {};
  const phase1Target = Number.isFinite(opts.phase1Target) ? opts.phase1Target : PHASE_1_ADOPTER_TARGET;
  const phase5Target = Number.isFinite(opts.phase5Target) ? opts.phase5Target : PHASE_5_ADOPTER_TARGET;
  const r = adoptersRegistry && typeof adoptersRegistry === "object" ? adoptersRegistry : null;
  if (!r) {
    return {
      schema: ADOPTERS_SCHEMA,
      total: 0,
      adopted: 0,
      phase1Target,
      phase5Target,
      phase1Progress: 0,
      phase5Progress: 0,
      list: [],
    };
  }
  const adopters = Array.isArray(r.adopters) ? r.adopters : [];
  const adoptedList = adopters.filter((a) => a && a.adopted);
  return {
    schema: r.schema || ADOPTERS_SCHEMA,
    total: adopters.length,
    adopted: adoptedList.length,
    phase1Target,
    phase5Target,
    phase1Progress: Math.min(1, adoptedList.length / Math.max(1, phase1Target)),
    phase5Progress: Math.min(1, adoptedList.length / Math.max(1, phase5Target)),
    list: adoptedList.slice(0, 20).map((a) => ({
      repo: a.repo || null,
      publicUrl: a.publicUrl || null,
      verifiedAt: a.verifiedAt || null,
      lastVerifiedAt: a.lastVerifiedAt || null,
      scaffolderVersion: a.scaffolderVersion || null,
    })),
  };
}

function projectMissionsSlim(missionsRecord, options) {
  const opts = options || {};
  const limit = Number.isFinite(opts.missionLimit) ? opts.missionLimit : DEFAULT_MISSION_LIMIT;
  const record = missionsRecord && typeof missionsRecord === "object" ? missionsRecord : null;
  if (!record) {
    return { schema: MISSION_SCHEMA, active: 0, total: 0, list: [] };
  }
  const list = Array.isArray(record.missions) ? record.missions : [];
  const open = list.filter((m) => (m && (m.status || "open")) === "open");
  const projected = open.slice(0, limit).map((m) => ({
    id: m.id || null,
    issueNumber: typeof m.issueNumber === "number" ? m.issueNumber : null,
    issueUrl: m.issueUrl || null,
    title: redactInline(m.title || ""),
    proposer: m.proposer || "unknown",
    deadline: m.deadline || null,
    acceptanceCount: Array.isArray(m.acceptanceCriteria) ? m.acceptanceCriteria.length : 0,
    updatedAt: m.updatedAt || m.createdAt || null,
  }));
  return {
    schema: record.schema || MISSION_SCHEMA,
    active: open.length,
    total: list.length,
    list: projected,
  };
}

function projectApprovalsSlim(approvalsRecord, options) {
  const opts = options || {};
  const limit = Number.isFinite(opts.approvalLimit) ? opts.approvalLimit : DEFAULT_APPROVAL_LIMIT;
  const now = opts.now instanceof Date ? opts.now : new Date();
  const record = approvalsRecord && typeof approvalsRecord === "object" ? approvalsRecord : null;
  const empty = { schema: APPROVALS_SCHEMA, pending: 0, total: 0, list: [] };
  if (!record) return empty;
  const list = Array.isArray(record.approvals) ? record.approvals : [];
  const pending = list.filter((a) => a && a.status === "pending");
  // Sort oldest-first so the most-stuck approval is the most visible entry.
  pending.sort((a, b) => {
    const at = Date.parse(a && (a.createdAt || a.updatedAt) || "") || 0;
    const bt = Date.parse(b && (b.createdAt || b.updatedAt) || "") || 0;
    return at - bt;
  });
  const projected = pending.slice(0, limit).map((a) => {
    const since = Date.parse(a.createdAt || a.updatedAt || "") || null;
    const pendingSinceHours = since
      ? Math.max(0, Math.round((now.getTime() - since) / 3_600_000))
      : null;
    const req = (a.classification && a.classification.request) || {};
    return {
      id: a.id || null,
      issueNumber: typeof a.issueNumber === "number" ? a.issueNumber : null,
      issueUrl: a.issueUrl || null,
      category: req.category || null,
      amount: typeof req.amount === "number" ? req.amount : null,
      asset: req.asset || null,
      createdAt: a.createdAt || null,
      pendingSinceHours,
    };
  });
  return {
    schema: APPROVALS_SCHEMA,
    pending: pending.length,
    total: list.length,
    list: projected,
  };
}

function projectReceipt(r) {
  return {
    path: r.path || null,
    cycle: r.cycle || 0,
    startedAt: r.startedAt || null,
    finishedAt: r.finishedAt || null,
    trigger: r.trigger || null,
    dryRun: Boolean(r.dryRun),
    totalSteps: r.totalSteps || (Array.isArray(r.steps) ? r.steps.length : 0),
    filesChangedCount: Array.isArray(r.filesChanged) ? r.filesChanged.length : 0,
    result:
      typeof r.result === "string"
        ? redactInline(r.result).slice(0, RESULT_SUMMARY_MAX)
        : null,
    signed: isSignedReceipt(r),
    signer: r.signer || null,
    signatureScheme: r.signatureScheme || null,
    payloadHash: r.payloadHash || null,
  };
}

function digestForObject(obj) {
  // Deterministic, zero-dep, 8-hex digest. Not cryptographic; not a proof.
  let h = 0;
  const s = JSON.stringify(obj || null);
  for (let i = 0; i < s.length; i += 1) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return "0x" + (h >>> 0).toString(16).padStart(8, "0");
}

function extractRefusalsFromReceipt(receipt) {
  const refusals = [];
  const steps = Array.isArray(receipt.steps) ? receipt.steps : [];
  for (const step of steps) {
    if (!step) continue;
    const risk = step.risk || {};
    const level = risk.level || "";
    const refused =
      step.refused === true || level === "high" || level === "critical";
    if (!refused) continue;
    const reasonRaw = step.refusalReason || step.reason || "";
    const summary = redactInline(reasonRaw).slice(0, REFUSAL_SUMMARY_MAX);
    if (!isMeaningfulSummary(summary)) continue;
    refusals.push({
      cycle: receipt.cycle || 0,
      at: receipt.finishedAt || receipt.startedAt || null,
      category: risk.category || "unknown",
      severity: level || "unknown",
      tool: step.tool || null,
      oneLineSummary: summary,
    });
  }
  return refusals;
}

function exportBundle(repoRoot, _unused, options) {
  const opts = options || {};
  const root = path.resolve(repoRoot);
  const limit = Number.isFinite(opts.receiptLimit) ? opts.receiptLimit : 10;
  const includeMemory = opts.includeMemory !== false;

  const bundle = {
    infrastructure: readJson(path.join(root, FILES.infrastructure)),
    state: readJson(path.join(root, FILES.state)),
    governance: readJson(path.join(root, FILES.governance)),
    treasury: readJson(path.join(root, FILES.treasury)),
    receipts: loadReceiptsSorted(root, limit),
    recordedCycles: readJsonl(path.join(root, FILES.cycles)).length,
    missions: readJson(path.join(root, FILES.missions)),
    adopters: readJson(path.join(root, FILES.adopters)),
    approvals: readJson(path.join(root, FILES.approvals)),
  };
  if (includeMemory) {
    bundle.memory = {
      tasks: readJson(path.join(root, FILES.tasks)),
      knowledge: readJson(path.join(root, FILES.knowledge)),
      opportunities: readJson(path.join(root, FILES.opportunities)),
    };
  }
  return bundle;
}

function projectForDashboard(bundle, options) {
  const opts = options || {};
  const b = bundle || {};
  const infra = b.infrastructure || {};
  const state = b.state || {};
  const governance = b.governance || {};
  const treasury = b.treasury || {};
  const receiptsBundle = b.receipts || { count: 0, list: [] };
  const receiptList = Array.isArray(receiptsBundle.list) ? receiptsBundle.list : [];

  const externalSpend = governance.externalSpend || {};
  const token = treasury.token || {};
  const product = infra.product || {};
  const activePhase = infra.activePhase || null;

  const receiptCap = Number.isFinite(opts.receiptLimit) ? opts.receiptLimit : 10;
  const refusalCap = Number.isFinite(opts.refusalLimit) ? opts.refusalLimit : DEFAULT_REFUSAL_LIMIT;

  const projectedList = receiptList.slice(0, receiptCap).map(projectReceipt);
  const latest = projectedList[0] || null;
  const latestSignedRaw = receiptList.find(isSignedReceipt) || null;
  const latestSigned = latestSignedRaw ? projectReceipt(latestSignedRaw) : null;
  const signer = latestSigned ? latestSigned.signer : null;

  const allRefusals = [];
  for (const r of receiptList) {
    for (const refusal of extractRefusalsFromReceipt(r)) {
      allRefusals.push(refusal);
    }
  }
  allRefusals.sort((a, b2) => {
    const cycleDelta = (b2.cycle || 0) - (a.cycle || 0);
    if (cycleDelta !== 0) return cycleDelta;
    return String(b2.at || "").localeCompare(String(a.at || ""));
  });
  const refusals = allRefusals.slice(0, refusalCap);

  const walletDigest = digestForObject({
    approvalMode: externalSpend.mode || "owner_approval_required",
    token,
    blocked: infra.blockedUntilApproved || [],
  });

  const slim = {
    schema: DASHBOARD_SCHEMA,
    generatedAt: new Date().toISOString(),
    gitCommit: typeof opts.gitCommit === "string" ? opts.gitCommit.slice(0, 12) : null,
    product: {
      name: product.name || "Orbit",
      category: product.category || null,
    },
    activePhase: activePhase
      ? {
          id: activePhase.id || null,
          name: activePhase.name || null,
          status: activePhase.status || null,
        }
      : null,
    signer,
    lifecycle: {
      cycle: state.cycle || 0,
      born: state.born || null,
      lastActive: state.lastActive || null,
      lastStatus: state.lastStatus || "unknown",
      firstWakeIntroComplete: Boolean(state.firstWakeIntroComplete),
      recordedCycles: b.recordedCycles || 0,
    },
    walletPolicy: {
      approvalMode: externalSpend.mode || "owner_approval_required",
      publicViewOnly: true,
      noPrivateKeys: true,
      token: {
        name: token.name || null,
        symbol: token.symbol || null,
        launchStatus: token.launchStatus || "planned",
        launchedAt: token.launchedAt || null,
        configured: Boolean(token.address),
      },
      digest: walletDigest,
    },
    permissions: {
      allowedWithoutApproval: Array.isArray(externalSpend.allowedWithoutApproval)
        ? [...externalSpend.allowedWithoutApproval]
        : [],
      blockedUntilApproved: Array.isArray(infra.blockedUntilApproved)
        ? [...infra.blockedUntilApproved]
        : [],
    },
    receipts: {
      count: receiptsBundle.count || 0,
      latest,
      latestSigned,
      list: projectedList,
    },
    refusals,
    missions: projectMissionsSlim(b.missions, opts),
    adopters: projectAdoptersSlim(b.adopters, opts),
    approvals: projectApprovalsSlim(b.approvals, opts),
  };

  slim.digest = digestForObject({
    schema: slim.schema,
    gitCommit: slim.gitCommit,
    lifecycle: slim.lifecycle,
    walletPolicy: slim.walletPolicy,
    permissions: slim.permissions,
    receiptCount: slim.receipts.count,
    latestPath: latest ? latest.path : null,
    refusalCount: refusals.length,
    missionActive: slim.missions ? slim.missions.active : 0,
    adopterCount: slim.adopters ? slim.adopters.adopted : 0,
    approvalsPending: slim.approvals ? slim.approvals.pending : 0,
  });

  return slim;
}

function createOrbitClient(config) {
  const cfg = config || {};
  if (!cfg.repoRoot) {
    throw new Error("createOrbitClient: repoRoot is required");
  }
  const root = path.resolve(cfg.repoRoot);
  const sdk = create(root);
  return {
    ...sdk,
    exportBundle: (options) => exportBundle(root, undefined, options),
    projectForDashboard: (options) =>
      projectForDashboard(
        exportBundle(root, undefined, options),
        options
      ),
  };
}

module.exports = {
  create,
  createOrbitClient,
  exportBundle,
  projectForDashboard,
  FILES,
};
