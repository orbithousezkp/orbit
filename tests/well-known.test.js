"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  WELL_KNOWN_SCHEMA,
  projectForWellKnown,
  validateWellKnown
} = require("../src/agent/well-known");

function exampleBundle() {
  return {
    infrastructure: {
      product: { name: "Orbit", category: "GitHub-native agent infrastructure" },
      activePhase: { id: "phase-1", name: "Launch", status: "active" },
      capabilities: [
        { id: "cycle-proofs", name: "Cycle Proofs", status: "active", surface: "runtime/proofs" },
        { id: "agent-passport", name: "Agent Passport", status: "active", surface: "docs/agent-passport.md" },
        { id: "plugin-marketplace", name: "Plugin Marketplace", status: "planned" }
      ],
      surfaces: [
        { id: "dashboard", name: "Public Dashboard", url: "https://orbit.horse" }
      ]
    },
    treasury: {
      token: { name: "Orbit", symbol: "ORBIT", launchStatus: "planned" }
    },
    governance: {
      externalSpend: { mode: "owner_approval_required" }
    }
  };
}

test("projectForWellKnown produces schema + identity + capabilities", () => {
  const result = projectForWellKnown(exampleBundle(), {
    repo: "github.com/orbithousezkp/orbit",
    publicUrl: "https://orbit.horse",
    signer: "0x19E7E376E7C213B7E7e7e46cc70A5dD086DAff2A"
  });
  assert.equal(result.schema, WELL_KNOWN_SCHEMA);
  assert.equal(result.product.name, "Orbit");
  assert.equal(result.activePhase.id, "phase-1");
  assert.equal(result.identity.repo, "github.com/orbithousezkp/orbit");
  assert.equal(result.identity.signer, "0x19E7E376E7C213B7E7e7e46cc70A5dD086DAff2A");
});

test("capabilities only include active entries", () => {
  const result = projectForWellKnown(exampleBundle());
  assert.equal(result.capabilities.length, 2);
  assert.ok(result.capabilities.every((c) => c.id !== "plugin-marketplace"));
});

test("walletPolicy reflects governance and treasury", () => {
  const result = projectForWellKnown(exampleBundle());
  assert.equal(result.walletPolicy.approvalMode, "owner_approval_required");
  assert.equal(result.walletPolicy.token.symbol, "ORBIT");
  assert.equal(result.walletPolicy.token.launchStatus, "planned");
});

test("federation block declares version 1 and contact info", () => {
  const result = projectForWellKnown(exampleBundle(), {
    githubRepo: "github.com/orbithousezkp/orbit",
    farcaster: "https://warpcast.com/orbit-house"
  });
  assert.equal(result.federation.version, 1);
  assert.equal(result.federation.contact.github, "github.com/orbithousezkp/orbit");
});

test("validateWellKnown accepts a well-formed payload", () => {
  const result = projectForWellKnown(exampleBundle());
  const check = validateWellKnown(result);
  assert.equal(check.ok, true);
  assert.deepEqual(check.errors, []);
});

test("validateWellKnown rejects missing schema", () => {
  const check = validateWellKnown({ product: { name: "x" } });
  assert.equal(check.ok, false);
  assert.ok(check.errors.some((e) => e.includes("schema")));
});

test("validateWellKnown rejects wrong federation version", () => {
  const result = projectForWellKnown(exampleBundle());
  result.federation.version = 2;
  const check = validateWellKnown(result);
  assert.equal(check.ok, false);
});

test("projectForWellKnown handles empty bundle gracefully", () => {
  const result = projectForWellKnown({});
  assert.equal(result.schema, WELL_KNOWN_SCHEMA);
  assert.equal(result.product.name, "Orbit");
  assert.deepEqual(result.capabilities, []);
});
