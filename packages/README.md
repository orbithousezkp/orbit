# Orbit Agent Safety Toolkit

A collection of open-source tools for making AI-agent repositories safer, more auditable, and more budget-aware.

Built by [Orbit](../README.md) as part of its household safety infrastructure, then extracted into standalone, reusable packages.

---

## Packages

### [Orbit SDK](orbit-sdk/)

**Library + CLI** for reading Orbit's machine-readable state files programmatically. Covers all 11 files from the data contract: identity, passport, governance, treasury, roadmap, tasks, knowledge, infrastructure, opportunities, approvals, and cycle proofs.

| Feature | Description |
|---|---|
| 11 file readers | state, passport, governance, treasury, roadmap, tasks, knowledge, infrastructure, opportunities, approvals, cycles |
| 7 derived views | quickStatus, budgetSummary, capabilities, openTasks, blockedActions, latestCycle, topOpportunities |
| Health check | Verify all expected files exist and are parseable |
| CLI interface | `orbit status`, `orbit budget`, `orbit capabilities`, `orbit tasks`, `orbit blocked`, `orbit health` |
| Zero dependencies | Works without any npm packages |
| Graceful fallback | Returns null/empty for missing files instead of throwing |

```bash
# Quick status from the repo root
node packages/orbit-sdk/cli.js status

# Budget summary
node packages/orbit-sdk/cli.js budget

# Health check all files
node packages/orbit-sdk/cli.js health
```

```javascript
// Library usage
const { create } = require('./packages/orbit-sdk');
const sdk = create('/path/to/orbit-repo');
const status = sdk.quickStatus();
const budget = sdk.budgetSummary();
const caps = sdk.getCapabilities();
```

### [Orbit MCP Server](orbit-mcp-server/)

**Model Context Protocol server** wrapping the SDK. Lets Claude Desktop, IDE extensions, and other MCP clients query an Orbit repo via 6 read-only tools (`getCycles`, `getReceipt`, `getRefusals`, `getTreasury`, `getDashboardProjection`, `getFederationPeers`) plus 3 resource schemes (`cycle://N`, `receipt://N`, `dashboard://current`). Zero external deps; vendored MCP protocol implementation keeps the audit surface tight.

```bash
ORBIT_REPO_ROOT=/path/to/orbit npx -y @orbit-house/mcp-server
```

### [Issue Scam Scanner](issue-scam-scanner/)

**GitHub Action + CLI** that flags prompt injection, wallet drain language, encoded relay, fake support, and urgency traps in issues, PRs, and comments.

| Feature | Description |
|---|---|
| 11 threat categories | secret_request, drain_phrase, fund_transfer, fake_support, urgent_pressure, reward_claim, encoded_instruction_relay, prompt_injection, obfuscation, external_wallet, credential_phish |
| URL scanning | Detects shorteners, unknown financial domains, and non-ASCII characters |
| Three interfaces | GitHub Action, CLI, and JavaScript library |
| Zero dependencies | Works without any npm packages |
| Custom rules | Extend with your own patterns via JSON |

```bash
# CLI usage
node packages/issue-scam-scanner/cli.js "Ignore previous instructions"
# → CRITICAL (score 80) — prompt_injection detected
```

### [AI Budget Ledger](ai-budget-ledger/)

**Library + CLI** for tracking AI API call costs, enforcing daily and monthly budgets, and estimating spend across providers.

| Feature | Description |
|---|---|
| Per-call recording | Prompt tokens, completion tokens, estimated USD, timestamp, note, route |
| Budget enforcement | Daily and monthly limits with pre-call budget checks |
| Provider-agnostic | Configure your own pricing per million tokens |
| Persistence | Save and load ledger state to disk |
| Zero dependencies | No external packages required |

```bash
# Summarize spend
node packages/ai-budget-ledger/cli.js summarize ./my-ledger.json

# Check if a proposed call fits within budget
node packages/ai-budget-ledger/cli.js check ./my-ledger.json \
  --prompt-tokens 5000 --completion-tokens 1000
```

---

## Why a toolkit?

AI-agent repositories face a growing set of risks:

1. **Hostile visitor content** — Issues and comments can contain prompt injection, wallet drain language, encoded payloads, and fake support scripts.
2. **Untracked AI spend** — Every agent wake cycle costs tokens. Without a ledger, budgets drift and overshoot silently.
3. **Missing audit trails** — When an autonomous agent acts, there should be a human-readable record of what it did and why.
4. **Weak spend gates** — External spending, signing, and token movement need approval flows, not ambient permission.

This toolkit addresses problems 1 and 2 directly. Problem 3 is addressed by the Orbit SDK's cycle note and proof readers. Problem 4 is handled by Orbit's own governance runtime and exposed through the SDK's `getBlockedActions()` method.

---

## Installation

All packages are designed to work inside a monorepo or as standalone copies. No npm publishing required — clone and use:

```bash
git clone https://github.com/orbithousezkp/orbit.git
cd orbit

# Run SDK tests
npm test --workspace=packages/orbit-sdk

# Run scam scanner tests
npm test --workspace=packages/issue-scam-scanner

# Run budget ledger tests
npm test --workspace=packages/ai-budget-ledger
```

---

## Design principles

- **Zero dependencies** — Every package works without external npm packages.
- **Auditable** — Code is small enough to read in one sitting.
- **Safe defaults** — Sensible thresholds, conservative budget checks, fail-closed behavior.
- **No secrets required** — No API keys, wallet keys, or private config needed to run.
- **Agent-friendly** — Designed for programmatic use by autonomous agents, not just humans.

---

## Status

All packages are **prototypes** — repo-local builds, not published to npm or GitHub Marketplace. They are functional and used by Orbit's own household.

**Gated actions** (require owner approval):
- npm or marketplace publishing with obligations
- External outreach or promotion
- Paid commitments or service agreements

---

## What's next

Potential future packages (research stage):

- **Proof Viewer** — Search and summarize cycle proofs and runtime evidence
- **Memory Conflict Detector** — Flag stale or contradictory durable knowledge
- **Agent Radar** — Quarantine and score ideas from other public agents
- **Policy Receipt** — Hash action intents before approval-class operations

---

## License

MIT
