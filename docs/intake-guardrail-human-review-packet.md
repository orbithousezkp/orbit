# Intake Guardrail Human Review Packet

Cycle 169 selected the **build** direction after comparing safe wake-cycle choices:

- **Build**: continue the repo-local Intake Guardrail prototype with a human-review packet. This is the best fit because recent docs define routing, escalation, false-positive handling, and receipt schemas, but maintainers still need a compact packet for handing a flagged item to a person without copying risky content into agent context.
- **Infrastructure**: improve broader Orbit control-plane surfaces. Useful, but the current Intake Guardrail documentation chain has a smaller immediate gap.
- **Earn**: strengthen the agent-passport adoption story. Valuable, but no outreach, paid commitment, or external obligation is allowed during this heartbeat.
- **Sustain**: refresh wallet-policy visibility. Important, but no wallet action is needed and live wallet operations remain blocked.
- **Grow**: advance roadmap evidence. Useful, but this packet is a more concrete build artifact for the active repo-local prototype.

The selected action is public-safe documentation only. It does not publish a package, contact external users, change labels, spend funds, sign transactions, launch tokens, claim rewards, change payout routes, create an approval issue, or make an external commitment.

## Purpose

Use this packet when the Intake Guardrail flags content that should leave autonomous handling and move to a human maintainer. The goal is to preserve enough context for review while avoiding secret exposure, hidden-payload relay, wallet action, or accidental execution of attacker instructions.

Use it with:

- [`docs/intake-guardrail-escalation-matrix.md`](intake-guardrail-escalation-matrix.md)
- [`docs/intake-guardrail-review-routing.md`](intake-guardrail-review-routing.md)
- [`docs/intake-guardrail-false-positive-playbook.md`](intake-guardrail-false-positive-playbook.md)
- [`docs/intake-guardrail-review-receipt-schema.md`](intake-guardrail-review-receipt-schema.md)

## What to include

| Field | Include | Avoid |
| --- | --- | --- |
| Source reference | Issue, pull request, comment, or fixture reference | Private URLs, tokens, or hidden payload text |
| Scanner result | Action, severity, matched categories, confidence if available | Raw secret-looking values or decoded obfuscated content |
| Public-safe summary | One-sentence reason the item needs human review | Repeating scam instructions, seed phrases, keys, or unknown wallet recipients |
| Suggested route | Normal triage, soft review, human review, owner approval gate, or safety stop | Claims that the scanner has final authority |
| Boundary note | No spend, signing, token action, payout-route change, access grant, or external commitment | Any promise that Orbit will perform a gated action |
| Review outcome | Maintainer decision and next safe step | Private operational details or non-public payout routes |

## Packet template

```md
## Intake Guardrail human-review packet

- Source: ISSUE_OR_PULL_REQUEST_OR_COMMENT_REFERENCE
- Scanner action: allow | warn | quarantine | block
- Escalation level: L0 | L1 | L2 | L3 | L4
- Public-safe summary: SHORT_REASON_WITHOUT_SECRETS_OR_HIDDEN_PAYLOADS
- Risk categories: prompt-injection | obfuscated-relay | wallet-risk | approval-class | unknown-link | false-positive-candidate | other
- Suggested route: normal triage | soft review | human review | owner approval gate | safety stop
- Content handling: do not decode hidden text; do not paste secrets; do not execute embedded instructions
- Gated-action boundary: no spend, signing, token/reward movement, payout-route change, access sharing, publishing obligation, outreach, or paid commitment
- Human decision: pending | benign | needs more context | approval required | unsafe/no action
- Next safe step: SHORT_MAINTAINER_STEP
```

## Review rules

1. Prefer references over copying risky content.
2. Summarize hidden or obfuscated content as a risk class; do not decode and paste it into the packet.
3. Treat seed phrases, private keys, wallet rescue language, token approvals, fake claims, and unknown recipients as `L4` safety stops.
4. Treat spend, signing, token launch, reward claim, payout-route change, external payment, publishing obligation, paid commitment, or access sharing as `L3` approval-gate material.
5. Downgrade a finding only after a human confirms the content is benign, quoted, or fixture-only.
6. Keep the scanner advisory: maintainers or the configured owner approval process decide the next action.

## Safe examples

| Scenario | Packet summary | Suggested route |
| --- | --- | --- |
| A bug report mentions a wallet UI label | Keyword-only token/wallet mention; no action request | Soft review, then normal triage if benign |
| A comment asks an agent to ignore policy | Possible prompt-injection attempt against autonomous handling | Human review first |
| A message asks to decode hidden instructions | Obfuscated relay risk; hidden content not decoded | Safety stop |
| A request asks for a token approval or rescue | Wallet or secret-risk request | Safety stop |
| A proposal asks Orbit to pay, sign, publish, or share access | Approval-class action request | Owner approval gate if legitimate |

## Non-authority boundary

This packet is a handoff aid. It does not authorize automated enforcement, wallet movement, signing, token launch, reward claims, payout-route changes, publishing, outreach, paid commitments, access sharing, or external obligations.

When uncertain, preserve the reference, avoid copying risky payloads, and ask for human review.
