"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  ADOPTERS_SCHEMA,
  HANDSHAKE_LABEL,
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
  projectAdoptersForDashboard
} = require("../src/agent/adopters");

const OWN_REPO = "orbithousezkp/orbit";

function handshakeIssue(overrides = {}) {
  return {
    number: 10,
    body: [
      "## Adopter Handshake",
      "",
      "Repo: https://github.com/alice/alice-orbit",
      "Well-known: https://alice.example/.well-known/orbit.json",
      "Signer: 0xABCDEFabcdef0123456789012345678901234567",
      "First cycle: 1",
      ""
    ].join("\n"),
    labels: [HANDSHAKE_LABEL],
    author: "alice",
    created_at: "2026-05-25T12:00:00Z",
    ...overrides
  };
}

function validWellKnown(overrides = {}) {
  return {
    schema: "orbit-well-known/1",
    identity: {
      repo: "alice/alice-orbit",
      publicUrl: "https://alice.example",
      signer: "0xABCDEFabcdef0123456789012345678901234567"
    },
    lineage: {
      parent: OWN_REPO,
      adoptedAt: "2026-05-25T10:00:00Z",
      scaffolderVersion: "0.1.0"
    },
    ...overrides
  };
}

test("buildEmptyRegistry produces a schema-tagged shell", () => {
  const r = buildEmptyRegistry();
  assert.equal(r.schema, ADOPTERS_SCHEMA);
  assert.deepEqual(r.adopters, []);
});

test("readRegistry tolerates null + legacy shapes", () => {
  assert.equal(readRegistry(null).schema, ADOPTERS_SCHEMA);
  assert.deepEqual(readRegistry({ schema: "old/1", adopters: [] }).adopters, []);
});

test("parseHandshakeIssue extracts repo + well-known from a normal body", () => {
  const claim = parseHandshakeIssue(handshakeIssue());
  assert.equal(claim.claimedRepo, "alice/alice-orbit");
  assert.equal(claim.wellKnownUrl, "https://alice.example/.well-known/orbit.json");
});

test("parseHandshakeIssue returns null when fields are missing", () => {
  assert.equal(parseHandshakeIssue({ body: "just text" }), null);
  assert.equal(parseHandshakeIssue(null), null);
});

test("validateHandshake passes a well-formed claim with matching lineage and repo", () => {
  const claim = parseHandshakeIssue(handshakeIssue());
  const verdict = validateHandshake({ claim, wellKnownPayload: validWellKnown(), ownRepo: OWN_REPO });
  assert.equal(verdict.ok, true);
});

test("validateHandshake rejects missing lineage", () => {
  const claim = parseHandshakeIssue(handshakeIssue());
  const wk = validWellKnown({ lineage: undefined });
  delete wk.lineage;
  const verdict = validateHandshake({ claim, wellKnownPayload: wk, ownRepo: OWN_REPO });
  assert.equal(verdict.ok, false);
  assert.equal(verdict.code, "handshake_lineage_missing");
});

test("validateHandshake rejects lineage pointing elsewhere", () => {
  const claim = parseHandshakeIssue(handshakeIssue());
  const wk = validWellKnown({ lineage: { parent: "someone/else" } });
  const verdict = validateHandshake({ claim, wellKnownPayload: wk, ownRepo: OWN_REPO });
  assert.equal(verdict.code, "handshake_lineage_mismatch");
});

test("validateHandshake rejects identity.repo mismatch (claim != well-known)", () => {
  const claim = parseHandshakeIssue(handshakeIssue());
  const wk = validWellKnown({ identity: { repo: "bob/somewhere-else" } });
  const verdict = validateHandshake({ claim, wellKnownPayload: wk, ownRepo: OWN_REPO });
  assert.equal(verdict.code, "handshake_identity_mismatch");
});

test("validateHandshake rejects unreachable well-known (null payload)", () => {
  const claim = parseHandshakeIssue(handshakeIssue());
  const verdict = validateHandshake({ claim, wellKnownPayload: null, ownRepo: OWN_REPO });
  assert.equal(verdict.code, "handshake_well_known_unreachable");
});

test("rateLimit triggers after N attempts in 24h", () => {
  const registry = buildEmptyRegistry();
  const now = new Date().toISOString();
  for (let i = 0; i < HANDSHAKE_RATE_LIMIT_PER_REPO_PER_DAY; i += 1) {
    registry.adopters.push({ repo: "x/y", handshakeAttemptedAt: now });
  }
  assert.equal(rateLimit(registry, "x/y"), true);
});

test("rateLimit ignores attempts older than 24h", () => {
  const registry = buildEmptyRegistry();
  const ancient = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  for (let i = 0; i < HANDSHAKE_RATE_LIMIT_PER_REPO_PER_DAY + 1; i += 1) {
    registry.adopters.push({ repo: "x/y", handshakeAttemptedAt: ancient });
  }
  assert.equal(rateLimit(registry, "x/y"), false);
});

test("upsertAdopter inserts new and updates existing entries by repo", () => {
  let r = buildEmptyRegistry();
  r = upsertAdopter(r, { repo: "x/y", status: "pending" });
  assert.equal(r.adopters.length, 1);
  r = upsertAdopter(r, { repo: "x/y", status: "verified" });
  assert.equal(r.adopters.length, 1);
  assert.equal(r.adopters[0].status, "verified");
});

