"use strict";

// S-REVENUE-5 — Revenue framework observability.
//
// Pure aggregator. Reads in-memory state + treasury (caller supplies both)
// and produces a structured summary of every moving part of the revenue
// framework: live streams, active experiments, hypothesizer drafts,
// explorer proposals, recent warnings (identity capture / treasury
// utility), AI routing margin telemetry, treasury-utility ratio, recent
// market signals.
//
// Two consumers:
//   1. `orbit:revenue` CLI — human-readable rendering.
//   2. run.js dashboard projection — compact, sanitized slice that lands
//      in public/dashboard.json. Per feedback_no_money_on_github, the slice
//      MUST NOT carry raw WEI numbers for our money; it only carries
//      categorical tiers ("active" / "growing" / "deprecated") or
//      bucketed ETH-scale magnitudes.
//
// No I/O, no fetches. Every section is wrapped in try/catch so one
// failing aggregator never blanks the whole summary.

// Required at top so a broken require fails loudly at process startup,
// not on first call. `revenueStreams` / `revenueExperiments` /
// `revenueHypothesizer` / `identityCapture` / `sybilFloor` / `busFactor`
// are not used directly here, but pulling them in keeps the dependency
// graph explicit and gives `require.cache` a reference future callers
// can monkey-patch in tests.
require("./revenue-streams");
require("./revenue-experiments");
require("./revenue-hypothesizer");
require("./identity-capture");
require("./sybil-floor");
require("./bus-factor");
const aiRoutingMargin = require("./ai-routing-margin");
const treasuryUtility = require("./treasury-utility");
const marketSignals = require("./market-signals");

const ACTIVE_EXPERIMENT_STATUSES = ["hypothesis", "dry_run", "bounded_live"];
const MARKET_SIGNALS_SAMPLE_CAP = 100;
const WARNINGS_RETURN_CAP = 10;
const RECENT_ARCHETYPES_CAP = 3;
const DAY_MS = 86400000;

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function safeBigInt(value) {
  if (value === null || value === undefined) return 0n;
  if (typeof value === "bigint") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return 0n;
    return BigInt(Math.trunc(value));
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "" || !/^-?\d+$/.test(trimmed)) return 0n;
    try { return BigInt(trimmed); } catch { return 0n; }
  }
  return 0n;
}

function parseDateMs(value) {
  if (value === null || value === undefined) return null;
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : null;
}

function daysBetween(fromMs, toMs) {
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs)) return null;
  return Math.floor((toMs - fromMs) / DAY_MS);
}

function resolveNowMs(opts) {
  const now = opts && opts.now;
  if (now instanceof Date) return now.getTime();
  if (typeof now === "number" && Number.isFinite(now)) return now;
  if (typeof now === "string" && now.trim() !== "") {
    const parsed = Date.parse(now);
    if (Number.isFinite(parsed)) return parsed;
  }
  return Date.now();
}

// =========================================================================
// Streams
// =========================================================================

function summarizeStreams(treasury) {
  const t = isPlainObject(treasury) ? treasury : {};
  const revenue = isPlainObject(t.revenue) ? t.revenue : {};
  const streams = Array.isArray(revenue.streams) ? revenue.streams : [];
  const nowMs = Date.now();
  let totalActive = 0;
  let totalDeprecated = 0;
  let totalLifetime = 0n;
  const active = [];
  for (const stream of streams) {
    if (!isPlainObject(stream)) continue;
    const lifetime = safeBigInt(stream.lifetimeRevenueWei || "0");
    totalLifetime += lifetime;
    if (stream.status === "deprecated") {
      totalDeprecated += 1;
      continue;
    }
    if (stream.status === "active" || stream.status === "experimental") {
      totalActive += 1;
    }
    const createdMs = parseDateMs(stream.createdAt);
    active.push({
      id: stream.id || null,
      type: stream.type || null,
      status: stream.status || null,
      lifetimeRevenueWei: lifetime.toString(),
      lastClaim: isPlainObject(stream.lastClaim) ? stream.lastClaim : null,
      createdAt: stream.createdAt || null,
      daysAlive: createdMs !== null ? daysBetween(createdMs, nowMs) : null
    });
  }
  return {
    active,
    totalActive,
    totalDeprecated,
    totalLifetimeRevenueWei: totalLifetime.toString()
  };
}

// =========================================================================
// Experiments
// =========================================================================

