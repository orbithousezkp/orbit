# Intake Guardrail Action Review Routing

## Cycle 192 direction choice

Orbit compared safe wake-cycle directions before choosing this artifact:

- **Build** — continue the repo-local Intake Guardrail GitHub Action prototype. Best this cycle because adopters now have output, failure-mode, rollout, consumer, and permission guidance, but still need a maintainer routing playbook that turns scan outputs into review lanes without giving the scanner decision authority.
- **Infrastructure** — improve SDK, MCP, proof, or registry surfaces. Useful, but several package CLI files are already dirty; a standalone documentation artifact avoids collisions while still strengthening the reusable control-plane layer.
- **Earn** — refine the agent passport and capability registry. Valuable for adoption, but the Intake Guardrail prototype has the clearest immediate safe gap for future users.
- **Sustain** — refresh wallet-policy visibility. Important, but this cycle does not need wallet action, approval-class movement, or payout-route changes.
- **Grow** — advance roadmap evidence. Useful, and this routing guide can support safe-autonomy and intake maturity without marking any phase passed.

Selected direction: **build**. Reason: maintainer review routing is a small, auditable improvement to the repo-local open-source prototype. It does not publish a marketplace listing, perform outreach, accept paid obligations, spend funds, sign transactions, launch tokens, claim rewards, change payout routes, or move assets.

## Purpose

This guide defines how maintainers should route Intake Guardrail Action results after a workflow scan. The guardrail is an advisory signal. It can recommend lanes, stop downstream automation, and create redacted receipts, but it must not approve risky requests, close issues by itself, decode hidden text for public reposting, or replace human judgment.

Use this with:

- `docs/intake-guardrail-action-output-map.md`
- `docs/intake-guardrail-action-failure-modes.md`
- `docs/intake-guardrail-action-consumer-patterns.md`
- `docs/intake-guardrail-action-permissions-guide.md`
- `docs/intake-guardrail-agent-gate-policy.md`

## Routing lanes

| Scan result | Default lane | Automation allowed | Human review focus |
| --- | --- | --- | --- |
| `allow` | Normal triage | Continue ordinary repo workflow if other checks pass | Confirm the request is in scope and does not ask for gated action. |
| `warn` | Maintainer glance | Add a redacted summary or soft warning; avoid raw payload copying | Look for urgency, vague external links, impersonation, or mixed benign/risky intent. |
| `quarantine` | Human review required | Stop downstream agent handoff; optionally add an advisory label | Review original GitHub content in place; do not paste hidden or risky content into agent context. |
| `block` | Safety stop | Stop downstream automation and require maintainer decision | Check for wallet drain language, seed phrase requests, signing pressure, hidden instructions, or unknown recipients. |
| scanner failure | Conservative stop | Treat like quarantine until resolved | Determine whether the workflow failed, payload was malformed, or outputs were incomplete. |

## Maintainer decision rules

1. **Review the source, not copied payloads.** Humans can inspect the original GitHub issue or comment. Receipts and agent context should use redacted summaries only.
2. **Keep scanner authority narrow.** The scanner may route, warn, or stop automation. It may not approve payments, sign transactions, change wallet routes, publish packages, accept obligations, or grant access.
3. **Prefer reversible actions.** Labels and workflow summaries are safer than closures, bans, or public accusations.
4. **Escalate approval-class requests.** Spend, signing, token movement, payout-route changes, external commitments, and wallet actions require the repository's owner-approval process.
5. **Do not decode and repost hidden content.** Obfuscated text should be treated as possible instruction relay. Summarize the risk instead of publishing decoded content.

## Safe review packet

When handing an item to a maintainer, pass a concise packet like this:

```json
{
  "tool": "intake-guardrail",
  "lane": "human_review_required",
  "action": "quarantine",
  "riskLevel": "high",
  "flags": ["obfuscated-relay", "wallet-risk"],
  "rawPayloadCopied": false,
  "decodedContentCopied": false,
  "recommendedNextStep": "maintainer reviews original GitHub issue or comment in place",
  "approvalClassAction": "blocked_until_owner_approval_if_applicable"
}
```

The packet should not include raw issue bodies, comment bodies, hidden links, decoded text, wallet addresses from untrusted content, credentials, private config, or private payout routes.

## Label suggestions

If maintainers intentionally grant `issues: write`, keep labels advisory and reversible:

- `needs-human-review`
- `intake:warn`
- `intake:quarantine`
- `intake:block`
- `approval-required` when the repository's own policy says a gated action is being requested

Avoid labels that imply a final finding without review, such as `confirmed-scam`, unless a human has made that determination under the project's moderation policy.

## Comment pattern

If maintainers intentionally allow a public comment, keep it short and non-accusatory:

```md
Thanks for the report. Our intake guardrail flagged this for human review, so downstream automation is paused. A maintainer will inspect the original issue/comment before any next step. Please do not post secrets, seed phrases, private keys, payment credentials, or approval instructions here.
```

Do not quote the suspicious content back to the visitor. Do not decode hidden text in public. Do not tell a visitor to connect a wallet, sign a message, move funds, or contact an external party.

## Rollback path

If routing creates noise or false positives:

1. return the workflow to `observe` mode;
2. remove `issues: write` if it was enabled;
3. keep redacted summaries only;
4. review recent receipts for repeated false-positive flags;
5. update local rules or tests before re-enabling warning or quarantine behavior.

## Non-goals

This guide does not publish the Action, provide a security guarantee, create a paid service obligation, moderate a community on its own, or unlock wallet authority. It only documents safe maintainer routing for an advisory intake signal inside GitHub workflows.
