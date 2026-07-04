# Intake Guardrail Action Handoff Receipt

## Cycle selection

Orbit compared the safe multi-direction options before acting:

- **Build**: strongest this cycle because the Intake Guardrail Action is the active repo-local prototype, and the previous dry-run contract needs a small receipt shape so handoff tests leave reviewable evidence.
- **Infrastructure**: useful because a receipt format turns the handoff dry run into a reusable control-plane artifact for adopters and SDK clients later.
- **Earn**: relevant because better handoff evidence can make the guardrail easier to adopt, but this cycle does not publish, do outreach, accept paid work, or create external obligations.
- **Sustain**: important because handoff receipts must preserve wallet, signing, token, payout-route, spend, private-route, and approval boundaries.
- **Grow**: useful because this supports future proof-and-memory and visitor-community evidence, but it does not mark any roadmap phase passed.

Selected direction: **build**. Reason: add one public-safe receipt template that lets maintainers prove an agent handoff dry run happened without exposing raw visitor payloads or granting downstream authority.

## Purpose

Use this receipt after an Intake Guardrail Action handoff dry run. The receipt records what was tested, what was withheld, what the downstream agent may see, and why the handoff did or did not proceed.

A receipt is evidence of a review boundary. It is not proof that the original visitor content is safe, truthful, or approved. It is not owner approval for spending, signing, token movement, publishing, outreach, paid commitments, or access sharing.

## Receipt template

```text
Receipt id: <workflow run id, local run id, or proof id>
Repository: <owner/repo>
Source event: issue / comment / pull_request / workflow_dispatch / other
Scanner result: allow / warn / quarantine / block / scanner-failure
Handoff mode: dry-run / disabled / maintainer-review-only
Created at: <YYYY-MM-DDTHH:MM:SSZ>
Created by: <workflow, maintainer, or bot name>

Redaction summary:
- Raw visitor body withheld: yes / no
- Decoded hidden text withheld: yes / no / not applicable
- Suspicious links withheld: yes / no / not applicable
- Wallet recipients, calldata, or transaction requests withheld: yes / no / not applicable
- Credentials, private keys, seed phrases, tokens, or payment details withheld: yes / no / not applicable
- Private config, provider routes, billing routes, payout routes, and execution payloads withheld: yes / no

Agent-visible packet:
- Result label included: yes / no
- Severity included: yes / no
- Redacted summary included: yes / no
- Safe flag names included: yes / no
- Maintainer-owned next step included: yes / no
- Raw content, decoded text, suspicious links, wallet details, credentials, private routes, or execution payloads included: no

Authority boundary:
- Scanner is advisory only: yes / no
- Approval-class action authorized: no
- Wallet spending authorized: no
- External payment authorized: no
- Signing authorized: no
- Token launch, reward claim, or token movement authorized: no
- Payout-route change authorized: no
- Publishing, outreach, paid commitment, or access sharing authorized: no
- Merge, close, label, or release authority granted by this receipt: no

Outcome:
- Handoff allowed for dry-run test: yes / no
- Required human review lane: none / maintainer-review / security-review / owner-approval-required
- Reason: <public-safe reason>
- Follow-up artifact: <public-safe path, issue, or none>
```

## Safe outcome language

Use short, bounded outcomes that cannot be mistaken for permission to act:

- `allow`: "Redacted packet may be passed to the configured review workflow. Scanner remains advisory."
- `warn`: "Redacted packet may be reviewed by a maintainer before any downstream agent uses it."
- `quarantine`: "Stop handoff. Keep raw content out of agent context. Human review required."
- `block`: "Stop handoff. Treat as unsafe until a maintainer creates a separate redacted review receipt."
- `scanner-failure`: "Stop handoff. Do not infer safety from a failed scan."

## Forbidden receipt content

Never put these in a handoff receipt:

- Raw visitor issue, comment, pull request, or direct-message content.
- Decoded hidden text, encoded instruction payloads, or cipher output.
- Suspicious links, shortened links, wallet recipients, calldata, transaction parameters, or signing prompts.
- Credentials, private keys, seed phrases, tokens, payment details, provider routes, model routes, billing routes, payout routes, or private operational config.
- Any statement that the scanner, receipt, workflow, or downstream agent can approve money movement, signing, token operations, external commitments, publishing, outreach, access sharing, or owner-only decisions.

## Minimal storage stance

Prefer storing the receipt as a step summary, workflow artifact, or proof file with redacted fields only. If public comments are enabled separately, post only a short summary that references the receipt path and does not copy risky content.

## Non-goals

This receipt template does not publish the Action, create a marketplace listing, contact adopters, accept paid work, open an approval issue, spend treasury assets, sign transactions, launch or move tokens, claim rewards, change payout routes, grant access, merge code, close issues, or mark a roadmap phase passed. It only defines a public-safe evidence shape for future dry-run handoff tests around the repo-local Intake Guardrail prototype.
