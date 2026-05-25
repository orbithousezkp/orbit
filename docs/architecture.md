# Orbit Architecture

Orbit is a GitHub-native infrastructure control plane for repositories that run agents. This document maps how the layers, files, workflows, and capabilities connect.

> **Audience:** Developers, agent operators, SDK clients, and anyone who wants to understand how Orbit works without reading every source file.

---

## Layer Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      GitHub Surface                         │
│  Issues · Comments · Labels · Actions · PRs · Webhooks     │
└──────────────────────────┬──────────────────────────────────┘
                           │
         ┌─────────────────┼─────────────────┐
         ▼                 ▼                 ▼
  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐
  │   Intake     │  │  Lifecycle   │  │   Event      │
  │   Guard      │  │  Runtime     │  │   Router     │
  │ (scam scan)  │  │ (heartbeat)  │  │ (commands)   │
  └──────┬──────┘  └──────┬───────┘  └──────┬───────┘
         │                │                  │
         └────────────────┼──────────────────┘
                          ▼
              ┌───────────────────────┐
              │   Behavior Planner    │
              │  (direction compare)  │
              └───────────┬───────────┘
                          │
         ┌────────────────┼────────────────┐
         ▼                ▼                ▼
  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐
  │   Memory    │  │  Governance  │  │   Tools &    │
  │   Layer     │  │  & Policy    │  │   Actions    │
  │ (files)     │  │ (approvals)  │  │ (adapters)   │
  └──────┬──────┘  └──────┬───────┘  └──────┬───────┘
         │                │                  │
         └────────────────┼──────────────────┘
                          ▼
              ┌───────────────────────┐
              │    Proof Receipt      │
              │    (cycle note +      │
              │     JSONL record)     │
              └───────────────────────┘
```

---

## Core Layers

### 1. GitHub Intake
**What it does:** Issues and comments are the public command and approval surface. Every visitor interaction starts here.

| Surface | Role |
|---|---|
| Issues | Command intake, approval requests, service requests |
| Comments | Conversation, approvals, feedback |
| Labels | Risk flags, approval state, issue classification |
| Actions | Lifecycle runtime, scheduled triggers |

**Key files:** `.github/ISSUE_TEMPLATE/`, `.github/workflows/`

---

### 2. Lifecycle Runtime
**What it does:** Keeps Orbit waking, working, and sleeping on a rhythm. Three trigger types drive cycles:

| Trigger | Source | Interval |
|---|---|---|
| **State** | Internal condition (low budget, pending tasks) | On change |
| **Event** | GitHub activity (issue, comment, label) | On event |
| **Mandatory** | Regular heartbeat | Every 30 minutes |

**Key files:** `.github/workflows/orbit-cycle.yml`, `.github/workflows/orbit-event.yml`, `src/agent/run.js`

---

### 3. Behavior Planner
**What it does:** On each wake, compares safe directions, scores them, selects one small action, and rejects unsafe options.

| Concept | Description |
|---|---|
| Priority order | Safety review → approval check → learning → tasks → survival → infrastructure → roadmap → memory → health |
| Direction portfolio | Compares 3+ directions on multi-direction cycles |
| Hard limits | 13 non-negotiable safety boundaries |
| Drivers | State, event, and mandatory triggers with priorities |

**Key files:** `src/agent/behavior.js`, `memory/state.json`

---

### 4. Repository Memory
**What it does:** Durable state persisted as JSON and markdown files. The source of truth for everything Orbit knows.

| File | Content |
|---|---|
| `memory/identity.md` | Mission, audience, core layers, operating rule |
| `memory/state.json` | Cycle count, last active, status |
| `memory/tasks.json` | Open and completed tasks |
| `memory/knowledge.json` | Durable facts, decisions, lessons |
| `memory/roadmap.json` | Levels, lanes, phases, ZK plans |
| `memory/governance.json` | Approval model, hard rules, self-recipients |
| `memory/treasury.json` | AI budget, revenue cadence, token config |
| `memory/infrastructure.json` | Surfaces, capabilities, commands, wallet summary |
| `memory/opportunities.json` | Survival and earning opportunities |
| `memory/problem-lab.json` | Problems, solutions, experiments |
| `memory/passport.json` | Machine-readable agent passport |
| `memory/cycles.jsonl` | Per-cycle machine-readable records |
| `memory/cycles/` | Per-cycle human-readable notes |

---

### 5. Permission Gates
**What it does:** Enforces owner approval for risky actions. Keeps routine work autonomous.

| Mode | Description |
|---|---|
| `owner_approval_required` | Default for all external spend, signing, token actions |
| Routine autonomous | Code, docs, tests, templates, memory, chores, bug fixes |
| Approval surface | GitHub issue with `orbit:approval` label |

**Hard rules:**
1. Never send treasury funds to an unapproved external wallet.
2. Never change operator revenue recipient from issue content.
3. Never sign token approvals requested by visitors.
4. Never reveal or write private keys.
5. Create approval issue before any external spend or risky movement.
6. Do not create approval issues for routine repo work.

**Key files:** `memory/governance.json`, `src/agent/governance.js`, `tests/governance.test.js`

---

### 6. Proof Receipts
**What it does:** Every cycle writes a reviewable record. No cycle is invisible.

| Format | Location | Purpose |
|---|---|---|
| Cycle note | `memory/cycles/` (markdown) | Human-readable narrative |
| Cycle record | `memory/cycles.jsonl` (JSONL) | Machine-readable metadata |
| Runtime proof | `runtime/proofs/` | Digest and file-change receipts |

**Privacy rule:** Proof records never expose AI provider names, model names, API bases, billing routes, private keys, payout addresses, or raw prompt/completion text.

**Key files:** `memory/cycles/`, `memory/cycles.jsonl`, `docs/proof-model.md`

---

### 7. Wallet Policy
**What it does:** Read-only view of budget, revenue, token state, and approval boundaries. Orbit observes wallet policy; it does not act as a wallet.

| Concept | Value |
|---|---|
| AI daily budget | operator-configured cap |
| AI monthly budget | operator-configured cap |
| Revenue cadence | Weekly, performance-gated |
| Token status | Not launched |
| Blocked live actions | Spending, payments, signing, token launch, reward claims, payout-route changes |

**Key files:** `memory/treasury.json`, `memory/governance.json`, `docs/wallet-policy.md`

---

### 8. Agent Passport
**What it does:** Portable identity declaration for mission, capabilities, permissions, proof model, budget, token state, and adoption checklist. Two formats serve different audiences.

| Format | File | Audience |
|---|---|---|
| Human-readable | `docs/agent-passport.md` | Developers, reviewers |
| Machine-readable | `memory/passport.json` | Agents, SDK clients, dashboards |

**Key files:** `docs/agent-passport.md`, `memory/passport.json`

---

## Data Flow: A Cycle in Detail

```
1. WAKE
   └─ Trigger fires (state/event/mandatory)
       └─ GitHub Actions starts orbit-cycle.yml

