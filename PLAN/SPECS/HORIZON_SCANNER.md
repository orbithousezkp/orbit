# HORIZON_SCANNER.md — Self-Extending Research Engine (S-HORIZON-1)

> Status: **Drafted, not yet built.** Hard-blocked behind `S-GATE-1` closure and `state.preLaunchVerified === true` (D-018). Like the revenue explorer, this is a new-capability spec; implementation lands under owner review only after Phase 1 sign-off. Dry-run mode (output to local files, no issues opened) can run pre-launch.
>
> This spec proposes one new decision for ratification before code merges: **D-NEW-023** (the roadmap is a living artifact; any cycle is permitted to propose new candidate specs into `PLAN/SPECS/CANDIDATES/` provided the proposal is signed, dedup'd, and approval-gated for promotion). This decision is not written to `PLAN/DECISIONS.md` here — it is flagged for owner ratification before S-HORIZON-1 implementation begins.

---

## 1. Purpose

Orbit is intended to outlive its founder ([PHASES.md](../PHASES.md) Phase 5, [FOREVER_ROADMAP.md](../FOREVER_ROADMAP.md)). A project that outlives a founder must continue to discover new things to build — because the environment changes (new EIPs, new attack patterns, new AI models, new federation peers) and a roadmap frozen at founder-departure ages into irrelevance.

The current discovery loop is implicit: the founder reads the open web, drafts new specs, and merges them. After founder-fade, that loop disappears. There is no agent-side mechanism today that turns "the environment changed" into "Orbit drafted a candidate spec."

The HORIZON_SCANNER is that mechanism. It runs as a low-cadence cycle subsystem, scans a configurable set of public information sources, classifies signals against Orbit's ten currents ([FOREVER_ROADMAP.md §3](../FOREVER_ROADMAP.md#3-the-ten-currents)), and produces candidate specs drafted into `PLAN/SPECS/CANDIDATES/`. Promotion of a candidate to a real spec remains quorum-gated; the scanner only generates the surface area through which new work can be proposed and reviewed.

The scanner does not implement; it proposes. The scanner does not spend; it scans. It is the engine that makes the [FOREVER_ROADMAP](../FOREVER_ROADMAP.md) literally self-extending.

---

## 2. Design principles

The scanner's correctness rests on seven commitments. Each one is load-bearing. The implementation either keeps all seven or the implementation is wrong.

**Bounded sources, open scope.** The scanner reads from a configurable allowlist of *source types* (RSS feeds, ArXiv categories, GitHub search queries, federation peer manifests, public attack-report feeds). The list of source *types* is short and finite; the list of *URLs* under each type is dynamic and can grow without an approval issue per URL. This honors the "research access stays open" project memory while still bounding the scanner's behavior to a known shape.

**Read-only on the open web; signed on Orbit's surfaces.** The scanner fetches over HTTPS only. It never authenticates against external services. Anything it writes back goes onto Orbit-controlled surfaces (cycle proofs, `PLAN/SPECS/CANDIDATES/`, GitHub issues in this repo). All scanner outputs are signed under D-006 the same as any cycle artifact.

**Trust nothing fetched.** Every fetched signal is wrapped in an untrusted-input envelope before any LLM step touches it (`provenance: { source, url, fetchedAt, contentHash }`, body inside `<untrusted-input>` framing). The risk-scoring layer treats scanner-fetched text as a potential adversary, never as trusted instructions. This blocks the obvious "malicious ArXiv abstract that tries to make Orbit propose a backdoor spec" failure mode.

**Approval-gated promotion, not approval-gated scanning.** The act of scanning runs without per-cycle approval — it produces dry artifacts (candidate spec drafts) only. Promotion of a candidate to `PLAN/SPECS/` requires the standard D-014 approval flow plus quorum per the current threshold. The asymmetry mirrors the dashboard pattern: read freely, write under approval.

**Dedupe across cycles.** A candidate that has already been proposed (whether currently pending, promoted, or archived) is not re-proposed. The scanner consults `memory/horizon-candidates.json` and the file tree under `PLAN/SPECS/{CANDIDATES,ARCHIVE}/` before generating any new draft. Idempotency on signal content hash.

**Adopt-or-fade.** Candidates that sit in `CANDIDATES/` for more than `archiveAfterCycles` (default: 90) move to `ARCHIVE/` with a recorded reason. Archived candidates are searchable; the scanner consults them so it doesn't churn on the same idea repeatedly. Capabilities — once built — are similarly retirable through a parallel kill mechanism.

**Self-monitoring.** The scanner's own activity is a current ([Operations](../FOREVER_ROADMAP.md#39-operations)). If the scanner produces zero candidates for `staleAfterCycles` consecutive scans (default: 30), that is itself a flag: the source feeds may be broken, the classifier may be over-rejecting, or the environment genuinely was quiet. Either way, a quorum-reviewed health check is filed. The roadmap's own pulse is monitored.

---

## 3. Component model

Five components. Each maps to a clearly-bounded module under `src/agent/` and a memory file under `memory/`. No shared state across components except through these files.

### 3a. Source registry

Static manifest of source *types*; dynamic per-type URL list editable by approved configuration changes.

`memory/horizon-sources.json`:
```jsonc
{
  "schema": "orbit-horizon-sources/1",
  "sources": [
    {
      "id": "eip-rss",
      "type": "rss",
      "url": "https://eips.ethereum.org/all.atom",
      "classifyTo": ["identity", "treasury", "governance"],
      "enabled": true,
      "lastFetchedAt": null,
      "lastFetchedHash": null,
      "fetchCadenceHours": 24,
      "consecutiveFailures": 0
    },
    {
      "id": "arxiv-cscr",
      "type": "rss",
      "url": "http://export.arxiv.org/rss/cs.CR",
      "classifyTo": ["research", "operations", "identity"],
      "enabled": true,
      "fetchCadenceHours": 24,
      "consecutiveFailures": 0
    },
    {
      "id": "github-trending-agents",
      "type": "github_search",
      "query": "topic:autonomous-agents created:>2026-01-01 stars:>100",
      "classifyTo": ["autonomy", "adoption", "federation"],
      "enabled": true,
      "fetchCadenceHours": 72,
      "consecutiveFailures": 0
    },
    {
      "id": "federation-capability-feed",
      "type": "federation_capability",
      "url": "internal://federation/capabilities",
      "classifyTo": ["federation", "adoption", "research"],
      "enabled": true,
      "fetchCadenceHours": 24,
      "consecutiveFailures": 0
    }
  ]
}
```

`type` is enumerated; adding a new type requires a constitutional-amendment-level change. `classifyTo` constrains which currents this source can feed; the classifier still picks one primary current from this restricted set, defending against misclassification when a source is mis-tagged.

`enabled: false` is the kill switch. A source that has `consecutiveFailures >= maxFailures` (default: 5) auto-disables itself and files an operations issue. No silent failures.

### 3b. Fetcher

Pure-function module that takes a source record and returns a list of `{ url, title, body, fetchedAt, contentHash }` items. Respects the source's `fetchCadenceHours`. Stores raw response under `runtime/horizon/<sourceId>/<YYYY-MM-DD>/<contentHash>.json` for tamper-evidence; the hash is the filename so the path itself is a proof.

The fetcher reuses the existing `fetchUrl` capability (no new external dependency, no new env var). It records the fetch in the cycle proof step list so the operation is auditable.

### 3c. Classifier

LLM step. Input: a single fetched item, wrapped in the untrusted-input envelope, plus the list of valid currents and their north stars. Output: structured JSON:

```jsonc
{
  "relevance": "high|medium|low|none",
  "primaryCurrent": "treasury|...",        // null if relevance=="none"
  "secondaryCurrents": ["..."],
  "rationale": "≤200 chars",
  "candidateSpecOutline": {
    "title": "...",
    "purpose": "≤500 chars",
    "northStarConnection": "≤300 chars",
    "killCriteria": ["...", "..."]
  }
}
```

Hard schema. Anything else from the LLM is treated as classifier failure and the item is shelved to `runtime/horizon/<sourceId>/rejected/` with a reason. The classifier never gets to invoke any tool; it returns text only.

Default cost discipline: classifier runs on Haiku (cheap) unless the item is short enough that Sonnet is cheaper per token; never Opus by default.

### 3d. Candidate drafter

Takes a `relevance: "high"` classifier output and writes a candidate spec to `PLAN/SPECS/CANDIDATES/YYYY-MM-DD-<slug>.md`. The drafter follows the existing spec template (purpose, design principles, component model, lifecycle, gating, failure modes, acceptance criteria, gaps logged). The drafter does NOT invent specifics; it produces a *skeleton* spec with the classifier's outline, source provenance, and TODO markers for human-quorum elaboration.

Two-file output:
1. `PLAN/SPECS/CANDIDATES/YYYY-MM-DD-<slug>.md` — the draft spec.
2. `memory/horizon-candidates.json` — registry entry with id, slug, sourceId, contentHash, status (`pending|promoted|archived`), proposedAt, lastReviewedAt, ageOutAt.

### 3e. Promoter / archiver

Cycle subsystem that runs each main cycle (cheap; no inference):
- Reads `horizon-candidates.json`.
- For each `pending` candidate where `ageOutAt < now`: move the file from `CANDIDATES/` to `ARCHIVE/`, set status to `archived`, file a cast about it (optional, per `castOnArchive` config).
- For each candidate whose corresponding GitHub issue has been closed with a `promote` label by quorum: move file from `CANDIDATES/` to top-level `SPECS/`, set status to `promoted`, file a cast.
- For each candidate whose issue has been closed with a `reject` label by quorum: move file from `CANDIDATES/` to `ARCHIVE/` with status `archived` and reason `rejected`.

Same approval/comment semantics as D-014. The promoter writes nothing on-chain; it moves files and updates state.

---

## 4. Lifecycle

A candidate's lifecycle is a small state machine. Transitions are recorded in `lifecycleHistory[]` on the candidate's registry entry, mirroring the experiment lifecycle in REVENUE_EXPLORER.

```
       (scanner finds new signal, classifier returns high relevance)
                               │
                               ▼
                          pending  ─────────────────────────────┐
                          │     │                                │
              (quorum review)   (ageOutAt elapsed)               │
                          │     │                                │
                          ▼     ▼                                │
                       promoted  archived          (rare:        │
                          │         │             scanner finds  │
                          │         │             refresh of     │
                          │         │             archived item) │
                          │         │                            │
                          │         └───────────► revived ◄──────┘
                          │                          │
                          ▼                          ▼
                  SPECS/<spec>.md           pending (new entry,
                  (henceforth a real        cites archive entry)
                   spec; spec lifecycle
                   from here is normal)
```

Promoted candidates are not auto-implemented. Implementation goes through the normal session pattern (`S-XXX`) with its own approval gates.

---

## 5. Schema additions

Two new memory files (versioned, additive):

`memory/horizon-sources.json` — schema `orbit-horizon-sources/1`. Shape above.

`memory/horizon-candidates.json` — schema `orbit-horizon-candidates/1`:
```jsonc
{
  "schema": "orbit-horizon-candidates/1",
  "candidates": [
    {
      "id": "hc-20260601-001",
      "slug": "session-keys-erc7715",
      "sourceId": "eip-rss",
      "sourceContentHash": "0x...",
      "primaryCurrent": "governance",
      "secondaryCurrents": ["treasury", "identity"],
      "status": "pending",                 // pending|promoted|archived
      "filePath": "PLAN/SPECS/CANDIDATES/2026-06-01-session-keys-erc7715.md",
      "issueNumber": 124,
      "issueUrl": "https://github.com/.../issues/124",
      "proposedAt": "2026-06-01T03:14:00Z",
      "ageOutAt": "2026-08-30T03:14:00Z",
      "lifecycleHistory": [
        { "ts": "2026-06-01T03:14:00Z", "from": null, "to": "pending", "actor": "scanner", "evidence": "classifier output hash 0x..." }
      ]
    }
  ]
}
```

Dashboard projection adds a slim `horizon` slice (schema `orbit-horizon/1`) with `pendingCount`, `promotedCount`, `archivedCount`, and a `mostRecent[]` of pending candidates with `slug`, `primaryCurrent`, `proposedAt`, `pendingSinceHours`. No source-content body, no URL leakage — the dashboard shows that the scanner is alive, not what it found in any one signal.

---

## 6. Gating

This is new capability. Therefore:

- **D-018:** scanner is OFF until `state.preLaunchVerified === true`. The flag is checked in `src/agent/horizon-scanner.js` at module init and at each scan call. Dry-run mode (output to `runtime/horizon/dry/` only, no files written to `PLAN/`, no issues opened) is permitted pre-launch for developer testing under the same pattern as `buyback.js`.
- **D-014:** the scanner itself does not need per-cycle approval (read-only on open web, dry artifacts only). **Candidate promotion** requires the standard approval flow with quorum threshold for "new capability" — `APPROVE ORBIT-HORIZON <candidateId>` posted by ≥quorum of maintainers, exact-match comment line.
- **D-006:** every scanner cycle writes a signed step into the cycle proof with the list of source ids fetched, item count, candidate count generated. Tampering with a scanner cycle is detectable like any other cycle.
- **Treasury floor:** scanner does not spend on-chain. AI spend (classifier inference) flows through the same `ai-food` budget as the main cycle and inherits its caps. A scan that would exceed the daily AI budget is deferred to the next cycle.
- **No money on visitor surfaces:** the horizon slice shows counts and slugs. Never source URLs (would let visitors infer what Orbit is reading and game the input). Never raw fetched content. Never dollar amounts.

---

## 7. Configuration

`memory/horizon-config.json` — schema `orbit-horizon-config/1`:
```jsonc
{
  "schema": "orbit-horizon-config/1",
  "scanCadenceHours": 24,
  "maxItemsPerScan": 50,
  "maxCandidatesPerScan": 5,
  "archiveAfterCycles": 90,
  "staleAfterCycles": 30,
  "maxConsecutiveSourceFailures": 5,
  "classifierModel": "haiku",
  "drafterModel": "sonnet",
  "castOnArchive": false,
  "castOnPromote": true,
  "dryRun": true                            // flips to false post-S-GATE-1 by owner action
}
```

Defaults are conservative. Tightening them (lower cadence, smaller maxItems) is permitted without approval; loosening them (higher cadence, larger caps, new model) requires the standard config-change approval flow.

---

## 8. Failure modes

| Mode | Detection | Response |
|------|-----------|----------|
| All sources stale / 0 candidates in 30 scans | `staleAfterCycles` counter | File quorum-reviewed health-check issue; cast about it |
| Source returns malformed feed | Fetcher schema check | Increment `consecutiveFailures`; disable source at 5 |
| Classifier returns malformed JSON | Schema validation | Shelve item to `runtime/horizon/<sourceId>/rejected/`; log; do not retry that item |
| Classifier proposes spec that breaks an immutable principle | Optional automated check post-draft | Reject draft; file diagnostic; do not write candidate file |
| Same item proposed twice across cycles (e.g., RSS re-emits) | Content hash dedup against `horizon-candidates.json` and archive index | Skip silently; no candidate written |
| Promoter cannot move file (path conflict) | Filesystem write failure | Roll back state; file operations issue; do not silently lose the candidate |
| LLM cost overrun during scan | Existing `ai-food` budget guard | Defer remaining items to next scan; cast about the deferral |
| Federation peer source feeds adversarial CAPABILITY_ADVERTISE | Risk-scoring layer flags peer; provenance retained | Quarantine peer's contributions until quorum reviews; do not auto-disable peer (federation health is its own current) |

---

## 9. Acceptance criteria

S-HORIZON-1 is "done" (in the sense of the spec being shipped, not the capability being closed) when:

1. `src/agent/horizon-scanner.js` exists with the five components above as exported functions.
2. `memory/horizon-sources.json`, `memory/horizon-candidates.json`, `memory/horizon-config.json` all exist with schema-versioned defaults.
3. Tests cover: source-registry edits, fetcher dedup, classifier rejection of malformed output, drafter writes well-formed spec skeleton, promoter respects D-014 quorum, archiver moves and casts (config-conditional), all error paths in §8.
4. Dashboard projection includes `horizon` slice; existing dashboard tests extended.
5. The scanner runs under `npm run cycle` in dry-run mode without writing to `PLAN/` or opening issues.
6. A first non-dry scan, after S-GATE-1 closes, produces at least one candidate spec in `PLAN/SPECS/CANDIDATES/` and at least one quorum-review issue.

After acceptance, the *capability* lives in the [Research current](../FOREVER_ROADMAP.md#37-research-the-meta-current) and its retirement (if it ever happens) flows through the standard capability-kill process in [FOREVER_ROADMAP §7](../FOREVER_ROADMAP.md#7-adopt-or-fade-rules-for-candidate-specs).

---

## 10. Gaps logged for future patches

- **Cross-Orbit horizon federation.** Federation peers could share their own candidate streams (signed). The scanner could ingest peer candidates as a source type. Deferred until federation outbound (S-026/S-027) is in production; would compound the cross-instance learning current.
- **Time-series classifier.** Today's classifier looks at one item at a time. A trend-aware classifier would detect "five separate signals all pointing at the same protocol shift" and propose a higher-confidence candidate. Requires the long-horizon memory current to be productive first.
- **Adversarial simulation hook.** The scanner reads about new attacks. The natural next step is for the [Adversarial Resilience domain](../ROADMAP.md#r--adversarial-resilience) to consume scanner-flagged attack patterns and run them against Orbit as red-team rehearsals. Belongs in its own spec; this spec only commits to surfacing the signals.
- **Source-quality scoring.** Some sources will produce many low-relevance signals (e.g., a noisy RSS feed). A scoring layer that auto-tunes per-source `fetchCadenceHours` would reduce waste. Premature without scan history; revisit after 90 scans of production data.
- **Public horizon log.** A redacted feed of "what Orbit is currently scanning" could be public for transparency, with care taken not to disclose the read-list (per the no-source-URL-on-visitor-surfaces rule in §6). Design space; not committed.

---

## 11. Spec change log

- **2026-05-26:** initial draft, paired with [FOREVER_ROADMAP.md](../FOREVER_ROADMAP.md) and the post-Patch-Set-A/B work on closed-loop demo gaps.
