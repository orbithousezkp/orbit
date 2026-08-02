"use strict";

/**
 * Public-output regression coverage for the AI Budget Ledger CLI.
 *
 * Cycle 500 direction decision:
 * - Compared build (extend scanner calibration), earn (agent-passport adoption),
 *   maintain (close the live public-output contract gap), and infrastructure
 *   (reconcile shared registry wording).
 * - Selected maintain because the CLI currently exposes ledger size through
 *   `entryCount`, which conflicts with docs/public-status-contract.md. Focused
 *   human and JSON coverage is the smallest auditable step toward removing the
 *   leak without broadening trusted local ledger APIs.
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
const forbiddenOutput = /entryCount|Entries:|dailyBudgetUsd|monthlyBudgetUsd|estimatedUsd|remaining|promptTokens|completionTokens|route|provider|model/i;

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
      assert.equal(forbiddenOutput.test(result.stdout), false, result.stdout);
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
      assert.equal(forbiddenOutput.test(result.stdout), false, result.stdout);
    });
  });
});
