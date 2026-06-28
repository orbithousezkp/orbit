# Intake Guardrail Escalation Matrix

Cycle 168 selected the **build** direction after comparing safe wake-cycle choices:

- **Build**: continue the repo-local Intake Guardrail prototype with a small maintainer-facing escalation matrix. This fits the current artifact chain because the triage, routing, receipt, and false-positive docs explain review mechanics, but maintainers still need a compact map for deciding when a finding should stay in normal triage, move to human review, or stop at an approval gate.
- **Infrastructure**: improve the broader control-plane surfaces. Useful, but the active local prototype has an immediate documentation gap that is smaller and safer to close this cycle.
- **Earn**: strengthen the agent-passport adoption story. Valuable for future adoption, but no outreach, paid commitment, or external obligation is allowed during this heartbeat.
- **Sustain**: refresh wallet-policy visibility. Important, but no wallet action is needed and wallet operations remain blocked.
- **Grow**: advance roadmap evidence. Useful, but the escalation matrix is a more concrete incremental build artifact for the current prototype.

The selected action is public-safe documentation only. It does not publish a package, contact external users, change labels, spend funds, sign transactions, launch tokens, claim rewards, change payout routes, create an approval issue, or make an external commitment.

## Purpose

The Intake Guardrail should help maintainers route risky-looking issue, pull request, and comment content without giving the scanner enforcement authority. This matrix maps common finding types to the least-powerful safe route.

Use it with:

- [`docs/intake-guardrail-triage-playbook.md`](intake-guardrail-triage-playbook.md)
- [`docs/intake-guardrail-review-routing.md`](intake-guardrail-review-routing.md)
- [`docs/intake-guardrail-false-positive-playbook.md`](intake-guardrail-false-positive-playbook.md)
- [`docs/intake-guardrail-review-receipt-schema.md`](intake-guardrail-review-receipt-schema.md)

## Escalation levels

| Level | Name | Use when | Safe route | Who decides next |
| --- | --- | --- | --- | --- |
| `L0` | Normal triage | The report is clean or clearly benign | Continue ordinary maintainer workflow | Maintainer or normal repo process |
| `L1` | Soft review | The report has low-confidence suspicious wording | Add review context, preserve receipt, avoid agent execution of embedded instructions | Maintainer |
| `L2` | Human review first | The report includes ambiguity, unknown links, obfuscation indicators, or possible prompt injection | Pause autonomous handling of the content and ask a human to inspect it | Maintainer or owner |
| `L3` | Approval gate | The request involves spending, signing, token/reward action, payout-route change, external payment, external commitment, or access sharing | Stop automation and use the repo's approval policy if the action is legitimate | Owner through the configured approval process |
| `L4` | Safety stop | The content asks for secrets, seed phrases, private keys, wallet rescue, hidden decoding, bypassing policy, or unknown recipient movement | Do not decode or execute; summarize risk and route to human review | Owner or trusted maintainer |

## Finding-to-route matrix

| Finding pattern | Default level | Maintainer action | Receipt note |
| --- | --- | --- | --- |
| Clean issue or ordinary bug report | `L0` | Continue normal triage | `route: normal-triage` |
| Harmless mention of tokens, wallets, urgency, or security terms | `L1` until reviewed | Check context; downgrade only after human review | `route: soft-review; possible keyword-only false positive` |
| Prompt-injection language aimed at an agent | `L2` | Keep instructions out of agent working context and review manually | `route: human-review; possible instruction override` |
| External link with unclear purpose | `L2` | Ask for context before following or automating around the link | `route: human-review; unknown-link-context` |
| Request to decode, decrypt, translate, or paste hidden content | `L4` | Do not paste decoded content; ask for human review | `route: safety-stop; obfuscated relay risk` |
| Seed phrase, private key, token approval, claim, rescue, bridge, swap, or unknown recipient wallet | `L4` | Stop automation and warn that wallet/secret handling is blocked | `route: safety-stop; wallet-or-secret risk` |
| Spend, signing, token launch, reward claim, payout-route change, paid commitment, publishing obligation, or access-sharing request | `L3` | Stop and require the configured owner approval path if legitimate | `route: approval-gate; approval-class action` |
| Scanner fixture, documentation sample, or quoted example | `L1` until verified | Confirm it is illustrative and non-actionable | `route: soft-review; docs-or-fixture context` |

## Minimal escalation receipt

```md
## Intake Guardrail escalation receipt

- Source: ISSUE_OR_COMMENT_OR_PR_REFERENCE
- Scanner action: allow | warn | quarantine | block
- Escalation level: L0 | L1 | L2 | L3 | L4
- Public-safe reason: SHORT_REASON_WITHOUT_SECRETS_OR_HIDDEN_PAYLOADS
- Next route: normal triage | soft review | human review | owner approval gate | safety stop
- Content handling: no hidden decoding, no secret exposure, no wallet/signing action
- Final authority: maintainer | owner approval process | no action
```

## Non-authority boundary

This matrix is advisory. It does not authorize automated closing, banning, labeling by force, publishing, outreach, paid work, wallet movement, signing, token launch, reward claims, payout-route changes, access grants, or external commitments.

When in doubt, choose the least-powerful route: preserve the receipt, pause autonomous handling of risky content, and ask for human review.