function summarizeExperiments(state) {
  const s = isPlainObject(state) ? state : {};
  const problemLab = isPlainObject(s.problemLab) ? s.problemLab : {};
  const experiments = Array.isArray(problemLab.experiments) ? problemLab.experiments : [];
  const byStatus = {
    hypothesis: 0,
    dry_run: 0,
    bounded_live: 0,
    graduated: 0,
    sunset: 0
  };
  const active = [];
  const nowMs = Date.now();
  for (const exp of experiments) {
    if (!isPlainObject(exp)) continue;
    const status = typeof exp.status === "string" ? exp.status : null;
    if (status && Object.prototype.hasOwnProperty.call(byStatus, status)) {
      byStatus[status] += 1;
    }
    if (!status || !ACTIVE_EXPERIMENT_STATUSES.includes(status)) continue;
    const startedMs = parseDateMs(exp.createdAt);
    const daysSinceStart = startedMs !== null ? daysBetween(startedMs, nowMs) : null;
    active.push({
      id: exp.id || null,
      status,
      hypothesis: typeof exp.hypothesis === "string" ? exp.hypothesis : null,
      streamType: typeof exp.streamType === "string" ? exp.streamType : null,
      budgetWei: String(exp.budgetWei || "0"),
      spentWei: String(exp.spentWei || "0"),
      daysSinceStart
    });
  }
  return { byStatus, active };
}

// =========================================================================
// Drafts (revenue hypothesizer)
// =========================================================================

function summarizeDrafts(state) {
  const s = isPlainObject(state) ? state : {};
  const explorer = isPlainObject(s.revenueExplorer) ? s.revenueExplorer : {};
  const drafts = Array.isArray(explorer.draftProposals) ? explorer.draftProposals : [];
  const nowMs = Date.now();
  const out = [];
  for (const draft of drafts) {
    if (!isPlainObject(draft)) continue;
    const draftedMs = parseDateMs(draft.draftedAt);
    out.push({
      id: draft.id || null,
      archetypeId: draft.archetypeId || null,
      streamType: draft.streamType || null,
      hypothesis: typeof draft.hypothesis === "string" ? draft.hypothesis : null,
      draftedAt: draft.draftedAt || null,
      daysOld: draftedMs !== null ? daysBetween(draftedMs, nowMs) : null
    });
  }
  return out;
}

// =========================================================================
// Proposals (revenue explorer lifecycle proposals)
// =========================================================================

function summarizeProposals(state) {
  const s = isPlainObject(state) ? state : {};
  const explorer = isPlainObject(s.revenueExplorer) ? s.revenueExplorer : {};
  const proposals = Array.isArray(explorer.proposals) ? explorer.proposals : [];
  const out = [];
  for (const p of proposals) {
    if (!isPlainObject(p)) continue;
    out.push({
      experimentId: p.experimentId || null,
      currentStatus: p.currentStatus || null,
      proposedStatus: p.proposedStatus || null,
      reason: typeof p.reason === "string" ? p.reason : null,
      proposedAt: p.proposedAt || null,
      needsOwnerApproval: Boolean(p.needsOwnerApproval)
    });
  }
  return out;
}

// =========================================================================
// Warnings
// =========================================================================

function summarizeWarnings(state) {
  const s = isPlainObject(state) ? state : {};
  const explorer = isPlainObject(s.revenueExplorer) ? s.revenueExplorer : {};
  const warnings = Array.isArray(explorer.warnings) ? explorer.warnings : [];
  const copy = warnings.filter(isPlainObject).slice();
  copy.sort((a, b) => {
    const ta = parseDateMs(a.ts) || 0;
    const tb = parseDateMs(b.ts) || 0;
    return tb - ta;
  });
  return copy.slice(0, WARNINGS_RETURN_CAP);
}

// =========================================================================
// AI routing margin
// =========================================================================

function summarizeAiRoutingMargin(treasury) {
  const t = isPlainObject(treasury) ? treasury : null;
  if (!t) return null;
  const revenue = isPlainObject(t.revenue) ? t.revenue : null;
  const streams = revenue && Array.isArray(revenue.streams) ? revenue.streams : [];
  const found = streams.find(
    (s) => isPlainObject(s) && s.id === aiRoutingMargin.STREAM_ID
  );
  if (!found) return null;
  try {
    return aiRoutingMargin.summarizeRevenue(t);
  } catch {
    return null;
  }
}

