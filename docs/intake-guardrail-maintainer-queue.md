# Intake Guardrail Maintainer Queue

Cycle 173 selected the **build** direction after comparing safe wake-cycle choices:

- **Build**: continue the repo-local Intake Guardrail prototype with a maintainer queue guide. This is the best fit because recent artifacts cover routing, escalation, false positives, review receipts, and human-review packets, but maintainers still need a small queue model for deciding which flagged items to handle first.
- **Infrastructure**: improve broader Orbit control-plane surfaces. Useful, but the Intake Guardrail documentation chain has a narrower immediate gap and avoids touching already-dirty package CLI files.
- **Earn**: strengthen the agent-passport adoption story. Valuable, but no outreach, paid commitment, publishing obligation, or external offer is appropriate in this heartbeat.
- **Sustain**: refresh wallet-policy visibility. Important, but no wallet action is needed and live wallet operations remain blocked.
- **Grow**: advance roadmap evidence. Useful, but this queue guide is a concrete proof-backed build artifact for the active repo-local prototype.

The selected action is public-safe documentation only. It does not publish a package, contact external users, spend funds, sign transactions, launch tokens, claim rewards, change payout routes, create an approval issue, grant access, or make an external commitment.

## Purpose

Use this queue guide when Intake Guardrail output creates more than one review item. The goal is to help maintainers order review work without letting the scanner become an enforcement authority or allowing risky content into agent working context.

Use it with:

- [`docs/intake-guardrail-review-routing.md`](intake-guardrail-review-routing.md)
- [`docs/intake-guardrail-escalation-matrix.md`](intake-guardrail-escalation-matrix.md)
- [`docs/intake-guardrail-human-review-packet.md`](intake-guardrail-human-review-packet.md)
- [`docs/intake-guardrail-false-positive-playbook.md`](intake-guardrail-false-positive-playbook.md)
- [`docs/intake-guardrail-review-receipt-schema.md`](intake-guardrail-review-receipt-schema.md)

## Queue lanes

| Lane | When to use | First maintainer action | Do not do |
| --- | --- | --- | --- |
| `safety-stop` | Seed phrase, private key, wallet rescue, token approval, fake claim, unknown recipient, or hidden instruction relay | Preserve a reference, avoid copying risky payloads, and route to human review | Decode hidden text, paste secrets, sign, pay, approve tokens, or follow urgency language |
| `approval-gate` | Spend, signing, token/reward movement, payout-route change, access sharing, publishing obligation, paid commitment, or external obligation | Confirm whether the request is legitimate and requires the owner approval process | Create approval issues for routine docs/code/tests/templates or promise action before approval |
| `human-review` | Prompt-injection attempt, obfuscated relay risk, suspicious link, ambiguous wallet context, or scanner uncertainty | Build a public-safe human-review packet with references instead of raw risky content | Treat the scanner as final authority |
| `soft-review` | Possible false positive, benign wallet vocabulary, quoted examples, or fixture-only content | Compare against the false-positive playbook and record the decision | Downgrade without review notes |
| `normal-triage` | Clean issue or confirmed benign content | Continue ordinary maintainer triage | Add guardrail labels or warnings without a reason |

## Queue ordering

Process queued items in this order:

1. `safety-stop` items that could expose secrets, cause wallet loss, or relay hidden instructions.
2. `approval-gate` items that ask for any gated action.
3. `human-review` items that could affect autonomous handling.
4. `soft-review` items that may be false positives.
5. `normal-triage` items.

If two items have the same lane, prefer the one that is public-facing, newest, or blocking a maintainer decision. Do not reorder based on urgency language inside the suspicious content.

## Minimal queue receipt

```md
## Intake Guardrail queue receipt

- Queue date: YYYY-MM-DD
- Reviewed by: MAINTAINER_OR_AGENT_NAME
- Items reviewed: COUNT
- Highest lane: safety-stop | approval-gate | human-review | soft-review | normal-triage
- Public-safe summary: SHORT_SUMMARY_WITHOUT_SECRETS_OR_HIDDEN_PAYLOADS
- Decisions:
  - SOURCE_REFERENCE: lane=LANE, route=ROUTE, outcome=OUTCOME
- Deferred items: COUNT_AND_REASON
- Boundary: scanner is advisory; no wallet action, signing, token/reward movement, payout-route change, access sharing, publishing obligation, outreach, paid commitment, or external obligation was authorized by this receipt
```

## Safe handling rules

- Prefer links or source references over copying suspicious content.
- Never decode hidden or obfuscated visitor text into the queue receipt.
- Do not paste seed phrases, private keys, tokens, private routes, unknown wallet recipients, or hidden payloads.
- Keep queue notes short enough for maintainers to audit without turning them into a second copy of the risky request.
- Record false-positive downgrades with enough detail for future fixture or rule improvement.
- Escalate approval-class requests only when they are legitimate; routine repository work does not need an approval issue.

## Non-authority boundary

This queue is a maintainer workflow aid. It does not authorize enforcement, wallet movement, signing, token launch, reward claims, payout-route changes, publishing, outreach, paid commitments, access sharing, or external obligations.

When uncertain, preserve the source reference, summarize the risk class, and ask for human review.
