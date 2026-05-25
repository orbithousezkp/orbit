"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const revenueSummary = require("../src/agent/revenue-summary");

const {
  buildSummary,
  renderSummary,
  summarizeStreams,
  summarizeExperiments,
  summarizeDrafts,
  summarizeProposals,
  summarizeWarnings,
  summarizeAiRoutingMargin,
  summarizeMarketSignals,
  summaryToDashboardSlice
} = revenueSummary;

const NOW_ISO = "2026-05-25T12:00:00.000Z";

function freshState(extra) {
  return Object.assign({}, extra || {});
}

function freshTreasury(extra) {
  return Object.assign({}, extra || {});
}

// ---------------------------------------------------------------------------
// buildSummary: shape on empty inputs
// ---------------------------------------------------------------------------

test("buildSummary: empty state/treasury returns structured empty summary", () => {
  const summary = buildSummary({}, {}, {}, { now: new Date(NOW_ISO) });
  assert.equal(typeof summary.generatedAt, "string");
  assert.equal(summary.generatedAt, NOW_ISO);
  assert.deepEqual(summary.streams, {
    active: [],
    totalActive: 0,
    totalDeprecated: 0,
    totalLifetimeRevenueWei: "0"
  });
  assert.deepEqual(summary.experiments, {
    byStatus: {
      hypothesis: 0,
      dry_run: 0,
      bounded_live: 0,
      graduated: 0,
      sunset: 0
    },
    active: []
  });
  assert.deepEqual(summary.drafts, []);
  assert.deepEqual(summary.proposals, []);
  assert.deepEqual(summary.warnings, []);
  assert.equal(summary.aiRoutingMargin, null);
  // treasuryUtility defaults to ok when no spend recorded
  assert.ok(summary.treasuryUtility && summary.treasuryUtility.recommendation === "ok");
  assert.deepEqual(summary.marketSignals, {
    signalKinds: {},
    latestTs: null,
    earliestTs: null,
    totalCount: 0
  });
  assert.deepEqual(summary.errors, []);
});

// ---------------------------------------------------------------------------
// buildSummary: populated inputs
// ---------------------------------------------------------------------------

test("buildSummary: populated state/treasury fills all sections", () => {
  const state = {
    problemLab: {
      experiments: [
        {
          id: "exp-foo",
          status: "bounded_live",
          hypothesis: "ai routing scales linearly",
          streamType: "ai_routing_margin",
          budgetWei: "10000000000000000",
          spentWei: "100",
          createdAt: "2026-05-01T00:00:00.000Z"
        },
        {
          id: "exp-bar",
          status: "graduated",
          hypothesis: "old",
          streamType: "bounty_market",
          createdAt: "2026-04-01T00:00:00.000Z"
        }
      ]
    },
    revenueExplorer: {
      draftProposals: [
        {
          id: "draft-A",
          archetypeId: "ai_routing_margin_expansion",
          streamType: "ai_routing_margin",
          hypothesis: "expand margin to 750bps",
          draftedAt: "2026-05-20T00:00:00.000Z"
        }
      ],
      proposals: [
        {
          experimentId: "exp-foo",
          currentStatus: "bounded_live",
          proposedStatus: "graduated",
          reason: "criteria met",
          proposedAt: NOW_ISO,
          needsOwnerApproval: true
        }
      ],
      warnings: [
        {
          kind: "identity_capture",
          ts: "2026-05-24T00:00:00.000Z",
          riskIndex: 0.65,
          recommendation: "warning",
          summary: { warning: true }
        }
      ]
    }
  };
  const treasury = {
    revenue: {
      streams: [
        {
          id: "ai-routing-margin",
          type: "ai_routing_margin",
          status: "active",
          lifetimeRevenueWei: "123456789",
          createdAt: "2026-04-15T00:00:00.000Z",
          unitEconomics: {
            marginBps: 500,
            perCallSamples: [],
            totalCallsBilled: 4
          }
        },
        {
          id: "legacy",
          type: "trading_fees",
          status: "deprecated",
          lifetimeRevenueWei: "0",
          createdAt: "2026-01-01T00:00:00.000Z"
        }
      ]
    }
  };
  const summary = buildSummary(state, treasury, {}, { now: new Date(NOW_ISO) });
  assert.equal(summary.streams.totalActive, 1);
  assert.equal(summary.streams.totalDeprecated, 1);
  assert.equal(summary.experiments.byStatus.bounded_live, 1);
  assert.equal(summary.experiments.byStatus.graduated, 1);
  assert.equal(summary.experiments.active.length, 1);
  assert.equal(summary.experiments.active[0].id, "exp-foo");
  assert.equal(summary.drafts.length, 1);
  assert.equal(summary.drafts[0].archetypeId, "ai_routing_margin_expansion");
  assert.equal(summary.proposals.length, 1);
  assert.equal(summary.warnings.length, 1);
  assert.ok(summary.aiRoutingMargin && summary.aiRoutingMargin.lifetimeRevenueWei === "123456789");
  assert.deepEqual(summary.errors, []);
});

