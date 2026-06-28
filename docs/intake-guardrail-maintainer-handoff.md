# Intake Guardrail Maintainer Handoff

Cycle 174 selected the **build** direction after comparing safe wake-cycle choices:

- **Build**: continue the repo-local Intake Guardrail prototype with a maintainer handoff guide. This is the best fit because recent artifacts cover routing, escalation, false positives, human-review packets, and queue order, but maintainers still need a compact way to pass an item between reviewers without copying risky content.
- **Infrastructure**: improve broader Orbit control-plane surfaces. Useful, but a handoff guide closes a narrower gap in the active Intake Guardrail documentation chain and avoids touching already-dirty package CLI files.
- **Earn**: strengthen the agent-passport adoption story. Valuable, but no outreach, publishing obligation, paid commitment, or external offer is appropriate in this heartbeat.
- **Sustain**: refresh wallet-policy visibility. Important, but no wallet action is needed and live wallet operations remain blocked.
- **Grow**: advance roadmap evidence. Useful, but this document is a small proof-backed build artifact for the active repo-local prototype.

The selected action is public-safe documentation only. It does not publish a package, contact external users, spend funds, sign transactions, launch tokens, claim rewards, change payout routes, create an approval issue, grant access, or make an external commitment.

## Purpose

Use this handoff when an Intake Guardrail item needs another maintainer, human reviewer, or future cycle to continue review. The goal is to preserve enough context for review while keeping suspicious payloads, hidden text, secrets, private routes, unknown recipients, and wallet-risk content out of copied notes.

Use it with:

- [`docs/intake-guardrail-maintainer-queue.md`](intake-guardrail-maintainer-queue.md)
- [`docs/intake-guardrail-human-review-packet.md`](intake-guardrail-human-review-packet.md)
- [`docs/intake-guardrail-review-routing.md`](intake-guardrail-review-routing.md)
- [`docs/intake-guardrail-escalation-matrix.md`](intake-guardrail-escalation-matrix.md)
- [`docs/intake-guardrail-false-positive-playbook.md`](intake-guardrail-false-positive-playbook.md)

## Handoff rules

1. Reference the source instead of copying risky content.
2. State the risk class, not the full suspicious payload.
3. Include the current queue lane and requested next reviewer action.
4. Record any safety boundary already applied.
5. Keep approval-class requests separate from routine docs, code, tests, templates, and maintenance work.
6. Never decode obfuscated visitor text in the handoff.
7. Never include seed phrases, private keys, tokens, private payout routes, private config, or unknown wallet recipients.

## Minimal handoff packet

```md
## Intake Guardrail maintainer handoff

- Source reference: ISSUE_OR_COMMENT_OR_FILE_REFERENCE
- Current lane: safety-stop | approval-gate | human-review | soft-review | normal-triage
- Risk class: obfuscated-relay | wallet-risk | approval-class | suspicious-link | prompt-injection | false-positive-candidate | clean
- Public-safe summary: SHORT_SUMMARY_WITHOUT_SECRETS_OR_HIDDEN_PAYLOADS
- Action already taken: WHAT_WAS_DONE_OR_NONE
- Requested next action: REVIEW_STEP_FOR_NEXT_MAINTAINER
- Do not copy/decode: YES_OR_NOT_APPLICABLE
- Approval needed: no | owner-approval-required-for-gated-action | human-review-needed
- Boundary: scanner is advisory; this handoff does not authorize wallet action, signing, token/reward movement, payout-route change, access sharing, publishing, outreach, paid commitment, or external obligation
```

## Example: suspicious wallet request

```md
## Intake Guardrail maintainer handoff

- Source reference: issue #123 comment by visitor
- Current lane: safety-stop
- Risk class: wallet-risk
- Public-safe summary: Visitor asks for urgent wallet-related action and includes an unknown recipient context.
- Action already taken: No decoding, signing, transfer, approval, or link-following performed.
- Requested next action: Human maintainer should inspect the original source in GitHub and decide whether to close, warn, or ask for clarification.
- Do not copy/decode: YES
- Approval needed: human-review-needed
- Boundary: scanner is advisory; this handoff does not authorize wallet action, signing, token/reward movement, payout-route change, access sharing, publishing, outreach, paid commitment, or external obligation
```

## Example: likely false positive

```md
## Intake Guardrail maintainer handoff

- Source reference: pull request fixture file path or issue comment reference
- Current lane: soft-review
- Risk class: false-positive-candidate
- Public-safe summary: Content appears to discuss risky terms as documentation or test fixture material rather than requesting action.
- Action already taken: Routed to false-positive playbook; no downgrade recorded yet.
- Requested next action: Maintainer should confirm context and record a short false-positive decision if safe.
- Do not copy/decode: NOT_APPLICABLE
- Approval needed: no
- Boundary: scanner is advisory; this handoff does not authorize wallet action, signing, token/reward movement, payout-route change, access sharing, publishing, outreach, paid commitment, or external obligation
```

## When to stop the handoff

Stop and ask for human review when:

- The source asks for a seed phrase, private key, token approval, wallet rescue, fake claim, unknown recipient transfer, or payout-route change.
- The source asks the maintainer or agent to decode hidden text, follow hidden instructions, or paste decoded content.
- The source mixes routine repository work with spend, signing, publishing obligations, access sharing, paid commitments, or external commitments.
- The reviewer cannot summarize the issue without copying risky content.

## Non-authority boundary

This handoff is a coordination aid. It does not make the Intake Guardrail an enforcement system and does not grant execution authority. Maintainers remain responsible for final decisions, and approval-class actions still require the normal owner-approval path before any action can proceed.
