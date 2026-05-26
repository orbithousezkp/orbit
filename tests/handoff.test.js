"use strict";

// FOUNDER_HANDOFF.md §7 test plan. Every numbered invariant from the
// spec has a corresponding test below — if a future change breaks the
// spec, one of these will turn red.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  STATUSES,
  TIMELOCK_MS,
  EXTENSION_MS,
  MIN_ADOPTER_COUNT,
  proposeHandoff,
  applyComments,
  tickHandoffs,
  listHandoffs,
  parseHandoffComment,
  thresholdForHandoff
} = require("../src/agent/handoff");

function tempRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "orbit-handoff-test-"));
  fs.mkdirSync(path.join(dir, "memory"), { recursive: true });
  return dir;
}

function quorumOf(maintainers, thresholds = { high: maintainers.length, medium: 2, low: 1 }) {
  return {
    enabled: maintainers.length > 1,
    maintainers,
    thresholds
  };
}

function readyState() {
  return { preLaunchVerified: true };
}

function comment(author, body, createdAt = "2026-06-01T12:00:00Z") {
  return { author, body, createdAt };
}

function basicProposal(overrides = {}) {
  return {
    type: "signer-rotation",
    from: "alice",
    to: "bob",
    rationale: "share reduction",
    proposerUsername: "alice",
    issueNumber: 1,
    idemKey: "2026-06-01-alice-to-bob",
    ...overrides
  };
}

// === guards (§5) =============================================================

test("proposeHandoff refuses pre-launch (D-018)", () => {
  const repoRoot = tempRepo();
  assert.throws(
    () => proposeHandoff(repoRoot, basicProposal(), {
      state: { preLaunchVerified: false },
      adopterCount: 50,
      quorum: quorumOf(["alice", "bob", "carol"]),
      now: new Date("2026-06-01T00:00:00Z")
    }),
    (err) => err.code === "D018_NOT_VERIFIED"
  );
  assert.deepEqual(listHandoffs(repoRoot), []);
});

test("proposeHandoff refuses before Phase 4 (<50 adopters)", () => {
  const repoRoot = tempRepo();
  assert.throws(
    () => proposeHandoff(repoRoot, basicProposal(), {
      state: readyState(),
      adopterCount: 49,
      quorum: quorumOf(["alice", "bob", "carol"])
    }),
    (err) => err.code === "PHASE_4_NOT_ENTERED"
  );
});

test("proposeHandoff refuses when quorum is not enabled (solo-owner mode)", () => {
  const repoRoot = tempRepo();
  assert.throws(
    () => proposeHandoff(repoRoot, basicProposal(), {
      state: readyState(),
      adopterCount: 100,
      quorum: quorumOf(["alice"])      // only 1 maintainer => enabled:false
    }),
    (err) => err.code === "QUORUM_NOT_ENABLED"
  );
});

test("proposeHandoff is idempotent on the same idemKey", () => {
  const repoRoot = tempRepo();
  const deps = {
    state: readyState(),
    adopterCount: 100,
    quorum: quorumOf(["alice", "bob", "carol"])
  };
  const a = proposeHandoff(repoRoot, basicProposal(), deps);
  const b = proposeHandoff(repoRoot, basicProposal(), deps);
  assert.equal(a.alreadyExisted, false);
  assert.equal(b.alreadyExisted, true);
  assert.equal(listHandoffs(repoRoot).length, 1);
});

test("proposeHandoff rejects unknown handoff types", () => {
  const repoRoot = tempRepo();
  assert.throws(
    () => proposeHandoff(repoRoot, basicProposal({ type: "world-domination" }), {
      state: readyState(),
      adopterCount: 100,
      quorum: quorumOf(["alice", "bob", "carol"])
    }),
    (err) => err.code === "INVALID_TYPE"
  );
});

// === lifecycle transitions (§7) ==============================================

