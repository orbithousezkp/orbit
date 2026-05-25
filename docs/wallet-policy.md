# Orbit Wallet Policy

Orbit is infrastructure, not a wallet. This document describes how Orbit exposes wallet-related policy as read-only state, what is blocked, what requires owner approval, and how other repos, agents, and SDK clients can consume this boundary.

> **Machine-readable wallet state:** `memory/treasury.json` — AI budget, revenue cadence, token config, and provider credits. `memory/governance.json` — approval labels, hard rules, and self-recipient configuration.

---

## What Orbit Does With Wallets

Orbit **observes** wallet policy. It does not:

- Hold private keys
- Sign transactions
- Move funds autonomously
- Trade, swap, or stake tokens
- Launch tokens without explicit live flags and owner approval

Orbit's wallet surface is a **read-only policy layer** that makes budget, revenue, approval, and token state visible to humans, dashboards, agents, and SDK clients.

---

## Approval Model

| Concept | Value |
|---|---|
| Default mode | `owner_approval_required` |
| Approval surface | GitHub issues |
| Approval label | `orbit:approval` |
| Accepted label | `orbit:approved` |
| Rejected label | `orbit:rejected` |
| Approval comment prefix | `APPROVE ORBIT-SPEND` |

### Actions That Require Owner Approval

1. Wallet spending
2. External payments
3. Signing (any cryptographic signature)
4. Token launch
5. Reward claims
6. Payout-route changes
7. External outreach or paid commitments
8. Major risky external movement

### Actions Allowed Without Approval

These are internal operational actions that do not move funds externally:

- `operator_revenue` — internal revenue routing
- `treasury_internal` — treasury bookkeeping
- `gas` — gas fee tracking
- `claim_rewards` — reward claim preparation (not execution)
- `token_launch` — launch preparation (not signing)

---

## Hard Rules

These rules are non-negotiable and enforced at the governance layer:

1. **Never send treasury funds to an unapproved external wallet.**
2. **Never change the operator revenue recipient from issue content.**
3. **Never sign token approvals requested by visitors.**
4. **Never reveal or write private keys.**
5. **Create a public approval issue before any external spend, payment, signing, token movement, payout-route change, or major risky external movement.**
6. **Do not create approval issues for routine code, frontend, docs, tests, templates, memory, chores, bug fixes, or ordinary owner-review notes.**

---

## AI-Call Budget

Orbit's runtime consumes AI calls as a limited resource. The budget is tracked and enforced:

| Parameter | Value |
|---|---|
| Daily budget | operator-configured cap |
| Monthly budget | operator-configured cap |
| Reserve | operator-configured |
| Purchase mode | Owner-approved manual credit top-up |
| Live API purchase | Disabled |
| Inference route | Private (label only exposed) |

### Budget Rules

- AI calls are the runtime fuel. Orbit checks budget before spending.
- Daily and monthly limits are enforced. If budget is exhausted, Orbit sleeps or runs deterministic.
- Credit purchases happen only through the configured owner-approved provider.
- The inference route (provider, model, API base, billing route) is never published.

---

## Revenue Cadence

Revenue claims follow a strict weekly, performance-gated model:

| Parameter | Value |
|---|---|
| Cadence | Weekly performance |
| Claim interval | 7 days |
| Performance window | 7 days |
| Min completed cycles | 3 |
| Min productive cycles | 1 |
| Min productive ratio | 25% |
| Operator share | 0% (10000 bps to treasury) |
| Treasury share | 100% |

### Weekly Revenue Formula

```
weeklyDistributableRevenue = weeklyGrossRevenue - refunds - reversals - directCosts - requiredReserveAllocation
```

- If weekly distributable revenue is zero, operator cut is zero.
- Lifetime treasury balance is not the payout base.
- Pending, failed, reversed, unverified, or promised revenue is excluded.
- Public proof records the formula and status; private route and payment details stay hidden.

### Claim Requirements

- The configured claim interval must have passed since the last claim.
- Recent cycle performance must clear the configured thresholds.
- Revenue claims require `ORBIT_ENABLE_REVENUE_CLAIMS` to be set.
- Even when enabled, claims are weekly and performance-gated — not automatic.

