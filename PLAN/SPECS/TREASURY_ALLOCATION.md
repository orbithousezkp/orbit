# TREASURY_ALLOCATION.md — Layered Treasury Topology (S-TREAS-1)

> Decision artifact: `PLAN/DECISIONS.md` D-019 (supersedes D-017's "single Treasury Safe" stance). This spec is the implementation contract.

The 95% creator-share Treasury slice is held across **6 dedicated Safe multisigs on Base**, organized into 3 categories — Treasury / Business / Operations. The 5% Operator share is **outside this math** and continues as a single weekly payout to the founder per D-017.

This document covers: bucket definitions, weekly sweep mechanic, approval gating, refusal codes, dashboard surface, test plan, key backup pointer. Code lives in `src/agent/treasury-sweep.js` and `tests/treasury-sweep.test.js`.

---

## 1. The full money flow

```
Every $ORBIT swap pays 1% in fees:
  ├── 20% → Clanker protocol (gone; can't avoid)
  └── 80% creator share (the 10000 bps Orbit captures)
       ├── 500  bps (= 4% of total fees)  → Operator wallet (founder, weekly)
       └── 9500 bps (= 76% of total fees) → Fee Receive Safe (transit)
            │
            │  swept weekly to the 6 bucket Safes:
            │
            ├── 4500 bps of receive (= 65% × 70% Treasury) → Floor Reserve Safe
            ├── 2000 bps                                    → Productive Yield Safe
            ├──  500 bps                                    → Buyback Safe
            ├── 1500 bps                                    → Growth Safe
            ├── 1000 bps                                    → AI Costs Safe
            └──  500 bps                                    → Operations Runway Safe
                 (sums to 10000 bps = 100% of fee receive)
```

The Fee Receive Safe holds funds only between the Clanker claim and the weekly sweep. It never holds long-term — it's a transit account that should usually be near-zero outside the sweep window.

---

## 2. Bucket definitions

### Treasury category (6500 bps of fee receive = 49.4% of creator share = 39.5% of total fees)

**Floor Reserve Safe (4500 bps)** — the price-floor anchor. Holds WETH. Funds in this Safe are **not deployable** through any normal cycle path. The sweep flow has no transfer-out template targeting this Safe except for inbound. Draining requires a new D-XXX decision and the Safe's full multisig threshold. If $ORBIT trades below the WETH-floor implied by this balance, the system has bigger problems than treasury rebalancing.

**Productive Yield Safe (2000 bps)** — funds approved for productive deployment per `TREASURY_PRODUCTIVE.md` (S-027). Maximum 30% of this Safe's balance can be in any single venue; total deployable is the Safe's full balance (the 60% project-wide cap from S-027 §3 is replaced by "you can't deploy more than this Safe holds"). Withdrawal SLA ≤7 days per S-027.

### Business category (2000 bps = 15.2% of creator share = 12.2% of total)

**Buyback Safe (500 bps)** — sole funding source for the weekly buyback flow (D-005, `src/agent/buyback.js`). The buyback module reads this Safe's WETH balance, files an approval issue, swaps WETH→$ORBIT through a configured router. Bought-back $ORBIT destination (burn vs vest) per S-014.

**Growth Safe (1500 bps)** — single Safe funding three coordination programs whose individual sub-budgets are tracked in `memory/growth-allocations.json`:

| Program | Default % of Growth Safe | Source |
|---|---|---|
| Mission rewards pool | 33% | Funds `MISSION_BOARD.md §4` pool |
| Adopter incentive pool | 33% | Funds handshake bounties + first-cycle subsidies for verified adopters |
| Bounty match pool | 34% | Matches community bounties per `BOUNTY_MARKET.md` |

The 33/33/34 split is policy, not contract-level. Each payout from the Growth Safe is its own D-014 approval issue tagged with the program identifier. The ledger ensures no single program exceeds its allocation without re-balancing.

### Operations category (1500 bps = 11.4% of creator share = 9.1% of total)

**AI Costs Safe (1000 bps)** — funds the recurring AI provider invoice obligation. The operator pays Anthropic, OpenAI, and other providers from a personal account using the keys configured in `ORBIT_AI_PROVIDER_KEYS`, then claims reimbursement monthly:

1. Operator collects invoices for the month (provider PDFs, USD amounts)
2. Operator files an issue titled `ai cost reimbursement: YYYY-MM` with the invoice totals and supporting links
3. The cycle picks up the issue, validates the amount is ≤ this Safe's current balance, files a D-014 approval issue requesting the WETH-equivalent transfer to the operator wallet
4. Owner approves; transfer executes on next cycle
5. Issue is closed; reimbursement logged in `memory/treasury.json.ledger`

Anthropic and OpenAI don't accept WETH directly, hence the reimbursement model. Alternative (deferred to S-TREAS-2): automated WETH→USDC conversion via a configured DEX, then credit purchase via the configured provider's purchase API.

**Operations Runway Safe (500 bps)** — covers gas, RPC node costs, infrastructure contingencies, and any non-AI recurring operational expense. Same reimbursement model as AI Costs but for non-AI operational spend. Holds 6–12 months of estimated runway at current burn.

---

## 3. Weekly sweep mechanic

Once per 7 days (`memory/treasury.json.sweep.intervalDays`), the cycle:

```
1. Reads Fee Receive Safe WETH balance.
2. If balance < sweep.minWei (anti-dust): defer to next cycle.
3. Computes per-bucket amounts using the 6 bps shares (4500/2000/500/1500/1000/500).
   Verifies sum = receive balance (within 1 wei rounding).
4. Computes a single idem key keccak256(cycle, sweepWeek, balance).
5. Files a SINGLE approval issue:

   ## Treasury Sweep Proposal

   Idem: {idem}
   Week: {sweepWeek}
   Source: Fee Receive Safe ({address})
   Balance: {balance} WETH

   | Destination | Amount | Bps |
   |---|---|---|
   | Floor Reserve     | {amount0} WETH | 4500 |
   | Productive Yield  | {amount1} WETH | 2000 |
   | Buyback           | {amount2} WETH |  500 |
   | Growth            | {amount3} WETH | 1500 |
   | AI Costs          | {amount4} WETH | 1000 |
   | Ops Runway        | {amount5} WETH |  500 |

   Per D-014, no transfers happen until the owner approves this issue.
   To approve: comment exactly:

       APPROVE ORBIT-TREASURY-SWEEP {idem}

6. Wait for owner approval comment.
7. On approval: execute all 6 transfers in one batched Safe multisig
   transaction (each transfer is a separate Safe transaction signed in
   batch). If any leg simulates as failing, refuse the entire sweep —
   no partial sweeps.
8. Write to memory/treasury.json.sweep.history: cycle, sweepWeek, idem,
   txHash, perBucket amounts. Mark the week as swept.
```

**Atomicity:** all 6 transfers are batched. Either all execute or none do. Partial sweeps would create accounting drift between buckets and break the proportionality guarantee.

**Idempotency:** `idem` is deterministic from cycle + sweep week + balance, so re-running the same cycle never doubles the sweep. The history check refuses if `sweepWeek` already has an executed entry.

---

## 4. Pre-execution gate

Mirrors the buyback / clanker gate pattern:

```
ORBIT_ENABLE_TREASURY_SWEEP === "true"      (default false)
ORBIT_TREASURY_SWEEP_DRY_RUN  defaults true (override requires gate below)
state.preLaunchVerified === true            (D-018)
state.tokenAddress         set + valid
Fee Receive Safe address   configured       (ORBIT_TREASURY_SAFE)
All 6 bucket Safe addresses configured      (env vars below)
Owner approval comment     found
Sweep week                 not already swept
```

Required env vars (set as repo variables / secrets):

| Env var | Purpose |
|---|---|
| `ORBIT_ENABLE_TREASURY_SWEEP` | Master kill-switch (var, default false) |
| `ORBIT_TREASURY_SWEEP_DRY_RUN` | Dry-run flag (var, default true) |
| `ORBIT_TREASURY_SAFE` | Fee Receive Safe address (secret) |
| `ORBIT_FLOOR_RESERVE_SAFE` | Floor Reserve Safe address (secret) |
| `ORBIT_PRODUCTIVE_YIELD_SAFE` | Productive Yield Safe address (secret) |
| `ORBIT_BUYBACK_SAFE` | Buyback Safe address (secret) |
| `ORBIT_GROWTH_SAFE` | Growth Safe address (secret) |
| `ORBIT_AI_COSTS_SAFE` | AI Costs Safe address (secret) |
| `ORBIT_OPS_RUNWAY_SAFE` | Operations Runway Safe address (secret) |

If any gate fails: `{ ok: false, blocked: true, reason, status: "blocked_precondition" }`. The sweep stays unimplemented in live mode until S-TREAS-1 wires it up under owner review.

---

## 5. Refusal codes

| Code | Meaning |
|---|---|
| `sweep_dust_below_minimum` | Fee Receive balance below `sweep.minWei` floor |
| `sweep_week_already_executed` | Idempotency hit — week N already swept |
| `sweep_bucket_address_missing` | One or more bucket Safe addresses unconfigured |
| `sweep_bps_sum_invalid` | Bucket bps don't sum to 10000 (config corruption) |
| `sweep_amount_rounding_drift` | Per-bucket amounts don't sum to receive balance |
| `sweep_simulation_failed` | Pre-execution simulation of one or more legs failed |
| `sweep_partial_refused` | Refused to execute when any leg would fail (atomicity) |

All refusals flow to the public refusal log (S-017).

---

## 6. Bucket addresses and key backup

Each Safe is its own multisig with **2/3 threshold** across 3 distinct owner-controlled signers. The Floor Reserve Safe additionally records a documented disaster-recovery procedure in `PLAN/SPECS/TREASURY_KEYS_BACKUP.md`. Key signer addresses are recorded in that runbook (with seed-phrase backup procedure), not committed to the public repo.

**Geographic / device diversity is the security model**, not threshold gymnastics: 3 hardware wallets, 3 different vendors (Ledger / Trezor / GridPlus), 3 different physical locations. 2/3 threshold survives loss of any single signer without locking funds (lower-risk than 3/3); loses funds only if 2 signers are simultaneously compromised AND the attacker has all addresses (low-probability).

---

## 7. Dashboard surface

`projectForDashboard` exposes a new top-level `treasury.buckets` slice:

```json
"buckets": {
  "schema": "orbit-treasury-buckets/1",
  "sweep": {
    "lastSweepWeek": 14,
    "lastSweepAt": "2026-06-01T...",
    "lastSweepTotalWei": "1000000000000000000",
    "nextSweepWeek": 15
  },
  "list": [
    { "id": "floor-reserve",     "category": "treasury",   "bps": 4500, "balanceWei": "...", "address": "0x..." },
    { "id": "productive-yield",  "category": "treasury",   "bps": 2000, ... },
    { "id": "buyback",           "category": "business",   "bps":  500, ... },
    { "id": "growth",            "category": "business",   "bps": 1500, ... },
    { "id": "ai-costs",          "category": "operations", "bps": 1000, ... },
    { "id": "ops-runway",        "category": "operations", "bps":  500, ... }
  ]
}
```

Balances read on-chain via RPC. If RPC unavailable, balances are `null` and the dashboard shows the bps allocation without dollar/wei values (per `feedback_no_money_on_github`: no specific operator-money figures on public surfaces; balances are project-money and OK to show).

---

## 8. Test plan

Implemented in `tests/treasury-sweep.test.js`:

1. **Bps validation** — sum must equal 10000; off-by-one configs refuse.
2. **Amount computation** — given receive balance B and bps `[4500, 2000, 500, 1500, 1000, 500]`, amounts sum to B within 1-wei rounding.
3. **Idempotency** — same cycle + week + balance yields same idem; sweepWeek check refuses double-sweep.
4. **Dust floor** — balance < `sweep.minWei` returns `sweep_dust_below_minimum`.
5. **Address validation** — missing any bucket Safe address returns `sweep_bucket_address_missing` with the specific missing bucket named.
6. **Pre-launch gate** — `state.preLaunchVerified !== true` blocks regardless of other inputs.
7. **DRY_RUN** — never invokes any fetch; returns synthetic tx hash.
8. **Approval matcher** — `APPROVE ORBIT-TREASURY-SWEEP {idem}` accepted; near-match rejected; non-owner author rejected.
9. **Rounding drift** — synthetic case where summed amounts ≠ balance returns `sweep_amount_rounding_drift`.
10. **Atomicity** — simulating leg #3 as failing refuses all 6, doesn't execute legs #1-#2.
11. **History** — successful sweep writes `sweepWeek`, `idem`, per-bucket amounts, tx hash; next cycle reads history and computes `nextSweepWeek`.
12. **Public projection** — `projectTreasuryBuckets` returns valid `orbit-treasury-buckets/1` shape with all 6 entries and category groupings.

---

## 9. Future work (S-TREAS-2+)

Explicitly deferred:

- **Automated WETH→USDC→AI credits flow.** Replaces the reimbursement model for AI costs. Requires a vetted DEX integration and provider purchase API. Out of scope for S-TREAS-1 because the manual flow works; speed matters less than safety.
- **Rebalancing across buckets.** If one bucket consistently runs surplus and another deficit, the sweep bps could rebalance. Deferred until 3+ months of post-launch data show the imbalance is structural, not transient.
- **Operating Runway → AI Costs automatic top-up.** If AI Costs is exhausted but Operations Runway has surplus, auto-propose a transfer. Reasonable behaviour but adds approval surface; defer until manual experience shows it's needed.
- **Cross-orbit treasury federation.** If multiple adopters federate treasury (Phase 5+), the bucket schema needs a federation map. Deferred to post-Phase-4 design.

---

## 10. Cross-references

- D-005 — weekly buyback. Source of funds shifts from "Treasury Safe" to `Buyback Safe` specifically.
- D-014 — every transfer in the sweep goes through one consolidated approval issue.
- D-017 — 95/5 inflow split. Unchanged. The Fee Receive Safe is what D-017 called "Treasury Safe."
- D-018 — sweep blocked until `state.preLaunchVerified === true`.
- D-019 — this spec's decision artifact in `PLAN/DECISIONS.md`.
- `PLAN/SPECS/TREASURY_KEYS_BACKUP.md` — multisig signer setup and recovery procedure.
- `PLAN/SPECS/TREASURY_PRODUCTIVE.md` — S-027 deployment from the Productive Yield Safe specifically.
- `PLAN/SPECS/MISSION_BOARD.md` — references the Growth Safe as the mission-reward funding source.
- `PLAN/SPECS/BOUNTY_MARKET.md` — references the Growth Safe for bounty-match funding.

End of spec.
