# Orbit

**Orbit — the control plane for agent memory and infrastructure inside any GitHub repo. Approval gates, signed cycle proofs, on-chain treasury — built in.**

It turns a repo into a control plane for autonomous software work: lifecycle, memory, tasks, permissions, proofs, AI budget, GitHub intake, and wallet policy all live in versioned files that agents and humans can inspect.

Orbit is not a security product and it is not a hot wallet. Intake scanning is only a guardrail. The product is the operating layer that lets a repo coordinate agents, prove work, remember context, enforce permissions, and keep wallet actions gated.

## Quick Links

- **[Architecture](docs/architecture.md)** — technical layer diagram, data flow, file map, and design principles
- **[Agent Passport](docs/agent-passport.md)** — portable identity, capabilities, permissions, proof model, and adoption checklist
- **[Roadmap](PLAN/ROADMAP.md)** — levels, lanes, phase checks, and ZK proof scope
- **[Feature Map](docs/feature-map.html)** — interactive feature catalog
- **[Product Checklist](docs/orbit-product-todo.md)** — current product build board

## What Orbit Provides

- **Repository control plane**: `memory/` stores identity, tasks, state, infrastructure, roadmap, governance, treasury, opportunities, and durable knowledge.
- **Lifecycle runtime**: GitHub Actions wake Orbit from schedule, events, or local runs, then record cycle state and proof.
- **Agent memory**: stable facts, tasks, lessons, and policy survive between disconnected runs.
- **Permission gates**: routine repo work can proceed, while spending, signing, token launch, reward claims, payout changes, and external commitments require approval.
- **Proof receipts**: each cycle can leave reviewable records under `runtime/proofs/` and compact notes under `memory/cycles/`.
- **Wallet policy layer**: Orbit exposes read-only wallet policy, AI food budget, weekly revenue cadence, token status, and blocked live actions without exposing private keys or private routes.
- **GitHub intake**: issues and comments act as the public command, discussion, task, and approval surface.
- **Infrastructure registry**: `memory/infrastructure.json` describes Orbit's product phase, layers, access surfaces, capabilities, command surface, receipts, and blocked actions.
- **Roadmap gates**: roadmap progress is evidence-backed and must not outrank open tasks, safe issue triage, safety review, or owner approval checks.
- **Agent passport**: `docs/agent-passport.md` is a portable identity declaration for other repos, agents, dashboards, and SDK clients.

## Product Shape

Orbit is meant to be installed into repos that need a durable agent operating layer:

```text
GitHub repo
  -> lifecycle runtime
  -> agent memory
  -> task and command routing
  -> permission and approval policy
  -> proof receipt ledger
  -> wallet policy and budget view
  -> agent passport and capability registry
  -> SDK/CLI access for other agents and dashboards
```

Other agents and tools should be able to ask Orbit:

- What is this repo trying to do?
- What capabilities are active or planned?
- What work is safe to perform without approval?
- What actions are blocked until owner approval?
- What happened in recent cycles?
- What proof receipts exist?
- What wallet, budget, revenue, and token policy is public-safe to inspect?
- What files or workflows are missing for adoption?

## Local Use

```bash
npm install
npm run health
npm test
npm run audit
```

Run a local cycle without networked AI:

```bash
npm run cycle
```

Inspect infrastructure:

```bash
npm run infrastructure
npm run infrastructure -- --json
```

Run the frontend locally:

```bash
npm run dev
```

## AI Provider Setup

Orbit supports OpenAI-compatible routes through private environment configuration.

```bash
ORBIT_AI_PROVIDERS='[...]' \
GITHUB_TOKEN=... \
GITHUB_REPOSITORY=owner/repo \
ORBIT_DRY_RUN=false \
npm run cycle
```

Live provider routing belongs in private environment variables or GitHub Secrets. The public `memory/ai-providers.json` file is only a placeholder and must not expose provider names, API bases, models, custom headers, billing routes, or keys.

`ORBIT_AI_PROVIDERS` is an ordered JSON route list. Orbit tries each configured route in order and falls back when a request fails.

AI-credit purchases are separate from inference routing. Orbit may request an owner-approved AI-food refill, but the runtime records approval and completion proof; it does not silently execute payment.

## Wallet Boundary

Orbit defaults to dry-run behavior. Live token launch and live reward claiming are disabled until explicitly enabled.

External spend is blocked by default. If money, signing, token movement, payout-route changes, or major risky external movement is needed, Orbit must create a public approval request and stop until the configured owner approves.

Do not commit private keys, payout routes, provider keys, or private execution payloads. Use GitHub Secrets or private repository variables for wallet addresses, claim routing, revenue basis points, and live-operation flags.

Revenue sending is not continuous. Orbit only queues reward claims after the configured weekly interval and only when recent cycle performance clears configured thresholds.

## Cycle Assignment

Orbit has one cycle engine. Each wake records why it fired:

- **Mandatory**: `.github/workflows/orbit-cycle.yml` runs on the regular heartbeat.
- **Event**: `.github/workflows/orbit-event.yml` runs when GitHub issues or issue comments change.
- **State**: state is selected after Orbit reads memory, treasury, tasks, issues, and proofs. Low AI budget, missing income, pending approvals, open tasks, or stale memory can override the original wake reason.

Priority is safety first, then owner approvals, learning/prototype work, survival drivers, open tasks, issue triage, infrastructure growth, wallet policy, roadmap growth, budget review, memory review, and health checks.

## Project Layout

```text
src/agent/                  runtime, planner, tools, memory, governance, treasury, proofs
src/cli/                    local infrastructure and health commands
memory/                     repo control-plane state
runtime/proofs/             per-cycle proof receipts
packages/issue-scam-scanner/ intake guardrail package
packages/orbit-sdk/         read-only SDK surface, finalized after product shape is stable
docs/architecture.md        technical layer diagram, data flow, and file map
docs/agent-passport.md      portable agent identity and capability registry
docs/proof-model.md         proof formats, privacy rules, and JSONL schema
docs/wallet-policy.md       approval model, budget, revenue, and token boundary
docs/orbit-product-todo.md  product build checklist
tests/                      runtime, planner, infrastructure, treasury, governance, scanner tests
```

## Build Board

The current product checklist is tracked in [`docs/orbit-product-todo.md`](docs/orbit-product-todo.md). Items are marked done only after the repo contains matching files, tests, docs, or UI.