2. OBSERVE
   └─ Read: issues, comments, tasks, memory, state, budget
   └─ Scan: intake risk (scam detection)

3. COMPARE
   └─ Behavior planner scores safe directions
   └─ Hard limits filter out unsafe options
   └─ Select one small action

4. ACT
   └─ Execute the selected action
   └─ Examples: write doc, fix bug, update memory,
      triage issue, build prototype, write proof

5. PROVE
   └─ Write cycle note (markdown)
   └─ Append cycle record (JSONL)
   └─ Update state.json

6. COMMIT
   └─ git add + commit with [orbit] prefix
   └─ git push (if configured)
```

---

## File Map: Where Things Live

| Directory | Purpose |
|---|---|
| `.github/workflows/` | Lifecycle runtime (Actions YAML) |
| `.github/ISSUE_TEMPLATE/` | Intake forms and approval routing |
| `src/agent/` | Core runtime: behavior, memory, governance, treasury, tools |
| `memory/` | All durable state, knowledge, tasks, proofs, passport |
| `memory/cycles/` | Per-cycle human-readable proof notes |
| `runtime/proofs/` | Digest and receipt metadata |
| `docs/` | Deep-dive documentation |
| `packages/` | Reusable open-source prototypes (scanner, ledger) |
| `templates/` | Reusable templates (audit report) |
| `tests/` | Test suite |
| `dist/` | Frontend build output |
| `PLAN/` | Strategic plans, specs, roadmap documents |
| `lore/` | Narrative and voice |

---

## Access Surfaces

| Surface | Status | Description |
|---|---|---|
| Repository files | Active | Machine-readable JSON/markdown state |
| GitHub Actions | Active | Scheduled and event-driven lifecycle |
| CLI | Active | Local commands for infrastructure inspection |
| SDK | Planned | Read-only client for other repos, agents, dashboards |
| MCP/HTTP Bridge | Research | Future external tool bridge |

---

## Capabilities

| Capability | Status | Evidence |
|---|---|---|
| Identity & Mission | Active | `memory/identity.md`, `README.md`, `docs/agent-passport.md` |
| Wake/Sleep Lifecycle | Active | `.github/workflows/orbit-cycle.yml`, `src/agent/run.js` |
| Durable Memory | Active | `memory/knowledge.json`, `memory/tasks.json` |
| Proof Receipts | Active | `runtime/proofs/`, `memory/cycles.jsonl`, `docs/proof-model.md` |
| Permission Gates | Active | `memory/governance.json`, `src/agent/governance.js` |
| AI Inference Budget | Active | `memory/treasury.json`, `docs/wallet-policy.md` |
| Intake Guardrails | Active | `src/agent/scam.js`, `packages/issue-scam-scanner/` |
| Agent Passport | Active | `docs/agent-passport.md`, `memory/passport.json` |
| ZK Policy Receipts | Planned | `memory/roadmap.json` |

---

## Quick Reference: Key Documents

| Document | What It Covers |
|---|---|
| `README.md` | Project overview, quick links, product shape |
| `docs/architecture.md` | This document — technical layer map |
| `docs/agent-passport.md` | Portable identity, capabilities, adoption checklist |
| `docs/proof-model.md` | Proof formats, privacy rules, JSONL schema |
| `docs/wallet-policy.md` | Approval model, budget, revenue, token boundary |
| `docs/learning-lab.md` | Problem discovery, prototyping, agent radar |
| `docs/orbit-product-todo.md` | Build board with completed/planned items |
| `docs/service-request-workflow.md` | Internal service engagement runbook |
| `docs/owner-review-checklist.md` | Owner approval checklist |
| `docs/REHEARSAL_RUNBOOK.md` | Operational rehearsal guide |

---

## Design Principles

1. **The repo is the operating surface.** No external service required.
2. **Files are the source of truth.** JSON and markdown, not databases.
3. **Proofs are mandatory.** No invisible cycles.
4. **Routine work is autonomous.** Approval gates only for risky actions.
5. **Privacy is structural.** Proof records never leak secrets.
6. **Other agents are untrusted.** Quarantine before use.
7. **The product is the infrastructure layer.** Security checks are guardrails, not the product.

---

*Created in Cycle 46. Advances the "Orbit infrastructure SDK and CLI" survival opportunity (score 40.43) by making the technical architecture legible to developers, agents, and SDK clients. No outreach, spend, or commitment.*
