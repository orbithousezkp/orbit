"use strict";

// F-4.5 (PLAN/ROADMAP_EXPANSION.md): scoped capability delegation.
//
// Parent → child delegation in Orbit federation. The parent (this Orbit
// instance) issues a Grant naming the specific tool capabilities the
// child repo may invoke. Child checks the grant on every tool call.
//
// This module is the pure grant shape + verifier:
//   - buildDelegationGrant: parent issues a grant for a child
//   - validateDelegationGrant: shape check (uses F-1.6 schema validator)
//   - isCapabilityGranted: predicate the child calls per tool invocation
//   - filterAllowedCapabilities: returns only the granted subset of a
//     requested list
//   - isGrantExpired: time-based expiry check
//
// Signing/verifying the envelope (HMAC or wallet signature) is a separate
// concern — happens in the federation transport layer. The grant carries
// a deterministic grantId (sha256 prefix of parent+child+caps+issuedAt)
// so a signed envelope can bind to it.
//
// Pairs with:
//   - F-1.6 memory-schema.js for shape validation
//   - F-5.4 protocol-version.js for orbitProtocolVersion stamping

const crypto = require("node:crypto");
const { validateMemoryShape } = require("./memory-schema");
const { stampProtocolVersion } = require("./protocol-version");

// Canonical list of capabilities the federation knows about. Unknown
// capability names are silently dropped at build time (defense in depth:
// a parent cannot accidentally grant something that doesn't exist or
// that the federation hasn't yet ratified).
const KNOWN_CAPABILITIES = Object.freeze([
  "webSearch",
  "fetchUrl",
  "openIssue",
  "commentOnIssue",
  "labelIssue",
  "writeMemoryFile",
  "readMemoryFile",
  "castFarcaster",
  "buyback",
  "treasurySweep",
  "merkleAnchor",
  "clanker",
  "federationSend",
  "federationReceive",
  "spawn"
]);

const CAPABILITY_GRANT_SCHEMA = Object.freeze({
  required: {
    grantId: "string",
    parent: "string",
    child: "string",
    capabilities: "array",
    issuedAt: "string"
  },
  optional: {
    expiresAt: "string",
    orbitProtocolVersion: "string",
    notes: "string"
  }
});

function computeGrantId({ parent, child, capabilities, issuedAt }) {
  const canonical = JSON.stringify({
    parent: String(parent || ""),
    child: String(child || ""),
    capabilities: (Array.isArray(capabilities) ? capabilities : []).slice().sort(),
    issuedAt: String(issuedAt || "")
  });
  return crypto.createHash("sha256").update(canonical).digest("hex").slice(0, 24);
}

function buildDelegationGrant({ parent, child, capabilities, issuedAt, expiresAt, notes } = {}) {
  const filtered = Array.isArray(capabilities)
    ? capabilities.filter((c) => typeof c === "string" && KNOWN_CAPABILITIES.includes(c))
    : [];
  const issued = issuedAt || new Date().toISOString();
  const grant = {
    grantId: computeGrantId({ parent, child, capabilities: filtered, issuedAt: issued }),
    parent: String(parent || ""),
    child: String(child || ""),
    capabilities: filtered,
    issuedAt: issued
  };
  if (expiresAt) grant.expiresAt = expiresAt;
  if (notes) grant.notes = String(notes);
  return stampProtocolVersion(grant);
}

function validateDelegationGrant(grant) {
  return validateMemoryShape(CAPABILITY_GRANT_SCHEMA, grant);
}

function isGrantExpired(grant, now = new Date()) {
  if (!grant || typeof grant !== "object") return true;
  if (!grant.expiresAt) return false; // no expiry = immortal
  const expiryMs = Date.parse(grant.expiresAt);
  if (Number.isNaN(expiryMs)) return true; // unparseable = treat as expired (fail-closed)
  const nowMs = now instanceof Date ? now.getTime() : Number(now);
  return nowMs >= expiryMs;
}

function isCapabilityGranted(grant, capability, options = {}) {
  if (!grant || typeof grant !== "object") return false;
  if (!Array.isArray(grant.capabilities)) return false;
  if (isGrantExpired(grant, options.now)) return false;
  return grant.capabilities.includes(capability);
}

function filterAllowedCapabilities(grant, requested, options = {}) {
  if (!Array.isArray(requested)) return [];
  if (isGrantExpired(grant, options.now)) return [];
  if (!grant || !Array.isArray(grant.capabilities)) return [];
  const granted = new Set(grant.capabilities);
  return requested.filter((c) => granted.has(c));
}

module.exports = {
  CAPABILITY_GRANT_SCHEMA,
  KNOWN_CAPABILITIES,
  buildDelegationGrant,
  filterAllowedCapabilities,
  isCapabilityGranted,
  isGrantExpired,
  validateDelegationGrant
};
