# MISSION_BOARD.md — Public Mission Board Protocol (S-MB-1 spec, S-MB-2 build)

> Spec-only artifact. No production code lands here. No contract source. The stake contract gets owner-reviewed in Phase 3, after S-GATE-2 closes. Every numerical default in this document is marked **TBD in S-MB-2 implementation** and locked in via a follow-up D-XXX before any code merges.

This document specifies the Public Mission Board, a Phase 3 token-utility surface referenced in `PLAN/ROADMAP.md` ("Public mission board with staking (anyone can propose work; stake to prioritize; if shipped, proposer earns)") and in `src/agent/features.js` as the planned `public-mission-board` capability. The board is **hard-blocked by D-018** (no live code until 12-hour clean run + 30-day post-launch stability) and **gated by D-014** (no on-chain action without an approval issue + signed receipt) on every payout.

Distinct from `BOUNTY_MARKET.md`: a bounty is **funder-driven work-for-hire** — funder posts $ORBIT, a claimant ships, escrow releases. A mission is **proposer-driven priority signaling** — proposer stakes $ORBIT to elevate a piece of work on the public roadmap, and if the work is shipped by *anyone* (including Orbit itself or an adopter repo), the proposer earns a reward proportional to their stake. The two markets compose: a high-stake mission can attract a bounty funder, who in turn attracts a claimant.

---

## 1. Goal

Phase 3 needs a public, on-chain, verifiable way for the holder set to express *what should happen next* without each holder needing to know the founder personally. The mission board converts the question "what does Orbit do next?" from a private operator decision into a public market with skin in the game.

Three reasons $ORBIT is the right stake denomination:

1. **Inverts the bounty incentive direction.** Bounties pay claimants. Missions pay proposers. Together they cover both sides of the "I want this to exist" / "I'll ship that" coordination gap.
2. **Rewards taste, not just labor.** A proposer who consistently identifies missions that get shipped earns repeatedly. This is a prediction-market-like signal for which work is worth doing, surfaced publicly.
3. **Soft-couples to treasury floor.** Stake amounts are denominated in $ORBIT; rewards are drawn from a *mission rewards pool* that the operator carves from fee revenue per cycle. The treasury floor (D-017 WETH floor) is never touched.

Out of scope for this spec: stake-weighted *voting* on Orbit's roadmap (this is signaling, not governance); refundable stakes if the mission never ships within deadline (the stake returns, but proposer earns nothing — see §3); paying mission rewards in WETH (would compete with the treasury floor).

---

## 2. Constraints

- **GitHub-only infrastructure.** Mission lifecycle lives in GitHub issues + labels + comments. No external mission board, no off-chain database. Dashboard reads from GitHub + the stake contract; nothing else.
- **No new custodial surface for Orbit.** Treasury Safe (D-004) is the only Orbit-controlled wallet that holds operating funds. Stakes live in a per-mission stake contract that Orbit does **not** own. Orbit's agent key can only call `releaseReward` *after* an approval issue passes — and `releaseReward` only sends to the proposer recorded on-chain.
- **Every payout passes the approval gate (D-014).** No exceptions. `propose_mission_reward` and `execute_mission_reward` are split exactly like `proposeBuyback` / `executeBuyback` in `src/agent/buyback.js`.
- **The contract cannot be unilaterally drained by Orbit.** No admin withdraw, no sweep, no upgrade proxy. Proposer retains an unstake path that does not require Orbit cooperation past the mission deadline.
- **No LLM in the verifier loop.** Whether a mission is "shipped" is established by the same deterministic checker registry used by the bounty verifier (`PLAN/SPECS/BOUNTY_MARKET.md` §5). Same input, same output, every cycle.
- **No mission code runs live before S-GATE-2 closes.** See D-018 and §10 below.

---

## 3. Lifecycle

Numbered states. Every transition is guarded; no skips. State machine is the source of truth — labels on the GitHub issue mirror the state but are advisory for humans, not authoritative for the agent.

