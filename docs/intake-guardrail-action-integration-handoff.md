# Intake Guardrail Action Integration Handoff

## Cycle selection

This cycle compared the safe multi-direction options before acting:

- **Build**: strongest this cycle because the Intake Guardrail Action is the active repo-local prototype, and maintainers need a compact handoff template before another repo or agent runner consumes scanner results.
- **Infrastructure**: useful because integration handoffs are part of Orbit's reusable control-plane pattern, but the change should stay in documentation and avoid already-dirty package CLI files.
- **Earn**: relevant because cleaner adoption handoffs can support future reuse, but this cycle does not do outreach, marketplace listing, paid work, or external commitments.
- **Sustain**: important because handoff packets must preserve wallet, signing, token, payout-route, spend, and private-route boundaries, but no approval-class action is involved.
- **Grow**: useful because the artifact supports future visitor-community and developer-autopilot evidence, but it does not mark any roadmap phase passed.

Selected direction: **build**. Reason: add one public-safe integration handoff template so maintainers can pass redacted scanner findings to humans or agent workflows without copying raw risky payloads or granting execution authority.

## Purpose

Use this handoff when `packages/issue-scam-scanner` findings need to move from a scan step into maintainer review, issue triage, CI summaries, or a downstream agent workflow. The handoff is a public-safe packet. It is not approval to publish the Action, contact adopters, accept paid work, grant access, spend funds, sign transactions, launch or move tokens, claim rewards, or change payout routes.

## Handoff packet

```text
Repository: <owner/repo>
Source event: issue / comment / pull_request / workflow_dispatch / other
Scanner ref: <version, tag, branch, commit, or local path>
Workflow run: <public run id or not recorded>
Prepared at: <YYYY-MM-DD>
Prepared by: <maintainer, bot, or workflow name>

Result summary:
- Action: allow / warn / quarantine / block / scanner-failure
- Risk flags: <public-safe flag names only>
- Confidence: low / medium / high / not available
- Public-safe reason: <short summary without raw risky text>
- Raw risky payload included: no
- Decoded or translated hidden content included: no
- Secret-like values included: no
- Wallet recipient or private route included: no

Routing:
- Human review lane: maintainer-review / security-review / agent-handoff-review / release-review
- Agent handoff allowed: yes / no / not applicable
- If agent handoff allowed, payload form: redacted-summary-only / fixture-id-only / not applicable
- If quarantine or block, agent receives raw content: no
- Override required before continuation: yes / no
- Rollback path known: yes / no

Authority boundary:
- Approval-class action involved: none
- Wallet spending involved: no
- External payment involved: no
- Signing involved: no
- Token launch, reward claim, or token movement involved: no
- Payout-route change involved: no
- External outreach or paid commitment involved: no
- Access sharing involved: no

Follow-up:
- Decision: continue / hold for human review / rollback / needs safer summary
- Next local repo task: <public-safe next step>
- Notes: <public-safe notes>
```

## Safe downstream use

A downstream workflow or agent may use this packet to:

- Decide whether a human review lane is required.
- Stop agent processing when the result is `quarantine`, `block`, or `scanner-failure`.
- Create a redacted CI summary or maintainer checklist.
- Link to safe docs, fixture ids, workflow run ids, or prior adoption receipts.
- Record that no approval-class authority was granted by the scanner result.

## Forbidden downstream use

A downstream workflow or agent must not use this packet to:

- Treat scanner output as approval for spending, signing, token movement, reward claims, payout-route changes, publishing, outreach, paid commitments, or access sharing.
- Copy raw hostile issue text, decoded hidden content, suspicious links, private config, credentials, wallet details, provider routes, payout routes, billing details, or execution payloads into public output.
- Pass quarantined or blocked raw content into an autonomous agent context.
- Override maintainer review without a redacted human-owned receipt.
- Replace configured repository policy, owner approval requirements, or wallet recipients.

## Handoff hold rules

Hold the handoff if any of these are true:

- The packet needs raw issue/comment content to be useful.
- The scanner result is ambiguous and would let an agent continue without human review.
- The recipient workflow cannot separate redacted summaries from raw input.
- The packet includes secret-looking values, live wallet details, private routes, or decoded hidden instructions.
- The handoff implies that Orbit approved publishing, outreach, paid work, access sharing, spend, signing, token movement, reward claims, or payout-route changes.

## Non-goals

This handoff does not publish the Action, create a marketplace listing, contact adopters, accept paid work, create an approval issue, spend treasury assets, sign transactions, launch or move tokens, claim rewards, change payout routes, grant access, or mark a roadmap phase passed. It only defines a public-safe integration packet for the repo-local Intake Guardrail prototype.
