# S-GATE-1 — Phase 1 Sign-Off

> Gate evaluation for Phase 1 → Phase 2 transition.

## Status

| Field | Value |
|---|---|
| Gate ID | S-GATE-1 |
| Opened | 2026-05-24 |
| Current status | OPEN — pending owner closure of 7 punch-list items |
| Closes | when all criteria below mark ✅ |
| Decision references | D-006, D-007, D-008, D-009, D-014, D-018 |

## Criteria (verbatim from PHASES.md)

| # | Criterion | State | Owner sign-off |
|---|---|---|---|
| 1 | 14 consecutive days of cycles with zero broken runs | NOT-MET (only Actions can produce) | [ ] |
| 2 | Signed proofs working in every cycle | MET (engineering) | [ ] |
| 3 | Public dashboard at orbit.horse stable | PARTIAL (workflow ready) | [ ] |
| 4 | ≥1 daily Farcaster cast for 14 days | NOT-MET (signer not provisioned) | [ ] |
| 5 | ≥1 second adopter repo running Orbit | NOT-MET (S-016 outreach) | [ ] |
| 6 | Closed-loop demo run successfully once | NOT-MET (runbook ready) | [ ] |
| 7 | Treasury Safe deployed and funded on Base | NOT-MET (S-008 runbook) | [ ] |
| 8 | Lore foundation written | MET | [ ] |

## D-018 Gate (Token-Launch Hard-Block)

S-GATE-1 must close BEFORE D-018 #4 (12-hour clean cycle stretch) can be marked. The 14-day stable-cycles criterion (#1 above) is a superset.

| D-018 # | Item | State |
|---|---|---|
| 1 | health 0 FAIL, 0 OPEN BLOCKERS | PARTIAL |
| 2 | tests 0 fail | MET — 365/0 |
| 3 | AI provider configured | NOT-MET |
| 4 | 12-hour clean Actions stretch | NOT-MET |
| 5 | Signed proofs verifiable via `npx @orbit-house/verifier` | MET (code) |
| 6 | Dashboard reachable | PARTIAL |
| 7 | Treasury Safe live | NOT-MET |
| 8 | Pre-deploy checklist complete | PARTIAL |

## Owner Closing Checklist

Each item links to its runbook. Owner ticks when done; date and proof URL.

- [ ] **Enable GitHub Pages** — runbook: `PLAN/DEPLOY_PLAN.md` "orbit.horse specifics". Done: ____ Proof: ____
- [ ] **Set `ORBIT_AGENT_SIGNER` repo variable** — runbook: `PLAN/DEPLOY_PLAN.md` env inventory. Done: ____ Proof: ____
- [ ] **Provision Farcaster signer** — runbook: `PLAN/SPECS/FARCASTER_CAST_PIPELINE.md` §10. Done: ____ Proof: ____
- [ ] **Deploy Treasury Safe on Base** — runbook: `PLAN/SPECS/TREASURY_SAFE_DEPLOY.md` (8 checks). Done: ____ Safe address: ____ Test tx: ____
- [ ] **Publish SDK and scaffolder to npm** — `npm publish --access public` from each package dir. Done: ____ Versions: ____
- [ ] **Configure AI provider** — set `ORBIT_AI_PROVIDERS` + `ORBIT_AI_PROVIDER_KEYS`. Done: ____
- [ ] **Verify 12-hour clean cycle stretch** — observe Actions cron for 24 consecutive cycles. Record cycle range in `memory/state.json` (`firstCleanCycle`, `lastCleanCycle`) and flip `state.preLaunchVerified = true`. Done: ____ Range: ____ — ____

## Escalation

If any item remains open 14 days after this gate opened (2026-06-07):
- Re-plan: open a new session to address the blocker
- Public communication: "Phase 1 delayed because X" cast template in `PLAN/BRAND.md`
- DO NOT silently skip — D-018 enforces this engineering-side

## Gate Closure

When all checklist items above are ticked AND all 8 PHASES.md criteria are MET, owner appends below:

```
GATE CLOSED: ____ (date)
Signed by: ____ (owner GitHub handle)
Next session: S-011 — Clanker v4 deploy dry run
```
