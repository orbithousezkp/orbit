"use strict";

// F-5.4 (PLAN/ROADMAP_EXPANSION.md): Orbit protocol version + drift
// detection.
//
// Every Orbit artifact (cycle proof, family.json federation envelope,
// passport.json, dashboard.json) carries an orbitProtocolVersion header
// in semver form (MAJOR.MINOR.PATCH). External implementations + adopter
// repos can read this and decide:
//   - same major → compatible (any minor/patch difference is additive)
//   - different major → breaking change; refuse or migrate
//
// This module is the pure mechanism: parse, compare, stamp, read, detect
// drift. It does NOT call out to other artifacts — the cycle, federation,
// SDK, and dashboard each opt in by calling stampProtocolVersion on their
// own outputs.
//
// Pairs with F-1.1 state-migrate.js: state schema version is internal
// (memory-only). Protocol version is external (visible to peers + adopters).

const ORBIT_PROTOCOL_VERSION = "1.0.0";
const PROTOCOL_VERSION_HEADER_FIELD = "orbitProtocolVersion";

const SEMVER_RE = /^(\d+)\.(\d+)\.(\d+)$/;

function parseProtocolVersion(value) {
  if (typeof value !== "string") return null;
  const match = SEMVER_RE.exec(value);
  if (!match) return null;
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10)
  };
}

function isCompatible(versionA, versionB) {
  const a = parseProtocolVersion(versionA);
  const b = parseProtocolVersion(versionB);
  if (!a || !b) return false;
  return a.major === b.major;
}

function isExactMatch(versionA, versionB) {
  return typeof versionA === "string"
    && typeof versionB === "string"
    && versionA === versionB
    && parseProtocolVersion(versionA) !== null;
}

function stampProtocolVersion(artifact, options = {}) {
  const version = (options && options.version) || ORBIT_PROTOCOL_VERSION;
  if (artifact === null || typeof artifact !== "object" || Array.isArray(artifact)) {
    return { [PROTOCOL_VERSION_HEADER_FIELD]: version };
  }
  return { ...artifact, [PROTOCOL_VERSION_HEADER_FIELD]: version };
}

function readProtocolVersion(artifact) {
  if (artifact === null || typeof artifact !== "object" || Array.isArray(artifact)) {
    return null;
  }
  const value = artifact[PROTOCOL_VERSION_HEADER_FIELD];
  return typeof value === "string" ? value : null;
}

function detectVersionDrift(artifact, options = {}) {
  const localVersion = (options && options.localVersion) || ORBIT_PROTOCOL_VERSION;
  const remoteVersion = readProtocolVersion(artifact);
  if (remoteVersion === null) {
    return { ok: false, kind: "missing", local: localVersion, remote: null };
  }
  const local = parseProtocolVersion(localVersion);
  const remote = parseProtocolVersion(remoteVersion);
  if (!remote) {
    return { ok: false, kind: "invalid", local: localVersion, remote: remoteVersion };
  }
  if (local.major !== remote.major) {
    return {
      ok: false,
      kind: "major_drift",
      local: localVersion,
      remote: remoteVersion
    };
  }
  if (remote.minor > local.minor || (remote.minor === local.minor && remote.patch > local.patch)) {
    return { ok: true, kind: "minor_ahead", local: localVersion, remote: remoteVersion };
  }
  if (remote.minor < local.minor || (remote.minor === local.minor && remote.patch < local.patch)) {
    return { ok: true, kind: "minor_behind", local: localVersion, remote: remoteVersion };
  }
  return { ok: true, kind: "match", local: localVersion, remote: remoteVersion };
}

module.exports = {
  ORBIT_PROTOCOL_VERSION,
  PROTOCOL_VERSION_HEADER_FIELD,
  detectVersionDrift,
  isCompatible,
  isExactMatch,
  parseProtocolVersion,
  readProtocolVersion,
  stampProtocolVersion
};
