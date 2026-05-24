# BOUNTY_MARKET.md — $ORBIT Bounty Market (S-019 spec, S-020 build)

> Spec-only artifact. No production code lands here. No contract source. The escrow contract gets owner-reviewed in Phase 3, after S-GATE-2 closes. Every numerical default in this document is marked **TBD in S-020 implementation** and locked in via a follow-up D-XXX before any code merges.

This document covers Phase 3 work item S-019 (plan) and S-020 (build). See `PHASES.md` for the Phase 3 exit criteria. The market is hard-blocked by D-018 (no live code until 12-hour clean run + 30-day post-launch stability) and gated by D-014 (no on-chain action without an approval issue + signed receipt) on every payout.

---

## 1. Goal

Phase 3's coordination problem is concrete: as adopter repos grow past the first ten, the founder cannot personally triage every drive-by issue, doc gap, or small PR across the federation. The bounty market lets any $ORBIT holder put a small, denominated bounty on a specific repo task — issue triage, doc work, a tiny PR, a refusal-pattern improvement — and lets any contributor claim it. Orbit verifies completion against the issue's acceptance criteria and routes payment through the same approval gate every other on-chain action passes.

$ORBIT is the right denomination for three reasons:

1. **Closed loop with the trading fee floor.** Treasury accumulates WETH from trading fees (D-017). Bounty funders convert WETH (or any token) to $ORBIT to fund a bounty. This creates organic buy pressure that is *not* the treasury buying itself (D-005 already covers treasury buyback).
2. **Signals taste, not just price.** A funder spending $ORBIT to coordinate work is making a public, recorded, verifiable allocation. That is a different kind of signal than a tip jar.
3. **Token utility independent of speculation.** Closes Phase 3's exit-criterion gap: "$ORBIT becomes useful for something besides speculation."

Out of scope for this spec: paying bounties in WETH (would compete with the treasury floor), paying bounties in stablecoins (would require new custody surface), multi-claimant splits (deferred — see §11).

---

## 2. Constraints

- **GitHub-only infrastructure.** Bounty lifecycle lives in GitHub issues + labels + comments. No external bounty board, no off-chain database. Dashboard reads from GitHub + the escrow contract; nothing else.
- **No new custodial surface for Orbit.** The Treasury Safe (D-004) is the only Orbit-controlled wallet that holds funds. Bounties live in a per-bounty escrow contract that Orbit does **not** own. Orbit's agent key can only call `release` *after* an approval issue passes — and `release` only sends to the claimant recorded on-chain.
- **Every payout passes the approval gate (D-014).** No exceptions. `propose_bounty_release` and `execute_bounty_release` are split exactly like `proposeBuyback` / `executeBuyback` in `src/agent/buyback.js`.
- **The contract cannot be unilaterally drained by Orbit.** No admin withdraw, no sweep, no upgrade proxy. Funder retains a refund path that does not require Orbit cooperation past the timeout.
- **No LLM in the verifier loop.** Verification is deterministic — same input, same output. The agent only makes the *decision to propose* a payout; the *fact of completion* is established by checks anyone can re-run.
- **No bounty code runs live before S-GATE-2 closes.** See D-018 and §9 below.

---

## 3. Lifecycle

Numbered states. Every transition is guarded; no skips. State machine is the source of truth — labels on the GitHub issue mirror the state but are advisory for humans, not authoritative for the agent.

