"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  EXPERIMENT_STATUSES,
  TRANSITIONS,
  advanceLifecycle,
  defaultExperiment,
  evaluateKillCriteria,
  graduateToStream,
  isOverBudget,
  proposeExperiment,
  recordSpend
} = require("../src/agent/revenue-experiments");
const {
  ensureStreamsArray,
  getStream
} = require("../src/agent/revenue-streams");

function freshState() {
  return { problemLab: { experiments: [] } };
}

function freshTreasury() {
  return ensureStreamsArray({
    revenue: {
      operatorShareBps: 500,
      treasuryShareBps: 9500,
      payoutAsset: "configured-paired-token",
      cadence: "weekly_performance",
      claimIntervalDays: 7,
      lastClaimSentAt: null,
      lastClaimResult: null
    }
  });
}

function baseExperiment(overrides = {}) {
  return {
    id: "exp-ai-routing-margin",
    hypothesis: "Charging a 7% margin on inference routes covers AI food + leaves treasury profit",
    streamType: "ai_routing_margin",
    budgetWei: "1000",
    minSignalsToKill: 2,
    killCriteria: [
      { signal: "marginBps", operator: "<", threshold: 300 },
      { signal: "demandCallsPerDay", operator: "<", threshold: 5 }
    ],
    signalRequirements: ["marginBps", "demandCallsPerDay"],
    ...overrides
  };
}

test("defaultExperiment returns the canonical shape with defaults applied", () => {
  const exp = defaultExperiment({ id: "x", hypothesis: "y", streamType: "ai_routing_margin" });
  assert.equal(exp.id, "x");
  assert.equal(exp.hypothesis, "y");
  assert.equal(exp.streamType, "ai_routing_margin");
  assert.equal(exp.status, EXPERIMENT_STATUSES[0]);
  assert.equal(exp.budgetWei, "0");
  assert.equal(exp.spentWei, "0");
  assert.deepEqual(exp.killCriteria, []);
  assert.equal(exp.minSignalsToKill, 2);
  assert.deepEqual(exp.signalRequirements, []);
  assert.deepEqual(exp.lifecycleHistory, []);
  assert.equal(typeof exp.createdAt, "string");
  assert.deepEqual(exp.metadata, {});
});

test("defaultExperiment rejects invalid status", () => {
  assert.throws(() => defaultExperiment({ status: "nope" }), /experiment.status/);
});

test("proposeExperiment appends to state.problemLab.experiments", () => {
  const state = freshState();
  const exp = proposeExperiment(state, baseExperiment());
  assert.equal(state.problemLab.experiments.length, 1);
  assert.equal(state.problemLab.experiments[0].id, exp.id);
  assert.equal(exp.status, "hypothesis");
  assert.equal(exp.lifecycleHistory.length, 1);
  assert.equal(exp.lifecycleHistory[0].status, "hypothesis");
  assert.equal(exp.lifecycleHistory[0].reason, "proposed");
});

test("proposeExperiment rejects duplicates and missing fields", () => {
  const state = freshState();
  proposeExperiment(state, baseExperiment());
  assert.throws(() => proposeExperiment(state, baseExperiment()), /already exists/);
  assert.throws(
    () => proposeExperiment(state, baseExperiment({ id: "" })),
    /experiment.id is required/
  );
  assert.throws(
    () => proposeExperiment(state, baseExperiment({ id: "z", hypothesis: "" })),
    /hypothesis is required/
  );
  assert.throws(
    () => proposeExperiment(state, baseExperiment({ id: "z", streamType: "" })),
    /streamType is required/
  );
});

test("proposeExperiment validates killCriteria.length >= minSignalsToKill", () => {
  const state = freshState();
  // minSignalsToKill=2 but only 1 criterion -> reject.
  assert.throws(
    () => proposeExperiment(state, baseExperiment({
      id: "x",
      minSignalsToKill: 2,
      killCriteria: [{ signal: "a", operator: "<", threshold: 1 }]
    })),
    /killCriteria.length \(1\) must be >= minSignalsToKill \(2\)/
  );
  // minSignalsToKill=1 with 1 criterion -> accept.
  const exp = proposeExperiment(state, baseExperiment({
    id: "single",
    minSignalsToKill: 1,
    killCriteria: [{ signal: "a", operator: "<", threshold: 1 }]
  }));
  assert.equal(exp.minSignalsToKill, 1);
});

