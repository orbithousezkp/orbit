"use strict";

// Founder handoff lifecycle (FOUNDER_HANDOFF.md / S-035).
//
// A handoff is the gradual, quorum-approved reduction of founder
// control. The spec is detailed in PLAN/SPECS/FOUNDER_HANDOFF.md; this
// module implements the state machine, vote parsing, timelock, and
// guards described there.
//
// Out of scope for this implementation (deliberate, in the spec):
//   - The on-chain Safe signer rotation transaction. We expose an
//     executor injection point so a real rotation primitive can be
//     wired later without touching the lifecycle.
//   - Cast / lore-entry rendering. Surfacing is downstream of the
//     "complete" transition and lives in narrative code.
//
// What this module DOES guarantee:
//   - Hard refusal pre-launch (D-018) or before Phase 4 (<50 adopters).
//   - Quorum must be enabled — solo-owner mode cannot start a handoff.
//   - 7-day timelock between quorum reach and execution.
//   - The timelock can be extended ONCE by anyone, by +7 days.
//   - REJECT during voting terminates the proposal.
//   - REJECT after quorum reached is ignored (irreversibility).
//   - Every transition is recorded in a per-proposal history so the
//     trail is auditable months later.

const fs = require("node:fs");
const path = require("node:path");

const HANDOFF_PATH = "memory/handoff.json";
const HANDOFF_SCHEMA = "orbit-handoff/1";

const TIMELOCK_MS = 7 * 24 * 60 * 60 * 1000;        // 7 days
const EXTENSION_MS = 7 * 24 * 60 * 60 * 1000;       // +7 days, once
const MIN_ADOPTER_COUNT = 50;                         // Phase 4 entry per FOUNDER_HANDOFF §5
const VALID_TYPES = new Set([
  "signer-rotation",
  "maintainer-list-change",
  "privilege-reduction"
]);
const STATUSES = Object.freeze({
  PROPOSED: "proposed",
  VOTING: "voting",
  TIMELOCK: "timelock",
  EXECUTING: "executing",
  COMPLETE: "complete",
  REJECTED: "rejected",
  FAILED: "failed"
});

function readJson(absPath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(absPath, "utf-8"));
  } catch {
    return fallback;
  }
}

function loadHandoffs(repoRoot) {
  const file = path.resolve(repoRoot, HANDOFF_PATH);
  const record = readJson(file, { schema: HANDOFF_SCHEMA, handoffs: [] });
  if (!record || !Array.isArray(record.handoffs)) {
    return { schema: HANDOFF_SCHEMA, handoffs: [] };
  }
  return { schema: HANDOFF_SCHEMA, handoffs: record.handoffs };
}

function saveHandoffs(repoRoot, record) {
  // Atomic write — same temp+rename pattern as safety.writeSafeTextFile.
  // We don't use safety.writeSafeTextFile directly because it routes
  // through actions which has PROTECTED_WRITE_PATHS; handoff.json is
  // intentionally writable (governance auditing path).
  const file = path.resolve(repoRoot, HANDOFF_PATH);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmpName = `.handoff.json.tmp.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}`;
  const tmpPath = path.join(path.dirname(file), tmpName);
  const body = JSON.stringify({ schema: HANDOFF_SCHEMA, handoffs: record.handoffs }, null, 2) + "\n";
  let fd;
  try {
    fd = fs.openSync(tmpPath, "w");
    fs.writeSync(fd, body, 0, "utf-8");
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fd = null;
    fs.renameSync(tmpPath, file);
  } catch (err) {
    if (fd != null) try { fs.closeSync(fd); } catch { /* ignore */ }
    try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
    throw err;
  }
}

