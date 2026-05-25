"use strict";

// S-REVENUE-1 / PLAN/SPECS/REVENUE_EXPLORER.md §3c — Market-signal collector.
//
// Append-only journal of "what's happening in the market" that the revenue
// experiments framework reads when evaluating kill criteria and graduation
// readiness. Records ONE LINE of JSON per signal observation to
// `memory/market-signals.jsonl`. The file is the audit trail: nothing is
// ever rewritten or deleted, only rotated when it gets large.
//
// Read-only against the outside world (RPC handle state, public well-known
// surfaces, public GitHub REST). Best-effort end-to-end: a failed collector
// must NEVER cause the cycle to fail. Callers receive { collected, attempted }
// from collectAllSignals() and decide whether to log; the cycle continues
// either way.
//
// Three v1 kinds:
//   - weth_inflow_24h          — Fee Receive Safe delta vs. weekStart snapshot
//   - adopter_ai_spend_by_bucket — pulled from each adopter's public dashboard
//   - issue_reaction_index     — per-repo reaction score across mothership +
//                                verified adopter repos
//
// Schema rules (from §7):
//   { "ts": "ISO-8601", "kind": "<kind>", ...payload }
//
// Anti-pattern: do NOT add per-stream consumer hooks here. The collector
// emits raw observations; consumers (e.g. revenue-streams.js, kill-criteria
// evaluators) read from `readSignals()` and aggregate on their own schedule.

const path = require("path");
const fs = require("fs");
const { appendSafeTextFile, assertNoSymlinkPath } = require("./safety");
const treasurySweep = require("./treasury-sweep");
const adopters = require("./adopters");

const SIGNAL_KINDS = [
  "weth_inflow_24h",
  "adopter_ai_spend_by_bucket",
  "issue_reaction_index"
];

const SIGNALS_PATH = "memory/market-signals.jsonl";
const MAX_SIGNAL_FILE_LINES = 10000; // soft rotation cap (~years at 1/day per kind)

const LABEL_WEIGHTS = {
  wanted: 3,
  enhancement: 2,
  bug: 1
};
const DEFAULT_LABEL_WEIGHT = 1;

function isValidKind(kind) {
  return typeof kind === "string" && SIGNAL_KINDS.indexOf(kind) >= 0;
}

function countLines(text) {
  if (!text) return 0;
  let count = 0;
  let i = -1;
  while ((i = text.indexOf("\n", i + 1)) >= 0) count += 1;
  // Trailing partial line (no newline at EOF) still counts.
  if (text.length > 0 && text.charCodeAt(text.length - 1) !== 0x0a) count += 1;
  return count;
}

function readFileTextOrEmpty(absolutePath) {
  try {
    return fs.readFileSync(absolutePath, "utf-8");
  } catch (err) {
    if (err && err.code === "ENOENT") return "";
    throw err;
  }
}

function rotateIfTooLarge(repoRoot) {
  // Resolve via safety so we honor the same symlink + path-escape checks the
  // rest of the codebase uses. The rotation suffix is "<ISO-date>.gz" by
  // spec — no real gzip happens; the suffix is a human-triage marker.
  const { resolved } = assertNoSymlinkPath(repoRoot, SIGNALS_PATH);
  let lines = 0;
  try {
    const text = readFileTextOrEmpty(resolved);
    lines = countLines(text);
  } catch {
    return { rotated: false };
  }
  // Soft cap: rotate the moment we've reached the cap so the new record
  // about to be appended lands in a fresh file rather than pushing the
  // total over the limit. Using >= (vs. >) means callers can reliably
  // trigger rotation by seeding exactly MAX_SIGNAL_FILE_LINES lines.
  if (lines < MAX_SIGNAL_FILE_LINES) return { rotated: false, lines };
  const isoDate = new Date().toISOString().replace(/[:.]/g, "-");
  const rotatedRel = `${SIGNALS_PATH}.${isoDate}.gz`;
  const { resolved: rotatedAbs } = assertNoSymlinkPath(repoRoot, rotatedRel);
  try {
    fs.renameSync(resolved, rotatedAbs);
    return { rotated: true, path: rotatedRel, lines };
  } catch (err) {
    return { rotated: false, error: err && err.message ? err.message : String(err) };
  }
}

