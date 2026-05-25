"use strict";

// Managed-lifecycle revenue experiments. These ride in the existing
// problem-lab store (memory/problem-lab.json) under `experiments[]`.
// The advisory `learning-lab.nextExperiment()` helper still exists and is
// independent — this module is for live-tracked experiments with budgets,
// kill criteria, and a graduation path into a revenue stream.

const revenueStreams = require("./revenue-streams");
const sybilFloor = require("./sybil-floor");
let busFactor;
try {
  busFactor = require("./bus-factor");
} catch (err) {
  busFactor = null;
}
let busFactorData;
try {
  busFactorData = require("./bus-factor-data");
} catch (err) {
  busFactorData = null;
}

const EXPERIMENT_STATUSES = ["hypothesis", "dry_run", "bounded_live", "graduated", "sunset"];

const TRANSITIONS = {
  hypothesis: ["dry_run", "sunset"],
  dry_run: ["bounded_live", "sunset"],
  bounded_live: ["graduated", "sunset"],
  graduated: [],
  sunset: []
};

const VALID_OPERATORS = new Set([">", ">=", "<", "<=", "==", "!="]);

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function defaultExperiment(overrides = {}) {
  const now = new Date().toISOString();
  const base = {
    id: null,
    hypothesis: null,
    streamType: null,
    status: EXPERIMENT_STATUSES[0],
    budgetWei: "0",
    spentWei: "0",
    killCriteria: [],
    minSignalsToKill: 2,
    signalRequirements: [],
    lifecycleHistory: [],
    createdAt: now,
    metadata: {}
  };
  const merged = { ...base, ...(overrides || {}) };
  if (!EXPERIMENT_STATUSES.includes(merged.status)) {
    throw new Error(`experiment.status must be one of ${EXPERIMENT_STATUSES.join(", ")}`);
  }
  if (!Array.isArray(merged.killCriteria)) merged.killCriteria = [];
  if (!Array.isArray(merged.signalRequirements)) merged.signalRequirements = [];
  if (!Array.isArray(merged.lifecycleHistory)) merged.lifecycleHistory = [];
  if (!isPlainObject(merged.metadata)) merged.metadata = {};
  if (typeof merged.minSignalsToKill !== "number" || merged.minSignalsToKill < 1) {
    merged.minSignalsToKill = 1;
  }
  return merged;
}

function validateKillCriteria(killCriteria) {
  if (!Array.isArray(killCriteria)) return [];
  return killCriteria.map((entry, index) => {
    if (!isPlainObject(entry)) {
      throw new Error(`killCriteria[${index}] must be an object`);
    }
    if (!entry.signal || typeof entry.signal !== "string") {
      throw new Error(`killCriteria[${index}].signal is required (string)`);
    }
    if (!VALID_OPERATORS.has(entry.operator)) {
      throw new Error(`killCriteria[${index}].operator must be one of ${[...VALID_OPERATORS].join(" ")}`);
    }
    if (entry.threshold === undefined || entry.threshold === null) {
      throw new Error(`killCriteria[${index}].threshold is required`);
    }
    return { ...entry };
  });
}

function ensureExperimentsArray(state) {
  if (!isPlainObject(state)) {
    throw new Error("state must be an object");
  }
  if (!isPlainObject(state.problemLab)) state.problemLab = {};
  if (!Array.isArray(state.problemLab.experiments)) state.problemLab.experiments = [];
  return state.problemLab.experiments;
}

function proposeExperiment(state, experiment) {
  if (!isPlainObject(experiment)) throw new Error("experiment must be an object");
  if (!experiment.id || typeof experiment.id !== "string") {
    throw new Error("experiment.id is required (string)");
  }
  if (!experiment.hypothesis || typeof experiment.hypothesis !== "string") {
    throw new Error("experiment.hypothesis is required (string)");
  }
  if (!experiment.streamType || typeof experiment.streamType !== "string") {
    throw new Error("experiment.streamType is required (string)");
  }

  const experiments = ensureExperimentsArray(state);
  if (experiments.some((existing) => existing && existing.id === experiment.id)) {
    throw new Error(`experiment id already exists: ${experiment.id}`);
  }

  const killCriteria = validateKillCriteria(experiment.killCriteria || []);
  const requestedMin = experiment.minSignalsToKill !== undefined
    ? Number(experiment.minSignalsToKill)
    : 2;
  const minSignalsToKill = Number.isFinite(requestedMin) && requestedMin >= 1
    ? Math.floor(requestedMin)
    : 2;

  if (minSignalsToKill === 1) {
    if (killCriteria.length < 1) {
      throw new Error("minSignalsToKill=1 requires at least 1 killCriteria entry");
    }
  } else if (killCriteria.length < minSignalsToKill) {
    throw new Error(
      `killCriteria.length (${killCriteria.length}) must be >= minSignalsToKill (${minSignalsToKill})`
    );
  }

  const populated = defaultExperiment({
    ...experiment,
    killCriteria,
    minSignalsToKill,
    lifecycleHistory: [
      {
        status: experiment.status || EXPERIMENT_STATUSES[0],
        ts: new Date().toISOString(),
        by: "auto",
        reason: "proposed"
      }
    ]
  });

  experiments.push(populated);
  return populated;
}