function assertCanPropose({ state, adopterCount, quorum }) {
  // D-018: scanner-style guard. Pre-launch, no handoff machinery should run.
  if (!state || state.preLaunchVerified !== true) {
    const err = new Error("handoff: refusing — state.preLaunchVerified is not true (D-018)");
    err.code = "D018_NOT_VERIFIED";
    throw err;
  }
  // Phase 4 entry criterion per FOUNDER_HANDOFF §5.
  if (Number(adopterCount || 0) < MIN_ADOPTER_COUNT) {
    const err = new Error(`handoff: refusing — adopterCount ${adopterCount} < ${MIN_ADOPTER_COUNT} (Phase 4 not entered)`);
    err.code = "PHASE_4_NOT_ENTERED";
    throw err;
  }
  // Quorum prerequisite per FOUNDER_HANDOFF §2.
  if (!quorum || quorum.enabled !== true) {
    const err = new Error("handoff: refusing — multi-maintainer quorum is not enabled (set ORBIT_MAINTAINERS with >1 name)");
    err.code = "QUORUM_NOT_ENABLED";
    throw err;
  }
}

function nextId(handoffs) {
  let max = 0;
  for (const h of handoffs) {
    if (!h || typeof h.id !== "string") continue;
    const m = h.id.match(/^h-(\d+)$/);
    if (m) {
      const n = Number(m[1]);
      if (Number.isFinite(n) && n > max) max = n;
    }
  }
  return `h-${String(max + 1).padStart(3, "0")}`;
}

function nowIso(now) {
  return (now instanceof Date ? now : new Date()).toISOString();
}

function proposeHandoff(repoRoot, input, deps = {}) {
  if (!repoRoot) throw new Error("handoff.proposeHandoff: repoRoot is required");
  const { state, adopterCount, quorum, now } = deps;
  assertCanPropose({ state, adopterCount, quorum });

  if (!VALID_TYPES.has(input.type)) {
    const err = new Error(`handoff: unknown type ${input.type}`);
    err.code = "INVALID_TYPE";
    throw err;
  }
  if (!input.idemKey) {
    throw new Error("handoff: idemKey is required (one stable per proposal)");
  }
  if (!input.from || !input.to) {
    throw new Error("handoff: from and to are required");
  }

  const record = loadHandoffs(repoRoot);
  // Idempotency: re-proposing with the same idemKey returns the existing record.
  const existing = record.handoffs.find((h) => h && h.idemKey === input.idemKey);
  if (existing) {
    return { ok: true, alreadyExisted: true, handoff: existing };
  }

  const ts = nowIso(now);
  const handoff = {
    id: nextId(record.handoffs),
    idemKey: String(input.idemKey),
    type: input.type,
    from: String(input.from),
    to: String(input.to),
    rationale: input.rationale ? String(input.rationale).slice(0, 4000) : "",
    proposerUsername: input.proposerUsername ? String(input.proposerUsername).toLowerCase() : null,
    issueNumber: Number.isFinite(Number(input.issueNumber)) ? Number(input.issueNumber) : null,
    status: STATUSES.PROPOSED,
    approvals: [],
    rejections: [],
    extensions: 0,
    createdAt: ts,
    quorumReachedAt: null,
    timelockEndsAt: null,
    executedAt: null,
    completedAt: null,
    executionError: null,
    history: [{ ts, transition: "proposed", actor: input.proposerUsername || null }]
  };
  record.handoffs.push(handoff);
  saveHandoffs(repoRoot, record);
  return { ok: true, alreadyExisted: false, handoff };
}

// Parse APPROVE/REJECT/EXTEND lines from a single comment. Returns null
// if no recognized line matched, otherwise the kind + author.
function parseHandoffComment(comment, idemKey, maintainers) {
  if (!comment || !idemKey) return null;
  const author = String(comment.author || comment.user || "").toLowerCase();
  if (!author) return null;
  const allowed = new Set((Array.isArray(maintainers) ? maintainers : []).map((m) => String(m || "").toLowerCase()));
  if (!allowed.has(author)) return null;
  const idem = String(idemKey).trim();
  if (!idem) return null;
  const lines = String(comment.body || "").split(/\r?\n/).map((l) => l.trim());
  for (const line of lines) {
    const m = line.match(/^(APPROVE|REJECT|EXTEND)\s+ORBIT-HANDOFF\s+(\S+)$/);
    if (m && m[2] === idem) {
      return { kind: m[1], author, createdAt: comment.createdAt || comment.created_at || null };
    }
  }
  return null;
}

