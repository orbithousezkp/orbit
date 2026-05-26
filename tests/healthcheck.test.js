"use strict";

// Tests for the nightly healthcheck CLI. It's a small script with a
// few stat/parse operations, but its job is to fail when something is
// wrong — that's load-bearing once the nightly workflow is alarming
// off it.

const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const SCRIPT = path.resolve(__dirname, "..", "src", "cli", "orbit-healthcheck.js");

function runHealthcheck(repoRoot) {
  try {
    const out = execFileSync(process.execPath, [SCRIPT], {
      // Point the script at a synthetic repo via cwd-relative path math.
      // The script computes REPO_ROOT as ../.. from its own directory,
      // so we can't easily move it. Instead we'll write the synthetic
      // state to the SCRIPT_REPO_ROOT and snapshot/restore.
      cwd: repoRoot,
      env: process.env,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"]
    });
    return { ok: true, stdout: out };
  } catch (err) {
    return { ok: false, code: err.status, stdout: err.stdout, stderr: err.stderr };
  }
}

// The healthcheck script uses path.resolve(__dirname, "..", "..") to
// find the repo root — which means it'll always inspect the REAL
// project. To unit-test it in isolation we'd need to vendor the script
// or refactor it to take a repoRoot argument. Instead these tests
// exercise the project as-is and verify the EXIT CODE and OUTPUT
// SHAPE — which is what the workflow actually depends on.

test("orbit-healthcheck prints structured per-check lines", () => {
  const result = runHealthcheck(path.resolve(__dirname, ".."));
  const out = result.stdout || "";
  // Either pass or fail — but the per-check lines should be present.
  assert.match(out, /\[(ok|warn|fail)\]\s+state\.json/);
  assert.match(out, /summary:\s+\d+\s+pass/);
});

test("orbit-healthcheck exits non-zero when any check FAILs", () => {
  // Indirectly verified: the freshness check FAILs in local dev (cycle
  // older than 3h), and the script exits 1. We accept either outcome
  // because a fresh-from-CI checkout may also FAIL. The point is exit
  // code matches the summary.
  const result = runHealthcheck(path.resolve(__dirname, ".."));
  const out = result.stdout || "";
  const hasFail = /\[fail\]/.test(out);
  if (hasFail) {
    assert.equal(result.ok, false, "FAIL line must produce non-zero exit");
  } else {
    assert.equal(result.ok, true, "no FAIL means exit 0");
  }
});

test("orbit-healthcheck mentions all five checks by name", () => {
  // Drift detector — if a future patch removes a check, this test
  // catches it. The names are stable strings used by the issue body
  // template in the workflow.
  const result = runHealthcheck(path.resolve(__dirname, ".."));
  const out = result.stdout || "";
  for (const name of [
    "state.json",
    "launch-persist-failure",
    "latest-cycle"
  ]) {
    assert.ok(out.includes(name), `missing check name "${name}" in output`);
  }
  // The cycle-freshness and errors checks are conditional on state.json
  // existing — they should be present in the typical case.
  assert.match(out, /cycle-freshness|state\.json: missing/);
  assert.match(out, /errors-recent-24h|errors\.jsonl: no log/);
});

test("orbit-healthcheck respects the MAX_CYCLE_AGE_MS threshold (read from source)", () => {
  // Regression catch: someone could relax MAX_CYCLE_AGE_MS to 24h
  // silently, defeating the alarm. Pin the constant via the source file.
  const src = fs.readFileSync(SCRIPT, "utf-8");
  const m = src.match(/MAX_CYCLE_AGE_MS\s*=\s*(\d+)\s*\*\s*60\s*\*\s*60\s*\*\s*1000/);
  assert.ok(m, "MAX_CYCLE_AGE_MS declaration not found in expected form");
  const hours = Number(m[1]);
  assert.ok(hours >= 1 && hours <= 6, `MAX_CYCLE_AGE_MS=${hours}h is outside the sane range (1–6h)`);
});