function findExperiment(state, experimentId) {
  if (!isPlainObject(state)) return null;
  if (!isPlainObject(state.problemLab)) return null;
  if (!Array.isArray(state.problemLab.experiments)) return null;
  return state.problemLab.experiments.find((entry) => entry && entry.id === experimentId) || null;
}

function advanceLifecycle(state, experimentId, newStatus, opts) {
  // Lifecycle transition.
  //
  // S-REVENUE-3 sybil-floor integration:
  //   When newStatus === "bounded_live" AND opts.funders is a non-empty array,
  //   we gate the transition with sybilFloor.assertSybilFloorMet. If the floor
  //   is not met, the assertion throws SYBIL_FLOOR_NOT_MET and the experiment
  //   status is NOT updated. This is opt-in: callers that do not supply
  //   opts.funders skip the check entirely (back-compat for the legacy
  //   call sites that do not yet collect funder rows).
  //
  // Escape hatch:
  //   opts.skipSybilCheck === true bypasses the gate even when funders are
  //   provided. Used by test scaffolding and admin overrides.
  //
  // opts.env (object) is forwarded to sybilFloor.loadConfig; defaults to
  // process.env when omitted.
  // opts.now (Date | number | string) is forwarded to sybilFloor as `now`.
  const experiment = findExperiment(state, experimentId);
  if (!experiment) throw new Error(`unknown experiment: ${experimentId}`);
  if (!EXPERIMENT_STATUSES.includes(newStatus)) {
    throw new Error(`unknown status: ${newStatus}`);
  }
  const allowed = TRANSITIONS[experiment.status] || [];
  if (!allowed.includes(newStatus)) {
    throw new Error(`invalid transition: ${experiment.status} -> ${newStatus}`);
  }
  const options = isPlainObject(opts) ? opts : {};

  // Sybil floor gate (opt-in, fail-loud).
  if (
    newStatus === "bounded_live"
    && options.skipSybilCheck !== true
    && Array.isArray(options.funders)
    && options.funders.length > 0
  ) {
    sybilFloor.assertSybilFloorMet(
      options.funders,
      options.env || process.env,
      options.now ? { now: options.now } : undefined
    );
  }

  const entry = {
    status: newStatus,
    ts: new Date().toISOString(),
    by: options.by === "owner" ? "owner" : "auto",
    reason: typeof options.reason === "string" ? options.reason : null
  };
  experiment.status = newStatus;
  experiment.lifecycleHistory = Array.isArray(experiment.lifecycleHistory)
    ? experiment.lifecycleHistory.concat(entry)
    : [entry];
  return experiment;
}

function compareSignal(value, operator, threshold) {
  switch (operator) {
    case ">": return value > threshold;
    case ">=": return value >= threshold;
    case "<": return value < threshold;
    case "<=": return value <= threshold;
    case "==": return value === threshold;
    case "!=": return value !== threshold;
    default: return false;
  }
}

function experimentStartMs(experiment) {
  if (!experiment || !experiment.createdAt) return 0;
  const parsed = Date.parse(experiment.createdAt);
  return Number.isFinite(parsed) ? parsed : 0;
}