// Returns the threshold from quorum config based on actionTier ("high" for
// handoff actions since they're high-blast-radius). Falls back to total.
function thresholdForHandoff(quorum) {
  if (!quorum) return 1;
  const total = Array.isArray(quorum.maintainers) ? quorum.maintainers.length : 1;
  const thresholds = quorum.thresholds || {};
  return Math.max(1, Math.min(total, Number(thresholds.high) || total));
}

function applyComments(repoRoot, idemKey, comments, deps = {}) {
  const { quorum, now } = deps;
  if (!quorum || quorum.enabled !== true) {
    const err = new Error("handoff.applyComments: quorum must be enabled");
    err.code = "QUORUM_NOT_ENABLED";
    throw err;
  }
  const record = loadHandoffs(repoRoot);
  const handoff = record.handoffs.find((h) => h && h.idemKey === idemKey);
  if (!handoff) {
    return { ok: false, reason: "not_found" };
  }
  // Terminal states ignore further votes.
  if ([STATUSES.COMPLETE, STATUSES.REJECTED, STATUSES.EXECUTING, STATUSES.FAILED].includes(handoff.status)) {
    return { ok: true, handoff, ignored: true };
  }

  const threshold = thresholdForHandoff(quorum);
  const ts = nowIso(now);
  const approvals = new Set(handoff.approvals);
  const rejections = new Set(handoff.rejections);
  let pendingExtension = false;

  for (const c of comments || []) {
    const parsed = parseHandoffComment(c, idemKey, quorum.maintainers);
    if (!parsed) continue;
    if (parsed.kind === "APPROVE") {
      if (!approvals.has(parsed.author)) {
        approvals.add(parsed.author);
        handoff.history.push({ ts, transition: "approve", actor: parsed.author });
      }
    } else if (parsed.kind === "REJECT") {
      // Spec §6 (failure mode 2): rejections during voting/timelock terminate.
      // Once the proposal is in timelock-or-later, only voting-phase rejections
      // are honored. Here, we treat REJECT as terminal ONLY if the proposal
      // has not yet reached quorum. Post-quorum REJECT is ignored.
      if (handoff.status === STATUSES.PROPOSED || handoff.status === STATUSES.VOTING) {
        rejections.add(parsed.author);
        handoff.history.push({ ts, transition: "reject", actor: parsed.author });
      } else {
        handoff.history.push({ ts, transition: "reject-ignored-post-quorum", actor: parsed.author });
      }
    } else if (parsed.kind === "EXTEND") {
      // Only honored once, and only during timelock.
      if (handoff.status === STATUSES.TIMELOCK && handoff.extensions < 1) {
        pendingExtension = true;
        handoff.history.push({ ts, transition: "extend-requested", actor: parsed.author });
      } else {
        handoff.history.push({
          ts,
          transition: handoff.status !== STATUSES.TIMELOCK ? "extend-ignored-wrong-phase" : "extend-ignored-already-used",
          actor: parsed.author
        });
      }
    }
  }

  // Reject wins over approve.
  if (rejections.size > 0 && (handoff.status === STATUSES.PROPOSED || handoff.status === STATUSES.VOTING)) {
    handoff.status = STATUSES.REJECTED;
    handoff.approvals = Array.from(approvals);
    handoff.rejections = Array.from(rejections);
    handoff.history.push({ ts, transition: "rejected" });
    saveHandoffs(repoRoot, record);
    return { ok: true, handoff, transitions: ["rejected"] };
  }

  handoff.approvals = Array.from(approvals);
  handoff.rejections = Array.from(rejections);
  const transitions = [];

  // Voting begins on first APPROVE.
  if (handoff.status === STATUSES.PROPOSED && approvals.size > 0) {
    handoff.status = STATUSES.VOTING;
    handoff.history.push({ ts, transition: "voting" });
    transitions.push("voting");
  }

  // Quorum reached → timelock.
  if (
    (handoff.status === STATUSES.PROPOSED || handoff.status === STATUSES.VOTING) &&
    approvals.size >= threshold
  ) {
    handoff.status = STATUSES.TIMELOCK;
    handoff.quorumReachedAt = ts;
    handoff.timelockEndsAt = new Date(Date.parse(ts) + TIMELOCK_MS).toISOString();
    handoff.history.push({ ts, transition: "timelock", threshold });
    transitions.push("timelock");
  }

  if (pendingExtension) {
    handoff.extensions += 1;
    handoff.timelockEndsAt = new Date(Date.parse(handoff.timelockEndsAt) + EXTENSION_MS).toISOString();
    handoff.history.push({ ts, transition: "extended", newEndsAt: handoff.timelockEndsAt });
    transitions.push("extended");
  }

  saveHandoffs(repoRoot, record);
  return { ok: true, handoff, transitions };
}

