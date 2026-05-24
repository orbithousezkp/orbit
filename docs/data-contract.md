# Orbit Data Contract

This document defines every machine-readable file Orbit exposes, its format, key fields, and how external tools — SDKs, dashboards, agents, and other repos — can consume it. The repository is the source of truth; this contract makes the surface programmable.

> **Audience:** SDK builders, dashboard authors, agent integrators, and anyone reading Orbit's state from outside the repo.

---

## Files And Formats

### `memory/state.json`

**Format:** JSON object
**Purpose:** Lifecycle state — cycle count, birth date, last active timestamp, and completion status.

| Field | Type | Description |
|---|---|---|
| `cycle` | number | Current cycle count |
| `born` | ISO 8601 | When Orbit first woke |
| `lastActive` | ISO 8601 | Last completed cycle timestamp |
| `lastStatus` | string | `"completed"` or `"error"` |
| `firstWakeIntroComplete` | boolean | Whether the first-wake introduction ran |
| `firstWakeIntroAt` | ISO 8601 | When the first-wake introduction completed |

**Consumer pattern:** Poll to detect activity. Compare `lastActive` against current time to determine staleness.

---

### `memory/passport.json`

**Format:** JSON object (version 1)
**Purpose:** Portable agent identity declaration. Machine-readable companion to `docs/agent-passport.md`.

| Field | Type | Description |
|---|---|---|
| `version` | number | Schema version |
| `identity` | object | Name, category, operating surface, mission, exclusions |
| `capabilities` | array | Active and planned capabilities with id, status, mode, evidence |
| `blockedActions` | array | Strings identifying blocked wallet and external actions |
| `permissionModel` | object | Default mode, approval surface, labels, prefix, hard rules |
| `proofModel` | object | Cycle note/metadata locations, included/excluded fields |
| `budget` | object | Daily/monthly limits, lifetime spend, purchase mode, revenue cadence |
| `token` | object | Symbol, launch status, launch requirements |
| `adoptionChecklist` | array | Numbered steps with file paths and purpose |
| `machineReadableFiles` | object | Key→path mapping of all machine-readable files |

**Consumer pattern:** Read for identity, capabilities, and permission boundaries before interacting with Orbit.

---

### `memory/governance.json`

**Format:** JSON object
**Purpose:** Approval model, hard rules, and self-recipient configuration.

| Field | Type | Description |
|---|---|---|
| `ownerUsername` | string | GitHub username of the owner (empty if unset) |
| `policyVersion` | number | Governance policy version |
| `externalSpend.mode` | string | `"owner_approval_required"` |
| `externalSpend.approvalIssueLabel` | string | Label applied to approval requests |
| `externalSpend.approvalAcceptedLabel` | string | Label indicating owner approved |
| `externalSpend.approvalRejectedLabel` | string | Label indicating owner rejected |
| `externalSpend.allowedWithoutApproval` | array | Categories that do not require approval |
| `selfRecipients` | object | Environment variable names for treasury and operator addresses |
| `hardRules` | array | Non-negotiable safety invariants |

**Consumer pattern:** Check `externalSpend.mode` before proposing any spend. Use labels to detect approval state on issues.

---

### `memory/treasury.json`

**Format:** JSON object
**Purpose:** AI-call budget, revenue cadence, token state, and full AI spend ledger.

| Field | Type | Description |
|---|---|---|
| `ai.dailyBudgetUsd` | number | Maximum daily AI spend |
| `ai.monthlyBudgetUsd` | number | Maximum monthly AI spend |
| `ai.inputUsdPerMillion` | number | Input token cost rate |
| `ai.outputUsdPerMillion` | number | Output token cost rate |
| `ai.ledger` | array | Per-call spend records (timestamp, tokens, cost, route) |
| `revenue.cadence` | string | `"weekly_performance"` |
| `revenue.claimIntervalDays` | number | Minimum days between claims |
| `revenue.operatorShareBps` | number | Operator share in basis points |
| `revenue.treasuryShareBps` | number | Treasury share in basis points |
| `token.symbol` | string | Token ticker |
| `token.launchStatus` | string | `"not_launched"` or `"launched"` |
| `token.address` | string\|null | On-chain token address (null if not launched) |

**Privacy rule:** The ledger contains token counts and cost estimates but never exposes provider names, model names, API bases, or billing routes.

**Consumer pattern:** Sum `ai.ledger[].estimatedUsd` for budget tracking. Check `token.launchStatus` before attempting reward operations.

---

### `memory/roadmap.json`

**Format:** JSON object (version 2)
**Purpose:** Levels, lanes, phases, ZK proof plans, weekly revenue model, and operating rules.

| Field | Type | Description |
|---|---|---|
| `currentLevel` | object | Active level with id, name, status, goal |
| `lanes` | array | All lanes with id, name, status, mission |
| `phaseChecks` | array | Phase definitions with checks and evidence file paths |
| `levels` | array | Full level progression from 1 to 11 |
| `zkProofMvp` | array | ZK proof items with id, name, status, summary |
| `weeklyRevenueModel` | object | Scope, formula, operator/treasury cuts, rules |
| `operatingRules` | array | Non-negotiable operating constraints |

**Consumer pattern:** Read `currentLevel` for status. Check `phaseChecks[].status` to verify which phases are backed by evidence. Scan `lanes` for direction.

---

### `memory/tasks.json`

**Format:** JSON object with `tasks` array
**Purpose:** Open and completed work items.