function evaluateKillCriteria(experiment, signals) {
  if (!isPlainObject(experiment)) {
    throw new Error("experiment must be an object");
  }
  const criteria = Array.isArray(experiment.killCriteria) ? experiment.killCriteria : [];
  const required = Math.max(1, Number(experiment.minSignalsToKill) || 1);
  const startMs = experimentStartMs(experiment);
  const relevant = (Array.isArray(signals) ? signals : []).filter((signal) => {
    if (!isPlainObject(signal)) return false;
    if (!signal.kind) return false;
    if (!signal.ts) return true;
    const parsed = Date.parse(signal.ts);
    if (!Number.isFinite(parsed)) return true;
    return parsed >= startMs;
  });

  const matched = [];
  for (const criterion of criteria) {
    if (!isPlainObject(criterion)) continue;
    const matchingSignal = relevant.find((signal) => {
      if (signal.kind !== criterion.signal) return false;
      return compareSignal(signal.value, criterion.operator, criterion.threshold);
    });
    if (matchingSignal) {
      matched.push({ criterion, signal: matchingSignal });
    }
  }

  const triggered = matched.length >= required;
  return {
    triggered,
    matched: matched.length,
    required,
    signals: matched
  };
}

function recordSpend(experiment, amountWei) {
  if (!isPlainObject(experiment)) throw new Error("experiment must be an object");
  const amount = revenueStreams.toBigIntWei(amountWei);
  if (amount < 0n) throw new Error("amountWei must be >= 0");
  const current = revenueStreams.toBigIntWei(experiment.spentWei || "0");
  experiment.spentWei = (current + amount).toString();
  return experiment;
}

function isOverBudget(experiment) {
  if (!isPlainObject(experiment)) return false;
  const spent = revenueStreams.toBigIntWei(experiment.spentWei || "0");
  const budget = revenueStreams.toBigIntWei(experiment.budgetWei || "0");
  return spent >= budget;
}

function graduateToStream(state, treasury, experimentId, streamConfig, opts) {
  // S-REVENUE-3 bus-factor integration.
  //
  // Before promoting an experiment to a real revenue stream we require that
  // enough independent maintainers (commit authors + active adopters) are
  // exercising the code path. Without this guard a single-maintainer
  // experiment can graduate into something the household cannot keep alive.
  //
  // Behaviour:
  //   - opts.skipBusFactorCheck === true: skip the gate entirely.
  //   - opts.repoRoot missing/null: skip the gate (defensive; the legacy
  //     test scaffolding does not pass a real repo).
  //   - otherwise: gather commits + adopters from disk, run
  //     busFactor.assertBusFactorMet, propagate BUS_FACTOR_NOT_MET on
  //     failure so the caller refuses graduation.
  //
  // opts.env is forwarded to busFactor.loadConfig; defaults to process.env.
  const experiment = findExperiment(state, experimentId);
  if (!experiment) throw new Error(`unknown experiment: ${experimentId}`);
  if (!isPlainObject(streamConfig)) throw new Error("streamConfig must be an object");

  const options = isPlainObject(opts) ? opts : {};
  if (
    options.skipBusFactorCheck !== true
    && options.repoRoot
    && busFactor
    && busFactorData
    && typeof busFactorData.gatherBusFactorInputs === "function"
    && typeof busFactor.assertBusFactorMet === "function"
  ) {
    let inputs;
    try {
      inputs = busFactorData.gatherBusFactorInputs(
        options.repoRoot,
        options.env || process.env
      );
    } catch (err) {
      // Defensive: data extraction should never crash graduation. If we
      // can't read the inputs we degrade to "skip" rather than refuse.
      try { console.warn(`graduateToStream: bus-factor data gather failed: ${err.message}`); } catch {}
      inputs = null;
    }
    if (inputs) {
      busFactor.assertBusFactorMet(
        Array.isArray(inputs.commits) ? inputs.commits : [],
        Array.isArray(inputs.adopters) ? inputs.adopters : [],
        options.env || process.env,
        options.now ? { now: options.now } : undefined
      );
    }
  }

  const config = {
    ...streamConfig,
    type: experiment.streamType,
    status: "active"
  };
  if (!config.id) {
    throw new Error("streamConfig.id is required");
  }

  advanceLifecycle(state, experimentId, "graduated", { by: "auto", reason: "graduated_to_stream" });
  revenueStreams.registerStream(treasury, config);
  const stream = revenueStreams.getStream(treasury, config.id);
  return { experiment, stream };
}

module.exports = {
  EXPERIMENT_STATUSES,
  TRANSITIONS,
  advanceLifecycle,
  defaultExperiment,
  ensureExperimentsArray,
  evaluateKillCriteria,
  findExperiment,
  graduateToStream,
  isOverBudget,
  proposeExperiment,
  recordSpend
};
