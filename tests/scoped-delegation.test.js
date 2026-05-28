"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  CAPABILITY_GRANT_SCHEMA,
  KNOWN_CAPABILITIES,
  buildDelegationGrant,
  validateDelegationGrant,
  isCapabilityGranted,
  filterAllowedCapabilities,
  isGrantExpired
} = require("../src/agent/scoped-delegation");

// F-4.5 (PLAN/ROADMAP_EXPANSION.md): scoped capability delegation.
// Parent (orbit-owner) grants a child repo a specific list of tool
// capabilities. Child checks its grant on every tool call. Grants are
// signed envelopes (signing happens in a separate package — this module
// is the pure grant shape + verifier).

test("KNOWN_CAPABILITIES is a frozen array of strings", () => {
  assert.ok(Array.isArray(KNOWN_CAPABILITIES));
  assert.ok(KNOWN_CAPABILITIES.length > 0);
  assert.ok(Object.isFrozen(KNOWN_CAPABILITIES));
  for (const c of KNOWN_CAPABILITIES) {
    assert.equal(typeof c, "string");
  }
});

test("CAPABILITY_GRANT_SCHEMA matches F-1.6 memory-schema shape", () => {
  assert.ok(CAPABILITY_GRANT_SCHEMA.required);
  assert.ok(CAPABILITY_GRANT_SCHEMA.required.grantId);
  assert.ok(CAPABILITY_GRANT_SCHEMA.required.parent);
  assert.ok(CAPABILITY_GRANT_SCHEMA.required.child);
  assert.ok(CAPABILITY_GRANT_SCHEMA.required.capabilities);
});

test("buildDelegationGrant: returns well-formed grant with all required fields", () => {
  const grant = buildDelegationGrant({
    parent: "orbithousezkp/orbit",
    child: "alice/alice-orbit",
    capabilities: ["webSearch", "fetchUrl"],
    issuedAt: "2026-05-28T00:00:00Z"
  });
  assert.equal(typeof grant.grantId, "string");
  assert.equal(grant.parent, "orbithousezkp/orbit");
  assert.equal(grant.child, "alice/alice-orbit");
  assert.deepEqual(grant.capabilities, ["webSearch", "fetchUrl"]);
  assert.equal(grant.issuedAt, "2026-05-28T00:00:00Z");
  // Should stamp protocol version
  assert.ok(grant.orbitProtocolVersion);
});

test("buildDelegationGrant: deterministic grantId for same inputs", () => {
  const a = buildDelegationGrant({
    parent: "p", child: "c", capabilities: ["webSearch"], issuedAt: "2026-05-28T00:00:00Z"
  });
  const b = buildDelegationGrant({
    parent: "p", child: "c", capabilities: ["webSearch"], issuedAt: "2026-05-28T00:00:00Z"
  });
  assert.equal(a.grantId, b.grantId);
});

test("buildDelegationGrant: different inputs → different grantId", () => {
  const a = buildDelegationGrant({
    parent: "p", child: "c", capabilities: ["webSearch"], issuedAt: "2026-05-28T00:00:00Z"
  });
  const b = buildDelegationGrant({
    parent: "p", child: "c", capabilities: ["webSearch", "fetchUrl"], issuedAt: "2026-05-28T00:00:00Z"
  });
  assert.notEqual(a.grantId, b.grantId);
});

test("buildDelegationGrant: filters out unknown capabilities by default", () => {
  const grant = buildDelegationGrant({
    parent: "p", child: "c",
    capabilities: ["webSearch", "definitely-not-a-real-capability", "fetchUrl"],
    issuedAt: "2026-05-28T00:00:00Z"
  });
  assert.ok(grant.capabilities.includes("webSearch"));
  assert.ok(grant.capabilities.includes("fetchUrl"));
  assert.ok(!grant.capabilities.includes("definitely-not-a-real-capability"));
});

test("buildDelegationGrant: optional expiresAt is preserved", () => {
  const grant = buildDelegationGrant({
    parent: "p", child: "c", capabilities: ["webSearch"],
    issuedAt: "2026-05-28T00:00:00Z", expiresAt: "2026-06-28T00:00:00Z"
  });
  assert.equal(grant.expiresAt, "2026-06-28T00:00:00Z");
});

test("validateDelegationGrant: well-formed grant → ok", () => {
  const grant = buildDelegationGrant({
    parent: "p", child: "c", capabilities: ["webSearch"], issuedAt: "2026-05-28T00:00:00Z"
  });
  const result = validateDelegationGrant(grant);
  assert.equal(result.ok, true);
});

