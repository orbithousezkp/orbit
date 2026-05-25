"use strict";

// S-REVENUE-3: bus-factor gate.
//
// Research finding (REVENUE_EXPLORER.md §4): OSS projects with bus-factor of 1
// die when the sole maintainer disappears. External Secrets Operator, Ingress
// NGINX, and xz utils are recent cautionary tales. An experiment in orbit
// MUST NOT graduate to a real revenue stream until the code path is supported
// by N independent maintainers (commit authors) AND/OR independent adopters
// running the same code path.
//
// This module is the gate. It is a pure function over:
//   - a list of commits (typically `git log --since=<lookback>` or the
//     GitHub list-commits API output) for the relevant code path
//   - a list of adopter implementations (from adopters.js registry) running
//     said code path
//
// It returns an evaluation describing whether the combined "independent
// hands" count meets the configured minimum. Callers (revenue-experiments
// graduateToStream, orbit-preflight) decide what to do with the verdict.
//
// No I/O. Pure module. Defensive against malformed inputs.

const DEFAULT_MIN_MAINTAINERS = 3;            // env: ORBIT_BUS_FACTOR_MIN_MAINTAINERS
const DEFAULT_LOOKBACK_DAYS = 90;             // env: ORBIT_BUS_FACTOR_LOOKBACK_DAYS
const DEFAULT_MIN_COMMITS_PER_MAINTAINER = 3; // env: ORBIT_BUS_FACTOR_MIN_COMMITS

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function parseIntInRange(raw, fieldName, min, max) {
  if (raw === undefined || raw === null || raw === "") {
    return null;
  }
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n)) {
    throw new Error("bus-factor: " + fieldName + " must be an integer");
  }
  if (n < min || n > max) {
    throw new Error(
      "bus-factor: " + fieldName + " must be in [" + min + ", " + max + "] (got " + n + ")"
    );
  }
  return n;
}

function loadConfig(env) {
  const source = env && typeof env === "object" ? env : {};
  const minMaintainers =
    parseIntInRange(source.ORBIT_BUS_FACTOR_MIN_MAINTAINERS, "minMaintainers", 1, 20) ||
    DEFAULT_MIN_MAINTAINERS;
  const lookbackDays =
    parseIntInRange(source.ORBIT_BUS_FACTOR_LOOKBACK_DAYS, "lookbackDays", 7, 365) ||
    DEFAULT_LOOKBACK_DAYS;
  const minCommitsPerMaintainer =
    parseIntInRange(source.ORBIT_BUS_FACTOR_MIN_COMMITS, "minCommitsPerMaintainer", 1, 50) ||
    DEFAULT_MIN_COMMITS_PER_MAINTAINER;
  return { minMaintainers, lookbackDays, minCommitsPerMaintainer };
}

function safeParseTimestamp(value) {
  if (typeof value !== "string" || value.length === 0) return null;
  const t = Date.parse(value);
  return Number.isFinite(t) ? t : null;
}

function resolveAuthorKey(author) {
  if (!author || typeof author !== "object") return null;
  if (typeof author.email === "string" && author.email.trim().length > 0) {
    return { key: author.email.trim().toLowerCase(), displayName: author.email.trim() };
  }
  if (typeof author.login === "string" && author.login.trim().length > 0) {
    return { key: author.login.trim().toLowerCase(), displayName: author.login.trim() };
  }
  if (typeof author.name === "string" && author.name.trim().length > 0) {
    return { key: author.name.trim().toLowerCase(), displayName: author.name.trim() };
  }
  return null;
}

function countUniqueAuthors(commits, opts) {
  const options = opts && typeof opts === "object" ? opts : {};
  const lookbackDays = Number.isFinite(options.lookbackDays) && options.lookbackDays > 0
    ? options.lookbackDays
    : DEFAULT_LOOKBACK_DAYS;
  const minCommitsPerAuthor = Number.isFinite(options.minCommitsPerAuthor) && options.minCommitsPerAuthor > 0
    ? options.minCommitsPerAuthor
    : 1;
  const nowMs = (() => {
    if (options.now instanceof Date) return options.now.getTime();
    if (typeof options.now === "number" && Number.isFinite(options.now)) return options.now;
    if (typeof options.now === "string") {
      const t = Date.parse(options.now);
      if (Number.isFinite(t)) return t;
    }
    return Date.now();
  })();

  const windowEndMs = nowMs;
  const windowStartMs = nowMs - lookbackDays * MS_PER_DAY;
  const list = Array.isArray(commits) ? commits : [];

  const groups = new Map();
  for (const commit of list) {
    if (!commit || typeof commit !== "object") continue;
    const ts = safeParseTimestamp(commit.authoredDate);
    if (ts === null) continue;
    if (ts < windowStartMs || ts > windowEndMs) continue;
    const resolved = resolveAuthorKey(commit.author);
    if (!resolved) continue;
    const existing = groups.get(resolved.key);
    if (existing) {
      existing.commitCount += 1;
      if (ts < existing.firstAtMs) existing.firstAtMs = ts;
      if (ts > existing.lastAtMs) existing.lastAtMs = ts;
    } else {
      groups.set(resolved.key, {
        key: resolved.key,
        displayName: resolved.displayName,
        commitCount: 1,
        firstAtMs: ts,
        lastAtMs: ts
      });
    }
  }

  const authorDetails = [];
  for (const entry of groups.values()) {
    if (entry.commitCount < minCommitsPerAuthor) continue;
    authorDetails.push({
      key: entry.key,
      displayName: entry.displayName,
      commitCount: entry.commitCount,
      firstAt: new Date(entry.firstAtMs).toISOString(),
      lastAt: new Date(entry.lastAtMs).toISOString()
    });
  }
  authorDetails.sort((a, b) => {
    if (b.commitCount !== a.commitCount) return b.commitCount - a.commitCount;
    return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
  });

  return {
    uniqueAuthors: authorDetails.length,
    authorDetails,
    windowStart: new Date(windowStartMs).toISOString(),
    windowEnd: new Date(windowEndMs).toISOString()
  };
}

