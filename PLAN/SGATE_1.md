# S-GATE-1 — Phase 1 Sign-Off

> Gate evaluation for Phase 1 → Phase 2 transition.

## Status

| Field | Value |
|---|---|
| Gate ID | S-GATE-1 |
| Opened | 2026-05-24 |
| Current status | OPEN — 3 of 7 owner punch-list items still pending (Farcaster, Safe, T-3 enforce). 24-cycle stretch in progress (10/24 as of 2026-05-29). |
| Closes | when all criteria below mark ✅ |
| Decision references | D-006, D-007, D-008, D-009, D-014, D-018 |

## Criteria (verbatim from PHASES.md)

| # | Criterion | State | Owner sign-off |
|---|---|---|---|
| 1 | 14 consecutive days of cycles with zero broken runs | NOT-MET (only Actions can produce) | [ ] |
| 2 | Signed proofs working in every cycle | MET (engineering) | [ ] |
| 3 | Public dashboard live on GitHub Pages | MET — live at https://orbit.horse (custom domain, HTTPS enforced, 2026-05-29) | [x] |
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
| 2 | tests 0 fail | MET — 1571/0 (2026-05-29) |
| 3 | AI provider configured | MET — freemodel vip-sg gpt-5.5, 8/8 success on cycle #64 |
| 4 | 12-hour clean Actions stretch | IN-PROGRESS — 10 consecutive clean cycles (#55-#64) as of 2026-05-29 |
| 5 | Signed proofs verifiable via `npx @orbithouse/verifier` | MET (code) |
| 6 | Dashboard reachable | MET — https://orbit.horse (2026-05-29) |
| 7 | Treasury Safe live | NOT-MET |
| 8 | Pre-deploy checklist complete | PARTIAL |

## Owner Closing Checklist

> **Use `PLAN/OWNER_PUNCH_LIST.md` for the executable, copy-pasteable version of this list with exact commands.**
> The summary below is for cross-reference only.

Each item links to its runbook. Owner ticks when done; date and proof URL.

- [x] **Enable GitHub Pages** — Done: 2026-05-29 Proof: https://orbit.horse (custom domain, HTTPS enforced)
- [x] **Set `ORBIT_AGENT_SIGNER` repo variable** — Done: 2026-05-29 Proof: `0x58211f54ee90fb403dec9cd57e8407f9963adaed`
- [ ] **Provision Farcaster signer** — runbook: `~/Downloads/orbitbackup/gh-secrets-helper.html` + `PLAN/SPECS/FARCASTER_CAST_PIPELINE.md` §10. Done: ____ Proof: ____
- [ ] **Deploy Treasury Safe on Base** — runbook: `PLAN/OWNER_PUNCH_LIST.md` §6 + `PLAN/SPECS/TREASURY_SAFE_DEPLOY.md` (8 checks). Done: ____ Safe address: ____ Test tx: ____
- [x] **Publish SDK + scaffolder + proof-viewer to npm** — Done: 2026-05-29 Versions: `@orbithouse/sdk@0.1.0`, `create-orbit-house@0.1.0`, `@orbithouse/proof-viewer@0.1.0`, `@orbithouse/keygen@0.1.0`, `@orbithouse/mcp-server@0.1.0`
- [x] **Configure AI provider** — Done: 2026-05-29 Provider: freemodel vip-sg gpt-5.5 (OpenAI shape, 8/8 success on cycle #64)
- [ ] **Verify 12-hour clean cycle stretch** — IN-PROGRESS — 10 consecutive clean cycles (#55-#64) as of 2026-05-29. Hourly cron at `7 * * * *`, ~14 more needed.

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
