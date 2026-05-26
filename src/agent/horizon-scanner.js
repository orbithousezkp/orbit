"use strict";

// Horizon Scanner — skeleton in dry-run mode. The full spec lives in
// PLAN/SPECS/HORIZON_SCANNER.md. This module wires the five components
// (source registry, fetcher, classifier, drafter, promoter/archiver) into
// a single `runHorizonScan(...)` entry point that can run today against
// injected mock implementations and, post-S-GATE-1 + state.preLaunchVerified,
// against real fetcher/classifier implementations.
//
// Defaults are deliberately inert: the default fetcher returns no items and
// the default classifier rejects everything. A live `runHorizonScan` with
// defaults therefore proposes nothing — the blast radius is zero until an
// owner wires real implementations under approval. (Same posture as
// buyback.js and revenue-explorer.js.)

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const SOURCES_PATH = "memory/horizon-sources.json";
const CANDIDATES_PATH = "memory/horizon-candidates.json";
const CONFIG_PATH = "memory/horizon-config.json";
const CANDIDATES_DIR = "PLAN/SPECS/CANDIDATES";
const ARCHIVE_DIR = "PLAN/SPECS/ARCHIVE";
const DRY_RUN_DIR = "runtime/horizon/dry";

const SOURCES_SCHEMA = "orbit-horizon-sources/1";
const CANDIDATES_SCHEMA = "orbit-horizon-candidates/1";
const CONFIG_SCHEMA = "orbit-horizon-config/1";

const ALLOWED_SOURCE_TYPES = new Set([
  "rss",
  "github_search",
  "federation_capability"
]);

const VALID_CURRENTS = new Set([
  "autonomy",
  "treasury",
  "governance",
  "identity",
  "federation",
  "adoption",
  "research",
  "revenue",
  "operations",
  "public"
]);

const VALID_RELEVANCE = new Set(["high", "medium", "low", "none"]);

const DEFAULT_CONFIG = {
  schema: CONFIG_SCHEMA,
  scanCadenceHours: 24,
  maxItemsPerScan: 50,
  maxCandidatesPerScan: 5,
  archiveAfterCycles: 90,
  staleAfterCycles: 30,
  maxConsecutiveSourceFailures: 5,
  classifierModel: "haiku",
  drafterModel: "sonnet",
  castOnArchive: false,
  castOnPromote: true,
  dryRun: true
};

function readJson(filePath, fallback) {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw);
  } catch (e) {
    if (e.code === "ENOENT") return fallback;
    throw e;
  }
}

function writeJson(filePath, value) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n");
}

function loadSources(repoRoot) {
  const filePath = path.join(repoRoot, SOURCES_PATH);
  const record = readJson(filePath, { schema: SOURCES_SCHEMA, sources: [] });
  if (!record || typeof record !== "object") {
    return { schema: SOURCES_SCHEMA, sources: [] };
  }
  if (!Array.isArray(record.sources)) record.sources = [];
  if (record.schema !== SOURCES_SCHEMA) record.schema = SOURCES_SCHEMA;
  return record;
}

function saveSources(repoRoot, record) {
  writeJson(path.join(repoRoot, SOURCES_PATH), record);
}

function loadCandidates(repoRoot) {
  const filePath = path.join(repoRoot, CANDIDATES_PATH);
  const record = readJson(filePath, { schema: CANDIDATES_SCHEMA, candidates: [] });
  if (!record || typeof record !== "object") {
    return { schema: CANDIDATES_SCHEMA, candidates: [] };
  }
  if (!Array.isArray(record.candidates)) record.candidates = [];
  if (record.schema !== CANDIDATES_SCHEMA) record.schema = CANDIDATES_SCHEMA;
  return record;
}

function saveCandidates(repoRoot, record) {
  writeJson(path.join(repoRoot, CANDIDATES_PATH), record);
}

function loadConfig(repoRoot) {
  const filePath = path.join(repoRoot, CONFIG_PATH);
  const record = readJson(filePath, DEFAULT_CONFIG);
  // Merge with defaults so missing fields don't crash callers; defaults win
  // only when the file omits the field, never when it explicitly sets it.
  return { ...DEFAULT_CONFIG, ...(record || {}), schema: CONFIG_SCHEMA };
}

