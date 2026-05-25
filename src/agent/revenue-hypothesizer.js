"use strict";

// S-REVENUE-4 — Auto-proposal engine for the revenue explorer.
//
// Where revenue-explorer.js EVALUATES existing experiments, this module
// GENERATES new revenue hypotheses from observed signal patterns. Drafts are
// proposals the owner reviews and promotes via the `revenue_promote_draft`
// tool — they are NOT live experiments. The drafts live under
// state.revenueExplorer.draftProposals; lifecycle experiments live under
// state.problemLab.experiments and are owned by revenue-experiments.js.
//
// Design notes:
//   - Pure pattern-matching: every decision is derived from the `context`
//     object passed in by the caller. No filesystem reads, no fetches.
//   - Best-effort: missing data degrades to "precondition not met" rather
//     than throwing. The hypothesizer never crashes the explorer.
//   - Deterministic ordering: archetypes are evaluated in declaration order;
//     "tuning" (existingStream) archetypes come ahead of new-stream
//     archetypes so the household optimises what it already runs before
//     opening new fronts.
//   - All wei comparisons use BigInt — no Number coercion for monetary values.

const ARCHETYPES = [
  {
    id: "ai_routing_margin_expansion",
    streamType: "ai_routing_margin",
    description: "Bump AI routing margin from 500bps to 750bps once stream proven healthy.",
    preconditions: [
      {
        kind: "existingStream",
        streamId: "ai-routing-margin",
        minLifetimeRevenueWei: "1000000000000000"
      },
      {
        kind: "signalThreshold",
        signalKind: "issue_reaction_index",
        aggregateFn: "latest_total",
        min: 20
      }
    ],
    defaultBudgetWei: "5000000000000000",
    killCriteriaTemplate: [
      {
        signal: "adopter_ai_spend_by_bucket",
        threshold: 0,
        operator: "<",
        description: "no adopters using AI in 4 weeks"
      }
    ],
    minSignalsToKill: 1,
    successCriteriaTemplate: [
      {
        signal: "ai_routing_margin_revenue",
        threshold: "10000000000000000",
        operator: ">",
        description: "stream revenue >= 0.01 WETH"
      }
    ],
    dependencies: ["existing_stream"]
  },
  {
    id: "bounty_market_pilot",
    streamType: "bounty_market",
    description: "Pilot a bounty market for 'wanted' issues with a small WETH escrow cap.",
    preconditions: [
      {
        kind: "signalThreshold",
        signalKind: "issue_reaction_index",
        aggregateFn: "latest_total",
        min: 30
      },
      { kind: "adopterCount", min: 3 }
    ],
    defaultBudgetWei: "10000000000000000",
    killCriteriaTemplate: [
      {
        signal: "issue_reaction_index",
        threshold: 5,
        operator: "<",
        description: "demand collapses below 5 reactions"
      }
    ],
    minSignalsToKill: 1,
    successCriteriaTemplate: [
      {
        signal: "bounty_market_revenue",
        threshold: "5000000000000000",
        operator: ">",
        description: "bounty fees >= 0.005 WETH"
      }
    ],
    dependencies: ["new_stream"]
  },
  {
    id: "subscription_tier_pilot",
    streamType: "subscription_tier",
    description: "Pilot tiered subscriptions gating premium SDK methods.",
    preconditions: [
      { kind: "adopterCount", min: 5 },
      {
        kind: "signalThreshold",
        signalKind: "adopter_ai_spend_by_bucket",
        aggregateFn: "latest_total",
        min: 1
      }
    ],
    defaultBudgetWei: "5000000000000000",
    killCriteriaTemplate: [
      {
        signal: "subscription_tier_revenue",
        threshold: 0,
        operator: "<=",
        description: "zero subscribers after 4 weeks"
      }
    ],
    minSignalsToKill: 1,
    successCriteriaTemplate: [
      {
        signal: "subscription_tier_revenue",
        threshold: "10000000000000000",
        operator: ">",
        description: "subscription revenue >= 0.01 WETH"
      }
    ],
    dependencies: ["new_stream"]
  },
  {
    id: "holder_utility_tier",
    streamType: "holder_utility",
    description: "Token-gated benefits for $ORBIT holders.",
    preconditions: [
      {
        kind: "signalThreshold",
        signalKind: "holder_count",
        aggregateFn: "max",
        min: 50
      },
      { kind: "treasuryBalance", minWei: "1000000000000000000" }
    ],
    defaultBudgetWei: "5000000000000000",
    killCriteriaTemplate: [
      {
        signal: "holder_count",
        threshold: 20,
        operator: "<",
        description: "holder base collapses below 20"
      }
    ],
    minSignalsToKill: 1,
    successCriteriaTemplate: [
      {
        signal: "holder_utility_revenue",
        threshold: "5000000000000000",
        operator: ">",
        description: "utility revenue >= 0.005 WETH"
      }
    ],
    dependencies: ["new_stream"]
  },
  {
    id: "treasury_productive_yield",
    streamType: "productive_yield",
    description: "Supply idle Productive Yield Safe balance to Aave V3.",
    preconditions: [
      {
        kind: "signalThreshold",
        signalKind: "weth_inflow_24h",
        aggregateFn: "sum",
        min: "500000000000000000"
      },
      { kind: "experimentCount", maxOfStreamType: 0, streamType: "productive_yield" }
    ],
    defaultBudgetWei: "0",
    killCriteriaTemplate: [
      {
        signal: "weth_inflow_24h",
        threshold: 0,
        operator: "<=",
        description: "treasury inflows stop"
      }
    ],
    minSignalsToKill: 1,
    successCriteriaTemplate: [
      {
        signal: "productive_yield_revenue",
        threshold: "1000000000000000",
        operator: ">",
        description: "yield >= 0.001 WETH"
      }
    ],
    dependencies: ["new_stream"]
  },
  {
    id: "plugin_marketplace_pilot",
    streamType: "plugin_marketplace",
    description: "Take a small cut on third-party Orbit plugins.",
    preconditions: [
      {
        kind: "signalThreshold",
        signalKind: "issue_reaction_index",
        aggregateFn: "latest_total",
        min: 15
      },
      { kind: "adopterCount", min: 3 }
    ],
    defaultBudgetWei: "5000000000000000",
    killCriteriaTemplate: [
      {
        signal: "plugin_marketplace_revenue",
        threshold: 0,
        operator: "<=",
        description: "no plugin revenue after 6 weeks"
      }
    ],
    minSignalsToKill: 1,
    successCriteriaTemplate: [
      {
        signal: "plugin_marketplace_revenue",
        threshold: "5000000000000000",
        operator: ">",
        description: "marketplace revenue >= 0.005 WETH"
      }
    ],
    dependencies: ["new_stream"]
  }
];

