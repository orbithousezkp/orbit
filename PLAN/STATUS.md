# Orbit — STATUS

> Live session tracker. Updated at every session close.

---

## Delivery Config

| Field | Value |
|---|---|
| GITHUB | yes — private build repo (location managed by owner) |
| BRANCH | main |
| PUBLIC REPO | `/home/asuran/Downloads/orbit` (this repo) |
| PUBLIC DOMAIN | orbit.horse |

---

## INIT SESSION

| ID | Name | Type | Status | Output |
|----|------|------|--------|--------|
| S-001 | Plan compilation + Clanker fee research | S-PLAN | DONE 2026-05-23 | `PLAN/` directory with 9 documents |

---

## CURRENT STATE

```
LAST SESSION      : S-MB-W — Mission Board widget shipped (Phase 1/2 scope, no token)
LAST UPDATED      : 2026-05-25
CURRENT PHASE     : Phase 1 — Launch-Ready (Pre-Token) — engineering COMPLETE, owner-gated
NEXT SESSION      : S-009 (closed-loop demo execution, owner-driven) or wait on S-GATE-1 owner punch list; S-MB-2 (mission board staking build) blocked behind S-GATE-3
GATE STATUS       : S-GATE-1 OPEN — 7-item owner punch list (PLAN/SGATE_1.md)
OPEN BLOCKERS     : Owner actions — enable GitHub Pages; set ORBIT_AGENT_SIGNER; provision Farcaster signer; deploy Treasury Safe; `npm publish --access public` (orbit-sdk + create-orbit-repo); set ORBIT_AI_PROVIDERS keys; verify 12h clean Actions stretch
```

---

## SESSION TABLE