// Validate a single source record. Returns null if invalid. Caller decides
// whether to drop or surface the issue.
function validateSource(source) {
  if (!source || typeof source !== "object") return null;
  if (typeof source.id !== "string" || !source.id) return null;
  if (!ALLOWED_SOURCE_TYPES.has(source.type)) return null;
  if (typeof source.url !== "string" || !source.url) return null;
  if (!Array.isArray(source.classifyTo)) return null;
  const classifyTo = source.classifyTo.filter((c) => VALID_CURRENTS.has(c));
  if (classifyTo.length === 0) return null;
  return {
    id: source.id,
    type: source.type,
    url: source.url,
    classifyTo,
    enabled: Boolean(source.enabled),
    lastFetchedAt: source.lastFetchedAt || null,
    lastFetchedHash: source.lastFetchedHash || null,
    fetchCadenceHours: Number.isFinite(source.fetchCadenceHours)
      ? source.fetchCadenceHours
      : 24,
    consecutiveFailures: Number.isFinite(source.consecutiveFailures)
      ? source.consecutiveFailures
      : 0
  };
}

function getEnabledSources(sourcesRecord) {
  const list = Array.isArray(sourcesRecord && sourcesRecord.sources)
    ? sourcesRecord.sources
    : [];
  return list.map(validateSource).filter(Boolean).filter((s) => s.enabled);
}

// Default fetcher: returns nothing. Real implementation is wired later
// (post-S-GATE-1) and supplied by run.js via the deps argument.
async function defaultFetcher(/* source */) {
  return [];
}

// Default classifier: rejects everything. Real implementation is an LLM
// call that returns the structured shape documented in the spec §3c.
async function defaultClassifier(/* item, source, currentsList */) {
  return {
    relevance: "none",
    primaryCurrent: null,
    secondaryCurrents: [],
    rationale: "default classifier rejects all items",
    candidateSpecOutline: null
  };
}

// Validate classifier output shape. Spec §3c says malformed output ->
// shelve to runtime/horizon/<sourceId>/rejected/. Here we just return
// false; caller logs the rejection.
function isValidClassifierOutput(out) {
  if (!out || typeof out !== "object") return false;
  if (!VALID_RELEVANCE.has(out.relevance)) return false;
  if (out.relevance === "high" || out.relevance === "medium") {
    if (!VALID_CURRENTS.has(out.primaryCurrent)) return false;
    if (!out.candidateSpecOutline || typeof out.candidateSpecOutline !== "object") return false;
    if (typeof out.candidateSpecOutline.title !== "string") return false;
  }
  return true;
}

function contentHash(value) {
  const s = typeof value === "string" ? value : JSON.stringify(value);
  return "0x" + crypto.createHash("sha256").update(s).digest("hex");
}

function slugify(title) {
  return String(title || "candidate")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || "candidate";
}

function isoDate(now) {
  return (now instanceof Date ? now : new Date()).toISOString().slice(0, 10);
}

// Pre-check candidate spec is not a duplicate. Compares against
// horizon-candidates.json entries (all statuses) by content hash. Used
// before drafting so the scanner doesn't churn on the same RSS item.
function isDuplicate(candidatesRecord, sourceContentHash) {
  const list = Array.isArray(candidatesRecord && candidatesRecord.candidates)
    ? candidatesRecord.candidates
    : [];
  return list.some((c) => c && c.sourceContentHash === sourceContentHash);
}

