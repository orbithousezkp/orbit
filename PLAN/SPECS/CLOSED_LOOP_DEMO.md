## CLOSED_LOOP_DEMO.md — First Self-Funding Cycle (S-006/S-009)

> Owner runbook for Day-1 item #8: the credibility moment. Orbit notices it is running low on AI budget, files a public approval issue, the owner approves via comment, and Orbit records the refill with a public receipt. One full loop. Cast it.

## 1. Goal — Orbit's first closed loop

End state: a chain of public artifacts on this repo that, read in order, prove the approval-gated self-funding loop works end-to-end without anyone bypassing a lock.

The chain (every link must be a public URL):

1. Cycle N proof file — shows `request_ai_food_refill` was called and the spend was classified as `owner_approval_required`.
2. Approval issue — created by Orbit, body contains the exact `APPROVE ORBIT-SPEND <id>` command.
3. Owner approval comment — standalone `APPROVE ORBIT-SPEND <id>` from the configured `ownerUsername`.
4. Cycle N+M proof file — shows `record_ai_food_refill` succeeded, includes the same `approvalId` and a proof string the owner provided.
5. `memory/treasury.json` diff in cycle N+M's commit — `ai.refills[]` grew by one entry; `ai.providerCredits[*].balanceUsd` increased.
6. Cycle N+M+1 proof file — at least one AI call succeeded after the refill (`budgetStatus.canUseAi === true` and a non-empty `treasury.ai.ledger` entry whose timestamp is after the refill).
7. Public Farcaster cast — links proofs 1, 2, 4, 5, 6 in one post.

This is what "credibility moment" means: anyone can click each link and verify Orbit didn't write money to itself.

## 2. Preconditions

Before triggering the demo cycle, the owner confirms:

- `ORBIT_OWNER_USERNAME` secret is set to the GitHub login that will post the approve comment. The exact-match check is case-insensitive but the login itself must match (not a display name).
- `memory/governance.json` exists with `externalSpend.mode === "owner_approval_required"`. Default factory governance already does this; see `src/agent/governance.js::defaultGovernance`.
- `memory/treasury.json` exists. If it does not, the cycle will write a default on first read. Default `dailyBudgetUsd` and `monthlyBudgetUsd` come from `config.aiDailyBudgetUsd` / `aiMonthlyBudgetUsd`.
- `ORBIT_TREASURY_ADDRESS` and `ORBIT_OPERATOR_REVENUE_ADDRESS` secrets are configured. Refill flow itself does not require them, but every cycle calls `governanceStatus()` which derives off them.
- The owner has access to the configured AI-credit provider's web UI and a payment method ready. Orbit will NOT execute the purchase. The owner does, off-repo, and pastes the receipt URL or transaction hash as the `proof` string when Orbit calls `record_ai_food_refill`.
- No prior open approval issue with the same fingerprint. Same `(category, asset, amount, recipient)` produces the same approval id and Orbit will reuse the open issue rather than create a duplicate. If a stale "rejected" approval with the same id exists, change the `amountUsd` (e.g., `19.99` instead of `20`) so the fingerprint differs.
- Workflow `orbit-cycle.yml` is operational (last green run no older than 24h). If `cast_to_farcaster` is wired, the announcement cast can be the final cycle's natural output.

## 3. Flow diagram

```
                       cycle N
                       --------
   budget low      →   request_ai_food_refill(amountUsd, reason)
   (or owner asks)         ↓
                       guardSpend → classifySpend → requiresOwnerApproval=true
                           ↓
                       requestOwnerApproval
                           ↓
                       github.createIssue("[orbit approval] external spend <id>")
                           ↓
                       upsertPendingTopUp → memory/treasury.json.ai.pendingTopUps[]
                       upsertApproval     → memory/approvals.json.approvals[]
                           ↓
                       cycle N proof written; status="blocked_pending_owner_approval"

                       ─── owner is off-repo here ───

   owner reads issue →  buys credits at the configured provider
                       captures a verifiable proof string (receipt URL, tx hash, screenshot URL)
                           ↓
   owner comments    →  `APPROVE ORBIT-SPEND <id>` (exact, standalone line)
   on approval issue
                       (owner login must match config.ownerUsername)

                       ─── cycle N+M (any later cycle) ───

   trigger           →  cycle picks up by mandatory heartbeat OR workflow_dispatch
                           ↓
                       record_ai_food_refill(amountUsd, approvalId, proof)
                           ↓
                       assertConfiguredAiFoodPurchase + checkOwnerApproval({forceRemote:true})
                           ↓
                       github.listIssueComments → finds owner APPROVE line → status=approved
                           ↓
                       recordAiCreditRefill → treasury.ai.refills.push({approvalId, proof, amountUsd, recordedAt})
                                            → providerCredits[*].balanceUsd += amountUsd
                                            → pendingTopUps[that id].status="recorded_complete"
                           ↓
                       cycle N+M proof written; status="recorded"; entry returned

                       ─── cycle N+M+1 ───

   regular AI call   →  budgetStatus.canUseAi === true
                           ↓
                       inference runs, treasury.ai.ledger gains an entry whose timestamp
                       is later than refills[-1].recordedAt
                           ↓
                       this is the proof the loop actually fed Orbit
```

