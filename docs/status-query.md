# Orbit Status Query Reference

This document shows how to query Orbit's current state from code, shell scripts, agent context, dashboards, or SDK clients. All data lives in machine-readable files inside the repository — no API server or database required.

> **Audience:** SDK builders, dashboard authors, agent integrators, CLI users, and anyone automating against Orbit's state.  
> **Companion:** [Data Contract](data-contract.md) defines every file's schema, field types, and privacy rules.

---

## Quick Status

Read `memory/state.json` for lifecycle basics.

```bash
# Current cycle and last active time
cat memory/state.json | jq '{cycle, lastActive, lastStatus}'
```

```js
// Node.js
const state = JSON.parse(fs.readFileSync('memory/state.json', 'utf8'));
console.log(`Cycle ${state.cycle}, last active ${state.lastActive}`);
```

| What you learn | Field |
|---|---|
| How many cycles have run | `state.cycle` |
| When Orbit last woke | `state.lastActive` |
| Whether the last cycle succeeded | `state.lastStatus` |
| Whether the intro ran | `state.firstWakeIntroComplete` |

**Staleness rule:** If `Date.now() - new Date(state.lastActive)` exceeds the mandatory heartbeat interval (30 minutes), Orbit may be paused or the workflow may be failing.

---

## Identity And Capabilities

Read `memory/passport.json` for the full agent identity.

```bash
# Identity summary
cat memory/passport.json | jq '.identity | {name, category, operatingSurface, mission}'
```

```bash
# Active capabilities only
cat memory/passport.json | jq '[.capabilities[] | select(.status == "active") | .id]'
```

```bash
# Blocked actions
cat memory/passport.json | jq '.blockedActions'
```

| What you learn | Path |
|---|---|
| Agent name and mission | `.identity` |
| What Orbit can do | `.capabilities[]` (filter `status == "active"`) |
| What Orbit refuses to do | `.blockedActions` |
| Permission model and labels | `.permissionModel` |
| Proof storage locations | `.proofModel` |
| Budget and revenue policy | `.budget` |
| Token status | `.token` |
| Adoption checklist | `.adoptionChecklist` |
| All machine-readable files | `.machineReadableFiles` |

---

## Permissions And Governance

Read `memory/governance.json` before proposing any spend or external action.

```bash
# Approval mode and labels
cat memory/governance.json | jq '.externalSpend | {mode, approvalIssueLabel, approvalAcceptedLabel, approvalCommentPrefix}'
```

```bash
# What does NOT require approval
cat memory/governance.json | jq '.externalSpend.allowedWithoutApproval'
```

```bash
# Hard rules (non-negotiable)
cat memory/governance.json | jq '.hardRules'
```

| What you learn | Path |
|---|---|
| Whether external spend needs approval | `.externalSpend.mode` |
| GitHub label for approval issues | `.externalSpend.approvalIssueLabel` |
| Label when owner approves | `.externalSpend.approvalAcceptedLabel` |
| Comment prefix for approval | `.externalSpend.approvalCommentPrefix` |
| Categories allowed without approval | `.externalSpend.allowedWithoutApproval` |
| Env vars for self-recipients | `.selfRecipients` |
| Non-negotiable safety rules | `.hardRules` |

**Rule:** If `.externalSpend.mode` is `"owner_approval_required"`, create a public issue with the approval label before any external spend, payment, signing, token movement, payout-route change, or major risky external movement.

---

## AI Budget

Read `memory/treasury.json` for budget state and spend history.

```bash
# Budget summary
cat memory/treasury.json | jq '.ai | {dailyBudgetUsd, monthlyBudgetUsd, reserveUsd}'
```

```bash
# Calculate lifetime spend from ledger
cat memory/treasury.json | jq '[.ai.ledger[].estimatedUsd] | add'
```

```bash
# Spend today (UTC)
TODAY=$(date -u +%Y-%m-%d)
cat memory/treasury.json | jq --arg d "$TODAY" '[.ai.ledger[] | select(.timestamp | startswith($d)) | .estimatedUsd] | add'
```

| What you learn | Path |
|---|---|
| Daily budget cap | `.ai.dailyBudgetUsd` |
| Monthly budget cap | `.ai.monthlyBudgetUsd` |
| Cost per million input tokens | `.ai.inputUsdPerMillion` |
| Cost per million output tokens | `.ai.outputUsdPerMillion` |
| Per-call spend ledger | `.ai.ledger[]` |
| Token status | `.token` |
| Revenue cadence | `.revenue` |

**Privacy rule:** The ledger contains token counts and cost estimates but never exposes provider names, model names, API bases, or billing routes.

---

## Revenue And Token

```bash
# Revenue policy
cat memory/treasury.json | jq '.revenue | {cadence, claimIntervalDays, operatorShareBps, treasuryShareBps, lastClaimSentAt}'
```

```bash
# Token status
cat memory/treasury.json | jq '.token'
```

| What you learn | Path |
|---|---|
| Revenue cadence | `.revenue.cadence` |
| Minimum days between claims | `.revenue.claimIntervalDays` |
| Operator share (basis points) | `.revenue.operatorShareBps` |
| Treasury share (basis points) | `.revenue.treasuryShareBps` |
| Last claim attempt | `.revenue.lastClaimAttemptAt` |
| Token symbol and launch status | `.token` |

**Rule:** Revenue is weekly and performance-gated. If `.token.launchStatus` is `"not_launched"`, no reward claims are possible.

---

## Roadmap And Levels

Read `memory/roadmap.json` for levels, lanes, and phase checks.

```bash
# Current level
cat memory/roadmap.json | jq '.currentLevel | {id, name, status, goal}'
```

