# V-1 Verification Matrix

Date: 2026-05-28
Spec: docs/superpowers/specs/2026-05-28-verification-and-roadmap-reorg-design.md

## Status legend

- `PASS` — feature works end-to-end, evidence cited
- `FAIL` — bug found; fix inline (≤2 files) or filed as roadmap item
- `PARTIAL-DEFERRED` — by-design incomplete; assigned to roadmap phase
- `OWNER-BLOCKED` — code ready, awaits owner secret/wallet/action

## Summary

- Total features: 47
- PASS: 39
- FAIL: 0 (fixed inline this sprint: 0; filed as roadmap: 0)
- PARTIAL-DEFERRED: 5 (assigned phases — see PLAN/ROADMAP.md)
- OWNER-BLOCKED: 3 (owner punch list — see PLAN/SGATE_1.md)

## Method legend

- `unit` — existing unit test in `tests/`
- `integration` — existing integration test
- `probe` — runtime probe (dryrun cycle / gate flip on state.json copy / sweep dry-run)
- `static` — code-path read (only when runtime test impractical)

## Matrix

| # | Feature | Source claim | Code (file:line) | Method | Evidence | Status |
|---|---|---|---|---|---|---|
| 1 | D-018 gate (preLaunchVerified) | DECISIONS.md D-018 | src/agent/clanker.js:338-345, src/agent/buyback.js:203-205, src/agent/merkle-anchor.js:288-290, src/agent/federation.js:387, src/agent/treasury-sweep.js:107, src/agent/handoff.js:95-97, src/agent/horizon-scanner.js:406-411 | unit | tests/buyback.test.js:108 (refuses-when-not-verified), tests/clanker-gate.test.js:44-95 (10 cases) | PASS |
| 2 | Treasury 95/5 split (D-017) | DECISIONS.md D-017 | src/agent/config.js:290, src/agent/clanker.js:136-138 (rewardSplit), src/agent/treasury.js:53-54,335-336 | unit | tests/treasury-sweep.test.js 38/38 + tests/treasury.test.js | PASS |
| 3 | Founder-handoff timelock | identity.md / S-035 / FOUNDER_HANDOFF | src/agent/handoff.js:33-34 (7d + 7d extension), :93 assertCanPropose, :313 timelockEndsAt | unit | tests/handoff.test.js + tests/handoff-executor.test.js 36/36 | PASS |
| 4 | Quorum-CI parseQuorumComments | S-029/S-030 | src/agent/governance.js:415 actionTier, :428 parseQuorumComments, :494 evaluateQuorum | unit | tests/quorum*.test.js + tests/governance*.test.js 64/64 | PASS |
| 5 | T-5 spend approval gates (id-only public, recipient private) | STABILITY_SECURITY.md T-5 | src/agent/governance.js approvalIssueBodyPublic() redacts Amount + wallet-address Recipient + Purpose + (external_spend) URL; requestOwnerApproval posts the redacted variant | unit | tests/governance-t5-issue-redaction.test.js 8/8 | PASS |
| 6 | Cycle retry-backoff | STABILITY_SECURITY.md / cycle reliability | src/agent/cycle-backoff.js:35 computeBackoffMs (2^n cap), :61 record, :75 clear | unit | tests/cycle-backoff*.test.js 14/14 | PASS |
| 7 | Error-log persistent JSONL | observability | src/agent/error-log.js:31 MAX_LINES=5000, :32 TRIM_TO=4000, :41 redact, :73 rotateIfNeeded | unit | tests/error-log*.test.js 8/8 | PASS |
| 8 | Atomic writes (safety.js) | safety / state-tamper defense | src/agent/safety.js:143 atomicWriteFile (writes tmp + fsync + rename), 24 callers under src/agent | unit | tests/safety*.test.js + 24 callsites use the helper | PASS |
| 9 | Cron skip-guard | STABILITY_SECURITY.md §1 | src/agent/skip-guard.js:14 sign, :21 verify, :43 drawNextTarget (30-90min), :48 evaluateSkip; src/agent/run.js:361 calls evaluateSkip | unit | tests/skip-guard*.test.js 11/11 | PASS |
| 10 | T-1 WETH floor | STABILITY_SECURITY.md T-1 | src/agent/governance.js:591 assertTreasuryFloor; callers: clanker.js:376, buyback.js:871, merkle-anchor.js executeAnchor, federation.js isFederationEnabled | unit | tests/treasury-floor.test.js + merkle-anchor.test.js (T-1 row) + federation.test.js (T-1 row) | PASS |
| 11 | T-8 performance-based AI routing | STABILITY_SECURITY.md §2 T-8 | src/agent/ai-routing.js:53 orderProviders, :74 recordSuccess, :101 recordFailure, :108-109 demote on 3 failures | unit | tests/ai-routing*.test.js 34/34 | PASS |
| 12 | Provider-neutral inference | feedback_performance_based_ai_routing | src/agent/inference.js:209-217 providers list, :279 chatPath per-provider, :289 fetch chat completions; src/agent/config.js:122 ORBIT_AI_PROVIDERS parse | unit | tests/inference*.test.js + tests/ai-routing*.test.js | PASS |
| 13 | MiMo / OpenGateway wiring (D-018 #3) | D-018 #3 | gh variable list: no ORBIT_AI_* set; gh secret list: no ORBIT_AI_* set | static | code path exists (provider-neutral) but owner has not provisioned secret | OWNER-BLOCKED |
| 14 | Env budget reconcile | recent fix Patch Set (treasury) | src/agent/treasury.js:28-29 init from config, :107-110 reconcile on load, :269-273 remaining computation | unit | tests/treasury*.test.js + tests/ai-food*.test.js 104/104 | PASS |
| 15 | T-4 fetchUrl/webSearch envelope | STABILITY_SECURITY.md T-4 | src/agent/web.js:182-184 UNTRUSTED tags, :190 wrap, :240 trustLevel, :250 provenance; provenance-tagged spend escalation NOT wired in governance.js | static | envelope + URL risk in place; spend escalation half missing | PARTIAL-DEFERRED |
| 16 | Federation handshake | S-021/S-022 / federation.md | src/agent/federation.js:29 MESSAGE_TYPES (HELLO,INTEL_SHARE,CAPABILITY_ADVERTISE), :387 preLaunchVerified gate, :399-400 required fields | unit | tests/federation*.test.js 31/31 | PASS |
| 17 | Repo-spawning (create-orbit-house) | D-009 / S-007 / D-020 | packages/create-orbit-house/bin.js, packages/create-orbit-house/src/, packages/create-orbit-house/templates/ | unit | tests/create-orbit-house*.test.js + tests/spawn*.test.js 72/72 | PASS |
| 18 | Founder-handoff Safe broadcast | S-035 / FOUNDER_HANDOFF | src/agent/handoff-executor.js:35 ADD_OWNER_WITH_THRESHOLD_SELECTOR, :63 build tx data, :88-96 manual broadcast checklist (no auto-broadcast) | static | helper produces tx data + checklist; on-chain broadcast is owner action | PARTIAL-DEFERRED |
| 19 | SDK public (@orbit-house/sdk) | D-009 | packages/orbit-sdk/index.js:1017 module.exports (create, createOrbitClient, exportBundle, projectForDashboard, projectHandoffSlim, projectSpawnSlim, projectFamilySlim, projectErrorsSlim, FILES) | unit | tests/orbit-sdk*.test.js 25/25 | PASS |
| 20 | Dashboard build (Pages) | D-007 | dist/dashboard.json (built), dist/index.html, dist/CNAME, .github/workflows/deploy-dashboard.yml | unit | tests/dashboard*.test.js + tests/build*.test.js 26/26 + dashboard.json present | PASS |
| 21 | HORIZON_SCANNER dryrun mode | Q domain / HORIZON_SCANNER spec | src/agent/horizon-scanner.js:65 dryRun:true default, :289 dryRun filePath, :326-329 dryRun return, :347 summary; src/cli/orbit-horizon.js CLI; memory/horizon-config.json | unit | tests/horizon*.test.js 37/37 | PASS |
| 22 | HORIZON_SCANNER classifier LLM | Q domain | src/agent/horizon-scanner.js:61 classifierModel:"haiku", :167-179 default classifier rejects everything (no live LLM call) | static | LLM-backed classifier not wired; default rejects all | PARTIAL-DEFERRED |
| 23 | Proof-cast in-cycle (Farcaster) | D-008 | src/agent/farcaster.js:10 NEYNAR_CAST_URL, :27 pickTemplate, :60-122 renderers (routine/buyback/refusal/approval/milestone/mistake), :356 summarize, :468 publishCast, :561 cycle integration | unit | tests/farcaster*.test.js 18/18; signer not provisioned (S-GATE-1 punch-list) | OWNER-BLOCKED |
| 24 | Proof-viewer local CLI | Phase 1 / S-003 verifier | packages/proof-viewer/cli.js (summary/show/recent/stats), packages/proof-viewer/index.js, packages/proof-viewer/viewer.js | probe | `node packages/proof-viewer/cli.js --help` prints usage | PASS |
| 25 | Proof-viewer published to npm | Phase 1 / S-003 | packages/proof-viewer/package.json | static | `npm view @orbit-house/proof-viewer` returns 404; not published | PARTIAL-DEFERRED |
| 26 | Merkle anchor (D-012, D-018 gated) | D-012 | src/agent/merkle-anchor.js:14 ledger path, :272 idempotency key, :284-294 enabled+gate+contract guards, :288 preLaunchVerified gate, :318 approval body, :374-386 dryRun default true | unit | tests/merkle*.test.js 16/16 | PASS |
| 27 | T-2 gate-hash binding | STABILITY_SECURITY.md T-2 | src/agent/governance.js D018_CRITERIA + d018CriteriaHash() + assertPreLaunchHashIntegrity() | unit | tests/governance-d018-hash.test.js 6/6 | PASS |
| 28 | T-3 signed-commit CI check | STABILITY_SECURITY.md T-3 | .github/workflows/signed-commit-check.yml:8-9,77,124-128 (ADVISORY when ORBIT_SIGN_ENFORCE!=true); .github/CODEOWNERS | static | advisory mode shipped; ENFORCE requires owner-set ORBIT_SIGN_ENFORCE=true + GPG signer | OWNER-BLOCKED |
| 29 | T-6 AI key rotation advisory | STABILITY_SECURITY.md T-6 | src/agent/ai-key-rotation.js evaluateAiKeyRotation() + ROTATION_ISSUE_LABEL | unit | tests/ai-key-rotation.test.js 9/9 | PASS |
| 30 | T-7 30-day expiry on preLaunchVerified | STABILITY_SECURITY.md T-7 | src/agent/governance.js PRE_LAUNCH_MAX_AGE_MS + assertPreLaunchNotExpired() | unit | tests/governance-d018-expiry.test.js 8/8 | PASS |
| 31 | deploy-dashboard Pages guard (PAGES_ENABLED) | recent fix Patch Set AK | .github/workflows/deploy-dashboard.yml:29-33,69 (workflow_dispatch only fires when vars.PAGES_ENABLED == 'true'), :78 actions/deploy-pages@v5 | static | guard explicit in workflow | PASS |
| 32 | .env.example.tpl shipped (scaffolder) | recent fix Patch Set AK | packages/create-orbit-house/templates/.env.example.tpl (43 lines, all placeholder env vars listed) + .gitignore:5 `!.env.example.tpl` allowlist; packages/create-orbit-house/package.json `files: ["templates/"]` packages the file | static | file present on disk + allowlist in place + npm `files` includes templates/ | PASS |
| 33 | Wallet-signed cycle proofs (D-006) | DECISIONS.md D-006 / ROADMAP.md A | src/agent/proof-signing.js:69 signProof, :88-90 isSigned guard; src/agent/proof-canonical.js:6 SIGNATURE_ENVELOPE_KEYS | unit | tests/proof-signing.test.js 14/14 | PASS |
| 34 | Standalone verifier CLI (S-003) | PHASES.md S-003 / ROADMAP.md A | packages/orbit-verifier/cli.js, packages/orbit-verifier/canonical.js, packages/orbit-verifier/index.js | unit | tests/orbit-verifier.test.js 10/10 | PASS |
| 35 | Adopter registry + handshake | ROADMAP.md K / adopter sovereignty | src/agent/adopters.js:38 buildEmptyRegistry, :58 parseHandshakeIssue, :74 validateHandshake, :104 rateLimit, :135 processHandshakes; memory/adopters-registry.json | unit | tests/adopter*.test.js 21/21 | PASS |
| 36 | Scam scanner (issue-scam-scanner) | ROADMAP.md F | src/agent/scam.js:48 extractUrls, :60 scanUrl, :79 riskLevel, :87 scanTextRisk, :126 scanSpendIntent; packages/issue-scam-scanner/ | unit | tests/issue-scam-scanner.test.js 31/31 | PASS |
| 37 | Autonomous spawn (D-AD) | Patch Set AD | src/agent/spawn.js, src/agent/spawn-executor.js, src/cli/orbit-spawn.js | unit | tests/spawn*.test.js 26/26 | PASS |
| 38 | npm run health (preflight) | PHASES.md S-GATE-1 #1 / D-018 #1 | src/cli/health.js (required vs optional ledger files); src/cli/orbit-preflight.js; src/cli/orbit-healthcheck.js | unit | tests/health*.test.js 4/4 | PASS |
| 39 | Well-known passport + .well-known/orbit.json | ROADMAP.md I / federation | src/agent/well-known.js | unit | tests/well-known*.test.js 8/8 | PASS |
| 40 | Mission board | ROADMAP.md I / Phase 3 (S-MB) | src/agent/missions.js; memory/missions.json | unit | tests/missions*.test.js 16/16 | PASS |
| 41 | Bus-factor (founder-fade metric) | identity.md / Phase 5 founder-fade | src/agent/bus-factor.js + src/agent/bus-factor-data.js | unit | tests/bus-factor*.test.js 34/34 | PASS |
| 42 | Launch validator (pre-deploy gate) | CLANKER_FEE_STRATEGY.md / D-018 #8 | src/agent/launch-validator.js; src/cli/orbit-launch-validate.js | unit | tests/launch-validator*.test.js 34/34 | PASS |
| 43 | Keygen package (signer key provisioning) | DEPLOY_PLAN.md / S-008 | packages/orbit-keygen/bin.js, packages/orbit-keygen/src/ | unit | tests/keygen.test.js 45/45 | PASS |
| 44 | MCP server (SDK MCP bridge) | PHASES.md S-031/S-032 / Phase 4 | packages/orbit-mcp-server/bin.js, packages/orbit-mcp-server/src/ | unit | tests/mcp-server.test.js 17/17 | PASS |
| 45 | Vanity Safe address tool | PLAN/SPECS/TREASURY_KEYS_BACKUP / D-019 | packages/orbit-vanity-safe/ | unit | tests/vanity-safe.test.js 34/34 | PASS |
| 46 | Plugin loader (@orbit/tool-*) | ROADMAP.md J / Phase 3 | src/agent/plugin-loader.js; packages/orbit-tool-example/ | static | code in place; full plugin economy is Phase 3 | PARTIAL-DEFERRED |
| 47 | Error-log monthly compaction (F-1.5) | ROADMAP_EXPANSION.md F-1.5 | src/agent/error-log.js compactOldEntries() + COMPACTION_MAX_AGE_DAYS | unit | tests/error-log-compaction.test.js 9/9 | PASS |
