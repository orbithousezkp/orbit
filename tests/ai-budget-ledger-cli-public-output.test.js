"use strict";

/**
 * Public-output regression coverage for the AI Budget Ledger CLI.
 *
 * Cycle 501 direction decision:
 * - Compared build (extend scanner calibration), earn (agent-passport adoption),
 *   maintain (finish the high-priority budget CLI contract fix), and
 *   infrastructure (reconcile shared registry wording).
 * - Selected maintain because the implementation still exposes ledger size and
 *   this focused suite is the acceptance boundary. The prior broad text regex
 *   also matched the public-safe explanatory note itself, so this cycle makes
 *   the regression check structural before the implementation change lands.
 */

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const { createLedger, record } = require("../packages/ai-budget-ledger/ledger");
const { save } = require("../packages/ai-budget-ledger/persist");

const cliPath = path.join(__dirname, "..", "packages", "ai-budget-ledger", "cli.js");
const forbiddenKeys = new Set([
  "entryCount",
  "dailyBudgetUsd",
  "monthlyBudgetUsd",
  "estimatedUsd",
  "remaining",
  "dailyRemaining",
  "monthlyRemaining",
  "promptTokens",
  "completionTokens",
  "route",
  "provider",
  "model",
]);
const forbiddenHumanLabels = /Entries:|Daily budget:|Monthly budget:|Remaining:|Prompt tokens:|Completion tokens:|Provider:|Model:/i;
const privateFixtureValues = /local fixture|private fixture route/i;

function collectKeys(value, keys = []) {
  if (Array.isArray(value)) {
    for (const item of value) collectKeys(item, keys);
    return keys;
  }
  if (!value || typeof value !== "object") return keys;
  for (const [key, nested] of Object.entries(value)) {
    keys.push(key);
    collectKeys(nested, keys);
  }
  return keys;
}

function withLedger(run) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "orbit-ai-budget-cli-"));
  const ledgerPath = path.join(dir, "ledger.json");
  const ledger = createLedger({
    dailyBudgetUsd: 5,
    monthlyBudgetUsd: 100,
    inputUsdPerMillion: 0.15,
    outputUsdPerMillion: 0.6,
  });
  record(ledger, {
    promptTokens: 1000,
    completionTokens: 500,
    note: "local fixture",
    route: "private fixture route",
  });
  save(ledgerPath, ledger);

  try {
    run(ledgerPath);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function invoke(args) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd: path.join(__dirname, ".."),
    encoding: "utf8",
  });
}

function assertPublicJson(output) {
  const leakedKeys = collectKeys(output).filter((key) => forbiddenKeys.has(key));
  assert.deepEqual(leakedKeys, []);
  assert.equal(privateFixtureValues.test(JSON.stringify(output)), false);
}

describe("AI Budget Ledger CLI public output", () => {
  it("keeps summarize JSON status-only and omits ledger size", () => {
    withLedger((ledgerPath) => {
      const result = invoke(["summarize", ledgerPath, "--json"]);
      assert.equal(result.status, 0, result.stderr);

      const output = JSON.parse(result.stdout);
      assert.deepEqual(Object.keys(output).sort(), ["ok", "summary"]);
      assert.deepEqual(Object.keys(output.summary).sort(), [
        "budgetStatus",
        "monthStatus",
        "note",
        "ok",
        "policy",
        "todayStatus",
      ]);
      assertPublicJson(output);
    });
  });

  it("keeps summarize human output status-only and omits ledger size", () => {
    withLedger((ledgerPath) => {
      const result = invoke(["summarize", ledgerPath]);
      assert.equal(result.status, 0, result.stderr);
      assert.match(result.stdout, /Budget Status/);
      assert.match(result.stdout, /Status:/);
      assert.match(result.stdout, /Today:/);
      assert.match(result.stdout, /Month:/);
      assert.equal(forbiddenHumanLabels.test(result.stdout), false, result.stdout);
      assert.equal(privateFixtureValues.test(result.stdout), false, result.stdout);
    });
  });
});