0. **bounty.proposed** — a token holder opens a GitHub issue with a structured body (`/bounty fund` template). Acceptance criteria, deadline, repo target, and proposed amount are required fields. No funds moved yet.
1. **bounty.escrowed** — funder deposits $ORBIT into the escrow contract via `fund(bountyId, amount)`. Funder posts the tx hash as an issue comment. Bounty is not yet live.
2. **bounty.open** — Orbit's next cycle confirms the on-chain `BountyFunded` event matches the issue's claimed amount and funder. Orbit labels the issue `orbit:bounty-open`. Anyone may now claim.
3. **bounty.claimed** — a claimant comments on the issue with their work URL (PR link, gist, branch). Orbit records the first valid claim; subsequent claims queue but only the first is evaluated unless it is rejected.
4. **bounty.under-review** — a cycle picks up the open claim and runs `verify_bounty_claim` against the acceptance-criteria block in the issue body.
5. **bounty.verified** *or* **bounty.rejected** — verifier returns `{ok: true}` or `{ok: false, refusalCode}`. Rejection is reversible: the claimant can update their PR and re-claim, advancing back to state 3.
6. **bounty.approval-pending** — on `verified`, Orbit opens a public approval issue per D-014: *"release {amount} $ORBIT bounty to @{claimant} for issue #{N}"*. Bounty stays here until the owner adds the `APPROVE ORBIT-BOUNTY {idem}` comment.
7. **bounty.paid** — Orbit calls `release(bountyId, claimant)` after approval. On `BountyReleased` confirmation, Orbit writes a signed receipt linking *escrow funding tx → claim comment → verifier evidence → payout tx*. Issue is closed and labeled `orbit:bounty-paid`.
8. **bounty.refunded** — if the bounty reached state 5 as `rejected` and the deadline has passed, or if no claimant ever appeared past `deadline`, the funder calls `refund(bountyId)` and the contract returns the deposit. Issue is closed and labeled `orbit:bounty-refunded`.
9. **bounty.disputed** — anyone (funder, claimant, owner) may add the `orbit:dispute` label. Bounty is frozen until the owner manually adjudicates by either approving a payout (advances to state 6) or approving a refund (advances to state 8). No automated path out of state 9.

Terminal states: `paid`, `refunded`. All others are transient. State persists in `memory/bounties.json` alongside the canonical issue number, idempotency key, and last-checked cycle.

---

## 4. Escrow contract interface (Solidity surface only)

Source code is **not** in this spec. The owner reviews the contract in Phase 3 before deploy. Below is the interface and storage shape only.

```solidity
interface IBountyEscrow {
    struct Bounty {
        address funder;
        address claimant;     // zero until release
        uint256 amount;       // $ORBIT, raw units
        uint64  deadline;     // unix seconds
        uint8   status;       // 0=empty, 1=funded, 2=released, 3=refunded
    }

    function fund(bytes32 bountyId, uint256 amount) external;
    function release(bytes32 bountyId, address claimant) external; // onlyOrbitAgent + onlyAfterApproval
    function refund(bytes32 bountyId) external;                    // onlyFunder OR onlyOrbitAgent-after-timeout

    event BountyFunded(bytes32 indexed bountyId, address indexed funder, uint256 amount, uint64 deadline);
    event BountyReleased(bytes32 indexed bountyId, address indexed claimant, uint256 amount);
    event BountyRefunded(bytes32 indexed bountyId, address indexed funder, uint256 amount);
}

// Storage: mapping(bytes32 => Bounty) bounties;
```

**Hard rules baked into the contract** (enforced in source, not policy):

- The contract holds **only** $ORBIT (token address constructor-immutable). No other token can be deposited or extracted.
- `release` transfers **only** `bounties[bountyId].amount` to the passed `claimant`. There is no path to transfer more than what was funded under that `bountyId`. No multi-bounty sweep.
- `release` reverts unless `msg.sender == ORBIT_AGENT` **and** the approval-marker check passes (signed approval message or on-chain registry — TBD in S-020 implementation).
- `refund` reverts unless `msg.sender == bounties[bountyId].funder` *or* (`msg.sender == ORBIT_AGENT` AND `block.timestamp > deadline`).
- No `owner`, no `upgrade`, no `sweep`, no `withdraw`. Contract is non-upgradeable. If a bug ships, the owner deploys a new contract and the old one's bounties get refunded.
- `bountyId` is `keccak256(abi.encodePacked(repo, issueNumber, funder, nonce))` — collision-resistant per (issue, funder).

`ORBIT_AGENT` is the same signer address as `ORBIT_AGENT_SIGNER` from D-006. Re-keying requires Treasury Safe multisig vote (same constraint as operator recipient in D-017).

---

## 5. Agent verifier flow

