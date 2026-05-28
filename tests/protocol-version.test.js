"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  ORBIT_PROTOCOL_VERSION,
  PROTOCOL_VERSION_HEADER_FIELD,
  parseProtocolVersion,
  isCompatible,
  isExactMatch,
  stampProtocolVersion,
  readProtocolVersion,
  detectVersionDrift
} = require("../src/agent/protocol-version");

// F-5.4 (PLAN/ROADMAP_EXPANSION.md): protocol versioning + migration spec.
// All Orbit artifacts (proofs, family.json, passport.json, dashboard.json)
// carry an ORBIT_PROTOCOL_VERSION header so external impls + adopters can
// detect breaking changes via simple major-version comparison.
// SemVer rules: major bump = breaking, minor/patch = compatible.

test("ORBIT_PROTOCOL_VERSION is semver string", () => {
  assert.equal(typeof ORBIT_PROTOCOL_VERSION, "string");
  assert.match(ORBIT_PROTOCOL_VERSION, /^\d+\.\d+\.\d+$/);
});

test("PROTOCOL_VERSION_HEADER_FIELD is 'orbitProtocolVersion'", () => {
  assert.equal(PROTOCOL_VERSION_HEADER_FIELD, "orbitProtocolVersion");
});

test("parseProtocolVersion: well-formed → {major, minor, patch}", () => {
  assert.deepEqual(parseProtocolVersion("1.2.3"), { major: 1, minor: 2, patch: 3 });
  assert.deepEqual(parseProtocolVersion("0.0.1"), { major: 0, minor: 0, patch: 1 });
  assert.deepEqual(parseProtocolVersion("12.34.56"), { major: 12, minor: 34, patch: 56 });
});

test("parseProtocolVersion: malformed → null", () => {
  assert.equal(parseProtocolVersion("1.2"), null);
  assert.equal(parseProtocolVersion("1.2.3.4"), null);
  assert.equal(parseProtocolVersion("v1.2.3"), null);
  assert.equal(parseProtocolVersion("1.2.3-beta"), null);
  assert.equal(parseProtocolVersion(""), null);
  assert.equal(parseProtocolVersion(null), null);
  assert.equal(parseProtocolVersion(123), null);
});

test("isCompatible: same major → compatible (regardless of minor/patch)", () => {
  assert.equal(isCompatible("1.0.0", "1.0.0"), true);
  assert.equal(isCompatible("1.0.0", "1.5.9"), true);
  assert.equal(isCompatible("1.99.99", "1.0.0"), true);
});

test("isCompatible: different major → incompatible", () => {
  assert.equal(isCompatible("1.0.0", "2.0.0"), false);
  assert.equal(isCompatible("0.9.9", "1.0.0"), false);
  assert.equal(isCompatible("2.5.3", "3.0.0"), false);
});

test("isCompatible: malformed input → false (fail-closed)", () => {
  assert.equal(isCompatible("1.0.0", "not-a-version"), false);
  assert.equal(isCompatible("not-a-version", "1.0.0"), false);
  assert.equal(isCompatible(null, null), false);
});

test("isExactMatch: identical strings → true", () => {
  assert.equal(isExactMatch("1.2.3", "1.2.3"), true);
  assert.equal(isExactMatch("1.2.3", "1.2.4"), false);
  assert.equal(isExactMatch("1.0.0", "2.0.0"), false);
});

test("stampProtocolVersion: stamps header onto artifact (preserves other fields)", () => {
  const artifact = { cycle: 5, foo: "bar" };
  const stamped = stampProtocolVersion(artifact);
  assert.equal(stamped.orbitProtocolVersion, ORBIT_PROTOCOL_VERSION);
  assert.equal(stamped.cycle, 5);
  assert.equal(stamped.foo, "bar");
  // Pure: input untouched
  assert.equal(artifact.orbitProtocolVersion, undefined);
});

test("stampProtocolVersion: overrides existing field", () => {
  const artifact = { orbitProtocolVersion: "0.0.1", cycle: 1 };
  const stamped = stampProtocolVersion(artifact);
  assert.equal(stamped.orbitProtocolVersion, ORBIT_PROTOCOL_VERSION);
});

test("stampProtocolVersion: custom version override (for testing / forward sims)", () => {
  const stamped = stampProtocolVersion({ cycle: 1 }, { version: "9.9.9" });
  assert.equal(stamped.orbitProtocolVersion, "9.9.9");
});

test("stampProtocolVersion: non-object input → returns new object with version only", () => {
  const stamped = stampProtocolVersion(null);
  assert.equal(stamped.orbitProtocolVersion, ORBIT_PROTOCOL_VERSION);
});

test("readProtocolVersion: returns version from artifact, defaults to null when absent", () => {
  assert.equal(readProtocolVersion({ orbitProtocolVersion: "1.2.3" }), "1.2.3");
  assert.equal(readProtocolVersion({ cycle: 5 }), null);
  assert.equal(readProtocolVersion(null), null);
  assert.equal(readProtocolVersion("not-an-object"), null);
});

test("detectVersionDrift: same major → ok", () => {
  const result = detectVersionDrift({ orbitProtocolVersion: ORBIT_PROTOCOL_VERSION });
  assert.equal(result.ok, true);
  assert.equal(result.kind, "match");
});

test("detectVersionDrift: missing version → ok=false, kind=missing", () => {
  const result = detectVersionDrift({ cycle: 5 });
  assert.equal(result.ok, false);
  assert.equal(result.kind, "missing");
});

test("detectVersionDrift: different major → ok=false, kind=major_drift", () => {
  const remoteVersion = ORBIT_PROTOCOL_VERSION.replace(/^(\d+)/, (n) => String(parseInt(n, 10) + 1));
  const result = detectVersionDrift({ orbitProtocolVersion: remoteVersion });
  assert.equal(result.ok, false);
  assert.equal(result.kind, "major_drift");
  assert.equal(result.local, ORBIT_PROTOCOL_VERSION);
  assert.equal(result.remote, remoteVersion);
});

test("detectVersionDrift: malformed version string → ok=false, kind=invalid", () => {
  const result = detectVersionDrift({ orbitProtocolVersion: "not-a-version" });
  assert.equal(result.ok, false);
  assert.equal(result.kind, "invalid");
});

test("detectVersionDrift: forward minor (newer remote, same major) → ok with kind=minor_ahead", () => {
  const local = parseProtocolVersion(ORBIT_PROTOCOL_VERSION);
  const remoteVersion = `${local.major}.${local.minor + 1}.0`;
  const result = detectVersionDrift({ orbitProtocolVersion: remoteVersion });
  assert.equal(result.ok, true);
  assert.equal(result.kind, "minor_ahead");
});

test("detectVersionDrift: older remote, same major → ok with kind=minor_behind", () => {
  const local = parseProtocolVersion(ORBIT_PROTOCOL_VERSION);
  // Only meaningful if current is > 1.0.0; otherwise simulate via fake local override.
  if (local.minor === 0 && local.patch === 0) {
    // Current is X.0.0 — nothing valid lower at same major. Skip the comparison.
    return;
  }
  const remoteVersion = `${local.major}.0.0`;
  const result = detectVersionDrift({ orbitProtocolVersion: remoteVersion });
  assert.equal(result.ok, true);
  assert.equal(result.kind, "minor_behind");
});
