# Roadmap Changes — V-1 sprint (2026-05-28)

> Diff summary of the V-1 verification + roadmap expansion sprint.
> Companion files: `PLAN/VERIFICATION_MATRIX.md`, `PLAN/ROADMAP_EXPANSION.md`.

## Verification results

- Total features verified: 46
- PASS: 33
- FAIL: 0 (no inline fixes needed)
- PARTIAL-DEFERRED: 10
- OWNER-BLOCKED: 3

## File changes (V-1 sprint)

| File | Action | Note |
|---|---|---|
| `PLAN/VERIFICATION_MATRIX.md` | created | 46 verified rows + summary |
| `PLAN/ROADMAP_EXPANSION.md` | created | 30 planned F-* features mapped to existing 9-phase structure |
| `PLAN/ROADMAP_CHANGES.md` | created | this file |
| `PLAN/PHASES.md` | unchanged | existing 9-phase canonical structure kept intact |
| `PLAN/ROADMAP.md` | unchanged | existing domain-grouped exploration backlog kept intact |

## What was ADDED to the roadmap

### 30 new planned features (F-1.1 through F-5.6)

All entries are PLANNING ONLY — no code shipped. See `PLAN/ROADMAP_EXPANSION.md` for the full table. Distribution across the canonical 9 phases:

| Phase | Count | Feature IDs |
|---|---|---|
| 1 (Groundwork) | 7 | F-1.1, F-1.2, F-1.3, F-1.4, F-1.5, F-1.6, F-3.6 |
| 2 (Genesis) | 8 | F-2.1, F-2.2, F-2.3, F-2.4, F-2.5, F-2.6, F-3.2, F-5.3 |
| 3 (Capability Marketplace) | 4 | F-3.1, F-3.3, F-3.4, F-4.1 |
| 4 (Federation) | 7 | F-4.2, F-4.3, F-4.4, F-4.5, F-5.1, F-5.2, F-5.5 |
| 5 (Protocol Independence) | 3 | F-3.5, F-4.6, F-5.4 |
| 6 (Standardization) | 1 | F-5.6 |
| 7–9 | 0 | (none added in this sprint) |

## Verification matrix — partial-deferred items

10 rows marked `PARTIAL-DEFERRED` in `PLAN/VERIFICATION_MATRIX.md`. These are pre-existing roadmap items, not new defers:

| Item | Existing tracker |
|---|---|
| T-1 missing callers (merkle-anchor.js, federation.js) | STABILITY_SECURITY.md T-1 |
| T-2 gate-hash binding | STABILITY_SECURITY.md T-2 |
| T-4 untrusted-content envelope | STABILITY_SECURITY.md T-4 |
| T-5 SHA256 spend-id encoding | STABILITY_SECURITY.md T-5 |
| T-6 AI key rotation advisory | STABILITY_SECURITY.md T-6 |
| T-7 30-day expiry on `preLaunchVerified` | STABILITY_SECURITY.md T-7 |
| HORIZON_SCANNER classifier LLM loop | PHASES.md Phase 5+ / FOREVER_ROADMAP.md |
| Founder-handoff Safe broadcast automation | FOUNDER_HANDOFF.md (S-035 design) |
| Proof-viewer published to npm | PHASES.md Phase 1 (S-007) |
| Plugin-loader full economy | PHASES.md Phase 3 (S-024) |

## Owner-blocked items

3 rows marked `OWNER-BLOCKED` in `PLAN/VERIFICATION_MATRIX.md`. All track to `PLAN/SGATE_1.md`:

| Item | SGATE_1 link |
|---|---|
| MiMo / OpenGateway provider secret | D-018 #3 — "Configure AI provider" |
| T-3 signed-commit ENFORCE mode | SGATE_1.md (T-3 Part C+D, requires GPG key + `ORBIT_SIGN_ENFORCE=true`) |
| Farcaster signer provisioning | SGATE_1.md #4 — "Provision Farcaster signer" |

## Bugs fixed inline

None. All FAIL-suspect features turned out to be PARTIAL-DEFERRED by design or already PASS.

## What was NOT changed

- `memory/identity.md` — left alone; identity narrative reorg is a separate cycle
- `PLAN/PHASES.md` — preserved 9-phase canonical structure
- `PLAN/ROADMAP.md` — preserved domain-grouped exploration backlog (no removals, no rewrites)
- `PLAN/DECISIONS.md` — no decisions added or amended
- `PLAN/STABILITY_SECURITY.md` — left as historical T-* record
- Source code under `src/` and `packages/` — no implementation changes in this sprint

## Verification

- `npm test` 1504/1504 (baseline preserved)
- Code-review: pending main-thread dispatch after Mega-B commit
- Cross-references: new files reference real paths; no rewrites to existing files = no broken refs introduced

## Next sprint candidates

(Not part of V-1 — for the next brainstorm cycle)

1. Close S-GATE-1 owner punch list (per `PLAN/SGATE_1.md`)
2. Implement T-1 missing callers (assertTreasuryFloor in merkle-anchor.js + federation.js) — 2 files, fits ≤2-file bug-fix rule
3. T-2 gate-hash binding (load-bearing per STABILITY_SECURITY.md §6)