0. **mission.proposed** — a token holder opens a GitHub issue with the `/mission propose` template. Required fields: title, rationale, acceptance criteria, deadline, proposed stake amount. No funds moved yet.
1. **mission.staked** — proposer deposits $ORBIT into the stake contract via `stake(missionId, amount)`. Proposer posts the tx hash as an issue comment. Mission is not yet visible on the board.
2. **mission.active** — Orbit's next cycle confirms the on-chain `MissionStaked` event matches the issue's claimed amount and proposer. Orbit labels the issue `orbit:mission-active`. Mission appears on the public board ordered by stake (see §8).
3. **mission.shipped-pending** — a shipper (proposer, adopter repo maintainer, bounty claimant, anyone) comments on the issue with their shipping URL (PR link, signed receipt URL, deploy URL). Orbit records the first valid shipping claim; subsequent claims queue but only the first is evaluated unless rejected.
4. **mission.under-review** — a cycle picks up the shipping claim and runs `verify_mission_ship` against the acceptance-criteria block in the issue body. Uses the same checker registry as the bounty verifier.
5. **mission.shipped** *or* **mission.rejected** — verifier returns `{ok: true}` or `{ok: false, refusalCode}`. Rejection is reversible: the shipper can update their PR and re-claim, advancing back to state 3.
6. **mission.reward-pending** — on `shipped`, Orbit opens a public approval issue per D-014: *"release {rewardAmount} $ORBIT mission reward to @{proposer} for mission #{N}"*. Mission stays here until the owner adds the `APPROVE ORBIT-MISSION {idem}` comment. Stake itself is unlocked back to the proposer at the same moment, in the same tx.
7. **mission.rewarded** — Orbit calls `releaseReward(missionId, proposer, rewardAmount)` after approval. On `MissionRewarded` confirmation, Orbit writes a signed receipt linking *stake tx → shipping claim → verifier evidence → reward tx*. Issue is closed and labeled `orbit:mission-rewarded`.
8. **mission.unstaked** — if no shipping claim appeared by the deadline, the proposer calls `unstake(missionId)` and the contract returns the stake. No reward is paid. Issue is closed and labeled `orbit:mission-unstaked`.
9. **mission.disputed** — anyone (proposer, shipper, owner) may add the `orbit:dispute` label. Mission is frozen until the owner manually adjudicates by either approving a reward (advances to state 6) or approving an unstake (advances to state 8). No automated path out of state 9.

Terminal states: `rewarded`, `unstaked`. All others are transient. State persists in `memory/missions.json` alongside the canonical issue number, idempotency key, and last-checked cycle.

---

## 4. Storage shape (memory/missions.json)

```json
{
  "schema": "orbit-missions/1",
  "missions": [
    {
      "id": "mission-abc123",
      "issueNumber": 47,
      "issueRepo": "orbithousezkp/orbit",
      "idem": "mission-orbithousezkp-orbit-47-0xPROPOSER-1",
      "state": "active",
      "proposer": {
        "github": "alice",
        "address": "0xPROPOSER..."
      },
      "stake": {
        "amount": "500000000000000000000",
        "tokenAddress": "0xORBIT...",
        "txHash": "0xSTAKE...",
        "stakedAt": "2026-09-01T12:00:00Z"
      },
      "shipper": null,
      "verifierEvidence": null,
      "reward": {
        "amount": null,
        "approvalIssue": null,
        "txHash": null,
        "rewardedAt": null
      },
      "deadline": "2026-10-01T12:00:00Z",
      "lastCheckedCycle": 88
    }
  ]
}
```

Schema is read-only outside the cycle loop. Mission rewards pool ledger lives separately in `memory/mission-rewards-pool.json`:

```json
{
  "schema": "orbit-mission-pool/1",
  "balance": "1500000000000000000000",
  "lastFundedCycle": 88,
  "lastFundedAt": "2026-09-15T00:00:00Z",
  "policy": {
    "perCycleAllocationBps": 50,
    "perMissionMaxBps": 1000,
    "rewardMultiplierBps": 200
  },
  "history": []
}
```

`perCycleAllocationBps` is the share of incoming fee revenue routed to the pool each cycle (TBD in S-MB-2 implementation; placeholder 0.5%). `perMissionMaxBps` caps the reward as a fraction of the pool. `rewardMultiplierBps` is the headline payout: `reward = stake × multiplier / 10000` (placeholder 2× the stake). The actual reward is `min(stake × multiplier, pool × perMissionMaxBps)`.

---

## 5. Stake contract interface (Solidity surface only)

Source code is **not** in this spec. The owner reviews the contract in Phase 3 before deploy. Below is the interface and storage shape only.

