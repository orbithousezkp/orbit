# Orbit SDK

Read-only JavaScript library and CLI for querying Orbit's machine-readable repository state — identity, capabilities, governance, budget, roadmap, tasks, knowledge, infrastructure, proofs, and opportunities.

**Zero dependencies.** Works inside any local Orbit repository checkout.

> **Companion docs:**
> - [Data Contract](../../docs/data-contract.md) — schema definitions for every file
> - [Status Query Reference](../../docs/status-query.md) — shell and Node.js examples
> - [Agent Passport](../../docs/agent-passport.md) — human-readable identity

---

## Library Usage

```js
const orbit = require('@orbithouse/sdk');

// Quick status — cycle, budget, tasks, level, staleness
const status = orbit.quickStatus('/path/to/orbit/repo');
console.log(status);
// {
//   cycle: 49,
//   lastActive: '2026-05-24T19:40:02.822Z',
//   lastStatus: 'completed',
//   staleMinutes: 12,
//   currentLevel: { id: 'level-1', name: 'Control Plane Foundation' },
//   openTaskCount: 0,
//   aiBudget: { dailyBudgetUsd: 5, spentTodayUsd: 1.14, canUseAi: true },
//   ...
// }

// Budget summary with lifetime and daily calculations
const budget = orbit.budgetSummary();
console.log(budget.lifetimeSpendUsd, budget.dailyRemainingUsd);

// Open tasks filtered by priority
const highTasks = orbit.openTasks(null, 'high');

// Check if an action needs approval
const check = orbit.checkApprovalRequired(null, 'external_payment');
console.log(check.requiresApproval); // true

// Active capabilities
const caps = orbit.activeCapabilities();

// Knowledge entries filtered by kind
const summaries = orbit.queryKnowledge(null, { kind: 'cycle_summary', limit: 3 });

// Machine-readable file inventory
const files = orbit.machineReadableFiles();
```

---

## CLI Usage

```bash
# Quick status
node cli.js status

# Budget summary
node cli.js budget

# Open high-priority tasks
node cli.js tasks --priority high

# Last 3 cycle summaries
node cli.js knowledge --kind cycle_summary --limit 3

# Check if external_payment needs approval
node cli.js check-approval external_payment

# Full agent passport
node cli.js passport

# Active capabilities only
node cli.js capabilities

# Blocked actions
node cli.js blocked

# Revenue policy and token status
node cli.js revenue

# Machine-readable file inventory
node cli.js files

# All commands accept an optional repo path
node cli.js status /path/to/orbit/repo
```

---

## API Reference

### File Readers

| Function | Returns | File |
|---|---|---|
| `readState(repoPath?)` | Lifecycle state | `memory/state.json` |
| `readPassport(repoPath?)` | Agent identity | `memory/passport.json` |
| `readGovernance(repoPath?)` | Approval policy | `memory/governance.json` |
| `readTreasury(repoPath?)` | Budget + revenue | `memory/treasury.json` |
| `readRoadmap(repoPath?)` | Levels + lanes | `memory/roadmap.json` |
| `readTasks(repoPath?)` | Work items | `memory/tasks.json` |
| `readKnowledge(repoPath?)` | Durable facts | `memory/knowledge.json` |
| `readInfrastructure(repoPath?)` | Product registry | `memory/infrastructure.json` |
| `readOpportunities(repoPath?)` | Earning ideas | `memory/opportunities.json` |
| `readApprovals(repoPath?)` | Approval queue | `memory/approvals.json` |

### Convenience Queries

| Function | Description |
|---|---|
| `quickStatus(repoPath?)` | Compact status: cycle, budget, tasks, level, staleness |
| `activeCapabilities(repoPath?)` | Capabilities with `status === 'active'` |
| `blockedActions(repoPath?)` | Blocked wallet and external actions |
| `checkApprovalRequired(repoPath?, category)` | Whether an action category needs approval |
| `openTasks(repoPath?, priority?)` | Open tasks, optionally filtered by priority |
| `budgetSummary(repoPath?)` | Budget limits, lifetime/daily spend, remaining |
| `revenueStatus(repoPath?)` | Revenue policy and token status |
| `activeLanes(repoPath?)` | Active roadmap lanes |
| `activePhaseChecks(repoPath?)` | Active phase checks with evidence |
| `queryKnowledge(repoPath?, opts)` | Filter by kind, tag, and limit |
| `machineReadableFiles(repoPath?)` | File inventory with existence and size |
| `pendingApprovals(repoPath?)` | Pending approval requests |

### Options for `queryKnowledge`

```js
{
  kind: 'cycle_summary',    // Filter by entry kind
  tag: 'infrastructure',    // Filter by tag
  limit: 5,                 // Last N entries
}
```

---

## Privacy Rules

- **No secrets** — Never exposes provider names, model names, API bases, billing routes, private keys, or seed phrases.
- **Read-only** — No write, sign, spend, or execute operations. Read files only.
- **Fail-closed** — `safeReadJson` returns `null` on missing files; `readJson` throws.

---

## Design Principles

- **Zero dependencies** — Works without any npm packages.
- **Auditable** — Code is small enough to read in one sitting (~350 lines library + ~150 lines CLI).
- **Schema-aligned** — Matches the [Data Contract](../../docs/data-contract.md) field definitions.
- **Agent-friendly** — Returns plain objects, no class wrappers or framework magic.
- **Safe defaults** — `quickStatus` and `budgetSummary` calculate derived values to prevent common mistakes.

---

## Status

**Prototype** — repo-local build, not published to npm. Functional, used by Orbit's own household.

---

## License

MIT
