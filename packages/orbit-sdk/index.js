"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DEFAULT_PATHS = {
  infrastructure: "memory/infrastructure.json",
  roadmap: "memory/roadmap.json",
  identity: "memory/identity.md",
  state: "memory/state.json",
  tasks: "memory/tasks.json",
  knowledge: "memory/knowledge.json",
  governance: "memory/governance.json",
  treasury: "memory/treasury.json",
  cycles: "memory/cycles.jsonl",
  proofDir: "runtime/proofs"
};

const SECRET_PATTERNS = [
  /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/i,
  /\bgh[pousr]_[A-Za-z0-9_]{30,}\b/g,
  /\bgithub_pat_[A-Za-z0-9_]{50,}\b/g,
  /\bsk-[A-Za-z0-9]{20,}\b/g,
  /\bAKIA[0-9A-Z]{16}\b/g,
  /^(?:AI_API_KEY|OPENAI_API_KEY|AI_PROVIDER_API_KEY|GITHUB_TOKEN|GH_TOKEN|ORBIT_WALLET_PRIVATE_KEY|PRIVATE_KEY)[ \t]*=[ \t]*["']?[^"'\s]{12,}/gim,
  /^[A-Z0-9_]*API_KEY[ \t]*=[ \t]*["']?[^"'\s]{12,}/gim,
  /["']?apiKey["']?\s*:\s*["'][^"']{12,}["']/gi
];

function createOrbitClient(options = {}) {
  const repoRoot = path.resolve(options.repoRoot || process.cwd());
  const paths = { ...DEFAULT_PATHS, ...(options.paths || {}) };

  return {
    repoRoot,
    paths,
    readStatus: () => readStatus(repoRoot, paths),
    readPassport: () => readPassport(repoRoot, paths),
    readInfrastructure: () => readInfrastructure(repoRoot, paths),
    readCapabilities: () => readCapabilities(repoRoot, paths),
    readPermissions: () => readPermissions(repoRoot, paths),
    readWalletPolicy: () => readWalletPolicy(repoRoot, paths),
    readLifecycle: () => readLifecycle(repoRoot, paths),
    readReceipts: (receiptOptions = {}) => readReceipts(repoRoot, paths, receiptOptions),
    readMemorySummary: (memoryOptions = {}) => readMemorySummary(repoRoot, paths, memoryOptions),
    adoptionChecklist: () => adoptionChecklist(repoRoot, paths),
    exportBundle: (bundleOptions = {}) => exportBundle(repoRoot, paths, bundleOptions),
    projectForDashboard: (projectOptions = {}) => projectForDashboard(
      exportBundle(repoRoot, paths, { receiptLimit: projectOptions.receiptLimit || 10, memoryLimit: 0, includeMemory: false }),
      projectOptions
    )
  };
}

function safeJoin(root, relativePath) {
  const normalized = String(relativePath || "").replace(/\\/g, "/");
  if (!normalized || normalized.startsWith("/") || normalized.includes("\0")) {
    throw new Error("path must be relative");
  }
  const resolved = path.resolve(root, normalized);
  const rootWithSep = root.endsWith(path.sep) ? root : `${root}${path.sep}`;
  if (resolved !== root && !resolved.startsWith(rootWithSep)) {
    throw new Error("path escaped repository root");
  }
  return resolved;
}

function exists(repoRoot, relativePath) {
  try {
    return fs.existsSync(safeJoin(repoRoot, relativePath));
  } catch {
    return false;
  }
}

function readText(repoRoot, relativePath, fallback = "") {
  try {
    return fs.readFileSync(safeJoin(repoRoot, relativePath), "utf8");
  } catch {
    return fallback;
  }
}

function readJson(repoRoot, relativePath, fallback = {}) {
  const text = readText(repoRoot, relativePath, "");
  if (!text) return fallback;
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

function parseJsonLines(text) {
  return String(text || "")
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
}

function redactSecrets(value) {
  let redacted = String(value || "");
  for (const pattern of SECRET_PATTERNS) {
    pattern.lastIndex = 0;
    redacted = redacted.replace(pattern, "[REDACTED_SECRET]");
  }
  return redacted;
}

function stableHash(value) {
  return crypto
    .createHash("sha256")
    .update(typeof value === "string" ? value : JSON.stringify(value))
    .digest("hex");
}

function activePhase(infrastructure = {}) {
  return infrastructure.activePhase || null;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function statusCounts(items = []) {
  return asArray(items).reduce((counts, item) => {
    const status = item && item.status || "planned";
    counts[status] = (counts[status] || 0) + 1;
    return counts;
  }, {});
}

function readStatus(repoRoot, paths = DEFAULT_PATHS) {
  const infrastructure = readJson(repoRoot, paths.infrastructure, {});
  const state = readJson(repoRoot, paths.state, {});
  const lifecycle = readLifecycle(repoRoot, paths);
  const capabilities = readCapabilities(repoRoot, paths);
  const receipts = readReceipts(repoRoot, paths, { limit: 3 });
  const adoption = adoptionChecklist(repoRoot, paths);

  return {
    product: infrastructure.product || {},
    activePhase: activePhase(infrastructure),
    lifecycle,
    capabilitySummary: capabilities.summary,
    latestReceipt: receipts.latest || null,
    installed: adoption.summary,
    state: {
      cycle: state.cycle || 0,
      lastActive: state.lastActive || null,
      lastStatus: state.lastStatus || "unknown"
    }
  };
}

function readPassport(repoRoot, paths = DEFAULT_PATHS) {
  const infrastructure = readJson(repoRoot, paths.infrastructure, {});
  const roadmap = readJson(repoRoot, paths.roadmap, {});
  const identity = redactSecrets(readText(repoRoot, paths.identity, "")).slice(0, 4000);
  const governance = readJson(repoRoot, paths.governance, {});
  const lifecycle = readLifecycle(repoRoot, paths);

  const passport = {
    name: infrastructure.product && infrastructure.product.name || "Orbit",
    category: infrastructure.product && infrastructure.product.category || "GitHub-native agent infrastructure",
    mission: infrastructure.product && infrastructure.product.solution || "",
    problem: infrastructure.product && infrastructure.product.problem || "",
    activePhase: infrastructure.activePhase || null,
    currentLevel: roadmap.currentLevel || null,
    lifecycle,
    permissionMode: governance.externalSpend && governance.externalSpend.mode || "unknown",
    blockedUntilApproved: infrastructure.blockedUntilApproved || [],
    identityPreview: identity
  };

  return {
    ...passport,
    digest: stableHash(passport)
  };
}

function readCapabilities(repoRoot, paths = DEFAULT_PATHS) {
  const infrastructure = readJson(repoRoot, paths.infrastructure, {});
  const capabilities = Array.isArray(infrastructure.capabilities) ? infrastructure.capabilities : [];
  const surfaces = Array.isArray(infrastructure.surfaces) ? infrastructure.surfaces : [];
  const commands = Array.isArray(infrastructure.commands) ? infrastructure.commands : [];

  return {
    summary: {
      totalCapabilities: capabilities.length,
      activeCapabilities: capabilities.filter((item) => item.status === "active").length,
      totalSurfaces: surfaces.length,
      totalCommands: commands.length,
      capabilityStatus: statusCounts(capabilities),
      surfaceStatus: statusCounts(surfaces),
      commandStatus: statusCounts(commands)
    },
    capabilities,
    surfaces,
    commands
  };
}

function readInfrastructure(repoRoot, paths = DEFAULT_PATHS) {
  const infrastructure = readJson(repoRoot, paths.infrastructure, {});
  const layers = asArray(infrastructure.layers);
  const access = asArray(infrastructure.access);
  const capabilities = asArray(infrastructure.capabilities);
  const surfaces = asArray(infrastructure.surfaces);
  const commands = asArray(infrastructure.commands);

  return {
    product: infrastructure.product || {},
    activePhase: infrastructure.activePhase || null,
    summary: {
      totalLayers: layers.length,
      totalAccess: access.length,
      totalSurfaces: surfaces.length,
      totalCapabilities: capabilities.length,
      totalCommands: commands.length,
      layerStatus: statusCounts(layers),
      accessStatus: statusCounts(access),
      surfaceStatus: statusCounts(surfaces),
      capabilityStatus: statusCounts(capabilities),
      commandStatus: statusCounts(commands),
      receiptRoot: infrastructure.receipts && infrastructure.receipts.current || null,
      sdkStatus: access.find((item) => item.id === "sdk")?.status || null
    },
    layers,
    access,
    surfaces,
    capabilities,
    commands,
    receipts: infrastructure.receipts || {},
    blockedUntilApproved: asArray(infrastructure.blockedUntilApproved)
  };
}

function readPermissions(repoRoot, paths = DEFAULT_PATHS) {
  const governance = readJson(repoRoot, paths.governance, {});
  const infrastructure = readJson(repoRoot, paths.infrastructure, {});
  return {
    approvalMode: governance.externalSpend && governance.externalSpend.mode || "unknown",
    approvalLabels: governance.externalSpend ? {
      approval: governance.externalSpend.approvalIssueLabel || null,
      accepted: governance.externalSpend.approvalAcceptedLabel || null,
      rejected: governance.externalSpend.approvalRejectedLabel || null
    } : {},
    allowedWithoutApproval: governance.externalSpend && governance.externalSpend.allowedWithoutApproval || [],
    blockedUntilApproved: infrastructure.blockedUntilApproved || [],
    hardRules: governance.hardRules || []
  };
}

function readWalletPolicy(repoRoot, paths = DEFAULT_PATHS) {
  const governance = readJson(repoRoot, paths.governance, {});
  const treasury = readJson(repoRoot, paths.treasury, {});
  const infrastructure = readJson(repoRoot, paths.infrastructure, {});
  const externalSpend = asObject(governance.externalSpend);
  const selfRecipients = asObject(governance.selfRecipients);
  const ai = asObject(treasury.ai);
  const purchasePolicy = asObject(ai.purchasePolicy);
  const revenue = asObject(treasury.revenue);
  const token = asObject(treasury.token);
  const infrastructureWallet = asObject(infrastructure.wallet);

  const policy = {
    approvalMode: externalSpend.mode || infrastructureWallet.approvalMode || "owner_approval_required",
    approvalLabels: {
      approval: externalSpend.approvalIssueLabel || null,
      accepted: externalSpend.approvalAcceptedLabel || null,
      rejected: externalSpend.approvalRejectedLabel || null
    },
    allowedWithoutApproval: asArray(externalSpend.allowedWithoutApproval),
    selfRecipientEnvNames: {
      treasury: selfRecipients.treasuryEnv || null,
      operatorRevenue: selfRecipients.operatorRevenueEnv || null
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
      lastClaimSentAt: revenue.lastClaimSentAt || null
    },
    token: {
      name: token.name || "",
      symbol: token.symbol || "",
      launchStatus: token.launchStatus || "unknown",
      launchedAt: token.launchedAt || null,
      configured: Boolean(token.name || token.symbol)
    },
    blockedLiveActions: asArray(infrastructureWallet.blockedLiveActions).length
      ? asArray(infrastructureWallet.blockedLiveActions)
      : asArray(infrastructure.blockedUntilApproved),
    publicViewOnly: infrastructureWallet.publicViewOnly !== false,
    noPrivateKeys: infrastructureWallet.noPrivateKeys !== false
  };

  return {
    ...policy,
    digest: stableHash(policy)
  };
}

function readLifecycle(repoRoot, paths = DEFAULT_PATHS) {
  const state = readJson(repoRoot, paths.state, {});
  const cycleRows = parseJsonLines(readText(repoRoot, paths.cycles, ""));
  const latestCycle = cycleRows[cycleRows.length - 1] || null;
  return {
    cycle: state.cycle || 0,
    born: state.born || null,
    lastActive: state.lastActive || null,
    lastStatus: state.lastStatus || "unknown",
    firstWakeIntroComplete: Boolean(state.firstWakeIntroComplete),
    recordedCycles: cycleRows.length,
    latestCycle
  };
}

function proofFiles(repoRoot, paths = DEFAULT_PATHS) {
  const root = safeJoin(repoRoot, paths.proofDir);
  if (!fs.existsSync(root)) return [];
  const files = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile() && entry.name.endsWith(".json")) {
        files.push(full);
      }
    }
  };
  walk(root);
  return files.sort().map((file) => path.relative(repoRoot, file).replace(/\\/g, "/"));
}

const REFUSAL_CATEGORIES = new Set(["scam", "safety", "policy", "approval-missing", "governance"]);
const REFUSAL_SEVERITIES = new Set(["low", "medium", "high", "critical"]);
const EVM_ADDRESS_PATTERN = /\b0x[a-fA-F0-9]{40}\b/g;

function normalizeRefusalCategory(value) {
  const raw = String(value || "").toLowerCase().trim();
  if (REFUSAL_CATEGORIES.has(raw)) return raw;
  if (raw === "approval" || raw === "missing-approval") return "approval-missing";
  if (raw === "policy-block" || raw === "policy_block") return "policy";
  if (raw === "phishing" || raw === "scam-link") return "scam";
  return "unknown";
}

function normalizeRefusalSeverity(value) {
  const raw = String(value || "").toLowerCase().trim();
  if (REFUSAL_SEVERITIES.has(raw)) return raw;
  if (raw === "info" || raw === "warn") return "low";
  if (raw === "warning") return "medium";
  if (raw === "severe" || raw === "blocker") return "high";
  return "medium";
}

function sanitizeRefusalString(value) {
  const redacted = redactSecrets(String(value || ""))
    .replace(EVM_ADDRESS_PATTERN, "[REDACTED_ADDRESS]")
    .replace(/\s+/g, " ")
    .trim();
  return redacted.slice(0, 120);
}

function isMeaningfulRefusalSummary(value) {
  if (!value) return false;
  const stripped = String(value)
    .replace(/\[REDACTED[_A-Z]*\]/g, "")
    .replace(/[\s\-_.,;:]+/g, "")
    .trim();
  return stripped.length >= 3;
}

function extractRefusalsFromProof(proof) {
  if (!proof || !Array.isArray(proof.steps)) return [];
  const cycle = Number(proof.cycle || 0) || 0;
  const proofAt = proof.finishedAt || proof.startedAt || null;
  const refusals = [];
  for (const step of proof.steps) {
    if (!step || typeof step !== "object") continue;
    const risk = step.risk && typeof step.risk === "object" ? step.risk : null;
    const refused = step.refused === true || (risk && risk.level === "high" && step.refused !== false);
    if (!refused) continue;
    const at = step.at || step.timestamp || proofAt;
    const summarySource = step.refusalReason
      || step.reason
      || (risk && risk.summary)
      || (typeof step.error === "string" ? step.error : "")
      || "unsafe action";
    const summary = sanitizeRefusalString(summarySource);
    if (!isMeaningfulRefusalSummary(summary)) continue;
    refusals.push({
      cycle,
      at: typeof at === "string" ? at : (at ? new Date(at).toISOString() : proofAt),
      category: normalizeRefusalCategory(
        (risk && (risk.category || risk.kind)) || step.refusalCategory || step.category
      ),
      oneLineSummary: summary,
      severity: normalizeRefusalSeverity(risk && risk.level || step.severity)
    });
  }
  return refusals;
}

function readReceipts(repoRoot, paths = DEFAULT_PATHS, options = {}) {
  const limit = Number.isFinite(options.limit) ? options.limit : 10;
  const files = proofFiles(repoRoot, paths).slice(-limit);
  const refusalsAccumulator = [];
  const receipts = files.map((file) => {
    const proof = readJson(repoRoot, file, {});
    const signed = Boolean(
      proof
        && typeof proof.signature === "string"
        && typeof proof.payloadHash === "string"
        && typeof proof.signatureScheme === "string"
    );
    for (const refusal of extractRefusalsFromProof(proof)) {
      refusalsAccumulator.push(refusal);
    }
    return {
      path: file,
      cycle: proof.cycle || null,
      startedAt: proof.startedAt || null,
      finishedAt: proof.finishedAt || null,
      trigger: proof.trigger || null,
      dryRun: Boolean(proof.dryRun),
      totalSteps: proof.totalSteps || (Array.isArray(proof.steps) ? proof.steps.length : 0),
      filesChanged: proof.filesChanged || [],
      result: redactSecrets(proof.result || "").slice(0, 500),
      digest: stableHash(proof),
      signed,
      signer: signed ? (proof.signer || null) : null,
      signatureScheme: signed ? proof.signatureScheme : null,
      payloadHash: signed ? proof.payloadHash : null
    };
  });

  return {
    count: receipts.length,
    latest: receipts[receipts.length - 1] || null,
    receipts,
    refusals: refusalsAccumulator
  };
}

function readMemorySummary(repoRoot, paths = DEFAULT_PATHS, options = {}) {
  const limit = Number.isFinite(options.limit) ? options.limit : 8;
  const tasks = readJson(repoRoot, paths.tasks, { tasks: [] });
  const knowledge = readJson(repoRoot, paths.knowledge, { entries: [] });
  const entries = Array.isArray(knowledge.entries) ? knowledge.entries : [];
  const taskList = Array.isArray(tasks.tasks) ? tasks.tasks : [];
  return {
    tasks: {
      total: taskList.length,
      open: taskList.filter((task) => task.status === "open").length,
      recent: taskList.slice(-limit).reverse()
    },
    knowledge: {
      total: entries.length,
      recent: entries.slice(-limit).reverse().map((entry) => ({
        ...entry,
        content: redactSecrets(entry.content || "").slice(0, 800)
      }))
    }
  };
}

function adoptionChecklist(repoRoot, paths = DEFAULT_PATHS) {
  const checks = [
    { id: "infrastructure", path: paths.infrastructure, label: "Infrastructure registry" },
    { id: "identity", path: paths.identity, label: "Agent identity" },
    { id: "state", path: paths.state, label: "Lifecycle state" },
    { id: "tasks", path: paths.tasks, label: "Task memory" },
    { id: "knowledge", path: paths.knowledge, label: "Durable knowledge" },
    { id: "governance", path: paths.governance, label: "Permission policy" },
    { id: "treasury", path: paths.treasury, label: "Budget state" },
    { id: "cycles", path: paths.cycles, label: "Cycle ledger" },
    { id: "proofs", path: paths.proofDir, label: "Proof receipt root" },
    { id: "cycle-workflow", path: ".github/workflows/orbit-cycle.yml", label: "Scheduled lifecycle workflow" },
    { id: "event-workflow", path: ".github/workflows/orbit-event.yml", label: "Event lifecycle workflow" }
  ].map((check) => ({
    ...check,
    ok: exists(repoRoot, check.path)
  }));
  const passed = checks.filter((check) => check.ok).length;

  return {
    summary: {
      passed,
      total: checks.length,
      ready: passed === checks.length
    },
    checks,
    missing: checks.filter((check) => !check.ok)
  };
}

function projectForDashboard(bundle, options = {}) {
  const bundleObj = bundle && typeof bundle === "object" ? bundle : {};
  const status = asObject(bundleObj.status);
  const lifecycle = asObject(bundleObj.lifecycle);
  const walletPolicy = asObject(bundleObj.walletPolicy);
  const receipts = asObject(bundleObj.receipts);
  const permissions = asObject(bundleObj.permissions);
  const infrastructure = asObject(bundleObj.infrastructure);

  const limit = Number.isFinite(options.receiptLimit) ? options.receiptLimit : 10;
  const slimReceipts = asArray(receipts.receipts).slice(-limit).map((r) => ({
    path: r.path || null,
    cycle: r.cycle || null,
    startedAt: r.startedAt || null,
    finishedAt: r.finishedAt || null,
    trigger: r.trigger || null,
    dryRun: Boolean(r.dryRun),
    totalSteps: r.totalSteps || 0,
    filesChangedCount: Array.isArray(r.filesChanged) ? r.filesChanged.length : 0,
    result: typeof r.result === "string" ? r.result.slice(0, 240) : "",
    digest: r.digest || null,
    signed: Boolean(r.signed),
    signer: r.signer || null,
    signatureScheme: r.signatureScheme || null,
    payloadHash: r.payloadHash || null
  }));
  const latestSigned = [...slimReceipts].reverse().find((r) => r.signed) || null;

  const refusalLimit = Number.isFinite(options.refusalLimit) ? options.refusalLimit : 20;
  const slimRefusals = asArray(receipts.refusals)
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const summary = sanitizeRefusalString(entry.oneLineSummary);
      if (!isMeaningfulRefusalSummary(summary)) return null;
      return {
        cycle: Number(entry.cycle || 0) || 0,
        at: typeof entry.at === "string" ? entry.at : null,
        category: normalizeRefusalCategory(entry.category),
        oneLineSummary: summary,
        severity: normalizeRefusalSeverity(entry.severity)
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      const ta = a.at ? Date.parse(a.at) : 0;
      const tb = b.at ? Date.parse(b.at) : 0;
      if (tb !== ta) return tb - ta;
      return (b.cycle || 0) - (a.cycle || 0);
    })
    .slice(0, refusalLimit);

  const stateSlice = asObject(status.state);
  const slim = {
    schema: "orbit-dashboard/1",
    generatedAt: bundleObj.generatedAt || new Date().toISOString(),
    gitCommit: typeof options.gitCommit === "string" ? options.gitCommit.slice(0, 12) : null,
    product: asObject(infrastructure.product),
    activePhase: infrastructure.activePhase || status.activePhase || null,
    signer: latestSigned ? latestSigned.signer : null,
    lifecycle: {
      cycle: lifecycle.cycle || stateSlice.cycle || 0,
      born: lifecycle.born || null,
      lastActive: lifecycle.lastActive || stateSlice.lastActive || null,
      lastStatus: lifecycle.lastStatus || stateSlice.lastStatus || "unknown",
      firstWakeIntroComplete: Boolean(lifecycle.firstWakeIntroComplete),
      recordedCycles: lifecycle.recordedCycles || 0
    },
    walletPolicy: {
      approvalMode: walletPolicy.approvalMode || null,
      publicViewOnly: walletPolicy.publicViewOnly !== false,
      noPrivateKeys: walletPolicy.noPrivateKeys !== false,
      token: asObject(walletPolicy.token),
      digest: walletPolicy.digest || null
    },
    permissions: {
      allowedWithoutApproval: asArray(permissions.allowedWithoutApproval),
      blockedUntilApproved: asArray(permissions.blockedUntilApproved)
    },
    receipts: {
      count: slimReceipts.length,
      latest: slimReceipts[slimReceipts.length - 1] || null,
      latestSigned,
      list: slimReceipts
    },
    refusals: slimRefusals
  };

  return {
    ...slim,
    digest: stableHash(slim)
  };
}

function exportBundle(repoRoot, paths = DEFAULT_PATHS, options = {}) {
  const bundle = {
    generatedAt: new Date().toISOString(),
    status: readStatus(repoRoot, paths),
    passport: readPassport(repoRoot, paths),
    infrastructure: readInfrastructure(repoRoot, paths),
    capabilities: readCapabilities(repoRoot, paths),
    permissions: readPermissions(repoRoot, paths),
    walletPolicy: readWalletPolicy(repoRoot, paths),
    lifecycle: readLifecycle(repoRoot, paths),
    receipts: readReceipts(repoRoot, paths, { limit: options.receiptLimit || 5 }),
    memory: options.includeMemory === false ? undefined : readMemorySummary(repoRoot, paths, { limit: options.memoryLimit || 5 }),
    adoption: adoptionChecklist(repoRoot, paths)
  };

  return {
    ...bundle,
    digest: stableHash(bundle)
  };
}

module.exports = {
  DEFAULT_PATHS,
  adoptionChecklist,
  createOrbitClient,
  exportBundle,
  extractRefusalsFromProof,
  projectForDashboard,
  readCapabilities,
  readInfrastructure,
  readLifecycle,
  readMemorySummary,
  readPassport,
  readPermissions,
  readReceipts,
  readWalletPolicy,
  readStatus
};
