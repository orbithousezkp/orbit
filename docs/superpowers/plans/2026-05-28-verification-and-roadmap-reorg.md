# V-1 Verification + Roadmap Reorg + Roadmap Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Verify every feature on `main` works end-to-end, reorg PLAN/ into clean Phase 1–5 structure, add 30 planned feature entries (F-1.1 … F-5.6) to roadmap. No new feature implementation.

**Architecture:** Single-session sprint with verification-then-reorg ordering. Verification produces `PLAN/VERIFICATION_MATRIX.md` (one row per feature with method/evidence/status). Reorg rewrites `PLAN/PHASES.md` + `PLAN/ROADMAP.md` against the verified state. Expansion appends `PLAN/ROADMAP_EXPANSION.md` from the spec. Changes summarized in `PLAN/ROADMAP_CHANGES.md`. Bug fixes inline only if ≤2 files; larger bugs become roadmap entries.

**Tech Stack:** Node.js test runner (`node --test`), shell, markdown, grep. No new dependencies.

**Spec reference:** `docs/superpowers/specs/2026-05-28-verification-and-roadmap-reorg-design.md`

---

## Working invariants (enforced by every task)

- Tests must continue to pass: `npm test` ≥ 1504/1504 after every code change
- No file delete without first checking grep for cross-references in `PLAN/`, `docs/`, `README.md`, `memory/identity.md`
- All matrix rows must have a real file:line reference (not "see code" or "exists")
- Status values are strictly one of: `PASS`, `FAIL`, `PARTIAL-DEFERRED`, `OWNER-BLOCKED`
- Bug fixes ≤2 files per fix; bigger problems become a roadmap entry, never a refactor
- Commit cadence: one logical change per commit

---

## Task 1: Build feature catalog from existing artifacts

**Files:**
- Read: `memory/identity.md`, `PLAN/PHASES.md`, `PLAN/DECISIONS.md`, `PLAN/STABILITY_SECURITY.md`, `PLAN/SGATE_1.md`, `PLAN/ROADMAP.md`
- Create: `PLAN/VERIFICATION_MATRIX.md` (skeleton only)

- [ ] **Step 1.1: Read each PLAN/ source file end-to-end**

Run:
```bash
for f in memory/identity.md PLAN/PHASES.md PLAN/DECISIONS.md PLAN/STABILITY_SECURITY.md PLAN/SGATE_1.md PLAN/ROADMAP.md; do
  echo "=== $f ==="
  wc -l "$f"
done
```

For each file, list every distinct feature/decision/criterion claimed. Target output: a scratch list of ~30 feature names in the working buffer.

- [ ] **Step 1.2: Cross-check against shipped code**

Run:
```bash
ls src/agent/ src/cli/ packages/ 2>&1 | sort
```

Compare to scratch list. Add any code-shipped feature not yet in the list. Drop any list entry that has no code (e.g., aspirations from MASTER_PLAN.md that never landed).

- [ ] **Step 1.3: Create VERIFICATION_MATRIX.md skeleton with all rows**

Create file `PLAN/VERIFICATION_MATRIX.md`:

```markdown
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
<!-- rows populated by tasks 3–8 -->
```

Add one row per feature from steps 1.1+1.2 with the `Feature` and `Source claim` columns populated; leave the rest empty.

- [ ] **Step 1.4: Commit catalog skeleton**

```bash
git add PLAN/VERIFICATION_MATRIX.md
git commit -m "docs(v1): add verification matrix skeleton with feature catalog"
```

---

## Task 2: Verify governance + treasury features (batch A)

**Files:**
- Modify: `PLAN/VERIFICATION_MATRIX.md` (fill rows for D-018, S-GATE-1, treasury 95/5, founder-handoff, quorum-CI)
- Read: `src/agent/governance.js`, `src/agent/treasury-sweep.js`, `src/agent/handoff.js`, `tests/governance*.test.js`, `tests/treasury*.test.js`, `tests/handoff*.test.js`

- [ ] **Step 2.1: Verify D-018 gate (preLaunchVerified)**

Run:
```bash
grep -n "preLaunchVerified" src/agent/governance.js src/agent/clanker.js src/agent/handoff.js src/agent/horizon-scanner.js src/agent/buyback.js src/agent/federation.js src/agent/merkle-anchor.js src/agent/treasury-sweep.js
grep -rn "preLaunchVerified" tests/ | head -20
```

Expected: predicate defined in `governance.js`, called from ≥6 modules, ≥1 test asserts blocking when `preLaunchVerified !== true`.

Fill row in `PLAN/VERIFICATION_MATRIX.md`:
```markdown
| 1 | D-018 gate (preLaunchVerified) | DECISIONS.md D-018 | src/agent/governance.js:548-658 | unit | tests/buyback.test.js (refuses-when-not-verified) | PASS |
```

- [ ] **Step 2.2: Verify treasury 95/5 split (D-017)**

Run:
```bash
grep -n "operatorRevenueBps\|rewardSplit\|treasuryShareBps" src/agent/config.js src/agent/clanker.js src/agent/treasury.js src/agent/treasury-sweep.js
node --test tests/treasury-sweep.test.js 2>&1 | tail -5
```

Expected: `operatorRevenueBps` in config, `rewardSplit()` returns `treasuryShareBps = 10000 - operatorRevenueBps`, sweep test passes.

Fill row:
```markdown
| 2 | Treasury 95/5 split (D-017) | DECISIONS.md D-017 | src/agent/clanker.js:140-145 | unit | tests/treasury-sweep.test.js | PASS |
```

- [ ] **Step 2.3: Verify founder-handoff 7-day timelock**

Run:
```bash
grep -n "TIMELOCK_MS\|EXTENSION_MS\|assertCanPropose" src/agent/handoff.js
node --test tests/handoff*.test.js 2>&1 | tail -5
```

Expected: 7-day constant, pre-launch refusal at proposal time, quorum prerequisite, tests pass.

Fill row:
```markdown
| 3 | Founder-handoff timelock | FOUNDER_HANDOFF.md, S-035 | src/agent/handoff.js:33-34 | unit | tests/handoff.test.js + tests/handoff-executor.test.js | PASS |
```

- [ ] **Step 2.4: Verify Quorum-CI (parseQuorumComments)**

Run:
```bash
grep -n "parseQuorumComments\|actionTier\|quorumThreshold" src/agent/governance.js
node --test tests/quorum*.test.js tests/governance*.test.js 2>&1 | tail -5
```

Fill row:
```markdown
| 4 | Quorum-CI (multi-maintainer) | S-029/S-030 | src/agent/governance.js (parseQuorumComments) | unit | tests/quorum.test.js | PASS |
```

- [ ] **Step 2.5: Verify spend approval gates (T-5 status check)**

Run:
```bash
sed -n '193,259p' src/agent/governance.js | head -80
grep -n "approval" memory/approvals.json 2>/dev/null | head
```

Expected: spend approval encoded as ID + amount currently in same payload. T-5 (SHA256 id only) is PENDING per STABILITY_SECURITY.md.

