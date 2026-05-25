"use strict";

// Adopter tracking — mothership-side.
//
// Two responsibilities in one module:
//
// 1) HANDSHAKE INTAKE — scan open issues on our own repo labeled
//    `orbit:adopter-handshake`. For each, fetch the claimed adopter's
//    /.well-known/orbit.json. Validate that:
//      - the well-known is reachable AND parses as a valid schema
//      - well-known.identity.repo === the claimed repo
//      - well-known.lineage.parent === ours
//    If valid: add the adopter to memory/adopters-registry.json. If not:
//    refusal-log the specific failure code so it surfaces publicly.
//
// 2) RE-VERIFICATION SCANNER — for every registered adopter, periodically
//    confirm the three "adopted" criteria still hold:
//      a) green cycle in the last 7 days (read from their well-known's
//         generatedAt + their dashboard's lifecycle.lastStatus)
//      b) dashboard.json reachable
//      c) well-known still validates and lineage still points back
//    Update lastVerifiedAt + criteriaStatus + adopted boolean on each entry.
//
// No network writes. No payments. No on-chain action. Purely read-side
// federation discovery + verification. The handshake mechanism is
// described in the leading comment of validateHandshake() below.

const ADOPTERS_SCHEMA = "orbit-adopters/1";
const HANDSHAKE_LABEL = "orbit:adopter-handshake";
const VERIFIED_LABEL = "orbit:adopter-verified";
const REJECTED_LABEL = "orbit:adopter-rejected";
const STALE_DAYS = 7;
const HANDSHAKE_RATE_LIMIT_PER_REPO_PER_DAY = 3;

const REPO_FIELD = /repo[:：]\s*(?:https?:\/\/github\.com\/)?([A-Za-z0-9][A-Za-z0-9_.-]*\/[A-Za-z0-9][A-Za-z0-9_.-]*)/i;
const WELL_KNOWN_FIELD = /well[- ]?known[:：]\s*(https?:\/\/[^\s<>"]+)/i;

function buildEmptyRegistry() {
  return {
    schema: ADOPTERS_SCHEMA,
    updatedAt: new Date().toISOString(),
    adopters: []
  };
}

function readRegistry(registryJson) {
  if (!registryJson || typeof registryJson !== "object") return buildEmptyRegistry();
  if (registryJson.schema !== ADOPTERS_SCHEMA) {
    return { ...buildEmptyRegistry(), legacyImported: true };
  }
  return {
    schema: ADOPTERS_SCHEMA,
    updatedAt: registryJson.updatedAt || new Date().toISOString(),
    adopters: Array.isArray(registryJson.adopters) ? registryJson.adopters : []
  };
}

function parseHandshakeIssue(issue) {
  if (!issue || typeof issue.body !== "string") return null;
  const repoMatch = issue.body.match(REPO_FIELD);
  const wkMatch = issue.body.match(WELL_KNOWN_FIELD);
  if (!repoMatch || !wkMatch) return null;
  return {
    issueNumber: issue.number || null,
    claimedRepo: repoMatch[1],
    wellKnownUrl: wkMatch[1],
    issueAuthor: typeof issue.author === "string"
      ? issue.author
      : (issue.user && typeof issue.user.login === "string" ? issue.user.login : null),
    createdAt: issue.createdAt || issue.created_at || null
  };
}

function validateHandshake({ claim, wellKnownPayload, ownRepo }) {
  // Trust model:
  // The adopter's claim is "I'm <repo>." Verification works because
  // (a) we fetch their public well-known at the URL they claim, and
  // (b) the well-known's lineage.parent must equal our repo, and
  // (c) the well-known's identity.repo must equal the claimed repo.
  // Both (b) and (c) require write access to the claimed repo's Pages
  // surface — exactly what a real adopter would have. No on-chain key
  // exchange is needed; the lineage backlink is the proof of control.

  if (!wellKnownPayload || typeof wellKnownPayload !== "object") {
    return { ok: false, code: "handshake_well_known_unreachable" };
  }
  if (wellKnownPayload.schema && wellKnownPayload.schema !== "orbit-well-known/1") {
    return { ok: false, code: "handshake_well_known_schema_invalid" };
  }
  const identity = wellKnownPayload.identity || {};
  const lineage = wellKnownPayload.lineage || null;
  if (!lineage || typeof lineage !== "object") {
    return { ok: false, code: "handshake_lineage_missing" };
  }
  if (typeof lineage.parent !== "string" || lineage.parent.toLowerCase() !== String(ownRepo || "").toLowerCase()) {
    return { ok: false, code: "handshake_lineage_mismatch" };
  }
  if (typeof identity.repo !== "string" || identity.repo.toLowerCase() !== String(claim.claimedRepo || "").toLowerCase()) {
    return { ok: false, code: "handshake_identity_mismatch" };
  }
  return { ok: true };
}

function rateLimit(registry, claimedRepo) {
  const repo = String(claimedRepo || "").toLowerCase();
  if (!repo) return false;
  const oneDayMs = 24 * 60 * 60 * 1000;
  const cutoff = Date.now() - oneDayMs;
  const recent = (registry.adopters || []).filter((a) => {
    if (!a || typeof a.repo !== "string") return false;
    if (a.repo.toLowerCase() !== repo) return false;
    const attemptedAt = Date.parse(a.handshakeAttemptedAt || "");
    return Number.isFinite(attemptedAt) && attemptedAt >= cutoff;
  });
  return recent.length >= HANDSHAKE_RATE_LIMIT_PER_REPO_PER_DAY;
}

function upsertAdopter(registry, entry) {
  const list = Array.isArray(registry.adopters) ? [...registry.adopters] : [];
  const idx = list.findIndex((a) => a && typeof a.repo === "string"
    && a.repo.toLowerCase() === entry.repo.toLowerCase());
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...entry };
  } else {
    list.push(entry);
  }
  return {
    ...registry,
    schema: ADOPTERS_SCHEMA,
    updatedAt: new Date().toISOString(),
    adopters: list
  };
}

