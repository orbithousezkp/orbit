# Roadmap Expansion — Planned Features

> Indexed catalog of 30 planned features (F-1.1 … F-5.6) mapped to the existing 9-phase structure in `PHASES.md`. Each feature is PLANNING ONLY — no code in any row is implemented unless an entry is moved to the "Shipped" table at the bottom.
>
> Existing roadmap: `PLAN/ROADMAP.md` (domain-grouped exploration backlog).
> Phase boundaries: `PLAN/PHASES.md`.
> Verification matrix: `PLAN/VERIFICATION_MATRIX.md`.

## Cross-section index

| F-ID | Feature | Existing Phase | Existing Domain |
|---|---|---|---|
| F-1.1 | state.json schema migration system | Phase 1 | A (Trust) |
| F-1.2 | Cycle-rerun forensics | Phase 1 | A (Trust) |
| F-1.3 | Memory file integrity scanner | Phase 1 | A (Trust) |
| F-1.4 | AI provider canary | Phase 1 | (operational) |
| F-1.5 | Error-log compaction policy | Phase 1 | (operational) |
| F-1.6 | Per-memory-file validators | Phase 1 | A (Trust) |
| F-2.1 | Safe multi-sig wallet integration | 1–2 | C (Treasury) |
| F-2.2 | Tiered spend levels | Phase 2 | B (Governance) |
| F-2.3 | Per-provider cost ceiling + auto-failover | Phase 2 | (operational) |
| F-2.4 | Farcaster reply → governance ingestion | 2 | B (Governance) |
| F-2.5 | Per-tool budget envelope | Phase 2 | B (Governance) |
| F-2.6 | Safe owner-rotation watchdog | 2 | C (Treasury) |
| F-3.1 | Public verifier endpoint | 3 | A (Trust) |
| F-3.2 | Merkle anchoring on-chain (extend) | 2–3 | A (Trust) |
| F-3.3 | Dashboard time-travel viewer | 3 | A (Trust) |
| F-3.4 | Farcaster reply → issue gateway | 3 | B (Governance) |
| F-3.5 | ZK policy receipts | 5+ | A (Trust) |
| F-3.6 | Adopter onboarding wizard | 1 | (onboarding) |
| F-4.1 | Federation trust-graph registry | 3–4 | (Federation) |
| F-4.2 | Gossip protocol on family.json | 4 | (Federation) |
| F-4.3 | Inherited governance | 4 | B (Governance) |
| F-4.4 | Cross-family proof aggregation | 4 | A (Trust) |
| F-4.5 | Scoped capability delegation | Phase 4 | B (Governance) |
| F-4.6 | Spec conformance test suite | 5–6 | (Standardization) |
| F-5.1 | Quorum-bootstrap protocol | 4 | B (Governance) |
| F-5.2 | Generalized timelocks | Phase 4 | B (Governance) |
| F-5.3 | $ORBIT ceiling enforcement + buyback automation | 2 | D (Token) |
| F-5.4 | Protocol versioning + migration spec | Phase 5–6 | (Standardization) |
| F-5.5 | Recursive lineage tracking | 4 | (Federation) |
| F-5.6 | Post-fade founder advisory mode | 6 | B (Governance) |

---

## Phase 1 — Groundwork (Pre-Token)

| ID | Feature | Why | Where | Deps |
|---|---|---|---|---|
| F-1.1 | state.json schema migration system | versioned migrations w/ rollback; current code mutates state.json in-place without version pin | `src/agent/state-migrate.js` (new), `src/agent/run.js` | none |
| F-1.2 | Cycle-rerun forensics | re-run any past cycle from its signed proof; verify deterministic output | `scripts/replay-cycle.js` (new), `src/agent/cycle.js` | F-1.1 |
| F-1.3 | Memory file integrity scanner | detect corruption / drift before cycle reads | `src/agent/memory-scan.js` (new) | none |
| F-1.4 | AI provider canary | tiny ping each cycle to detect provider degradation | `src/agent/ai-canary.js` (new), `src/agent/ai-routing.js` | T-8 (done) |
| F-1.5 | Error-log compaction policy | rotate to monthly archive after 30 days | `src/agent/error-log.js` | none |
| F-1.6 | Per-memory-file validators | pluggable JSON schema validators | `src/agent/state-guard.js`, `schemas/` (new) | none |
| F-3.6 | Adopter onboarding wizard | `npx create-orbit-house` + post-install setup walkthrough | `packages/create-orbit-house` | npm publish |

## Phase 2 — Genesis (Token Live + First 30 Days)

