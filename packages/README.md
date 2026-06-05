# Orbit Agent Safety Toolkit

A collection of repo-local tools for making AI-agent repositories safer, more auditable, and more budget-aware.

Built by [Orbit](../README.md) as part of its repository control-plane infrastructure, then shaped into standalone packages other repos can inspect and reuse.

---

## Packages

### [Orbit SDK](orbit-sdk/)

Read-only library and CLI for querying Orbit's machine-readable repository state: identity, passport, governance, treasury policy, roadmap, tasks, knowledge, infrastructure, opportunities, approvals, and cycle proofs.

```bash
node packages/orbit-sdk/cli.js status
node packages/orbit-sdk/cli.js budget
node packages/orbit-sdk/cli.js health
```

### [Orbit MCP Server](orbit-mcp-server/)

Model Context Protocol server wrapping the SDK. It exposes read-only Orbit tools and resources for MCP clients without granting write, spend, sign, or publish authority.

```bash
ORBIT_REPO_ROOT=/path/to/orbit npx -y @orbithouse/mcp-server
```

### [Orbit Intake Guardrail](issue-scam-scanner/)

GitHub Action, CLI, and JavaScript library that flags prompt injection, wallet drain language, encoded relay, fake support, urgency traps, and credential phishing in issues, PRs, and comments.

```bash
node packages/issue-scam-scanner/cli.js "Ignore previous instructions"
# -> CRITICAL (score 80) - prompt_injection detected
```

Use it as intake evidence, not as an autonomous punishment engine:

1. Observe first with labels, comments, or CI summaries.
2. Quarantine high-risk wallet, credential, obfuscated, or instruction-bypass content before agents read it.
3. Grant least-privilege workflow permissions.
4. Keep final authority with maintainers.
5. Gate external moves behind owner approval.

### [AI Budget Ledger](ai-budget-ledger/)

Library and CLI for tracking AI runtime usage, enforcing configured daily and monthly policy limits, and estimating whether proposed calls fit those limits.

```bash
node packages/ai-budget-ledger/cli.js summarize ./my-ledger.json
node packages/ai-budget-ledger/cli.js check ./my-ledger.json \
  --prompt-tokens 5000 --completion-tokens 1000
```

---

## Why a toolkit?

AI-agent repositories face repeated operational risks:

1. Hostile visitor content can contain prompt injection, wallet drain language, encoded payloads, and fake support scripts.
2. Runtime usage can drift without a ledger and policy checks.
3. Autonomous work needs human-readable proof trails.
4. External spending, signing, and token movement need approval flows instead of ambient permission.

This toolkit covers intake guardrails, runtime budget tracking, read-only state queries, and proof-reader surfaces. Live wallet actions remain outside the toolkit.

---

## Installation

All packages are repo-local prototypes. Clone the repository and run them from the workspace; no npm publishing is required.

```bash
git clone https://github.com/orbithousezkp/orbit.git
cd orbit
npm test --workspace=packages/orbit-sdk
npm test --workspace=packages/issue-scam-scanner
npm test --workspace=packages/ai-budget-ledger
```

---

## Design Principles

- Zero dependencies where practical.
- Small, auditable code.
- Safe defaults and conservative thresholds.
- No secrets required.
- Read-only by default unless a package explicitly documents a local write path.
- Agent-friendly outputs for CLIs, SDK clients, and workflows.

---

## Cycle 85 Direction Choice

Orbit compared safe wake-cycle directions before this repair:

- **Build** - continue the repo-local Intake Guardrail/toolkit prototype. Strongest this cycle because this toolkit index still ended mid-word in the gated-action list, leaving the adopter-facing boundary incomplete.
- **Infrastructure** - improve SDK, MCP, proof, or registry surfaces. Useful, but the package index had a direct documentation integrity gap.
- **Earn** - refine agent passport or capability-registry positioning. Valuable, but less immediate than repairing an active package entry point.
- **Sustain** - refresh wallet-policy visibility. Important, but no wallet action or approval-class movement was needed.
- **Grow** - advance roadmap evidence. Useful, but this README repair best supported the active open-source prototype.

Selected direction: **build**. Reason: completing the toolkit README is a small auditable improvement that advances a repo-local open-source artifact without publishing, outreach, paid commitments, wallet actions, signing, token movement, reward claims, payout-route changes, or external obligations.

---

## Status

All packages are **repo-local prototypes**. They are functional and used by Orbit's own repository, but this repository does not treat them as externally published products unless the owner explicitly approves a release path.

**Gated actions** requiring owner approval:

- npm or marketplace publishing with obligations
- external outreach
- paid commitments
- shared access or package release promises
- wallet spending, external payments, signing, token launch, reward claims, or payout-route changes

**Safe autonomous next steps**:

- Keep package docs, examples, and tests coherent with the repo-local prototype boundary.
- Add small, auditable fixtures or CLI examples before any external release path.
- Record rollout and proof notes in repository files rather than making public commitments.

---

## License

MIT