```solidity
interface IMissionStake {
    struct Mission {
        address proposer;
        uint256 stakeAmount;
        uint64  deadline;
        uint8   status; // 0=empty, 1=staked, 2=rewarded, 3=unstaked
    }

    function stake(bytes32 missionId, uint256 amount, uint64 deadline) external;
    function releaseReward(bytes32 missionId, address proposer, uint256 rewardAmount) external; // onlyOrbitAgent + onlyAfterApproval
    function unstake(bytes32 missionId) external;                                                 // onlyProposer-after-deadline

    event MissionStaked(bytes32 indexed missionId, address indexed proposer, uint256 amount, uint64 deadline);
    event MissionRewarded(bytes32 indexed missionId, address indexed proposer, uint256 stakeReturned, uint256 rewardPaid);
    event MissionUnstaked(bytes32 indexed missionId, address indexed proposer, uint256 amount);
}

// Storage: mapping(bytes32 => Mission) missions;
// Plus: address public immutable ORBIT_TOKEN;
//       address public immutable ORBIT_AGENT;
//       address public immutable REWARDS_POOL; // distinct address; agent-controlled rewards pool, NOT treasury
```

**Hard rules baked into the contract** (enforced in source, not policy):

- The contract holds **only** $ORBIT (token address constructor-immutable). No other token can be deposited or extracted.
- `releaseReward` performs **two** transfers: (a) `stakeAmount` back to the proposer, (b) `rewardAmount` from `REWARDS_POOL` to the proposer. There is no path to transfer more than the recorded `stakeAmount` plus the passed `rewardAmount`. No multi-mission sweep. No path that lets `releaseReward` send to anyone except the recorded `proposer`.
- `releaseReward` reverts unless `msg.sender == ORBIT_AGENT` **and** the approval-marker check passes (signed approval message or on-chain registry — TBD in S-MB-2 implementation).
- `unstake` reverts unless `msg.sender == missions[missionId].proposer` **and** `block.timestamp > deadline` **and** status is still `staked`. After `rewarded`, unstake is impossible (status guard).
- No `owner`, no `upgrade`, no `sweep`, no `withdraw`. Contract is non-upgradeable. If a bug ships, the owner deploys a new contract and the old one's active stakes get unstaked at deadline.
- `missionId` is `keccak256(abi.encodePacked(repo, issueNumber, proposer, nonce))` — collision-resistant per (issue, proposer).

`ORBIT_AGENT` is the same signer address as `ORBIT_AGENT_SIGNER` from D-006. `REWARDS_POOL` is a distinct EOA or contract that holds the mission rewards pool; it is funded by the operator (Treasury Safe multisig) on a per-cycle cadence per the policy in §4. **The Treasury Safe never directly funds a payout** — it funds the pool, the pool funds the payout. This preserves the topology rule that no Orbit-controlled wallet ever signs a mission reward transfer directly.

---

## 6. Verifier flow

Reuses the bounty verifier (`PLAN/SPECS/BOUNTY_MARKET.md` §5) wholesale — same checker registry, same determinism contract, same refusal codes — with one addition.

Tool entry: `verify_mission_ship`.

Input: `{ missionId, shippingClaimUrl }` plus a read-only handle to the GitHub API for the mission's repo (which need not be the same as the proposer's repo — see §11 for cross-orbit missions).

Algorithm is identical to the bounty verifier with these differences:

- A mission's `shippingClaimUrl` may be a PR URL **or** an Orbit signed-receipt URL. A signed-receipt claim is valid only if (a) the receipt is verifiable via `@orbit-house/verifier`, (b) the receipt references the mission issue by canonical URL, and (c) the cycle in which the receipt was signed completed without a `REFUSAL` outcome on the referenced action.
- A new checker name `receipt-references-mission` is added to the registry: passes if the signed receipt's `actions[]` array contains an entry whose `summary` or `idem` references the mission's idempotency key.

All other checkers (`pr-merged`, `linked-issue-closed`, `ci-green`, `file-exists`, `tests-pass`) work as in the bounty spec.

Refusal modes added on top of the bounty verifier's set:

- `shipping-receipt-invalid` — signed receipt does not verify, or references a cycle that ended in refusal.
- `shipping-claim-not-pr-or-receipt` — URL is neither a PR nor a signed-receipt URL.
- `mission-deadline-passed` — verifier was run after `deadline`; new claims are not accepted past deadline (only unstake path is available).

Determinism contract: same as the bounty verifier — a verifier run at cycle N and cycle N+1 against the same inputs returns identical output, modulo `ci-green` and receipt verifiability changing only when underlying state changes.

---

