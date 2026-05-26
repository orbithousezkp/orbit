"use strict";

// Spawn — Orbit's ability to autonomously create a new child repo
// under its organization. Full spec: PLAN/SPECS/SPAWN.md.
//
// Lifecycle: proposed -> voting -> approved -> executing -> complete
//                     -> rejected (during voting)
//                     -> failed (executor throws)
//
// Heavily gated:
//   - Quorum approval required (high-tier threshold).
//   - Every human-supplied field (name, description, rationale) is
//     risk-scanned BEFORE proposal acceptance.
//   - Name must match a GitHub-valid lowercase-kebab pattern.
//   - Idempotent: re-proposing with the same idemKey returns the
//     existing record.
//   - Secrets NEVER copied from parent to child (the executor
//     produces a clean template only).

const fs = require("node:fs");
const path = require("node:path");
const { atomicWriteFile } = require("./safety");
const { scanTextRisk } = require("./scam");

const SPAWN_PATH = "memory/spawn-proposals.json";
const FAMILY_PATH = "memory/family.json";
const SPAWN_SCHEMA = "orbit-spawn/1";
const FAMILY_SCHEMA = "orbit-family/1";

const STATUSES = Object.freeze({
  PROPOSED: "proposed",
  VOTING: "voting",
  APPROVED: "approved",
  EXECUTING: "executing",
  COMPLETE: "complete",
  REJECTED: "rejected",
  FAILED: "failed"
});

const VALID_TYPES = new Set(["product", "research", "infrastructure"]);

// GitHub repo names: 1-100 chars, alnum + . _ - . We tighten to
// lower-kebab, no leading/trailing hyphen, 3-40 chars. Excludes
// confusables and the legacy `orbit-private-live` style.
const ALLOWED_NAME = /^[a-z][a-z0-9][a-z0-9-]{0,37}[a-z0-9]$/;

const RESERVED_NAMES = new Set([
  "orbit", "orbit-house", "orbit-sdk", "create-orbit-house",
  "node_modules", ".github", "main", "master"
]);

const DEFAULT_BUDGET = { daily: 1, monthly: 20 };

function nowIso(now) {
  return (now instanceof Date ? now : new Date()).toISOString();
}

function readJson(absPath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(absPath, "utf-8"));
  } catch {
    return fallback;
  }
}

function loadSpawns(repoRoot) {
  const record = readJson(path.resolve(repoRoot, SPAWN_PATH), {
    schema: SPAWN_SCHEMA,
    spawns: []
  });
  if (!record || !Array.isArray(record.spawns)) {
    return { schema: SPAWN_SCHEMA, spawns: [] };
  }
  return { schema: SPAWN_SCHEMA, spawns: record.spawns };
}

function saveSpawns(repoRoot, record) {
  const file = path.resolve(repoRoot, SPAWN_PATH);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  atomicWriteFile(file, JSON.stringify({
    schema: SPAWN_SCHEMA,
    spawns: record.spawns
  }, null, 2) + "\n");
}

function loadFamily(repoRoot) {
  const record = readJson(path.resolve(repoRoot, FAMILY_PATH), {
    schema: FAMILY_SCHEMA,
    children: []
  });
  if (!record || !Array.isArray(record.children)) {
    return { schema: FAMILY_SCHEMA, children: [] };
  }
  return { schema: FAMILY_SCHEMA, children: record.children };
}

function saveFamily(repoRoot, record) {
  const file = path.resolve(repoRoot, FAMILY_PATH);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  atomicWriteFile(file, JSON.stringify({
    schema: FAMILY_SCHEMA,
    children: record.children
  }, null, 2) + "\n");
}

function nextId(spawns) {
  let max = 0;
  for (const s of spawns) {
    const m = s && typeof s.id === "string" && s.id.match(/^s-(\d+)$/);
    if (m) {
      const n = Number(m[1]);
      if (Number.isFinite(n) && n > max) max = n;
    }
  }
  return `s-${String(max + 1).padStart(3, "0")}`;
}

