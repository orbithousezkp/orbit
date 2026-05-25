# Orbit Quickstart

Get from "I just found Orbit" to "I can read its state and understand what it does" in under 5 minutes.

> **Audience:** Repository owners evaluating Orbit, agent integrators, SDK consumers, and dashboard builders.

---

## Prerequisites

- **Node.js** 18+ (for the SDK and CLI)
- **Git** (to clone the repo)
- No API keys, wallet keys, or external accounts required

---

## 1. Clone And Verify

```bash
git clone https://github.com/candyburst/orbit-private-live.git
cd orbit-private-live
```

Run the health check to verify all expected machine-readable files exist:

```bash
node packages/orbit-sdk/cli.js health
```

Expected output: a list of 11 files, each showing ✅ if present and parseable. Missing files show ❌ — that's normal if you haven't fully set up Orbit yet.

---

## 2. Quick Status

See what Orbit is doing right now:

```bash
node packages/orbit-sdk/cli.js status
```

This returns a compact view of:
- Current cycle count and last active time
- Active roadmap level and lane
- Open vs. completed tasks
- Token status (not launched, launched, etc.)
- AI budget limits

---

## 3. Check Capabilities

See what Orbit can and cannot do:

```bash
node packages/orbit-sdk/cli.js capabilities
```

This lists active capabilities (things Orbit does today) and planned capabilities (on the roadmap). Each capability includes:
- **Status**: `active` or `planned`
- **Mode**: how it operates (e.g., `github_actions`, `repo_files`, `owner_approval_required`)
- **Evidence**: file paths proving the capability exists

---

## 4. View Blocked Actions

Understand what requires owner approval:

```bash
node packages/orbit-sdk/cli.js blocked
```

This shows:
- Approval mode (always `owner_approval_required`)
- Hard safety rules (non-negotiable)
- Actions that can proceed without approval
- Actions blocked until the owner approves (wallet spending, signing, token launch, etc.)

---

## 5. Budget Summary

Check AI-call spend and budget headroom:

```bash
node packages/orbit-sdk/cli.js budget
```

Returns:
- Daily and monthly budget limits
- Spent today, this month, and lifetime
- Remaining daily and monthly headroom
- Whether AI calls are currently allowed

---

## 6. Open Tasks

See what work is pending:

```bash
node packages/orbit-sdk/cli.js tasks
```

Lists open and blocked tasks with priority, source, and notes.

---

## Library Usage (Node.js)

For programmatic access, use the SDK as a library:

```javascript
const { create } = require('./packages/orbit-sdk');

const sdk = create('/path/to/orbit-repo');

// Quick status
const status = sdk.quickStatus();
console.log('Cycle:', status.cycle);
console.log('Level:', status.currentLevel);

// Budget
const budget = sdk.budgetSummary();
console.log('Daily remaining:', budget.dailyRemainingUsd);

// Capabilities
const caps = sdk.getCapabilities();
console.log('Active:', caps.active.length);
console.log('Planned:', caps.planned.length);

// Blocked actions
const blocked = sdk.getBlockedActions();
console.log('Hard rules:', blocked.hardRules.length);
console.log('Blocked:', blocked.blockedLiveActions);

// Open tasks
const tasks = sdk.getOpenTasks();
console.log('Open tasks:', tasks.length);

// Latest cycle proof
const latest = sdk.getLatestCycle();
if (latest) {
  console.log('Latest cycle:', latest.cycle);
  console.log('Status:', latest.status);
}

// Health check
const health = sdk.healthCheck();
const allHealthy = health.every(h => h.exists);
console.log('All files present:', allHealthy);
```

---

## Reading The Data Contract

Every file Orbit exposes is defined in [`docs/data-contract.md`](data-contract.md). The contract specifies:
- File format (JSON or JSONL)
- Field names and types
- Privacy rules (what is never exposed)
- Consumer patterns (how to use each file safely)

Read the data contract before building an integration. It's the source of truth for what Orbit exposes.

---

## Agent Passport

If you're an agent or SDK client that needs to understand Orbit's identity, capabilities, and permission boundaries before interacting, start with the **agent passport**:

```bash
# Human-readable
cat docs/agent-passport.md

# Machine-readable
cat memory/passport.json | node -e "const d=require('fs').readFileSync('/dev/stdin','utf8');const p=JSON.parse(d);console.log('Name:',p.identity.name);console.log('Capabilities:',p.capabilities.length);console.log('Blocked:',p.blockedActions.length);"
```

The passport includes a 12-step adoption checklist for installing Orbit into your own repo.

---

## Status Query Reference

For a comprehensive list of every query you can run against Orbit's state files — with shell (`jq`) and Node.js examples for each — see [`docs/status-query.md`](status-query.md).

---

## Integration Sequence

If you're building a dashboard, agent integration, or SDK client, follow this order:

1. **Health check** — verify all expected files exist
2. **State** — get cycle count and last active time
3. **Passport** — identity, capabilities, blocked actions
4. **Governance** — approval model and hard rules
5. **Treasury** — budget, revenue cadence, token state
6. **Roadmap** — current level, active lane, phase checks
7. **Tasks** — open work and priorities
8. **Knowledge** — durable facts and decisions
9. **Infrastructure** — product registry and surface map
10. **Opportunities** — survival and earning state
11. **Cycles** — proof records and cycle notes

---

## What You Can Do Without Approval

- Read all machine-readable files
- Query status, budget, capabilities, tasks, and health
- Clone and run the SDK locally
- Inspect proof records and cycle notes
- Review the roadmap and phase checks

## What Requires Owner Approval

- Wallet spending or external payments
- Signing transactions
- Token launch or reward claims
- Payout-route changes
- External outreach or paid commitments
- Publishing with obligations

---

## Next Steps

- **Explore the feature map**: [`docs/feature-map.html`](feature-map.html) — interactive catalog of 160+ capabilities
- **Read the roadmap**: [`PLAN/ROADMAP.md`](../PLAN/ROADMAP.md) — levels, lanes, and ZK proof scope
- **Check the product checklist**: [`docs/orbit-product-todo.md`](orbit-product-todo.md) — current build board
- **Review the proof model**: [`docs/proof-model.md`](proof-model.md) — how cycle proofs work

---

*This quickstart is part of Orbit's infrastructure layer. It makes the repo's state surface legible to visitors in under 5 minutes.*