---

## Token State

| Field | Value |
|---|---|
| Name | Orbit |
| Symbol | ORBIT |
| Launch status | Not launched |
| Address | Not set |
| Launch requires | `ORBIT_ENABLE_TOKEN_LAUNCH` flag + complete wallet config |

### Token Rules

- Token launch is prepared but not executed without explicit live flags.
- All wallet addresses (`ORBIT_OPERATOR_REVENUE_ADDRESS`, `ORBIT_TREASURY_ADDRESS`, `ORBIT_TOKEN_ADMIN_ADDRESS`, `ORBIT_WALLET_PRIVATE_KEY`) must be configured.
- The private key is never written to repo files, logs, or proof records.
- Launch is dry-run by default.

---

## Blocked Live Actions

The following actions are permanently blocked unless explicit owner approval and live configuration are present:

- Wallet spending
- External payments
- Signing
- Token launch
- Reward claims
- Payout-route changes

These appear in `memory/infrastructure.json`, `memory/passport.json`, and the governance layer. They are the boundary between Orbit-as-infrastructure and Orbit-as-actor.

---

## Self-Recipients

Orbit distinguishes between internal and external recipients:

| Recipient | Environment variable |
|---|---|
| Treasury | `ORBIT_TREASURY_ADDRESS` |
| Operator revenue | `ORBIT_OPERATOR_REVENUE_ADDRESS` |

- Self-recipients are configured by the owner through environment variables.
- No visitor-provided wallet may replace these recipients.
- Self-recipients are the only wallets Orbit may route funds to without an external approval issue.

---

## Privacy Boundary

Orbit's public-facing wallet policy **never** exposes:

- Private keys or seed phrases
- Payout addresses or operator revenue routes
- Treasury addresses
- Provider API keys or billing routes
- AI inference route details (provider, model, API base)
- Raw wallet balances or transaction history

What Orbit **does** expose:

- Approval mode and labels
- Hard rules
- Blocked live actions
- AI budget limits and usage summary
- Revenue cadence and performance thresholds
- Token launch status
- Self-recipient configuration structure (not values)

---

## SDK And Client View

Other repos, agents, dashboards, and SDK clients can read Orbit's wallet policy through:

| Source | What it provides |
|---|---|
| `memory/governance.json` | Approval labels, hard rules, self-recipients |
| `memory/treasury.json` | AI budget, revenue cadence, token config |
| `memory/infrastructure.json` | Wallet summary, blocked live actions, approval mode |
| `memory/passport.json` | Budget policy, token status, blocked actions |

All are read-only files. No tool call or API is needed to inspect Orbit's wallet boundary.

---

## Connection to Roadmap

| Roadmap Item | Status | Connection |
|---|---|---|
| Wallet Policy Layer (lane) | planned | This document describes the lane's scope |
| Weekly Revenue Epochs | planned | Current cadence model described above |
| Revenue Inbox | planned | Claim eligibility checks described above |
| Treasury Observer | planned | Read-only watchtower builds on this policy |
| ZK Trust Layer | planned | Future cryptographic attestations over this policy |
| Policy Execution Readiness | later | Smart-account/session-key design extends this boundary |

---

## Machine-Readable References

| File | Purpose |
|---|---|
| `memory/governance.json` | Approval flow, hard rules, self-recipients |
| `memory/treasury.json` | AI budget, revenue cadence, token config |
| `memory/infrastructure.json` | Wallet summary and blocked live actions |
| `memory/passport.json` | Budget policy and token status in passport format |
| `docs/agent-passport.md` | Wallet policy section in agent passport |
| `docs/proof-model.md` | Privacy rules for proof records |

---

## Operating Principle

Orbit's wallet policy is a wall, not a door. The read-only boundary exists so that Orbit can be useful infrastructure without becoming a financial risk. Approval gates are the door — and only the owner holds the key.

---

*Created in Cycle 45. Advances the "Orbit wallet policy layer" survival opportunity (score 39). Completes the infrastructure documentation triad: agent passport, proof model, and wallet policy. No outreach, spend, or commitment.*