test("lifecycle: APPROVE moves proposed -> voting; reaching threshold moves -> timelock", () => {
  const repoRoot = tempRepo();
  const quorum = quorumOf(["alice", "bob", "carol"], { high: 2 });
  proposeHandoff(repoRoot, basicProposal(), {
    state: readyState(), adopterCount: 100, quorum,
    now: new Date("2026-06-01T00:00:00Z")
  });
  // First APPROVE: voting
  let result = applyComments(repoRoot, basicProposal().idemKey, [
    comment("alice", "APPROVE ORBIT-HANDOFF 2026-06-01-alice-to-bob")
  ], { quorum, now: new Date("2026-06-01T01:00:00Z") });
  assert.equal(result.handoff.status, STATUSES.VOTING);

  // Second APPROVE reaches threshold (high=2): timelock
  result = applyComments(repoRoot, basicProposal().idemKey, [
    comment("alice", "APPROVE ORBIT-HANDOFF 2026-06-01-alice-to-bob"),
    comment("bob", "APPROVE ORBIT-HANDOFF 2026-06-01-alice-to-bob")
  ], { quorum, now: new Date("2026-06-01T02:00:00Z") });
  assert.equal(result.handoff.status, STATUSES.TIMELOCK);
  assert.ok(result.handoff.quorumReachedAt);
  assert.ok(result.handoff.timelockEndsAt);
  const diff = Date.parse(result.handoff.timelockEndsAt) - Date.parse(result.handoff.quorumReachedAt);
  assert.equal(diff, TIMELOCK_MS, "timelock must be exactly 7 days");
});

test("lifecycle: REJECT during voting terminates the proposal", () => {
  const repoRoot = tempRepo();
  const quorum = quorumOf(["alice", "bob", "carol"], { high: 2 });
  proposeHandoff(repoRoot, basicProposal(), { state: readyState(), adopterCount: 100, quorum });
  const result = applyComments(repoRoot, basicProposal().idemKey, [
    comment("alice", "APPROVE ORBIT-HANDOFF 2026-06-01-alice-to-bob"),
    comment("carol", "REJECT ORBIT-HANDOFF 2026-06-01-alice-to-bob")
  ], { quorum });
  assert.equal(result.handoff.status, STATUSES.REJECTED);
});

test("lifecycle: REJECT after quorum reached is ignored (irreversibility — §6.2)", () => {
  const repoRoot = tempRepo();
  const quorum = quorumOf(["alice", "bob", "carol"], { high: 2 });
  proposeHandoff(repoRoot, basicProposal(), { state: readyState(), adopterCount: 100, quorum });
  // First: reach quorum
  applyComments(repoRoot, basicProposal().idemKey, [
    comment("alice", "APPROVE ORBIT-HANDOFF 2026-06-01-alice-to-bob"),
    comment("bob", "APPROVE ORBIT-HANDOFF 2026-06-01-alice-to-bob")
  ], { quorum });
  // Then: a late REJECT
  const result = applyComments(repoRoot, basicProposal().idemKey, [
    comment("carol", "REJECT ORBIT-HANDOFF 2026-06-01-alice-to-bob")
  ], { quorum });
  assert.equal(result.handoff.status, STATUSES.TIMELOCK, "post-quorum REJECT must NOT undo timelock");
  const hasIgnoredEntry = result.handoff.history.some((h) => h.transition === "reject-ignored-post-quorum");
  assert.equal(hasIgnoredEntry, true);
});

test("timelock cannot be skipped — tick before timelockEndsAt is a no-op", async () => {
  const repoRoot = tempRepo();
  const quorum = quorumOf(["alice", "bob", "carol"], { high: 2 });
  proposeHandoff(repoRoot, basicProposal(), {
    state: readyState(), adopterCount: 100, quorum,
    now: new Date("2026-06-01T00:00:00Z")
  });
  applyComments(repoRoot, basicProposal().idemKey, [
    comment("alice", "APPROVE ORBIT-HANDOFF 2026-06-01-alice-to-bob"),
    comment("bob", "APPROVE ORBIT-HANDOFF 2026-06-01-alice-to-bob")
  ], { quorum, now: new Date("2026-06-01T01:00:00Z") });

  // 6 days later — still inside the 7-day timelock.
  const tickResult = await tickHandoffs(repoRoot, {
    now: new Date("2026-06-07T00:00:00Z"),
    executor: () => { throw new Error("must not be called"); }
  });
  assert.deepEqual(tickResult.advanced, []);
  assert.equal(listHandoffs(repoRoot)[0].status, STATUSES.TIMELOCK);
});