Fill row:
```markdown
| 5 | Public approval threads (T-5) | STABILITY_SECURITY.md T-5 | src/agent/governance.js:193-259 | static | leaks amount+recipient in issue body | PARTIAL-DEFERRED |
```

- [ ] **Step 2.6: Commit batch A**

```bash
git add PLAN/VERIFICATION_MATRIX.md
git commit -m "docs(v1): verify governance + treasury features (batch A)"
```

---

## Task 3: Verify lifecycle + safety features (batch B)

**Files:**
- Modify: `PLAN/VERIFICATION_MATRIX.md`
- Read: `src/agent/cycle-backoff.js`, `src/agent/error-log.js`, `src/agent/safety.js`, `src/agent/state-guard.js`, `src/agent/skip-guard.js`, `src/agent/run.js`

- [ ] **Step 3.1: Verify retry-backoff**

Run:
```bash
grep -n "backoffMs\|consecutiveFailures\|2 \*\* " src/agent/cycle-backoff.js
node --test tests/cycle-backoff*.test.js 2>&1 | tail -5
```

Fill row:
```markdown
| 6 | Cycle retry-backoff | STABILITY_SECURITY.md §1 | src/agent/cycle-backoff.js | unit | tests/cycle-backoff.test.js | PASS |
```

- [ ] **Step 3.2: Verify error-log**

Run:
```bash
grep -n "rotate\|5000\|4000\|redact" src/agent/error-log.js
node --test tests/error-log*.test.js 2>&1 | tail -5
```

Fill row:
```markdown
| 7 | Error-log persistent JSONL | recent commits | src/agent/error-log.js | unit | tests/error-log.test.js | PASS |
```

- [ ] **Step 3.3: Verify atomic writes**

Run:
```bash
grep -n "atomicWriteFile\|fsync\|rename" src/agent/safety.js
grep -rn "atomicWriteFile" src/agent/ | wc -l
```

Expected: temp+fsync+rename pattern; used by state-guard for state.json, treasury.json, handoff bundles.

Fill row:
```markdown
| 8 | Atomic writes | Patch Set AK | src/agent/safety.js (atomicWriteFile) | static | callers in state-guard.js, treasury.js, handoff.js | PASS |
```

- [ ] **Step 3.4: Verify cron skip-guard**

Run:
```bash
grep -n "evaluateSkip\|nextCycleTargetAt\|skipGuardSig" src/agent/skip-guard.js src/agent/run.js
node --test tests/skip-guard*.test.js 2>&1 | tail -5
```

Fill row:
```markdown
| 9 | Cron skip-guard (HMAC-signed) | STABILITY_SECURITY.md §1 | src/agent/skip-guard.js | unit | tests/skip-guard.test.js | PASS |
```

- [ ] **Step 3.5: Verify WETH-floor assertion (T-1)**

Run:
```bash
grep -n "assertTreasuryFloor\|treasuryFloorWei" src/agent/governance.js src/agent/clanker.js src/agent/buyback.js src/agent/merkle-anchor.js src/agent/federation.js
node --test tests/treasury-floor*.test.js tests/governance*.test.js 2>&1 | tail -5
```

Fill row:
```markdown
| 10 | T-1 WETH floor | STABILITY_SECURITY.md T-1 (DONE per commit 257715a4) | src/agent/governance.js (assertTreasuryFloor) | unit | tests/treasury-floor.test.js | PASS |
```

- [ ] **Step 3.6: Commit batch B**

```bash
git add PLAN/VERIFICATION_MATRIX.md
git commit -m "docs(v1): verify lifecycle + safety features (batch B)"
```

---

## Task 4: Verify AI + tools features (batch C)

**Files:**
- Modify: `PLAN/VERIFICATION_MATRIX.md`
- Read: `src/agent/inference.js`, `src/agent/ai-routing.js`, `src/agent/ai-food.js`, `src/agent/tools.js`

- [ ] **Step 4.1: Verify performance-based AI routing (T-8)**

Run:
```bash
grep -n "orderProviders\|recordSuccess\|recordFailure\|rollingFailures\|demoteUntil" src/agent/ai-routing.js
node --test tests/ai-routing*.test.js 2>&1 | tail -5
```

Fill row:
```markdown
| 11 | T-8 performance-based AI routing | STABILITY_SECURITY.md T-8 (DONE) | src/agent/ai-routing.js | unit | tests/ai-routing.test.js | PASS |
```

- [ ] **Step 4.2: Verify provider-neutral inference**

Run:
```bash
grep -n "aiProviders\|chatPath\|/chat/completions" src/agent/inference.js
grep -n "ORBIT_AI_PROVIDERS" src/agent/config.js
```

Expected: OpenAI-compatible provider interface, JSON env var for provider list, no MiMo-specific code.

Fill row:
```markdown
| 12 | AI inference provider-neutral shim | DECISIONS.md, PRIVATE_DRYRUN.md | src/agent/inference.js:209-220 | static | grep shows generic chat-completions only | PASS |
```

