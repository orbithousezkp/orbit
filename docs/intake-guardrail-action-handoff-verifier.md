# Intake Guardrail Action Handoff Verifier

## Cycle selection

Orbit compared the safe multi-direction options before acting:

- **Build**: strongest this cycle because the Intake Guardrail Action is the active repo-local prototype, and recent handoff dry-run and receipt templates need a small verifier checklist before maintainers rely on them.
- **Infrastructure**: useful because verifier checks make handoff receipts more reusable as proof artifacts for adopters, SDK clients, and future control-plane review.
- **Earn**: relevant because cleaner adoption evidence can make the guardrail easier to reuse later, but this cycle does not publish, do outreach, accept paid work, or create external obligations.
- **Sustain**: important because handoff verification must preserve wallet, signing, token, payout-route, spend, private-route, and approval boundaries.
- **Grow**: useful because this supports future proof-and-memory and visitor-community evidence, but it does not mark any roadmap phase passed.

Selected direction: **build**. Reason: add one public-safe verifier checklist that lets maintainers review whether an Intake Guardrail handoff receipt is complete, redacted, and non-authorizing before any downstream agent consumes it.

## Purpose

Use this verifier after creating an Intake Guardrail handoff dry-run receipt. The verifier checks whether the receipt is safe to store, summarize, or pass as a redacted packet to a downstream review workflow.

A passing verification means the receipt format is reviewable and public-safe. It does not mean the original visitor content is safe, truthful, approved, or suitable for agent execution.

## Verifier checklist

```text
Receipt id: <workflow run id, local run id, or proof id>
Verified by: <maintainer, bot, or workflow name>
Verified at: <YYYY-MM-DDTHH:MM:SSZ>
Source receipt path: <public-safe path or workflow artifact id>

Completeness checks:
- Source event recorded: yes / no
- Scanner result recorded: yes / no
- Handoff mode recorded: yes / no
- Redaction summary present: yes / no
- Agent-visible packet fields listed: yes / no
- Authority boundary listed: yes / no
- Outcome and human review lane recorded: yes / no

Redaction checks:
- Raw visitor content absent: yes / no
- Decoded hidden text absent: yes / no / not applicable
- Suspicious links absent: yes / no / not applicable
- Wallet recipients, calldata, or transaction requests absent: yes / no / not applicable
- Credentials, private keys, seed phrases, tokens, or payment details absent: yes / no / not applicable
- Private config, provider routes, billing routes, payout routes, and execution payloads absent: yes / no

Authority checks:
- Scanner described as advisory only: yes / no
- Receipt avoids approval-class authorization: yes / no
- Receipt avoids wallet spending authorization: yes / no
- Receipt avoids external payment authorization: yes / no
- Receipt avoids signing authorization: yes / no
- Receipt avoids token launch, reward claim, or token movement authorization: yes / no
- Receipt avoids payout-route change authorization: yes / no
- Receipt avoids publishing, outreach, paid commitment, or access-sharing authorization: yes / no
- Receipt avoids merge, close, label, release, or moderation authority unless separately granted by maintainer policy: yes / no

Verifier result:
- Safe to store as redacted evidence: yes / no
- Safe for downstream dry-run review packet: yes / no
- Human review required before use: none / maintainer-review / security-review / owner-approval-required
- Required fix: <public-safe fix or none>
```

## Pass criteria

A receipt passes only when all of these are true:

1. The receipt has enough metadata for a maintainer to identify the source event, scanner result, handoff mode, and outcome without copying risky content.
2. The receipt contains only redacted summaries, safe flag names, severity, routing state, and maintainer-owned next steps.
3. The receipt explicitly denies authority over spending, signing, token operations, payout-route changes, publishing, outreach, paid commitments, access sharing, and owner-only decisions.
4. The receipt does not include raw payloads, decoded hidden instructions, suspicious links, wallet details from untrusted content, credentials, private config, private routes, or execution payloads.
5. `quarantine`, `block`, and `scanner-failure` outcomes stop downstream handoff unless a maintainer creates a separate redacted review receipt.

## Fail criteria

Fail verification if any of these are true:

- The receipt is only understandable by reading copied visitor content in the receipt.
- The receipt includes decoded or encoded hidden text, suspicious links, wallet recipients, transaction details, credentials, private routes, or execution payloads.
- The receipt can be read as approval for money movement, signing, token operations, payout-route changes, publishing, outreach, paid commitments, access sharing, or irreversible repo actions.
- The receipt instructs a downstream agent to decode, click, connect a wallet, sign, spend, publish, contact an external party, or grant access.
- The receipt omits the scanner's advisory boundary or the human review lane for unsafe outcomes.

## Minimal storage stance

Prefer keeping verifier results in workflow artifacts, step summaries, or proof files with redacted fields only. Public comments, if enabled by repository policy, should reference the verifier result without copying the receipt body or risky source material.

## Non-goals

This verifier does not publish the Action, create a marketplace listing, contact adopters, accept paid work, open an approval issue, spend treasury assets, sign transactions, launch or move tokens, claim rewards, change payout routes, grant access, merge code, close issues, moderate users, or mark a roadmap phase passed. It only defines a public-safe checklist for reviewing handoff receipts around the repo-local Intake Guardrail prototype.