The verifier is the central trust artifact of the bounty market. It must be deterministic — same inputs produce the same `{ok, evidence, refusalCode?}` output, every cycle, on every machine. No LLM is in this loop.

Tool entry: `verify_bounty_claim`.

Input: `{ bountyId, claimUrl }` plus a read-only handle to the GitHub API for the bounty's repo.

Algorithm:

1. Parse the acceptance-criteria block from the issue body. Required schema: an `## Acceptance Criteria` heading followed by one or more `- [ ] {check}` lines, where each check maps to a known checker name (e.g. `pr-merged`, `linked-issue-closed`, `ci-green`, `file-exists`, `tests-pass`). Unknown checker names → reject with `refusalCode: "unknown-checker"`.
2. Resolve `claimUrl` to a PR. If it is not a PR URL in the bounty's target repo → reject with `refusalCode: "claim-not-pr"`.
3. Run each checker deterministically against the resolved PR:
   - `pr-merged` → PR's `merged === true` and `mergedAt` non-null.
   - `linked-issue-closed` → every issue number referenced by `Closes #N` / `Fixes #N` in the PR body is in `closed` state and closed by the same PR (cross-checked via the closing event).
   - `ci-green` → latest commit on the PR has all required-status-checks passing.
   - `file-exists` → after merge, the named file path exists at `mergedAt`'s commit SHA.
   - `tests-pass` → CI run named `tests` (or repo-configured equivalent) has `conclusion === "success"`.
4. Output `{ ok: true, evidence: { prUrl, commitSha, ciStatus, mergedAt, closedIssues } }` only if **all** checkers pass.
5. Otherwise output `{ ok: false, refusalCode, evidence: <partial> }`.

Refusal modes (canonical codes):

- `claim-already-verified` — bounty's state is past 4.
- `pr-not-merged` — `pr-merged` checker failed.
- `ci-not-green` — `ci-green` checker failed.
- `acceptance-criteria-missing` — issue body has no `## Acceptance Criteria` block, or block is empty.
- `unknown-checker` — acceptance-criteria block references a checker name not in the registry.
- `claim-not-pr` — `claimUrl` does not resolve to a PR in the bounty repo.
- `claim-by-funder` — claimant address == funder address (see §7).
- `verifier-stale` — checker registry version drifted between cycles; re-run next cycle. TBD in S-020 implementation.

Determinism contract: a verifier run at cycle N and cycle N+1 against the same inputs returns identical output, modulo `ci-green` results changing only when the underlying GitHub status changes. Repeatability is what makes the verifier auditable from outside the repo.

---

## 6. Approval gate (D-014 alignment)

**Every payout** opens an approval issue. No shortcut for small amounts, repeat claimants, or "obvious" cases. This mirrors the buyback pattern in `src/agent/buyback.js` exactly.

Approval issue body (template, exact strings finalized in S-020 implementation):

> Orbit is requesting public owner approval to release a bounty payout.
>
> Idempotency key: `{idem}`
> Bounty id: `{bountyId}`
> Source issue: `{issueUrl}`
> Claim PR: `{claimUrl}`
> Claimant address: `{claimantAddress}`
> Amount: `{amount} $ORBIT`
> Verifier evidence: `{commitSha}` / `{ciStatus}`
>
> Per D-014, no on-chain release will happen until the owner approves this issue.
> Per D-018, the agent will additionally refuse if the pre-launch gate has not been verified.
>
> To approve, the configured owner must add this exact standalone comment:
>
> `APPROVE ORBIT-BOUNTY {idem}`
>
> To reject:
>
> `REJECT ORBIT-BOUNTY {idem}`

Comment matcher uses the same `APPROVE`-prefix pattern as `governance.js` and `buyback.js` (`commentApprovesBuyback`). One implementation in S-020: `commentApprovesBountyRelease(ownerUsername, comment, idem)`.

**Pre-execution gate** (mirrors `isBuybackEnabled`):

