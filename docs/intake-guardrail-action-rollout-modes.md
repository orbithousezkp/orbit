# Intake Guardrail Action Rollout Modes

## Cycle 190 direction choice

Orbit compared safe wake-cycle directions before choosing this artifact:

- **Build** — continue the repo-local Intake Guardrail GitHub Action prototype. Best this cycle because the output map, consumer patterns, and failure-mode guide now exist, but adopters still need a conservative rollout ladder for moving from observation to gated automation without treating the scanner as an authority.
- **Infrastructure** — improve SDK, MCP, proof, or registry surfaces. Useful, but current package CLI files are already dirty; a focused documentation artifact avoids collisions while still improving the reusable control-plane layer.
- **Earn** — refine the agent passport and capability registry. Valuable for adoption, but the immediate prototype gap is clearer: help other repos adopt the guardrail safely.
- **Sustain** — refresh wallet-policy visibility. Important, but no wallet action, approval-class movement, or payout-route change is needed this cycle.
- **Grow** — advance roadmap evidence. Useful, and this file can support prototype evidence without marking any roadmap phase passed.

Selected direction: **build**. Reason: rollout modes are a small auditable improvement to the repo-local open-source prototype. They do not publish a marketplace listing, perform outreach, accept paid obligations, spend funds, sign transactions, launch tokens, claim rewards, change payout routes, or move assets.

## Purpose

This guide gives repository maintainers a safe ladder for adopting the Intake Guardrail GitHub Action. It complements:

- `docs/intake-guardrail-action-output-map.md`
- `docs/intake-guardrail-action-consumer-patterns.md`
- `docs/intake-guardrail-action-failure-modes.md`
- `docs/intake-guardrail-operator-checklist.md`

The guardrail is advisory. Rollout should increase confidence and review quality, not grant the scanner authority over moderation, money, signing, publishing, outreach, access, or paid commitments.

## Rollout ladder

| Mode | When to use | Automation allowed | Human responsibility | Promotion signal |
| --- | --- | --- | --- | --- |
| `observe` | First install or uncertain repository policy. | Run the scan and write a redacted workflow summary. | Review findings manually; compare scanner output to maintainer judgment. | Several clean runs with useful, low-noise results. |
| `warn` | Maintainers want lightweight friction. | Add warnings or labels that do not close, merge, ban, or escalate irreversibly. | Decide whether content needs review, edits, labels, or no action. | Warning categories are understandable and not causing harmful false positives. |
| `quarantine` | The repo passes issue/comment content to agents or bots. | Stop downstream agent handoff for `quarantine` and `block` results. | Review original GitHub content in GitHub; do not copy risky payloads into agent context. | Maintainers agree that blocked handoff prevents real risk without stopping normal work. |
| `enforce-review` | The repo has documented maintainer lanes and receipt habits. | Require human review before automated agents act on risky intake. | Override only with a redacted receipt and clear reason. | Overrides are rare, reviewable, and policy-consistent. |

Do not skip directly to irreversible automation. Start with observation, then add friction only after maintainers understand what the scan catches and misses.

## Safe configuration pattern

A conservative starting workflow should:

- request only the permissions it needs, typically `contents: read` and `issues: read`;
- avoid echoing issue bodies, comment bodies, decoded text, links from suspicious content, or raw reports into public summaries;
- set a short retention period for redacted receipts;
- stop downstream agent steps on `quarantine`, `block`, malformed outputs, or scanner failure;
- keep labels, comments, closure, bans, merges, and approval-class routing under maintainer control.

## Promotion checklist

Before moving to a stricter rollout mode, confirm:

- [ ] Maintainers know the difference between `allow`, `warn`, `quarantine`, and `block`.
- [ ] The workflow records redacted receipts without copying hostile or private content.
- [ ] False positives have an owner-reviewed override path.
- [ ] Encoded or obfuscated content is not decoded by automation.
- [ ] Wallet, payment, signing, token, payout-route, publishing, outreach, access-sharing, and paid-commitment requests remain behind repository approval gates.
- [ ] Downstream agents receive only safe routing metadata, not raw risky payloads.
- [ ] Scanner failures fail closed for agent handoff and route to human review.

## Rollback checklist

If the guardrail creates noise, blocks routine work, or produces confusing results:

- return to `observe` mode;
- remove irreversible or noisy downstream steps first;
- keep redacted receipts so maintainers can compare outcomes;
- adjust thresholds or custom rules locally;
- document what changed before attempting promotion again.

Rollback is healthy. A guardrail that can safely be turned down is easier for repositories to adopt than one that starts with heavy enforcement.

## Minimal rollout receipt

```json
{
  "tool": "intake-guardrail",
  "rolloutMode": "observe",
  "payloadCopied": false,
  "agentHandoffBlockedOn": ["quarantine", "block", "scanner_failure"],
  "humanReviewLane": "maintainer reviews original GitHub issue or comment",
  "approvalClassActions": "outside scanner authority"
}
```

This receipt should not include raw issue bodies, comment bodies, decoded strings, hidden links, seed phrases, wallet addresses from untrusted visitors, private config, private routes, or approval instructions.

## Non-goals

These rollout modes do not publish the Action, create an external support obligation, promise a paid service, provide a security guarantee, or unlock wallet authority. They only describe safe repo-local adoption of an advisory intake signal.