function validateName(name) {
  if (typeof name !== "string") return "name_not_string";
  const trimmed = name.trim();
  if (!ALLOWED_NAME.test(trimmed)) return "name_pattern";
  if (RESERVED_NAMES.has(trimmed.toLowerCase())) return "name_reserved";
  return null;
}

// Risk scan: any of the supplied human text goes through scanTextRisk.
// scanTextRisk returns { safe, level, score, flags }. We treat
// any non-safe result as a refusal — better to false-positive a
// benign spawn than greenlight a drain attempt.
function riskScanSpec(input) {
  const blob = [
    String(input?.name || ""),
    String(input?.description || ""),
    String(input?.rationale || "")
  ].join("\n");
  const result = scanTextRisk(blob);
  const safe = Boolean(result && result.safe);
  const flags = Array.isArray(result?.flags) ? result.flags : [];
  return {
    ok: safe,
    risky: !safe,
    level: result?.level || "none",
    score: result?.score || 0,
    reasons: flags.map((f) => f.category || f.message).filter(Boolean)
  };
}

function normalizeBudget(input) {
  const daily = Number(input?.daily);
  const monthly = Number(input?.monthly);
  return {
    daily: Number.isFinite(daily) && daily >= 0 ? daily : DEFAULT_BUDGET.daily,
    monthly: Number.isFinite(monthly) && monthly >= 0 ? monthly : DEFAULT_BUDGET.monthly
  };
}

function proposeSpawn(repoRoot, input, deps = {}) {
  if (!repoRoot) throw new Error("spawn.proposeSpawn: repoRoot required");
  if (!input || typeof input !== "object") throw new Error("spawn.proposeSpawn: input required");

  // 1. Type check
  const type = String(input.type || "").toLowerCase();
  if (!VALID_TYPES.has(type)) {
    const err = new Error(`spawn: unknown type ${input.type}`);
    err.code = "INVALID_TYPE";
    throw err;
  }

  // 2. Name validation
  const nameIssue = validateName(input.name);
  if (nameIssue) {
    const err = new Error(`spawn: invalid name (${nameIssue}): ${input.name}`);
    err.code = "INVALID_NAME";
    throw err;
  }

  // 3. idemKey required
  if (!input.idemKey || typeof input.idemKey !== "string") {
    throw new Error("spawn: idemKey is required");
  }

  // 4. Idempotency check
  const record = loadSpawns(repoRoot);
  const existing = record.spawns.find((s) => s && s.idemKey === input.idemKey);
  if (existing) {
    return { ok: true, alreadyExisted: true, spawn: existing };
  }

  // 5. Risk scan — refuse risky specs before any record is created
  const risk = riskScanSpec(input);
  if (!risk.ok) {
    const err = new Error(`spawn: risk scan refused — ${risk.reasons.join(", ")}`);
    err.code = "RISKY_SPEC";
    err.risk = risk;
    throw err;
  }

  // 6. Visibility default + safety
  const visibility = input.visibility === "private" ? "private" : "public";

  // 7. Build the record
  const ts = nowIso(deps.now);
  const spawn = {
    id: nextId(record.spawns),
    idemKey: String(input.idemKey),
    type,
    name: String(input.name).trim(),
    description: String(input.description || "").slice(0, 200),
    rationale: String(input.rationale || "").slice(0, 2000),
    visibility,
    aiBudgetUsd: normalizeBudget(input.aiBudgetUsd),
    initialIssues: Array.isArray(input.initialIssues)
      ? input.initialIssues.slice(0, 5).map((i) => ({
          title: String(i?.title || "").slice(0, 120),
          body: String(i?.body || "").slice(0, 4000)
        }))
      : [],
    proposerUsername: input.proposerUsername
      ? String(input.proposerUsername).toLowerCase()
      : null,
    issueNumber: Number.isFinite(Number(input.issueNumber))
      ? Number(input.issueNumber)
      : null,
    status: STATUSES.PROPOSED,
    approvals: [],
    rejections: [],
    riskLevel: risk.level,
    createdAt: ts,
    quorumReachedAt: null,
    executedAt: null,
    childUrl: null,
    childRepoFullName: null,
    executionError: null,
    retryCount: 0,
    history: [{ ts, transition: "proposed", actor: input.proposerUsername || null }]
  };
  record.spawns.push(spawn);
  saveSpawns(repoRoot, record);
  return { ok: true, alreadyExisted: false, spawn };
}