function recordSignal(repoRoot, signal) {
  if (!signal || typeof signal !== "object") {
    return { ok: false, error: "signal must be an object" };
  }
  if (!isValidKind(signal.kind)) {
    return { ok: false, error: `unknown signal kind: ${signal.kind}` };
  }
  const ts = typeof signal.ts === "string" && signal.ts.length > 0
    ? signal.ts
    : new Date().toISOString();
  const record = { ts, ...signal, kind: signal.kind };
  if (record !== signal) record.ts = ts;
  // Rotate FIRST so the new line lands in the fresh file (not the one
  // about to be moved aside).
  try {
    rotateIfTooLarge(repoRoot);
  } catch {
    // Rotation failure is non-fatal; we still want the observation written.
  }
  let line;
  try {
    line = JSON.stringify(record) + "\n";
  } catch (err) {
    return { ok: false, error: `serialize_failed: ${err.message}` };
  }
  try {
    const { normalized } = appendSafeTextFile(repoRoot, SIGNALS_PATH, line);
    return { ok: true, path: normalized };
  } catch (err) {
    return { ok: false, error: err && err.message ? err.message : String(err) };
  }
}

function readSignals(repoRoot, options) {
  const opts = options && typeof options === "object" ? options : {};
  let text = "";
  try {
    const { resolved } = assertNoSymlinkPath(repoRoot, SIGNALS_PATH);
    text = readFileTextOrEmpty(resolved);
  } catch (err) {
    // Path-escape / symlink rejection is loud; missing file is silent.
    if (err && err.code === "ENOENT") return [];
    throw err;
  }
  if (!text) return [];
  const sinceMs = (typeof opts.since === "string" && opts.since.length > 0)
    ? Date.parse(opts.since)
    : null;
  const wantKind = typeof opts.kind === "string" && opts.kind.length > 0 ? opts.kind : null;
  const limit = Number.isFinite(opts.limit) && opts.limit > 0 ? Math.floor(opts.limit) : null;
  const out = [];
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i];
    if (!raw) continue;
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      // Log to stderr so operators see corruption without blowing up the
      // caller. Continue past malformed lines.
      try { console.warn(`market-signals: skip malformed line ${i + 1}: ${err.message}`); } catch {}
      continue;
    }
    if (!parsed || typeof parsed !== "object") continue;
    if (wantKind && parsed.kind !== wantKind) continue;
    if (sinceMs !== null && Number.isFinite(sinceMs)) {
      const ts = Date.parse(parsed.ts);
      if (!Number.isFinite(ts) || ts < sinceMs) continue;
    }
    out.push(parsed);
    if (limit !== null && out.length >= limit) break;
  }
  return out;
}

function summarizeSignals(repoRoot, options) {
  const opts = options && typeof options === "object" ? options : {};
  const kind = opts.kind;
  const signals = readSignals(repoRoot, { kind, since: opts.since });
  if (signals.length === 0) {
    return { kind, samples: 0, latest: null };
  }
  const latest = signals[signals.length - 1];
  if (kind === "weth_inflow_24h") {
    let total = 0n;
    for (const s of signals) {
      try { total += BigInt(s.valueWei || "0"); } catch {}
    }
    return { kind, samples: signals.length, totalWei: total.toString(), latest };
  }
  if (kind === "adopter_ai_spend_by_bucket") {
    const seenAdopters = new Set();
    const byBucket = {};
    for (const s of signals) {
      const list = Array.isArray(s.adopters) ? s.adopters : [];
      for (const a of list) {
        if (a && typeof a.fid === "string") seenAdopters.add(a.fid);
        const bb = a && a.byBucket && typeof a.byBucket === "object" ? a.byBucket : {};
        for (const [bucket, amount] of Object.entries(bb)) {
          const n = Number(amount);
          if (!Number.isFinite(n)) continue;
          byBucket[bucket] = (byBucket[bucket] || 0) + n;
        }
      }
    }
    return { kind, samples: signals.length, adopterCount: seenAdopters.size, byBucket, latest };
  }
  if (kind === "issue_reaction_index") {
    const repoSet = new Set();
    let totalReactions = 0;
    for (const s of signals) {
      const list = Array.isArray(s.repos) ? s.repos : [];
      for (const r of list) {
        if (r && typeof r.repo === "string") repoSet.add(r.repo);
        if (r && Number.isFinite(r.score)) totalReactions += r.score;
      }
    }
    return { kind, samples: signals.length, repoCount: repoSet.size, totalReactions, latest };
  }
  return { kind, samples: signals.length, latest };
}

