"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const REPO_ROOT = path.resolve(__dirname, "..");
const CLI_PATH = path.join(REPO_ROOT, "packages", "orbit-sdk", "cli.js");
const SAFE_BUDGET_KEYS = ["canUseAi", "note", "policy", "status"];
const FORBIDDEN_DETAIL_KEYS = [
  "dailyBudgetUsd",
  "monthlyBudgetUsd",
  "spentTodayUsd",
  "spentThisMonthUsd",
  "lifetimeSpendUsd",
  "dailyRemainingUsd",
  "monthlyRemainingUsd",
  "ledgerEntries"
];

function runCli(command) {
  const result = spawnSync(process.execPath, [CLI_PATH, command, "--repo", REPO_ROOT], {
    cwd: REPO_ROOT,
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr || `orbit ${command} failed`);
  assert.equal(result.stderr, "");
  return JSON.parse(result.stdout);
}

function assertPublicBudgetShape(value) {
  assert.deepEqual(Object.keys(value).sort(), SAFE_BUDGET_KEYS);
  assert.match(value.status, /^(ok|low|critical|exhausted)$/);
  assert.equal(typeof value.canUseAi, "boolean");
  assert.equal(value.policy, "public_safe_status_only");

  const serialized = JSON.stringify(value);
  for (const key of FORBIDDEN_DETAIL_KEYS) {
    assert.equal(serialized.includes(`\"${key}\"`), false, `must omit ${key}`);
  }
}

describe("Orbit CLI public budget boundary", () => {
  it("keeps orbit status budget output status-only", () => {
    const output = runCli("status");
    assertPublicBudgetShape(output.aiBudget);
  });

  it("keeps orbit budget output status-only", () => {
    assertPublicBudgetShape(runCli("budget"));
  });
});