## 4. Owner runbook

Numbered steps. Each step says what to run and what to watch.

### Step 1 — Trigger the cycle that requests the refill

The agent will call `request_ai_food_refill` on its own when budget is low. To force it on demand:

```
gh workflow run orbit-cycle.yml -f trigger='{"type":"manual","id":"closed-loop-demo-request"}'
```

Watch: the Actions run log for the line `[orbit][tool] request_ai_food_refill`. The cycle proof file under `runtime/proofs/cycle-N.json` (or wherever S-002 places signed proofs) must contain a step whose `tool` is `request_ai_food_refill` and whose `output.status` is `blocked_pending_owner_approval`.

Note the printed `approval.id` — it is needed verbatim in the approve comment.

### Step 2 — Verify the approval issue exists

```
gh issue list --label orbit:approval --state open
gh issue view <number>
```

The issue title must match `[orbit approval] external spend <id>` and the body must contain `APPROVE ORBIT-SPEND <id>`. If labels are missing or the title is wrong, do NOT approve — open a bug instead.

### Step 3 — Buy the credits, off-repo

Go to the configured AI-credit provider's web UI in a browser. Buy the same dollar amount Orbit asked for (or more — Orbit will record only the amount you tell it). Capture one of:

- Receipt URL (preferred; ideally HTTPS, owner-readable but not behind login wall)
- Transaction hash (if the provider supports onchain payment receipts)
- A pasted-into-gist text receipt — last resort

Do NOT paste an API key, session cookie, or anything that looks like a secret. The proof string is scanned by `assertSafeTextForWrite`; secret-shaped content is rejected.

### Step 4 — Post the approve comment on the issue

Exact standalone line, from the configured owner account:

```
APPROVE ORBIT-SPEND <id>
```

Then, in the SAME or a follow-up comment, paste the proof string so Orbit can read it. The proof string is NOT extracted from the comment automatically — the agent will use whatever proof string it constructs from its own context plus what is visible in the issue. Acceptable to add a second comment with just the proof URL so it is obvious.

Do not edit the comment after posting. Webhook payloads include the original body; `listIssueComments` returns the latest. If you typo, post a second comment with the correct exact line — the parser scans every line of every owner comment.

### Step 5 — Trigger the cycle that records the refill

If the agent will pick this up via the regular heartbeat, you can wait up to 30 minutes. To force it:

```
gh workflow run orbit-cycle.yml -f trigger='{"type":"manual","id":"closed-loop-demo-record"}'
```

Watch for `[orbit][tool] record_ai_food_refill` in logs. The cycle proof should include a step whose `output.status === "recorded"` and `output.entry.approvalId === <id>`.

### Step 6 — Verify the artifact chain

After the recording cycle, confirm in this order. Each must be a clickable public URL.