| ID | Type | Name | Status | Output |
|----|------|------|--------|--------|
| S-001 | S-PLAN | Plan compilation + Clanker fee research | DONE 2026-05-23 | PLAN/ directory: MASTER_PLAN, CLANKER_FEE_STRATEGY, DAY_1, PHASES, ROADMAP, BRAND, DEPLOY_PLAN, DECISIONS, RISKS, STATUS |
| S-002 | S-BUILD | Wallet-signed cycle proofs (D-006) | DONE 2026-05-24 | EIP-712 signing on every cycle; `src/agent/proof-signing.js` + `proof-canonical.js`; `@orbit-house/verifier` package; signed proofs verifiable via verifier CLI |
| S-003 | S-BUILD | Public dashboard for orbit.horse (D-007) | DONE 2026-05-24 | `projectForDashboard` SDK helper; cycle writes `public/dashboard.json` (≤60KB cap); React Dashboard renders all spec sections; bundle 66.5KB gz; GitHub Pages workflow `deploy-dashboard.yml` + `public/CNAME` shipped |
| S-004 | S-BUILD | Farcaster cast pipeline (D-008) | DONE 2026-05-24 | `src/agent/farcaster.js` (pickTemplate, renderCast, scanOutbound, publishCast, postCycleCast); `cast_to_farcaster` tool + handler; cycle posts at end of `main()` (dry-run default TRUE); workflow env in orbit-cycle.yml + orbit-event.yml |
| S-005 | S-BUILD | Publish-ready @orbit-house/sdk + create-orbit-repo (D-009) | DONE 2026-05-24 | `packages/orbit-sdk` publish-ready (8KB tarball, 14 exports, MIT LICENSE); `packages/create-orbit-repo` full scaffolder (bin.js + 11 templates, atomic rollback, path-traversal guard) |
| S-006 | S-BUILD | Closed-loop demo runbook + integration test | DONE 2026-05-24 | `PLAN/SPECS/CLOSED_LOOP_DEMO.md` + `tests/closed-loop-demo.test.js` covering refill-request → approval → record → next-call chain |
| S-007 | S-BUILD | Lore foundation (00-genesis, voice, cycles-of-note) | DONE 2026-05-24 | `lore/00-genesis.md`, `lore/voice.md`, `lore/cycles-of-note/`, `lore/README.md` |
| S-008 | S-PLAN | Treasury Safe deploy runbook | DONE 2026-05-24 | `PLAN/SPECS/TREASURY_SAFE_DEPLOY.md` (8-item checklist) — owner runs deploy |
| S-010 | S-REVIEW | Phase 1 review + 14-day stabilization | DONE 2026-05-24 | `PLAN/REVIEW_PHASE_1.md` — full honest engineering review; D-018 gate at 1 MET / 3 PARTIAL / 4 NOT-MET |
| S-014 | S-BUILD | Buyback automation (Phase 2, pre-staged) | DONE 2026-05-24 | `src/agent/buyback.js` + `tests/buyback.test.js`; DRY_RUN-locked; D-018 gate enforced (`state.preLaunchVerified`) |
| S-015 | S-BUILD | Daily Merkle anchor builder + contract spec (Phase 2, pre-staged) | DONE 2026-05-24 | `src/agent/merkle-anchor.js` + `tests/merkle-anchor.test.js`; `packages/orbit-anchor/contracts/MerkleAnchor.sol`; `PLAN/SPECS/MERKLE_ANCHOR.md` |
| S-017 | S-BUILD | Refusal logging public surface (Phase 2, pre-staged) | DONE 2026-05-24 | Dashboard refusals tab live; sanitized through `sanitizePublicArtifact`; capped at 20 entries; under 30KB projection |
| S-019/S-020 | S-PLAN/S-BUILD | Bounty market spec | DONE 2026-05-24 | `PLAN/SPECS/BOUNTY_MARKET.md` |
| S-021/S-022/S-023 | S-PLAN/S-BUILD | Federation protocol — envelope verification | DONE 2026-05-24 | `src/agent/federation.js` + `tests/federation.test.js`; `PLAN/SPECS/FEDERATION.md`; quarantine pipeline (shape/sig/risk/replay) |
| S-025 | S-PLAN | Per-repo subscription tier spec | DONE 2026-05-24 | `PLAN/SPECS/SUBSCRIPTION_TIER.md` |
| S-026 | S-PLAN | Bounty referral across orbits spec | DONE 2026-05-24 | `PLAN/SPECS/BOUNTY_REFERRAL.md` |
| S-027 | S-PLAN | Treasury productive deployment spec | DONE 2026-05-24 | `PLAN/SPECS/TREASURY_PRODUCTIVE.md` |
| S-031 | S-PLAN | MCP/HTTP bridge spec | DONE 2026-05-24 | `PLAN/SPECS/MCP_BRIDGE.md` |
| S-033 | S-PLAN | Plugin marketplace + reputation spec | DONE 2026-05-24 | `PLAN/SPECS/PLUGIN_MARKETPLACE.md` |
| S-034 | S-PLAN | Holder utility — priority queue, premium rules spec | DONE 2026-05-24 | `PLAN/SPECS/HOLDER_UTILITY.md` |
| S-035 | S-PLAN | Founder handoff narrative spec | DONE 2026-05-24 | `PLAN/SPECS/FOUNDER_HANDOFF.md` |
| S-Phase4-5 | S-PLAN | Phase 4-5 outlook | DONE 2026-05-24 | `PLAN/SPECS/PHASE_4_5_OUTLOOK.md` |
| S-MB-1 | S-PLAN | Public Mission Board protocol spec | DONE 2026-05-25 | `PLAN/SPECS/MISSION_BOARD.md` — 14-section spec; lifecycle (10 states), stake contract interface, verifier reuse from BOUNTY_MARKET §5 plus 3 new refusal codes, D-014 approval gate, D-018 + S-GATE-3 hard-block, federation hooks deferred to S-MB-3 |
| S-MB-W | S-BUILD | Mission Board widget (Phase 1/2) | DONE 2026-05-25 | `src/agent/missions.js` (parser + scanner + projection); `tests/missions.test.js` (17 cases); `.github/ISSUE_TEMPLATE/mission.yml`; SDK `projectForDashboard` exposes `missions: { active, total, list }` slice; cycle writes `memory/missions.json` each run. No staking, no on-chain action — the proposer-stake market lives in S-MB-2 behind S-GATE-3. |
| S-024 | S-BUILD | Plugin/tool loader for `@orbit-house/tool-*` | DONE 2026-05-24 | `src/agent/plugin-loader.js` + `tests/plugin-loader.test.js` (31 tests); `PLAN/SPECS/PLUGIN_LOADER.md`; `packages/orbit-tool-example/` reference scaffold; capability allowlist + sanitizeToolResponse + ORBIT_ENABLE_PLUGINS gate |
| S-029/S-030 | S-PLAN/S-BUILD | Multi-maintainer quorum | DONE 2026-05-24 | additive edits to `src/agent/governance.js` + `src/agent/config.js` (`computeThresholds`, `parseQuorumComments`, `evaluateQuorum`, `requiresQuorum`); `tests/governance-quorum.test.js` (26 tests); `PLAN/SPECS/MULTI_MAINTAINER_QUORUM.md`; existing `tests/governance.test.js` unchanged |
| S-009 | S-BUILD | Closed-loop demo EXECUTION | OWNER-PENDING | needs live Actions cycle (runbook + test ready) |
| S-011 | S-PLAN | Clanker v4 deploy dry run | PENDING — owner action | needs `ORBIT_AGENT_SIGNER` set + S-GATE-1 closed |
| S-012 | S-BUILD | Token deploy execution | PENDING — owner action | requires S-GATE-1 closed + D-018 gate passing |
| S-013+ | — | Post-launch (genesis cycle, ongoing Phase 2) | PENDING | requires S-012 |
| S-016 | S-BUILD | Adopter onboarding push (5 repos target) | PENDING | outreach not begun |
| S-018 | S-REVIEW | Phase 2 review | PENDING | requires Phase 2 sessions to run |
| S-028 | S-REVIEW | Phase 3 review | PENDING | requires Phase 3 sessions to run |
| S-032 | S-BUILD | MCP server exposing Orbit read surface | PENDING | spec ready (S-031) |
| S-036 | S-REVIEW | Phase 4 review | PENDING | requires Phase 4 sessions to run |