const DEFAULT_MAX_DRAFTS_PER_RUN = 2;
const MIN_LOOKBACK_HOURS_FOR_PROPOSAL = 168 * 2;
const REJECTED_DRAFTS_CAP = 50;

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function clampInt(raw, fallback, min, max) {
  if (raw === undefined || raw === null || raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  const floored = Math.floor(n);
  if (Number.isFinite(min) && floored < min) return fallback;
  if (Number.isFinite(max) && floored > max) return fallback;
  return floored;
}

function parseBool(raw, fallback) {
  if (raw === undefined || raw === null || raw === "") return fallback;
  const v = String(raw).trim().toLowerCase();
  if (v === "true" || v === "1" || v === "yes" || v === "on") return true;
  if (v === "false" || v === "0" || v === "no" || v === "off") return false;
  return fallback;
}

function loadHypothesizerConfig(env) {
  const source = isPlainObject(env) ? env : {};
  return {
    enabled: parseBool(source.ORBIT_HYPOTHESIZER_ENABLED, true),
    maxDraftsPerRun: clampInt(
      source.ORBIT_HYPOTHESIZER_MAX_DRAFTS_PER_RUN,
      DEFAULT_MAX_DRAFTS_PER_RUN,
      1,
      10
    ),
    minLookbackHours: clampInt(
      source.ORBIT_HYPOTHESIZER_MIN_LOOKBACK_HOURS,
      MIN_LOOKBACK_HOURS_FOR_PROPOSAL,
      24,
      24 * 365
    )
  };
}

function toBigIntWei(value) {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return 0n;
    return BigInt(Math.trunc(value));
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!/^-?\d+$/.test(trimmed)) return 0n;
    try { return BigInt(trimmed); } catch { return 0n; }
  }
  return 0n;
}