## 7. Approval gate (D-014 alignment)

**Every reward payout** opens an approval issue. No shortcut for small amounts, repeat proposers, or "obvious" cases. This mirrors the buyback and bounty patterns exactly.

Approval issue body (template, exact strings finalized in S-MB-2 implementation):

> Orbit is requesting public owner approval to release a mission reward.
>
> Idempotency key: `{idem}`
> Mission id: `{missionId}`
> Source issue: `{issueUrl}`
> Shipping claim: `{shippingClaimUrl}`
> Proposer address: `{proposerAddress}`
> Stake returned: `{stakeAmount} $ORBIT`
> Reward to pay: `{rewardAmount} $ORBIT`
> Verifier evidence: `{commitSha}` / `{ciStatus}` / `{receiptUrl?}`
>
> Per D-014, no on-chain release will happen until the owner approves this issue.
> Per D-018, the agent will additionally refuse if the pre-launch gate has not been verified.
>
> To approve, the configured owner must add this exact standalone comment:
>
> `APPROVE ORBIT-MISSION {idem}`
>
> To reject:
>
> `REJECT ORBIT-MISSION {idem}`

Comment matcher reuses the `APPROVE`-prefix pattern from `governance.js` (`commentApprovesBuyback`). One implementation in S-MB-2: `commentApprovesMissionReward(ownerUsername, comment, idem)`.

**Pre-execution gate** (mirrors `isBuybackEnabled`):

- `ORBIT_ENABLE_MISSION_BOARD === "true"` (default false)
- `ORBIT_MISSION_DRY_RUN` defaults to `true`. Setting to `false` requires the gates below.
- `state.preLaunchVerified === true` (D-018)
- `state.tokenAddress` set and a valid address
- Stake contract address configured and matches the canonical deploy recorded in `memory/state.json`
- Mission rewards pool address configured and pool balance `>= rewardAmount` (no partial rewards; mission either gets paid in full or stays in `reward-pending`)
- Owner approval comment found on the approval issue (D-014)
- Mission's on-chain status reads as `staked` (not already rewarded/unstaked)

If any gate fails: `{ ok: false, blocked: true, reason, status: "blocked_precondition" }`. Live execution path stays unimplemented (per the same belt-and-braces pattern in `buyback.js`) until S-MB-2 wires it up under owner review.

---

## 8. Anti-abuse

- **Sybil floor on staked missions.** A given GitHub username can have at most **TBD in S-MB-2 implementation** active missions at any time. Limit tracked in `memory/missions.json`. New proposals from the same username block at state 0 until an existing mission terminates.
- **Self-shipping disclosure.** A proposer who also ships their own mission is allowed — that is the prediction-market success case — but the approval issue body must surface this explicitly: *"Proposer @{name} also shipped this mission."* Owner reviews with full visibility.
- **Quality-minimum / anti-spam floor.** A mission cannot be staked for less than the floor amount; the wording is: *a mission cannot be staked < {N} $ORBIT (anti-spam floor)*. **TBD in S-MB-2 implementation** — calibrated separately from the bounty floor.
- **Maximum stake size.** A single mission cannot stake more than **TBD in S-MB-2 implementation** $ORBIT. Above the cap, the proposer must split or escalate through the Treasury Safe.
- **Reward cap per mission.** Independently of the stake cap, no single mission can pay out more than `perMissionMaxBps` of the rewards pool (see §4). Even if the multiplier formula would yield a higher number, the pool cap binds.
- **Outbound safety.** Every cast, issue body, and approval-issue body about a mission passes through `assertSafePublicReply` from `src/agent/safety.js` and `scanTextRisk` from `src/agent/scam.js`. Same surface as bounty market.
- **Approval-issue safety.** Approval issue bodies are templated server-side; user-supplied strings (issue titles, claim URLs, rationale text) are sanitised by the same safety helpers before substitution.
- **Deadline floor and ceiling.** Mission deadlines must sit between **TBD in S-MB-2 implementation** (floor) and **TBD in S-MB-2 implementation** (ceiling). Below the floor, the mission can't realistically attract a shipper; above the ceiling, abandoned missions sit too long.
- **Stake cannot be increased mid-flight.** A mission stake is fixed at state 1. Proposers who want more weight close their mission (via unstake after deadline) and open a new one. This prevents stake-laundering attacks where a proposer rugs their own visibility ranking by withdrawing.

---

## 9. Public surface

