# V-1 Verification Matrix

Date: 2026-05-28
Spec: docs/superpowers/specs/2026-05-28-verification-and-roadmap-reorg-design.md

## Status legend

- `PASS` — feature works end-to-end, evidence cited
- `FAIL` — bug found; fix inline (≤2 files) or filed as roadmap item
- `PARTIAL-DEFERRED` — by-design incomplete; assigned to roadmap phase
- `OWNER-BLOCKED` — code ready, awaits owner secret/wallet/action

## Method legend

- `unit` — existing unit test in `tests/`
- `integration` — existing integration test
- `probe` — runtime probe (dryrun cycle / gate flip on state.json copy / sweep dry-run)
- `static` — code-path read (only when runtime test impractical)

## Matrix

| # | Feature | Source claim | Code (file:line) | Method | Evidence | Status |
|---|---|---|---|---|---|---|
| 1 | D-018 gate (preLaunchVerified) | DECISIONS.md D-018 |  |  |  |  |
| 2 | Treasury 95/5 split (D-017) | DECISIONS.md D-017 |  |  |  |  |
| 3 | Founder-handoff timelock | identity.md / S-035 / FOUNDER_HANDOFF |  |  |  |  |
| 4 | Quorum-CI parseQuorumComments | S-029/S-030 |  |  |  |  |
| 5 | T-5 spend approval gates | STABILITY_SECURITY.md T-5 |  |  |  |  |
| 6 | Cycle retry-backoff | STABILITY_SECURITY.md / cycle reliability |  |  |  |  |
| 7 | Error-log persistent JSONL | observability |  |  |  |  |
| 8 | Atomic writes (safety.js) | safety / state-tamper defense |  |  |  |  |
| 9 | Cron skip-guard | STABILITY_SECURITY.md §1 |  |  |  |  |
| 10 | T-1 WETH floor | STABILITY_SECURITY.md T-1 |  |  |  |  |
| 11 | T-8 performance-based AI routing | STABILITY_SECURITY.md §2 T-8 |  |  |  |  |
| 12 | Provider-neutral inference | feedback_performance_based_ai_routing |  |  |  |  |
| 13 | MiMo / OpenGateway wiring | D-018 #3 |  |  |  |  |
| 14 | Env budget reconcile | recent fix (treasury) |  |  |  |  |
| 15 | T-4 fetchUrl/webSearch envelope | STABILITY_SECURITY.md T-4 |  |  |  |  |
| 16 | Federation handshake | S-021/S-022 / federation.md |  |  |  |  |
| 17 | Repo-spawning (create-orbit-house) | D-009 / S-007 / D-020 |  |  |  |  |
| 18 | Founder-handoff Safe broadcast | S-035 / FOUNDER_HANDOFF |  |  |  |  |
| 19 | SDK public (@orbit-house/sdk) | D-009 |  |  |  |  |
| 20 | Dashboard build (Pages) | D-007 |  |  |  |  |
| 21 | HORIZON_SCANNER dryrun mode | Q domain / HORIZON_SCANNER spec |  |  |  |  |
| 22 | HORIZON_SCANNER classifier LLM | Q domain |  |  |  |  |
| 23 | Proof-cast in-cycle (Farcaster) | D-008 |  |  |  |  |
| 24 | Proof-viewer local CLI | Phase 1 / S-003 verifier |  |  |  |  |
| 25 | Proof-viewer published to npm | Phase 1 / S-003 |  |  |  |  |
| 26 | Merkle anchor (D-012, D-018 gated) | D-012 |  |  |  |  |
| 27 | T-2 gate-hash binding | STABILITY_SECURITY.md T-2 |  |  |  |  |
| 28 | T-3 signed-commit CI check | STABILITY_SECURITY.md T-3 |  |  |  |  |
| 29 | T-6 AI key rotation advisory | STABILITY_SECURITY.md T-6 |  |  |  |  |
| 30 | T-7 30-day expiry on preLaunchVerified | STABILITY_SECURITY.md T-7 |  |  |  |  |
| 31 | deploy-dashboard Pages guard | recent fix Patch Set AK |  |  |  |  |
| 32 | .env.example.tpl shipped (scaffolder) | recent fix Patch Set AK |  |  |  |  |