async function collectWethInflow24h(config, env, state) {
  const snap = treasurySweep.getFeeReceiveSafeBalanceSnapshot(state);
  if (!snap || snap.currentWei === null || snap.baselineWei === null) {
    return null;
  }
  let delta;
  try {
    delta = BigInt(snap.currentWei) - BigInt(snap.baselineWei);
  } catch {
    return null;
  }
  if (delta < 0n) delta = 0n;
  const now = new Date().toISOString();
  return {
    kind: "weth_inflow_24h",
    valueWei: delta.toString(),
    fromTs: snap.weekStartedAt || null,
    toTs: now,
    safes: env && env.ORBIT_TREASURY_SAFE ? [env.ORBIT_TREASURY_SAFE] : []
  };
}

function normalizeUrlBase(url) {
  if (typeof url !== "string") return null;
  const trimmed = url.replace(/\/+$/, "");
  return trimmed.length > 0 ? trimmed : null;
}

function extractAdopterBuckets(dashboardPayload) {
  // Best-effort: walk a few plausible shapes. The S-ADP-1 dashboard schema
  // does not yet pin an AI-spend slice; we accept anything that looks like
  // { byBucket: { code:..., research:..., ops:... } } or
  // { aiSpend: { byBucket: {...} } } or { ai: { byBucket: {...} } }.
  if (!dashboardPayload || typeof dashboardPayload !== "object") return null;
  if (dashboardPayload.byBucket && typeof dashboardPayload.byBucket === "object") {
    return dashboardPayload.byBucket;
  }
  if (dashboardPayload.aiSpend && typeof dashboardPayload.aiSpend === "object"
      && dashboardPayload.aiSpend.byBucket && typeof dashboardPayload.aiSpend.byBucket === "object") {
    return dashboardPayload.aiSpend.byBucket;
  }
  if (dashboardPayload.ai && typeof dashboardPayload.ai === "object"
      && dashboardPayload.ai.byBucket && typeof dashboardPayload.ai.byBucket === "object") {
    return dashboardPayload.ai.byBucket;
  }
  return null;
}

async function collectAdopterAiSpend(config, deps) {
  // deps = { adoptersState, fetchJson }
  // adoptersState is the parsed memory/adopters-registry.json (or null).
  // fetchJson is an async (url) => Promise<object>. Injected so tests don't
  // hit the network and so the real cycle can reuse run.js' fetch helper.
  const adoptersState = deps && deps.adoptersState ? deps.adoptersState : null;
  const fetchJson = deps && typeof deps.fetchJson === "function" ? deps.fetchJson : null;
  const list = adopters.listAdoptersForSignalCollection(adoptersState);
  if (!list || list.length === 0) return null;
  if (!fetchJson) return null;
  const collected = [];
  for (const a of list) {
    if (!a || !a.publicUrl) continue;
    const base = normalizeUrlBase(a.publicUrl);
    if (!base) continue;
    const dashboardUrl = `${base}/dashboard.json`;
    let payload;
    try {
      payload = await fetchJson(dashboardUrl);
    } catch (err) {
      // Per spec: skip on individual fetch failure, continue.
      try { console.warn(`market-signals: adopter dashboard fetch failed for ${a.repo}: ${err.message}`); } catch {}
      continue;
    }
    const byBucket = extractAdopterBuckets(payload);
    if (!byBucket) continue;
    collected.push({ fid: a.fid, repo: a.repo, byBucket });
  }
  if (collected.length === 0) return null;
  return {
    kind: "adopter_ai_spend_by_bucket",
    adopters: collected
  };
}

function repoKey(owner, repo) {
  return `${owner}/${repo}`;
}

function splitRepoString(full) {
  if (typeof full !== "string") return null;
  const parts = full.split("/");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  return { owner: parts[0], repo: parts[1] };
}

function scoreReactionsForRepo(issues) {
  const byLabel = {};
  let score = 0;
  for (const row of issues || []) {
    if (!row || !row.reactions) continue;
    const total = Number(row.reactions.total) || 0;
    const labels = Array.isArray(row.labels) ? row.labels : [];
    let weight = DEFAULT_LABEL_WEIGHT;
    if (labels.length > 0) {
      // Use the maximum-weight label so a "wanted" + "bug" double-tag gets
      // counted at the heavier weight rather than averaged down.
      for (const label of labels) {
        const w = LABEL_WEIGHTS[label] !== undefined ? LABEL_WEIGHTS[label] : DEFAULT_LABEL_WEIGHT;
        if (w > weight) weight = w;
      }
    }
    const contribution = total * weight;
    score += contribution;
    for (const label of labels.length > 0 ? labels : ["_unlabeled"]) {
      byLabel[label] = (byLabel[label] || 0) + total;
    }
  }
  return { score, byLabel };
}

