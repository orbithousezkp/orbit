# V-1 — Verification + Roadmap Reorg + Roadmap Expansion

**Date:** 2026-05-28
**Status:** spec — awaiting approval
**Owner action:** none required during sprint

## Goal

Three things in one sprint:
1. Every feature on `main` proven working end-to-end. Bugs fixed inline.
2. "Partial" features filed to a clean roadmap phase with explicit defer reason.
3. New planned features added to roadmap per phase. Planning artifacts only — no implementation.

## Non-goals

- No implementation of new features (planning entries only)
- No public-version code work (Pages, npm publish, adopter funnel) — only roadmap entries
- No refactors

## Deliverables

| File | Purpose |
|---|---|
| `PLAN/VERIFICATION_MATRIX.md` | one row per feature: verification method, evidence, status |
| `PLAN/PHASES.md` (reorg) | clean Phase 1–5 boundaries |
| `PLAN/ROADMAP.md` (reorg or new) | per-phase work surface; partial items filed by phase |
| `PLAN/ROADMAP_EXPANSION.md` | new planned features per phase, with rationale and dependencies |
| `PLAN/ROADMAP_CHANGES.md` | summary of what moved + what was added + why |

## Verification matrix schema

```
| Feature | File:line | Method | Evidence | Status |
```

Status values:
- `PASS` — works, tested
- `FAIL` — bug found (fix inline if <2 files; else file roadmap item)
- `PARTIAL-DEFERRED` — incomplete by design; assigned to phase
- `OWNER-BLOCKED` — code ready, awaits owner secret/wallet/action

Methods (cheapest first):
1. Existing unit test ref
2. Existing integration test ref
3. Manual runtime probe (dryrun cycle / gate-flip on copy / sweep dry-run)
4. Static code path read (when runtime test impractical)

## Roadmap phase structure

| Phase | Theme | Entry criterion | Exit criterion |
|---|---|---|---|
| 1 | Private stability | engine compiles | 12hr clean dryrun + S-GATE-1 closed |
| 2 | Owner activation | P1 closed | Farcaster live, Safe deployed, MiMo live, GPG signing live |
| 3 | Public face | P2 closed | repo public, Pages live, npm published, spec page rendered |
| 4 | Adopter funnel | P3 closed | ≥1 second adopter, federation handshake live |
| 5 | Founder-fade | P4 closed | ≥50 adopters + ≥3 spec implementations + handoff timelock fires |

## Partial-item phase assignments

| Partial item | Phase | Defer reason |
|---|---|---|
| HORIZON_SCANNER classifier LLM loop | 4 | needs real adopter/source corpus to classify |
| proof-cast standalone CLI | 3 | dependent on public dashboard surface |
| Founder-handoff Safe broadcast automation | 2 | needs Treasury Safe deployed first |
| MiMo / OpenGateway provider wiring | 2 | config-only; owner sets secret |
| Dashboard publish to Pages | 3 | needs repo public OR paid Pages |
| Adopter registry public | 4 | needs Phase 3 surface |

## Roadmap expansion — new planned features per phase

All entries are PLANNED only. No code in this sprint. Each entry: ID, name, why, where, dependencies.

### Phase 1 — Private stability (engineering depth)

| ID | Feature | Why | Where | Deps |
|---|---|---|---|---|
| F-1.1 | state.json schema migration system | versioned migrations w/ rollback; current code mutates state.json in-place without version pin | `src/agent/state-migrate.js` (new), `src/agent/run.js` | none |
| F-1.2 | Cycle-rerun forensics | re-run any past cycle from its signed proof, verify deterministic output; catches non-determinism early | `scripts/replay-cycle.js` (new), `src/agent/cycle.js` | F-1.1 |
| F-1.3 | Memory file integrity scanner | detect corruption / drift before cycle reads; pairs with atomic-write hardening | `src/agent/memory-scan.js` (new) | none |
| F-1.4 | AI provider canary | tiny ping each cycle to detect provider degradation before real call; routes around silently broken provider | `src/agent/ai-canary.js` (new), `src/agent/ai-routing.js` | T-8 (done) |
| F-1.5 | Error-log compaction policy | rotate to monthly archive after 30 days; current trim-at-5000 keeps recent only | `src/agent/error-log.js` | none |
| F-1.6 | Per-memory-file validators | pluggable JSON schema validators; rejects malformed writes | `src/agent/state-guard.js`, `schemas/` (new) | none |

### Phase 2 — Owner activation (live infra)

| ID | Feature | Why | Where | Deps |
|---|---|---|---|---|
| F-2.1 | Safe multi-sig wallet integration | replace EOA with threshold sig; D-018 #7 unblocked | `src/agent/safe.js` (new), `treasury.js` | Treasury Safe deployed |
| F-2.2 | Tiered spend levels | small/medium/large with different quorum thresholds; finer governance grain | `governance.js` actionTier extension | F-2.1 |
| F-2.3 | Per-provider cost ceiling + auto-failover | cap $/cycle/provider; route around exhausted provider | `ai-routing.js`, `ai-food.js` | F-1.4 |
| F-2.4 | Farcaster reply → governance ingestion | replies to approval-cast become equivalent governance vote signal | `farcaster.js`, `governance.js` | Farcaster signer live |
| F-2.5 | Per-tool budget envelope | quotas for fetchUrl, webSearch, AI calls per cycle | `tools.js`, `safety.js` | none |
| F-2.6 | Safe owner-rotation watchdog | on-chain observer; alerts if Safe owners change unexpectedly | `src/agent/safe-watch.js` (new) | F-2.1 |