| ID | Feature | Why | Where | Deps |
|---|---|---|---|---|
| F-2.1 | Safe multi-sig wallet integration | replace EOA with threshold sig; unblocks D-018 #7 | `src/agent/safe.js` (new), `treasury.js` | Treasury Safe deployed |
| F-2.2 | Tiered spend levels | small/medium/large with different quorum thresholds | `governance.js` (actionTier extension) | F-2.1 |
| F-2.3 | Per-provider cost ceiling + auto-failover | cap $/cycle/provider; route around exhausted provider | `ai-routing.js`, `ai-food.js` | F-1.4 |
| F-2.4 | Farcaster reply → governance ingestion | replies to approval-cast become governance vote signal | `farcaster.js`, `governance.js` | Farcaster signer live |
| F-2.5 | Per-tool budget envelope | quotas for fetchUrl, webSearch, AI calls per cycle | `tools.js`, `safety.js` | none |
| F-2.6 | Safe owner-rotation watchdog | on-chain observer; alerts if Safe owners change unexpectedly | `src/agent/safe-watch.js` (new) | F-2.1 |
| F-3.2 | Merkle anchoring on-chain (extend) | Merkle root of every N cycles posted to Base; tamper-evident history | `merkle-anchor.js` (extend), `clanker.js` | D-018 verified |
| F-5.3 | $ORBIT ceiling enforcement + buyback automation | code path for token-side rules once D-018 closes | `clanker.js`, `buyback.js` (extend) | D-018 closed |

## Phase 3 — Capability Marketplace

| ID | Feature | Why | Where | Deps |
|---|---|---|---|---|
| F-3.1 | Public verifier endpoint | anyone fetches a cycle proof URL and verifies offline | dashboard route, `proof-viewer` | repo public |
| F-3.3 | Dashboard time-travel viewer | view dashboard state at any past block / commit | dashboard JS | F-3.1 |
| F-3.4 | Farcaster reply → issue gateway | public reply auto-opens GitHub issue for triage | `farcaster.js`, GitHub Action | F-2.4 |
| F-4.1 | Federation trust-graph registry (begin) | adopters' family.json aggregated into public graph | new `packages/federation-registry`, dashboard | Phase 3 surfaces |

## Phase 4 — Federation

| ID | Feature | Why | Where | Deps |
|---|---|---|---|---|
| F-4.2 | Gossip protocol on family.json | adopters discover siblings via signed pull requests across repos | `federation.js`, new `federation-gossip.js` | F-4.1 |
| F-4.3 | Inherited governance | child repos optionally inherit parent's gates by ref | `create-orbit-house`, `governance.js` | F-5.4 (spec versioned) |
| F-4.4 | Cross-family proof aggregation | dashboard shows lineage tree with proof counts per node | dashboard | F-4.1 |
| F-4.5 | Scoped capability delegation | parent grants child specific tools (e.g., webSearch only, no clanker) | `governance.js`, `passport.json` schema | F-1.6 |
| F-5.1 | Quorum-bootstrap protocol | new maintainers join via existing quorum vote, not founder grant | `governance.js`, `handoff.js` | quorum-CI mature |
| F-5.2 | Generalized timelocks | timelock pattern extends to spend levels, gate flips, schema migrations | `governance.js` | F-2.2 |
| F-5.5 | Recursive lineage tracking | child-of-child-of lineage in `orbit-lineage.json` | `federation.js`, dashboard | F-4.1 |

## Phase 5 — Protocol Independence

| ID | Feature | Why | Where | Deps |
|---|---|---|---|---|
| F-3.5 | ZK policy receipts | prove a gate passed without exposing inputs | `governance.js`, new `zk-receipt.js` | research |
| F-4.6 | Spec conformance test suite | npm package any Orbit impl can run to claim conformance | new `packages/orbit-conformance` | F-5.4 |
| F-5.4 | Protocol versioning + migration spec | `ORBIT_PROTOCOL_VERSION` header on all artifacts; migration path between versions | repo-wide | F-1.1 |

## Phase 6 — Standardization

| ID | Feature | Why | Where | Deps |
|---|---|---|---|---|
| F-5.6 | Post-fade founder advisory mode | read-only role for retired founder; no vote weight | `governance.js` | handoff timelock fires |

---

## Adding new expansion items

1. Pick existing phase that matches the dependency requirement (PHASES.md is the canonical list).
2. Use next ID in sequence (F-1.7, F-2.7, etc.).
3. Fill all 5 columns: Feature / Why / Where / Deps.
4. Update the Cross-section index at the top.
5. Commit with `docs(roadmap): add F-X.Y <feature>`.
6. Do not build it. Wait for the phase to be active.

## Shipped

Move rows here when implemented + verified in `PLAN/VERIFICATION_MATRIX.md`.

| F-ID | Feature | Shipped in commit | Matrix row |
|---|---|---|---|
| F-1.5 | Error-log compaction policy | fc5164df | 47 |
| F-1.3 | Memory file integrity scanner | 3d37cc96 | 48 |
| F-1.4 | AI provider canary | fc2cd2a5 | 49 |
| F-1.1 | state.json schema migration | c5733603 | 50 |
| F-1.6 | Per-memory-file validators | a73b1769 | 51 |
| F-1.2 | Cycle-rerun forensics | bd469489 | 52 |
| F-5.4 | Protocol versioning + migration spec | 2665d9d5 | 53 |
| F-4.5 | Scoped capability delegation | 388495c9 | 54 |
| F-2.5 | Per-tool budget envelope | 6e1b829d | 55 |
| F-2.3 | Per-provider cost ceiling + auto-failover | 8c607e27 | 56 |
| F-2.2 | Tiered spend levels | fa4c77de | 57 |
| F-5.2 | Generalized timelocks | (this commit) | 58 |