test("timelock: after expiry, tick advances to executing and to complete via executor", async () => {
  const repoRoot = tempRepo();
  const quorum = quorumOf(["alice", "bob", "carol"], { high: 2 });
  proposeHandoff(repoRoot, basicProposal(), {
    state: readyState(), adopterCount: 100, quorum,
    now: new Date("2026-06-01T00:00:00Z")
  });
  applyComments(repoRoot, basicProposal().idemKey, [
    comment("alice", "APPROVE ORBIT-HANDOFF 2026-06-01-alice-to-bob"),
    comment("bob", "APPROVE ORBIT-HANDOFF 2026-06-01-alice-to-bob")
  ], { quorum, now: new Date("2026-06-01T01:00:00Z") });

  let executed = null;
  const tickResult = await tickHandoffs(repoRoot, {
    now: new Date("2026-06-10T00:00:00Z"),     // well past timelockEndsAt
    executor: async (handoff) => {
      executed = handoff;
      return { txHash: "0xabc" };
    }
  });
  assert.equal(tickResult.advanced.length, 1);
  assert.equal(tickResult.advanced[0].status, STATUSES.COMPLETE);
  assert.ok(executed, "executor must have been called");
  const stored = listHandoffs(repoRoot)[0];
  assert.equal(stored.status, STATUSES.COMPLETE);
  assert.ok(stored.executedAt);
});

test("executor failure puts the handoff into FAILED with the error recorded", async () => {
  const repoRoot = tempRepo();
  const quorum = quorumOf(["alice", "bob", "carol"], { high: 2 });
  proposeHandoff(repoRoot, basicProposal(), {
    state: readyState(), adopterCount: 100, quorum,
    now: new Date("2026-06-01T00:00:00Z")
  });
  applyComments(repoRoot, basicProposal().idemKey, [
    comment("alice", "APPROVE ORBIT-HANDOFF 2026-06-01-alice-to-bob"),
    comment("bob", "APPROVE ORBIT-HANDOFF 2026-06-01-alice-to-bob")
  ], { quorum, now: new Date("2026-06-01T01:00:00Z") });

  const tickResult = await tickHandoffs(repoRoot, {
    now: new Date("2026-06-10T00:00:00Z"),
    executor: () => { throw new Error("Safe rotation tx reverted"); }
  });
  assert.equal(tickResult.errors.length, 1);
  const stored = listHandoffs(repoRoot)[0];
  assert.equal(stored.status, STATUSES.FAILED);
  assert.match(stored.executionError, /reverted/);
});

test("tick with no executor wired leaves the handoff in EXECUTING with a marker", async () => {
  const repoRoot = tempRepo();
  const quorum = quorumOf(["alice", "bob", "carol"], { high: 2 });
  proposeHandoff(repoRoot, basicProposal(), {
    state: readyState(), adopterCount: 100, quorum,
    now: new Date("2026-06-01T00:00:00Z")
  });
  applyComments(repoRoot, basicProposal().idemKey, [
    comment("alice", "APPROVE ORBIT-HANDOFF 2026-06-01-alice-to-bob"),
    comment("bob", "APPROVE ORBIT-HANDOFF 2026-06-01-alice-to-bob")
  ], { quorum, now: new Date("2026-06-01T01:00:00Z") });

  const tickResult = await tickHandoffs(repoRoot, {
    now: new Date("2026-06-10T00:00:00Z")
    // no executor
  });
  assert.equal(tickResult.advanced.length, 1);
  assert.equal(tickResult.advanced[0].ready, true);
  const stored = listHandoffs(repoRoot)[0];
  assert.equal(stored.status, STATUSES.EXECUTING);
  const hasMarker = stored.history.some((h) => h.transition === "executing-no-executor");
  assert.equal(hasMarker, true);
});

// === EXTEND (§4 — extension allowed once and only once) ======================

test("EXTEND during timelock adds +7 days; second EXTEND is ignored", () => {
  const repoRoot = tempRepo();
  const quorum = quorumOf(["alice", "bob", "carol"], { high: 2 });
  proposeHandoff(repoRoot, basicProposal(), {
    state: readyState(), adopterCount: 100, quorum,
    now: new Date("2026-06-01T00:00:00Z")
  });
  let r = applyComments(repoRoot, basicProposal().idemKey, [
    comment("alice", "APPROVE ORBIT-HANDOFF 2026-06-01-alice-to-bob"),
    comment("bob", "APPROVE ORBIT-HANDOFF 2026-06-01-alice-to-bob")
  ], { quorum, now: new Date("2026-06-01T01:00:00Z") });
  const beforeExtension = r.handoff.timelockEndsAt;

  r = applyComments(repoRoot, basicProposal().idemKey, [
    comment("carol", "EXTEND ORBIT-HANDOFF 2026-06-01-alice-to-bob")
  ], { quorum, now: new Date("2026-06-02T00:00:00Z") });
  const afterFirstExtension = r.handoff.timelockEndsAt;
  assert.equal(
    Date.parse(afterFirstExtension) - Date.parse(beforeExtension),
    EXTENSION_MS,
    "first EXTEND must add exactly 7 days"
  );
  assert.equal(r.handoff.extensions, 1);

  // Second EXTEND: ignored.
  r = applyComments(repoRoot, basicProposal().idemKey, [
    comment("alice", "EXTEND ORBIT-HANDOFF 2026-06-01-alice-to-bob")
  ], { quorum, now: new Date("2026-06-03T00:00:00Z") });
  assert.equal(r.handoff.timelockEndsAt, afterFirstExtension);
  assert.equal(r.handoff.extensions, 1);
  const ignored = r.handoff.history.some((h) => h.transition === "extend-ignored-already-used");
  assert.equal(ignored, true);
});