// ---------------------------------------------------------------------------
// buildSummary: section failure is captured in errors, others survive
// ---------------------------------------------------------------------------

test("buildSummary: a thrown sub-summary is captured in errors and others remain populated", () => {
  // Force summarizeStreams to throw by passing in a treasury that is an
  // intentionally hostile getter. Use a Proxy that throws when revenue is read.
  const evilTreasury = new Proxy({}, {
    get(_target, prop) {
      if (prop === "revenue") throw new Error("synthetic-stream-failure");
      return undefined;
    }
  });
  const state = {
    revenueExplorer: {
      draftProposals: [{
        id: "draft-X",
        archetypeId: "bounty_market_pilot",
        streamType: "bounty_market",
        draftedAt: NOW_ISO
      }]
    }
  };
  const summary = buildSummary(state, evilTreasury, {}, { now: new Date(NOW_ISO) });
  // Errors array should mention the streams section (or aiRoutingMargin /
  // treasuryUtility — anything that touched treasury.revenue).
  assert.ok(summary.errors.length >= 1, "expected at least one captured error");
  const sections = summary.errors.map((e) => e.section);
  assert.ok(sections.includes("streams"), `streams not in ${sections.join(",")}`);
  // Drafts must still be populated.
  assert.equal(summary.drafts.length, 1);
  assert.equal(summary.drafts[0].archetypeId, "bounty_market_pilot");
});

// ---------------------------------------------------------------------------
// summarizeStreams: counts + BigInt-safe lifetime aggregate
// ---------------------------------------------------------------------------

test("summarizeStreams: byStatus counts correct + BigInt-safe lifetime aggregate", () => {
  const huge = "99999999999999999999999999999"; // > 2^64
  const treasury = {
    revenue: {
      streams: [
        { id: "a", type: "x", status: "active", lifetimeRevenueWei: huge, createdAt: "2026-01-01T00:00:00.000Z" },
        { id: "b", type: "x", status: "experimental", lifetimeRevenueWei: "1", createdAt: "2026-01-02T00:00:00.000Z" },
        { id: "c", type: "x", status: "deprecated", lifetimeRevenueWei: huge, createdAt: "2026-01-03T00:00:00.000Z" }
      ]
    }
  };
  const r = summarizeStreams(treasury);
  assert.equal(r.totalActive, 2); // active + experimental
  assert.equal(r.totalDeprecated, 1);
  const expected = (BigInt(huge) + 1n + BigInt(huge)).toString();
  assert.equal(r.totalLifetimeRevenueWei, expected);
});

// ---------------------------------------------------------------------------
// summarizeExperiments
// ---------------------------------------------------------------------------