// Build the candidate spec body. Pure function (no I/O). The drafter
// writes the return value of this function to disk.
function buildCandidateSpecBody(classification, item, source, now) {
  const outline = classification.candidateSpecOutline || {};
  const title = outline.title || "Candidate spec";
  const purpose = outline.purpose || "(classifier did not supply a purpose)";
  const star = outline.northStarConnection || "(no north-star connection supplied)";
  const killCriteria = Array.isArray(outline.killCriteria) ? outline.killCriteria : [];
  const date = isoDate(now);

  return [
    `# CANDIDATE: ${title}`,
    "",
    `> Status: **candidate — not yet promoted**. Drafted by HORIZON_SCANNER on ${date}.`,
    `> Source: \`${source.id}\` (${source.type}). Content hash: \`${contentHash(item)}\`.`,
    `> Primary current: \`${classification.primaryCurrent}\`. Secondary: ${
      (classification.secondaryCurrents || []).map((c) => `\`${c}\``).join(", ") || "_none_"
    }.`,
    "",
    "## 1. Purpose",
    "",
    purpose,
    "",
    "## 2. North-star connection",
    "",
    star,
    "",
    "## 3. Kill criteria (proposed)",
    "",
    killCriteria.length
      ? killCriteria.map((k) => `- ${k}`).join("\n")
      : "_(classifier did not propose kill criteria — quorum should require some before promotion)_",
    "",
    "## 4. Provenance",
    "",
    "- Source URL: " + source.url,
    "- Item title: " + (item.title || "_untitled_"),
    "- Item URL: " + (item.url || "_no url_"),
    "- Fetched at: " + (item.fetchedAt || "_unknown_"),
    "",
    "## 5. Classifier rationale",
    "",
    classification.rationale || "_(classifier did not supply a rationale)_",
    "",
    "## 6. Next steps for the quorum",
    "",
    "1. Confirm the proposed primary current is correct.",
    "2. Verify the proposal does not break any immutable principle (FOREVER_ROADMAP.md §2).",
    "3. Identify at least one adopter or current that needs this capability.",
    "4. Refine or replace the kill criteria.",
    "5. If promoted, move this file to `PLAN/SPECS/` and assign an S-XXX session ID.",
    "",
    "_If this candidate sits in `CANDIDATES/` longer than the configured archive window, the scanner moves it to `PLAN/SPECS/ARCHIVE/`. Revival is permitted — see HORIZON_SCANNER spec §4._",
    ""
  ].join("\n");
}

// Drafter: writes the candidate spec file + appends a registry entry to
// horizon-candidates.json. Respects dryRun: in dry-run, writes to
// runtime/horizon/dry/ instead of PLAN/SPECS/CANDIDATES/ and does NOT
// touch horizon-candidates.json. Returns the registry entry that would be
// (or was) written.
function draftCandidate(repoRoot, classification, item, source, options = {}) {
  const config = options.config || loadConfig(repoRoot);
  const now = options.now instanceof Date ? options.now : new Date();
  const sourceContentHash = contentHash(item);
  const slug = slugify(classification.candidateSpecOutline.title);
  const dateStr = isoDate(now);
  const id = "hc-" + dateStr.replace(/-/g, "") + "-" + sourceContentHash.slice(2, 10);
  const filePath = config.dryRun
    ? path.join(DRY_RUN_DIR, dateStr + "-" + slug + ".md")
    : path.join(CANDIDATES_DIR, dateStr + "-" + slug + ".md");

  const body = buildCandidateSpecBody(classification, item, source, now);
  const absPath = path.join(repoRoot, filePath);
  if (!fs.existsSync(path.dirname(absPath))) {
    fs.mkdirSync(path.dirname(absPath), { recursive: true });
  }
  fs.writeFileSync(absPath, body);

  const ageOutAt = new Date(now.getTime() + (config.archiveAfterCycles || 90) * 30 * 60_000)
    .toISOString();

  const entry = {
    id,
    slug,
    sourceId: source.id,
    sourceContentHash,
    primaryCurrent: classification.primaryCurrent,
    secondaryCurrents: classification.secondaryCurrents || [],
    status: "pending",
    filePath,
    issueNumber: null,
    issueUrl: null,
    proposedAt: now.toISOString(),
    ageOutAt,
    lifecycleHistory: [
      {
        ts: now.toISOString(),
        from: null,
        to: "pending",
        actor: "scanner",
        evidence: "classifier output hash " + contentHash(classification)
      }
    ]
  };

  if (config.dryRun) {
    // Dry-run: do NOT touch the real candidates registry. Just return the
    // entry so the caller can inspect what would have been written.
    return { entry, written: true, dryRun: true, filePath: absPath };
  }

  const record = options.candidatesRecord || loadCandidates(repoRoot);
  record.candidates.push(entry);
  saveCandidates(repoRoot, record);
  return { entry, written: true, dryRun: false, filePath: absPath };
}

// Promoter/archiver: tick the lifecycle of every pending candidate.
// Caller passes the cycle's effective `now`. Returns a summary of what
// would change. In dry-run, makes no filesystem moves; otherwise moves
// aged-out candidate files from CANDIDATES_DIR -> ARCHIVE_DIR and updates
// the registry.
function tickLifecycle(repoRoot, options = {}) {
  const config = options.config || loadConfig(repoRoot);
  const now = options.now instanceof Date ? options.now : new Date();
  const record = options.candidatesRecord || loadCandidates(repoRoot);
  const summary = { archived: [], promoted: [], stillPending: 0, dryRun: config.dryRun };

  for (const c of record.candidates) {
    if (!c || c.status !== "pending") continue;
    const ageOut = c.ageOutAt ? Date.parse(c.ageOutAt) : NaN;
    if (Number.isFinite(ageOut) && ageOut <= now.getTime()) {
      summary.archived.push(c.id);
      if (!config.dryRun) {
        c.status = "archived";
        c.lifecycleHistory.push({
          ts: now.toISOString(),
          from: "pending",
          to: "archived",
          actor: "scanner",
          evidence: "aged out at " + c.ageOutAt
        });
        const from = path.join(repoRoot, c.filePath);
        const archivePath = path.join(ARCHIVE_DIR, path.basename(c.filePath));
        const to = path.join(repoRoot, archivePath);
        try {
          if (!fs.existsSync(path.dirname(to))) {
            fs.mkdirSync(path.dirname(to), { recursive: true });
          }
          if (fs.existsSync(from)) fs.renameSync(from, to);
          c.filePath = archivePath;
        } catch (e) {
          // File move failed — surface in summary; do not corrupt registry.
          summary.archived.pop();
          summary.errors = summary.errors || [];
          summary.errors.push({ id: c.id, op: "archive", error: e.message });
        }
      }
    } else {
      summary.stillPending += 1;
    }
  }

  if (!config.dryRun) saveCandidates(repoRoot, record);
  return summary;
}

// The full scan loop. Loads sources, calls fetcher per enabled source,
// calls classifier per item, drafts candidates for high-relevance items,
// then ticks the lifecycle. Fetcher and classifier are dependency-injected
// so tests can exercise the loop without HTTP or LLM calls and so a real
// LLM-backed classifier can be wired post-S-GATE-1.
async function runHorizonScan(repoRoot, deps = {}, options = {}) {
  const fetcher = deps.fetcher || defaultFetcher;
  const classifier = deps.classifier || defaultClassifier;
  const config = options.config || loadConfig(repoRoot);
  const now = options.now instanceof Date ? options.now : new Date();
  const sources = getEnabledSources(loadSources(repoRoot));
  const candidatesRecord = loadCandidates(repoRoot);

  const summary = {
    dryRun: Boolean(config.dryRun),
    enabledSources: sources.length,
    fetchedItems: 0,
    classifiedItems: 0,
    candidatesDrafted: 0,
    candidatesSkippedDuplicate: 0,
    classifierRejections: 0,
    candidates: []
  };

  for (const source of sources) {
    let items = [];
    try {
      items = (await fetcher(source, { now })) || [];
    } catch (e) {
      summary.errors = summary.errors || [];
      summary.errors.push({ sourceId: source.id, op: "fetch", error: e.message });
      continue;
    }
    items = items.slice(0, config.maxItemsPerScan);
    for (const item of items) {
      summary.fetchedItems += 1;
      let cls;
      try {
        cls = await classifier(item, source, Array.from(VALID_CURRENTS));
      } catch (e) {
        summary.errors = summary.errors || [];
        summary.errors.push({ sourceId: source.id, op: "classify", error: e.message });
        continue;
      }
      summary.classifiedItems += 1;
      if (!isValidClassifierOutput(cls)) {
        summary.classifierRejections += 1;
        continue;
      }
      if (cls.relevance !== "high") continue;
      const hash = contentHash(item);
      if (isDuplicate(candidatesRecord, hash)) {
        summary.candidatesSkippedDuplicate += 1;
        continue;
      }
      const drafted = draftCandidate(repoRoot, cls, item, source, {
        config,
        now,
        candidatesRecord
      });
      summary.candidatesDrafted += 1;
      summary.candidates.push({
        id: drafted.entry.id,
        slug: drafted.entry.slug,
        primaryCurrent: drafted.entry.primaryCurrent,
        filePath: drafted.entry.filePath,
        dryRun: drafted.dryRun
      });
      if (summary.candidatesDrafted >= config.maxCandidatesPerScan) break;
    }
    if (summary.candidatesDrafted >= config.maxCandidatesPerScan) break;
  }

  const lifecycle = tickLifecycle(repoRoot, { config, now, candidatesRecord });
  summary.lifecycle = lifecycle;
  return summary;
}

module.exports = {
  // schemas
  SOURCES_SCHEMA,
  CANDIDATES_SCHEMA,
  CONFIG_SCHEMA,
  // constants
  VALID_CURRENTS,
  ALLOWED_SOURCE_TYPES,
  DEFAULT_CONFIG,
  // loaders
  loadSources,
  saveSources,
  loadCandidates,
  saveCandidates,
  loadConfig,
  // helpers
  validateSource,
  getEnabledSources,
  isValidClassifierOutput,
  contentHash,
  slugify,
  isDuplicate,
  buildCandidateSpecBody,
  // lifecycle
  draftCandidate,
  tickLifecycle,
  runHorizonScan,
  // defaults (exported so callers can compose with real impls later)
  defaultFetcher,
  defaultClassifier
};