test("EXTEND before timelock has begun is ignored", () => {
  const repoRoot = tempRepo();
  const quorum = quorumOf(["alice", "bob", "carol"], { high: 2 });
  proposeHandoff(repoRoot, basicProposal(), { state: readyState(), adopterCount: 100, quorum });
  const r = applyComments(repoRoot, basicProposal().idemKey, [
    comment("alice", "EXTEND ORBIT-HANDOFF 2026-06-01-alice-to-bob")
  ], { quorum });
  assert.equal(r.handoff.extensions, 0);
  assert.equal(r.handoff.status, STATUSES.PROPOSED);
});

// === comment grammar parsing (§4) ============================================

test("parseHandoffComment ignores comments from non-maintainers", () => {
  const parsed = parseHandoffComment(
    comment("randomguy", "APPROVE ORBIT-HANDOFF abc"),
    "abc",
    ["alice", "bob"]
  );
  assert.equal(parsed, null);
});

test("parseHandoffComment ignores wrong idem key", () => {
  const parsed = parseHandoffComment(
    comment("alice", "APPROVE ORBIT-HANDOFF wrong-key"),
    "right-key",
    ["alice"]
  );
  assert.equal(parsed, null);
});

test("parseHandoffComment must be the FULL line, not inside prose", () => {
  // "I think we should APPROVE ORBIT-HANDOFF abc" must NOT count as a vote;
  // the line-anchored regex protects against accidental triggers.
  const parsed = parseHandoffComment(
    comment("alice", "I think we should APPROVE ORBIT-HANDOFF abc later."),
    "abc",
    ["alice"]
  );
  assert.equal(parsed, null);
});

test("parseHandoffComment is case-insensitive on author but case-sensitive on the keyword", () => {
  // "approve" lowercase is not enough — the protocol requires uppercase APPROVE.
  const lowered = parseHandoffComment(
    comment("alice", "approve orbit-handoff abc"),
    "abc",
    ["alice"]
  );
  assert.equal(lowered, null);

  const upperCased = parseHandoffComment(
    comment("ALICE", "APPROVE ORBIT-HANDOFF abc"),
    "abc",
    ["alice"]
  );
  assert.equal(upperCased.kind, "APPROVE");
  assert.equal(upperCased.author, "alice");
});

// === threshold helper ========================================================

test("thresholdForHandoff defaults to total (high tier) when none specified", () => {
  assert.equal(thresholdForHandoff({ maintainers: ["a", "b", "c"], thresholds: {} }), 3);
  assert.equal(thresholdForHandoff({ maintainers: ["a", "b", "c"], thresholds: { high: 2 } }), 2);
  // Clamp to total even if config requests more.
  assert.equal(thresholdForHandoff({ maintainers: ["a", "b"], thresholds: { high: 10 } }), 2);
});

// === storage durability ======================================================

test("handoff.json is atomic — no .tmp file leftover after a series of writes", () => {
  const repoRoot = tempRepo();
  const quorum = quorumOf(["alice", "bob", "carol"], { high: 2 });
  for (let i = 0; i < 10; i++) {
    proposeHandoff(repoRoot, basicProposal({ idemKey: `key-${i}` }), {
      state: readyState(), adopterCount: 100, quorum
    });
  }
  const leftovers = fs.readdirSync(path.join(repoRoot, "memory"))
    .filter((n) => n.startsWith(".handoff.json.tmp"));
  assert.deepEqual(leftovers, []);
  assert.equal(listHandoffs(repoRoot).length, 10);
});

// === MIN_ADOPTER_COUNT constant sanity =======================================

test("MIN_ADOPTER_COUNT matches the spec (50)", () => {
  // Pinned so a future spec edit that loosens this triggers a test
  // failure that prompts review of FOUNDER_HANDOFF.md.
  assert.equal(MIN_ADOPTER_COUNT, 50);
});