- [ ] **Step 4.3: Verify MiMo / OpenGateway wiring (D-018 #3)**

Run:
```bash
gh variable list 2>&1 | grep -i ORBIT_AI || echo "no var"
gh secret list 2>&1 | grep -i ORBIT_AI || echo "no secret"
```

Expected: secrets not set (per audit). Owner-action required.

Fill row:
```markdown
| 13 | MiMo / OpenGateway provider wiring (D-018 #3) | SGATE_1.md D-018 #3 | src/agent/inference.js (config-only) | static | ORBIT_AI_PROVIDERS not set in repo | OWNER-BLOCKED |
```

- [ ] **Step 4.4: Verify env budget reconcile**

Run:
```bash
grep -n "budgetEnv\|reconcileBudget\|dailyBudget\|monthlyBudget" src/agent/ai-food.js src/agent/treasury.js
node --test tests/ai-food*.test.js tests/treasury*.test.js 2>&1 | tail -5
```

Fill row:
```markdown
| 14 | Env budget reconcile on load | commit 257715a4 | src/agent/ai-food.js + src/agent/treasury.js | unit | tests/ai-food.test.js + treasury.test.js | PASS |
```

- [ ] **Step 4.5: Verify fetchUrl/webSearch tools (T-4 status check)**

Run:
```bash
grep -n "fetchUrl\|webSearch\|riskScore\|untrustedEnvelope" src/agent/tools.js src/agent/safety.js
```

Expected: tools exist, no untrusted-envelope or URL risk scoring yet. T-4 is PENDING.

Fill row:
```markdown
| 15 | T-4 fetchUrl/webSearch untrusted-content envelope | STABILITY_SECURITY.md T-4 | src/agent/tools.js | static | no risk scoring; no envelope | PARTIAL-DEFERRED |
```

- [ ] **Step 4.6: Commit batch C**

```bash
git add PLAN/VERIFICATION_MATRIX.md
git commit -m "docs(v1): verify AI + tools features (batch C)"
```

---

## Task 5: Verify federation + spawn features (batch D)

**Files:**
- Modify: `PLAN/VERIFICATION_MATRIX.md`
- Read: `src/agent/federation.js`, `src/agent/spawn.js`, `src/agent/spawn-executor.js`, `src/agent/handoff-executor.js`, `packages/create-orbit-house/`

- [ ] **Step 5.1: Verify federation handshake**

Run:
```bash
grep -n "handshake\|family.json\|opt-in" src/agent/federation.js memory/family.json 2>/dev/null
node --test tests/federation*.test.js 2>&1 | tail -5
```

Fill row:
```markdown
| 16 | Federation bidirectional handshake | DECISIONS.md | src/agent/federation.js | unit | tests/federation.test.js | PASS |
```

- [ ] **Step 5.2: Verify repo-spawning (create-orbit-house)**

Run:
```bash
ls packages/create-orbit-house/
node --test tests/create-orbit-house*.test.js tests/spawn*.test.js 2>&1 | tail -5
```

Fill row:
```markdown
| 17 | Repo-spawning (D-020 no token surface) | DECISIONS.md D-020 | packages/create-orbit-house + src/agent/spawn.js | unit | tests/create-orbit-house-*.test.js | PASS |
```

- [ ] **Step 5.3: Verify founder-handoff Safe broadcast (current state)**

Run:
```bash
grep -n "addOwnerWithThreshold\|broadcast\|Safe" src/agent/handoff-executor.js
```

Expected: encodes Safe addOwnerWithThreshold tx but writes bundle to runtime/ for manual sign — does NOT broadcast.

Fill row:
```markdown
| 18 | Founder-handoff Safe broadcast | S-035 | src/agent/handoff-executor.js | static | bundles tx; manual sign+broadcast required | PARTIAL-DEFERRED |
```

- [ ] **Step 5.4: Verify SDK public surface**

Run:
```bash
ls packages/orbit-sdk/
grep -n "readReceipts\|quickStatus\|projectForDashboard\|getFederationPeers" packages/orbit-sdk/index.js
node --test tests/sdk*.test.js 2>&1 | tail -5
```

Fill row:
```markdown
| 19 | SDK public (@orbithouse/sdk) | DECISIONS.md, recent commits | packages/orbit-sdk/index.js | unit | tests/sdk.test.js | PASS |
```

- [ ] **Step 5.5: Verify dashboard build (dist/dashboard.json)**

Run:
```bash
ls dist/ 2>/dev/null || npm run build 2>&1 | tail -5
test -f dist/dashboard.json && echo "ok" || echo "missing"
node --test tests/dashboard*.test.js tests/build*.test.js 2>&1 | tail -5
```

Fill row:
```markdown
| 20 | Dashboard build (dist/dashboard.json) | DEPLOY_PLAN.md | src/dashboard/ + vite.config.mjs | unit | tests/dashboard.test.js | PASS |
```

- [ ] **Step 5.6: Commit batch D**

```bash
git add PLAN/VERIFICATION_MATRIX.md
git commit -m "docs(v1): verify federation + spawn features (batch D)"
```

---

## Task 6: Verify horizon + proof features (batch E)

**Files:**
- Modify: `PLAN/VERIFICATION_MATRIX.md`
- Read: `src/agent/horizon-scanner.js`, `src/cli/orbit-horizon.js`, `packages/proof-viewer/`, `src/agent/farcaster.js`

- [ ] **Step 6.1: Verify HORIZON_SCANNER scaffolding**

Run:
```bash
ls src/cli/orbit-horizon.js src/agent/horizon-scanner.js memory/horizon-*.json 2>&1
grep -n "classifier\|llm\|arxiv\|EIP" src/agent/horizon-scanner.js
node --test tests/horizon*.test.js 2>&1 | tail -5
```

Expected: dryrun CLI works, classifier LLM loop not wired (audit confirmed partial).

Fill row:
```markdown
| 21 | HORIZON_SCANNER (dryrun mode) | Patch Set AM | src/agent/horizon-scanner.js | unit | tests/horizon.test.js | PASS |
| 22 | HORIZON_SCANNER classifier LLM loop | identity.md roadmap | src/agent/horizon-scanner.js (TODO marker) | static | no LLM loop; no source ingestion | PARTIAL-DEFERRED |
```

- [ ] **Step 6.2: Verify proof-cast (in-cycle Farcaster)**

Run:
```bash
grep -n "castProof\|routineCast\|approvalCast\|refusalCast" src/agent/farcaster.js
node --test tests/farcaster*.test.js 2>&1 | tail -5
```

Fill row:
```markdown
| 23 | Proof-cast in-cycle (Farcaster) | DECISIONS.md | src/agent/farcaster.js | unit | tests/farcaster.test.js | OWNER-BLOCKED |
```

(OWNER-BLOCKED because signer not provisioned per SGATE_1.md #4.)

- [ ] **Step 6.3: Verify proof-viewer package**

Run:
```bash
ls packages/proof-viewer/
node packages/proof-viewer/cli.js --help 2>&1 | head -5
node --test tests/proof-viewer*.test.js 2>&1 | tail -5
```

Fill row:
```markdown
| 24 | Proof-viewer local CLI | Patch Set AL | packages/proof-viewer/cli.js | unit | tests/proof-viewer.test.js | PASS |
```

- [ ] **Step 6.4: Verify proof-viewer publish to npm (status check)**

Run:
```bash
npm view @orbithouse/proof-viewer version 2>&1 | head -3
```

Expected: package not published; status PARTIAL-DEFERRED → Phase 3.

Fill row:
```markdown
| 25 | Proof-viewer published to npm | identity.md | packages/proof-viewer/package.json | static | not on npm yet | PARTIAL-DEFERRED |
```

- [ ] **Step 6.5: Verify merkle-anchor**

Run:
```bash
grep -n "merkleRoot\|anchor\|preLaunchVerified" src/agent/merkle-anchor.js
node --test tests/merkle*.test.js 2>&1 | tail -5
```

Fill row:
```markdown
| 26 | Merkle anchor (D-018 gated) | DECISIONS.md | src/agent/merkle-anchor.js | unit | tests/merkle-anchor.test.js | PASS |
```

- [ ] **Step 6.6: Commit batch E**

```bash
git add PLAN/VERIFICATION_MATRIX.md
git commit -m "docs(v1): verify horizon + proof features (batch E)"
```

---

## Task 7: Verify pending-T items + recent fixes (batch F)

**Files:**
- Modify: `PLAN/VERIFICATION_MATRIX.md`
- Read: `src/agent/governance.js`, `.github/workflows/signed-commit-check.yml`, `.github/workflows/deploy-dashboard.yml`, `.gitignore`

- [ ] **Step 7.1: Verify T-2 gate-hash binding (status)**

Run:
```bash
grep -n "gateHash\|hashCriteria\|D018_CRITERIA_HASH" src/agent/governance.js
```

Expected: not yet implemented per STABILITY_SECURITY.md execution order.

Fill row:
```markdown
| 27 | T-2 preLaunchVerified gate-hash binding | STABILITY_SECURITY.md T-2 | src/agent/governance.js | static | not implemented | PARTIAL-DEFERRED |
```

- [ ] **Step 7.2: Verify T-3 signed-commit CI (recent)**

Run:
```bash
ls .github/workflows/signed-commit-check.yml .github/CODEOWNERS
grep -n "ORBIT_SIGN_ENFORCE\|advisory\|ENFORCE" .github/workflows/signed-commit-check.yml
```

Expected: CI half shipped (ADVISORY mode). Owner action needed for GPG signing in cycle + branch protection toggle.

Fill row:
```markdown
| 28 | T-3 signed-commit CI check | STABILITY_SECURITY.md T-3 | .github/workflows/signed-commit-check.yml | static | advisory only; GPG signer not provisioned | OWNER-BLOCKED |
```

- [ ] **Step 7.3: Verify T-6 AI key rotation advisory (status)**

Run:
```bash
grep -n "aiKeyRotation\|lastRotatedAt\|rotation-due" src/agent/inference.js src/agent/run.js memory/state.json
```

Fill row (expect not implemented):
```markdown
| 29 | T-6 AI key rotation advisory | STABILITY_SECURITY.md T-6 | not implemented | static | no aiKeyRotation in state | PARTIAL-DEFERRED |
```

- [ ] **Step 7.4: Verify T-7 30-day expiry on preLaunchVerified (status)**

Run:
```bash
grep -n "preLaunchVerifiedAt\|30 \* 24\|expiryDays" src/agent/governance.js
```

Fill row (expect not implemented):
```markdown
| 30 | T-7 30-day expiry on preLaunchVerified | STABILITY_SECURITY.md T-7 | src/agent/governance.js | static | no expiry field | PARTIAL-DEFERRED |
```

- [ ] **Step 7.5: Verify recent deploy-dashboard + .env.example.tpl fixes**

Run:
```bash
grep -n "PAGES_ENABLED" .github/workflows/deploy-dashboard.yml
git ls-files packages/create-orbit-house/templates/.env.example.tpl
grep -n "!\.env\.example\.tpl" .gitignore
```

Fill rows:
```markdown
| 31 | deploy-dashboard PAGES_ENABLED guard | this sprint | .github/workflows/deploy-dashboard.yml | static | grep confirms guard | PASS |
| 32 | create-orbit-house .env.example.tpl tracked | this sprint | packages/create-orbit-house/templates/.env.example.tpl | static | git ls-files confirms tracked | PASS |
```

- [ ] **Step 7.6: Commit batch F**

```bash
git add PLAN/VERIFICATION_MATRIX.md
git commit -m "docs(v1): verify pending-T items + recent fixes (batch F)"
```

---

## Task 8: Sweep for missed features + finalize matrix

**Files:**
- Modify: `PLAN/VERIFICATION_MATRIX.md`

- [ ] **Step 8.1: Cross-check matrix coverage**

Run:
```bash
ls src/agent/*.js src/cli/*.js packages/ | sort -u > /tmp/orbit-code-list.txt
grep -oE "src/agent/[a-z-]+\.js|packages/[a-z-]+" PLAN/VERIFICATION_MATRIX.md | sort -u > /tmp/orbit-matrix-list.txt
diff /tmp/orbit-code-list.txt /tmp/orbit-matrix-list.txt | head -40
```

For each code file in `/tmp/orbit-code-list.txt` not represented in the matrix, decide:
- Add a row (if it's a distinct feature)
- Skip (if it's a helper / internal module)

- [ ] **Step 8.2: Add any missing feature rows**

For each newly-identified feature, follow the pattern from Tasks 2–7:
1. Find file:line of the predicate/entrypoint
2. Find unit/integration test or run a probe
3. Fill the row with `PASS` / `FAIL` / `PARTIAL-DEFERRED` / `OWNER-BLOCKED`

- [ ] **Step 8.3: Verify status counts**

Run:
```bash
grep -c "| PASS |" PLAN/VERIFICATION_MATRIX.md
grep -c "| FAIL |" PLAN/VERIFICATION_MATRIX.md
grep -c "| PARTIAL-DEFERRED |" PLAN/VERIFICATION_MATRIX.md
grep -c "| OWNER-BLOCKED |" PLAN/VERIFICATION_MATRIX.md
```

Add a Summary section at the top of `PLAN/VERIFICATION_MATRIX.md` after `## Status legend`:
```markdown
## Summary

- Total features: N
- PASS: X
- FAIL: Y (fixed inline this sprint: Y_fixed; filed as roadmap: Y_filed)
- PARTIAL-DEFERRED: Z (assigned phases — see PLAN/ROADMAP.md)
- OWNER-BLOCKED: W (owner punch list — see PLAN/SGATE_1.md)
```

- [ ] **Step 8.4: Commit final matrix**

```bash
git add PLAN/VERIFICATION_MATRIX.md
git commit -m "docs(v1): finalize verification matrix with summary"
```

---

## Task 9: Triage any FAIL rows

**Files:**
- (created/modified during this task based on bugs found)

For each row currently marked `FAIL`:

- [ ] **Step 9.1: Decide fix-or-file per FAIL row**

For each FAIL row:
1. Read the bug evidence cell.
2. Count affected files. Run:
   ```bash
   git status --short
   ```
3. If fix touches ≤2 files: proceed to Step 9.2 (fix inline)
4. If fix touches ≥3 files: stop — append to `PLAN/ROADMAP.md` as a Phase 1 entry, change status to `PARTIAL-DEFERRED`, move on.

- [ ] **Step 9.2: Write failing test FIRST (TDD)**

Add a test that reproduces the bug. Example template (adjust to actual bug):
```javascript
const { test } = require("node:test");
const assert = require("node:assert/strict");

test("BUG-N: <one-line description>", () => {
  // arrange: minimal repro state
  // act: call the function
  // assert: the broken behavior — this must FAIL initially
});
```

Run the test, confirm it fails:
```bash
node --test tests/bug-N.test.js 2>&1 | tail -10
```
Expected: FAIL with the actual broken behavior.

- [ ] **Step 9.3: Fix the bug**

Make the minimal code change in ≤2 files. Re-run the test:
```bash
node --test tests/bug-N.test.js 2>&1 | tail -10
```
Expected: PASS.

- [ ] **Step 9.4: Run full suite**

```bash
npm test 2>&1 | tail -10
```
Expected: ≥1504 + N pass; 0 fail.

- [ ] **Step 9.5: Update matrix row + commit**

Change the row's status from `FAIL` to `PASS`, update Evidence to point at the new test.

```bash
git add tests/bug-N.test.js <fixed-file>.js PLAN/VERIFICATION_MATRIX.md
git commit -m "fix(v1): <bug summary> + verification matrix update"
```

Repeat 9.1–9.5 for each remaining FAIL row.

---

## Task 10: Reorganize PLAN/PHASES.md

**Files:**
- Modify: `PLAN/PHASES.md`

- [ ] **Step 10.1: Read current PHASES.md end-to-end**

```bash
wc -l PLAN/PHASES.md
```

Note every claim, criterion, and decision reference.

- [ ] **Step 10.2: Rewrite PHASES.md with clean phase structure**

Replace contents of `PLAN/PHASES.md` with:

```markdown
# Phases

> Single source of truth for Orbit's phase boundaries.
> Each phase has explicit entry + exit criteria.
> Cross-reference: PLAN/ROADMAP.md (work surface), PLAN/VERIFICATION_MATRIX.md (state of code).

## Phase 1 — Private stability

**Theme:** engine works, gates closed, dryrun clean.

**Entry criterion:** engine compiles, ≥1 cycle produces signed proof.

**Exit criteria:**
- 14 consecutive days of cycles with zero broken runs (SGATE_1 #1)
- Signed proofs in every cycle (SGATE_1 #2) — MET
- Lore foundation written (SGATE_1 #8) — MET
- S-GATE-1 owner punch list closed
- VERIFICATION_MATRIX.md shows no FAIL rows

**Status:** OPEN — see PLAN/SGATE_1.md for owner punch list.

## Phase 2 — Owner activation

**Theme:** live infra wired by owner.

**Entry criterion:** Phase 1 exit met.

**Exit criteria:**
- Farcaster signer provisioned, ≥1 daily cast for 14 days (SGATE_1 #4)
- Closed-loop demo run successfully (SGATE_1 #6)
- Treasury Safe deployed + funded on Base (SGATE_1 #7)
- MiMo/OpenGateway provider configured (D-018 #3)
- GPG signing for cycle bot live + ORBIT_SIGN_ENFORCE=true (T-3 Part C+D)
- 12-hour clean Actions stretch (D-018 #4)
- state.preLaunchVerified = true (D-018 final)

**Status:** PENDING Phase 1 closure.

## Phase 3 — Public face

**Theme:** outsiders can discover, evaluate, run.

**Entry criterion:** Phase 2 exit met.

**Exit criteria:**
- Repo public OR canonical orbithousezkp/orbit created
- GitHub Pages dashboard live, dashboard.json updated each cycle
- SDK published to npm (@orbithouse/sdk)
- create-orbit-house published to npm
- proof-viewer published to npm
- Public spec page rendered from PLAN/

**Status:** PENDING Phase 2 closure.

## Phase 4 — Adopter funnel

**Theme:** real adopters running their own Orbit instances.

**Entry criterion:** Phase 3 exit met.

**Exit criteria:**
- ≥1 second adopter repo running Orbit (SGATE_1 #5)
- Federation handshake live across ≥2 repos
- HORIZON_SCANNER classifier wired to real source corpus
- Adopter registry public

**Status:** PENDING Phase 3 closure.

## Phase 5 — Founder-fade

**Theme:** project stands without the founder.

**Entry criterion:** Phase 4 exit met.

**Exit criteria:**
- ≥50 adopter repos in registry
- ≥3 independent spec implementations conformant
- Handoff timelock fires (or is ready to fire by owner choice)
- Quorum-bootstrap protocol live (new maintainers added without founder grant)

**Status:** PENDING Phase 4 closure.

## Phase principles

1. **No phase skip.** Exit criteria for phase N must be MET before phase N+1 work begins.
2. **PARTIAL-DEFERRED features land in their assigned phase, never sooner.**
3. **Owner-blocked items live in PLAN/SGATE_1.md** until owner closes them.
4. **Roadmap expansion (F-* features) lands per-phase only.** See PLAN/ROADMAP_EXPANSION.md.
```

- [ ] **Step 10.3: Verify cross-refs not broken**

```bash
grep -rn "PHASES.md" PLAN/ docs/ memory/ README.md 2>/dev/null | head -20
```

For each reference, confirm the section name it links to still exists in the new PHASES.md. If a heading was renamed, update the referring file.

- [ ] **Step 10.4: Commit reorged PHASES.md**

```bash
git add PLAN/PHASES.md
git commit -m "docs(v1): reorg PLAN/PHASES.md with clean Phase 1–5 structure"
```

---

## Task 11: Rewrite PLAN/ROADMAP.md as per-phase work surface

**Files:**
- Modify: `PLAN/ROADMAP.md`
- Read: `PLAN/VERIFICATION_MATRIX.md`, `PLAN/PHASES.md`

- [ ] **Step 11.1: Read current ROADMAP.md and matrix**

```bash
wc -l PLAN/ROADMAP.md
head -200 PLAN/VERIFICATION_MATRIX.md
```

- [ ] **Step 11.2: Rewrite ROADMAP.md with per-phase structure**

Replace `PLAN/ROADMAP.md` with:

```markdown
# Roadmap

> Per-phase work surface. Each entry is either an existing PARTIAL-DEFERRED feature (file in VERIFICATION_MATRIX.md) or a new planned feature (file in ROADMAP_EXPANSION.md).
> Phase boundaries: see PLAN/PHASES.md.

## Phase 1 — Private stability (CURRENT)

### Open engineering items (no owner blocker)

| ID | Item | Source | Status |
|---|---|---|---|
| T-2 | Gate-hash binding on preLaunchVerified | STABILITY_SECURITY.md | PARTIAL-DEFERRED |
| T-4 | Untrusted-content envelope + URL risk scoring | STABILITY_SECURITY.md | PARTIAL-DEFERRED |
| T-5 | SHA256 spend-id encoding | STABILITY_SECURITY.md | PARTIAL-DEFERRED |
| T-6 | AI key rotation advisory | STABILITY_SECURITY.md | PARTIAL-DEFERRED |
| T-7 | 30-day expiry on preLaunchVerified | STABILITY_SECURITY.md | PARTIAL-DEFERRED |
| OBS-1 | `npm run audit:cadence` analyzer | STABILITY_SECURITY.md §4 | PARTIAL-DEFERRED |
| OBS-2 | Gate-hash banner on dashboard | STABILITY_SECURITY.md §4 | PARTIAL-DEFERRED |
| OBS-3 | Approval-id index file | STABILITY_SECURITY.md §4 | PARTIAL-DEFERRED |

### Expansion items (Phase 1)

See PLAN/ROADMAP_EXPANSION.md §"Phase 1 — Private stability":
- F-1.1 state.json schema migration system
- F-1.2 Cycle-rerun forensics
- F-1.3 Memory file integrity scanner
- F-1.4 AI provider canary
- F-1.5 Error-log compaction policy
- F-1.6 Per-memory-file validators

### Owner-blocked

See PLAN/SGATE_1.md — full punch list.

## Phase 2 — Owner activation

### Filed-from-PARTIAL

- Founder-handoff Safe broadcast automation (was: src/agent/handoff-executor.js manual sign)
- MiMo / OpenGateway provider wiring (config-only)
- GPG signing for cycle bot (T-3 Part C+D)

### Expansion items (Phase 2)

See PLAN/ROADMAP_EXPANSION.md §"Phase 2 — Owner activation":
- F-2.1 Safe multi-sig wallet integration
- F-2.2 Tiered spend levels
- F-2.3 Per-provider cost ceiling + auto-failover
- F-2.4 Farcaster reply → governance ingestion
- F-2.5 Per-tool budget envelope
- F-2.6 Safe owner-rotation watchdog

## Phase 3 — Public face

### Filed-from-PARTIAL

- Proof-cast standalone CLI
- Proof-viewer published to npm
- SDK published to npm
- create-orbit-house published to npm
- Dashboard live on Pages

### Expansion items (Phase 3)

See PLAN/ROADMAP_EXPANSION.md §"Phase 3 — Public face":
- F-3.1 Public verifier endpoint
- F-3.2 Merkle anchoring on-chain
- F-3.3 Dashboard time-travel viewer
- F-3.4 Farcaster reply → issue gateway
- F-3.5 ZK policy receipts
- F-3.6 Adopter onboarding wizard

## Phase 4 — Adopter funnel

### Filed-from-PARTIAL

- HORIZON_SCANNER classifier LLM loop
- Adopter registry public

### Expansion items (Phase 4)

See PLAN/ROADMAP_EXPANSION.md §"Phase 4 — Adopter funnel":
- F-4.1 Federation trust-graph registry
- F-4.2 Gossip protocol on family.json
- F-4.3 Inherited governance
- F-4.4 Cross-family proof aggregation
- F-4.5 Scoped capability delegation
- F-4.6 Spec conformance test suite

## Phase 5 — Founder-fade

### Expansion items (Phase 5)

See PLAN/ROADMAP_EXPANSION.md §"Phase 5 — Founder-fade":
- F-5.1 Quorum-bootstrap protocol
- F-5.2 Generalized timelocks
- F-5.3 $ORBIT ceiling enforcement + buyback automation
- F-5.4 Protocol versioning + migration spec
- F-5.5 Recursive lineage tracking
- F-5.6 Post-fade founder advisory mode

## Out of scope (do not do)

(merged from STABILITY_SECURITY.md §5)
- Backfilling missed cycles
- Calendar-forced provider rotation
- Auto-blocking AI on key age
- Strict domain allowlist on fetchUrl/webSearch
- Persistent bot runtime for token-gating
- Quorum multi-sig at N=1 maintainer (deferred until ≥3 maintainers)
```

- [ ] **Step 11.3: Verify cross-refs**

```bash
grep -rn "ROADMAP.md" PLAN/ docs/ memory/ README.md 2>/dev/null | head -20
```

Fix any broken references found.

- [ ] **Step 11.4: Commit ROADMAP.md**

```bash
git add PLAN/ROADMAP.md
git commit -m "docs(v1): rewrite PLAN/ROADMAP.md as per-phase work surface"
```

---

## Task 12: Create PLAN/ROADMAP_EXPANSION.md from spec

**Files:**
- Create: `PLAN/ROADMAP_EXPANSION.md`
- Read: `docs/superpowers/specs/2026-05-28-verification-and-roadmap-reorg-design.md`

- [ ] **Step 12.1: Extract F-* table from spec**

The spec's "Roadmap expansion" section contains the canonical F-* tables for Phase 1–5. Copy verbatim into a new file with a header.

- [ ] **Step 12.2: Write ROADMAP_EXPANSION.md**

Create `PLAN/ROADMAP_EXPANSION.md`:

```markdown
# Roadmap Expansion

> Planned features per phase. Each entry: ID, name, why, where, deps. PLANNING ONLY — no code in any feature here is implemented unless its row is moved to a separate "completed" table.
>
> Phase boundaries: see PLAN/PHASES.md.
> Work surface: see PLAN/ROADMAP.md.

## Phase 1 — Private stability

| ID | Feature | Why | Where | Deps |
|---|---|---|---|---|
| F-1.1 | state.json schema migration system | versioned migrations w/ rollback; current code mutates state.json in-place without version pin | `src/agent/state-migrate.js` (new), `src/agent/run.js` | none |
| F-1.2 | Cycle-rerun forensics | re-run any past cycle from its signed proof; verify deterministic output | `scripts/replay-cycle.js` (new), `src/agent/cycle.js` | F-1.1 |
| F-1.3 | Memory file integrity scanner | detect corruption / drift before cycle reads | `src/agent/memory-scan.js` (new) | none |
| F-1.4 | AI provider canary | tiny ping each cycle to detect provider degradation | `src/agent/ai-canary.js` (new), `src/agent/ai-routing.js` | T-8 (done) |
| F-1.5 | Error-log compaction policy | rotate to monthly archive after 30 days | `src/agent/error-log.js` | none |
| F-1.6 | Per-memory-file validators | pluggable JSON schema validators | `src/agent/state-guard.js`, `schemas/` (new) | none |

## Phase 2 — Owner activation

| ID | Feature | Why | Where | Deps |
|---|---|---|---|---|
| F-2.1 | Safe multi-sig wallet integration | replace EOA with threshold sig; unblocks D-018 #7 | `src/agent/safe.js` (new), `treasury.js` | Treasury Safe deployed |
| F-2.2 | Tiered spend levels | small/medium/large with different quorum thresholds | `governance.js` (actionTier extension) | F-2.1 |
| F-2.3 | Per-provider cost ceiling + auto-failover | cap $/cycle/provider; route around exhausted provider | `ai-routing.js`, `ai-food.js` | F-1.4 |
| F-2.4 | Farcaster reply → governance ingestion | replies to approval-cast become equivalent governance vote signal | `farcaster.js`, `governance.js` | Farcaster signer live |
| F-2.5 | Per-tool budget envelope | quotas for fetchUrl, webSearch, AI calls per cycle | `tools.js`, `safety.js` | none |
| F-2.6 | Safe owner-rotation watchdog | on-chain observer; alerts if Safe owners change unexpectedly | `src/agent/safe-watch.js` (new) | F-2.1 |

## Phase 3 — Public face

| ID | Feature | Why | Where | Deps |
|---|---|---|---|---|
| F-3.1 | Public verifier endpoint | anyone fetches a cycle proof URL and verifies offline | dashboard route, `proof-viewer` | repo public |
| F-3.2 | Merkle anchoring on-chain | Merkle root of every N cycles posted to Base; tamper-evident history | `merkle-anchor.js` (extend), `clanker.js` | D-018 verified |
| F-3.3 | Dashboard time-travel viewer | view dashboard state at any past block / commit | dashboard JS | F-3.1 |
| F-3.4 | Farcaster reply → issue gateway | public reply auto-opens GitHub issue for triage | `farcaster.js`, GitHub Action | F-2.4 |
| F-3.5 | ZK policy receipts | prove a gate passed without exposing inputs (T-5 stronger form) | `governance.js`, new `zk-receipt.js` | research |
| F-3.6 | Adopter onboarding wizard | `npx create-orbit-house` + post-install setup walkthrough | `packages/create-orbit-house` | npm publish |

## Phase 4 — Adopter funnel

| ID | Feature | Why | Where | Deps |
|---|---|---|---|---|
| F-4.1 | Federation trust-graph registry | adopters' family.json aggregated into public graph | new `packages/federation-registry`, dashboard | Phase 3 |
| F-4.2 | Gossip protocol on family.json | adopters discover siblings via signed pull requests across repos | `federation.js`, new `federation-gossip.js` | F-4.1 |
| F-4.3 | Inherited governance | child repos optionally inherit parent's gates by ref | `create-orbit-house`, `governance.js` | F-5.4 (spec versioned) |
| F-4.4 | Cross-family proof aggregation | dashboard shows lineage tree with proof counts per node | dashboard | F-4.1 |
| F-4.5 | Scoped capability delegation | parent grants child specific tools (e.g., webSearch only, no clanker) | `governance.js`, `passport.json` schema | F-1.6 |
| F-4.6 | Spec conformance test suite | npm package any Orbit impl can run to claim conformance | new `packages/orbit-conformance` | F-5.4 |

## Phase 5 — Founder-fade

| ID | Feature | Why | Where | Deps |
|---|---|---|---|---|
| F-5.1 | Quorum-bootstrap protocol | new maintainers join via existing quorum vote, not founder grant | `governance.js`, `handoff.js` | quorum-CI mature |
| F-5.2 | Generalized timelocks | timelock pattern extends to spend levels, gate flips, schema migrations | `governance.js` | F-2.2 |
| F-5.3 | $ORBIT ceiling enforcement + buyback automation | code path for token-side rules once D-018 closes | `clanker.js`, `buyback.js` (extend) | D-018 closed |
| F-5.4 | Protocol versioning + migration spec | ORBIT_PROTOCOL_VERSION header on all artifacts; migration path between versions | repo-wide | F-1.1 |
| F-5.5 | Recursive lineage tracking | child-of-child-of lineage in `orbit-lineage.json` | `federation.js`, dashboard | F-4.1 |
| F-5.6 | Post-fade founder advisory mode | read-only role for retired founder; no vote weight | `governance.js` | handoff timelock fires |

## Adding new expansion items

1. Pick a phase that matches the dependency requirement.
2. Use the next ID in sequence (F-1.7, F-2.7, etc.).
3. Fill all 5 columns: Feature / Why / Where / Deps.
4. Commit with `docs(roadmap): add F-X.Y <feature>`.
5. Do not build it. Wait for the phase to be active.
```

- [ ] **Step 12.3: Verify markdown table renders**

```bash
grep -c "^| F-" PLAN/ROADMAP_EXPANSION.md
```

Expected: 30 lines (6 features × 5 phases).

- [ ] **Step 12.4: Commit ROADMAP_EXPANSION.md**

```bash
git add PLAN/ROADMAP_EXPANSION.md
git commit -m "docs(v1): add PLAN/ROADMAP_EXPANSION.md with 30 planned features"
```

---

## Task 13: Create PLAN/ROADMAP_CHANGES.md diff summary

**Files:**
- Create: `PLAN/ROADMAP_CHANGES.md`

- [ ] **Step 13.1: Compute counts from matrix**

```bash
TOTAL=$(grep -cE "^\| [0-9]+ \|" PLAN/VERIFICATION_MATRIX.md)
PASS=$(grep -c "| PASS |" PLAN/VERIFICATION_MATRIX.md)
FAIL=$(grep -c "| FAIL |" PLAN/VERIFICATION_MATRIX.md)
PARTIAL=$(grep -c "| PARTIAL-DEFERRED |" PLAN/VERIFICATION_MATRIX.md)
BLOCKED=$(grep -c "| OWNER-BLOCKED |" PLAN/VERIFICATION_MATRIX.md)
echo "Total=$TOTAL Pass=$PASS Fail=$FAIL Partial=$PARTIAL Blocked=$BLOCKED"
```

Record the values for use in the next step.

- [ ] **Step 13.2: Write ROADMAP_CHANGES.md**

Create `PLAN/ROADMAP_CHANGES.md`:

```markdown
# Roadmap Changes (V-1 sprint, 2026-05-28)

> Diff summary of the V-1 verification + roadmap reorg + expansion sprint.

## Verification results

(values from Step 13.1 — fill in real numbers)

- Total features verified: TOTAL
- PASS: PASS
- FAIL: FAIL (all fixed inline — see commits)
- PARTIAL-DEFERRED: PARTIAL (assigned to phases — see PLAN/ROADMAP.md)
- OWNER-BLOCKED: BLOCKED (see PLAN/SGATE_1.md)

## File changes

| File | Action | Lines |
|---|---|---|
| `PLAN/VERIFICATION_MATRIX.md` | created | (paste `wc -l` output) |
| `PLAN/PHASES.md` | rewritten | (paste old → new line counts) |
| `PLAN/ROADMAP.md` | rewritten | (paste old → new line counts) |
| `PLAN/ROADMAP_EXPANSION.md` | created | (paste `wc -l` output) |
| `PLAN/ROADMAP_CHANGES.md` | created | this file |

## What moved where

### PARTIAL-DEFERRED items filed to phases

| Item | Was | Now in phase | Reason |
|---|---|---|---|
| HORIZON_SCANNER classifier LLM loop | identity.md roadmap (vague) | Phase 4 | needs real adopter/source corpus |
| Proof-cast standalone CLI | identity.md (partial) | Phase 3 | depends on public dashboard surface |
| Founder-handoff Safe broadcast automation | handoff-executor.js (manual bundle) | Phase 2 | needs Treasury Safe deployed |
| MiMo / OpenGateway provider wiring | D-018 #3 (vague) | Phase 2 | config-only; owner sets secret |
| Dashboard publish to Pages | DEPLOY_PLAN.md (private gate blocked) | Phase 3 | needs repo public OR paid Pages |
| Adopter registry public | identity.md (TBD) | Phase 4 | needs Phase 3 surface |
| T-2 gate-hash binding | STABILITY_SECURITY.md PENDING | Phase 1 (open work) | engineering-only; no blocker |
| T-4 untrusted-content envelope | STABILITY_SECURITY.md PENDING | Phase 1 (open work) | engineering-only; no blocker |
| T-5 SHA256 spend-id encoding | STABILITY_SECURITY.md PENDING | Phase 1 (open work) | engineering-only; no blocker |
| T-6 AI key rotation advisory | STABILITY_SECURITY.md PENDING | Phase 1 (open work) | engineering-only; no blocker |
| T-7 30-day expiry on preLaunchVerified | STABILITY_SECURITY.md PENDING | Phase 1 (open work) | engineering-only; no blocker |
| OBS-1/2/3 observability | STABILITY_SECURITY.md §4 | Phase 1 (open work) | engineering-only; no blocker |

### New expansion items added

30 features added across Phase 1–5 (F-1.1 … F-5.6). See `PLAN/ROADMAP_EXPANSION.md` for full table.

### Bugs fixed inline

(list each fix made during Task 9 — fill in real list, or "none" if no FAIL rows)

## What was NOT changed

- `memory/identity.md` — no rewrite this sprint (identity narrative reorg is a separate cycle, deferred to next brainstorm)
- `PLAN/DECISIONS.md` — no decisions added or amended
- `PLAN/STABILITY_SECURITY.md` — left as historical record; T-* items now tracked in PLAN/ROADMAP.md under Phase 1 open work
- Code beyond inline bug fixes — no refactor; no new feature implementation
- Out-of-scope items (PLAN/ROADMAP.md "Out of scope" section) — unchanged

## Verification

- `npm test` ≥ 1504 + (fixes) tests, 0 fail
- Code-review agent on full diff — see commit log / agent report
- All cross-references in PLAN/ verified non-broken
```

- [ ] **Step 13.3: Fill placeholders with real values**

Replace `TOTAL`, `PASS`, `FAIL`, etc. with the values from Step 13.1.
Replace `wc -l` placeholders with real file line counts.
Replace `(list each fix made during Task 9 — fill in real list, or "none" if no FAIL rows)` with the actual list.

- [ ] **Step 13.4: Commit changes summary**

```bash
git add PLAN/ROADMAP_CHANGES.md
git commit -m "docs(v1): add PLAN/ROADMAP_CHANGES.md sprint summary"
```

---

## Task 14: Cross-reference sweep + link integrity check

**Files:**
- Modify (if broken refs found): files outside PLAN/ that reference moved/renamed sections

- [ ] **Step 14.1: Grep all references to changed files**

```bash
for f in PHASES.md ROADMAP.md STABILITY_SECURITY.md SGATE_1.md; do
  echo "=== refs to PLAN/$f ==="
  grep -rn "$f" --include="*.md" --include="*.js" . | grep -v "node_modules\|^\./\.git" | head -20
done
```

For each match outside `PLAN/`:
1. Open the file
2. Check that the section anchor (`#some-heading`) still exists after the reorg
3. Fix or remove the broken link

- [ ] **Step 14.2: Verify VERIFICATION_MATRIX rows reference real files**

```bash
grep -oE "src/agent/[a-z-]+\.js" PLAN/VERIFICATION_MATRIX.md | sort -u > /tmp/matrix-refs.txt
while read p; do
  test -f "$p" || echo "MISSING: $p"
done < /tmp/matrix-refs.txt
```

For every "MISSING:" line, fix the matrix row to point at the real file.

- [ ] **Step 14.3: Commit any link fixes**

```bash
git status --short
# if changes:
git add <fixed files>
git commit -m "docs(v1): fix cross-references broken by reorg"
```

If no changes, skip the commit.

---

## Task 15: Final test run

**Files:**
- (no changes)

- [ ] **Step 15.1: Run full test suite**

```bash
npm test 2>&1 | tail -10
```

Expected output:
```
# tests >=1504
# pass >=1504
# fail 0
# skipped 0
```

If `fail > 0`: stop, investigate, fix per Task 9 pattern, then re-run.

- [ ] **Step 15.2: Build dashboard**

```bash
npm run build 2>&1 | tail -5
test -f dist/dashboard.json && echo "ok" || (echo "missing"; exit 1)
```

Expected: build succeeds, `dist/dashboard.json` exists.

- [ ] **Step 15.3: Health check**

```bash
npm run health 2>&1 | tail -20
```

Expected: no FAIL lines; OPEN BLOCKERS list either empty or matches OWNER-BLOCKED rows in VERIFICATION_MATRIX.md.

---

## Task 16: Code-review the full diff

**Files:**
- (no changes — agent dispatch)

- [ ] **Step 16.1: Spawn code-review agent on diff**

Run via the Agent tool (subagent_type: `code-review`), background:

```text
Review the V-1 sprint diff in /home/asuran/Downloads/orbit. Files touched:
- PLAN/VERIFICATION_MATRIX.md (new)
- PLAN/PHASES.md (rewritten)
- PLAN/ROADMAP.md (rewritten)
- PLAN/ROADMAP_EXPANSION.md (new)
- PLAN/ROADMAP_CHANGES.md (new)
- any bug-fix files from Task 9

Check for:
- Matrix rows: every row has all 6 columns filled; status is one of PASS/FAIL/PARTIAL-DEFERRED/OWNER-BLOCKED; file:line refs are valid.
- Phase exit criteria in PHASES.md are MET-able from current code (not aspirational).
- ROADMAP.md and ROADMAP_EXPANSION.md are non-overlapping (no F-* listed in two phases).
- Bug fixes (if any): scope ≤2 files, test added.
- Cross-references not broken (PHASES.md sections referenced by ROADMAP.md exist, etc.)

Report severity-tagged findings, one per line. Under 250 words.
```

- [ ] **Step 16.2: Address findings**

If reviewer reports `CRITICAL` or `IMPORTANT` issues:
1. Fix inline if doc-only or ≤2 code files
2. Otherwise, file as a follow-up roadmap item and proceed

Re-run code-review only if a critical issue requires re-fixing.

---

## Task 17: Final status report (no commit; user reviews)

**Files:**
- (no new files; status report stays in-conversation)

- [ ] **Step 17.1: Print status summary**

In the conversation (not as a file), print:

```text
V-1 sprint complete.

Files changed:
  PLAN/VERIFICATION_MATRIX.md (new, X rows)
  PLAN/PHASES.md (rewritten, OLD → NEW lines)
  PLAN/ROADMAP.md (rewritten, OLD → NEW lines)
  PLAN/ROADMAP_EXPANSION.md (new, 30 entries)
  PLAN/ROADMAP_CHANGES.md (new)
  <any bug-fix files from Task 9>

Tests: NNNN/NNNN pass.
Code-review: <PASS / N findings addressed>.

Verification result:
  PASS: P
  FAIL: F (fixed inline)
  PARTIAL-DEFERRED: D (filed to phases)
  OWNER-BLOCKED: B (in PLAN/SGATE_1.md)

Owner-action remaining:
  - Stage / commit / push the V-1 diff
  - Push 33 backlog commits to origin
  - <any owner-blocked items surfaced in matrix>
```

- [ ] **Step 17.2: Hand off to user**

Do not push. Do not amend. The user reviews the diff and pushes when ready.

---

## Self-review checklist (run before declaring plan complete)

- [x] Every section in the spec maps to ≥1 task (Goal → Tasks 1–8; Deliverables → Tasks 1, 10, 11, 12, 13; Verification matrix schema → Task 1.3, 8.3; Phase structure → Task 10; Partial-item assignments → Task 11; Roadmap expansion → Task 12; Execution plan → Tasks 1–17; Definition of done → Tasks 15, 16, 17; Risk register → Tasks 9.1, 11.3, 14)
- [x] No "TBD" / "fill in details" / "similar to Task N" — every task has explicit commands and content
- [x] Status values consistent across all tasks: PASS / FAIL / PARTIAL-DEFERRED / OWNER-BLOCKED
- [x] Phase numbers consistent: 1=stability, 2=owner-activation, 3=public, 4=adopter, 5=founder-fade (matches spec)
- [x] F-* IDs consistent: F-1.1…F-1.6, F-2.1…F-2.6, etc. (matches spec)
- [x] Bug-fix loop (Task 9) follows TDD: test first, then fix, then matrix update
- [x] Commit cadence: one commit per task or per logical batch
- [x] No new feature code beyond inline bug fixes (constraint stated in invariants)