// =========================================================================
// Treasury utility ratio
// =========================================================================

function summarizeTreasuryUtility(treasury, env, opts) {
  const t = isPlainObject(treasury) ? treasury : null;
  if (!t) return null;
  try {
    return treasuryUtility.summarizeUtility(t, env || {}, opts || {});
  } catch {
    return null;
  }
}

// =========================================================================
// Market signals
// =========================================================================

function summarizeMarketSignals(repoRoot) {
  if (typeof repoRoot !== "string" || repoRoot === "") {
    return { signalKinds: {}, latestTs: null, earliestTs: null, totalCount: 0 };
  }
  let signals;
  try {
    signals = marketSignals.readSignals(repoRoot, { limit: MARKET_SIGNALS_SAMPLE_CAP });
  } catch {
    return { signalKinds: {}, latestTs: null, earliestTs: null, totalCount: 0 };
  }
  const list = Array.isArray(signals) ? signals : [];
  const signalKinds = {};
  let latestMs = null;
  let earliestMs = null;
  let latestTs = null;
  let earliestTs = null;
  for (const sig of list) {
    if (!isPlainObject(sig)) continue;
    const kind = typeof sig.kind === "string" ? sig.kind : "unknown";
    signalKinds[kind] = (signalKinds[kind] || 0) + 1;
    const ms = parseDateMs(sig.ts);
    if (ms === null) continue;
    if (latestMs === null || ms > latestMs) {
      latestMs = ms;
      latestTs = sig.ts;
    }
    if (earliestMs === null || ms < earliestMs) {
      earliestMs = ms;
      earliestTs = sig.ts;
    }
  }
  return {
    signalKinds,
    latestTs,
    earliestTs,
    totalCount: list.length
  };
}

// =========================================================================
// Compose
// =========================================================================

function captureSection(name, errors, fn) {
  try {
    return fn();
  } catch (err) {
    errors.push({
      section: name,
      message: err && err.message ? err.message : String(err)
    });
    return null;
  }
}

function buildSummary(state, treasury, env, opts) {
  const options = isPlainObject(opts) ? opts : {};
  const repoRoot = typeof options.repoRoot === "string" ? options.repoRoot : null;
  const nowMs = resolveNowMs(options);
  const generatedAt = new Date(nowMs).toISOString();
  const errors = [];

  const streams = captureSection("streams", errors, () => summarizeStreams(treasury))
    || { active: [], totalActive: 0, totalDeprecated: 0, totalLifetimeRevenueWei: "0" };

  const experimentsSummary = captureSection("experiments", errors, () => summarizeExperiments(state))
    || { byStatus: {}, active: [] };

  const drafts = captureSection("drafts", errors, () => summarizeDrafts(state)) || [];
  const proposals = captureSection("proposals", errors, () => summarizeProposals(state)) || [];
  const warnings = captureSection("warnings", errors, () => summarizeWarnings(state)) || [];

  const aiMargin = captureSection("aiRoutingMargin", errors, () => summarizeAiRoutingMargin(treasury));

  const utility = captureSection("treasuryUtility", errors, () =>
    summarizeTreasuryUtility(treasury, env || {}, { now: new Date(nowMs) })
  );

  const market = captureSection("marketSignals", errors, () => summarizeMarketSignals(repoRoot))
    || { signalKinds: {}, latestTs: null, earliestTs: null, totalCount: 0 };

  return {
    generatedAt,
    streams,
    experiments: experimentsSummary,
    drafts,
    proposals,
    warnings,
    aiRoutingMargin: aiMargin || null,
    treasuryUtility: utility || null,
    marketSignals: market,
    errors
  };
}

// =========================================================================
// Render (human readable)
// =========================================================================

function pad(str, width) {
  const s = String(str == null ? "" : str);
  if (s.length >= width) return s;
  return s + " ".repeat(width - s.length);
}