| Field | Type | Description |
|---|---|---|
| `tasks[].id` | string | Unique task identifier |
| `tasks[].title` | string | Task description |
| `tasks[].priority` | string | `"low"`, `"normal"`, or `"high"` |
| `tasks[].status` | string | `"open"`, `"done"`, or `"blocked"` |
| `tasks[].source` | string | What created the task |
| `tasks[].notes` | string | Context and constraints |
| `tasks[].createdAt` | ISO 8601 | Creation timestamp |
| `tasks[].completedAt` | ISO 8601\|null | Completion timestamp |
| `tasks[].outcome` | string\|null | What happened |

**Consumer pattern:** Filter by `status === "open"` for pending work. Check `priority` for ordering.

---

### `memory/knowledge.json`

**Format:** JSON object with `entries` array
**Purpose:** Durable facts, decisions, lessons, and cycle summaries.

| Field | Type | Description |
|---|---|---|
| `entries[].id` | string | Unique entry identifier |
| `entries[].kind` | string | Type: `household_note`, `cycle_summary`, `decision`, `lesson`, etc. |
| `entries[].title` | string | Human-readable title |
| `entries[].content` | string | Full text content |
| `entries[].tags` | array | Classification tags |
| `entries[].source` | string | Which cycle or event created it |
| `entries[].createdAt` | ISO 8601 | Creation timestamp |

**Consumer pattern:** Filter by `kind` or `tag` to find relevant knowledge. Use `source` to correlate with cycle proofs.

---

### `memory/infrastructure.json`

**Format:** JSON object
**Purpose:** Product registry — surfaces, capabilities, commands, access methods, and wallet summary.

| Field | Type | Description |
|---|---|---|
| `product` | object | Name, category, problem, solution, positioning |
| `layers` | array | Infrastructure layers with id, name, status, description |
| `surfaces` | array | Surfaces with id, name, status, path, description |
| `capabilities` | array | Capabilities with id, name, status, mode, evidence |
| `commands` | array | Planned commands with name, status, description |
| `access` | array | Access methods with id, name, status, description |
| `wallet` | object | Approval mode, budget, revenue, token, blocked actions |

**Consumer pattern:** Check `capabilities[].status` for available features. Use `surfaces[].path` to locate implementation files.

---

### `memory/opportunities.json`

**Format:** JSON object
**Purpose:** Survival and earning opportunities scored by fit, risk, and expected reward.

| Field | Type | Description |
|---|---|---|
| `best` | object | Highest-scoring opportunity with full details |
| `opportunities` | array | All opportunities with id, title, score, status, risk |

**Consumer pattern:** Read `best` for current priority. Filter `opportunities` by `status === "open"` for available work.

---

### `memory/cycles.jsonl`

**Format:** JSONL (one JSON object per line)
**Purpose:** Per-cycle machine-readable metadata.

| Field | Type | Description |
|---|---|---|
| `cycle` | number | Cycle number |
| `trigger` | string | Trigger type (`state`, `event`, `mandatory`) |
| `timestamp` | ISO 8601 | When the cycle ran |
| `actions` | array | Actions taken during the cycle |
| `filesChanged` | array | Files modified |
| `decisions` | array | Key decisions made |
| `refusals` | array | Actions refused with reasons |
| `budgetUsedUsd` | number | Estimated AI cost for the cycle |

**Consumer pattern:** Parse line by line. Filter by cycle number or timestamp range. Aggregate `budgetUsedUsd` for cost analysis.

---

### `memory/cycles/*.md`

**Format:** Markdown files (one per cycle)
**Purpose:** Human-readable cycle narratives with proof details.

**Naming convention:** `NNNN-descriptive-slug.md`

**Consumer pattern:** Read for narrative context. Cross-reference with `cycles.jsonl` for metadata.

---

## Consumption Rules

1. **Read-only by default.** External tools should treat all files as read-only.
2. **No secrets.** These files never contain private keys, seed phrases, API keys, wallet routes, or provider details.
3. **Privacy boundaries.** The AI ledger omits provider/model/API-base/billing-route details. Wallet policy shows public-safe state only.
4. **Staleness detection.** Compare `memory/state.json.lastActive` against current time. If stale beyond 2× the mandatory interval (60 minutes), Orbit may be paused or errored.
5. **Approval state.** Read issue labels (`orbit:approval`, `orbit:approved`, `orbit:rejected`) to determine approval outcomes.
6. **Schema versioning.** `passport.json` has a `version` field. `roadmap.json` has a `version` field. Check versions before consuming.

---

## Integration Pattern

```
1. READ memory/passport.json    → Understand who Orbit is
2. READ memory/state.json       → Check if Orbit is active
3. READ memory/governance.json  → Know the approval rules
4. READ memory/infrastructure.json → See available capabilities
5. READ memory/roadmap.json     → Understand current phase and direction
6. READ memory/tasks.json       → See pending work
7. READ memory/cycles.jsonl     → Review recent proof history
```

This sequence gives any external tool a complete picture of Orbit's identity, liveness, permissions, capabilities, direction, work, and proof trail.

---

## Related Documents

| Document | Purpose |
|---|---|
| `docs/agent-passport.md` | Human-readable identity declaration |
| `docs/architecture.md` | Layer diagram and data flow |
| `docs/proof-model.md` | Proof format, privacy rules, JSONL schema |
| `docs/wallet-policy.md` | Wallet policy boundary and hard rules |
| `memory/passport.json` | Machine-readable identity declaration |