function aggregateSignals(signals, signalKind, aggregateFn) {
  if (!Array.isArray(signals) || signals.length === 0) return null;
  const relevant = signals.filter((s) => isPlainObject(s) && s.kind === signalKind);
  if (relevant.length === 0) return null;
  if (aggregateFn === "sum") {
    let total = 0n;
    let anyNumeric = false;
    for (const s of relevant) {
      if (typeof s.valueWei === "string") {
        total += toBigIntWei(s.valueWei);
        anyNumeric = true;
      } else if (typeof s.value === "number" && Number.isFinite(s.value)) {
        total += BigInt(Math.trunc(s.value));
        anyNumeric = true;
      }
    }
    return anyNumeric ? total : null;
  }
  if (aggregateFn === "max") {
    let best = null;
    for (const s of relevant) {
      const candidate = extractNumeric(s);
      if (candidate === null) continue;
      if (best === null || candidate > best) best = candidate;
    }
    return best;
  }
  // Default "latest_total": pick the most recent signal of that kind and
  // summarise its payload to a single number.
  const sorted = relevant.slice().sort((a, b) => {
    const ta = Date.parse(a.ts || "");
    const tb = Date.parse(b.ts || "");
    if (!Number.isFinite(ta) && !Number.isFinite(tb)) return 0;
    if (!Number.isFinite(ta)) return -1;
    if (!Number.isFinite(tb)) return 1;
    return ta - tb;
  });
  const latest = sorted[sorted.length - 1];
  return summariseLatest(latest);
}

function extractNumeric(signal) {
  if (!isPlainObject(signal)) return null;
  if (typeof signal.value === "number" && Number.isFinite(signal.value)) return signal.value;
  if (typeof signal.valueWei === "string") {
    try { return Number(toBigIntWei(signal.valueWei)); } catch { return null; }
  }
  // issue_reaction_index latest: sum of repos[].score
  if (Array.isArray(signal.repos)) {
    let total = 0;
    for (const r of signal.repos) {
      if (r && Number.isFinite(r.score)) total += r.score;
    }
    return total;
  }
  // adopter_ai_spend_by_bucket latest: count of adopter rows
  if (Array.isArray(signal.adopters)) return signal.adopters.length;
  return null;
}

function summariseLatest(signal) {
  return extractNumeric(signal);
}

function compareAgainstMin(aggregate, min) {
  if (aggregate === null || aggregate === undefined) return false;
  if (typeof aggregate === "bigint") {
    return aggregate >= toBigIntWei(min);
  }
  const minNum = typeof min === "string" ? Number(min) : min;
  if (!Number.isFinite(minNum)) return false;
  return aggregate >= minNum;
}

function evalExistingStream(precondition, context) {
  const streams = Array.isArray(context.streams) ? context.streams : [];
  const stream = streams.find((s) => s && s.id === precondition.streamId);
  if (!stream) return { met: false, reason: "stream_missing" };
  if (precondition.minLifetimeRevenueWei !== undefined && precondition.minLifetimeRevenueWei !== null) {
    const lifetime = toBigIntWei(stream.lifetimeRevenueWei || "0");
    const threshold = toBigIntWei(precondition.minLifetimeRevenueWei);
    if (lifetime < threshold) {
      return { met: false, reason: `lifetime_below:${lifetime.toString()}<${threshold.toString()}` };
    }
  }
  return { met: true, reason: "ok" };
}