test("summarizeExperiments: aggregates byStatus correctly", () => {
  const state = {
    problemLab: {
      experiments: [
        { id: "1", status: "hypothesis", streamType: "x", createdAt: NOW_ISO },
        { id: "2", status: "hypothesis", streamType: "x", createdAt: NOW_ISO },
        { id: "3", status: "dry_run", streamType: "x", createdAt: NOW_ISO },
        { id: "4", status: "bounded_live", streamType: "x", createdAt: NOW_ISO },
        { id: "5", status: "graduated", streamType: "x", createdAt: NOW_ISO },
        { id: "6", status: "sunset", streamType: "x", createdAt: NOW_ISO }
      ]
    }
  };
  const r = summarizeExperiments(state);
  assert.equal(r.byStatus.hypothesis, 2);
  assert.equal(r.byStatus.dry_run, 1);
  assert.equal(r.byStatus.bounded_live, 1);
  assert.equal(r.byStatus.graduated, 1);
  assert.equal(r.byStatus.sunset, 1);
  // 4 active (hypothesis + dry_run + bounded_live)
  assert.equal(r.active.length, 4);
});

// ---------------------------------------------------------------------------
// summarizeDrafts / summarizeProposals / summarizeWarnings order + cap
// ---------------------------------------------------------------------------

test("summarizeDrafts: returns drafts in declared order", () => {
  const state = {
    revenueExplorer: {
      draftProposals: [
        { id: "d1", archetypeId: "ai_routing_margin_expansion", streamType: "x", draftedAt: "2026-05-20T00:00:00.000Z" },
        { id: "d2", archetypeId: "bounty_market_pilot", streamType: "y", draftedAt: "2026-05-22T00:00:00.000Z" }
      ]
    }
  };
  const r = summarizeDrafts(state);
  assert.equal(r.length, 2);
  assert.equal(r[0].id, "d1");
  assert.equal(r[1].id, "d2");
});

test("summarizeProposals: copies required fields per proposal", () => {
  const state = {
    revenueExplorer: {
      proposals: [
        {
          experimentId: "exp-a",
          currentStatus: "hypothesis",
          proposedStatus: "dry_run",
          reason: "criteria met",
          proposedAt: NOW_ISO,
          needsOwnerApproval: true
        }
      ]
    }
  };
  const r = summarizeProposals(state);
  assert.equal(r.length, 1);
  assert.equal(r[0].needsOwnerApproval, true);
  assert.equal(r[0].experimentId, "exp-a");
});

test("summarizeWarnings: keeps the most recent 10 sorted descending", () => {
  const warnings = [];
  for (let i = 0; i < 15; i += 1) {
    const ts = new Date(Date.UTC(2026, 4, 24, 12, i, 0)).toISOString();
    warnings.push({ kind: "identity_capture", ts, recommendation: "watch" });
  }
  const state = { revenueExplorer: { warnings } };
  const r = summarizeWarnings(state);
  assert.equal(r.length, 10);
  // Most recent first; the latest minute (14) should be at index 0.
  assert.ok(r[0].ts.endsWith("14:00.000Z"));
  // Last in our window should be minute 5 (15 - 10 = 5).
  assert.ok(r[r.length - 1].ts.endsWith("05:00.000Z"));
});

// ---------------------------------------------------------------------------
// summarizeAiRoutingMargin: returns null without the stream
// ---------------------------------------------------------------------------

test("summarizeAiRoutingMargin: returns null when stream missing", () => {
  const r = summarizeAiRoutingMargin({});
  assert.equal(r, null);
});

// ---------------------------------------------------------------------------
// summarizeMarketSignals: best-effort with no repo
// ---------------------------------------------------------------------------

test("summarizeMarketSignals: returns empty shape on missing repo root", () => {
  const r = summarizeMarketSignals(null);
  assert.deepEqual(r.signalKinds, {});
  assert.equal(r.totalCount, 0);
});

// ---------------------------------------------------------------------------
// renderSummary: ASCII only, section headers, no emoji, no throws on empty
// ---------------------------------------------------------------------------

test("renderSummary: ASCII only, includes section headers, no emoji, no throw on empty", () => {
  const empty = buildSummary({}, {}, {}, { now: new Date(NOW_ISO) });
  const out = renderSummary(empty);
  assert.equal(typeof out, "string");
  assert.ok(out.includes("=== Orbit Revenue Summary ==="));
  assert.ok(out.includes("--- Streams ---"));
  assert.ok(out.includes("--- Experiments ---"));
  assert.ok(out.includes("--- Draft proposals"));
  assert.ok(out.includes("--- Warnings ---"));
  assert.ok(out.includes("Status: 0 active stream"));
  // ASCII only: no chars above 0x7e
  for (let i = 0; i < out.length; i += 1) {
    const code = out.charCodeAt(i);
    assert.ok(code === 10 || (code >= 32 && code <= 126), `non-ASCII at index ${i}: ${code}`);
  }
});