test("proposeExperiment validates killCriteria shape", () => {
  const state = freshState();
  assert.throws(() => proposeExperiment(state, baseExperiment({
    id: "bad",
    killCriteria: [{ operator: "<", threshold: 1 }, { signal: "a", operator: "<", threshold: 2 }]
  })), /signal is required/);
  assert.throws(() => proposeExperiment(state, baseExperiment({
    id: "bad2",
    killCriteria: [
      { signal: "a", operator: "??", threshold: 1 },
      { signal: "b", operator: "<", threshold: 1 }
    ]
  })), /operator must be one of/);
  assert.throws(() => proposeExperiment(state, baseExperiment({
    id: "bad3",
    killCriteria: [
      { signal: "a", operator: "<" },
      { signal: "b", operator: "<", threshold: 1 }
    ]
  })), /threshold is required/);
});

test("advanceLifecycle accepts valid transitions and updates history", () => {
  const state = freshState();
  proposeExperiment(state, baseExperiment());
  const updated = advanceLifecycle(state, "exp-ai-routing-margin", "dry_run", { by: "owner", reason: "owner approved" });
  assert.equal(updated.status, "dry_run");
  assert.equal(updated.lifecycleHistory.at(-1).status, "dry_run");
  assert.equal(updated.lifecycleHistory.at(-1).by, "owner");
  assert.equal(updated.lifecycleHistory.at(-1).reason, "owner approved");
  advanceLifecycle(state, "exp-ai-routing-margin", "bounded_live", {});
  assert.equal(state.problemLab.experiments[0].status, "bounded_live");
});

test("advanceLifecycle rejects illegal transitions and unknown statuses", () => {
  const state = freshState();
  proposeExperiment(state, baseExperiment());
  // hypothesis -> graduated is not allowed.
  assert.throws(
    () => advanceLifecycle(state, "exp-ai-routing-margin", "graduated", {}),
    /invalid transition: hypothesis -> graduated/
  );
  // unknown status.
  assert.throws(
    () => advanceLifecycle(state, "exp-ai-routing-margin", "nope", {}),
    /unknown status/
  );
  // unknown experiment.
  assert.throws(
    () => advanceLifecycle(state, "ghost", "dry_run", {}),
    /unknown experiment/
  );
});

test("TRANSITIONS terminal states have no outgoing edges", () => {
  assert.deepEqual(TRANSITIONS.graduated, []);
  assert.deepEqual(TRANSITIONS.sunset, []);
});

test("evaluateKillCriteria fires when minSignalsToKill is met", () => {
  const exp = defaultExperiment({
    id: "x",
    hypothesis: "h",
    streamType: "t",
    createdAt: "2026-01-01T00:00:00.000Z",
    minSignalsToKill: 2,
    killCriteria: [
      { signal: "marginBps", operator: "<", threshold: 300 },
      { signal: "demandCallsPerDay", operator: "<", threshold: 5 }
    ]
  });
  const result = evaluateKillCriteria(exp, [
    { kind: "marginBps", value: 100, ts: "2026-02-01T00:00:00.000Z" },
    { kind: "demandCallsPerDay", value: 1, ts: "2026-02-02T00:00:00.000Z" }
  ]);
  assert.equal(result.triggered, true);
  assert.equal(result.matched, 2);
  assert.equal(result.required, 2);
  assert.equal(result.signals.length, 2);
});

test("evaluateKillCriteria does NOT fire when fewer signals match", () => {
  const exp = defaultExperiment({
    id: "x",
    hypothesis: "h",
    streamType: "t",
    minSignalsToKill: 2,
    killCriteria: [
      { signal: "marginBps", operator: "<", threshold: 300 },
      { signal: "demandCallsPerDay", operator: "<", threshold: 5 }
    ]
  });
  // 1 matches; 1 does not.
  const result = evaluateKillCriteria(exp, [
    { kind: "marginBps", value: 100 },
    { kind: "demandCallsPerDay", value: 999 }
  ]);
  assert.equal(result.triggered, false);
  assert.equal(result.matched, 1);
});

test("evaluateKillCriteria fires immediately when minSignalsToKill=1", () => {
  const exp = defaultExperiment({
    id: "x",
    hypothesis: "h",
    streamType: "t",
    minSignalsToKill: 1,
    killCriteria: [{ signal: "marginBps", operator: "<", threshold: 300 }]
  });
  const result = evaluateKillCriteria(exp, [{ kind: "marginBps", value: 50 }]);
  assert.equal(result.triggered, true);
});

test("evaluateKillCriteria ignores signals older than experiment.createdAt", () => {
  const exp = defaultExperiment({
    id: "x",
    hypothesis: "h",
    streamType: "t",
    createdAt: "2026-05-01T00:00:00.000Z",
    minSignalsToKill: 1,
    killCriteria: [{ signal: "marginBps", operator: "<", threshold: 300 }]
  });
  const result = evaluateKillCriteria(exp, [
    { kind: "marginBps", value: 50, ts: "2026-04-01T00:00:00.000Z" }
  ]);
  assert.equal(result.triggered, false);
});