function evalSignalThreshold(precondition, context) {
  const signals = Array.isArray(context.signals) ? context.signals : [];
  const aggregate = aggregateSignals(signals, precondition.signalKind, precondition.aggregateFn);
  if (aggregate === null) {
    return { met: false, reason: "missing_data" };
  }
  if (precondition.min === undefined || precondition.min === null) {
    return { met: true, reason: "no_min" };
  }
  if (!compareAgainstMin(aggregate, precondition.min)) {
    return {
      met: false,
      reason: `below_min:${String(aggregate)}<${String(precondition.min)}`
    };
  }
  return { met: true, reason: `met:${String(aggregate)}>=${String(precondition.min)}` };
}

function evalAdopterCount(precondition, context) {
  const list = Array.isArray(context.adopters) ? context.adopters : [];
  const count = list.length;
  if (count >= precondition.min) return { met: true, reason: `ok:${count}>=${precondition.min}` };
  return { met: false, reason: `below:${count}<${precondition.min}` };
}

function evalTreasuryBalance(precondition, context) {
  const treasury = isPlainObject(context.treasury) ? context.treasury : null;
  if (!treasury) return { met: false, reason: "missing_data" };
  let total = 0n;
  // Sum bucket balances when available (treasury-utility schema).
  const buckets = treasury.buckets;
  if (Array.isArray(buckets)) {
    for (const b of buckets) {
      if (!isPlainObject(b)) continue;
      if (b.balanceWei !== undefined) total += toBigIntWei(b.balanceWei);
      else if (b.balance !== undefined) total += toBigIntWei(b.balance);
    }
  } else if (buckets && typeof buckets === "object" && Array.isArray(buckets.list)) {
    for (const b of buckets.list) {
      if (!isPlainObject(b)) continue;
      if (b.balanceWei !== undefined) total += toBigIntWei(b.balanceWei);
      else if (b.balance !== undefined) total += toBigIntWei(b.balance);
    }
  }
  // Fallbacks: lastObservedFeeReceiveBalanceWei, then totalHoldingsWei.
  if (total === 0n) {
    if (treasury.treasurySweep && typeof treasury.treasurySweep === "object"
        && treasury.treasurySweep.lastObservedFeeReceiveBalanceWei !== undefined) {
      total = toBigIntWei(treasury.treasurySweep.lastObservedFeeReceiveBalanceWei);
    } else if (treasury.totalHoldingsWei !== undefined) {
      total = toBigIntWei(treasury.totalHoldingsWei);
    }
  }
  const minWei = toBigIntWei(precondition.minWei);
  if (total < minWei) {
    return { met: false, reason: `below:${total.toString()}<${minWei.toString()}` };
  }
  return { met: true, reason: `ok:${total.toString()}>=${minWei.toString()}` };
}

function evalExperimentCount(precondition, context) {
  const experiments = Array.isArray(context.experiments) ? context.experiments : [];
  const streamType = precondition.streamType;
  if (!streamType) return { met: false, reason: "missing_streamType" };
  const matching = experiments.filter((e) => isPlainObject(e) && e.streamType === streamType);
  const cap = Number(precondition.maxOfStreamType);
  if (!Number.isFinite(cap)) return { met: false, reason: "missing_cap" };
  if (matching.length > cap) {
    return { met: false, reason: `over_cap:${matching.length}>${cap}` };
  }
  return { met: true, reason: `ok:${matching.length}<=${cap}` };
}

function evaluatePrecondition(precondition, context) {
  if (!isPlainObject(precondition) || !precondition.kind) {
    return { met: false, reason: "invalid_precondition" };
  }
  switch (precondition.kind) {
    case "existingStream":
      return evalExistingStream(precondition, context);
    case "signalThreshold":
      return evalSignalThreshold(precondition, context);
    case "adopterCount":
      return evalAdopterCount(precondition, context);
    case "treasuryBalance":
      return evalTreasuryBalance(precondition, context);
    case "experimentCount":
      return evalExperimentCount(precondition, context);
    default:
      return { met: false, reason: `unknown_kind:${precondition.kind}` };
  }
}

function evaluatePreconditions(preconditions, context) {
  const list = Array.isArray(preconditions) ? preconditions : [];
  const ctx = isPlainObject(context) ? context : {};
  const results = list.map((p) => {
    const verdict = evaluatePrecondition(p, ctx);
    return { precondition: p, met: Boolean(verdict.met), reason: verdict.reason };
  });
  const allMet = results.length > 0 && results.every((r) => r.met);
  return { allMet, results };
}

