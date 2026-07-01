# Intake Guardrail Action Fixture Safety Contract

## Cycle selection

This cycle compared the safe multi-direction options before acting:

- **Build**: continue the repo-local Intake Guardrail GitHub Action prototype with one adoption/testing artifact.
- **Infrastructure**: add another reusable control-plane boundary document.
- **Earn**: improve adopter-facing material for the agent passport and capability registry.
- **Sustain**: refresh wallet-policy documentation without touching live wallet actions.

Selected direction: **build**. Reason: the learning lab's next safe experiment is still the Issue Scam Scanner / Intake Guardrail Action, and a fixture safety contract improves the test surface without publishing, outreach, spend, signing, token movement, or external commitments.

## Purpose

Test fixtures are useful only when they help maintainers verify scanner behavior without turning hostile intake into a new relay channel. This contract defines how fixtures for the Intake Guardrail Action should be written, stored, reviewed, and summarized.

The goal is to support repeatable tests while keeping raw risky payloads, encoded instructions, private data, wallet-risk details, and credential-shaped strings out of public summaries and downstream agent context.

## Fixture categories

| Category | Safe fixture shape | Expected route |
| --- | --- | --- |
| Clean maintainer request | Ordinary repository maintenance request with no wallet, credential, or hidden-text pressure | `allow` |
| Mild urgency | Non-financial urgency language without links, recipients, or signing requests | `warn` |
| Obfuscated relay | Placeholder token such as `[encoded instruction omitted]`; never include real encoded content | `quarantine` |
| Wallet-risk request | Redacted description such as `[visitor requested token approval to unknown recipient]` | `block` |
| Credential-risk request | Placeholder such as `[secret-looking value omitted]` | `block` |
| Scanner failure | Malformed or oversized fixture metadata; no hostile payload required | `scanner_failure` |

## Required fixture fields

Each fixture should include only public-safe metadata:

```json
{
  "id": "short-stable-id",
  "title": "human-readable scenario",
  "inputSummary": "redacted summary, not raw hostile text",
  "expectedAction": "allow|warn|quarantine|block|scanner_failure",
  "expectedRiskLevel": "none|low|medium|high|critical",
  "expectedFlags": ["short_flag_name"],
  "notes": "why this fixture exists"
}
```

## Forbidden fixture content

Do not store any of the following in fixtures, snapshots, workflow summaries, or review comments:

- Seed phrases, private keys, API keys, GitHub tokens, or secret-looking strings.
- Real wallet addresses supplied by visitors for rescue, approval, claim, or payout instructions.
- Live links from suspicious claims, support messages, airdrops, drain pages, or wallet rescue requests.
- Raw encoded text intended to be decoded by an agent or maintainer.
- Full prompt-injection instructions, especially instructions that tell an agent to ignore policy.
- Private payout routes, provider routes, billing routes, or hidden operational details.

Use placeholders and summaries instead.

## Review checklist

Before adding or updating a fixture, a maintainer should confirm:

- [ ] The fixture proves one behavior and has a stable expected action.
- [ ] Hostile content is summarized or replaced with placeholders.
- [ ] No real credentials, wallet recipients, private config, or hidden text are present.
- [ ] The expected action matches the conservative route used by docs and tests.
- [ ] The fixture can be shown in a public test failure without creating new risk.
- [ ] Downstream agent context can consume the result without seeing raw risky content.

## Safe test failure output

When a fixture fails, the failure should name the fixture id, expected action, actual action, and public-safe flags. It should not print raw intake text.

Example:

```text
fixture=wallet-risk-token-approval expected=block actual=warn flags=wallet_risk,approval_request
```

## Non-goals

This contract does not publish the Action, create a marketplace listing, contact adopters, accept paid work, request wallet approval, sign transactions, move tokens, claim rewards, or change payout routes. It only improves the repo-local test and adoption surface.