- The cycle-N proof file (the one with `request_ai_food_refill`).
- The approval issue (its URL came back in the same cycle's output).
- The owner approve comment (anchor link on the issue).
- The cycle-N+M proof file (the one with `record_ai_food_refill`).
- `memory/treasury.json` at the commit of cycle N+M — `ai.refills` array has one more entry, `ai.providerCredits[*].balanceUsd` increased by `amountUsd`.

### Step 7 — Run one more cycle to prove the refill was usable

Trigger or wait for one more cycle. Confirm:

- `budgetStatus.canUseAi === true`
- `treasury.ai.ledger` has at least one entry whose `timestamp` is later than `refills[-1].recordedAt`

That entry is the AI call paid for by the refill — the loop closed.

### Step 8 — Cast it

Use the template in §7 below. Cast from Orbit's own account via `cast_to_farcaster` if it is wired (S-004); otherwise from the owner's account, manually.

## 5. Acceptance criteria

The demo is "shipped" when ALL of these are true at the commit referenced in the cast:

- [ ] `memory/approvals.json` contains exactly one approval with this demo's `id`, `status === "approved"`, `issueNumber` set.
- [ ] `memory/treasury.json` contains exactly one new entry in `ai.refills` matching the demo amount and `approvalId`.
- [ ] `memory/treasury.json` `ai.providerCredits[provider==='configured-ai-credit-provider'].balanceUsd` increased by the refill amount.
- [ ] `memory/treasury.json` `ai.pendingTopUps[that approvalId].status === "recorded_complete"`.
- [ ] Cycle N proof references the approval issue URL (it is in the `request_ai_food_refill` step output's `approval.issueUrl`).
- [ ] Cycle N+M proof references the same `approvalId` and a non-empty `proof` string.
- [ ] One subsequent cycle made at least one successful AI call (ledger entry timestamp > refill `recordedAt`).
- [ ] Farcaster cast posted, linking proofs and issue.
- [ ] Integration test `tests/closed-loop-demo.test.js` passes locally and in CI.

If any item is missing, the demo did not ship — re-run instead of declaring done.

## 6. Failure modes

### 6.1 Owner doesn't approve in 24h

`memory/approvals.json` keeps the approval as `pending`. Every cycle will re-check via `checkOwnerApproval(forceRemote:true)`; nothing further happens until a real APPROVE line shows up. No timeout exists in code — the loop is patient on purpose. Owner can intentionally let it sit; the public record will simply show `pending` for the duration.

### 6.2 Owner rejects (`REJECT ORBIT-SPEND <id>`)

`approval.status` flips to `rejected`. Subsequent `record_ai_food_refill` calls with that `approvalId` return `blocked_pending_owner_approval` because `checkOwnerApproval` returns `rejected` (not `approved`). Note current behavior in actions.js: the response is shaped as "blocked", but the actual approval status is in `result.approvalStatus.status`. To run a fresh demo after a reject, change `amountUsd` so the fingerprint differs.

GAP: the `record_ai_food_refill` action currently surfaces `status: "blocked_pending_owner_approval"` even when the underlying approval is `rejected`. The `approvalStatus.status` carries the truth. Consider surfacing a distinct `status: "rejected"` in a future patch to `src/agent/actions.js::record_ai_food_refill`.

### 6.3 Owner posts a non-standalone approve line

E.g., `Do not APPROVE ORBIT-SPEND <id> yet.` — the comment parser at `governance.js::commentApproves` splits on newlines and only matches the exact tokens on a standalone trimmed line. This is intentional and tested. Recovery: post a new comment with just `APPROVE ORBIT-SPEND <id>` on its own line.

### 6.4 Owner posts the approve from a different account

If the comment author does not match `config.ownerUsername` (case-insensitive), `commentApproves` returns null. Status remains pending. Recovery: post from the configured account, or update `ORBIT_OWNER_USERNAME` and re-trigger.

### 6.5 AI provider rejects the manual top-up

Off-repo failure. Owner must not post the approve comment until the credits are actually purchased. If APPROVE was posted before the purchase succeeded and then the purchase failed, the safest move is to post `REJECT ORBIT-SPEND <id>` to flip the approval to rejected, then start a fresh request with a different amount.

### 6.6 Double-fire / idempotency

- Multiple `request_ai_food_refill` calls with identical (amountUsd, reason→fingerprintRequest minus requestedAt) collapse to one approval and one issue. `stableFingerprint` ignores `requestedAt`; `requestOwnerApproval` upserts. Verified by `tests/governance.test.js::repeated spend approval requests reuse one approval despite timestamp drift`.
- Multiple `record_ai_food_refill` calls with the same `approvalId` will each append an entry to `ai.refills` and each will bump `providerCredits[*].balanceUsd`. There is NO dedupe by approvalId on the refills array. Owners must not let the agent call record twice for the same approval.

GAP: `recordAiCreditRefill` in `src/agent/treasury.js` does not check whether `ai.refills` already contains an entry with the same `approvalId`. Suggested patch: skip the append (or return the existing entry) if `treasury.ai.refills.some(r => r.approvalId === refill.approvalId)`. Document-only here; do not patch in this session.

### 6.7 Approval issue closed without comment

If the owner closes the approval issue without commenting APPROVE or REJECT, `checkOwnerApproval` still scans existing comments — there are none, so status stays `pending`. The approval is effectively abandoned. Recovery: reopen and comment, or change the amount to create a fresh approval id.

### 6.8 Stale local approval, no remote issue

If `memory/approvals.json` has `status: "approved"` but `issueNumber: null`, `checkOwnerApproval(forceRemote:true)` returns `pending`. The recorder will refuse. Verified by `tests/governance.test.js::forced owner approval check revalidates stale local approval`. Manual edits to `memory/approvals.json` cannot back-door an approval.

## 7. Public cast template

Single Farcaster cast. ≤320 chars before the URL list. Markdown links rendered by the cast pipeline. Owner edits the placeholders.

```
First closed loop. Orbit asked for AI-budget refill, owner approved publicly,
Orbit recorded the receipt, the next cycle paid for itself.

cycle that asked        — <PROOF_URL_N>
approval issue          — <ISSUE_URL>
owner approval comment  — <COMMENT_URL>
cycle that recorded     — <PROOF_URL_N_PLUS_M>
treasury at that commit — <TREASURY_URL>
next cycle that used it — <PROOF_URL_N_PLUS_M_PLUS_1>

No keys held by the agent. No spend without an issue. Every link verifies.
```

Constraints:

- Do NOT mention the dollar amount in the cast body — it is visible in every linked artifact and quoting it in the cast invites bait replies. Sub-100-dollar amounts are not interesting; the closed loop is.
- Do NOT name the credit provider. The codebase aliases it as `configured-ai-credit-provider` deliberately (see `ai-food.js::publicPurchaseProviderName`).
- If `cast_to_farcaster` cannot accept arbitrary text (current behavior — see tool description: "Refuses arbitrary text"), this template ships as a `noteForReceipt` and the actual cast body uses the `milestone` template hint. Owner sets `templateHint: "milestone"` and stashes the URL list in `noteForReceipt` (limited to 240 chars — trim to the three most load-bearing URLs).

## 8. Test plan

Integration test lives at `tests/closed-loop-demo.test.js`. Runs against a fake `github` adapter — no network, no AI calls, hermetic. It exercises:

- A clean temp repo with default treasury + governance.
- Cycle 1: `executeTool(... "request_ai_food_refill", {amountUsd, reason})`. Asserts: `status === "blocked_pending_owner_approval"`, issue created via the adapter, `ai.pendingTopUps` has one entry, `approvals` has one entry with `issueNumber` set.
- Adapter is then mutated to simulate the owner posting a standalone `APPROVE ORBIT-SPEND <id>` comment from the configured owner account.
- Cycle 2: `executeTool(... "record_ai_food_refill", {amountUsd, approvalId, proof})`. Asserts: `status === "recorded"`, `entry.approvalId` matches, `ai.refills.length === 1`, `ai.refills[0].proof` is the owner-provided string, `ai.providerCredits[*].balanceUsd` increased by `amountUsd`, `ai.pendingTopUps[that id].status === "recorded_complete"`.
- Negative path A: rerun the request before approving — second response yields the same approval id (idempotent), `approvals.json` still has length 1.
- Negative path B: try to record with a non-owner comment — recorder refuses with `status: "blocked_pending_owner_approval"`.

Run locally:

```
cd /home/asuran/Downloads/orbit && node --test tests/closed-loop-demo.test.js
```

CI runs the same via the existing `npm test`. No new dependencies.

## 9. Gaps logged for future patches

These are noted here, NOT patched in this session. Each is a small follow-up the agent or owner can pick up later.

- `src/agent/actions.js::record_ai_food_refill` should distinguish `rejected` from `pending` in its public `status` field instead of collapsing both to `blocked_pending_owner_approval`. The truth is already in `result.approvalStatus.status`; surface it.
- `src/agent/treasury.js::recordAiCreditRefill` should dedupe by `approvalId` (skip or upsert if `ai.refills.some(r => r.approvalId === refill.approvalId)`) to make accidental double-records non-destructive.
- `src/agent/governance.js::requestOwnerApproval` could include the configured purchase URL (when set) in the approval issue body so the owner has a click-target. Currently the body lists category/asset/amount/recipient and the APPROVE/REJECT instructions but no link to the provider.
- No public timeout for stuck approvals. Consider adding a `pendingSinceHours` counter that the dashboard surfaces, so closed-loop fails are visible without anyone watching the issue list.
