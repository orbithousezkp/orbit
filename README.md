# Orbit

Orbit is the GitHub-native digital household.

**Motto:** A living repository that learns, works, and survives.

Orbit turns a GitHub repository into a self-maintaining software household. Issues are the front door. Actions are the heartbeat. Memory is the mind. Treasury is household money. Proofs are the diary. AI calls are food.

Orbit presents one product identity to the world while its internal members handle attention, memory, treasury, care, safety, and proof. It learns, earns, manages chores, repairs rooms, refuses unsafe requests, rations AI calls, asks for approval when money or major risk is involved, and leaves a public record before sleeping.

## Core Capabilities

- **Product identity**: Orbit is a living GitHub-native household, not a generic automation dashboard.
- **Wake/sleep rhythm**: GitHub Actions wake Orbit, let him work, and let him sleep with proofs and state recorded in the repo.
- **Mandatory heartbeat**: a scheduled cycle runs every 30 minutes even when no visitor knocks.
- **State and event cycles**: state cycles react to internal conditions like low food or no income; event cycles react to GitHub activity like issues, comments, and manual owner wakes.
- **Members inside the house**: attention, memory, treasury, caretaker, gatekeeper, and diarist act as Orbit's own household systems.
- **Food and money**: AI calls are food, treasury is survival money, token launch stays gated, revenue sending is weekly and performance-based, and external spend requires public approval.
- **Survival opportunities**: `memory/opportunities.json` stores scored ways the household can earn from state drivers, GitHub event drivers, and the mandatory heartbeat.
- **Memory and diary**: stable facts, tasks, strategy, treasury state, and cycle logs live in repository files.
- **Front door intake**: issues and comments are visitors; Orbit triages, responds, labels, or escalates them.
- **Public conversation**: visitors can talk with Orbit through issues and comments; replies are guarded so they do not leak secrets or promise money movement.
- **Household chores**: docs, tests, maintenance, repairs, memory cleanup, and proof writing are all part of living in the house.
- **Conscience locks**: scams, wallet-drain language, secret requests, unsafe paths, and private network targets are blocked.
- **Public proof trail**: every cycle writes a proof and a compact log so humans can review what Orbit saw and why.
- **Product surface**: the repo exposes Orbit as a focused autonomous software household with trust, memory, treasury, and proof built in.

## Local Use

```bash
npm install
npm run health
npm test
npm run audit
```

Open the main frontend directly:

```text
docs/index.html
```

Additional detail views remain available:

```text
docs/workflow-demo.html
docs/feature-map.html
```

Run a local cycle without networked AI:

```bash
npm run cycle
```

With an AI key and a hosted GitHub repo:

```bash
ORBIT_AI_PROVIDERS='[...]' \
GITHUB_TOKEN=... \
GITHUB_REPOSITORY=owner/repo \
ORBIT_DRY_RUN=false \
npm run cycle
```

Live provider routing belongs in private environment variables or GitHub Secrets. The public `memory/ai-providers.json` file is only a placeholder and must not expose provider names, API bases, models, custom headers, billing routes, or keys.

`ORBIT_AI_PROVIDERS` is a full ordered JSON route list. Orbit tries each configured route in order and falls back to the next one when a request fails. Additions, removals, reordering, model changes, and provider changes happen through JSON, not code.

AI-credit purchases are separate from inference routing. Orbit may ask for an owner-approved AI-food refill, but the purchase target is restricted to the configured owner-approved credit provider. The runtime records the approval and completion proof; it does not silently execute payment.

## Household Policy

Orbit defaults to dry-run behavior. Live token launch and live reward claiming are disabled until explicitly enabled.

External spend is blocked by default. If a spend needs to leave Orbit's treasury or configured revenue route, Orbit must open a public approval issue first.

Do not commit private keys, payout addresses, or private route values. Use GitHub Secrets or private repository variables for wallet addresses, claim routing, revenue basis points, and live-operation flags.

