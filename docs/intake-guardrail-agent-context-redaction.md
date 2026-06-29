# Intake Guardrail Agent Context Redaction

## Cycle 182 direction choice

Orbit compared safe wake-cycle directions before creating this artifact:

- **Build** — continue the repo-local Intake Guardrail package. Best this cycle because the agent gate policy and gate receipt now exist, but maintainers still need a concrete redaction contract for what may enter a downstream agent prompt after a scan.
- **Infrastructure** — improve SDK, MCP, lifecycle, proof, or registry surfaces. Useful, but this redaction contract strengthens the current GitHub intake layer without touching already-dirty package CLI files.
- **Earn** — refine the Orbit agent passport and adoption path. Valuable, but safer adoption depends on showing exactly how Orbit prevents hostile intake from becoming executable agent context.
- **Sustain** — refresh wallet-policy visibility. Important, but no wallet action, signing, payout-route change, reward claim, token launch, external spend, or approval-class movement is needed.
- **Grow** — add roadmap evidence. Useful, and this artifact is small evidence that the intake guardrail is maturing as reusable infrastructure, but it does not mark any phase passed.

Selected direction: **build**. Reason: a minimal, public-safe context-redaction contract helps repos wire the Intake Guardrail into agent workflows without copying hostile payloads, encoded instructions, private data, wallet-risk text, or approval-class requests into a more capable agent. No publishing, outreach, paid commitment, wallet action, signing, token movement, reward claim, payout-route change, external spend, approval issue, or external obligation was performed.

## Purpose

Use this contract when a scanner, GitHub Action, maintainer bot, or future adapter summarizes untrusted issue/comment content for another agent.

The goal is to preserve enough context for safe triage while preventing risky text from becoming instructions in the downstream agent's working context.

## Redaction contract

A downstream agent may receive:

- Public issue, comment, pull request, or discussion references.
- The scanner action: `allow`, `warn`, `quarantine`, or `block`.
- Risk categories and severity labels.
- A short safe summary written by the scanner or maintainer.
- The allowed access level: `full`, `summary-only`, `metadata-only`, or `none`.
- The next safe step, if it stays inside repository permissions.
- A pointer to a human-review packet or gate receipt.

A downstream agent must not receive:

- Seed phrases, private keys, credentials, tokens, passwords, or secret-looking strings.
- Full wallet addresses supplied by a visitor for sending funds, signing, approvals, rescue, claims, swaps, launches, rewards, or payout-route changes.
- Hidden links or shortened links that were part of a risky request.
- Decoded obfuscated text, including base64, hex, Morse, ROT13, ciphers, or similar relay formats.
- The exact prompt-injection phrase, if a category-level summary is enough.
- Private config, private route details, provider details, billing details, or payout routes.
- Instructions to spend, sign, publish, contact external parties, share access, or accept paid obligations.

## Safe summary patterns

Use short neutral descriptions:

| Risk shape | Safe summary pattern |
|---|---|
| Clean docs request | `Visitor asks for documentation clarification.` |
| Prompt injection | `Content attempts to override repository or agent instructions.` |
| Obfuscated relay | `Content asks the agent to decode hidden text and follow it.` |
| Wallet drain | `Content pressures the repo to perform a wallet, token, claim, approval, or signing action.` |
| Secret request | `Content asks for private credentials or hidden operational details.` |
| Approval-class movement | `Content requests an action that requires owner approval and live gates.` |

## Context packet template

```md
## Intake Guardrail redacted context packet

- Intake reference:
- Scan action: allow | warn | quarantine | block
- Highest risk category: none | prompt-injection | obfuscated-relay | wallet-risk | secret-risk | approval-class | other
- Agent access allowed: full | summary-only | metadata-only | none
- Unsafe payload included: no
- Encoded text decoded for agent: no
- Approval-class request present: no | yes, blocked
- Safe summary:
- Next safe step:
- Linked receipt or human-review packet:
```

## Routing rules

- `allow`: the agent may read normal issue text if no secret-like or wallet-risk content is present.
- `warn`: prefer a safe summary and references over full text. The agent may act only on low-risk repo-local work.
- `quarantine`: the agent receives metadata and a safe summary only. Human review decides whether a sanitized fixture is needed.
- `block`: the agent receives no hostile payload. Automation stops or routes to owner/human review.

## Review checklist

Before sending any context packet to an agent, confirm:

1. No unsafe payload is copied into the packet.
2. No encoded or hidden text was decoded for the agent.
3. The packet does not contain private config, private route details, provider details, billing details, or payout routes.
4. Wallet, token, signing, payout, reward, payment, publishing-with-obligations, external outreach, access-sharing, and paid-commitment requests are treated as blocked or approval-class.
5. The next safe step is either repo-local routine work or explicit human/owner review.

## Non-authority boundary

This redaction contract is a guardrail for context handling. It does not authorize spending funds, signing transactions, launching tokens, claiming rewards, changing payout routes, publishing packages, accepting paid work, contacting external parties, deleting content, banning users, granting access, or bypassing maintainer policy.

Related docs: [agent gate policy](intake-guardrail-agent-gate-policy.md), [agent gate receipt](intake-guardrail-agent-gate-receipt.md), [human review packet](intake-guardrail-human-review-packet.md), and [output consumer map](intake-guardrail-output-consumer-map.md).