function filterActiveAdopters(adopterImplementations, windowStartMs, windowEndMs) {
  const list = Array.isArray(adopterImplementations) ? adopterImplementations : [];
  const seen = new Map();
  for (const entry of list) {
    if (!entry || typeof entry !== "object") continue;
    const repo = typeof entry.repo === "string" ? entry.repo.trim() : "";
    const fid = typeof entry.fid === "string" ? entry.fid.trim() : "";
    const key = (repo || fid).toLowerCase();
    if (!key) continue;
    const missionsExecuted = Number.isFinite(entry.missionsExecuted) ? entry.missionsExecuted : 0;
    if (missionsExecuted < 1) continue;
    const lastActiveMs = safeParseTimestamp(entry.lastActiveAt);
    if (lastActiveMs === null) continue;
    if (lastActiveMs < windowStartMs || lastActiveMs > windowEndMs) continue;
    // Dedupe in case the same repo appears twice — keep the most-active one.
    const existing = seen.get(key);
    if (!existing || existing.missionsExecuted < missionsExecuted) {
      seen.set(key, {
        repo: repo || null,
        fid: fid || null,
        lastActiveAt: new Date(lastActiveMs).toISOString(),
        missionsExecuted
      });
    }
  }
  return Array.from(seen.values());
}

function resolveNowMs(opts) {
  if (!opts || typeof opts !== "object") return Date.now();
  if (opts.now instanceof Date) return opts.now.getTime();
  if (typeof opts.now === "number" && Number.isFinite(opts.now)) return opts.now;
  if (typeof opts.now === "string") {
    const t = Date.parse(opts.now);
    if (Number.isFinite(t)) return t;
  }
  return Date.now();
}

function evaluateBusFactor(commits, adopterImplementations, env, opts) {
  const config = loadConfig(env);
  const nowMs = resolveNowMs(opts);
  const windowEndMs = nowMs;
  const windowStartMs = nowMs - config.lookbackDays * MS_PER_DAY;

  const authors = countUniqueAuthors(commits, {
    lookbackDays: config.lookbackDays,
    minCommitsPerAuthor: config.minCommitsPerMaintainer,
    now: nowMs
  });

  const activeAdopters = filterActiveAdopters(
    adopterImplementations,
    windowStartMs,
    windowEndMs
  );

  // Bus factor = independent commit authors + independent active adopters.
  // We treat them as additive because each represents an independent "hand"
  // on the code path — a maintainer who could keep it alive, or a downstream
  // running it in production who would notice if it broke.
  const busFactor = authors.uniqueAuthors + activeAdopters.length;
  const ok = busFactor >= config.minMaintainers;

  const result = {
    ok,
    busFactor,
    minRequired: config.minMaintainers,
    commitAuthors: {
      uniqueAuthors: authors.uniqueAuthors,
      authorDetails: authors.authorDetails
    },
    adopters: {
      uniqueCount: activeAdopters.length,
      activeAdopters
    }
  };
  if (!ok) result.reason = "too_few_maintainers";
  return result;
}

function assertBusFactorMet(commits, adopterImplementations, env, opts) {
  const evaluation = evaluateBusFactor(commits, adopterImplementations, env, opts);
  if (!evaluation.ok) {
    const err = new Error(
      "bus-factor: bus-factor not met (" +
        evaluation.busFactor +
        " < " +
        evaluation.minRequired +
        "; " +
        evaluation.commitAuthors.uniqueAuthors +
        " commit author(s), " +
        evaluation.adopters.uniqueCount +
        " active adopter(s))"
    );
    err.code = "BUS_FACTOR_NOT_MET";
    err.details = evaluation;
    throw err;
  }
  return evaluation;
}

function summarizeBusFactor(commits, adopterImplementations, env, opts) {
  let evaluation;
  try {
    evaluation = evaluateBusFactor(commits, adopterImplementations, env, opts);
  } catch (err) {
    // loadConfig may throw on bad env; for the dashboard surface we still
    // want to return a usable shape rather than blowing up the caller.
    return {
      busFactor: 0,
      minRequired: DEFAULT_MIN_MAINTAINERS,
      ok: false,
      recommendation: "critical",
      commitAuthorCount: 0,
      adopterImplementationCount: 0,
      topContributors: [],
      error: err && err.message ? err.message : "config_error"
    };
  }
  let recommendation;
  if (evaluation.busFactor < evaluation.minRequired) {
    recommendation = "critical";
  } else if (evaluation.busFactor === evaluation.minRequired) {
    recommendation = "fragile";
  } else {
    recommendation = "ok";
  }
  const topContributors = evaluation.commitAuthors.authorDetails
    .slice(0, 5)
    .map((a) => ({
      displayName: a.displayName,
      commitCount: a.commitCount,
      lastAt: a.lastAt
    }));
  return {
    busFactor: evaluation.busFactor,
    minRequired: evaluation.minRequired,
    ok: evaluation.ok,
    recommendation,
    commitAuthorCount: evaluation.commitAuthors.uniqueAuthors,
    adopterImplementationCount: evaluation.adopters.uniqueCount,
    topContributors
  };
}

module.exports = {
  DEFAULT_LOOKBACK_DAYS,
  DEFAULT_MIN_COMMITS_PER_MAINTAINER,
  DEFAULT_MIN_MAINTAINERS,
  assertBusFactorMet,
  countUniqueAuthors,
  evaluateBusFactor,
  loadConfig,
  summarizeBusFactor
};
