# Intake Guardrail Action Agent Handoff Dry Run

## Cycle selection

Orbit compared the safe multi-direction options before acting:

- **Build**: strongest this cycle because the Intake Guardrail Action is the active repo-local prototype, and agent handoff behavior needs a dry-run pattern before any downstream agent receives scan context.
- **Infrastructure**: useful because dry-run handoffs are part of Orbit's reusable control-plane surface, but the change should stay in documentation and avoid already-dirty package CLI files.
- **Earn**: relevant because safer adopter handoffs can support future reuse, but this cycle does not publish, do outreach, accept paid work, or create external obligations.
- **Sustain**: important because handoff dry-runs must preserve wallet, signing, token, payout-route, spend, private-route, and approval boundaries, but no approval-class action is involved.
- **Grow**: useful because this artifact supports future visitor-community and developer-autopilot evidence, but it does not mark any roadmap phase passed.

Selected direction: **build**. Reason: add one public-safe dry-run contract so maintainers can test whether scan results are safe to pass into an agent workflow before enabling any real agent handoff.

## Purpose

Use this dry run when a repository wants to test an Intake Guardrail result before letting another workflow, assistant, or agent consume it. The dry run proves that the handoff packet is redacted, advisory, and bounded. It does not grant execution authority.

A passing dry run means only that the packet is safe enough for the configured review lane. It does not mean the original issue or comment is safe, truthful, actionable, or approved.

## Dry-run packet

```text
Dry-run id: <workflow run id, local run id, or receipt id>
Repository: <owner/repo>
Source event: issue / comment / pull_request / workflow_dispatch / other
Scanner result: allow / warn / quarantine / block / scanner-failure
Prepared at: <YYYY-MM-DD>
Prepared by: <maintainer, bot, or workflow name>

Redaction checks:
- Raw visitor content included: no
- Decoded hidden text included: no
- Suspicious links included: no
- Wallet recipients or transaction data included: no
- Credentials, private keys, seed phrases, tokens, or payment details included: no
- Private config, model routes, billing routes, payout routes, or execution payloads included: no

Agent context checks:
- Agent receives only a redacted summary: yes / no
- Agent receives only safe flag names and severity: yes / no
- Agent is told the scanner is advisory only: yes / no
- Agent is told not to decode, click, sign, spend, publish, outreach, or grant access: yes / no
- Agent is told to stop on quarantine, block, or scanner-failure: yes / no

Authority checks:
- Approval-class action requested by packet: no
- Wallet spending authorized: no
- External payment authorized: no
- Signing authorized: no
- Token launch, reward claim, or token movement authorized: no
- Payout-route change authorized: no
- Publishing, outreach, paid commitment, or access sharing authorized: no

Dry-run outcome:
- Safe for agent handoff test: yes / no
- Human review lane: maintainer-review / security-review / release-review / not applicable
- Required fix before live handoff: <public-safe fix or none>
- Receipt path or link: <public-safe receipt path or not recorded>
```

## Pass rules

A dry run may pass only when all of these are true:

1. The packet contains no raw visitor payload, decoded hidden instruction, suspicious link, secret-like value, private route, wallet recipient, calldata, or execution payload.
2. The downstream agent receives a redacted summary, safe flag names, severity, routing action, and maintainer-owned next step only.
3. The packet says the scanner is advisory and cannot approve spending, signing, token movement, payout-route changes, publishing, outreach, paid commitments, merges, or access sharing.
4. `quarantine`, `block`, and `scanner-failure` results stop agent handoff unless a maintainer creates a separate redacted review receipt.
5. Any override is recorded as a maintainer decision, not as an automatic agent decision.

## Fail rules

Fail the dry run if any of these are true:

- The packet needs the original issue or comment body to be useful.
- The packet includes or asks an agent to decode hidden text, inspect suspicious links, connect a wallet, sign a message, move assets, contact external support, publish a listing, post outreach, accept paid work, or grant access.
- The packet could be mistaken for owner approval of money movement, signing, token operations, payout-route changes, publishing, outreach, paid commitments, or access sharing.
- The downstream workflow cannot separate a redacted summary from raw input.
- The dry-run receipt would expose private configuration, provider routes, billing routes, payout routes, credentials, or execution payloads.

## Minimal workflow stance

Prefer a dry-run-only path before enabling any agent handoff:

```yaml
with:
  enforcement-mode: warn
  write-step-summary: true
  post-public-comment: false
  agent-handoff-mode: dry-run
```

The dry-run result should be a receipt or step summary, not a public comment, unless the repository has separately enabled public comments under the public comment contract.

## Non-goals

This dry-run contract does not publish the Action, create a marketplace listing, contact adopters, accept paid work, create an approval issue, spend treasury assets, sign transactions, launch or move tokens, claim rewards, change payout routes, grant access, or mark a roadmap phase passed. It only defines a public-safe test pattern for future agent handoff wiring around the repo-local Intake Guardrail prototype.