async function collectIssueReactionIndex(config, deps) {
  // deps = { github, adoptersState }
  // github = an object with fetchIssueReactions(owner, repo, opts) per
  // src/agent/github.js. Tests inject a stub.
  const github = deps && deps.github ? deps.github : null;
  const adoptersState = deps && deps.adoptersState ? deps.adoptersState : null;
  if (!github || typeof github.fetchIssueReactions !== "function") return null;

  const targets = [];
  // Mothership repo first.
  const ownRepo = (config && (config.repoFullName || config.githubRepository))
    || (config && config.repoOwner && config.repoName ? `${config.repoOwner}/${config.repoName}` : null);
  const own = splitRepoString(ownRepo);
  if (own) targets.push({ owner: own.owner, repo: own.repo });
  // Then every verified adopter repo.
  const adopterList = adopters.listAdoptersForSignalCollection(adoptersState);
  for (const a of adopterList || []) {
    const parsed = splitRepoString(a && a.repo);
    if (!parsed) continue;
    // De-dupe vs. mothership.
    if (own && parsed.owner === own.owner && parsed.repo === own.repo) continue;
    targets.push({ owner: parsed.owner, repo: parsed.repo });
  }
  if (targets.length === 0) return null;

  const repos = [];
  for (const t of targets) {
    let result;
    try {
      result = await github.fetchIssueReactions(t.owner, t.repo, { state: "open", perPage: 50 });
    } catch (err) {
      try { console.warn(`market-signals: reactions fetch failed for ${repoKey(t.owner, t.repo)}: ${err.message}`); } catch {}
      continue;
    }
    if (!result || result.ok === false) continue;
    const issues = Array.isArray(result.issues) ? result.issues : [];
    const { score, byLabel } = scoreReactionsForRepo(issues);
    repos.push({ repo: repoKey(t.owner, t.repo), score, byLabel });
  }
  if (repos.length === 0) return null;
  return {
    kind: "issue_reaction_index",
    repos
  };
}

async function collectAllSignals(config, env, state, github, extraDeps) {
  // Best-effort fan-out. We use Promise.allSettled so one failing collector
  // doesn't short-circuit the others. Every recorded signal is stamped
  // server-side; collectors that return null are dropped silently.
  const deps = extraDeps && typeof extraDeps === "object" ? extraDeps : {};
  const adoptersState = deps.adoptersState !== undefined ? deps.adoptersState : null;
  const fetchJson = typeof deps.fetchJson === "function" ? deps.fetchJson : null;
  const repoRoot = (config && config.repoRoot)
    || (deps && deps.repoRoot)
    || process.cwd();

  const tasks = [
    collectWethInflow24h(config, env, state),
    collectAdopterAiSpend(config, { adoptersState, fetchJson }),
    collectIssueReactionIndex(config, { github, adoptersState })
  ];
  const results = await Promise.allSettled(tasks);
  let collected = 0;
  for (const r of results) {
    if (r.status !== "fulfilled") {
      try { console.warn(`market-signals: collector rejected: ${r.reason && r.reason.message ? r.reason.message : r.reason}`); } catch {}
      continue;
    }
    const signal = r.value;
    if (!signal) continue;
    try {
      const rec = recordSignal(repoRoot, signal);
      if (rec && rec.ok) collected += 1;
      else if (rec && rec.error) {
        try { console.warn(`market-signals: record failed for ${signal.kind}: ${rec.error}`); } catch {}
      }
    } catch (err) {
      try { console.warn(`market-signals: record threw for ${signal.kind}: ${err.message}`); } catch {}
    }
  }
  return { collected, attempted: tasks.length };
}

module.exports = {
  MAX_SIGNAL_FILE_LINES,
  SIGNALS_PATH,
  SIGNAL_KINDS,
  collectAdopterAiSpend,
  collectAllSignals,
  collectIssueReactionIndex,
  collectWethInflow24h,
  readSignals,
  recordSignal,
  summarizeSignals
};