// Reuse the same vote parser shape used by governance + handoff —
// matches APPROVE ORBIT-SPAWN / REJECT ORBIT-SPAWN with the same
// code-fence + blockquote + indent skips (Patch Set Q).
function parseSpawnComment(comment, idemKey, maintainers) {
  if (!comment || !idemKey) return null;
  const author = String(comment.author || comment.user || "").toLowerCase();
  if (!author) return null;
  const allowed = new Set(
    (Array.isArray(maintainers) ? maintainers : []).map((m) => String(m || "").toLowerCase())
  );
  if (!allowed.has(author)) return null;
  const idem = String(idemKey).trim();
  if (!idem) return null;
  const rawLines = String(comment.body || "").split(/\r?\n/);
  let inCodeFence = false;
  for (const raw of rawLines) {
    const trimmed = raw.trim();
    if (/^`{3,}/.test(trimmed)) { inCodeFence = !inCodeFence; continue; }
    if (inCodeFence) continue;
    if (/^>/.test(trimmed)) continue;
    if (/^ {4,}\S/.test(raw)) continue;
    const m = trimmed.match(/^(APPROVE|REJECT)\s+ORBIT-SPAWN\s+(\S+)$/);
    if (m && m[2] === idem) {
      return { kind: m[1], author, createdAt: comment.createdAt || comment.created_at || null };
    }
  }
  return null;
}

function thresholdForSpawn(quorum) {
  if (!quorum) return 1;
  const total = Array.isArray(quorum.maintainers) ? quorum.maintainers.length : 1;
  const thresholds = quorum.thresholds || {};
  return Math.max(1, Math.min(total, Number(thresholds.high) || total));
}

function applyComments(repoRoot, idemKey, comments, deps = {}) {
  const { quorum } = deps;
  if (!quorum || quorum.enabled !== true) {
    const err = new Error("spawn.applyComments: quorum must be enabled");
    err.code = "QUORUM_NOT_ENABLED";
    throw err;
  }
  const record = loadSpawns(repoRoot);
  const spawn = record.spawns.find((s) => s && s.idemKey === idemKey);
  if (!spawn) return { ok: false, reason: "not_found" };
  if ([STATUSES.COMPLETE, STATUSES.REJECTED, STATUSES.EXECUTING, STATUSES.FAILED].includes(spawn.status)) {
    return { ok: true, spawn, ignored: true };
  }
  const threshold = thresholdForSpawn(quorum);
  const ts = nowIso(deps.now);
  const approvals = new Set(spawn.approvals);
  const rejections = new Set(spawn.rejections);

  for (const c of comments || []) {
    const parsed = parseSpawnComment(c, idemKey, quorum.maintainers);
    if (!parsed) continue;
    if (parsed.kind === "APPROVE") {
      if (!approvals.has(parsed.author)) {
        approvals.add(parsed.author);
        spawn.history.push({ ts, transition: "approve", actor: parsed.author });
      }
    } else if (parsed.kind === "REJECT") {
      if (spawn.status === STATUSES.PROPOSED || spawn.status === STATUSES.VOTING) {
        rejections.add(parsed.author);
        spawn.history.push({ ts, transition: "reject", actor: parsed.author });
      } else {
        spawn.history.push({ ts, transition: "reject-ignored-post-quorum", actor: parsed.author });
      }
    }
  }

  if (rejections.size > 0 && (spawn.status === STATUSES.PROPOSED || spawn.status === STATUSES.VOTING)) {
    spawn.status = STATUSES.REJECTED;
    spawn.approvals = Array.from(approvals);
    spawn.rejections = Array.from(rejections);
    spawn.history.push({ ts, transition: "rejected" });
    saveSpawns(repoRoot, record);
    return { ok: true, spawn, transitions: ["rejected"] };
  }

  spawn.approvals = Array.from(approvals);
  spawn.rejections = Array.from(rejections);
  const transitions = [];

  if (spawn.status === STATUSES.PROPOSED && approvals.size > 0) {
    spawn.status = STATUSES.VOTING;
    spawn.history.push({ ts, transition: "voting" });
    transitions.push("voting");
  }
  if (
    (spawn.status === STATUSES.PROPOSED || spawn.status === STATUSES.VOTING) &&
    approvals.size >= threshold
  ) {
    spawn.status = STATUSES.APPROVED;
    spawn.quorumReachedAt = ts;
    spawn.history.push({ ts, transition: "approved", threshold });
    transitions.push("approved");
  }

  saveSpawns(repoRoot, record);
  return { ok: true, spawn, transitions };
}

// Cycle tick — pick up any APPROVED spawns and execute them via the
// injected executor. Failures are recorded; the proposal stays in
// FAILED until the operator retries (or REJECTs).
async function tickSpawns(repoRoot, deps = {}) {
  const record = loadSpawns(repoRoot);
  const result = { advanced: [], errors: [] };
  const executor = deps.executor;

  for (const spawn of record.spawns) {
    if (!spawn || spawn.status !== STATUSES.APPROVED) continue;

    spawn.status = STATUSES.EXECUTING;
    spawn.history.push({ ts: nowIso(deps.now), transition: "executing" });

    if (typeof executor !== "function") {
      // No executor — leave in EXECUTING with a marker for the
      // operator to wire one in (e.g., ORBIT_SPAWN_TOKEN).
      spawn.history.push({
        ts: nowIso(deps.now),
        transition: "executing-no-executor",
        note: "executor not wired — provide ORBIT_SPAWN_TOKEN to execute spawns from CI"
      });
      result.advanced.push({ id: spawn.id, status: spawn.status, ready: true });
      continue;
    }

    try {
      const outcome = await executor(spawn);
      spawn.executedAt = nowIso(deps.now);
      spawn.childUrl = outcome?.childUrl || null;
      spawn.childRepoFullName = outcome?.fullName || null;
      spawn.status = STATUSES.COMPLETE;
      spawn.history.push({
        ts: spawn.executedAt,
        transition: "complete",
        outcome: {
          childUrl: spawn.childUrl,
          fullName: spawn.childRepoFullName,
          dryRun: Boolean(outcome?.dryRun)
        }
      });

      // Record in family.json for the dashboard.
      const family = loadFamily(repoRoot);
      family.children.push({
        id: spawn.id,
        name: spawn.name,
        type: spawn.type,
        status: "live",
        url: spawn.childUrl,
        fullName: spawn.childRepoFullName,
        bornAt: spawn.executedAt,
        dryRun: Boolean(outcome?.dryRun)
      });
      saveFamily(repoRoot, family);

      result.advanced.push({ id: spawn.id, status: spawn.status, childUrl: spawn.childUrl });
    } catch (err) {
      spawn.status = STATUSES.FAILED;
      spawn.retryCount = (Number(spawn.retryCount) || 0) + 1;
      spawn.executionError = String(err?.message || err).slice(0, 1000);
      spawn.history.push({
        ts: nowIso(deps.now),
        transition: "failed",
        error: spawn.executionError,
        code: err?.code || null
      });
      result.errors.push({ id: spawn.id, error: spawn.executionError, code: err?.code || null });
    }
  }

  saveSpawns(repoRoot, record);
  return result;
}

function listSpawns(repoRoot) { return loadSpawns(repoRoot).spawns; }
function listFamily(repoRoot) { return loadFamily(repoRoot).children; }

module.exports = {
  SPAWN_PATH,
  FAMILY_PATH,
  SPAWN_SCHEMA,
  FAMILY_SCHEMA,
  STATUSES,
  VALID_TYPES,
  ALLOWED_NAME,
  RESERVED_NAMES,
  DEFAULT_BUDGET,
  loadSpawns,
  saveSpawns,
  loadFamily,
  saveFamily,
  validateName,
  riskScanSpec,
  parseSpawnComment,
  thresholdForSpawn,
  proposeSpawn,
  applyComments,
  tickSpawns,
  listSpawns,
  listFamily
};