### Phase 3 — Public face (visibility)

| ID | Feature | Why | Where | Deps |
|---|---|---|---|---|
| F-3.1 | Public verifier endpoint | anyone fetches a cycle proof URL and verifies offline | dashboard route, `proof-viewer` | repo public |
| F-3.2 | Merkle anchoring on-chain | Merkle root of every N cycles posted to Base; tamper-evident history | `merkle-anchor.js` (exists; extend), `clanker.js` | D-018 verified |
| F-3.3 | Dashboard time-travel viewer | view dashboard state at any past block / commit | dashboard JS | F-3.1 |
| F-3.4 | Farcaster reply → issue gateway | public reply auto-opens GitHub issue for triage | `farcaster.js`, GitHub Action | F-2.4 |
| F-3.5 | ZK policy receipts | prove a gate passed without exposing inputs (T-5 stronger form) | `governance.js`, new `zk-receipt.js` | research |
| F-3.6 | Adopter onboarding wizard | `npx create-orbit-house` + post-install setup walkthrough | `packages/create-orbit-house` | npm publish |

### Phase 4 — Adopter funnel (federation)

| ID | Feature | Why | Where | Deps |
|---|---|---|---|---|
| F-4.1 | Federation trust-graph registry | adopters' family.json aggregated into public graph | new `packages/federation-registry`, dashboard | Phase 3 |
| F-4.2 | Gossip protocol on family.json | adopters discover siblings via signed pull requests across repos | `federation.js`, new `federation-gossip.js` | F-4.1 |
| F-4.3 | Inherited governance | child repos optionally inherit parent's gates by ref (versioned spec link) | `create-orbit-house`, `governance.js` | F-6.4 (spec versioned) |
| F-4.4 | Cross-family proof aggregation | dashboard shows lineage tree with proof counts per node | dashboard | F-4.1 |
| F-4.5 | Scoped capability delegation | parent grants child specific tools (e.g., webSearch only, no clanker) | `governance.js`, `passport.json` schema | F-1.6 |
| F-4.6 | Spec conformance test suite | npm package any Orbit impl can run to claim conformance | new `packages/orbit-conformance` | F-6.4 |

### Phase 5 — Founder-fade

| ID | Feature | Why | Where | Deps |
|---|---|---|---|---|
| F-5.1 | Quorum-bootstrap protocol | new maintainers join via existing quorum vote, not founder grant | `governance.js`, `handoff.js` | quorum-CI mature |
| F-5.2 | Generalized timelocks | timelock pattern extends to spend levels, gate flips, schema migrations | `governance.js` | F-2.2 |
| F-5.3 | $ORBIT ceiling enforcement + buyback automation | code path for token-side rules once D-018 closes | `clanker.js`, `buyback.js` (exists; extend) | D-018 closed |
| F-5.4 | Protocol versioning + migration spec | ORBIT_PROTOCOL_VERSION header on all artifacts; migration path between versions | repo-wide | F-1.1 |
| F-5.5 | Recursive lineage tracking | child-of-child-of lineage in `orbit-lineage.json` | `federation.js`, dashboard | F-4.1 |
| F-5.6 | Post-fade founder advisory mode | read-only role for retired founder; no vote weight | `governance.js` | handoff timelock fires |

## Execution plan

1. Enumerate every claim in `memory/identity.md`, `PLAN/PHASES.md`, `PLAN/DECISIONS.md`, `PLAN/STABILITY_SECURITY.md` → matrix rows
2. Map each row to file:line + verification method
3. Run verifications (existing test → grep + assert pass; runtime probe → script)
4. Fix bugs inline (≤2 files); larger bugs → roadmap item
5. Reorg `PLAN/PHASES.md` + write `PLAN/ROADMAP.md`
6. Write `PLAN/ROADMAP_EXPANSION.md` with the F-* feature entries above
7. Write `PLAN/ROADMAP_CHANGES.md` diff-summary
8. Final test run: `npm test` ≥1504/1504 pass
9. Spawn code-review on diff

## Definition of done

- `PLAN/VERIFICATION_MATRIX.md` committed; every row populated
- `PLAN/PHASES.md` + `PLAN/ROADMAP.md` reorged
- `PLAN/ROADMAP_EXPANSION.md` lists all F-* entries above with deps + rationale
- Every PARTIAL-DEFERRED item has phase + defer reason
- Bugs found: fixed (with new tests) or filed
- `npm test` ≥1504/1504 pass
- No new feature code beyond direct bug fixes (roadmap entries are docs, not code)
- Diff reviewed by code-review agent

## Scope guardrails

- Bug fix touches >2 files → STOP, file as roadmap item
- Need to add a "new" feature mid-verification → STOP, file as roadmap item
- New tests only for bugs being fixed; not retroactive coverage growth
- No refactors

## Risk register

| Risk | Mitigation |
|---|---|
| Matrix balloons to 100+ rows | cap at one row per FEATURE not per function; collapse related |
| Bug found that's >2 files | file as roadmap item, don't bleed scope |
| Verification probes mutate state | run on temp dirs / state.json copies only |
| Reorg loses link integrity | grep all PLAN/* refs after reorg, fix broken refs |