test("validateDelegationGrant: missing parent → invalid", () => {
  const grant = buildDelegationGrant({
    parent: "p", child: "c", capabilities: ["webSearch"], issuedAt: "2026-05-28T00:00:00Z"
  });
  delete grant.parent;
  const result = validateDelegationGrant(grant);
  assert.equal(result.ok, false);
  assert.ok(result.violations.find((v) => v.key === "parent"));
});

test("isCapabilityGranted: capability in list → true", () => {
  const grant = buildDelegationGrant({
    parent: "p", child: "c", capabilities: ["webSearch", "fetchUrl"], issuedAt: "2026-05-28T00:00:00Z"
  });
  assert.equal(isCapabilityGranted(grant, "webSearch"), true);
  assert.equal(isCapabilityGranted(grant, "fetchUrl"), true);
});

test("isCapabilityGranted: capability not in list → false", () => {
  const grant = buildDelegationGrant({
    parent: "p", child: "c", capabilities: ["webSearch"], issuedAt: "2026-05-28T00:00:00Z"
  });
  assert.equal(isCapabilityGranted(grant, "clanker"), false);
  assert.equal(isCapabilityGranted(grant, "fetchUrl"), false);
});

test("isCapabilityGranted: malformed grant → false (fail-closed)", () => {
  assert.equal(isCapabilityGranted(null, "webSearch"), false);
  assert.equal(isCapabilityGranted({}, "webSearch"), false);
  assert.equal(isCapabilityGranted({ capabilities: "not-an-array" }, "webSearch"), false);
});

test("isCapabilityGranted: expired grant → false", () => {
  const grant = buildDelegationGrant({
    parent: "p", child: "c", capabilities: ["webSearch"],
    issuedAt: "2026-04-01T00:00:00Z", expiresAt: "2026-05-01T00:00:00Z"
  });
  // expiresAt < now (2026-05-28+)
  const now = new Date("2026-05-28T00:00:00Z");
  assert.equal(isCapabilityGranted(grant, "webSearch", { now }), false);
});

test("isCapabilityGranted: non-expired grant → true even with expiresAt", () => {
  const grant = buildDelegationGrant({
    parent: "p", child: "c", capabilities: ["webSearch"],
    issuedAt: "2026-05-01T00:00:00Z", expiresAt: "2026-06-01T00:00:00Z"
  });
  const now = new Date("2026-05-28T00:00:00Z");
  assert.equal(isCapabilityGranted(grant, "webSearch", { now }), true);
});

test("filterAllowedCapabilities: returns only the requested-and-granted", () => {
  const grant = buildDelegationGrant({
    parent: "p", child: "c", capabilities: ["webSearch", "fetchUrl"], issuedAt: "2026-05-28T00:00:00Z"
  });
  const allowed = filterAllowedCapabilities(grant, ["webSearch", "clanker", "fetchUrl"]);
  assert.deepEqual(allowed.sort(), ["fetchUrl", "webSearch"]);
});

test("filterAllowedCapabilities: empty request → empty result", () => {
  const grant = buildDelegationGrant({
    parent: "p", child: "c", capabilities: ["webSearch"], issuedAt: "2026-05-28T00:00:00Z"
  });
  assert.deepEqual(filterAllowedCapabilities(grant, []), []);
});

test("filterAllowedCapabilities: expired grant → empty", () => {
  const grant = buildDelegationGrant({
    parent: "p", child: "c", capabilities: ["webSearch"],
    issuedAt: "2026-04-01T00:00:00Z", expiresAt: "2026-05-01T00:00:00Z"
  });
  const now = new Date("2026-05-28T00:00:00Z");
  assert.deepEqual(filterAllowedCapabilities(grant, ["webSearch"], { now }), []);
});

test("isGrantExpired: no expiresAt → false (immortal grant)", () => {
  const grant = buildDelegationGrant({
    parent: "p", child: "c", capabilities: ["webSearch"], issuedAt: "2026-05-28T00:00:00Z"
  });
  assert.equal(isGrantExpired(grant, new Date("2099-01-01T00:00:00Z")), false);
});

test("isGrantExpired: expiresAt in the past → true", () => {
  const grant = buildDelegationGrant({
    parent: "p", child: "c", capabilities: ["webSearch"],
    issuedAt: "2026-04-01T00:00:00Z", expiresAt: "2026-05-01T00:00:00Z"
  });
  assert.equal(isGrantExpired(grant, new Date("2026-05-28T00:00:00Z")), true);
});

test("isGrantExpired: expiresAt in the future → false", () => {
  const grant = buildDelegationGrant({
    parent: "p", child: "c", capabilities: ["webSearch"],
    issuedAt: "2026-05-01T00:00:00Z", expiresAt: "2026-06-01T00:00:00Z"
  });
  assert.equal(isGrantExpired(grant, new Date("2026-05-28T00:00:00Z")), false);
});