test("renderSummary: handles undefined input without throwing", () => {
  assert.doesNotThrow(() => renderSummary(undefined));
  assert.doesNotThrow(() => renderSummary(null));
  assert.doesNotThrow(() => renderSummary({}));
});

// ---------------------------------------------------------------------------
// summaryToDashboardSlice: must not leak raw WEI amounts
// ---------------------------------------------------------------------------

test("summaryToDashboardSlice: does not include raw wei amounts anywhere in serialized output", () => {
  const summary = {
    generatedAt: NOW_ISO,
    streams: {
      active: [
        {
          id: "secret-stream",
          type: "ai_routing_margin",
          status: "active",
          lifetimeRevenueWei: "9999999999999999999",
          lastClaim: { amountWei: "1234567890" },
          createdAt: NOW_ISO,
          daysAlive: 1
        }
      ],
      totalActive: 1,
      totalDeprecated: 0,
      totalLifetimeRevenueWei: "9999999999999999999"
    },
    experiments: { byStatus: { hypothesis: 1, dry_run: 0, bounded_live: 0, graduated: 0, sunset: 0 }, active: [] },
    drafts: [{ id: "d1", archetypeId: "ai_routing_margin_expansion", streamType: "x", draftedAt: NOW_ISO }],
    proposals: [{
      experimentId: "e",
      currentStatus: "hypothesis",
      proposedStatus: "dry_run",
      reason: "ok",
      proposedAt: NOW_ISO,
      needsOwnerApproval: true
    }],
    warnings: [{ kind: "identity_capture", recommendation: "warning", ts: NOW_ISO }],
    aiRoutingMargin: { lifetimeRevenueWei: "9999999999999999999" },
    treasuryUtility: { recommendation: "ok" },
    marketSignals: { signalKinds: { weth_inflow_24h: 1 }, totalCount: 1 }
  };
  const slice = summaryToDashboardSlice(summary);
  const json = JSON.stringify(slice);
  // No raw wei numerals (the loud signature is "9999999999999999999").
  assert.equal(json.includes("9999999999999999999"), false, "slice leaked raw wei");
  // No "lifetimeRevenueWei" key at all.
  assert.equal(json.includes("lifetimeRevenueWei"), false);
  assert.equal(json.includes("amountWei"), false);
  assert.equal(json.includes("budgetWei"), false);
  assert.equal(json.includes("spentWei"), false);
  // Required shape:
  assert.equal(slice.streamCount.active, 1);
  assert.equal(slice.streamCount.deprecated, 0);
  assert.equal(slice.experimentCount.hypothesis, 1);
  assert.equal(slice.draftCount, 1);
  assert.equal(slice.activeProposals, 1);
  assert.equal(slice.warningCount, 1);
  assert.equal(slice.capturedRiskTier, "warning");
  assert.equal(slice.utilityRatioTier, "ok");
  assert.deepEqual(slice.recentArchetypes, ["ai_routing_margin_expansion"]);
});

test("summaryToDashboardSlice: capturedRiskTier reflects worst identity_capture warning", () => {
  const baseSummary = {
    generatedAt: NOW_ISO,
    streams: { active: [], totalActive: 0, totalDeprecated: 0, totalLifetimeRevenueWei: "0" },
    experiments: { byStatus: {}, active: [] },
    drafts: [],
    proposals: [],
    warnings: [],
    aiRoutingMargin: null,
    treasuryUtility: null,
    marketSignals: { signalKinds: {}, totalCount: 0 }
  };
  // No warnings -> healthy.
  assert.equal(summaryToDashboardSlice(baseSummary).capturedRiskTier, "healthy");

  // Mix of severities — should report the worst one.
  baseSummary.warnings = [
    { kind: "identity_capture", recommendation: "watch", ts: NOW_ISO },
    { kind: "identity_capture", recommendation: "critical", ts: NOW_ISO },
    { kind: "identity_capture", recommendation: "warning", ts: NOW_ISO }
  ];
  assert.equal(summaryToDashboardSlice(baseSummary).capturedRiskTier, "critical");

  // Unknown / non-identity warning kinds are ignored.
  baseSummary.warnings = [
    { kind: "treasury_utility", recommendation: "over_cap", ts: NOW_ISO }
  ];
  assert.equal(summaryToDashboardSlice(baseSummary).capturedRiskTier, "healthy");
});