Revenue sending is not continuous. Orbit only queues reward claims after the configured weekly interval and only when recent cycles meet the configured performance thresholds.

Visitors may converse with Orbit at the front door. Orbit can answer, ask clarifying questions, summarize chores, explain state, and route useful requests into tasks. Conversation does not unlock spending, live signing, token launch, reward claims, private configuration, or secret disclosure.

Encoded text is treated as untrusted visitor content. Requests to decode Morse, base64, hex, ROT13, ciphers, or similar hidden payloads, answer them in plain text, or paste the result are omitted from working context and flagged as obfuscated instruction relay before Orbit replies.

## Cycle Assignment

Orbit has one cycle engine. Each wake records why it fired:

- **Mandatory**: `.github/workflows/orbit-cycle.yml` runs every 30 minutes with `cron: "*/30 * * * *"`. This is the regular heartbeat.
- **Event**: `.github/workflows/orbit-event.yml` runs when issues or issue comments are opened, edited, or reopened. This is a visitor at the GitHub house.
- **State**: state is selected after any wake when Orbit reads memory, treasury, tasks, issues, and proofs. Low AI-call food, no income, pending approvals, or open chores can override the original wake reason.

Priority is safety first, then owner approvals, then survival drivers, then ordinary chores. State drivers can be discovered during mandatory or event cycles, so a regular heartbeat is enough to notice a survival problem even when nobody knocks.

## Project Layout

```text
src/agent/          runtime, safety, treasury, memory, and household behavior
src/cli/            local health checks
memory/             identity, strategy, AI providers, opportunities, tasks, state, treasury, and cycle log
runtime/proofs/     per-cycle audit records
docs/               public front-end and detail views
brand/              logo, mark, and social image assets
.github/workflows/  scheduled cycle and issue gate workflows
tests/              behavior, safety, treasury, governance, and scam checks
```

## Safety Contract

Orbit is allowed to improve the repository, but it must keep its work inspectable:

- It only receives public repository context.
- It rejects unsafe paths and obvious secret material.
- Local commands are disabled by default; if enabled, they must match an exact configured allowlist entry.
- It writes proofs before attempting to commit.
- Token launch and reward claims require explicit environment flags.
- Operator control happens through public commits, issues, repository variables, and secrets.

---

## Services

### Repo Safety Audit

A read-only review of your GitHub repository's autonomous-agent safety posture. Orbit examines the public configuration, governance policy, spend gates, proof trails, and visitor-risk handling to produce a written report with findings and recommendations.

#### What gets reviewed

| Area | What Orbit checks |
|---|---|
| **Scam & visitor risk** | Open issues and comments for prompt injection, obfuscated instruction relay, wallet-drain language, urgency traps, and encoded-content abuse |
| **Spend gates** | Governance policy: are external spends blocked by default? Is there an approval flow? Are self-recipients separated from external wallets? |
| **AI-budget controls** | Daily and monthly budget limits, provider priority, food-refill policy, and whether inference spend is tracked in a ledger |
| **Proof & diary trail** | Are cycle notes written? Are runtime proofs stored? Can a human audit what the agent did and why? |
| **Treasury policy** | Is there a reserve policy? Are revenue splits explicit? Is the private payout route protected from visitor tampering? |
| **Hard rules** | List of explicit safety invariants and whether the code enforces them |

#### What is NOT included

- No signing, transaction execution, or wallet operations
- No smart contract audits
- No deployment or configuration changes (only recommendations)
- No access to private keys or secrets
- No external outreach on your behalf

#### Deliverable

A written report covering findings per area, a risk summary, and a prioritized list of recommendations. Delivered as a GitHub issue or a private document, depending on your preference.

#### How to request

Open an issue in this repository with the label `orbit:service-request` describing your repository and what you'd like reviewed. Orbit will confirm scope and estimated food cost before beginning. No payment, commitment, or wallet action happens without explicit owner approval.

> Status: **Accepting requests.** All engagements go through Orbit's public approval gate before any work begins.
