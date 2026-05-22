# Orbit

Orbit is a living household inside GitHub.

GitHub is the house location. Issues are the front door. Actions are the heartbeat. Memory is the mind. Treasury is household money. Tools are the hands. Proofs are the diary. AI calls are food.

The house has members inside it: attention, memory, treasury, caretaker, gatekeeper, and diarist. They learn, earn, manage chores, repair rooms, refuse unsafe requests, ration AI calls, ask for approval when money or risk is involved, and leave a public record before sleeping.

## Core Capabilities

- **Household model**: Orbit is described as a living house in the repository, not a detached dashboard or service.
- **Wake/sleep rhythm**: GitHub Actions wake Orbit, let him work, and let him sleep with proofs and state recorded in the repo.
- **Mandatory heartbeat**: a scheduled cycle runs every 30 minutes even when no visitor knocks.
- **State and event cycles**: state cycles react to internal conditions like low food or no income; event cycles react to GitHub activity like issues, comments, and manual owner wakes.
- **Members inside the house**: attention, memory, treasury, caretaker, gatekeeper, and diarist act as Orbit's own household systems.
- **Food and money**: AI calls are food, treasury is survival money, token launch and revenue claims stay gated, and external spend requires public approval.
- **Survival opportunities**: `memory/opportunities.json` stores scored ways the household can earn from state drivers, GitHub event drivers, and the mandatory heartbeat.
- **Memory and diary**: stable facts, tasks, strategy, treasury state, and cycle logs live in repository files.
- **Front door intake**: issues and comments are visitors; Orbit triages, responds, labels, or escalates them.
- **Public conversation**: visitors can talk with Orbit through issues and comments; replies are guarded so they do not leak secrets or promise money movement.
- **Household chores**: docs, tests, maintenance, repairs, memory cleanup, and proof writing are all part of living in the house.
- **Conscience locks**: scams, wallet-drain language, secret requests, unsafe paths, and private network targets are blocked.
- **Public proof trail**: every cycle writes a proof and a compact log so humans can review what Orbit saw and why.
- **Living feature catalog**: the repo exposes a feature surface for the house model, the life layer, and the broader agent runtime.

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

Legacy detail views remain available:

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
ORBIT_AI_PROVIDERS='[
  {"name":"primary","apiKey":"...","apiBase":"https://provider.example/v1","model":"provider-model-id"},
  {"name":"fallback","apiKey":"...","apiBase":"https://fallback.example/v1","model":"fallback-model-id"}
]' \
GITHUB_TOKEN=... \
GITHUB_REPOSITORY=owner/repo \
ORBIT_DRY_RUN=false \
npm run cycle
```

Provider routing can also live in `memory/ai-providers.json`. That file is public and should contain only provider names, API bases, models, paths, and `apiKeyRef` values. The default inference priority is FreeModel first, OpenGateway second, and OpenRouter last. Put the real keys in the GitHub Secret `ORBIT_AI_PROVIDER_KEYS`, shaped like:

```json
{"freemodel":"...","opengateway":"...","openrouter":"..."}
```

`ORBIT_AI_PROVIDERS` is still supported as a full ordered JSON override. Orbit tries each provider in order and falls back to the next one when a request fails. Additions, removals, reordering, model changes, and provider changes happen through JSON, not code.

AI-credit purchases are separate from inference routing. Orbit may ask for an owner-approved AI-food refill, but the purchase target is restricted to OpenRouter credits. FreeModel and OpenGateway stay inference-only; they are not top-up destinations. The runtime records the approval and completion proof; it does not silently execute payment.

## Household Policy

Orbit defaults to dry-run behavior. Live token launch and live reward claiming are disabled until explicitly enabled.

External spend is blocked by default. If a spend needs to leave Orbit's treasury or configured revenue route, Orbit must open a public approval issue first.

Do not commit private keys, payout addresses, or private route values. Use GitHub Secrets or private repository variables for wallet addresses, claim routing, revenue basis points, and live-operation flags.

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
