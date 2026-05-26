"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  logError,
  readRecentErrors,
  DEFAULT_LOG_PATH
} = require("../src/agent/error-log");

function tempRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "orbit-errlog-test-"));
  fs.mkdirSync(path.join(dir, "memory"), { recursive: true });
  return dir;
}

function readLog(repoRoot) {
  return fs.readFileSync(path.join(repoRoot, DEFAULT_LOG_PATH), "utf-8");
}

test("logError appends a JSONL line and creates the file if missing", () => {
  const repoRoot = tempRepo();
  const result = logError(repoRoot, {
    phase: "tool",
    tool: "create_issue",
    code: "FORBIDDEN",
    error: new Error("not allowed")
  });
  assert.equal(result.ok, true);
  const body = readLog(repoRoot);
  const lines = body.split("\n").filter(Boolean);
  assert.equal(lines.length, 1);
  const entry = JSON.parse(lines[0]);
  assert.equal(entry.phase, "tool");
  assert.equal(entry.tool, "create_issue");
  assert.equal(entry.code, "FORBIDDEN");
  assert.equal(entry.message, "not allowed");
  assert.ok(typeof entry.ts === "string");
});

test("logError appends multiple entries in order without overwriting", () => {
  const repoRoot = tempRepo();
  for (let i = 0; i < 5; i++) {
    logError(repoRoot, { phase: "tool", message: `error ${i}` });
  }
  const lines = readLog(repoRoot).split("\n").filter(Boolean);
  assert.equal(lines.length, 5);
  for (let i = 0; i < 5; i++) {
    assert.equal(JSON.parse(lines[i]).message, `error ${i}`);
  }
});

test("logError redacts secrets from message and stack", () => {
  const repoRoot = tempRepo();
  // safety.redactSecrets recognizes patterns like ghp_<30+ chars>.
  const fakeToken = "ghp_" + "a".repeat(35);
  logError(repoRoot, {
    phase: "github",
    message: `fetch failed with token ${fakeToken}`,
    error: { stack: `Error: 401\n  at fetch with header Authorization: Bearer ${fakeToken}` }
  });
  const body = readLog(repoRoot);
  assert.equal(body.includes(fakeToken), false, "raw token must not appear");
});

test("logError never throws — returns ok:false on bad input", () => {
  // No repo root.
  assert.equal(logError(null, { phase: "x" }).ok, false);
  assert.equal(logError("", { phase: "x" }).ok, false);
});

test("logError tolerates non-serializable context fields without throwing", () => {
  const repoRoot = tempRepo();
  const circular = {};
  circular.self = circular;
  const result = logError(repoRoot, {
    phase: "weird",
    message: "ok",
    context: circular
  });
  assert.equal(result.ok, true);
  const entry = JSON.parse(readLog(repoRoot).trim());
  // context just gets dropped silently — that's fine, the rest is intact.
  assert.equal(entry.message, "ok");
  assert.equal(entry.phase, "weird");
});

test("readRecentErrors returns the last N entries, parsed", () => {
  const repoRoot = tempRepo();
  for (let i = 0; i < 30; i++) {
    logError(repoRoot, { phase: "p", message: `m${i}` });
  }
  const recent = readRecentErrors(repoRoot, { limit: 5 });
  assert.equal(recent.length, 5);
  assert.equal(recent[0].message, "m25");
  assert.equal(recent[4].message, "m29");
});

test("readRecentErrors returns [] when the log doesn't exist yet", () => {
  const repoRoot = tempRepo();
  assert.deepEqual(readRecentErrors(repoRoot), []);
});

test("rotation: a log past maxLines is trimmed to trimTo on next append", () => {
  // Use small caps so the test runs fast.
  const repoRoot = tempRepo();
  const opts = { maxLines: 20, trimTo: 10 };
  // First fill past 64KB so rotateIfNeeded actually inspects line count.
  // Easiest: write a single big synthetic line, then many small ones.
  const big = "x".repeat(64 * 1024);
  logError(repoRoot, { phase: "p", message: big }, opts);
  for (let i = 0; i < 30; i++) {
    logError(repoRoot, { phase: "p", message: `m${i}` }, opts);
  }
  const lines = readLog(repoRoot).split("\n").filter(Boolean);
  // After the trim, the file should have ~trimTo entries — the most
  // recent ones. Allow some slack because rotation only fires once
  // the limit is exceeded on a new append.
  assert.ok(lines.length <= 20, `expected <=20 lines after trim, got ${lines.length}`);
  // Last line must be the most recent message.
  const lastEntry = JSON.parse(lines[lines.length - 1]);
  assert.equal(lastEntry.message, "m29");
});
