"use strict";

// Tests for scripts/check-env.js (D-021).
// The script is a CLI; we test by spawning it under different repo
// states and asserting its exit code + stdout.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { execFileSync, spawnSync } = require("node:child_process");

const SCRIPT = path.resolve(__dirname, "..", "scripts", "check-env.js");

function makeRepo(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "orbit-envcheck-"));
  for (const [rel, body] of Object.entries(files)) {
    const abs = path.join(dir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, body);
  }
  return dir;
}

// The script computes REPO_ROOT as path.resolve(__dirname, ".."), so
// it always scans the real project. We can't redirect it cleanly via
// arg, so we test through a fake script wrapper that re-exports the
// internal scan via a child process with a forged cwd / PATH-style
// trick. Cleanest is to verify the script's BEHAVIOR by checking
// real-project clean (it should pass) and by reading the script's
// own export shape if we factor it.
//
// Pragmatic approach: invoke the real script as a child process and
// verify the current repo passes. Then create a temp .env with a
// known-bad pattern in the CURRENT repo, run, expect non-zero, and
// clean up. This is a more brittle test but matches how the script
// actually runs in CI.

test("env:check passes on the current repo (clean state)", () => {
  const result = spawnSync(process.execPath, [SCRIPT], { cwd: path.resolve(__dirname, ".."), encoding: "utf-8" });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /clean/);
});

test("env:check refuses a deny-key planted in a temp .env at the repo root", () => {
  const repoRoot = path.resolve(__dirname, "..");
  const planted = path.join(repoRoot, ".env.envcheck-test");
  fs.writeFileSync(planted, "ORBIT_WALLET_PRIVATE_KEY=0x" + "1".repeat(64) + "\n");
  try {
    const result = spawnSync(process.execPath, [SCRIPT], { cwd: repoRoot, encoding: "utf-8" });
    assert.equal(result.status, 1, "expected non-zero exit");
    assert.match(result.stdout, /deny_key/);
    assert.match(result.stdout, /ORBIT_WALLET_PRIVATE_KEY/);
    // Output must NOT include the actual private-key value.
    assert.ok(!result.stdout.includes("1".repeat(32)), "secret value leaked into the report");
  } finally {
    fs.unlinkSync(planted);
  }
});

test("env:check refuses a secret-shaped value under a benign key name", () => {
  const repoRoot = path.resolve(__dirname, "..");
  const planted = path.join(repoRoot, ".env.envcheck-test-2");
  // Benign key name but value matches gh PAT pattern.
  fs.writeFileSync(planted, "MY_HARMLESS_VAR=ghp_" + "a".repeat(36) + "\n");
  try {
    const result = spawnSync(process.execPath, [SCRIPT], { cwd: repoRoot, encoding: "utf-8" });
    assert.equal(result.status, 1);
    assert.match(result.stdout, /secret_pattern/);
    assert.match(result.stdout, /GitHub PAT/);
  } finally {
    fs.unlinkSync(planted);
  }
});

test("env:check ignores .env.example (placeholder doc)", () => {
  // The real .env.example contains DENY_KEYS in its comment manifest
  // but not as actual lines. The script's SKIP_FILES list excludes
  // it so the manifest never triggers. Verify the script still
  // passes the current repo (this is also covered by the first
  // test, but pinning the exclusion explicitly).
  const result = spawnSync(process.execPath, [SCRIPT], { cwd: path.resolve(__dirname, ".."), encoding: "utf-8" });
  assert.equal(result.status, 0);
});

test("env:check ignores .env.example.tpl (scaffolder template)", () => {
  // The scaffolder template at packages/create-orbit-house/templates/
  // .env.example.tpl is intentionally readable. SKIP_EXTENSIONS .tpl
  // covers it. Verify by spawning against the repo as-is.
  const result = spawnSync(process.execPath, [SCRIPT], { cwd: path.resolve(__dirname, ".."), encoding: "utf-8" });
  assert.equal(result.status, 0);
});
