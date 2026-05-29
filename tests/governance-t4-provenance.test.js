"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { classifySpend, normalizeSpendRequest } = require("../src/agent/governance");

// T-4 (security audit 2026-05-29): provenance-tagged spend escalation.
// A spend request whose content originated from external_untrusted
// sources (fetchUrl / webSearch) must NOT take the allowedWithoutApproval
// fast path, even if the recipient happens to be a self-address —
// prompt-injection defense.

function makeConfig(overrides = {}) {
  return {
    treasuryAddress: "0x" + "1".repeat(40),
    operatorRevenueAddress: "0x" + "2".repeat(40),
    ...overrides
  };
}

test("T-4: normalizeSpendRequest defaults provenance to 'trusted'", () => {
  const r = normalizeSpendRequest({ category: "gas" });
  assert.equal(r.provenance, "trusted");
});

test("T-4: normalizeSpendRequest preserves explicit external_untrusted provenance", () => {
  const r = normalizeSpendRequest({ category: "gas", provenance: "external_untrusted" });
  assert.equal(r.provenance, "external_untrusted");
});

test("T-4: any other provenance value coerces to 'trusted' (fail-closed allowlist)", () => {
  const r = normalizeSpendRequest({ category: "gas", provenance: "junk_value" });
  assert.equal(r.provenance, "trusted");
});

test("T-4: trusted gas request stays on fast path (regression check)", () => {
  const result = classifySpend(makeConfig(), {
    category: "gas",
    recipient: "",
    amount: "1000"
  });
  assert.equal(result.requiresOwnerApproval, false);
  assert.equal(result.decision, "allowed");
});

test("T-4: untrusted gas request is escalated to owner approval", () => {
  const result = classifySpend(makeConfig(), {
    category: "gas",
    recipient: "",
    amount: "1000",
    provenance: "external_untrusted"
  });
  assert.equal(result.requiresOwnerApproval, true);
  assert.equal(result.provenanceEscalation, true);
  assert.equal(result.decision, "owner_approval_required");
  assert.match(result.reason, /external_untrusted|T-4/);
});

test("T-4: untrusted operator_revenue spend is escalated despite self-address", () => {
  const cfg = makeConfig();
  const result = classifySpend(cfg, {
    category: "operator_revenue",
    recipient: cfg.operatorRevenueAddress,
    amount: "5000",
    provenance: "external_untrusted"
  });
  assert.equal(result.requiresOwnerApproval, true);
  assert.equal(result.provenanceEscalation, true);
});

test("T-4: untrusted treasury_internal spend is escalated despite self-address", () => {
  const cfg = makeConfig();
  const result = classifySpend(cfg, {
    category: "treasury_internal",
    recipient: cfg.treasuryAddress,
    amount: "5000",
    provenance: "external_untrusted"
  });
  assert.equal(result.requiresOwnerApproval, true);
  assert.equal(result.provenanceEscalation, true);
});

test("T-4: untrusted claim_rewards spend is escalated", () => {
  const cfg = makeConfig();
  const result = classifySpend(cfg, {
    category: "claim_rewards",
    recipient: cfg.treasuryAddress,
    amount: "0",
    provenance: "external_untrusted"
  });
  assert.equal(result.requiresOwnerApproval, true);
  assert.equal(result.provenanceEscalation, true);
});

test("T-4: trusted external_spend still requires approval (no regression)", () => {
  const result = classifySpend(makeConfig(), {
    category: "external_spend",
    recipient: "0x" + "9".repeat(40),
    amount: "1000"
  });
  assert.equal(result.requiresOwnerApproval, true);
  assert.equal(result.provenanceEscalation, false);
});

test("T-4: classifySpend exposes provenanceEscalation flag for telemetry", () => {
  const trusted = classifySpend(makeConfig(), { category: "gas" });
  assert.equal(typeof trusted.provenanceEscalation, "boolean");
  assert.equal(trusted.provenanceEscalation, false);
});