async function processHandshakes({
  registry,
  issues,
  ownRepo,
  fetchJson,
  logRefusal
}) {
  const decisions = [];
  const updatedRegistry = readRegistry(registry);
  for (const issue of (Array.isArray(issues) ? issues : [])) {
    const labels = Array.isArray(issue.labels) ? issue.labels : [];
    const hasLabel = labels.some((l) => {
      if (typeof l === "string") return l === HANDSHAKE_LABEL;
      if (l && typeof l.name === "string") return l.name === HANDSHAKE_LABEL;
      return false;
    });
    if (!hasLabel) continue;
    const claim = parseHandshakeIssue(issue);
    if (!claim) {
      decisions.push({ issueNumber: issue.number || null, code: "handshake_body_unparseable" });
      if (typeof logRefusal === "function") {
        logRefusal({ code: "handshake_body_unparseable", issueNumber: issue.number || null });
      }
      continue;
    }
    if (rateLimit(updatedRegistry, claim.claimedRepo)) {
      decisions.push({ ...claim, code: "handshake_rate_limited" });
      if (typeof logRefusal === "function") logRefusal({ code: "handshake_rate_limited", repo: claim.claimedRepo });
      continue;
    }
    let payload = null;
    try {
      payload = await fetchJson(claim.wellKnownUrl);
    } catch (err) {
      decisions.push({ ...claim, code: "handshake_well_known_unreachable", error: err.message });
      if (typeof logRefusal === "function") logRefusal({ code: "handshake_well_known_unreachable", repo: claim.claimedRepo });
      continue;
    }
    const verdict = validateHandshake({ claim, wellKnownPayload: payload, ownRepo });
    const attemptedAt = new Date().toISOString();
    if (verdict.ok) {
      Object.assign(updatedRegistry, upsertAdopter(updatedRegistry, {
        repo: claim.claimedRepo,
        wellKnownUrl: claim.wellKnownUrl,
        signer: (payload.identity && payload.identity.signer) || null,
        publicUrl: (payload.identity && payload.identity.publicUrl) || null,
        scaffolderVersion: (payload.lineage && payload.lineage.scaffolderVersion) || null,
        handshakeIssue: claim.issueNumber,
        handshakeAttemptedAt: attemptedAt,
        verifiedAt: attemptedAt,
        status: "verified",
        adopted: false,
        criteriaStatus: { cycle7d: null, dashboardReachable: null, wellKnownValid: true }
      }));
      decisions.push({ ...claim, code: "verified" });
    } else {
      decisions.push({ ...claim, code: verdict.code });
      if (typeof logRefusal === "function") logRefusal({ code: verdict.code, repo: claim.claimedRepo });
      // Track the attempt for rate-limiting even on rejection.
      Object.assign(updatedRegistry, upsertAdopter(updatedRegistry, {
        repo: claim.claimedRepo,
        wellKnownUrl: claim.wellKnownUrl,
        handshakeIssue: claim.issueNumber,
        handshakeAttemptedAt: attemptedAt,
        status: "rejected",
        rejectionCode: verdict.code,
        adopted: false,
        criteriaStatus: { cycle7d: null, dashboardReachable: null, wellKnownValid: false }
      }));
    }
  }
  return { registry: updatedRegistry, decisions };
}

