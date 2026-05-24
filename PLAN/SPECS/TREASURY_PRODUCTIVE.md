# TREASURY_PRODUCTIVE.md — Treasury Productive Deployment (S-027)

## 1. Goal

Once the Treasury Safe holds enough WETH to merit yield, Orbit proposes productive deployments — Uniswap V3/V4 LP positions, Aave/Morpho lending positions — on Base only. Every deployment goes through the existing approval gate. Yields accrue to the Treasury Safe.

## 2. Constraints

- github-only infrastructure (no third-party portfolio service)
- No on-chain action without approval issue per **D-014**
- Token-launch hard-block per **D-018** — no productive deployment until S-GATE-2 closes (treasury holds ≥1 ETH equivalent)
- Base mainnet only — no bridging out
- Yields go to the Safe, never to the operator address
- All positions must be unwindable within Y days (no locked staking)

## 3. Scope

In:
- Eligible-venue allowlist (Uniswap V3/V4 LP, Aave V3 supply, Morpho Blue supply)
- Per-venue risk cap (e.g., ≤30% of treasury in any single venue)
- Total productive cap (≤60% of treasury deployed; ≥40% in idle WETH for buyback liquidity)
- Withdrawal SLA per position (≤7 days)
- Yield tracking (per-cycle reconciliation written to `memory/treasury-yields.json`)

Out:
- Active LP rebalancing (set-and-forget only; rebalance via new approval issue)
- Leveraged positions (no borrowing against productive deposits)
- Non-Base venues (no Ethereum L1 mainnet, no other L2s)
- Yield aggregators / vaults (avoid additional contract surface)

## 4. Design

### Env vars
| Var | Purpose |
|---|---|
| `ORBIT_ENABLE_TREASURY_PRODUCTIVE` | Master kill switch; default false |
| `ORBIT_PRODUCTIVE_DRY_RUN` | Default true |
| `ORBIT_PRODUCTIVE_VENUE_ALLOWLIST` | Comma-separated venue keys: `uni-v3,uni-v4,aave-v3,morpho-blue` |
| `ORBIT_PRODUCTIVE_TOTAL_CAP_BPS` | Max bps of treasury productive (e.g., 6000 = 60%) |
| `ORBIT_PRODUCTIVE_PER_VENUE_CAP_BPS` | Max bps per single venue (e.g., 3000 = 30%) |
| `ORBIT_PRODUCTIVE_WITHDRAW_SLA_DAYS` | Max days a position can be locked (e.g., 7) |

### Module interface (`src/agent/treasury-productive.js` — future)
```js
function loadProductiveLedger(repoRoot) {}   // memory/treasury-productive.json
function saveProductiveLedger(repoRoot, ledger) {}
function isProductiveEnabled(config, state) {} // D-018 gate + S-GATE-2 + env enabled
function getVenueAdapter(venueKey) {}        // returns adapter with {supportedTokens, supply, withdraw, balanceOf}
function checkCaps(amountWei, venueKey, ledger, config) {} // {ok, perVenueOk, totalOk, reason?}
function proposeDeployment(config, params) {}    // creates approval issue, writes pending ledger entry
async function executeDeployment(config, params) {} // requires approval label; in DRY_RUN: synthetic
async function proposeWithdrawal(config, ledgerEntry) {}
async function reconcileYields(config) {}    // per-cycle pull of current balances vs deposited; writes treasury-yields.json
```

### Approval issue body template
```
**Productive deployment proposal**

Venue: {venueKey}
Amount: {wethAmount} WETH
Estimated APY (last 30d): {apy}%
Withdrawal SLA: {slaDays} days
Per-venue cap used: {currentBps}/{capBps}
Total productive cap used: {totalBps}/{capBps}

Caps verified: {capCheck}
Risk notes: {risks}

To approve: comment exactly `APPROVE ORBIT-TREASURY-PRODUCTIVE {idem}` on its own line.
```

## 5. D-014 + D-018 Alignment

| Decision | Application |
|---|---|
| D-014 | Every deployment, every withdrawal, every reconciliation that alters position size goes through an approval issue with the owner's APPROVE-prefix comment |
| D-018 | Productive deployment inactive until D-018 #4 and S-GATE-2 close. `isProductiveEnabled` refuses unless `state.preLaunchVerified === true` AND token launched AND ≥1 ETH equivalent in Safe |

## 6. Failure Modes

1. Venue contract paused → withdraw refused; reconcile records `paused` status; next cycle retries.
2. APY computation reads stale data → mark `apy` as `unverified`; owner approves with explicit risk acknowledgment.
3. Cap breach mid-proposal (treasury balance changed) → re-check at execute time; refuse if breached.
4. Yield reconciliation finds loss (impermanent loss > tolerance) → open a `treasury-loss-detected` issue with the magnitude; do not auto-unwind.
5. Withdrawal SLA breached (position locked beyond SLA) → flag in dashboard; never propose new deployment to a venue that breached SLA.
6. Owner approves but signer is unavailable → execute attempt fails with `wallet_unavailable`; reschedule next cycle.

## 7. Test Plan (future)

- `isProductiveEnabled` refuses pre-launch
- `checkCaps` refuses when per-venue cap exceeded
- `checkCaps` refuses when total cap exceeded
- `checkCaps` accepts when both within caps
- Venue adapter mocks: supply/withdraw round-trip preserves amounts (minus expected fees)
- Approval matching: APPROVE-prefix comment from owner accepted; non-owner rejected
- Yield reconciliation: positive yield writes to ledger; negative writes loss-detected entry
- Dry-run: never invokes any fetch
- Cap regression: position grows past cap due to yield → no new deployment until cap restored

## 8. Open Questions

- Should yields auto-buyback into $ORBIT, or stay in WETH? Defer; spec for S-014 buyback integration.
- LP impermanent-loss accounting model: track in WETH-equivalent terms vs underlying pair? Use Uniswap analytics method.
- Multi-position management for one venue (e.g., multiple Uniswap LP positions): allow only one position per venue in v1.

## 9. Cross-References

- `src/agent/buyback.js` (sibling approval-gated tool — same pattern)
- `PLAN/DECISIONS.md` — D-014, D-017 (Treasury Safe custody), D-018
- `PLAN/DEPLOY_PLAN.md` — Treasury Safe section