function shortHash(input) {
  const text = String(input || "");
  let h = 0;
  for (let i = 0; i < text.length; i += 1) {
    h = (h * 31 + text.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36).slice(0, 6);
}

function isoDate(now) {
  const d = now instanceof Date ? now : new Date();
  const iso = d.toISOString();
  return iso.slice(0, 10);
}

function buildDraftFromArchetype(archetype, context, now) {
  if (!isPlainObject(archetype) || !archetype.id) {
    throw new Error("archetype must have an id");
  }
  const when = now instanceof Date ? now : new Date();
  const evaluation = evaluatePreconditions(archetype.preconditions, context);
  const hash = shortHash(`${archetype.id}|${when.toISOString()}`);
  const id = `draft-${archetype.id}-${isoDate(when)}-${hash}`;
  return {
    id,
    archetypeId: archetype.id,
    hypothesis: `${archetype.description} (auto-generated from observed signals)`,
    streamType: archetype.streamType,
    status: "draft",
    budgetWei: String(archetype.defaultBudgetWei || "0"),
    killCriteria: Array.isArray(archetype.killCriteriaTemplate)
      ? archetype.killCriteriaTemplate.map((c) => ({ ...c }))
      : [],
    minSignalsToKill: Number.isFinite(archetype.minSignalsToKill) ? archetype.minSignalsToKill : 1,
    successCriteria: Array.isArray(archetype.successCriteriaTemplate)
      ? archetype.successCriteriaTemplate.map((c) => ({ ...c }))
      : [],
    draftedAt: when.toISOString(),
    preconditionsAtDraftTime: evaluation.results.map((r) => ({
      precondition: r.precondition,
      met: r.met,
      reason: r.reason
    }))
  };
}

function defaultExplorerState() {
  return {
    proposals: [],
    lastRanAt: null,
    runHistory: [],
    draftProposals: [],
    rejectedDrafts: []
  };
}

function ensureRevenueExplorer(state) {
  if (!isPlainObject(state)) throw new Error("state must be an object");
  if (!isPlainObject(state.revenueExplorer)) {
    state.revenueExplorer = defaultExplorerState();
  }
  if (!Array.isArray(state.revenueExplorer.draftProposals)) {
    state.revenueExplorer.draftProposals = [];
  }
  if (!Array.isArray(state.revenueExplorer.rejectedDrafts)) {
    state.revenueExplorer.rejectedDrafts = [];
  }
  return state.revenueExplorer;
}

function listDrafts(state) {
  if (!isPlainObject(state)) return [];
  if (!isPlainObject(state.revenueExplorer)) return [];
  return Array.isArray(state.revenueExplorer.draftProposals)
    ? state.revenueExplorer.draftProposals
    : [];
}

function getDraftById(state, draftId) {
  if (typeof draftId !== "string" || !draftId) return null;
  const drafts = listDrafts(state);
  return drafts.find((d) => isPlainObject(d) && d.id === draftId) || null;
}

function rejectDraft(state, draftId, reason) {
  const explorerState = ensureRevenueExplorer(state);
  const idx = explorerState.draftProposals.findIndex(
    (d) => isPlainObject(d) && d.id === draftId
  );
  if (idx === -1) return { ok: false, reason: "draft_not_found" };
  const [removed] = explorerState.draftProposals.splice(idx, 1);
  const rejected = {
    ...removed,
    rejectedAt: new Date().toISOString(),
    rejectionReason: typeof reason === "string" ? reason : null
  };
  explorerState.rejectedDrafts.push(rejected);
  if (explorerState.rejectedDrafts.length > REJECTED_DRAFTS_CAP) {
    explorerState.rejectedDrafts = explorerState.rejectedDrafts.slice(-REJECTED_DRAFTS_CAP);
  }
  return { ok: true, draftId };
}

function activeExperimentStatuses() {
  return new Set(["hypothesis", "dry_run", "bounded_live"]);
}

function selectArchetypesToPropose(context, env, opts) {
  const options = isPlainObject(opts) ? opts : {};
  const now = options.now instanceof Date ? options.now : new Date();
  const cfg = loadHypothesizerConfig(env);
  const maxDrafts = Number.isFinite(options.maxDrafts) && options.maxDrafts > 0
    ? Math.floor(options.maxDrafts)
    : cfg.maxDraftsPerRun;
  const existingDrafts = Array.isArray(context.existingDrafts) ? context.existingDrafts : [];
  const experiments = Array.isArray(context.experiments) ? context.experiments : [];
  const activeStatuses = activeExperimentStatuses();
  const considered = [];
  const skipped = [];
  const selected = [];

  for (const archetype of ARCHETYPES) {
    if (!isPlainObject(archetype)) continue;
    considered.push(archetype.id);
    const existingDraft = existingDrafts.find(
      (d) => isPlainObject(d) && d.archetypeId === archetype.id
    );
    if (existingDraft) {
      skipped.push({ archetypeId: archetype.id, reason: "existing_draft" });
      continue;
    }
    const activeExperimentMatch = experiments.find(
      (e) => isPlainObject(e) && e.streamType === archetype.streamType
        && activeStatuses.has(e.status)
    );
    if (activeExperimentMatch) {
      skipped.push({ archetypeId: archetype.id, reason: "active_experiment" });
      continue;
    }
    const verdict = evaluatePreconditions(archetype.preconditions, context);
    if (!verdict.allMet) {
      const reasons = verdict.results
        .filter((r) => !r.met)
        .map((r) => r.reason)
        .join("|");
      skipped.push({ archetypeId: archetype.id, reason: `preconditions:${reasons}` });
      continue;
    }
    selected.push(archetype);
    if (selected.length >= maxDrafts) break;
  }

  return { selected, considered, skipped, now, maxDrafts };
}

function proposeDrafts(state, context, env, opts) {
  const explorerState = ensureRevenueExplorer(state);
  const ctx = isPlainObject(context) ? { ...context } : {};
  if (!Array.isArray(ctx.existingDrafts)) {
    ctx.existingDrafts = explorerState.draftProposals.slice();
  }
  const selection = selectArchetypesToPropose(ctx, env, opts);
  let added = 0;
  for (const archetype of selection.selected) {
    const draft = buildDraftFromArchetype(archetype, ctx, selection.now);
    explorerState.draftProposals.push(draft);
    added += 1;
  }
  return {
    draftsAdded: added,
    archetypesConsidered: selection.considered,
    archetypesSkipped: selection.skipped
  };
}

function promoteDraftToExperiment(state, draftId) {
  const explorerState = ensureRevenueExplorer(state);
  const idx = explorerState.draftProposals.findIndex(
    (d) => isPlainObject(d) && d.id === draftId
  );
  if (idx === -1) {
    throw new Error(`draft_not_found:${draftId}`);
  }
  const [draft] = explorerState.draftProposals.splice(idx, 1);
  const experiment = {
    id: `exp-${draft.archetypeId}-${shortHash(draft.id)}`,
    hypothesis: draft.hypothesis,
    streamType: draft.streamType,
    status: "hypothesis",
    budgetWei: String(draft.budgetWei || "0"),
    spentWei: "0",
    killCriteria: Array.isArray(draft.killCriteria)
      ? draft.killCriteria.map((c) => ({ ...c }))
      : [],
    minSignalsToKill: Number.isFinite(draft.minSignalsToKill) ? draft.minSignalsToKill : 1,
    signalRequirements: Array.isArray(draft.killCriteria)
      ? Array.from(new Set(draft.killCriteria.map((c) => c && c.signal).filter(Boolean)))
      : [],
    metadata: {
      archetypeId: draft.archetypeId,
      promotedFromDraftId: draft.id,
      successCriteria: Array.isArray(draft.successCriteria)
        ? draft.successCriteria.map((c) => ({ ...c }))
        : []
    }
  };
  return experiment;
}

module.exports = {
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
};
