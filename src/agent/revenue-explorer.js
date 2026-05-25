"use strict";

// S-REVENUE-2 — Autonomous revenue-experiment orchestrator.
//
// Reads the primitives that landed in S-REVENUE-1 (revenue-experiments,
// market-signals, treasury-utility ratio cap, ai-routing-margin) and MOVES
// experiments through their lifecycle:
//
//   - Sunsets killed experiments automatically (no owner approval needed —
//     the kill criteria already represent owner intent).
//   - Proposes advance transitions (dry_run -> bounded_live, bounded_live
//     -> graduated) but never executes them; owner approval flows through
//     the existing approval-issue pipeline.
//   - Surfaces a treasury-utility rebate proposal when the ratio cap is
//     breached.
//
// Best-effort throughout. The explorer pass MUST NEVER cause the cycle to
// fail — every per-experiment evaluation is wrapped in try/catch, and the
// run.js call site swallows any thrown error.

const path = require("path");

const revenueExperiments = require("./revenue-experiments");
const learningLab = require("./learning-lab");
const marketSignals = require("./market-signals");

// Defensive require for treasury-utility: Agent B is building this in
// parallel and it may not be importable yet. Fall back to a no-op shim so
// tests pass either way.
let treasuryUtility;
try {
  treasuryUtility = require("./treasury-utility");
} catch (err) {
  treasuryUtility = null;
}

const DEFAULT_LOOKBACK_HOURS = 168;
const DEFAULT_MIN_DRY_RUN_CYCLES = 8;
const DEFAULT_BOUNDED_LIVE_DURATION_WEEKS = 4;

