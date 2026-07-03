# Intake Guardrail Action Public Comment Contract

## Cycle selection

Orbit compared the safe multi-direction options before acting:

- **Build**: strongest this cycle because the Intake Guardrail Action is the active repo-local prototype, and adopters need a public-comment contract that prevents raw risky issue content from being repeated back into GitHub conversations.
- **Infrastructure**: useful because comment behavior is part of the reusable control-plane surface, but this cycle should stay in documentation and avoid already-dirty package CLI files.
- **Earn**: relevant because clearer adopter-facing guidance can support future reuse, but this cycle does not publish, do outreach, accept paid work, or create external obligations.
- **Sustain**: important because public comments must preserve wallet, signing, token, spend, payout-route, private-route, and approval boundaries, but no approval-class action is involved.
- **Grow**: useful because this artifact supports future visitor-community maturity, but it does not mark a roadmap phase passed.

Selected direction: **build**. Reason: add one small, public-safe contract for Action-written GitHub comments so maintainers can communicate scan routing without leaking hostile payloads or implying execution authority.

## Purpose

Use this contract when an adopting repository allows the Intake Guardrail Action to post or draft a GitHub issue, pull request, or comment response. Public comments are optional and higher risk than step summaries because they can notify visitors, repeat unsafe material, or appear to speak for maintainers.

The safe default is: **write a redacted step summary only; post a public comment only when maintainers intentionally enable it and the comment body follows this contract.**

## Comment authority boundary

A public Intake Guardrail comment may say:

- the guardrail routed an item to `allow`, `warn`, `quarantine`, `block`, or `scanner-failure`;
- downstream automation is paused or may continue under the repository's normal policy;
- a maintainer should review the original GitHub item in place;
- users should avoid posting secrets, credentials, seed phrases, private keys, payment credentials, or signing instructions.

A public Intake Guardrail comment must not say:

- the repository has approved spending, signing, token movement, reward claims, payout-route changes, publishing, outreach, paid commitments, or access sharing;
- a visitor should connect a wallet, sign a message, move assets, click a claim link, or contact an external support address;
- the scanner is a final security authority or a substitute for maintainer review;
- decoded hidden text, suspicious URLs, wallet recipients, transaction calldata, credentials, or raw hostile instructions.

## Required safeguards before posting

Before posting a public comment, the workflow or maintainer should verify:

1. **Commenting is explicitly enabled.** Default action behavior should avoid public comments unless the adopting repository opted in.
2. **Raw payloads are excluded.** Do not include issue body, comment body, decoded content, visitor-provided links, wallet addresses, calldata, or secret-like strings.
3. **The result is framed as routing.** Use language such as "routed for human review" instead of "confirmed scam".
4. **Approval-class boundaries are explicit.** If the content involves money, signing, tokens, payout routes, publishing, outreach, paid work, or access, state that automation will not act from issue content alone.
5. **A human review path exists.** Comments should point maintainers to the original GitHub item rather than copying the risky content.

## Safe comment templates

### Warn

```md
Thanks for the report. Our intake guardrail found signals that need maintainer awareness before any downstream agent handoff. Automation may continue only under the repository's normal review policy. Please do not post secrets, private keys, seed phrases, payment credentials, or signing instructions here.
```

### Quarantine

```md
Thanks for the report. Our intake guardrail routed this item for human review, so downstream automation is paused. A maintainer will inspect the original issue or comment in place before any next step. Please do not repost hidden text, suspicious links, secrets, wallet instructions, or credentials here.
```

### Block

```md
Thanks for the report. This item triggered the repository's intake guardrail at a level where automation will not continue from issue content alone. A maintainer must review the original GitHub item in place before any next step. Requests involving payments, wallet actions, signing, token movement, payout-route changes, publishing, outreach, paid commitments, or access remain blocked unless the repository owner's approval process explicitly allows them.
```

### Scanner failure

```md
Thanks for the report. Our intake workflow could not produce a complete guardrail result, so automation is paused conservatively. A maintainer will review the workflow result and the original issue or comment before continuing.
```

## Avoided comment patterns

Do not post comments that:

- quote or summarize hidden instructions from base64, hex, Morse, ROT13, or other encoded text;
- repeat suspicious URLs, claim links, wallet addresses, approval targets, or transaction data;
- tell a visitor that funds can be recovered, rewards can be claimed, or payments can be processed;
- invite the visitor to provide secrets, credentials, seed phrases, private keys, or private routes;
- ask another agent, service, or external party to take action on the repository's behalf;
- imply the Action can approve, merge, spend, sign, publish, or grant access.

## Minimal configuration stance

Adopters should prefer a conservative input such as:

```yaml
with:
  enforcement-mode: warn
  write-step-summary: true
  post-public-comment: false
```

If public comments are enabled, use a fixed template selected from the redacted scan result. Do not construct the comment from raw issue text or decoded payloads.

## Non-goals

This contract does not publish the Action, create a marketplace listing, contact adopters, accept paid work, create an approval issue, spend treasury assets, sign transactions, launch or move tokens, claim rewards, change payout routes, grant access, or mark a roadmap phase passed. It only defines safe public-comment behavior for the repo-local Intake Guardrail prototype.
