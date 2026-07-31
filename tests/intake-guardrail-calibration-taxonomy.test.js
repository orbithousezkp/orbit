"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const taxonomy = require("../docs/intake-guardrail-action-calibration-taxonomy.json");
const { RISK_PATTERNS } = require("../packages/issue-scam-scanner/rules");
const { scanUrl } = require("../packages/issue-scam-scanner/scan");

/*
 * Cycle 476 direction choice:
 * - build: add narrow, network-free source-alignment coverage;
 * - infrastructure: useful, but broader SDK/MCP work would overlap dirty CLIs;
 * - earn: adoption material already exists and needs no urgent correction;
 * - sustain/grow: no wallet-policy defect or new phase evidence warrants a change.
 * Selected build because this test is the smallest auditable follow-up to the
 * taxonomy manifest and does not modify scanner behavior or existing CLI work.
 */

describe("intake guardrail calibration taxonomy", () => {
  const known = new Set(taxonomy.knownEmittedCategories);

  it("covers every built-in and URL-risk category emitted by scanner source", () => {
    const builtIn = RISK_PATTERNS.map((rule) => rule.category);
    const urlRisk = [
      ...scanUrl("not-a-url"),
      ...scanUrl("https://bit.ly/example"),
      ...scanUrl("https://unknown.example/claim-token"),
      ...scanUrl("https://example.com/é")
    ].map((flag) => flag.category);

    const emitted = new Set([...builtIn, ...urlRisk]);
    assert.deepEqual([...emitted].sort(), [...known].sort());
  });

  it("maps concepts only to known emitted categories", () => {
    for (const [concept, mapping] of Object.entries(taxonomy.concepts)) {
      assert.match(concept, /^[a-z][a-z0-9_]*$/);
      assert.ok(Array.isArray(mapping.acceptedCategories));
      assert.ok(mapping.acceptedCategories.length > 0);

      for (const category of mapping.acceptedCategories) {
        assert.ok(known.has(category), `${concept} references unknown category ${category}`);
      }
    }
  });

  it("rejects unknown concepts and categories by contract", () => {
    assert.equal(taxonomy.normalization.unknownConcept, "reject");
    assert.equal(taxonomy.normalization.unknownCategory, "reject");
  });

  it("fails closed on scanner errors without fabricating findings", () => {
    const failure = taxonomy.runnerErrors.scanner_failure;
    assert.equal(failure.exitCode, 2);
    assert.equal(failure.decision, "hold");
    assert.equal(failure.fabricateFinding, false);
  });
});