```bash
# Active lanes
cat memory/roadmap.json | jq '[.lanes[] | select(.status == "active") | {id, name, mission}]'
```

```bash
# Active phase checks
cat memory/roadmap.json | jq '[.phaseChecks[] | select(.status == "active") | {phaseId, checks}]'
```

```bash
# Planned levels (next unlocks)
cat memory/roadmap.json | jq '[.levels[] | select(.status == "planned") | {id, name, goal}] | .[0:3]'
```

| What you learn | Path |
|---|---|
| Current level and goal | `.currentLevel` |
| All lanes and missions | `.lanes[]` |
| Phase checks with evidence paths | `.phaseChecks[]` |
| Level progression | `.levels[]` |
| ZK proof plan | `.zkProofMvp[]` |
| Weekly revenue formula | `.weeklyRevenueModel` |
| Operating rules | `.operatingRules` |
| What is not yet implemented | `.notImplementedYet` |

---

## Tasks

Read `memory/tasks.json` for open and completed work.

```bash
# Open tasks
cat memory/tasks.json | jq '[.tasks[] | select(.status == "open") | {id, title, priority}]'
```

```bash
# Recently completed
cat memory/tasks.json | jq '[.tasks[] | select(.status == "done") | {title, completedAt, outcome}] | .[-3:]'
```

| What you learn | Path |
|---|---|
| Pending work | `.tasks[] \| select(.status == "open")` |
| Task priority | `.tasks[].priority` |
| Completion history | `.tasks[] \| select(.status == "done")` |

---

## Knowledge And Memory

Read `memory/knowledge.json` for durable facts, decisions, and cycle summaries.

```bash
# Recent entries
cat memory/knowledge.json | jq '[.entries[-5:] | .[] | {kind, title, createdAt}]'
```

```bash
# Filter by kind
cat memory/knowledge.json | jq '[.entries[] | select(.kind == "cycle_summary") | {title, source}]'
```

```bash
# Filter by tag
cat memory/knowledge.json | jq '[.entries[] | select(.tags | index("infrastructure")) | {title, createdAt}]'
```

| What you learn | Path |
|---|---|
| Entry type | `.entries[].kind` |
| Content | `.entries[].content` |
| Tags for filtering | `.entries[].tags` |
| Source cycle | `.entries[].source` |

---

## Infrastructure Registry

Read `memory/infrastructure.json` for the full product registry.

```bash
# Active capabilities
cat memory/infrastructure.json | jq '[.capabilities[] | select(.status == "active") | {id, name, mode}]'
```

```bash
# Active surfaces with paths
cat memory/infrastructure.json | jq '[.surfaces[] | select(.status == "active") | {id, name, path}]'
```

```bash
# Blocked live actions
cat memory/infrastructure.json | jq '.walletBlockedLiveActions'
```

| What you learn | Path |
|---|---|
| Product positioning | `.product` |
| Infrastructure layers | `.layers[]` |
| Active surfaces and paths | `.surfaces[]` |
| Capabilities and evidence | `.capabilities[]` |
| Planned commands | `.commands[]` |
| Access methods | `.access[]` |
| Wallet boundary | `.wallet` |

---

## Proof Receipts

Cycle proof notes are stored under `memory/cycles/` as markdown files.

```bash
# List recent cycle notes
ls -lt memory/cycles/ | head -5
```

```bash
# Read the latest cycle note
LATEST=$(ls -t memory/cycles/*.md 2>/dev/null | head -1)
cat "$LATEST"
```

Runtime proof records (when present) are stored under `runtime/proofs/`.

```bash
# List runtime proofs
ls runtime/proofs/ 2>/dev/null
```

| What you learn | Source |
|---|---|
| What Orbit did in a cycle | `memory/cycles/*.md` |
| Detailed runtime record | `runtime/proofs/*.jsonl` |
| Proof format reference | `docs/proof-model.md` |

---

## Opportunities

Read `memory/opportunities.json` for survival and earning opportunities.

```bash
# Top opportunity
cat memory/opportunities.json | jq '.best | {id, title, score, status}'
```

```bash
# All open opportunities sorted by score
cat memory/opportunities.json | jq '[.opportunities[] | select(.status == "open") | {id, title, score}] | sort_by(-.score)'
```

---

## Integration Sequence

For a full integration, read files in this order:

1. **`memory/state.json`** — Is Orbit alive? When was it last active?
2. **`memory/passport.json`** — What is Orbit? What can it do? What does it refuse?
3. **`memory/governance.json`** — What are the permission rules? How does approval work?
4. **`memory/treasury.json`** — What is the budget? Token status? Revenue policy?
5. **`memory/roadmap.json`** — What level is Orbit at? What phases are active?
6. **`memory/tasks.json`** — What work is pending? What was recently completed?
7. **`memory/knowledge.json`** — What does Orbit know? What decisions were made?
8. **`memory/infrastructure.json`** — What surfaces, capabilities, and commands are active?
9. **`memory/opportunities.json`** — What survival and earning paths exist?
10. **`memory/cycles/`** — What happened in recent cycles?
11. **`docs/data-contract.md`** — What are the exact schemas for all files?

---

## Consumption Rules

1. **Read-only by default.** Orbit's files are public-safe to read. Never write to them from external tools unless Orbit's own lifecycle does so.
2. **No secrets in, no secrets out.** The files never contain private keys, provider names, API bases, billing routes, or payout addresses. Do not expect them.
3. **Approval before action.** If you need Orbit to spend, sign, or move tokens, create a public issue with the configured approval label and wait for owner confirmation.
4. **Respect blocked actions.** The passport and infrastructure registry list what Orbit will not do. Do not ask it to bypass those boundaries.
5. **Staleness matters.** Always check `state.lastActive` before assuming Orbit's data is current.
