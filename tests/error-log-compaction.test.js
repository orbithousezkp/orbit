"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  COMPACTION_MAX_AGE_DAYS,
  COMPACTION_ARCHIVE_PREFIX,
  compactOldEntries,
  logError,
  readRecentErrors
} = require("../src/agent/error-log");

// F-1.5 (PLAN/ROADMAP_EXPANSION.md): rotate older entries from
// memory/errors.jsonl into memory/errors-YYYY-MM.jsonl archives after 30
// days. Existing soft-cap rotate-in-place stays. Compaction is a separate,
// opt-in operation.

const DAY_MS = 24 * 60 * 60 * 1000;

function tempRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "orbit-errlog-compact-"));
  fs.mkdirSync(path.join(dir, "memory"), { recursive: true });
  return dir;
}

test("COMPACTION_MAX_AGE_DAYS defaults to 30", () => {
  assert.equal(COMPACTION_MAX_AGE_DAYS, 30);
});

test("COMPACTION_ARCHIVE_PREFIX is 'errors-' (YYYY-MM suffix appended)", () => {
  assert.equal(COMPACTION_ARCHIVE_PREFIX, "errors-");
});

test("compactOldEntries: no-op when file does not exist", () => {
  const repo = tempRepo();
  const result = compactOldEntries(repo, { now: new Date("2026-05-28T00:00:00Z") });
  assert.equal(result.ok, true);
  assert.equal(result.archived, 0);
  assert.equal(result.kept, 0);
});

test("compactOldEntries: keeps all entries when all are fresher than 30 days", () => {
  const repo = tempRepo();
  const now = new Date("2026-05-28T00:00:00Z");
  logError(repo, { ts: new Date(now.getTime() - 5 * DAY_MS).toISOString(), phase: "a", message: "recent" });
  logError(repo, { ts: new Date(now.getTime() - 25 * DAY_MS).toISOString(), phase: "b", message: "still recent" });

  const result = compactOldEntries(repo, { now });
  assert.equal(result.archived, 0);
  assert.equal(result.kept, 2);
  // Live log still has both entries
  assert.equal(readRecentErrors(repo).length, 2);
});

test("compactOldEntries: moves entries >30 days into monthly archive", () => {
  const repo = tempRepo();
  const now = new Date("2026-05-28T00:00:00Z");
  // Two old entries from March, one fresh
  logError(repo, { ts: "2026-03-05T10:00:00Z", phase: "old1", message: "march one" });
  logError(repo, { ts: "2026-03-20T10:00:00Z", phase: "old2", message: "march two" });
  logError(repo, { ts: new Date(now.getTime() - 5 * DAY_MS).toISOString(), phase: "fresh", message: "recent" });

  const result = compactOldEntries(repo, { now });
  assert.equal(result.archived, 2);
  assert.equal(result.kept, 1);
  assert.deepEqual(Object.keys(result.archives).sort(), ["errors-2026-03.jsonl"]);

  // Live log: only the fresh entry
  const live = readRecentErrors(repo);
  assert.equal(live.length, 1);
  assert.equal(live[0].phase, "fresh");

  // Archive: both old entries
  const archivePath = path.join(repo, "memory", "errors-2026-03.jsonl");
  const archived = fs.readFileSync(archivePath, "utf-8")
    .split("\n")
    .filter((l) => l)
    .map(JSON.parse);
  assert.equal(archived.length, 2);
  assert.deepEqual(archived.map((e) => e.phase).sort(), ["old1", "old2"]);
});

test("compactOldEntries: splits old entries across multiple monthly archives", () => {
  const repo = tempRepo();
  const now = new Date("2026-05-28T00:00:00Z");
  logError(repo, { ts: "2026-01-15T10:00:00Z", phase: "jan", message: "jan" });
  logError(repo, { ts: "2026-02-15T10:00:00Z", phase: "feb", message: "feb" });
  logError(repo, { ts: "2026-03-15T10:00:00Z", phase: "mar", message: "mar" });

  const result = compactOldEntries(repo, { now });
  assert.equal(result.archived, 3);
  assert.deepEqual(
    Object.keys(result.archives).sort(),
    ["errors-2026-01.jsonl", "errors-2026-02.jsonl", "errors-2026-03.jsonl"]
  );
});

test("compactOldEntries: appends to existing archive instead of overwriting", () => {
  const repo = tempRepo();
  const now = new Date("2026-05-28T00:00:00Z");
  // Pre-seed an archive
  const archivePath = path.join(repo, "memory", "errors-2026-03.jsonl");
  fs.writeFileSync(
    archivePath,
    JSON.stringify({ ts: "2026-03-01T00:00:00Z", phase: "pre-existing", message: "p" }) + "\n",
    "utf-8"
  );
  // Live log has one March entry that should compact into the same archive
  logError(repo, { ts: "2026-03-20T10:00:00Z", phase: "new-archive", message: "n" });

  const result = compactOldEntries(repo, { now });
  assert.equal(result.archived, 1);

  const archived = fs.readFileSync(archivePath, "utf-8")
    .split("\n")
    .filter((l) => l)
    .map(JSON.parse);
  assert.equal(archived.length, 2, "must append, not overwrite");
  assert.deepEqual(archived.map((e) => e.phase).sort(), ["new-archive", "pre-existing"]);
});

test("compactOldEntries: malformed entries are kept in live log (no data loss)", () => {
  const repo = tempRepo();
  const now = new Date("2026-05-28T00:00:00Z");
  const livePath = path.join(repo, "memory", "errors.jsonl");
  fs.writeFileSync(
    livePath,
    "not-valid-json\n" +
    JSON.stringify({ ts: "2026-03-01T00:00:00Z", phase: "old", message: "o" }) + "\n",
    "utf-8"
  );
  const result = compactOldEntries(repo, { now });
  assert.equal(result.archived, 1);
  const live = fs.readFileSync(livePath, "utf-8");
  // Malformed line preserved in live log; old JSON entry moved to archive.
  assert.match(live, /not-valid-json/);
});

test("compactOldEntries: best-effort — returns ok:false on write error, never throws", () => {
  const result = compactOldEntries(null, {});
  assert.equal(result.ok, false);
  assert.equal(result.reason, "no_repo_root");
});