---

## OPEN BLOCKERS

| Blocker | Blocking session | Logged | Resolved |
|---|---|---|---|
| GitHub Pages not enabled (Settings → Pages → Source: GitHub Actions) | S-GATE-1 #6 | 2026-05-24 | — |
| `ORBIT_AGENT_SIGNER` repo variable unset | Signed-proof verification chain | 2026-05-24 | — |
| Farcaster signer (Neynar API key + signer UUID) not provisioned | S-GATE-1 #4 | 2026-05-24 | — |
| Treasury Safe not deployed on Base | S-GATE-1 #7, D-018 #7 | 2026-05-24 | — |
| `@orbit-house` npm org not registered + packages unpublished | SDK distribution | 2026-05-24 | — |
| `ORBIT_AI_PROVIDERS` / `ORBIT_AI_PROVIDER_KEYS` not configured | D-018 #3 | 2026-05-24 | — |
| 12-hour clean Actions stretch not yet observed | D-018 #4, S-GATE-1 #1 | 2026-05-24 | — |

---

## INTEGRATION GATES

| Gate | Session | What it proves | Status |
|------|---------|----------------|--------|
| S-GATE-1 | After S-010 | Phase 1 ready — signed proofs, dashboard, casts, second adopter, closed-loop demo, 14-day stable cycles | **OPEN** — engineering DONE; 7-item owner punch list outstanding (PLAN/SGATE_1.md). NOT CLOSED. |
| S-GATE-2 | After S-018 | Token launched, 30-day stable cycles, first buyback executed, Merkle anchor live | TODO |
| S-GATE-3 | After S-028 | Token utility live (bounty market, subscription, federation, plugin economy) | TODO |
| S-GATE-4 | After S-036 | Network effect (≥50 adopters, external agent reads passport, treasury productive) | TODO |
| S-GATE-5 | TBD | Persistence + spec (≥3 external implementations, ZK or smart-account shipped) | TODO |

---

## S-GATE-1 VERDICT

**NOT CLOSED.** Engineering for Phase 1 is complete; live launch is blocked on 7 owner actions tracked in `PLAN/SGATE_1.md`:

1. Enable GitHub Pages
2. Set `ORBIT_AGENT_SIGNER` repo variable
3. Provision Farcaster signer (Neynar)
4. Deploy Treasury Safe on Base
5. `npm publish --access public` for `@orbit-house/sdk` and `create-orbit-repo`
6. Configure AI provider keys
7. Verify 12-hour clean Actions cron stretch

Do NOT propose token-launch work (S-011+) until owner closes those items.

---

## ENGINEERING HEALTH SNAPSHOT (2026-05-24)

| Metric | Value |
|---|---|
| Tests | 422 pass / 0 fail / 0 skipped |
| Lint | clean (`node --check` across src/agent + src/cli) |
| Build | 215.61 KB raw / 66.54 KB gz (CSS 29.45 / 7.11 gz) — under 80 KB budget |
| Health | 34 OK / 0 FAIL (runtime-config flags ORBIT_AI_PROVIDERS not yet set — expected) |
| Specs in `PLAN/SPECS/` | 18 |
| Packages in `packages/` | 5 (orbit-sdk, orbit-verifier, create-orbit-repo, orbit-anchor, issue-scam-scanner) |

---

## THREAT MODEL LOG

