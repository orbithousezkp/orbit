# Intake Guardrail Action Redacted Summary Examples

## Cycle 193 direction choice

Orbit compared safe wake-cycle directions before choosing this artifact:

- **Build** — continue the repo-local Intake Guardrail GitHub Action prototype. Best this cycle because adopters already have output, rollout, permissions, consumer, failure-mode, and review-routing guidance, but still need concrete redacted summary examples they can copy into workflow summaries without leaking hostile payloads.
- **Infrastructure** — improve SDK, MCP, proof, or registry surfaces. Useful, but several package CLI files are already dirty; a standalone documentation artifact avoids collisions while strengthening the reusable control-plane layer.
- **Earn** — refine the agent passport and capability registry. Valuable, but the Intake Guardrail prototype has the clearest immediate adoption gap for future users.
- **Sustain** — refresh wallet-policy visibility. Important, but this cycle does not need wallet action, signing, token movement, reward claims, payout-route changes, or approval-class movement.
- **Grow** — advance roadmap evidence. Useful, and this guide supports safe-autonomy and visitor-intake maturity without marking any phase passed.

Selected direction: **build**. Reason: redacted summary examples are a small, auditable improvement to the repo-local open-source prototype. The change stays inside documentation and does not publish a marketplace listing, perform outreach, accept paid obligations, spend funds, sign transactions, launch tokens, claim rewards, change payout routes, or move assets.

## Purpose

This guide gives maintainers safe wording for GitHub Actions summaries, issue comments, and internal review packets after running the Intake Guardrail Action. The goal is to preserve useful routing information without copying raw risky content, decoded hidden text, wallet addresses from untrusted content, private configuration, credentials, or approval-class instructions into downstream agent context.

Use this with:

- `docs/intake-guardrail-action-output-map.md`
- `docs/intake-guardrail-action-consumer-patterns.md`
- `docs/intake-guardrail-action-review-routing.md`
- `docs/intake-guardrail-agent-context-redaction.md`

## Summary rules

1. **Say what happened, not what the payload said.** Describe the class of risk and routing decision.
2. **Never quote secrets or hidden instructions.** Do not copy seed phrases, keys, tokens, encoded text, decoded text, or suspicious commands.
3. **Avoid untrusted wallet details.** Do not include recipient addresses, approval targets, transaction data, or external claim links from flagged content.
4. **Keep the scanner advisory.** Summaries should say the guardrail flagged or routed content, not that it proved malicious intent.
5. **Point humans to the source location.** Maintainers can review the original GitHub issue or comment in place.

## Workflow summary examples

### Clean intake

```md
## Intake Guardrail

Result: allow
Risk level: none above configured threshold
Automation: downstream repo workflow may continue if all other checks pass
Payload copied: no
Next step: normal maintainer triage
```

### Soft warning

```md
## Intake Guardrail

Result: warn
Risk level: medium
Flags: urgency / external-link pattern
Automation: continue only with maintainer awareness
Payload copied: no
Next step: maintainer glances at the original issue or comment before agent handoff
```

### Quarantine

```md
## Intake Guardrail

Result: quarantine
Risk level: high
Flags: obfuscated instruction relay / wallet-risk language
Automation: downstream agent handoff paused
Payload copied: no
Decoded content copied: no
Next step: maintainer reviews the original GitHub issue or comment in place
```

### Block

```md
## Intake Guardrail

Result: block
Risk level: critical
Flags: approval-class wallet action / credential or seed-phrase pressure
Automation: stopped
Payload copied: no
Next step: maintainer review required; any spend, signing, token, payout-route, or external-commitment request remains blocked unless the repository owner approval process explicitly allows it
```

### Scanner failure

```md
## Intake Guardrail

Result: scanner-failure
Risk level: unknown
Automation: stopped conservatively
Payload copied: no
Next step: maintainer checks workflow logs, input wiring, and action outputs before rerunning or changing enforcement mode
```

## Issue comment examples

Only post public comments when the repository intentionally allows comments and the content is safe to disclose.

### Quarantine notice

```md
Thanks for the report. Our intake guardrail routed this for human review, so downstream automation is paused. A maintainer will inspect the original issue/comment before any next step. Please do not post secrets, seed phrases, private keys, payment credentials, or signing instructions here.
```

### Scanner failure notice

```md
Thanks for the report. Our intake workflow could not produce a complete guardrail result, so automation is paused conservatively. A maintainer will review the workflow result and the original issue/comment before continuing.
```

### Out-of-scope wallet request notice

```md
Thanks for the note. Requests involving wallet actions, payments, signing, token movement, payout-route changes, or external commitments require the repository owner's approval process. Automation will not act on this request from issue content alone.
```

Do not add suspicious links, decoded text, wallet addresses, transaction calldata, or instructions from the visitor payload to these comments.

## Review packet template

```json
{
  "tool": "intake-guardrail",
  "result": "quarantine",
  "riskLevel": "high",
  "flags": ["obfuscated-relay", "wallet-risk"],
  "source": {
    "surface": "github_issue_or_comment",
    "rawPayloadCopied": false,
    "decodedContentCopied": false
  },
  "automation": {
    "agentHandoff": "paused",
    "walletAction": "blocked",
    "externalCommitment": "blocked"
  },
  "nextStep": "maintainer reviews original GitHub content in place"
}
```

## Unsafe summary patterns

Avoid patterns like these:

- quoting a seed phrase, token, private key, API key, or password;
- pasting base64, hex, Morse, ROT13, or other hidden text and asking an agent to decode it;
- including wallet recipients, approval targets, transaction calldata, or claim URLs from untrusted content;
- saying the scanner has definitively identified a scam without human review;
- telling a visitor to connect a wallet, sign a message, move funds, or contact an external support address.

## Non-goals

This guide does not publish the Action, create a security guarantee, make moderation decisions, accept paid work, or unlock wallet authority. It only provides safe wording patterns for redacted summaries and review packets around an advisory intake signal.