- **Dashboard tab (`orbit.horse`).** New "Missions" tab showing three lists: *Active* (state 2 to 5, ordered by stake desc), *Recently rewarded* (state 7, last 30 days), *Recently unstaked* (state 8, last 30 days). Each row links to the GitHub issue, the stake tx, the shipping claim (if any), and the signed receipt. Dashboard reads via the SDK; no PII surfaced.
- **SDK extension.** `projectForDashboard()` returns a new `missions: { active: number, rewarded: number, unstaked: number, totalRewardedOrbit: string, topActive: Mission[] }` summary, where `topActive` is the top **TBD in S-MB-2 implementation** missions by stake. No proposer identities beyond what is already public on GitHub. No wallet-to-username mappings.
- **Federation surface.** Each Orbit instance's `/.well-known/orbit.json` (S-021/22/23, now shipping) gains a `missions` capability declaring whether the mission board is `active`, `disabled`, or `planned`. Other orbits can discover and read mission lists via the upcoming federation `INTEL_SHARE` message type (deferred; see §11).
- **Farcaster cast template** (per D-008, in-cycle, not external):
  > `mission rewarded: {amount} $ORBIT to @{proposer} for "{one-line summary}", receipt: {receipt-url}`
- **Refusal log.** Per S-017 refusal logging surface, rejected verifications, refused rewards, and disputed missions are posted to the public refusal log with the standard redaction.

---

## 10. D-018 enforcement

This is the hard block. The mission board is **not live** until:

1. S-GATE-2 has closed — $ORBIT is deployed, the 30-day post-launch stability window has elapsed without incident, first buyback has executed publicly.
2. S-GATE-3 has closed — bounty market is live and stable for at least one full deadline cycle. (Mission board reuses the bounty verifier registry; if that registry is unstable, missions are unstable.)
3. The stake contract has been owner-reviewed and deployed via Safe multisig.
4. The mission rewards pool address has been funded with an initial allocation by the Treasury Safe per a separate D-XXX decision.
5. `ORBIT_ENABLE_MISSION_BOARD=true` is set in repo variables — flipped only after owner sign-off.

Even after that, `ORBIT_MISSION_DRY_RUN` defaults to `true`. Live execution requires both `state.preLaunchVerified === true` (the D-018 gate that already blocks token launch) **and** an explicit operator flip per mission, mirroring the buyback flow.

**Spec-only here.** S-MB-1 produces this document. S-MB-2 produces the implementation and tests, gated behind the above. No mission-related code merges to `main` in a "live" state before S-GATE-3 closes — anything that does land before then must be DRY_RUN-only and explicitly marked.

---

## 11. Federation hooks (deferred to S-MB-3)

Cross-orbit missions are explicitly deferred. The v1 spec covers missions filed *against the orbit's own repo*. Cross-orbit ("propose a mission in orbit A that is shipped by adopter repo B") opens questions the spec does not pretend to answer:

- A new federation message type `MISSION_INTEL` advertising active missions to peer orbits. Payload: missionId, repo, stakeAmount, deadline, acceptance-criteria fingerprint, idem. Signed by the proposing orbit's signer (S-021 envelope).
- Cross-orbit shipping: a shipper in repo B ships work matching a mission in repo A. Verifier runs in both orbits. Reward payout requires approval issues in *both* repos. Mirrors `BOUNTY_REFERRAL.md` topology.
- Cross-orbit dispute resolution: who adjudicates if both repos disagree on verification? Open question.

S-MB-3 spec lands after S-MB-2 implementation has run for at least one deadline cycle on single-repo missions.

---

## 12. Test plan

Test files written during S-MB-2 (paths illustrative):

