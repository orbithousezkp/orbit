"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { scanMemoryIntegrity } = require("../src/agent/memory-scan");

// F-1.3 (PLAN/ROADMAP_EXPANSION.md): detect corruption / drift in
// memory/*.json before a cycle reads them.

function tempRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "orbit-memscan-"));
  fs.mkdirSync(path.join(dir, "memory"), { recursive: true });
  return dir;
}

function writeMem(repo, name, content) {
  fs.writeFileSync(path.join(repo, "memory", name), content, "utf-8");
}

test("scanMemoryIntegrity: clean repo → ok with no issues", () => {
  const repo = tempRepo();
  writeMem(repo, "state.json", JSON.stringify({ cycle: 1 }));
  writeMem(repo, "governance.json", JSON.stringify({ ownerUsername: "" }));
  const result = scanMemoryIntegrity(repo);
  assert.equal(result.ok, true);
  assert.equal(result.healthy, true);
  assert.equal(result.issues.length, 0);
  assert.equal(result.scanned, 2);
});

test("scanMemoryIntegrity: missing required file → issue kind=missing", () => {
  const repo = tempRepo();
  writeMem(repo, "governance.json", JSON.stringify({ ownerUsername: "" }));
  const result = scanMemoryIntegrity(repo, { required: ["state.json", "governance.json"] });
  assert.equal(result.ok, true);
  assert.equal(result.healthy, false);
  const missing = result.issues.find((i) => i.kind === "missing");
  assert.ok(missing);
  assert.equal(missing.file, "state.json");
});

test("scanMemoryIntegrity: parse error → issue kind=parse_error", () => {
  const repo = tempRepo();
  writeMem(repo, "state.json", "{not valid json");
  const result = scanMemoryIntegrity(repo);
  assert.equal(result.healthy, false);
  const parse = result.issues.find((i) => i.kind === "parse_error");
  assert.ok(parse);
  assert.equal(parse.file, "state.json");
  assert.ok(parse.detail.length > 0);
});

test("scanMemoryIntegrity: empty file → issue kind=empty_file", () => {
  const repo = tempRepo();
  writeMem(repo, "state.json", "");
  const result = scanMemoryIntegrity(repo);
  assert.equal(result.healthy, false);
  const empty = result.issues.find((i) => i.kind === "empty_file");
  assert.ok(empty);
});

test("scanMemoryIntegrity: atomic-write tmp leftover → issue kind=tmp_leftover", () => {
  const repo = tempRepo();
  writeMem(repo, "state.json", JSON.stringify({ cycle: 1 }));
  writeMem(repo, ".state.json.tmp.abc123", "{}"); // leaked atomic-write temp
  const result = scanMemoryIntegrity(repo);
  assert.equal(result.healthy, false);
  const leftover = result.issues.find((i) => i.kind === "tmp_leftover");
  assert.ok(leftover);
  assert.match(leftover.file, /\.tmp\./);
});

test("scanMemoryIntegrity: key drift — required top-level key missing", () => {
  const repo = tempRepo();
  writeMem(repo, "state.json", JSON.stringify({ /* no cycle */ }));
  const result = scanMemoryIntegrity(repo, {
    schemas: { "state.json": ["cycle"] }
  });
  assert.equal(result.healthy, false);
  const drift = result.issues.find((i) => i.kind === "key_drift");
  assert.ok(drift);
  assert.equal(drift.file, "state.json");
  assert.match(drift.detail, /cycle/);
});

test("scanMemoryIntegrity: schema-listed key present → no drift issue", () => {
  const repo = tempRepo();
  writeMem(repo, "state.json", JSON.stringify({ cycle: 5, born: "..." }));
  const result = scanMemoryIntegrity(repo, {
    schemas: { "state.json": ["cycle"] }
  });
  assert.equal(result.issues.length, 0);
  assert.equal(result.healthy, true);
});

test("scanMemoryIntegrity: no memory dir → ok:false, healthy:false", () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), "orbit-memscan-nodir-"));
  const result = scanMemoryIntegrity(repo);
  assert.equal(result.ok, false);
  assert.equal(result.healthy, false);
  assert.equal(result.reason, "memory_dir_missing");
});

test("scanMemoryIntegrity: bad repoRoot → ok:false (best-effort, never throws)", () => {
  const result = scanMemoryIntegrity(null);
  assert.equal(result.ok, false);
  assert.equal(result.reason, "no_repo_root");
});

test("scanMemoryIntegrity: scans only .json files (skips .md, dirs)", () => {
  const repo = tempRepo();
  writeMem(repo, "state.json", JSON.stringify({ cycle: 1 }));
  writeMem(repo, "identity.md", "# Identity");
  fs.mkdirSync(path.join(repo, "memory", "cycles"));
  const result = scanMemoryIntegrity(repo);
  assert.equal(result.scanned, 1, "only state.json counted");
});