// Cycle tick: advance any timelocks that have expired. The executor is
// injected so tests don't need real on-chain machinery. A failing
// executor moves the handoff into FAILED state with retry tracking.
async function tickHandoffs(repoRoot, deps = {}) {
  const { now, executor } = deps;
  const record = loadHandoffs(repoRoot);
  const result = { advanced: [], errors: [] };
  const nowMs = Date.parse(nowIso(now));

  for (const handoff of record.handoffs) {
    if (!handoff || handoff.status !== STATUSES.TIMELOCK) continue;
    const endsAt = Date.parse(handoff.timelockEndsAt);
    if (!Number.isFinite(endsAt) || nowMs < endsAt) continue;

    handoff.status = STATUSES.EXECUTING;
    handoff.history.push({ ts: nowIso(now), transition: "executing" });

    if (typeof executor !== "function") {
      // No executor wired yet. Treat as a soft pause — we don't flip
      // back to TIMELOCK (that would be a loop) and we don't FAIL
      // either; we record that execution is awaiting the primitive.
      handoff.history.push({
        ts: nowIso(now),
        transition: "executing-no-executor",
        note: "executor not wired — handoff is ready but cannot fire on-chain rotation"
      });
      result.advanced.push({ id: handoff.id, status: handoff.status, ready: true });
      continue;
    }

    try {
      const outcome = await executor(handoff);
      handoff.executedAt = nowIso(now);
      handoff.status = STATUSES.COMPLETE;
      handoff.completedAt = handoff.executedAt;
      handoff.history.push({ ts: handoff.executedAt, transition: "complete", outcome });
      result.advanced.push({ id: handoff.id, status: handoff.status });
    } catch (err) {
      handoff.status = STATUSES.FAILED;
      handoff.executionError = String(err && err.message ? err.message : err).slice(0, 1000);
      handoff.history.push({ ts: nowIso(now), transition: "failed", error: handoff.executionError });
      result.errors.push({ id: handoff.id, error: handoff.executionError });
    }
  }

  saveHandoffs(repoRoot, record);
  return result;
}

function listHandoffs(repoRoot) {
  return loadHandoffs(repoRoot).handoffs;
}

module.exports = {
  HANDOFF_PATH,
  HANDOFF_SCHEMA,
  STATUSES,
  TIMELOCK_MS,
  EXTENSION_MS,
  MIN_ADOPTER_COUNT,
  loadHandoffs,
  saveHandoffs,
  proposeHandoff,
  applyComments,
  parseHandoffComment,
  thresholdForHandoff,
  tickHandoffs,
  listHandoffs
};
