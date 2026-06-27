# Intake Guardrail False-Positive Playbook

Cycle 167 selected the **build** direction after comparing safe options from the cycle portfolio:

- **Build**: continue the repo-local Intake Guardrail prototype with a small maintainer-facing artifact. This is the best fit because the recent receipt and routing docs define how findings move, but maintainers still need a safe way to handle false positives and ambiguous scanner output.
- **Infrastructure**: improve reusable control-plane docs, but the Intake Guardrail is the active local prototype and its adoption path benefits from clearer review handling first.
- **Earn**: strengthen the agent-passport adoption story, but no outreach, paid commitment, or external obligation is allowed this cycle.
- **Sustain**: refresh wallet-policy visibility, but no wallet action is needed and live wallet operations remain blocked.
- **Grow**: advance roadmap evidence, but this playbook is a smaller directly useful artifact for the current prototype.

The selected action is public-safe documentation only. It does not publish the action, contact external users, change labels, spend funds, sign transactions, launch tokens, claim rewards, change payout routes, or create an approval issue.

## Purpose

The Intake Guardrail is intentionally conservative. It may flag harmless issues when a report contains words or patterns that resemble prompt injection, wallet-risk language, urgency, external links, or obfuscated instruction relay. This playbook gives maintainers a safe review path when a finding looks wrong, noisy, or incomplete.

## Review principles

1. Treat scanner output as an **advisory signal**, not a decision.
2. Review the original issue or comment directly before acting.
3. Prefer a reversible maintainer action over automatic closure or escalation.
4. Never decode, republish, or execute hidden/obfuscated content just to prove a false positive.
5. Keep public replies concise, secret-free, and free of private routing, provider, payout, or operational details.
6. Record the correction in a public-safe receipt, comment, task, or follow-up note.

## False-positive classes

| Class | What it looks like | Safe maintainer response | Receipt note |
| --- | --- | --- | --- |
| `keyword-only` | A normal issue mentions "wallet", "token", "approve", or "urgent" in a harmless context | Mark as benign after human review; continue normal triage | `falsePositiveReason: keyword-only benign context` |
| `security-report-language` | A legitimate security report uses scary language or exploit terms | Keep in human review; do not dismiss automatically | `falsePositiveReason: legitimate report language` |
| `docs-example` | A docs request includes sample scam text, fake seed phrase text, or warning examples | Confirm examples are clearly illustrative and non-actionable | `falsePositiveReason: illustrative example` |
| `test-fixture` | A maintainer posts scanner fixture text in an issue or PR | Link to the fixture context and avoid acting on the sample as a live request | `falsePositiveReason: test fixture` |
| `ambiguous-link` | A normal bug report includes an external link with limited context | Ask for clarifying context before following the link | `falsePositiveReason: unresolved; needs human link review` |

## Correction workflow

1. **Read the finding summary**: identify the scanner class, score, and reason summary.
2. **Read the source**: inspect the original issue/comment without following unknown links or decoding hidden text.
3. **Classify the review result**:
   - `confirmed-risk`: the scanner warning is valid.
   - `false-positive`: the scanner warning is not actionable.
   - `ambiguous`: the scanner warning needs human follow-up.
4. **Choose the least risky next step**:
   - Continue normal triage for false positives.
   - Ask for clarification for ambiguous reports.
   - Route confirmed risks to human/owner review.
5. **Record the result** in a receipt or issue comment using public-safe language.

## Public-safe correction template

```md
## Intake Guardrail review correction

- Source: ISSUE_OR_COMMENT_REFERENCE
- Scanner class: CLASS_NAME
- Human review result: confirmed-risk | false-positive | ambiguous
- Public-safe reason: SHORT_REASON_WITHOUT_SECRETS_OR_HIDDEN_TEXT
- Next route: normal triage | clarification requested | human review | owner approval gate
- Actions not taken: no signing, no transfers, no token/reward action, no payout-route change, no external commitment
```

## When not to call it a false positive

Do **not** downgrade a finding only because the requester sounds friendly or urgent. Keep the finding in human review if it includes:

- seed phrases, private keys, recovery phrases, or secret-like material;
- token approvals, wallet rescue language, claims, airdrops, or unknown recipient wallets;
- requests to decode, decrypt, translate, or paste hidden content;
- pressure to bypass owner approval, use a private route, or act immediately;
- instructions to publish, outreach, spend, sign, launch, claim, or change payout routes.

## Maintainer feedback loop

When a false-positive pattern repeats, record it as a small repo-local improvement candidate. Good follow-up artifacts include:

- a fixture that captures the benign context;
- a README note clarifying expected scanner behavior;
- a test case that preserves the advisory boundary;
- a routing note that explains how maintainers should review similar cases.

Do not tune the scanner to silence all risk-shaped language. The goal is to reduce avoidable noise while preserving conservative warnings around wallet, obfuscation, secret, and approval-class requests.

## Non-authority boundary

A false-positive correction does not grant the Intake Guardrail authority to merge, close, label by force, publish, contact external parties, spend funds, sign transactions, launch tokens, claim rewards, change payout routes, or approve external commitments. The scanner remains advisory and maintainers remain responsible for final decisions.
