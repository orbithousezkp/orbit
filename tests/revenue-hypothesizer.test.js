"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const hypothesizer = require("../src/agent/revenue-hypothesizer");
const {
  ARCHETYPES,
  DEFAULT_MAX_DRAFTS_PER_RUN,
  MIN_LOOKBACK_HOURS_FOR_PROPOSAL,
  buildDraftFromArchetype,
  evaluatePreconditions,
  getDraftById,
  listDrafts,
  loadHypothesizerConfig,
  promoteDraftToExperiment,
  proposeDrafts,
  rejectDraft,
  selectArchetypesToPropose
} = hypothesizer;

function isoMinus(hours) {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

function freshState() {
  return {
    problemLab: { experiments: [] },
    revenueExplorer: {
      proposals: [],
      lastRanAt: null,
      runHistory: [],
      draftProposals: [],
      rejectedDrafts: []
    }
  };
}

// --- loadHypothesizerConfig -----------------------------------------------

test("loadHypothesizerConfig returns defaults when env is empty", () => {
  const cfg = loadHypothesizerConfig({});
  assert.equal(cfg.enabled, true);
  assert.equal(cfg.maxDraftsPerRun, DEFAULT_MAX_DRAFTS_PER_RUN);
  assert.equal(cfg.minLookbackHours, MIN_LOOKBACK_HOURS_FOR_PROPOSAL);
});

test("loadHypothesizerConfig honors env overrides", () => {
  const cfg = loadHypothesizerConfig({
    ORBIT_HYPOTHESIZER_ENABLED: "false",
    ORBIT_HYPOTHESIZER_MAX_DRAFTS_PER_RUN: "5",
    ORBIT_HYPOTHESIZER_MIN_LOOKBACK_HOURS: "240"
  });
  assert.equal(cfg.enabled, false);
  assert.equal(cfg.maxDraftsPerRun, 5);
  assert.equal(cfg.minLookbackHours, 240);
});

test("loadHypothesizerConfig rejects out-of-range values and falls back", () => {
  const cfg = loadHypothesizerConfig({
    ORBIT_HYPOTHESIZER_MAX_DRAFTS_PER_RUN: "-1",
    ORBIT_HYPOTHESIZER_MIN_LOOKBACK_HOURS: "1"
  });
  assert.equal(cfg.maxDraftsPerRun, DEFAULT_MAX_DRAFTS_PER_RUN);
  assert.equal(cfg.minLookbackHours, MIN_LOOKBACK_HOURS_FOR_PROPOSAL);
});

test("loadHypothesizerConfig caps maxDraftsPerRun at 10", () => {
  const cfg = loadHypothesizerConfig({ ORBIT_HYPOTHESIZER_MAX_DRAFTS_PER_RUN: "999" });
  assert.equal(cfg.maxDraftsPerRun, DEFAULT_MAX_DRAFTS_PER_RUN);
});

// --- evaluatePreconditions -------------------------------------------------

test("evaluatePreconditions: existingStream met when stream present + lifetime ok", () => {
  const result = evaluatePreconditions(
    [
      {
        kind: "existingStream",
        streamId: "ai-routing-margin",
        minLifetimeRevenueWei: "1000000000000000"
      }
    ],
    {
      streams: [{ id: "ai-routing-margin", lifetimeRevenueWei: "2000000000000000" }]
    }
  );
  assert.equal(result.allMet, true);
  assert.equal(result.results[0].met, true);
});

test("evaluatePreconditions: existingStream not-met when stream missing", () => {
  const result = evaluatePreconditions(
    [{ kind: "existingStream", streamId: "ai-routing-margin" }],
    { streams: [] }
  );
  assert.equal(result.allMet, false);
  assert.equal(result.results[0].reason, "stream_missing");
});

test("evaluatePreconditions: existingStream minLifetime not met", () => {
  const result = evaluatePreconditions(
    [
      {
        kind: "existingStream",
        streamId: "ai-routing-margin",
        minLifetimeRevenueWei: "1000000000000000"
      }
    ],
    {
      streams: [{ id: "ai-routing-margin", lifetimeRevenueWei: "10" }]
    }
  );
  assert.equal(result.allMet, false);
  assert.match(result.results[0].reason, /lifetime_below/);
});

test("evaluatePreconditions: signalThreshold latest_total over issue_reaction_index", () => {
  const result = evaluatePreconditions(
    [
      {
        kind: "signalThreshold",
        signalKind: "issue_reaction_index",
        aggregateFn: "latest_total",
        min: 20
      }
    ],
    {
      signals: [
        {
          kind: "issue_reaction_index",
          ts: isoMinus(2),
          repos: [{ repo: "a/a", score: 15 }, { repo: "b/b", score: 10 }]
        }
      ]
    }
  );
  assert.equal(result.allMet, true);
});

test("evaluatePreconditions: signalThreshold missing data returns met:false reason missing_data", () => {
  const result = evaluatePreconditions(
    [{ kind: "signalThreshold", signalKind: "holder_count", aggregateFn: "max", min: 1 }],
    { signals: [] }
  );
  assert.equal(result.allMet, false);
  assert.equal(result.results[0].reason, "missing_data");
});

test("evaluatePreconditions: signalThreshold sum aggregateFn", () => {
  const result = evaluatePreconditions(
    [
      {
        kind: "signalThreshold",
        signalKind: "weth_inflow_24h",
        aggregateFn: "sum",
        min: "500"
      }
    ],
    {
      signals: [
        { kind: "weth_inflow_24h", ts: isoMinus(2), valueWei: "300" },
        { kind: "weth_inflow_24h", ts: isoMinus(1), valueWei: "300" }
      ]
    }
  );
  assert.equal(result.allMet, true);
});

test("evaluatePreconditions: adopterCount met / below", () => {
  const okResult = evaluatePreconditions(
    [{ kind: "adopterCount", min: 3 }],
    { adopters: [{}, {}, {}, {}] }
  );
  assert.equal(okResult.allMet, true);
  const failResult = evaluatePreconditions(
    [{ kind: "adopterCount", min: 3 }],
    { adopters: [{}] }
  );
  assert.equal(failResult.allMet, false);
});

test("evaluatePreconditions: treasuryBalance bucket sum met", () => {
  const result = evaluatePreconditions(
    [{ kind: "treasuryBalance", minWei: "1000" }],
    {
      treasury: {
        buckets: [
          { balanceWei: "600" },
          { balanceWei: "500" }
        ]
      }
    }
  );
  assert.equal(result.allMet, true);
});

test("evaluatePreconditions: treasuryBalance below threshold", () => {
  const result = evaluatePreconditions(
    [{ kind: "treasuryBalance", minWei: "1000" }],
    { treasury: { buckets: [{ balanceWei: "100" }] } }
  );
  assert.equal(result.allMet, false);
});

test("evaluatePreconditions: experimentCount cap respected", () => {
  const overCap = evaluatePreconditions(
    [{ kind: "experimentCount", streamType: "productive_yield", maxOfStreamType: 0 }],
    { experiments: [{ streamType: "productive_yield" }] }
  );
  assert.equal(overCap.allMet, false);
  const underCap = evaluatePreconditions(
    [{ kind: "experimentCount", streamType: "productive_yield", maxOfStreamType: 0 }],
    { experiments: [] }
  );
  assert.equal(underCap.allMet, true);
});

// --- buildDraftFromArchetype ----------------------------------------------

test("buildDraftFromArchetype produces deterministic id, draft status, snapshot", () => {
  const archetype = ARCHETYPES.find((a) => a.id === "bounty_market_pilot");
  const ctx = {
    signals: [
      {
        kind: "issue_reaction_index",
        ts: isoMinus(2),
        repos: [{ repo: "a/a", score: 40 }]
      }
    ],
    adopters: [{}, {}, {}]
  };
  const draft = buildDraftFromArchetype(archetype, ctx, new Date("2026-05-25T00:00:00Z"));
  assert.equal(draft.archetypeId, "bounty_market_pilot");
  assert.equal(draft.streamType, "bounty_market");
  assert.equal(draft.status, "draft");
  assert.ok(draft.id.startsWith("draft-bounty_market_pilot-2026-05-25-"));
  assert.equal(typeof draft.draftedAt, "string");
  assert.ok(Array.isArray(draft.preconditionsAtDraftTime));
  assert.equal(draft.preconditionsAtDraftTime.length, archetype.preconditions.length);
  assert.match(draft.hypothesis, /auto-generated/);
});

// --- selectArchetypesToPropose --------------------------------------------

test("selectArchetypesToPropose skips archetype with existing draft of same archetypeId", () => {
  const archetype = ARCHETYPES.find((a) => a.id === "bounty_market_pilot");
  const ctx = {
    signals: [
      {
        kind: "issue_reaction_index",
        ts: isoMinus(2),
        repos: [{ score: 40, repo: "x/y" }]
      }
    ],
    adopters: [{}, {}, {}],
    streams: [],
    experiments: [],
    existingDrafts: [{ archetypeId: archetype.id, id: "existing-draft" }]
  };
  const sel = selectArchetypesToPropose(ctx, {}, { maxDrafts: 5 });
  const ids = sel.selected.map((a) => a.id);
  assert.ok(!ids.includes("bounty_market_pilot"));
  const skipped = sel.skipped.find((s) => s.archetypeId === "bounty_market_pilot");
  assert.equal(skipped.reason, "existing_draft");
});

test("selectArchetypesToPropose skips archetype with active experiment of same streamType", () => {
  const ctx = {
    signals: [
      {
        kind: "issue_reaction_index",
        ts: isoMinus(2),
        repos: [{ score: 40, repo: "x/y" }]
      }
    ],
    adopters: [{}, {}, {}],
    streams: [],
    experiments: [{ streamType: "bounty_market", status: "dry_run" }],
    existingDrafts: []
  };
  const sel = selectArchetypesToPropose(ctx, {}, { maxDrafts: 5 });
  const ids = sel.selected.map((a) => a.id);
  assert.ok(!ids.includes("bounty_market_pilot"));
  const skipped = sel.skipped.find((s) => s.archetypeId === "bounty_market_pilot");
  assert.equal(skipped.reason, "active_experiment");
});

test("selectArchetypesToPropose respects maxDrafts cap", () => {
  const ctx = {
    signals: [
      {
        kind: "issue_reaction_index",
        ts: isoMinus(2),
        repos: [{ score: 100, repo: "x/y" }]
      },
      {
        kind: "adopter_ai_spend_by_bucket",
        ts: isoMinus(2),
        adopters: [
          { fid: "f1", byBucket: { code: 1 } },
          { fid: "f2", byBucket: { code: 1 } }
        ]
      }
    ],
    adopters: [{}, {}, {}, {}, {}, {}],
    streams: [{ id: "ai-routing-margin", lifetimeRevenueWei: "9999999999999999999" }],
    experiments: [],
    existingDrafts: []
  };
  const sel = selectArchetypesToPropose(ctx, {}, { maxDrafts: 1 });
  assert.equal(sel.selected.length, 1);
});

test("selectArchetypesToPropose returns empty when nothing qualifies", () => {
  const ctx = {
    signals: [],
    adopters: [],
    streams: [],
    experiments: [],
    existingDrafts: []
  };
  const sel = selectArchetypesToPropose(ctx, {}, { maxDrafts: 5 });
  assert.equal(sel.selected.length, 0);
});

// --- proposeDrafts --------------------------------------------------------

test("proposeDrafts mutates state.revenueExplorer.draftProposals", () => {
  const state = freshState();
  const ctx = {
    signals: [
      {
        kind: "issue_reaction_index",
        ts: isoMinus(2),
        repos: [{ score: 50, repo: "x/y" }]
      }
    ],
    adopters: [{}, {}, {}],
    streams: [],
    experiments: []
  };
  const result = proposeDrafts(state, ctx, {}, { maxDrafts: 1 });
  assert.equal(result.draftsAdded, 1);
  assert.equal(state.revenueExplorer.draftProposals.length, 1);
  assert.equal(state.revenueExplorer.draftProposals[0].status, "draft");
});

test("proposeDrafts is idempotent across runs (existing drafts skipped)", () => {
  const state = freshState();
  const ctx = {
    signals: [
      {
        kind: "issue_reaction_index",
        ts: isoMinus(2),
        repos: [{ score: 50, repo: "x/y" }]
      }
    ],
    adopters: [{}, {}, {}],
    streams: [],
    experiments: []
  };
  proposeDrafts(state, ctx, {}, { maxDrafts: 6 });
  const firstCount = state.revenueExplorer.draftProposals.length;
  const r2 = proposeDrafts(state, ctx, {}, { maxDrafts: 6 });
  assert.equal(r2.draftsAdded, 0);
  assert.equal(state.revenueExplorer.draftProposals.length, firstCount);
});

// --- promoteDraftToExperiment ---------------------------------------------

test("promoteDraftToExperiment returns experiment shape and removes draft", () => {
  const state = freshState();
  const archetype = ARCHETYPES.find((a) => a.id === "bounty_market_pilot");
  const draft = buildDraftFromArchetype(archetype, { signals: [], adopters: [] }, new Date());
  state.revenueExplorer.draftProposals.push(draft);
  const experiment = promoteDraftToExperiment(state, draft.id);
  assert.equal(experiment.streamType, "bounty_market");
  assert.equal(experiment.status, "hypothesis");
  assert.equal(typeof experiment.id, "string");
  assert.ok(Array.isArray(experiment.killCriteria));
  assert.equal(experiment.metadata.promotedFromDraftId, draft.id);
  assert.equal(state.revenueExplorer.draftProposals.length, 0);
});

test("promoteDraftToExperiment throws when draft not found", () => {
  const state = freshState();
  assert.throws(() => promoteDraftToExperiment(state, "missing"), /draft_not_found/);
});

// --- rejectDraft ----------------------------------------------------------

test("rejectDraft moves draft into rejectedDrafts with reason", () => {
  const state = freshState();
  const archetype = ARCHETYPES.find((a) => a.id === "bounty_market_pilot");
  const draft = buildDraftFromArchetype(archetype, { signals: [], adopters: [] }, new Date());
  state.revenueExplorer.draftProposals.push(draft);
  const result = rejectDraft(state, draft.id, "duplicate hypothesis");
  assert.equal(result.ok, true);
  assert.equal(state.revenueExplorer.draftProposals.length, 0);
  assert.equal(state.revenueExplorer.rejectedDrafts.length, 1);
  assert.equal(state.revenueExplorer.rejectedDrafts[0].rejectionReason, "duplicate hypothesis");
});

test("rejectDraft returns ok:false when draft not found", () => {
  const state = freshState();
  const result = rejectDraft(state, "nope", "");
  assert.equal(result.ok, false);
  assert.equal(result.reason, "draft_not_found");
});

// --- listDrafts / getDraftById --------------------------------------------

test("listDrafts returns empty array for fresh state", () => {
  assert.deepEqual(listDrafts({}), []);
  assert.deepEqual(listDrafts({ revenueExplorer: { draftProposals: [] } }), []);
});

test("getDraftById returns the draft or null", () => {
  const state = freshState();
  const archetype = ARCHETYPES.find((a) => a.id === "bounty_market_pilot");
  const draft = buildDraftFromArchetype(archetype, { signals: [], adopters: [] }, new Date());
  state.revenueExplorer.draftProposals.push(draft);
  assert.equal(getDraftById(state, draft.id).id, draft.id);
  assert.equal(getDraftById(state, "nope"), null);
});
