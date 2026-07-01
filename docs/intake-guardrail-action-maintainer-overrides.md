# Intake Guardrail Action Maintainer Overrides

## Cycle 196 direction choice

Orbit compared safe wake-cycle directions before choosing this artifact:

- **Build** - continue the repo-local Intake Guardrail GitHub Action prototype. Best this cycle because adopters already have output maps, rollout modes, review routing, redacted summaries, and adoption receipts, but still need a safe override pattern when a maintainer decides a warning or quarantine is a false positive.
- **Infrastructure** - useful because override receipts strengthen Orbit's reusable control-plane pattern, but this cycle should avoid touching already-dirty package CLI files and stay in documentation.
- **Earn** - relevant because safer adoption docs support future use by other repos, but no outreach, publishing, paid commitment, or external obligation is appropriate this cycle.
- **Sustain** - important because some overrides may involve wallet-risk language, but the scanner and its override path must never authorize wallet action, spend, signing, token movement, reward claims, payout-route changes, or external commitments.
- **Grow** - useful because this guide supports safe-autonomy and visitor-intake maturity without marking any roadmap phase passed.

Selected direction: **build**. Reason: maintainer override guidance is a small, auditable improvement to the repo-local open-source prototype. The change stays inside documentation and does not publish a marketplace listing, perform outreach, accept paid obligations, spend funds, sign transactions, launch tokens, claim rewards, change payout routes, or move assets.

## Purpose

This guide defines how a repository maintainer may override an Intake Guardrail Action warning, quarantine, block, or scanner failure. The goal is to make overrides reviewable and reversible without turning the scanner, workflow, or downstream agent into an authority.

Use this with:

- `docs/intake-guardrail-action-output-map.md`
- `docs/intake-guardrail-action-rollout-modes.md`
- `docs/intake-guardrail-action-review-routing.md`
- `docs/intake-guardrail-action-redacted-summary-examples.md`
- `docs/intake-guardrail-action-adoption-receipt.md`

## Override principles

1. **Human decision, machine receipt.** A maintainer decides whether to continue; automation records the decision in public-safe form.
2. **Override the lane, not the policy.** An override can restore ordinary triage or agent handoff for a specific item, but it cannot approve gated actions.
3. **Keep payloads out of agent context.** Do not copy raw risky content, decoded hidden text, secrets, suspicious links, or untrusted wallet details into the override receipt.
4. **Prefer the narrowest continuation.** Continue only the workflow step needed for the reviewed item; do not globally weaken rules because one item was benign.
5. **Make rollback easy.** Every override should say how to return to the prior quarantine or stop lane if the decision was wrong.

## Override lanes

| Original result | Override may allow | Required maintainer check | Still blocked |
| --- | --- | --- | --- |
| `warn` | Normal triage with caution removed or downgraded | Confirm warning was expected, benign, or already handled by repo policy | Spend, signing, token movement, payout-route changes, publishing, outreach, access sharing, paid commitments |
| `quarantine` | Downstream agent handoff with redacted context only | Review original GitHub issue/comment in place and confirm no hidden instruction relay, secret request, or wallet-risk instruction should enter context | Raw payload copying, decoded hidden content, approval-class action |
| `block` | Maintainer-owned manual triage only | Confirm the block was a false positive and document why automation remains limited | Automated wallet action, external commitment, public reposting of risky content |
| scanner failure | Rerun or manual review | Confirm input wiring, output parsing, and workflow logs before trusting a new result | Treating an incomplete scan as safe |

## Minimal override receipt

```json
{
  "tool": "intake-guardrail",
  "override": true,
  "originalAction": "quarantine",
  "overrideLane": "redacted_agent_handoff",
  "reviewerRole": "maintainer",
  "payloadCopied": false,
  "decodedContentCopied": false,
  "reasonClass": "false_positive_after_source_review",
  "continuationScope": "single_issue_or_comment",
  "approvalClassActions": "still_blocked",
  "rollback": "return item to quarantine lane if new risk appears"
}
```

Keep the receipt focused on routing metadata. It should not include raw issue bodies, comment bodies, hidden strings, decoded text, secret-like material, private config, wallet recipients from untrusted content, transaction data, claim links, or approval instructions.

## Safe workflow pattern

If a repository wants override support, keep it explicit and maintainer-owned. For example, a later workflow step may require a maintainer-provided label such as `intake:override-reviewed` before continuing after quarantine. The label should mean only that a human reviewed the item; it must not mean a gated action was approved.

```yaml
- name: Stop agent handoff unless reviewed
  if: ${{ steps.scan.outputs.action == 'quarantine' && !contains(github.event.issue.labels.*.name, 'intake:override-reviewed') }}
  run: |
    echo "Intake Guardrail quarantine remains active. Maintainer override review required."
    exit 1
```

Use this only when the workflow event exposes trusted label data. If label state is unavailable or ambiguous, keep the conservative stop.

## Override checklist

Before applying an override, confirm:

- [ ] A maintainer reviewed the original GitHub content in place.
- [ ] The override reason can be described without quoting risky payload text.
- [ ] Downstream agents receive redacted routing context only.
- [ ] The override applies to one item or one narrowly described class of false positives.
- [ ] Approval-class actions remain outside the scanner and override path.
- [ ] A rollback path is written before continuation.

## Non-goals

This guide does not publish the Action, create a marketplace listing, promise a paid service, provide a security guarantee, moderate a community by itself, authorize external obligations, or unlock wallet authority. It only describes safe maintainer override handling for an advisory intake signal inside GitHub workflows.
