"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("fs");
const os = require("os");
const path = require("path");

const explorer = require("../src/agent/revenue-explorer");
const {
  DEFAULT_BOUNDED_LIVE_DURATION_WEEKS,
  DEFAULT_LOOKBACK_HOURS,
  DEFAULT_MIN_DRY_RUN_CYCLES,
  buildProposal,
  clearProposal,
  defaultExplorerState,
  evaluateExperiment,
  listProposals,
  loadExplorerConfig,
  recommendNextTransition,
  runExplorer
} = explorer;

function tmpRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "orbit-explorer-"));
  fs.mkdirSync(path.join(dir, "memory"), { recursive: true });
  return dir;
}

function rm(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
}

function isoMinus(hours) {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

function freshExperiment(overrides = {}) {
  const now = new Date().toISOString();
  return Object.assign({
    id: "exp-test",
    hypothesis: "h",
    streamType: "ai_routing_margin",
    status: "dry_run",
    budgetWei: "1000",
    spentWei: "0",
    killCriteria: [
      { signal: "marginBps", operator: "<", threshold: 300 },
      { signal: "demandCallsPerDay", operator: "<", threshold: 5 }
    ],
    minSignalsToKill: 2,
    signalRequirements: ["marginBps", "demandCallsPerDay"],
    lifecycleHistory: [
      { status: "hypothesis", ts: isoMinus(48), by: "auto", reason: "proposed" },
      { status: "dry_run", ts: isoMinus(24), by: "owner", reason: "owner approved" }
    ],
    createdAt: isoMinus(48),
    metadata: {}
  }, overrides);
}

function freshState(experiments = []) {
  return {
    problemLab: { experiments },
    revenueExplorer: defaultExplorerState()
  };
}

// --- loadExplorerConfig ----------------------------------------------------

test("loadExplorerConfig returns defaults when env is empty", () => {
  const cfg = loadExplorerConfig({});
  assert.equal(cfg.lookbackHours, DEFAULT_LOOKBACK_HOURS);
  assert.equal(cfg.minDryRunCycles, DEFAULT_MIN_DRY_RUN_CYCLES);
  assert.equal(cfg.boundedLiveWeeks, DEFAULT_BOUNDED_LIVE_DURATION_WEEKS);
});

test("loadExplorerConfig honors env overrides", () => {
  const cfg = loadExplorerConfig({
    ORBIT_EXPLORER_LOOKBACK_HOURS: "72",
    ORBIT_EXPLORER_MIN_DRY_RUN_CYCLES: "3",
    ORBIT_EXPLORER_BOUNDED_LIVE_WEEKS: "2"
  });
  assert.equal(cfg.lookbackHours, 72);
  assert.equal(cfg.minDryRunCycles, 3);
  assert.equal(cfg.boundedLiveWeeks, 2);
});

test("loadExplorerConfig rejects invalid (negative/non-numeric) env values", () => {
  const cfg = loadExplorerConfig({
    ORBIT_EXPLORER_LOOKBACK_HOURS: "-5",
    ORBIT_EXPLORER_MIN_DRY_RUN_CYCLES: "abc",
    ORBIT_EXPLORER_BOUNDED_LIVE_WEEKS: ""
  });
  assert.equal(cfg.lookbackHours, DEFAULT_LOOKBACK_HOURS);
  assert.equal(cfg.minDryRunCycles, DEFAULT_MIN_DRY_RUN_CYCLES);
  assert.equal(cfg.boundedLiveWeeks, DEFAULT_BOUNDED_LIVE_DURATION_WEEKS);
});

// --- evaluateExperiment ----------------------------------------------------

test("evaluateExperiment returns zero signals when input list is empty", () => {
  const ev = evaluateExperiment(freshExperiment(), [], null, loadExplorerConfig({}), {});
  assert.equal(ev.experimentId, "exp-test");
  assert.equal(ev.signalsConsidered, 0);
  assert.equal(ev.killEvaluation.triggered, false);
  assert.equal(ev.killEvaluation.matched, 0);
});

test("evaluateExperiment does NOT trigger kill when signals miss thresholds", () => {
  const signals = [
    { kind: "marginBps", value: 500, ts: isoMinus(2) },
    { kind: "demandCallsPerDay", value: 50, ts: isoMinus(1) }
  ];
  const ev = evaluateExperiment(freshExperiment(), signals, null, loadExplorerConfig({}), {});
  assert.equal(ev.killEvaluation.triggered, false);
  assert.equal(ev.signalsConsidered, 2);
});

test("evaluateExperiment triggers kill with multi-signal threshold breach", () => {
  const signals = [
    { kind: "marginBps", value: 100, ts: isoMinus(2) },
    { kind: "demandCallsPerDay", value: 1, ts: isoMinus(1) }
  ];
  const ev = evaluateExperiment(freshExperiment(), signals, null, loadExplorerConfig({}), {});
  assert.equal(ev.killEvaluation.triggered, true);
  assert.equal(ev.killEvaluation.matched, 2);
  assert.equal(ev.killEvaluation.required, 2);
});

test("evaluateExperiment triggers kill with single-signal (minSignalsToKill=1)", () => {
  const exp = freshExperiment({
    minSignalsToKill: 1,
    killCriteria: [{ signal: "marginBps", operator: "<", threshold: 200 }]
  });
  const signals = [{ kind: "marginBps", value: 50, ts: isoMinus(2) }];
  const ev = evaluateExperiment(exp, signals, null, loadExplorerConfig({}), {});
  assert.equal(ev.killEvaluation.triggered, true);
  assert.equal(ev.killEvaluation.matched, 1);
});

test("evaluateExperiment does NOT trigger when only one of two criteria matches", () => {
  const signals = [
    { kind: "marginBps", value: 100, ts: isoMinus(2) },
    { kind: "demandCallsPerDay", value: 100, ts: isoMinus(1) }
  ];
  const ev = evaluateExperiment(freshExperiment(), signals, null, loadExplorerConfig({}), {});
  assert.equal(ev.killEvaluation.triggered, false);
  assert.equal(ev.killEvaluation.matched, 1);
});

// --- recommendNextTransition -----------------------------------------------

test("recommendNextTransition: hypothesis always holds", () => {
  const r = recommendNextTransition(
    freshExperiment({ status: "hypothesis" }),
    { killEvaluation: { triggered: false }, signalsConsidered: 0 },
    loadExplorerConfig({})
  );
  assert.equal(r.recommendation, "hold");
  assert.equal(r.reason, "awaits_owner_approval");
});

test("recommendNextTransition: dry_run + killed -> sunset", () => {
  const r = recommendNextTransition(
    freshExperiment({ status: "dry_run" }),
    { killEvaluation: { triggered: true }, signalsConsidered: 4 },
    loadExplorerConfig({})
  );
  assert.equal(r.recommendation, "sunset");
  assert.equal(r.toStatus, "sunset");
  assert.match(r.reason, /kill_criteria/);
});

test("recommendNextTransition: dry_run + enough cycles + not killed -> advance to bounded_live", () => {
  const r = recommendNextTransition(
    freshExperiment({ status: "dry_run" }),
    { killEvaluation: { triggered: false }, signalsConsidered: 8 },
    loadExplorerConfig({ ORBIT_EXPLORER_MIN_DRY_RUN_CYCLES: "8" })
  );
  assert.equal(r.recommendation, "advance");
  assert.equal(r.toStatus, "bounded_live");
});

test("recommendNextTransition: dry_run + insufficient cycles -> hold", () => {
  const r = recommendNextTransition(
    freshExperiment({ status: "dry_run" }),
    { killEvaluation: { triggered: false }, signalsConsidered: 2 },
    loadExplorerConfig({ ORBIT_EXPLORER_MIN_DRY_RUN_CYCLES: "8" })
  );
  assert.equal(r.recommendation, "hold");
  assert.match(r.reason, /dry_run_cycles_insufficient/);
});

test("recommendNextTransition: bounded_live + killed -> sunset", () => {
  const r = recommendNextTransition(
    freshExperiment({ status: "bounded_live" }),
    { killEvaluation: { triggered: true }, signalsConsidered: 5 },
    loadExplorerConfig({})
  );
  assert.equal(r.recommendation, "sunset");
});

test("recommendNextTransition: bounded_live + over-budget -> sunset", () => {
  const exp = freshExperiment({
    status: "bounded_live",
    budgetWei: "100",
    spentWei: "200"
  });
  const r = recommendNextTransition(
    exp,
    { killEvaluation: { triggered: false }, signalsConsidered: 10 },
    loadExplorerConfig({})
  );
  assert.equal(r.recommendation, "sunset");
  assert.equal(r.reason, "over_budget");
});

test("recommendNextTransition: bounded_live + duration elapsed -> advance to graduated", () => {
  // Place the bounded_live entry far enough back that 1 week is met.
  const sixWeeksAgoIso = new Date(Date.now() - 6 * 7 * 24 * 60 * 60 * 1000).toISOString();
  const exp = freshExperiment({
    status: "bounded_live",
    budgetWei: "1000",
    spentWei: "10",
    lifecycleHistory: [
      { status: "dry_run", ts: isoMinus(24 * 50), by: "owner", reason: "ok" },
      { status: "bounded_live", ts: sixWeeksAgoIso, by: "owner", reason: "ok" }
    ]
  });
  const r = recommendNextTransition(
    exp,
    { killEvaluation: { triggered: false }, signalsConsidered: 50 },
    loadExplorerConfig({ ORBIT_EXPLORER_BOUNDED_LIVE_WEEKS: "4" })
  );
  assert.equal(r.recommendation, "advance");
  assert.equal(r.toStatus, "graduated");
});

test("recommendNextTransition: bounded_live + duration pending -> hold", () => {
  const oneDayAgoIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const exp = freshExperiment({
    status: "bounded_live",
    budgetWei: "1000",
    spentWei: "10",
    lifecycleHistory: [
      { status: "dry_run", ts: isoMinus(48), by: "owner", reason: "ok" },
      { status: "bounded_live", ts: oneDayAgoIso, by: "owner", reason: "ok" }
    ]
  });
  const r = recommendNextTransition(
    exp,
    { killEvaluation: { triggered: false }, signalsConsidered: 20 },
    loadExplorerConfig({ ORBIT_EXPLORER_BOUNDED_LIVE_WEEKS: "4" })
  );
  assert.equal(r.recommendation, "hold");
  assert.match(r.reason, /bounded_live_duration_pending/);
});

test("recommendNextTransition: graduated and sunset hold (terminal)", () => {
  for (const status of ["graduated", "sunset"]) {
    const r = recommendNextTransition(
      freshExperiment({ status }),
      { killEvaluation: { triggered: false }, signalsConsidered: 0 },
      loadExplorerConfig({})
    );
    assert.equal(r.recommendation, "hold");
    assert.equal(r.reason, "terminal_status");
  }
});

// --- buildProposal ---------------------------------------------------------

test("buildProposal advance proposal needs owner approval", () => {
  const exp = freshExperiment({ status: "dry_run" });
  const ev = { killEvaluation: { triggered: false } };
  const rec = { recommendation: "advance", toStatus: "bounded_live", reason: "ok" };
  const p = buildProposal(exp, ev, rec);
  assert.equal(p.experimentId, "exp-test");
  assert.equal(p.currentStatus, "dry_run");
  assert.equal(p.proposedStatus, "bounded_live");
  assert.equal(p.needsOwnerApproval, true);
  assert.deepEqual(p.killSignalsTriggered, []);
  assert.equal(typeof p.proposedAt, "string");
});

test("buildProposal sunset proposal does NOT need owner approval", () => {
  const exp = freshExperiment({ status: "dry_run" });
  const ev = { killEvaluation: { triggered: true } };
  const rec = { recommendation: "sunset", toStatus: "sunset", reason: "killed" };
  const p = buildProposal(exp, ev, rec);
  assert.equal(p.needsOwnerApproval, false);
  assert.equal(p.proposedStatus, "sunset");
  assert.ok(p.killSignalsTriggered.length > 0);
});

// --- runExplorer end-to-end -----------------------------------------------

function withSignalsFile(repoRoot, signals) {
  const lines = signals.map((s) => JSON.stringify(s)).join("\n") + "\n";
  fs.writeFileSync(path.join(repoRoot, "memory", "market-signals.jsonl"), lines, "utf-8");
}

test("runExplorer sunsets a killed experiment and writes lifecycleHistory", async () => {
  const dir = tmpRepo();
  try {
    const state = freshState([freshExperiment()]);
    withSignalsFile(dir, [
      { kind: "marginBps", value: 50, ts: isoMinus(2) },
      { kind: "demandCallsPerDay", value: 1, ts: isoMinus(1) }
    ]);
    const result = await runExplorer(state, {}, { repoRoot: dir }, {}, { repoRoot: dir });
    assert.equal(result.evaluated, 1);
    assert.equal(result.sunset, 1);
    const exp = state.problemLab.experiments[0];
    assert.equal(exp.status, "sunset");
    const lastLifecycle = exp.lifecycleHistory.at(-1);
    assert.equal(lastLifecycle.status, "sunset");
    assert.equal(lastLifecycle.by, "auto");
    assert.match(lastLifecycle.reason, /kill_criteria/);
  } finally {
    rm(dir);
  }
});

test("runExplorer adds advance proposal but does NOT auto-advance", async () => {
  const dir = tmpRepo();
  try {
    // Need enough signals to trigger advance under low minDryRunCycles.
    const signals = [
      { kind: "marginBps", value: 900, ts: isoMinus(5) },
      { kind: "marginBps", value: 950, ts: isoMinus(4) },
      { kind: "marginBps", value: 1000, ts: isoMinus(3) }
    ];
    withSignalsFile(dir, signals);
    const state = freshState([freshExperiment()]);
    const result = await runExplorer(
      state,
      {},
      { repoRoot: dir },
      { ORBIT_EXPLORER_MIN_DRY_RUN_CYCLES: "2" },
      { repoRoot: dir }
    );
    assert.equal(result.proposalsAdded, 1);
    assert.equal(result.sunset, 0);
    // experiment status MUST NOT have changed (explorer never auto-advances).
    assert.equal(state.problemLab.experiments[0].status, "dry_run");
    const proposals = listProposals(state);
    assert.equal(proposals.length, 1);
    assert.equal(proposals[0].experimentId, "exp-test");
    assert.equal(proposals[0].proposedStatus, "bounded_live");
    assert.equal(proposals[0].needsOwnerApproval, true);
  } finally {
    rm(dir);
  }
});

test("runExplorer survives a malformed experiment without losing siblings", async () => {
  const dir = tmpRepo();
  try {
    const good = freshExperiment({ id: "good", status: "dry_run" });
    const malformed = null; // intentional landmine
    const broken = {
      id: "broken",
      status: "dry_run",
      // missing arrays / no createdAt
      killCriteria: "not-an-array"
    };
    const state = freshState([malformed, broken, good]);
    withSignalsFile(dir, [
      { kind: "marginBps", value: 50, ts: isoMinus(2) },
      { kind: "demandCallsPerDay", value: 1, ts: isoMinus(1) }
    ]);
    const result = await runExplorer(state, {}, { repoRoot: dir }, {}, { repoRoot: dir });
    // good is still sunset; broken either errored or held — neither breaks
    // the whole pass.
    const goodExp = state.problemLab.experiments.find((e) => e && e.id === "good");
    assert.equal(goodExp.status, "sunset");
    assert.ok(result.evaluated >= 1, "at least the good experiment was evaluated");
  } finally {
    rm(dir);
  }
});

test("runExplorer records run in state.revenueExplorer.runHistory", async () => {
  const dir = tmpRepo();
  try {
    const state = freshState([]);
    const result = await runExplorer(state, {}, { repoRoot: dir }, {}, { repoRoot: dir });
    assert.equal(result.evaluated, 0);
    assert.equal(typeof state.revenueExplorer.lastRanAt, "string");
    assert.equal(state.revenueExplorer.runHistory.length, 1);
    assert.equal(state.revenueExplorer.runHistory[0].evaluated, 0);
  } finally {
    rm(dir);
  }
});

test("runExplorer cold-starts state.revenueExplorer when missing", async () => {
  const dir = tmpRepo();
  try {
    const state = { problemLab: { experiments: [] } };
    await runExplorer(state, {}, { repoRoot: dir }, {}, { repoRoot: dir });
    assert.ok(state.revenueExplorer);
    assert.ok(Array.isArray(state.revenueExplorer.proposals));
    assert.ok(Array.isArray(state.revenueExplorer.runHistory));
  } finally {
    rm(dir);
  }
});

test("runExplorer dedupes repeated advance proposals across passes", async () => {
  const dir = tmpRepo();
  try {
    const signals = [
      { kind: "marginBps", value: 900, ts: isoMinus(5) },
      { kind: "marginBps", value: 950, ts: isoMinus(4) },
      { kind: "marginBps", value: 1000, ts: isoMinus(3) }
    ];
    withSignalsFile(dir, signals);
    const state = freshState([freshExperiment()]);
    await runExplorer(
      state,
      {},
      { repoRoot: dir },
      { ORBIT_EXPLORER_MIN_DRY_RUN_CYCLES: "2" },
      { repoRoot: dir }
    );
    await runExplorer(
      state,
      {},
      { repoRoot: dir },
      { ORBIT_EXPLORER_MIN_DRY_RUN_CYCLES: "2" },
      { repoRoot: dir }
    );
    assert.equal(listProposals(state).length, 1);
  } finally {
    rm(dir);
  }
});

// --- listProposals / clearProposal -----------------------------------------

test("listProposals returns [] when state is fresh", () => {
  assert.deepEqual(listProposals({}), []);
  assert.deepEqual(listProposals({ revenueExplorer: defaultExplorerState() }), []);
});

test("clearProposal removes by experimentId", () => {
  const state = freshState();
  state.revenueExplorer.proposals.push({
    experimentId: "exp-a",
    currentStatus: "dry_run",
    proposedStatus: "bounded_live",
    needsOwnerApproval: true,
    proposedAt: new Date().toISOString(),
    killSignalsTriggered: [],
    reason: "ok"
  });
  state.revenueExplorer.proposals.push({
    experimentId: "exp-b",
    currentStatus: "dry_run",
    proposedStatus: "bounded_live",
    needsOwnerApproval: true,
    proposedAt: new Date().toISOString(),
    killSignalsTriggered: [],
    reason: "ok"
  });
  const removed = clearProposal(state, "exp-a");
  assert.equal(removed, true);
  assert.equal(state.revenueExplorer.proposals.length, 1);
  assert.equal(state.revenueExplorer.proposals[0].experimentId, "exp-b");
  // No-op when id doesn't match.
  assert.equal(clearProposal(state, "nope"), false);
});