function renderSummary(summary) {
  const s = isPlainObject(summary) ? summary : {};
  const lines = [];
  lines.push("=== Orbit Revenue Summary ===");
  lines.push(`Generated: ${s.generatedAt || new Date().toISOString()}`);
  lines.push("");

  // Streams
  const streams = isPlainObject(s.streams) ? s.streams : { active: [], totalActive: 0, totalDeprecated: 0, totalLifetimeRevenueWei: "0" };
  lines.push("--- Streams ---");
  lines.push(`Active: ${streams.totalActive || 0}   Deprecated: ${streams.totalDeprecated || 0}   Lifetime total wei: ${streams.totalLifetimeRevenueWei || "0"}`);
  const activeStreams = Array.isArray(streams.active) ? streams.active : [];
  if (activeStreams.length === 0) {
    lines.push("  (no streams)");
  } else {
    for (const stream of activeStreams) {
      lines.push(
        `  ${pad(stream.id || "(no id)", 28)} ${pad(stream.type || "?", 22)} ${pad(stream.status || "?", 13)} lifetime=${stream.lifetimeRevenueWei || "0"} wei`
      );
    }
  }
  lines.push("");

  // Experiments
  const exp = isPlainObject(s.experiments) ? s.experiments : { byStatus: {}, active: [] };
  lines.push("--- Experiments ---");
  const bs = isPlainObject(exp.byStatus) ? exp.byStatus : {};
  lines.push(
    `By status: hypothesis=${bs.hypothesis || 0} dry_run=${bs.dry_run || 0} bounded_live=${bs.bounded_live || 0} graduated=${bs.graduated || 0} sunset=${bs.sunset || 0}`
  );
  const activeExperiments = Array.isArray(exp.active) ? exp.active : [];
  if (activeExperiments.length === 0) {
    lines.push("  (no active experiments)");
  } else {
    for (const e of activeExperiments) {
      lines.push(
        `  ${pad(e.id || "(no id)", 36)} ${pad(e.status || "?", 14)} stream=${pad(e.streamType || "?", 22)} budget=${e.budgetWei || "0"} spent=${e.spentWei || "0"}`
      );
    }
  }
  lines.push("");

  // Drafts
  const drafts = Array.isArray(s.drafts) ? s.drafts : [];
  lines.push("--- Draft proposals (hypothesizer) ---");
  if (drafts.length === 0) {
    lines.push("  (no drafts pending)");
  } else {
    for (const d of drafts) {
      lines.push(`  ${pad(d.id || "(no id)", 40)} arch=${pad(d.archetypeId || "?", 32)} age=${d.daysOld == null ? "?" : `${d.daysOld}d`}`);
    }
  }
  lines.push("");

  // Proposals
  const proposals = Array.isArray(s.proposals) ? s.proposals : [];
  lines.push("--- Lifecycle proposals (explorer) ---");
  if (proposals.length === 0) {
    lines.push("  (no proposals pending)");
  } else {
    for (const p of proposals) {
      const tag = p.needsOwnerApproval ? "owner-approval" : "auto";
      lines.push(`  ${pad(p.experimentId || "(no id)", 36)} ${pad(p.currentStatus || "?", 14)} -> ${pad(p.proposedStatus || "?", 14)} [${tag}]`);
    }
  }
  lines.push("");

  // Warnings
  const warnings = Array.isArray(s.warnings) ? s.warnings : [];
  lines.push("--- Warnings ---");
  if (warnings.length === 0) {
    lines.push("  (none)");
  } else {
    for (const w of warnings) {
      lines.push(`  ${pad(w.kind || "?", 24)} ${pad(w.recommendation || "?", 12)} ts=${w.ts || "?"}`);
    }
  }
  lines.push("");

  // AI routing margin
  lines.push("--- AI routing margin ---");
  if (!isPlainObject(s.aiRoutingMargin)) {
    lines.push("  (stream not present)");
  } else {
    const m = s.aiRoutingMargin;
    lines.push(`  lifetimeWei=${m.lifetimeRevenueWei || "0"} totalCalls=${m.totalCallsBilled || 0} avgPerCallWei=${m.avgMarginPerCallWei || "0"}`);
  }
  lines.push("");

  // Treasury utility
  lines.push("--- Treasury utility ratio ---");
  if (!isPlainObject(s.treasuryUtility)) {
    lines.push("  (unavailable)");
  } else {
    const u = s.treasuryUtility;
    lines.push(`  ratio=${u.ratio} cap=${u.ratioCap} window=${u.windowDays}d recommendation=${u.recommendation || "?"}`);
  }
  lines.push("");

  // Market signals
  const market = isPlainObject(s.marketSignals) ? s.marketSignals : { signalKinds: {}, totalCount: 0, latestTs: null };
  lines.push("--- Market signals (last 100) ---");
  lines.push(`Total samples: ${market.totalCount || 0}   Latest: ${market.latestTs || "(none)"}`);
  const kinds = isPlainObject(market.signalKinds) ? market.signalKinds : {};
  const kindKeys = Object.keys(kinds).sort();
  if (kindKeys.length === 0) {
    lines.push("  (no signal kinds observed)");
  } else {
    for (const k of kindKeys) {
      lines.push(`  ${pad(k, 36)} ${kinds[k]}`);
    }
  }
  lines.push("");

  // Errors (best-effort sections that threw)
  const errs = Array.isArray(s.errors) ? s.errors : [];
  if (errs.length > 0) {
    lines.push("--- Aggregator errors ---");
    for (const e of errs) {
      lines.push(`  ${e.section}: ${e.message}`);
    }
    lines.push("");
  }

  // One-liner status
  const activeStreamCount = streams.totalActive || 0;
  const activeExperimentCount = Array.isArray(exp.active) ? exp.active.length : 0;
  const warningCount = warnings.length;
  lines.push(`Status: ${activeStreamCount} active stream(s), ${activeExperimentCount} active experiment(s), ${warningCount} warning(s).`);

  return lines.join("\n");
}

