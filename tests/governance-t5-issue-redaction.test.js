"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  approvalIssueBody,
  approvalIssueBodyPublic
} = require("../src/agent/governance");

// T-5 (STABILITY_SECURITY.md): public approval-issue bodies leaked
// Amount + Recipient. approvalIssueBodyPublic() is the redacted variant
// suitable for posting to GitHub. approvalIssueBody() keeps the full text
// for internal state (memory/approvals.json) and tests.

function sampleApproval() {
  return {
    id: "abc123def456abcd",
    classification: {
      request: {
        category: "external_spend",
        asset: "ETH",
        amount: "0.5",
        recipient: "0x1234567890123456789012345678901234567890",
        purpose: "pay external contractor",
        url: "https://example.com/invoice"
      },
      risk: { flags: [] }
    }
  };
}

test("approvalIssueBody (internal) still contains Amount + Recipient", () => {
  const body = approvalIssueBody(sampleApproval());
  assert.match(body, /Amount: `0\.5`/);
  assert.match(body, /Recipient: `0x1234567890123456789012345678901234567890`/);
  assert.match(body, /Approval ID: `abc123def456abcd`/);
});

test("approvalIssueBodyPublic redacts Amount", () => {
  const body = approvalIssueBodyPublic(sampleApproval());
  assert.doesNotMatch(body, /0\.5/, "amount must not appear in public body");
  assert.match(body, /Amount: `<redacted/);
});

test("approvalIssueBodyPublic redacts Recipient address", () => {
  const body = approvalIssueBodyPublic(sampleApproval());
  assert.doesNotMatch(body, /0x1234567890123456789012345678901234567890/);
  assert.match(body, /Recipient: `<redacted/);
});

test("approvalIssueBodyPublic redacts purpose (may contain sensitive context)", () => {
  const body = approvalIssueBodyPublic(sampleApproval());
  assert.doesNotMatch(body, /pay external contractor/);
});

test("approvalIssueBodyPublic redacts URL (may leak counterparty)", () => {
  const body = approvalIssueBodyPublic(sampleApproval());
  assert.doesNotMatch(body, /example\.com\/invoice/);
});

test("approvalIssueBodyPublic preserves ID + Category + APPROVE/REJECT instructions", () => {
  const body = approvalIssueBodyPublic(sampleApproval());
  assert.match(body, /Approval ID: `abc123def456abcd`/);
  assert.match(body, /Category: `external_spend`/);
  assert.match(body, /APPROVE ORBIT-SPEND abc123def456abcd/);
  assert.match(body, /REJECT ORBIT-SPEND abc123def456abcd/);
});

test("approvalIssueBodyPublic surfaces risk flag categories (not full message text)", () => {
  const withRisk = {
    id: "feedfacefeedface",
    classification: {
      request: {
        category: "external_spend",
        asset: "ETH",
        amount: "1.0",
        recipient: "0xdeadbeef00000000000000000000000000000001",
        purpose: "secret payment routing"
      },
      risk: {
        flags: [
          { category: "obfuscated_recipient", message: "0x...0001 looks like a dust trap from prior incident" }
        ]
      }
    }
  };
  const body = approvalIssueBodyPublic(withRisk);
  // Category label OK — used as risk signal
  assert.match(body, /obfuscated_recipient/);
  // Full incident message must NOT appear (could itself leak info)
  assert.doesNotMatch(body, /dust trap from prior incident/);
});

test("approvalIssueBodyPublic refers reader to private state for details", () => {
  const body = approvalIssueBodyPublic(sampleApproval());
  assert.match(body, /memory\/approvals\.json/);
});
