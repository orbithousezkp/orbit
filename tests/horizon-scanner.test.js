"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  SOURCES_SCHEMA,
  CANDIDATES_SCHEMA,
  CONFIG_SCHEMA,
  VALID_CURRENTS,
  loadSources,
  saveSources,
  loadCandidates,
  saveCandidates,
  loadConfig,
  validateSource,
  getEnabledSources,
  isValidClassifierOutput,
  contentHash,
  isDuplicate,
  buildCandidateSpecBody,
  draftCandidate,
  tickLifecycle,
  runHorizonScan,
  defaultFetcher,
  defaultClassifier
} = require("../src/agent/horizon-scanner");

function tempRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "orbit-horizon-test-"));
  fs.mkdirSync(path.join(dir, "memory"), { recursive: true });
  return dir;
}

function writeFile(repoRoot, rel, content) {
  const abs = path.join(repoRoot, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

function mockItem(overrides = {}) {
  return {
    title: "ERC-7715: Granular session keys",
    url: "https://eips.ethereum.org/EIPS/eip-7715",
    fetchedAt: "2026-05-26T00:00:00.000Z",
    body: "Spec proposes session-key granularity for ERC-4337 wallets.",
    ...overrides
  };
}

function mockSource(overrides = {}) {
  return {
    id: "eip-rss",
    type: "rss",
    url: "https://eips.ethereum.org/all.atom",
    classifyTo: ["identity", "treasury", "governance"],
    enabled: true,
    lastFetchedAt: null,
    lastFetchedHash: null,
    fetchCadenceHours: 24,
    consecutiveFailures: 0,
    ...overrides
  };
}

function mockClassification(overrides = {}) {
  return {
    relevance: "high",
    primaryCurrent: "governance",
    secondaryCurrents: ["identity"],
    rationale: "Session-key granularity directly improves the governance current.",
    candidateSpecOutline: {
      title: "Session-Key Granularity (ERC-7715 Integration)",
      purpose: "Adopt ERC-7715 patterns so Orbit can issue narrowly-scoped delegated keys.",
      northStarConnection: "Governance north star: decisions are gated, narrated, reversible at the right cost.",
      killCriteria: ["if no adopter uses session keys in 6 months", "if ERC-7715 is deprecated"]
    },
    ...overrides
  };
}

// === source registry ===========================================================

test("validateSource accepts a well-formed source", () => {
  const s = validateSource(mockSource());
  assert.ok(s);
  assert.equal(s.id, "eip-rss");
  assert.deepEqual(s.classifyTo, ["identity", "treasury", "governance"]);
  assert.equal(s.enabled, true);
});

test("validateSource rejects unknown source type", () => {
  assert.equal(validateSource(mockSource({ type: "telegram" })), null);
});

test("validateSource rejects when classifyTo has no valid currents", () => {
  assert.equal(validateSource(mockSource({ classifyTo: ["nonsense", "fake"] })), null);
});

test("validateSource rejects empty url", () => {
  assert.equal(validateSource(mockSource({ url: "" })), null);
});

test("validateSource keeps only valid currents and drops the rest", () => {
  const s = validateSource(mockSource({ classifyTo: ["identity", "fake", "governance"] }));
  assert.deepEqual(s.classifyTo, ["identity", "governance"]);
});

test("getEnabledSources filters disabled and malformed", () => {
  const record = {
    schema: SOURCES_SCHEMA,
    sources: [
      mockSource({ id: "a", enabled: true }),
      mockSource({ id: "b", enabled: false }),
      mockSource({ id: "c", type: "bad" }),
      mockSource({ id: "d", enabled: true })
    ]
  };
  const enabled = getEnabledSources(record);
  assert.deepEqual(enabled.map((s) => s.id), ["a", "d"]);
});

// === config + loaders ==========================================================

test("loadConfig returns defaults when memory file absent", () => {
  const repoRoot = tempRepo();
  const cfg = loadConfig(repoRoot);
  assert.equal(cfg.schema, CONFIG_SCHEMA);
  assert.equal(cfg.dryRun, true);
  assert.equal(cfg.scanCadenceHours, 24);
});

test("loadConfig merges defaults with persisted file (file wins where set)", () => {
  const repoRoot = tempRepo();
  writeFile(repoRoot, "memory/horizon-config.json", JSON.stringify({
    schema: CONFIG_SCHEMA,
    scanCadenceHours: 12,
    dryRun: false
  }));
  const cfg = loadConfig(repoRoot);
  assert.equal(cfg.scanCadenceHours, 12);
  assert.equal(cfg.dryRun, false);
  // Default still wins for unset fields.
  assert.equal(cfg.maxItemsPerScan, 50);
});

test("loadSources tolerates missing file", () => {
  const repoRoot = tempRepo();
  const record = loadSources(repoRoot);
  assert.equal(record.schema, SOURCES_SCHEMA);
  assert.deepEqual(record.sources, []);
});

test("loadCandidates tolerates missing file", () => {
  const repoRoot = tempRepo();
  const record = loadCandidates(repoRoot);
  assert.equal(record.schema, CANDIDATES_SCHEMA);
  assert.deepEqual(record.candidates, []);
});

// === content hash + dedupe =====================================================

test("contentHash is deterministic for the same input", () => {
  const a = contentHash(mockItem());
  const b = contentHash(mockItem());
  assert.equal(a, b);
});

test("contentHash differs for different inputs", () => {
  const a = contentHash(mockItem());
  const b = contentHash(mockItem({ title: "Different" }));
  assert.notEqual(a, b);
});

test("isDuplicate detects existing candidate by sourceContentHash", () => {
  const hash = contentHash(mockItem());
  const record = {
    schema: CANDIDATES_SCHEMA,
    candidates: [
      { id: "hc-1", sourceContentHash: hash, status: "pending" }
    ]
  };
  assert.equal(isDuplicate(record, hash), true);
  assert.equal(isDuplicate(record, "0xdeadbeef"), false);
});

test("isDuplicate finds duplicates even when candidate has been archived", () => {
  const hash = contentHash(mockItem());
  const record = {
    schema: CANDIDATES_SCHEMA,
    candidates: [
      { id: "hc-1", sourceContentHash: hash, status: "archived" }
    ]
  };
  // Spec §3a: dedup is across ALL statuses, not just pending — so the
  // scanner doesn't churn on the same item repeatedly.
  assert.equal(isDuplicate(record, hash), true);
});

// === classifier output validation =============================================

test("isValidClassifierOutput accepts a well-formed high-relevance output", () => {
  assert.equal(isValidClassifierOutput(mockClassification()), true);
});

test("isValidClassifierOutput accepts low/none without an outline", () => {
  assert.equal(isValidClassifierOutput({
    relevance: "low",
    primaryCurrent: null,
    secondaryCurrents: [],
    rationale: "borderline",
    candidateSpecOutline: null
  }), true);
  assert.equal(isValidClassifierOutput({
    relevance: "none",
    primaryCurrent: null,
    secondaryCurrents: [],
    rationale: "rejected",
    candidateSpecOutline: null
  }), true);
});

test("isValidClassifierOutput rejects bad relevance value", () => {
  assert.equal(isValidClassifierOutput({
    relevance: "maybe",
    primaryCurrent: "governance",
    candidateSpecOutline: { title: "x" }
  }), false);
});

test("isValidClassifierOutput rejects high relevance without a valid current", () => {
  assert.equal(isValidClassifierOutput(mockClassification({
    primaryCurrent: "nonsense"
  })), false);
});

test("isValidClassifierOutput rejects high relevance without an outline", () => {
  assert.equal(isValidClassifierOutput(mockClassification({
    candidateSpecOutline: null
  })), false);
});

// === buildCandidateSpecBody (pure) ============================================

test("buildCandidateSpecBody includes title, source, primary current, and provenance", () => {
  const body = buildCandidateSpecBody(
    mockClassification(),
    mockItem(),
    mockSource(),
    new Date("2026-05-26T00:00:00Z")
  );
  assert.match(body, /# CANDIDATE: Session-Key Granularity/);
  assert.match(body, /Source: `eip-rss`/);
  assert.match(body, /Primary current: `governance`/);
  assert.match(body, /Source URL: https:\/\/eips\.ethereum\.org/);
  assert.match(body, /HORIZON_SCANNER on 2026-05-26/);
});

test("buildCandidateSpecBody handles missing optional outline fields", () => {
  const minimal = mockClassification({
    candidateSpecOutline: { title: "Bare candidate" }
  });
  const body = buildCandidateSpecBody(minimal, mockItem(), mockSource(), new Date());
  assert.match(body, /# CANDIDATE: Bare candidate/);
  assert.match(body, /classifier did not propose kill criteria/);
});

// === drafter (dry-run) ========================================================

test("draftCandidate in dry-run writes to runtime/horizon/dry and does not touch candidates.json", () => {
  const repoRoot = tempRepo();
  const result = draftCandidate(repoRoot, mockClassification(), mockItem(), mockSource(), {
    config: { ...loadConfig(repoRoot), dryRun: true },
    now: new Date("2026-05-26T00:00:00Z")
  });
  assert.equal(result.dryRun, true);
  assert.equal(result.written, true);
  // The candidate file is written under runtime/horizon/dry/.
  assert.match(result.filePath, /runtime\/horizon\/dry/);
  assert.ok(fs.existsSync(result.filePath));
  // horizon-candidates.json is untouched.
  const candidates = loadCandidates(repoRoot);
  assert.deepEqual(candidates.candidates, []);
});

// === drafter (real run) =======================================================

test("draftCandidate in real run writes to PLAN/SPECS/CANDIDATES and appends to registry", () => {
  const repoRoot = tempRepo();
  const result = draftCandidate(repoRoot, mockClassification(), mockItem(), mockSource(), {
    config: { ...loadConfig(repoRoot), dryRun: false },
    now: new Date("2026-05-26T00:00:00Z")
  });
  assert.equal(result.dryRun, false);
  assert.equal(result.written, true);
  assert.match(result.filePath, /PLAN\/SPECS\/CANDIDATES/);
  assert.ok(fs.existsSync(result.filePath));
  const candidates = loadCandidates(repoRoot);
  assert.equal(candidates.candidates.length, 1);
  assert.equal(candidates.candidates[0].slug, "session-key-granularity-erc-7715-integration");
  assert.equal(candidates.candidates[0].status, "pending");
  assert.equal(candidates.candidates[0].primaryCurrent, "governance");
});

// === lifecycle ticker =========================================================

test("tickLifecycle archives candidates past ageOutAt in real run", () => {
  const repoRoot = tempRepo();
  const filePath = "PLAN/SPECS/CANDIDATES/2026-05-26-test.md";
  writeFile(repoRoot, filePath, "# CANDIDATE: test");
  writeFile(repoRoot, "memory/horizon-candidates.json", JSON.stringify({
    schema: CANDIDATES_SCHEMA,
    candidates: [{
      id: "hc-test-1",
      slug: "test",
      sourceId: "eip-rss",
      sourceContentHash: "0xabc",
      primaryCurrent: "governance",
      secondaryCurrents: [],
      status: "pending",
      filePath,
      issueNumber: null,
      issueUrl: null,
      proposedAt: "2026-01-01T00:00:00Z",
      ageOutAt: "2026-04-01T00:00:00Z", // already past
      lifecycleHistory: [{ ts: "2026-01-01T00:00:00Z", from: null, to: "pending", actor: "scanner", evidence: "test" }]
    }]
  }));

  const summary = tickLifecycle(repoRoot, {
    config: { ...loadConfig(repoRoot), dryRun: false },
    now: new Date("2026-05-26T00:00:00Z")
  });
  assert.deepEqual(summary.archived, ["hc-test-1"]);
  assert.equal(summary.dryRun, false);

  // File was moved to ARCHIVE/.
  const archivePath = path.join(repoRoot, "PLAN/SPECS/ARCHIVE/2026-05-26-test.md");
  assert.ok(fs.existsSync(archivePath), "archived file should exist in ARCHIVE/");
  assert.equal(fs.existsSync(path.join(repoRoot, filePath)), false, "candidate file should be gone from CANDIDATES/");

  // Registry reflects the new state.
  const candidates = loadCandidates(repoRoot);
  assert.equal(candidates.candidates[0].status, "archived");
  assert.match(candidates.candidates[0].filePath, /ARCHIVE/);
});

test("tickLifecycle in dry-run reports archives without moving files", () => {
  const repoRoot = tempRepo();
  const filePath = "PLAN/SPECS/CANDIDATES/2026-05-26-test.md";
  writeFile(repoRoot, filePath, "# CANDIDATE: test");
  writeFile(repoRoot, "memory/horizon-candidates.json", JSON.stringify({
    schema: CANDIDATES_SCHEMA,
    candidates: [{
      id: "hc-test-1",
      sourceContentHash: "0xabc",
      primaryCurrent: "governance",
      status: "pending",
      filePath,
      ageOutAt: "2026-04-01T00:00:00Z",
      lifecycleHistory: []
    }]
  }));

  const summary = tickLifecycle(repoRoot, {
    config: { ...loadConfig(repoRoot), dryRun: true },
    now: new Date("2026-05-26T00:00:00Z")
  });
  assert.deepEqual(summary.archived, ["hc-test-1"]);
  assert.equal(summary.dryRun, true);

  // File is still where it was. Registry is unchanged.
  assert.ok(fs.existsSync(path.join(repoRoot, filePath)));
  const candidates = loadCandidates(repoRoot);
  assert.equal(candidates.candidates[0].status, "pending");
});

test("tickLifecycle leaves not-yet-aged-out candidates as pending", () => {
  const repoRoot = tempRepo();
  writeFile(repoRoot, "memory/horizon-candidates.json", JSON.stringify({
    schema: CANDIDATES_SCHEMA,
    candidates: [{
      id: "hc-fresh",
      sourceContentHash: "0xfresh",
      status: "pending",
      filePath: "PLAN/SPECS/CANDIDATES/2026-05-26-fresh.md",
      ageOutAt: "2027-01-01T00:00:00Z",
      lifecycleHistory: []
    }]
  }));
  const summary = tickLifecycle(repoRoot, {
    config: { ...loadConfig(repoRoot), dryRun: false },
    now: new Date("2026-05-26T00:00:00Z")
  });
  assert.deepEqual(summary.archived, []);
  assert.equal(summary.stillPending, 1);
});

// === runHorizonScan (end-to-end with injected deps) ==========================

test("runHorizonScan with default deps produces nothing", async () => {
  const repoRoot = tempRepo();
  const summary = await runHorizonScan(repoRoot);
  assert.equal(summary.enabledSources, 0);
  assert.equal(summary.fetchedItems, 0);
  assert.equal(summary.candidatesDrafted, 0);
});

test("runHorizonScan with mock fetcher + mock classifier drafts a candidate in dry-run", async () => {
  const repoRoot = tempRepo();
  saveSources(repoRoot, {
    schema: SOURCES_SCHEMA,
    sources: [mockSource()]
  });
  const fetcher = async () => [mockItem()];
  const classifier = async () => mockClassification();
  const summary = await runHorizonScan(repoRoot, { fetcher, classifier }, {
    now: new Date("2026-05-26T00:00:00Z")
  });
  assert.equal(summary.enabledSources, 1);
  assert.equal(summary.fetchedItems, 1);
  assert.equal(summary.classifiedItems, 1);
  assert.equal(summary.candidatesDrafted, 1);
  assert.equal(summary.dryRun, true);
  assert.equal(summary.candidates[0].primaryCurrent, "governance");
  assert.match(summary.candidates[0].filePath, /runtime\/horizon\/dry/);
  // Dry-run: candidates registry is unchanged.
  assert.deepEqual(loadCandidates(repoRoot).candidates, []);
});

test("runHorizonScan dedupes against the persisted registry", async () => {
  const repoRoot = tempRepo();
  saveSources(repoRoot, { schema: SOURCES_SCHEMA, sources: [mockSource()] });
  // Seed registry with the same hash the next scan would compute.
  saveCandidates(repoRoot, {
    schema: CANDIDATES_SCHEMA,
    candidates: [{
      id: "hc-seed",
      sourceContentHash: contentHash(mockItem()),
      status: "pending",
      filePath: "PLAN/SPECS/CANDIDATES/seed.md",
      ageOutAt: "2027-01-01T00:00:00Z",
      lifecycleHistory: []
    }]
  });
  const fetcher = async () => [mockItem()];
  const classifier = async () => mockClassification();
  const summary = await runHorizonScan(repoRoot, { fetcher, classifier });
  assert.equal(summary.fetchedItems, 1);
  assert.equal(summary.candidatesDrafted, 0);
  assert.equal(summary.candidatesSkippedDuplicate, 1);
});

test("runHorizonScan rejects malformed classifier output", async () => {
  const repoRoot = tempRepo();
  saveSources(repoRoot, { schema: SOURCES_SCHEMA, sources: [mockSource()] });
  const fetcher = async () => [mockItem()];
  const classifier = async () => ({ relevance: "wrong", primaryCurrent: "fake" });
  const summary = await runHorizonScan(repoRoot, { fetcher, classifier });
  assert.equal(summary.classifierRejections, 1);
  assert.equal(summary.candidatesDrafted, 0);
});

test("runHorizonScan respects maxCandidatesPerScan", async () => {
  const repoRoot = tempRepo();
  saveSources(repoRoot, { schema: SOURCES_SCHEMA, sources: [mockSource()] });
  writeFile(repoRoot, "memory/horizon-config.json", JSON.stringify({
    schema: CONFIG_SCHEMA,
    maxCandidatesPerScan: 2,
    dryRun: false
  }));
  const fetcher = async () => Array.from({ length: 5 }, (_, i) => mockItem({ title: "Item " + i }));
  const classifier = async (item) => mockClassification({
    candidateSpecOutline: { title: item.title, purpose: "p", northStarConnection: "n", killCriteria: [] }
  });
  const summary = await runHorizonScan(repoRoot, { fetcher, classifier });
  assert.equal(summary.candidatesDrafted, 2);
  // And the registry now holds exactly 2.
  assert.equal(loadCandidates(repoRoot).candidates.length, 2);
});

test("runHorizonScan surfaces fetcher errors without aborting the scan", async () => {
  const repoRoot = tempRepo();
  saveSources(repoRoot, {
    schema: SOURCES_SCHEMA,
    sources: [
      mockSource({ id: "broken" }),
      mockSource({ id: "working" })
    ]
  });
  const fetcher = async (source) => {
    if (source.id === "broken") throw new Error("network down");
    return [mockItem()];
  };
  const classifier = async () => mockClassification();
  const summary = await runHorizonScan(repoRoot, { fetcher, classifier });
  assert.ok(Array.isArray(summary.errors));
  assert.equal(summary.errors[0].sourceId, "broken");
  assert.equal(summary.fetchedItems, 1);    // working source still ran
  assert.equal(summary.candidatesDrafted, 1);
});

test("defaultFetcher and defaultClassifier ship inert (no propose, no fetch)", async () => {
  const items = await defaultFetcher(mockSource());
  assert.deepEqual(items, []);
  const cls = await defaultClassifier(mockItem(), mockSource(), []);
  assert.equal(cls.relevance, "none");
});

test("VALID_CURRENTS exposes exactly the ten currents from FOREVER_ROADMAP", () => {
  assert.equal(VALID_CURRENTS.size, 10);
  for (const c of [
    "autonomy", "treasury", "governance", "identity",
    "federation", "adoption", "research", "revenue",
    "operations", "public"
  ]) {
    assert.ok(VALID_CURRENTS.has(c), c + " should be a valid current");
  }
});