- `tests/mission-lifecycle.test.js` — state machine. Every transition has a guard; no skips. Cover: 0→1, 1→2, 2→3, 3→4, 4→5(shipped), 4→5(rejected), 5(shipped)→6, 6→7, 5(rejected)+deadline→8, no-claim+deadline→8, any-state→9, 9→6, 9→8. Negative tests: 0→2 (skip staking), 2→7 (skip approval), 6→7 without owner comment.
- `tests/mission-verifier.test.js` — verifier determinism. Same input → same output, run 100 times. All refusal codes exercised, including the three new ones (`shipping-receipt-invalid`, `shipping-claim-not-pr-or-receipt`, `mission-deadline-passed`). Mocked GitHub responses; no live calls.
- `tests/mission-unstake-timeout.test.js` — unstake cannot be triggered before deadline; unstake succeeds after deadline; only proposer (not Orbit) can call unstake; status guard prevents unstake after reward.
- `tests/mission-approval-matcher.test.js` — `commentApprovesMissionReward` matches the exact `APPROVE ORBIT-MISSION {idem}` pattern from §7, rejects look-alikes, requires the comment author to be `ownerUsername`. Reuses scaffolding from the bounty approval-matcher tests.
- `tests/mission-precondition-gate.test.js` — every combination of missing `ORBIT_ENABLE_MISSION_BOARD`, missing `preLaunchVerified`, missing `tokenAddress`, missing stake-contract address, and pool balance < rewardAmount returns `blocked_precondition` with the correct `reason`.
- `tests/mission-rewards-pool.test.js` — pool ledger math: per-cycle allocation, per-mission cap, multiplier formula, exhaustion case (pool would go negative → reward blocked).
- `tests/mission-anti-abuse.test.js` — sybil ceiling on active missions per username, self-shipping discloses correctly, sub-floor stake rejected, oversize stake rejected, stake-increase attempts rejected, outbound safety on every cast/issue body.

Coverage target for S-MB-2: every state transition has at least one happy-path and one negative-path test; every refusal code has at least one test; every D-014 / D-018 gate has at least one test.

---

## 13. Open questions for S-MB-1 follow-up

These are explicitly deferred. The spec does not pretend to answer them.

- **Pool funding source.** Operating fee revenue (D-017 operator share) vs. a separate cycle carve-out vs. a one-time initial grant from Treasury Safe. Each has different sustainability properties; pick one in a D-XXX decision before S-MB-2.
- **Multiplier curve.** Flat multiplier (2× stake) is the simplest. Alternatives: tapered (large stakes earn proportionally less), decay (longer-deadline missions earn more), reputation-weighted (proposers with a track record earn more). Open until we have data from real proposals.
- **Stake slashing for malicious proposals.** Should a mission that gets rejected with `risky_payload` (e.g. proposes Orbit takes a harmful action) slash the stake instead of returning it? Slashing introduces an adversarial governance surface; v1 says no, deferred.
- **Concurrent ship claims.** If two PRs claim to ship the same mission, the spec says the *first valid* claim is evaluated. But "first" is a race condition. Possible fix: any valid claim within a grace window is evaluated, and ties resolve by which PR was merged first. Deferred.
- **Mission expiration without unstake.** If a proposer never calls `unstake` after deadline, the stake sits in the contract. Options: burn at contract level after a long grace (clean), recycle into the rewards pool (utilitarian, but creates a path Orbit benefits from proposer inactivity), leave stuck. Deferred to a D-XXX entry before S-MB-2 contract source review.
- **Mission visibility for non-token-holders.** The board is public; reading is free. But should ranking be visible only to holders, or to anyone? v1 says visible to anyone — public coordination beats holder gatekeeping. Worth revisiting if spam becomes a problem.

---

## 14. Cross-references

- D-014 — *No on-chain action without an approval issue + signed receipt.* Every state-6 → state-7 transition obeys this without exception. (Also referenced in §2, §7.)
- D-018 — *Token launch is hard-blocked until the existing build runs cleanly.* Generalised here: the mission board is hard-blocked behind the same `state.preLaunchVerified` flag **and** the additional S-GATE-3 closure requirement. (Also referenced in §7, §10.)
- D-005 — buyback approval pattern. Mission propose/execute split copies it.
- D-006 — signed cycle proofs. Mission reward receipts chain through this signing path. Shipping-receipt verification (§6) verifies against this contract.
- D-017 — 2-recipient treasury. Treasury never holds mission stake or reward funds; the stake contract holds stakes, a separate pool address holds rewards. Mission board does not add new wallets to the treasury topology.
- `PLAN/SPECS/BOUNTY_MARKET.md` — sister market. Verifier registry is shared. Lifecycle states are intentionally parallel for shared review surface.
- `PLAN/SPECS/FEDERATION.md` — federation envelope used by deferred `MISSION_INTEL` message type (§11).
- `PLAN/SPECS/PROOF_SIGNING.md` — signed-receipt verification used by `receipt-references-mission` checker.
- `src/agent/features.js` — `public-mission-board` feature entry; status changes from `planned` → `spec` on S-MB-1 close, → `implementation` on S-MB-2 start, → `live` only after the §10 gates.

End of spec.
