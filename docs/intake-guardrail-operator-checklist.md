# Intake Guardrail Operator Checklist

Cycle 175 selected the **build** direction after comparing safe wake-cycle choices:

- **Build**: add a compact operator checklist for the repo-local Intake Guardrail prototype. This is the best fit because recent docs cover routing, escalation, false positives, queueing, and handoff, but an operator still needs a single pre-run / run / post-run checklist that keeps the scanner advisory and avoids copying risky payloads.
- **Infrastructure**: improve broader Orbit control-plane surfaces. Useful, but the checklist closes a concrete gap in the active guardrail documentation chain without touching already-dirty package CLI files.
- **Earn**: strengthen the agent-passport adoption story. Valuable, but this heartbeat should not publish, outreach, or create external commitments.
- **Sustain**: refresh wallet-policy visibility. Important, but no wallet action is needed and live wallet operations remain blocked.
- **Grow**: add roadmap evidence. Useful, but this artifact is itself proof-backed evidence for the active repo-local prototype.

The selected action is public-safe documentation only. It does not publish a package, contact external users, spend funds, sign transactions, launch tokens, claim rewards, change payout routes, create an approval issue, grant access, or make an external commitment.

## Purpose

Use this checklist when a maintainer, action operator, or future Orbit cycle runs the Intake Guardrail on issue, comment, or fixture text. The checklist keeps the guardrail useful while preserving the boundary that it is advisory, public-safe, and not an execution authority.

Related docs:

- [`docs/intake-guardrail-review-routing.md`](intake-guardrail-review-routing.md)
- [`docs/intake-guardrail-maintainer-queue.md`](intake-guardrail-maintainer-queue.md)
- [`docs/intake-guardrail-maintainer-handoff.md`](intake-guardrail-maintainer-handoff.md)
- [`docs/intake-guardrail-human-review-packet.md`](intake-guardrail-human-review-packet.md)
- [`docs/intake-guardrail-false-positive-playbook.md`](intake-guardrail-false-positive-playbook.md)

## Pre-run checklist

- [ ] Confirm the source is a repository intake item, fixture, or maintainer-provided sample.
- [ ] Do not paste seed phrases, private keys, tokens, private routes, private config, or unknown wallet recipients into the scanner.
- [ ] If the source contains obfuscated text, do not decode it; reference the source and route to human review.
- [ ] If the source requests signing, spending, token movement, reward claims, payout-route changes, access sharing, publishing, outreach, or paid commitments, treat it as approval-class or safety-stop content.
- [ ] Keep raw suspicious content in the original GitHub source where possible; summarize risk classes in notes.

## Run checklist

- [ ] Run only the configured local package, action, or fixture path; do not fetch hidden links or external payloads to enrich the scan.
- [ ] Record the scan surface: issue, comment, pull request, fixture, or local text sample.
- [ ] Record the finding class: clean, prompt-injection, obfuscated-relay, wallet-risk, suspicious-link, approval-class, false-positive-candidate, or unknown.
- [ ] Treat scanner output as a triage hint, not a final maintainer decision.
- [ ] If output is ambiguous, route to the human-review packet instead of downgrading the finding.

## Post-run checklist

- [ ] Choose the next lane from the maintainer queue: safety-stop, approval-gate, human-review, soft-review, or normal-triage.
- [ ] Write a public-safe receipt that references the source without copying risky payloads.
- [ ] If a false positive is likely, use the false-positive playbook and preserve the original safety boundary until a maintainer confirms context.
- [ ] If another reviewer must continue, create a maintainer handoff packet.
- [ ] Do not mark any approval-class request as approved from scanner output.

## Public-safe receipt template

```md
## Intake Guardrail operator receipt

- Source reference: ISSUE_OR_COMMENT_OR_FIXTURE_REFERENCE
- Scan surface: issue | comment | pull-request | fixture | local-sample
- Finding class: clean | prompt-injection | obfuscated-relay | wallet-risk | suspicious-link | approval-class | false-positive-candidate | unknown
- Queue lane: safety-stop | approval-gate | human-review | soft-review | normal-triage
- Public-safe summary: SHORT_SUMMARY_WITHOUT_SECRETS_OR_HIDDEN_PAYLOADS
- Next action: MAINTAINER_OR_HUMAN_REVIEW_STEP
- Payload copied: no
- Boundary: advisory only; no wallet action, signing, token/reward movement, payout-route change, access sharing, publishing, outreach, paid commitment, or external obligation authorized
```

## Stop conditions

Stop and ask for human review when:

- The item contains secret-looking material, seed phrases, private keys, recovery words, tokens, private config, or private route details.
- The item asks for urgent wallet rescue, token approvals, fake claims, transfers, reward claims, payout-route changes, or unknown recipient actions.
- The item asks the agent or maintainer to decode, decrypt, translate, or paste hidden content.
- The scanner result depends on following an external link, opening an attachment, or trusting a visitor-provided destination.
- The operator cannot summarize the risk without copying the suspicious payload.

## Non-authority boundary

The Intake Guardrail helps maintainers route intake safely. It does not close issues, approve actions, sign transactions, send funds, publish packages, grant access, contact external parties, accept obligations, or override owner approval. Human maintainers and Orbit's approval gates remain the authority for final decisions.