test("evaluateKillCriteria supports comparison operators", () => {
  const exp = defaultExperiment({
    id: "x",
    hypothesis: "h",
    streamType: "t",
    minSignalsToKill: 1,
    killCriteria: [
      { signal: "demand", operator: ">=", threshold: 100 }
    ]
  });
  assert.equal(evaluateKillCriteria(exp, [{ kind: "demand", value: 100 }]).triggered, true);
  assert.equal(evaluateKillCriteria(exp, [{ kind: "demand", value: 99 }]).triggered, false);
});

test("recordSpend accumulates spentWei and isOverBudget reports correctly", () => {
  const exp = defaultExperiment({
    id: "x",
    hypothesis: "h",
    streamType: "t",
    budgetWei: "1000"
  });
  assert.equal(isOverBudget(exp), false);
  recordSpend(exp, "400");
  assert.equal(exp.spentWei, "400");
  assert.equal(isOverBudget(exp), false);
  recordSpend(exp, 600n);
  assert.equal(exp.spentWei, "1000");
  assert.equal(isOverBudget(exp), true);
});

test("recordSpend rejects negative amounts", () => {
  const exp = defaultExperiment({ id: "x", hypothesis: "h", streamType: "t", budgetWei: "100" });
  assert.throws(() => recordSpend(exp, "-1"), /amountWei must be >= 0/);
});

test("graduateToStream creates a real stream and marks experiment graduated", () => {
  const state = freshState();
  const treasury = freshTreasury();
  proposeExperiment(state, baseExperiment());
  advanceLifecycle(state, "exp-ai-routing-margin", "dry_run", {});
  advanceLifecycle(state, "exp-ai-routing-margin", "bounded_live", {});

  const { experiment, stream } = graduateToStream(state, treasury, "exp-ai-routing-margin", {
    id: "ai-routing-margin",
    unitEconomics: { marginBps: 700 }
  });

  assert.equal(experiment.status, "graduated");
  assert.equal(experiment.lifecycleHistory.at(-1).status, "graduated");
  assert.equal(stream.id, "ai-routing-margin");
  assert.equal(stream.type, "ai_routing_margin");
  assert.equal(stream.status, "active");
  assert.equal(stream.unitEconomics.marginBps, 700);
  // The stream is reachable through getStream on the treasury.
  assert.equal(getStream(treasury, "ai-routing-margin").id, "ai-routing-margin");
});

test("graduateToStream requires a streamConfig.id and a known experiment", () => {
  const state = freshState();
  const treasury = freshTreasury();
  proposeExperiment(state, baseExperiment());
  assert.throws(
    () => graduateToStream(state, treasury, "exp-ai-routing-margin", {}),
    /streamConfig.id is required/
  );
  assert.throws(
    () => graduateToStream(state, treasury, "ghost", { id: "x" }),
    /unknown experiment/
  );
});

// ---------------------------------------------------------------------------
// S-REVENUE-3: sybil-floor gate on advanceLifecycle → bounded_live
// ---------------------------------------------------------------------------

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

// EIP-55 checksum addresses (real, valid). Reuse the canonical Spear
// (vitalik) address pattern from safes.test.js.
const SYBIL_OLD_ADDR_A = "0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359";
const SYBIL_OLD_ADDR_B = "0x1234567890aBcDef1234567890ABcDeF12345678";
const SYBIL_OLD_ADDR_C = "0xAaaAaAaaAaAaAaaAaAAAAAAAAaaaAaAaAaaAaaAa";

function oldFunders() {
  return [
    { address: SYBIL_OLD_ADDR_A, amountWei: "100", firstSeenAt: "2025-01-01T00:00:00Z" },
    { address: SYBIL_OLD_ADDR_B, amountWei: "100", firstSeenAt: "2025-01-01T00:00:00Z" },
    { address: SYBIL_OLD_ADDR_C, amountWei: "100", firstSeenAt: "2025-01-01T00:00:00Z" }
  ];
}

function youngFunders(now) {
  const iso = (now instanceof Date ? now : new Date(now)).toISOString();
  return [
    { address: SYBIL_OLD_ADDR_A, amountWei: "100", firstSeenAt: iso },
    { address: SYBIL_OLD_ADDR_B, amountWei: "100", firstSeenAt: iso },
    { address: SYBIL_OLD_ADDR_C, amountWei: "100", firstSeenAt: iso }
  ];
}

function freshStateWithBoundedLiveReady() {
  const state = freshState();
  proposeExperiment(state, baseExperiment());
  advanceLifecycle(state, "exp-ai-routing-margin", "dry_run", {});
  return state;
}

