"use strict";

// Persistent structured error log.
//
// Until Patch Set M, errors caught in the cycle loop were either
// swallowed silently or written to console.error — which is lost the
// next time GitHub Actions rotates the runner. For an autonomous agent
// that nobody is watching, this means a maintainer has zero trail to
// debug "why did the cycle quietly drop a tool yesterday?"
//
// The log is one JSONL file at memory/errors.jsonl. Each line is a
// self-contained entry. The file rotates in place: when it exceeds a
// soft cap (default 5000 lines), the oldest 1000 lines are dropped so
// the file never grows unbounded but recent context is always intact.
//
// Design notes:
//   - Single file (not per-cycle) so a maintainer reads one place.
//   - JSONL (not JSON array) so partial reads / tail -F work.
//   - Synchronous writes (we're in a node:test/cycle context; the cost
//     is negligible compared to the LLM call we just logged).
//   - Redacts secrets via safety.redactSecrets so a stack trace or
//     fetch URL with a token cannot leak into a committed log.
//   - Best-effort: logging an error must NEVER throw. The fatal handler
//     calls this from its catch — re-throwing would mask the real bug.

const fs = require("node:fs");
const path = require("node:path");
const { redactSecrets } = require("./safety");

const DEFAULT_LOG_PATH = "memory/errors.jsonl";
const DEFAULT_MAX_LINES = 5000;
const DEFAULT_TRIM_TO = 4000;

function nowIso() {
  return new Date().toISOString();
}

function safeRedact(value) {
  if (value == null) return value;
  try {
    return redactSecrets(String(value));
  } catch {
    return String(value);
  }
}

function normalizeEntry(input = {}) {
  const entry = {
    ts: typeof input.ts === "string" ? input.ts : nowIso(),
    phase: typeof input.phase === "string" ? input.phase : "unknown",
    message: safeRedact(input.message || input.error?.message || String(input.error || ""))
  };
  if (input.cycle != null) entry.cycle = Number(input.cycle) || null;
  if (input.tool) entry.tool = String(input.tool);
  if (input.code) entry.code = String(input.code);
  if (input.context) {
    // Caller-supplied context: redact, cap to keep entries small.
    try {
      const json = JSON.stringify(input.context);
      entry.context = safeRedact(json).slice(0, 2000);
    } catch {
      // ignore non-serializable context
    }
  }
  if (input.error && input.error.stack) {
    entry.stack = safeRedact(String(input.error.stack)).slice(0, 4000);
  } else if (input.stack) {
    entry.stack = safeRedact(String(input.stack)).slice(0, 4000);
  }
  return entry;
}

function rotateIfNeeded(absPath, maxLines, trimTo) {
  // Cheap line-count via byte read. If the file is small (most cycles),
  // this is a quick stat-and-skip. Only when we cross maxLines do we
  // rewrite, and even then it's once per ~1000 errors.
  let stat;
  try {
    stat = fs.statSync(absPath);
  } catch {
    return;
  }
  if (stat.size < 64 * 1024) return; // small files: skip the line count
  let contents;
  try {
    contents = fs.readFileSync(absPath, "utf-8");
  } catch {
    return;
  }
  const lines = contents.split("\n");
  // Last element is the trailing "" after a final newline; treat as empty.
  const populated = lines[lines.length - 1] === "" ? lines.slice(0, -1) : lines;
  if (populated.length <= maxLines) return;
  const trimmed = populated.slice(populated.length - trimTo);
  try {
    fs.writeFileSync(absPath, trimmed.join("\n") + "\n", "utf-8");
  } catch {
    // Best-effort: if we can't rewrite, the next append still works and
    // the file just grows a bit more before the next attempt.
  }
}

function logError(repoRoot, input = {}, options = {}) {
  if (!repoRoot) return { ok: false, reason: "no_repo_root" };
  const logPath = options.logPath || DEFAULT_LOG_PATH;
  const maxLines = options.maxLines || DEFAULT_MAX_LINES;
  const trimTo = options.trimTo || DEFAULT_TRIM_TO;
  try {
    const absPath = path.resolve(repoRoot, logPath);
    fs.mkdirSync(path.dirname(absPath), { recursive: true });
    rotateIfNeeded(absPath, maxLines, trimTo);
    const entry = normalizeEntry(input);
    fs.appendFileSync(absPath, JSON.stringify(entry) + "\n", "utf-8");
    return { ok: true, path: logPath, entry };
  } catch (err) {
    // Best-effort: never throw. The caller is already in a catch.
    return { ok: false, reason: "write_failed", error: err.message };
  }
}

function readRecentErrors(repoRoot, options = {}) {
  // Maintainer-facing helper. Read the last N lines for dashboard or
  // CLI surfacing. Defensive on missing/malformed entries.
  if (!repoRoot) return [];
  const limit = options.limit || 50;
  const logPath = options.logPath || DEFAULT_LOG_PATH;
  try {
    const absPath = path.resolve(repoRoot, logPath);
    const contents = fs.readFileSync(absPath, "utf-8");
    const lines = contents.split("\n").filter((l) => l.length > 0);
    return lines.slice(-limit).map((line) => {
      try { return JSON.parse(line); } catch { return { raw: line, parseFailed: true }; }
    });
  } catch {
    return [];
  }
}

module.exports = {
  logError,
  readRecentErrors,
  DEFAULT_LOG_PATH,
  DEFAULT_MAX_LINES,
  DEFAULT_TRIM_TO
};