| Session | Scope | Key threats identified |
|---------|-------|----------------------|
| S-003 (planned) | Full project | Will be filled when S-003 runs — see RISKS.md for current top risks |
| S-010 | Phase 1 review | See REVIEW_PHASE_1.md Risk Register Delta |

---

## DECISIONS LOG (summary)

| ID | Session | One-line summary |
|----|---------|-----------------|
| D-001 | S-001 | Use ClaudeCodex protocol structure for plan + future build sessions |
| D-002 | S-001 | All Clanker fee recipients accrue in WETH (Paired), not $ORBIT |
| D-003 | S-001 | Deploy via clanker.world frontend, NOT @clanker Farcaster bot |
| D-004 | S-001 | Treasury custody is Safe multisig 2-of-3 on Base before token deploy |
| D-005 | S-001 | Weekly $ORBIT buybacks funded from WETH balance, under approval gate |
| D-006 | S-001 | Every cycle proof signed with agent wallet key before launch |
| D-007 | S-001 | Public dashboard hosted at orbit.horse, separate from household-UI app |
| D-008 | S-001 | Farcaster casting wired into cycle loop, not external automation |
| D-009 | S-001 | SDK published as `@orbit-house/sdk` on npm |
| D-010 | S-001 | Founder ↔ Orbit voice separation, two accounts |
| D-011 | S-001 | ZK trust layer deferred to year 2+; signed-proofs-only at launch |
| D-012 | S-001 | Daily Merkle root anchored on Base in Phase 2 |
| D-013 | S-001 | Two ladders in roadmap (GitHub-native + Wallet/Trust); GitHub-native leads |
| D-014 | S-001 | No on-chain action without approval issue + signed receipt |
| D-015 | S-001 | Use ClankerHookStaticFee with asymmetric fees (1% buy / 2% sell) at launch |
| D-018 | S-002 | Token launch hard-blocked behind 8-criteria gate enforced in `src/agent/governance.js` (preLaunchVerified) |

---

## LEARNINGS LOG (summary)

| ID | Session | One-line implication |
|----|---------|---------------------|
| L-001 | S-001 | Clanker v4 protocol fee is fixed 20%; max creator share is 80% across up to 7 recipients |
| L-002 | S-001 | Recipients can choose `Paired` (WETH) or `Clanker` ($ORBIT) or `Both` for reward denomination — critical lever for dump-resistant treasury |
| L-003 | S-001 | clanker.world frontend deploys have more recipient flexibility than @clanker bot deploys |
| L-004 | S-001 | Repo already has clanker-sdk + viem + signing-key plumbing — closed-loop demo is feasible with no new dependencies |
| L-005 | S-001 | "Mission control" framing already used internally (`memory/strategy.md`) — natural language to lean into externally too |

---

## TECH STACK VERIFICATION LOG

| Session | Dependencies verified | Any new advisories | Source |
|---------|-----------------------|--------------------|--------|
| S-001 | Clanker v4 SDK + protocol fees | None blocking | Clanker docs gitbook (2026), DefiLlama, KuCoin News, Bankless, Messari |
| S-FINAL | npm test 422/0, lint clean, build 66.54KB gz | None | local run 2026-05-24 |

---

## DEPLOY PLAN CHANGE LOG

| Session | Change | Section updated |
|---------|--------|-----------------|
| S-001 | Initial deploy plan created. Domain (orbit.horse), Safe treasury, Clanker fee config locked. All env vars inventoried. | All sections |

---

## NEXT SESSION

```
NEXT SESSION INFO:
  ID    : S-009 (owner-driven, closed-loop demo execution) or hold for S-GATE-1 close
  Type  : OWNER-PENDING
  Focus : All Phase 1 + Phase 2/3/4 pre-staged engineering is DONE.
          The wall is S-GATE-1 (7-item owner punch list in PLAN/SGATE_1.md).
          Do NOT propose token-launch work (S-011+) until owner closes those items.
  Read  : PLAN/SGATE_1.md (gate state), PLAN/REVIEW_PHASE_1.md (Phase 1 sign-off),
          PLAN/SPECS/PHASE_4_5_OUTLOOK.md (Phase 4-5 critical path)
  Note  : Phase 2 code (buyback, Merkle anchor) ships behind D-018 hard-block.
          Phase 3-4 specs are all written (subscription, bounty referral, productive
          treasury, MCP bridge, plugin marketplace, holder utility, founder handoff).
          Plugin loader and multi-maintainer quorum are live in code with tests.
```