test("advanceLifecycle: bounded_live without funders succeeds (back-compat opt-in)", () => {
  const state = freshStateWithBoundedLiveReady();
  // No opts.funders — sybil gate must be skipped.
  const updated = advanceLifecycle(state, "exp-ai-routing-margin", "bounded_live", {});
  assert.equal(updated.status, "bounded_live");
});

test("advanceLifecycle: bounded_live with valid funders succeeds", () => {
  const state = freshStateWithBoundedLiveReady();
  const updated = advanceLifecycle(state, "exp-ai-routing-margin", "bounded_live", {
    funders: oldFunders(),
    env: {},
    now: new Date("2026-05-25T00:00:00Z")
  });
  assert.equal(updated.status, "bounded_live");
});

test("advanceLifecycle: bounded_live with sybil-failing funders throws + status unchanged", () => {
  const state = freshStateWithBoundedLiveReady();
  const before = state.problemLab.experiments[0].status;
  const now = new Date("2026-05-25T00:00:00Z");
  assert.throws(
    () => advanceLifecycle(state, "exp-ai-routing-margin", "bounded_live", {
      funders: youngFunders(now),
      env: {},
      now
    }),
    (err) => err && err.code === "SYBIL_FLOOR_NOT_MET"
  );
  // status MUST NOT have advanced.
  assert.equal(state.problemLab.experiments[0].status, before);
});

test("advanceLifecycle: skipSybilCheck=true bypasses gate even with bad funders", () => {
  const state = freshStateWithBoundedLiveReady();
  const now = new Date("2026-05-25T00:00:00Z");
  const updated = advanceLifecycle(state, "exp-ai-routing-margin", "bounded_live", {
    funders: youngFunders(now),
    env: {},
    now,
    skipSybilCheck: true
  });
  assert.equal(updated.status, "bounded_live");
});

// ---------------------------------------------------------------------------
// S-REVENUE-3: bus-factor gate on graduateToStream
// ---------------------------------------------------------------------------

function tmpEmptyDir(label) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `orbit-rev-exp-${label || ""}-`));
}

function rmDir(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
}

test("graduateToStream: skipBusFactorCheck=true succeeds even with no commits", () => {
  const state = freshState();
  const treasury = freshTreasury();
  proposeExperiment(state, baseExperiment());
  advanceLifecycle(state, "exp-ai-routing-margin", "dry_run", {});
  advanceLifecycle(state, "exp-ai-routing-margin", "bounded_live", {});
  const dir = tmpEmptyDir("skip");
  try {
    const { experiment, stream } = graduateToStream(
      state,
      treasury,
      "exp-ai-routing-margin",
      { id: "ai-routing-margin", unitEconomics: {} },
      { skipBusFactorCheck: true, repoRoot: dir }
    );
    assert.equal(experiment.status, "graduated");
    assert.equal(stream.id, "ai-routing-margin");
  } finally {
    rmDir(dir);
  }
});

test("graduateToStream: no repoRoot succeeds (defensive skip)", () => {
  const state = freshState();
  const treasury = freshTreasury();
  proposeExperiment(state, baseExperiment());
  advanceLifecycle(state, "exp-ai-routing-margin", "dry_run", {});
  advanceLifecycle(state, "exp-ai-routing-margin", "bounded_live", {});
  const { experiment, stream } = graduateToStream(
    state,
    treasury,
    "exp-ai-routing-margin",
    { id: "ai-routing-margin", unitEconomics: {} }
    // no opts at all — must not crash.
  );
  assert.equal(experiment.status, "graduated");
  assert.equal(stream.id, "ai-routing-margin");
});

test("graduateToStream: with empty repo + no adopters throws BUS_FACTOR_NOT_MET", () => {
  const state = freshState();
  const treasury = freshTreasury();
  proposeExperiment(state, baseExperiment());
  advanceLifecycle(state, "exp-ai-routing-margin", "dry_run", {});
  advanceLifecycle(state, "exp-ai-routing-margin", "bounded_live", {});
  // Empty tmpdir: not a git repo, no adopters-registry → busFactor = 0.
  const dir = tmpEmptyDir("empty");
  try {
    // Initialise to make sure it's a directory but not a git repo.
    assert.throws(
      () => graduateToStream(
        state,
        treasury,
        "exp-ai-routing-margin",
        { id: "ai-routing-margin", unitEconomics: {} },
        { repoRoot: dir, env: {} }
      ),
      (err) => err && err.code === "BUS_FACTOR_NOT_MET"
    );
    // experiment must remain at bounded_live since graduation refused.
    const exp = state.problemLab.experiments[0];
    assert.equal(exp.status, "bounded_live");
  } finally {
    rmDir(dir);
  }
});