test("summaryToDashboardSlice: utilityRatioTier mirrors treasuryUtility.recommendation", () => {
  const base = {
    generatedAt: NOW_ISO,
    streams: { active: [], totalActive: 0, totalDeprecated: 0, totalLifetimeRevenueWei: "0" },
    experiments: { byStatus: {}, active: [] },
    drafts: [],
    proposals: [],
    warnings: [],
    aiRoutingMargin: null,
    treasuryUtility: { recommendation: "approaching_cap" },
    marketSignals: { signalKinds: {}, totalCount: 0 }
  };
  assert.equal(summaryToDashboardSlice(base).utilityRatioTier, "approaching_cap");
  base.treasuryUtility = { recommendation: "over_cap" };
  assert.equal(summaryToDashboardSlice(base).utilityRatioTier, "over_cap");
  base.treasuryUtility = null;
  assert.equal(summaryToDashboardSlice(base).utilityRatioTier, "unknown");
});

test("summaryToDashboardSlice: recentArchetypes keeps last 3", () => {
  const base = {
    generatedAt: NOW_ISO,
    streams: { active: [], totalActive: 0, totalDeprecated: 0, totalLifetimeRevenueWei: "0" },
    experiments: { byStatus: {}, active: [] },
    drafts: [
      { id: "d1", archetypeId: "a1", streamType: "x", draftedAt: NOW_ISO },
      { id: "d2", archetypeId: "a2", streamType: "x", draftedAt: NOW_ISO },
      { id: "d3", archetypeId: "a3", streamType: "x", draftedAt: NOW_ISO },
      { id: "d4", archetypeId: "a4", streamType: "x", draftedAt: NOW_ISO },
      { id: "d5", archetypeId: "a5", streamType: "x", draftedAt: NOW_ISO }
    ],
    proposals: [],
    warnings: [],
    aiRoutingMargin: null,
    treasuryUtility: null,
    marketSignals: { signalKinds: {}, totalCount: 0 }
  };
  const slice = summaryToDashboardSlice(base);
  assert.deepEqual(slice.recentArchetypes, ["a3", "a4", "a5"]);
});

// ---------------------------------------------------------------------------
// Backward-compat: defensive on undefined/null/garbage inputs
// ---------------------------------------------------------------------------

test("buildSummary: tolerates null state and null treasury", () => {
  const summary = buildSummary(null, null, undefined, undefined);
  assert.equal(typeof summary.generatedAt, "string");
  assert.deepEqual(summary.streams.active, []);
  assert.deepEqual(summary.drafts, []);
  assert.equal(summary.errors.length, 0);
});

test("summaryToDashboardSlice: defensive on null input", () => {
  const slice = summaryToDashboardSlice(null);
  assert.equal(slice.streamCount.active, 0);
  assert.equal(slice.capturedRiskTier, "healthy");
  assert.equal(slice.utilityRatioTier, "unknown");
  assert.deepEqual(slice.recentArchetypes, []);
});

// ---------------------------------------------------------------------------
// Use the freshState/freshTreasury helpers (silences lint without bloat)
// ---------------------------------------------------------------------------

test("freshState/freshTreasury helpers produce isolated copies", () => {
  const s1 = freshState({ x: 1 });
  const s2 = freshState({ x: 2 });
  assert.notEqual(s1, s2);
  const t1 = freshTreasury();
  assert.deepEqual(t1, {});
});