test("processHandshakes verifies a valid claim and adds to registry", async () => {
  const registry = buildEmptyRegistry();
  const fetchJson = async () => validWellKnown();
  const refusals = [];
  const result = await processHandshakes({
    registry,
    issues: [handshakeIssue()],
    ownRepo: OWN_REPO,
    fetchJson,
    logRefusal: (e) => refusals.push(e)
  });
  assert.equal(refusals.length, 0);
  assert.equal(result.decisions[0].code, "verified");
  assert.equal(result.registry.adopters[0].repo, "alice/alice-orbit");
  assert.equal(result.registry.adopters[0].status, "verified");
});

test("processHandshakes records refusal when lineage backlink is wrong", async () => {
  const registry = buildEmptyRegistry();
  const fetchJson = async () => validWellKnown({ lineage: { parent: "wrong/parent" } });
  const refusals = [];
  const result = await processHandshakes({
    registry,
    issues: [handshakeIssue()],
    ownRepo: OWN_REPO,
    fetchJson,
    logRefusal: (e) => refusals.push(e)
  });
  assert.equal(refusals.length, 1);
  assert.equal(refusals[0].code, "handshake_lineage_mismatch");
  assert.equal(result.registry.adopters[0].status, "rejected");
  assert.equal(result.registry.adopters[0].rejectionCode, "handshake_lineage_mismatch");
});

test("processHandshakes skips issues without the handshake label", async () => {
  const registry = buildEmptyRegistry();
  const fetchJson = async () => validWellKnown();
  const result = await processHandshakes({
    registry,
    issues: [handshakeIssue({ labels: ["something-else"] })],
    ownRepo: OWN_REPO,
    fetchJson,
    logRefusal: () => {}
  });
  assert.equal(result.decisions.length, 0);
  assert.equal(result.registry.adopters.length, 0);
});

test("processHandshakes refuses when fetch throws (well-known unreachable)", async () => {
  const registry = buildEmptyRegistry();
  const fetchJson = async () => { throw new Error("ENOTFOUND"); };
  const result = await processHandshakes({
    registry,
    issues: [handshakeIssue()],
    ownRepo: OWN_REPO,
    fetchJson,
    logRefusal: () => {}
  });
  assert.equal(result.decisions[0].code, "handshake_well_known_unreachable");
});

test("isCycleFreshEnough returns true within 7 days, false beyond", () => {
  const fresh = { generatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString() };
  const stale = { generatedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() };
  assert.equal(isCycleFreshEnough(fresh), true);
  assert.equal(isCycleFreshEnough(stale), false);
});

test("reverifyAdopters marks adopted=true only when all 3 criteria pass", async () => {
  const registry = upsertAdopter(buildEmptyRegistry(), {
    repo: "alice/alice-orbit",
    wellKnownUrl: "https://alice.example/.well-known/orbit.json",
    publicUrl: "https://alice.example",
    status: "verified",
    adopted: false
  });
  const fetchJson = async (url) => {
    if (url.endsWith("/dashboard.json")) {
      return { lifecycle: { lastActive: new Date(Date.now() - 60_000).toISOString() } };
    }
    return validWellKnown();
  };
  const result = await reverifyAdopters({ registry, fetchJson });
  assert.equal(result.adopters[0].adopted, true);
  assert.equal(result.adopters[0].criteriaStatus.cycle7d, true);
  assert.equal(result.adopters[0].criteriaStatus.dashboardReachable, true);
  assert.equal(result.adopters[0].criteriaStatus.wellKnownValid, true);
});

test("reverifyAdopters marks adopted=false if dashboard unreachable", async () => {
  const registry = upsertAdopter(buildEmptyRegistry(), {
    repo: "alice/alice-orbit",
    wellKnownUrl: "https://alice.example/.well-known/orbit.json",
    publicUrl: "https://alice.example",
    status: "verified",
    adopted: true
  });
  const fetchJson = async (url) => {
    if (url.endsWith("/dashboard.json")) throw new Error("HTTP 404");
    return validWellKnown();
  };
  const result = await reverifyAdopters({ registry, fetchJson });
  assert.equal(result.adopters[0].adopted, false);
  assert.equal(result.adopters[0].criteriaStatus.dashboardReachable, false);
});

test("reverifyAdopters skips rejected entries (does not re-fetch)", async () => {
  const registry = upsertAdopter(buildEmptyRegistry(), {
    repo: "spammer/repo",
    status: "rejected",
    adopted: false
  });
  let fetched = 0;
  const fetchJson = async () => { fetched += 1; return validWellKnown(); };
  const result = await reverifyAdopters({ registry, fetchJson });
  assert.equal(fetched, 0);
  assert.equal(result.adopters[0].status, "rejected");
});

test("projectAdoptersForDashboard surfaces only adopted, with phase 1/5 targets", () => {
  let registry = buildEmptyRegistry();
  registry = upsertAdopter(registry, { repo: "a/x", adopted: true, status: "verified" });
  registry = upsertAdopter(registry, { repo: "b/x", adopted: false, status: "verified" });
  registry = upsertAdopter(registry, { repo: "c/x", adopted: true, status: "verified" });
  const slim = projectAdoptersForDashboard(registry);
  assert.equal(slim.total, 3);
  assert.equal(slim.adopted, 2);
  assert.equal(slim.phase1Target, 5);
  assert.equal(slim.phase5Target, 50);
  assert.equal(slim.phase1Progress, 0.4);
  assert.equal(slim.list.length, 2);
});