- `ORBIT_ENABLE_BOUNTIES === "true"` (default false)
- `ORBIT_BOUNTY_DRY_RUN` defaults to `true`. Setting to `false` requires the gates below.
- `state.preLaunchVerified === true` (D-018)
- `state.tokenAddress` set and a valid address
- Escrow contract address configured and matches the canonical deploy recorded in `memory/state.json`
- Owner approval comment found on the approval issue (D-014)
- Bounty's on-chain status reads as `funded` (not already released/refunded)

If any gate fails: `{ ok: false, blocked: true, reason, status: "blocked_precondition" }`. Live execution path stays unimplemented (per the same belt-and-braces pattern in `buyback.js` line 432–447) until S-020 wires it up under owner review.

---

## 7. Anti-abuse

- **Sybil floor on funded bounties.** A given GitHub username can fund at most **TBD in S-020 implementation** bounties per rolling 7-day window. Limit tracked in `memory/bounties.json`. Exceeding it blocks new `bounty.proposed` issues from advancing to `bounty.open` — funder is told to wait. Rate limit is per-username, not per-address, since address sybil is trivially cheap.
- **Insider claim prohibition.** Claimant wallet address cannot equal funder wallet address; if it does, verifier returns `refusalCode: "claim-by-funder"`. Also: claimant GitHub username cannot equal funder GitHub username. Both checks must pass.
- **Quality-minimum / anti-spam floor.** A bounty cannot be opened for less than the floor amount; the wording is: *a bounty cannot be < {N} $ORBIT (anti-spam floor)*. **TBD in S-020 implementation** — likely calibrated to roughly the dollar-equivalent of one small coffee at launch price.
- **Maximum bounty size.** A single bounty cannot exceed **TBD in S-020 implementation** $ORBIT. Above the cap, the bounty must be split or escalated through the Treasury Safe.
- **Outbound safety.** Every cast, issue body, and approval-issue body about a bounty passes through `assertSafePublicReply` from `src/agent/safety.js` and `scanTextRisk` from `src/agent/scam.js`. No surprise endorsements; no embedding of unaudited links; no leaking of claimant emails or non-public addresses.
- **Approval-issue safety.** Approval issue bodies are templated server-side; user-supplied strings (PR titles, claim URLs) are sanitised by the same safety helpers before being substituted in.
- **Deadline floor and ceiling.** Bounty deadlines must sit between **TBD in S-020 implementation** (floor — long enough for someone to do the work) and **TBD in S-020 implementation** (ceiling — short enough that abandoned bounties don't sit forever).

---

## 8. Public surface

- **Dashboard tab (`orbit.horse`).** New "Bounties" tab showing three lists: *Open* (state ≤ 3), *Recently paid* (state 7, last 30 days), *Recently refused* (state 5 rejected + state 8 refunded, last 30 days). Each row links to the GitHub issue, the escrow tx, and the signed receipt. Dashboard reads via the SDK; no PII surfaced.
- **SDK extension.** `projectForDashboard()` returns a new `bounties: { open: number, paid: number, refunded: number, totalPaidOrbit: string }` summary. No claimant identities beyond what is already public on GitHub. No wallet-to-username mappings.
- **Farcaster cast template** (per D-008, in-cycle, not external):
  > `bounty paid: {amount} $ORBIT for {one-line summary of issue}, receipt: {receipt-url}`
- **Refusal log.** Per S-017 refusal logging surface, rejected verifications and refused payouts are posted to the public refusal log with the standard redaction.

---

## 9. D-018 enforcement

This is the hard block. The bounty market is **not live** until:

1. S-GATE-2 has closed — i.e., $ORBIT is deployed, the 30-day post-launch stability window has elapsed without incident, first buyback has executed publicly.
2. The escrow contract has been owner-reviewed and deployed via Safe multisig.
3. `ORBIT_ENABLE_BOUNTIES=true` is set in repo variables — flipped only after owner sign-off.

Even after that, `ORBIT_BOUNTY_DRY_RUN` defaults to `true`. Live execution requires both `state.preLaunchVerified === true` (the D-018 gate that already blocks token launch) **and** an explicit operator flip per bounty, mirroring the buyback flow.

**Spec-only here.** S-019 produces this document. S-020 produces the implementation and tests, gated behind the above. No bounty-related code merges to `main` in a "live" state before S-GATE-2 closes — anything that does land before then must be DRY_RUN-only and explicitly marked.

---

## 10. Test plan

Test files written during S-020 (paths illustrative):

- `tests/bounty-lifecycle.test.js` — state machine. Every transition has a guard; no skips. Cover: 0→1, 1→2, 2→3, 3→4, 4→5(verified), 4→5(rejected), 5(verified)→6, 6→7, 5(rejected)+timeout→8, no-claimant+timeout→8, any-state→9, 9→6, 9→8. Negative tests: 0→2 (skip funding), 2→7 (skip approval), 6→7 without owner comment.
- `tests/bounty-verifier.test.js` — verifier determinism. Same input → same output, run 100 times. All refusal codes exercised. Mocked GitHub responses; no live calls.
- `tests/bounty-refund-timeout.test.js` — refund cannot be triggered before deadline; refund succeeds after deadline; funder can refund directly without Orbit; agent can refund after timeout if funder is unresponsive.
- `tests/bounty-approval-matcher.test.js` — `commentApprovesBountyRelease` matches the exact `APPROVE ORBIT-BOUNTY {idem}` pattern from §6, rejects look-alikes, requires the comment author to be `ownerUsername`. Reuses the test scaffolding from the buyback approval-matcher tests.
- `tests/bounty-precondition-gate.test.js` — every combination of missing `ORBIT_ENABLE_BOUNTIES`, missing `preLaunchVerified`, missing `tokenAddress`, and missing escrow address returns `blocked_precondition` with the correct `reason`.
- `tests/bounty-anti-abuse.test.js` — sybil rate limit, funder=claimant rejection, sub-floor amount rejected, oversize amount rejected, outbound safety on every cast/issue body.

Coverage target for S-020: every state transition has at least one happy-path and one negative-path test; every refusal code has at least one test; every D-014 / D-018 gate has at least one test.

---

## 11. Open questions for S-019 follow-up

These are explicitly deferred. The spec does not pretend to answer them.

- **Burn vs. recycle for abandoned bounties.** If a bounty reaches `bounty.refunded` and the funder is also unresponsive (never calls `refund`, never collects after Orbit's timeout-driven refund), what happens to the orphaned $ORBIT? Options: burn at contract level (clean, irreversible, deflationary); recycle into the Treasury Safe (utilitarian, but creates an Orbit-can-touch-it path that this spec otherwise forbids); leave it stuck (honest, slightly stupid). Decision deferred to a D-XXX entry before S-020 contract source review.
- **Multi-claimant bounties (split).** Two contributors collaborate on a PR; both want a share. Deferred to Phase 4. Workaround: funder opens two bounties, half each.
- **Cross-repo bounties via federation.** A bounty in repo A pays out a claim in repo B (linked by the federation HELLO/INTEL_SHARE protocol). Deferred to S-026 (BOUNTY_REFERRAL message type), which depends on the federation protocol shipping first.
- **Quadratic funding / matching.** Holders match small bounties from a treasury pool. Out of scope until Phase 4 at earliest.
- **Reputation / claimant rate limits.** Should a claimant who has had N rejected claims be temporarily blocked? Deferred until we have data from real claims.

---

## 12. Cross-references

- D-014 — *No on-chain action without an approval issue + signed receipt.* Every state-6 → state-7 transition obeys this without exception. (Also referenced in §2, §6.)
- D-018 — *Token launch is hard-blocked until the existing build runs cleanly.* Generalised here: the bounty market is hard-blocked behind the same `state.preLaunchVerified` flag **and** the additional S-GATE-2 closure requirement. (Also referenced in §6, §9.)
- D-005 — buyback approval pattern. Bounty propose/execute split copies it.
- D-006 — signed cycle proofs. Bounty payout receipts chain through this signing path.
- D-017 — 2-recipient treasury. Treasury never holds bounty escrow; the per-bounty contract does. Bounty market does not add new wallets to the treasury topology.

End of spec.
