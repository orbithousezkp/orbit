"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const {
  gatherBusFactorInputs,
  loadAdoptersForBusFactor,
  loadCommitsFromGit
} = require("../src/agent/bus-factor-data");

function tmpDir(label) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `orbit-bf-data-${label || ""}-`));
}

function rm(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
}

function makeRepoWithCommits(commitCount) {
  const dir = tmpDir("repo");
  execFileSync("git", ["init", "-q", "-b", "main"], { cwd: dir });
  execFileSync("git", ["config", "user.email", "test-bf@example.com"], { cwd: dir });
  execFileSync("git", ["config", "user.name", "Test BF"], { cwd: dir });
  for (let i = 0; i < commitCount; i += 1) {
    fs.writeFileSync(path.join(dir, `f${i}.txt`), `c${i}\n`);
    execFileSync("git", ["add", "."], { cwd: dir });
    execFileSync("git", ["commit", "-q", "-m", `c${i}`], { cwd: dir });
  }
  return dir;
}

test("loadCommitsFromGit on current orbit repo returns at least 1 commit", () => {
  const repoRoot = path.resolve(__dirname, "..");
  const commits = loadCommitsFromGit(repoRoot, { sinceDays: 365 });
  assert.ok(Array.isArray(commits));
  assert.ok(commits.length >= 1, "expected at least 1 commit in lookback window");
  const sample = commits[0];
  assert.equal(typeof sample.sha, "string");
  assert.ok(sample.sha.length >= 7);
  assert.equal(typeof sample.author, "object");
  assert.equal(typeof sample.authoredDate, "string");
  // authoredDate must parse to a finite timestamp.
  assert.ok(Number.isFinite(Date.parse(sample.authoredDate)));
});

test("loadCommitsFromGit on a non-git directory returns []", () => {
  const dir = tmpDir("nogit");
  try {
    const commits = loadCommitsFromGit(dir, { sinceDays: 30 });
    assert.deepEqual(commits, []);
  } finally {
    rm(dir);
  }
});

test("loadCommitsFromGit defaults to a sane lookback when sinceDays is missing", () => {
  const repoRoot = path.resolve(__dirname, "..");
  const commits = loadCommitsFromGit(repoRoot, {});
  assert.ok(Array.isArray(commits));
});

test("loadCommitsFromGit handles a missing/invalid repoRoot defensively", () => {
  assert.deepEqual(loadCommitsFromGit(null, { sinceDays: 30 }), []);
  assert.deepEqual(loadCommitsFromGit("", { sinceDays: 30 }), []);
  assert.deepEqual(loadCommitsFromGit("/path/that/should/not/exist/zzz", { sinceDays: 30 }), []);
});

test("loadAdoptersForBusFactor with missing registry returns []", () => {
  const dir = tmpDir("no-reg");
  try {
    const out = loadAdoptersForBusFactor(dir);
    assert.deepEqual(out, []);
  } finally {
    rm(dir);
  }
});

test("loadAdoptersForBusFactor with malformed registry returns []", () => {
  const dir = tmpDir("bad-reg");
  try {
    fs.mkdirSync(path.join(dir, "memory"), { recursive: true });
    fs.writeFileSync(path.join(dir, "memory", "adopters-registry.json"), "{not json");
    const out = loadAdoptersForBusFactor(dir);
    assert.deepEqual(out, []);
  } finally {
    rm(dir);
  }
});

test("loadAdoptersForBusFactor maps verified adopter rows correctly", () => {
  const dir = tmpDir("ok-reg");
  try {
    fs.mkdirSync(path.join(dir, "memory"), { recursive: true });
    const registry = {
      schema: "orbit-adopters/1",
      updatedAt: "2026-05-25T00:00:00Z",
      adopters: [
        {
          repo: "owner/verified-one",
          status: "verified",
          adopted: true,
          verifiedAt: "2026-05-20T00:00:00Z",
          lastSeen: "2026-05-24T00:00:00Z",
          handshakeAt: "2026-05-19T00:00:00Z",
          metrics: { missionsExecuted: 5 }
        },
        {
          repo: "owner/handshake-only",
          status: "handshake-pending",
          adopted: false,
          verifiedAt: null,
          handshakeAt: "2026-05-22T00:00:00Z"
        },
        {
          repo: "owner/cycle-count-fallback",
          status: "active",
          cycleCount: 3,
          lastSeen: "2026-05-23T00:00:00Z"
        }
      ]
    };
    fs.writeFileSync(
      path.join(dir, "memory", "adopters-registry.json"),
      JSON.stringify(registry, null, 2)
    );
    const out = loadAdoptersForBusFactor(dir);
    // verified + cycle-count fallback are kept; handshake-only is dropped
    assert.equal(out.length, 2);
    const verifiedOne = out.find((a) => a.repo === "owner/verified-one");
    assert.ok(verifiedOne);
    assert.equal(verifiedOne.missionsExecuted, 5);
    assert.equal(verifiedOne.lastActiveAt, "2026-05-24T00:00:00Z");
    const cycleFallback = out.find((a) => a.repo === "owner/cycle-count-fallback");
    assert.ok(cycleFallback);
    assert.equal(cycleFallback.missionsExecuted, 3);
  } finally {
    rm(dir);
  }
});

test("gatherBusFactorInputs combines commits + adopters", () => {
  const dir = makeRepoWithCommits(2);
  try {
    fs.mkdirSync(path.join(dir, "memory"), { recursive: true });
    fs.writeFileSync(
      path.join(dir, "memory", "adopters-registry.json"),
      JSON.stringify({
        schema: "orbit-adopters/1",
        adopters: [
          {
            repo: "owner/x",
            status: "verified",
            adopted: true,
            verifiedAt: "2026-05-20T00:00:00Z",
            lastSeen: "2026-05-24T00:00:00Z",
            metrics: { missionsExecuted: 2 }
          }
        ]
      })
    );
    const result = gatherBusFactorInputs(dir, { ORBIT_BUS_FACTOR_LOOKBACK_DAYS: "365" });
    assert.ok(Array.isArray(result.commits));
    assert.ok(Array.isArray(result.adopters));
    assert.equal(result.commits.length, 2);
    assert.equal(result.adopters.length, 1);
  } finally {
    rm(dir);
  }
});

test("gatherBusFactorInputs falls back to default lookback on bad env", () => {
  // ORBIT_BUS_FACTOR_LOOKBACK_DAYS="abc" should not throw; we fall back to the default.
  const repoRoot = path.resolve(__dirname, "..");
  const result = gatherBusFactorInputs(repoRoot, { ORBIT_BUS_FACTOR_LOOKBACK_DAYS: "abc" });
  assert.ok(Array.isArray(result.commits));
  assert.ok(Array.isArray(result.adopters));
});