// =========================================================================
// Dashboard slice (GitHub-visible, must NOT leak our-money amounts)
// =========================================================================

function captureRiskTierFromWarnings(warnings) {
  if (!Array.isArray(warnings) || warnings.length === 0) return "healthy";
  let worst = "healthy";
  const ranking = { healthy: 0, watch: 1, warning: 2, critical: 3 };
  for (const w of warnings) {
    if (!isPlainObject(w)) continue;
    if (w.kind !== "identity_capture") continue;
    const rec = typeof w.recommendation === "string" ? w.recommendation : null;
    if (!rec || !Object.prototype.hasOwnProperty.call(ranking, rec)) continue;
    if (ranking[rec] > ranking[worst]) worst = rec;
  }
  return worst;
}

function utilityRatioTierFromUtility(utility) {
  if (!isPlainObject(utility)) return "unknown";
  const rec = utility.recommendation;
  if (rec === "over_cap") return "over_cap";
  if (rec === "approaching_cap") return "approaching_cap";
  if (rec === "ok") return "ok";
  return "unknown";
}

function summaryToDashboardSlice(summary) {
  const s = isPlainObject(summary) ? summary : {};
  const streams = isPlainObject(s.streams) ? s.streams : { totalActive: 0, totalDeprecated: 0, active: [] };
  const experiments = isPlainObject(s.experiments) ? s.experiments : { byStatus: {} };
  const drafts = Array.isArray(s.drafts) ? s.drafts : [];
  const proposals = Array.isArray(s.proposals) ? s.proposals : [];
  const warnings = Array.isArray(s.warnings) ? s.warnings : [];

  const byStatus = isPlainObject(experiments.byStatus) ? experiments.byStatus : {};
  const experimentCount = {
    hypothesis: byStatus.hypothesis || 0,
    dry_run: byStatus.dry_run || 0,
    bounded_live: byStatus.bounded_live || 0,
    graduated: byStatus.graduated || 0,
    sunset: byStatus.sunset || 0
  };

  const recentArchetypes = drafts
    .slice(-RECENT_ARCHETYPES_CAP)
    .map((d) => (isPlainObject(d) && typeof d.archetypeId === "string" ? d.archetypeId : null))
    .filter((x) => typeof x === "string");

  const activeProposals = proposals.filter((p) => isPlainObject(p) && p.needsOwnerApproval).length;

  return {
    generatedAt: s.generatedAt || new Date().toISOString(),
    streamCount: {
      active: streams.totalActive || 0,
      deprecated: streams.totalDeprecated || 0
    },
    experimentCount,
    draftCount: drafts.length,
    activeProposals,
    warningCount: warnings.length,
    capturedRiskTier: captureRiskTierFromWarnings(warnings),
    utilityRatioTier: utilityRatioTierFromUtility(s.treasuryUtility),
    recentArchetypes
  };
}

module.exports = {
  buildSummary,
  renderSummary,
  summarizeAiRoutingMargin,
  summarizeDrafts,
  summarizeExperiments,
  summarizeMarketSignals,
  summarizeProposals,
  summarizeStreams,
  summarizeTreasuryUtility,
  summarizeWarnings,
  summaryToDashboardSlice
};