const RUN_HISTORY_CAP = 50;
const ACTIVE_STATUSES = new Set(["dry_run", "bounded_live"]);

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parsePositiveInt(raw, fallback) {
  if (raw === undefined || raw === null || raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
}

function loadExplorerConfig(env) {
  const source = isPlainObject(env) ? env : {};
  return {
    lookbackHours: parsePositiveInt(
      source.ORBIT_EXPLORER_LOOKBACK_HOURS,
      DEFAULT_LOOKBACK_HOURS
    ),
    minDryRunCycles: parsePositiveInt(
      source.ORBIT_EXPLORER_MIN_DRY_RUN_CYCLES,
      DEFAULT_MIN_DRY_RUN_CYCLES
    ),
    boundedLiveWeeks: parsePositiveInt(
      source.ORBIT_EXPLORER_BOUNDED_LIVE_WEEKS,
      DEFAULT_BOUNDED_LIVE_DURATION_WEEKS
    )
  };
}

function experimentStartMs(experiment) {
  if (!experiment || !experiment.createdAt) return 0;
  const parsed = Date.parse(experiment.createdAt);
  return Number.isFinite(parsed) ? parsed : 0;
}

function findStatusEntryMs(experiment, status) {
  if (!experiment || !Array.isArray(experiment.lifecycleHistory)) return null;
  for (let i = experiment.lifecycleHistory.length - 1; i >= 0; i -= 1) {
    const entry = experiment.lifecycleHistory[i];
    if (entry && entry.status === status && entry.ts) {
      const parsed = Date.parse(entry.ts);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

function filterSignalsForExperiment(experiment, signals, lookbackHours, nowMs) {
  if (!Array.isArray(signals)) return [];
  const startMs = experimentStartMs(experiment);
  const lookbackMs = Math.max(0, Number(lookbackHours) || 0) * 60 * 60 * 1000;
  const sinceMs = lookbackMs > 0 ? nowMs - lookbackMs : 0;
  const minMs = Math.max(startMs, sinceMs);
  return signals.filter((signal) => {
    if (!isPlainObject(signal)) return false;
    if (!signal.kind) return false;
    if (!signal.ts) return true;
    const parsed = Date.parse(signal.ts);
    if (!Number.isFinite(parsed)) return true;
    return parsed >= minMs;
  });
}

function evaluateExperiment(experiment, signals, treasury, config, env) {
  if (!isPlainObject(experiment)) {
    throw new Error("experiment must be an object");
  }
  const cfg = isPlainObject(config) ? config : loadExplorerConfig(env);
  const nowMs = Date.now();
  const relevant = filterSignalsForExperiment(
    experiment,
    signals,
    cfg.lookbackHours,
    nowMs
  );
  const killEvaluation = revenueExperiments.evaluateKillCriteria(
    experiment,
    relevant
  );
  return {
    experimentId: experiment.id,
    status: experiment.status,
    killEvaluation: {
      triggered: Boolean(killEvaluation.triggered),
      matched: killEvaluation.matched,
      required: killEvaluation.required
    },
    signalsConsidered: relevant.length
  };
}

function recommendNextTransition(experiment, evaluation, config) {
  if (!isPlainObject(experiment)) {
    return { recommendation: "hold", reason: "no_experiment" };
  }
  const cfg = isPlainObject(config) ? config : loadExplorerConfig({});
  const killTriggered = Boolean(
    evaluation && evaluation.killEvaluation && evaluation.killEvaluation.triggered
  );
  const status = experiment.status;
  if (status === "hypothesis") {
    return { recommendation: "hold", reason: "awaits_owner_approval" };
  }
  if (status === "graduated" || status === "sunset") {
    return { recommendation: "hold", reason: "terminal_status" };
  }
  if (status === "dry_run") {
    if (killTriggered) {
      return {
        recommendation: "sunset",
        toStatus: "sunset",
        reason: "kill_criteria_triggered"
      };
    }
    const cyclesObserved = evaluation && Number.isFinite(evaluation.signalsConsidered)
      ? evaluation.signalsConsidered
      : 0;
    if (cyclesObserved >= cfg.minDryRunCycles) {
      return {
        recommendation: "advance",
        toStatus: "bounded_live",
        reason: `dry_run_cycles_met:${cyclesObserved}>=${cfg.minDryRunCycles}`
      };
    }
    return {
      recommendation: "hold",
      reason: `dry_run_cycles_insufficient:${cyclesObserved}<${cfg.minDryRunCycles}`
    };
  }
  if (status === "bounded_live") {
    if (killTriggered) {
      return {
        recommendation: "sunset",
        toStatus: "sunset",
        reason: "kill_criteria_triggered"
      };
    }
    if (revenueExperiments.isOverBudget(experiment)) {
      return {
        recommendation: "sunset",
        toStatus: "sunset",
        reason: "over_budget"
      };
    }
    const enteredMs = findStatusEntryMs(experiment, "bounded_live");
    if (enteredMs !== null) {
      const weeksMs = Math.max(0, cfg.boundedLiveWeeks) * 7 * 24 * 60 * 60 * 1000;
      const elapsedMs = Date.now() - enteredMs;
      if (elapsedMs >= weeksMs) {
        return {
          recommendation: "advance",
          toStatus: "graduated",
          reason: `bounded_live_duration_elapsed:${cfg.boundedLiveWeeks}w`
        };
      }
      return {
        recommendation: "hold",
        reason: `bounded_live_duration_pending:${cfg.boundedLiveWeeks}w`
      };
    }
    return {
      recommendation: "hold",
      reason: "bounded_live_entry_unknown"
    };
  }
  return { recommendation: "hold", reason: `unknown_status:${status}` };
}

function buildProposal(experiment, evaluation, recommendation) {
  const triggered = (evaluation && evaluation.killEvaluation && evaluation.killEvaluation.triggered)
    ? (Array.isArray(experiment.killCriteria) ? experiment.killCriteria.map((c) => c && c.signal).filter(Boolean) : [])
    : [];
  const proposedStatus = recommendation && recommendation.toStatus
    ? recommendation.toStatus
    : null;
  const needsOwnerApproval = recommendation && recommendation.recommendation === "advance";
  return {
    experimentId: experiment ? experiment.id : null,
    currentStatus: experiment ? experiment.status : null,
    proposedStatus,
    reason: recommendation ? recommendation.reason : null,
    needsOwnerApproval: Boolean(needsOwnerApproval),
    killSignalsTriggered: triggered,
    proposedAt: new Date().toISOString()
  };
}

function defaultExplorerState() {
  return {
    proposals: [],
    lastRanAt: null,
    runHistory: []
  };
}

function ensureExplorerState(state) {
  if (!isPlainObject(state)) {
    throw new Error("state must be an object");
  }
  if (!isPlainObject(state.revenueExplorer)) {
    state.revenueExplorer = defaultExplorerState();
  } else {
    if (!Array.isArray(state.revenueExplorer.proposals)) {
      state.revenueExplorer.proposals = [];
    }
    if (!Array.isArray(state.revenueExplorer.runHistory)) {
      state.revenueExplorer.runHistory = [];
    }
    if (typeof state.revenueExplorer.lastRanAt !== "string") {
      state.revenueExplorer.lastRanAt = state.revenueExplorer.lastRanAt || null;
    }
  }
  return state.revenueExplorer;
}

function listProposals(state) {
  if (!isPlainObject(state)) return [];
  if (!isPlainObject(state.revenueExplorer)) return [];
  return Array.isArray(state.revenueExplorer.proposals)
    ? state.revenueExplorer.proposals
    : [];
}

function clearProposal(state, proposalId) {
  if (!isPlainObject(state)) return false;
  if (!isPlainObject(state.revenueExplorer)) return false;
  const before = Array.isArray(state.revenueExplorer.proposals)
    ? state.revenueExplorer.proposals
    : [];
  const after = before.filter((p) => {
    if (!isPlainObject(p)) return false;
    // Sunset/rebate proposals use experimentId or proposalId; match either.
    if (p.id && p.id === proposalId) return false;
    if (p.experimentId && p.experimentId === proposalId) return false;
    return true;
  });
  state.revenueExplorer.proposals = after;
  return after.length !== before.length;
}

function proposalKey(proposal) {
  if (!isPlainObject(proposal)) return null;
  if (proposal.kind === "rebate") return `rebate:${proposal.proposalId || ""}`;
  if (proposal.experimentId) {
    return `experiment:${proposal.experimentId}:${proposal.proposedStatus || ""}`;
  }
  return null;
}

function dedupeProposals(existing, candidate) {
  const key = proposalKey(candidate);
  if (!key) return false;
  return existing.some((p) => proposalKey(p) === key);
}

function readSignalsSafe(repoRoot, opts) {
  try {
    return marketSignals.readSignals(repoRoot, opts || {});
  } catch (err) {
    try { console.warn(`revenue-explorer: readSignals failed: ${err.message}`); } catch {}
    return [];
  }
}

function loadExperimentsFromState(state, repoRoot) {
  if (isPlainObject(state) && isPlainObject(state.problemLab)
      && Array.isArray(state.problemLab.experiments)) {
    return state.problemLab.experiments;
  }
  if (repoRoot) {
    try {
      return learningLab.loadExperiments(repoRoot);
    } catch (err) {
      try { console.warn(`revenue-explorer: loadExperiments failed: ${err.message}`); } catch {}
    }
  }
  return [];
}

function sunsetExperiment(experiment, reason) {
  if (!isPlainObject(experiment)) return;
  const entry = {
    status: "sunset",
    ts: new Date().toISOString(),
    by: "auto",
    reason: typeof reason === "string" ? reason : "sunset"
  };
  experiment.status = "sunset";
  experiment.lifecycleHistory = Array.isArray(experiment.lifecycleHistory)
    ? experiment.lifecycleHistory.concat(entry)
    : [entry];
}

function evaluateTreasuryUtility(treasury, env) {
  if (!treasuryUtility || typeof treasuryUtility.computeRatio !== "function") {
    return null;
  }
  let report;
  try {
    report = treasuryUtility.computeRatio(treasury, env);
  } catch (err) {
    try { console.warn(`revenue-explorer: computeRatio failed: ${err.message}`); } catch {}
    return null;
  }
  if (!isPlainObject(report)) return null;
  let overCap = false;
  try {
    if (typeof treasuryUtility.isRatioOverCap === "function") {
      overCap = Boolean(treasuryUtility.isRatioOverCap(report.ratio, env));
    }
  } catch (err) {
    try { console.warn(`revenue-explorer: isRatioOverCap failed: ${err.message}`); } catch {}
  }
  let rebate = null;
  if (overCap && typeof treasuryUtility.proposeRebate === "function") {
    try {
      rebate = treasuryUtility.proposeRebate(treasury, report, env);
    } catch (err) {
      try { console.warn(`revenue-explorer: proposeRebate failed: ${err.message}`); } catch {}
    }
  }
  return { report, overCap, rebate };
}

async function runExplorer(state, treasury, config, env, opts) {
  const options = isPlainObject(opts) ? opts : {};
  const explorerConfig = loadExplorerConfig(env);
  const explorerState = ensureExplorerState(state);
  const repoRoot = options.repoRoot
    || (isPlainObject(config) && config.repoRoot)
    || process.cwd();
  const now = options.now instanceof Date ? options.now : new Date();

  const summary = {
    evaluated: 0,
    sunset: 0,
    proposalsAdded: 0,
    ratioReport: null,
    errors: 0
  };

  // 1+2. Load experiments + signals.
  const experiments = loadExperimentsFromState(state, repoRoot);
  const sinceIso = new Date(now.getTime() - (explorerConfig.lookbackHours * 60 * 60 * 1000))
    .toISOString();
  const signals = readSignalsSafe(repoRoot, { since: sinceIso });

  // 3. Iterate active experiments. Per-experiment try/catch keeps a bad
  // record from blowing up the whole pass.
  for (const experiment of experiments) {
    try {
      if (!isPlainObject(experiment)) continue;
      if (!ACTIVE_STATUSES.has(experiment.status)) continue;
      summary.evaluated += 1;

      const evaluation = evaluateExperiment(
        experiment,
        signals,
        treasury,
        explorerConfig,
        env
      );
      const recommendation = recommendNextTransition(
        experiment,
        evaluation,
        explorerConfig
      );

      if (recommendation.recommendation === "sunset") {
        sunsetExperiment(experiment, recommendation.reason);
        summary.sunset += 1;
        continue;
      }

      if (recommendation.recommendation === "advance") {
        const proposal = buildProposal(experiment, evaluation, recommendation);
        if (!dedupeProposals(explorerState.proposals, proposal)) {
          explorerState.proposals.push(proposal);
          summary.proposalsAdded += 1;
        }
      }
    } catch (err) {
      summary.errors += 1;
      try { console.warn(`revenue-explorer: experiment evaluation failed: ${err.message}`); } catch {}
    }
  }

  // 4. Treasury-utility ratio cap. Best-effort; if Agent B's module isn't
  // present or returns nothing, we just skip.
  try {
    const utilityResult = evaluateTreasuryUtility(treasury, env);
    if (utilityResult) {
      summary.ratioReport = utilityResult.report;
      if (utilityResult.overCap && utilityResult.rebate) {
        const proposal = {
          kind: "rebate",
          proposalId: utilityResult.rebate.proposalId || null,
          amountWei: utilityResult.rebate.amountWei
            ? String(utilityResult.rebate.amountWei)
            : null,
          targets: Array.isArray(utilityResult.rebate.targets)
            ? utilityResult.rebate.targets
            : [],
          ratio: utilityResult.report.ratio || null,
          needsOwnerApproval: true,
          proposedAt: now.toISOString()
        };
        if (!dedupeProposals(explorerState.proposals, proposal)) {
          explorerState.proposals.push(proposal);
          summary.proposalsAdded += 1;
        }
      }
    }
  } catch (err) {
    summary.errors += 1;
    try { console.warn(`revenue-explorer: treasury-utility evaluation failed: ${err.message}`); } catch {}
  }

  // 5. Record run + cap history.
  explorerState.lastRanAt = now.toISOString();
  const runRecord = {
    ts: explorerState.lastRanAt,
    evaluated: summary.evaluated,
    sunset: summary.sunset,
    proposalsAdded: summary.proposalsAdded,
    errors: summary.errors
  };
  explorerState.runHistory.push(runRecord);
  if (explorerState.runHistory.length > RUN_HISTORY_CAP) {
    explorerState.runHistory = explorerState.runHistory.slice(-RUN_HISTORY_CAP);
  }

  return summary;
}

module.exports = {
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
};