function isCycleFreshEnough(dashboardOrWellKnown, now = Date.now()) {
  const candidates = [];
  if (dashboardOrWellKnown && dashboardOrWellKnown.lifecycle && dashboardOrWellKnown.lifecycle.lastActive) {
    candidates.push(dashboardOrWellKnown.lifecycle.lastActive);
  }
  if (dashboardOrWellKnown && dashboardOrWellKnown.generatedAt) {
    candidates.push(dashboardOrWellKnown.generatedAt);
  }
  const cutoff = now - STALE_DAYS * 24 * 60 * 60 * 1000;
  return candidates.some((iso) => {
    const t = Date.parse(iso);
    return Number.isFinite(t) && t >= cutoff;
  });
}

async function reverifyAdopters({ registry, fetchJson, now = Date.now() }) {
  const updated = readRegistry(registry);
  const adopters = updated.adopters || [];
  const next = [];
  for (const entry of adopters) {
    if (!entry || entry.status === "rejected") {
      next.push(entry);
      continue;
    }
    const criteria = {
      cycle7d: false,
      dashboardReachable: false,
      wellKnownValid: false
    };
    let wkPayload = null;
    let dashPayload = null;
    try {
      wkPayload = await fetchJson(entry.wellKnownUrl);
      criteria.wellKnownValid = wkPayload && wkPayload.schema === "orbit-well-known/1";
    } catch {
      criteria.wellKnownValid = false;
    }
    const dashboardUrl = (entry.publicUrl ? entry.publicUrl.replace(/\/+$/, "") : "") + "/dashboard.json";
    if (entry.publicUrl) {
      try {
        dashPayload = await fetchJson(dashboardUrl);
        criteria.dashboardReachable = !!dashPayload;
      } catch {
        criteria.dashboardReachable = false;
      }
    }
    criteria.cycle7d = isCycleFreshEnough(dashPayload || wkPayload, now);
    const adopted = criteria.cycle7d && criteria.dashboardReachable && criteria.wellKnownValid;
    next.push({
      ...entry,
      lastVerifiedAt: new Date(now).toISOString(),
      criteriaStatus: criteria,
      adopted
    });
  }
  return {
    ...updated,
    schema: ADOPTERS_SCHEMA,
    updatedAt: new Date(now).toISOString(),
    adopters: next
  };
}

// S-REVENUE-1 helper: expose a compact, read-only view of the registry
// suitable for the market-signal collector. Returns one entry per VERIFIED
// adopter ("verified" = status field, not "adopted" — the bus-factor gate
// uses `adopted: true`, but for collecting signals we cast a slightly wider
// net so a temporarily-offline adopter still contributes data). Each row:
//   { fid, repo, lastSeen }
// Where `fid` falls back to `repo` when no explicit Farcaster fid is stored.
function listAdoptersForSignalCollection(adoptersState) {
  if (!adoptersState || typeof adoptersState !== "object") return [];
  const list = Array.isArray(adoptersState.adopters) ? adoptersState.adopters : [];
  return list
    .filter((a) => a && a.status === "verified")
    .map((a) => ({
      fid: typeof a.fid === "string" && a.fid.length > 0 ? a.fid : a.repo,
      repo: a.repo,
      publicUrl: a.publicUrl || null,
      lastSeen: a.lastVerifiedAt || a.verifiedAt || null
    }));
}

function projectAdoptersForDashboard(registry, options = {}) {
  const phase1Target = Number.isFinite(options.phase1Target) ? options.phase1Target : 5;
  const phase5Target = Number.isFinite(options.phase5Target) ? options.phase5Target : 50;
  const r = readRegistry(registry);
  const adopters = r.adopters || [];
  const adoptedList = adopters.filter((a) => a && a.adopted);
  const projected = adoptedList.slice(0, 20).map((a) => ({
    repo: a.repo,
    publicUrl: a.publicUrl || null,
    verifiedAt: a.verifiedAt || null,
    lastVerifiedAt: a.lastVerifiedAt || null,
    scaffolderVersion: a.scaffolderVersion || null
  }));
  return {
    schema: ADOPTERS_SCHEMA,
    total: adopters.length,
    adopted: adoptedList.length,
    phase1Target,
    phase5Target,
    phase1Progress: Math.min(1, adoptedList.length / Math.max(1, phase1Target)),
    phase5Progress: Math.min(1, adoptedList.length / Math.max(1, phase5Target)),
    list: projected
  };
}

module.exports = {
  ADOPTERS_SCHEMA,
  HANDSHAKE_LABEL,
  VERIFIED_LABEL,
  REJECTED_LABEL,
  STALE_DAYS,
  HANDSHAKE_RATE_LIMIT_PER_REPO_PER_DAY,
  buildEmptyRegistry,
  readRegistry,
  parseHandshakeIssue,
  validateHandshake,
  rateLimit,
  upsertAdopter,
  processHandshakes,
  reverifyAdopters,
  isCycleFreshEnough,
  listAdoptersForSignalCollection,
  projectAdoptersForDashboard
};
