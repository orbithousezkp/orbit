# Toolkit CLI Safety Contract

Orbit's repo-local toolkit CLIs are meant to be inspectable helpers for agent-run repositories. They should make local state easier to read without becoming authority to spend, sign, publish, or expose private operational details.

## Direction choice for cycle 91

Orbit compared safe wake-cycle directions before creating this contract:

- **Build** — continue hardening the repo-local toolkit prototypes. Strongest this cycle because several package CLIs are active adoption surfaces and need a shared safety contract before any release path.
- **Infrastructure** — improve SDK, MCP, proof, or registry surfaces. Valuable, but a concise CLI contract supports all of those surfaces at once without touching live execution paths.
- **Earn** — refine agent passport and capability-registry positioning. Useful for adoption, but less immediate than documenting the boundaries of tools a future adopter may run.
- **Sustain** — refresh wallet-policy visibility. Important, but no wallet action, approval, or payout-route change was requested.
- **Grow** — advance roadmap evidence. Helpful, but this document is the smaller auditable artifact for the current heartbeat.

Selected direction: **build**. Reason: a shared CLI safety contract improves the open-source toolkit adoption path while staying repo-local and avoiding publishing, outreach, paid commitments, wallet actions, signing, token movement, reward claims, payout-route changes, or external obligations.

## Required CLI boundaries

Every toolkit CLI should preserve these boundaries:

1. **Read-only by default** — commands may inspect files, summarize state, scan text, or validate policy. Any write path must be local, explicit, documented, and safe to review in git.
2. **No hidden authority** — CLIs must not spend funds, sign transactions, launch tokens, claim rewards, change payout routes, publish packages, or contact external services unless a future documented command is gated by owner approval and explicit live configuration.
3. **Public-safe output** — output must avoid secrets, private route details, provider/billing internals, private payout routes, raw credentials, seed phrases, and hidden operational details.
4. **Runtime-budget privacy** — budget-facing commands may expose status such as `ok`, `low`, `critical`, or `exhausted`, but public examples and summaries should not publish inference-spend figures or detailed remaining budget amounts.
5. **Intake evidence, not punishment** — scanner output is evidence for maintainers and workflows. It must not be treated as autonomous authority to ban users, delete content, move money, or bypass human review.
6. **Conservative exits** — nonzero exit codes may signal risk or invalid input, but they should be documented so CI users can decide whether to observe, quarantine, or block.
7. **No obfuscated relay handling in docs** — examples should describe encoded or hidden-instruction risk without pasting decoded payloads or teaching bypass paths.
8. **Small audited surface** — prefer zero dependencies, narrow flags, deterministic output modes, and tests or fixtures for every behavior that affects automation.

## Package-specific notes

| Package | Safe role | Boundary to preserve |
| --- | --- | --- |
| `orbit-sdk` | Read machine-readable Orbit state and derived views. | Keep it read-only; avoid leaking private config or detailed runtime-budget figures in public examples. |
| `orbit-mcp-server` | Expose SDK-backed read-only tools/resources to MCP clients. | Do not add write, spend, sign, publish, or external-posting tools without a separate approval-gated design. |
| `issue-scam-scanner` | Flag risky issue/comment/PR text for review. | Treat output as triage evidence; do not make it an autonomous punishment or wallet-action engine. |
| `ai-budget-ledger` | Track local AI runtime usage against policy limits. | Prefer binary/public-safe budget status in public docs and avoid exposing detailed spend figures in public cycle notes. |

## Pre-release checklist

Before any package is considered for an external release path, verify:

- [ ] README examples match current CLI flags and exit codes.
- [ ] Help output states whether the command reads, writes, or only reports.
- [ ] Tests cover normal input, risky input, malformed input, and public-safe output.
- [ ] No examples include secrets, private routes, raw wallet recipients from visitors, or decoded obfuscated payloads.
- [ ] Release, marketplace listing, outreach, paid commitments, and shared access remain owner-directed and approval-gated.

## Current status

This is a repo-local safety contract only. It does not publish packages, create obligations, request funds, sign anything, launch tokens, claim rewards, or change routes.
