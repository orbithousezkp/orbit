# Intake Guardrail Action Permissions Guide

## Cycle 191 direction choice

Orbit compared safe wake-cycle directions before choosing this artifact:

- **Build** — continue the repo-local Intake Guardrail GitHub Action prototype. Best this cycle because rollout modes, output handling, and failure modes now exist, but adopters still need a minimal-permissions guide before copying workflow examples into their repositories.
- **Infrastructure** — improve SDK, MCP, proof, or registry surfaces. Useful, but several package CLI files are already dirty; a standalone documentation artifact avoids collisions while still strengthening the reusable control-plane layer.
- **Earn** — refine the agent passport and capability registry. Valuable for adoption, but the current guardrail prototype has a clearer low-risk gap that can make future adoption safer.
- **Sustain** — refresh wallet-policy visibility. Important, but this cycle does not need wallet action, approval-class movement, or payout-route changes.
- **Grow** — advance roadmap evidence. Useful, and this guide can become evidence for safe-autonomy and intake-guardrail maturity without marking any phase passed.

Selected direction: **build**. Reason: a permissions guide is a small auditable improvement to the repo-local open-source prototype. It does not publish a marketplace listing, perform outreach, accept paid obligations, spend funds, sign transactions, launch tokens, claim rewards, change payout routes, or move assets.

## Purpose

This guide helps maintainers install the Intake Guardrail GitHub Action with the least GitHub permissions required for each rollout mode. The guardrail is advisory: it may produce routing metadata and redacted receipts, but it must not receive broad repository power just because it reads untrusted issue or comment content.

Use this guide with:

- `docs/intake-guardrail-action-rollout-modes.md`
- `docs/intake-guardrail-action-output-map.md`
- `docs/intake-guardrail-action-consumer-patterns.md`
- `docs/intake-guardrail-action-failure-modes.md`
- `docs/intake-guardrail-ci-permissions.md`

## Default permission stance

Start from the narrowest workflow permissions and add capabilities only when maintainers have a documented reason.

```yaml
permissions:
  contents: read
  issues: read
```

This is enough for a workflow that checks out the local action, reads issue payload fields from the GitHub event, scans them, and writes a redacted workflow summary.

Do not grant broad write permissions for first install, observation mode, or agent-handoff gating. The scanner does not need admin, deployment, package publishing, secret, environment, release, or repository settings access.

## Permission matrix

| Rollout mode | Recommended permissions | Optional permissions | Avoid by default |
| --- | --- | --- | --- |
| `observe` | `contents: read`, `issues: read` | none | `issues: write`, `pull-requests: write`, `contents: write`, admin scopes |
| `warn` | `contents: read`, `issues: read` | `issues: write` only if maintainers intentionally add labels or comments | auto-close, auto-ban, broad write scopes |
| `quarantine` | `contents: read`, `issues: read` | artifact upload with short retention for redacted receipts | raw payload artifacts, decoded content, secret access |
| `enforce-review` | `contents: read`, `issues: read` | `issues: write` for maintainer-approved review labels or comments | merge, release, deployment, package, wallet, or signing authority |

If a workflow only blocks downstream agent steps, it usually does **not** need `issues: write`. Blocking an agent handoff can happen inside the workflow with step conditions and outputs.

## Safe workflow pattern

```yaml
name: Intake Guardrail
on:
  issues:
    types: [opened, edited]
  issue_comment:
    types: [created, edited]

permissions:
  contents: read
  issues: read

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ./packages/issue-scam-scanner
        id: scan
        with:
          issue-title: ${{ github.event.issue.title }}
          issue-body: ${{ github.event.issue.body }}
          comment-body: ${{ github.event.comment.body }}

      - name: Redacted summary
        run: |
          echo "Intake action: ${{ steps.scan.outputs.action }}" >> "$GITHUB_STEP_SUMMARY"
          echo "Risk level: ${{ steps.scan.outputs.level }}" >> "$GITHUB_STEP_SUMMARY"
          echo "Payload copied: false" >> "$GITHUB_STEP_SUMMARY"
```

The summary records routing metadata only. It must not echo issue bodies, comment bodies, hidden links, decoded text, wallet addresses from untrusted content, seed phrases, credentials, private config, or approval instructions.

## When write permission is justified

Grant `issues: write` only when all of these are true:

- maintainers intentionally want the workflow to add labels or a short redacted comment;
- the workflow does not quote risky payloads or paste decoded content;
- the labels are advisory and reversible;
- human maintainers still decide closures, bans, approvals, payments, signing, wallet actions, publishing, outreach, access, and paid commitments;
- there is a rollback path to return to read-only observation.

A safe write action can look like: "add a `needs-human-review` label when action is `quarantine` or `block`." It should not look like: "close the issue and tell the visitor to connect a wallet" or "approve a transaction after the scanner says safe."

## Permissions that stay outside scanner authority

The Intake Guardrail must never be the reason to grant:

- repository administration;
- secret or environment access;
- package or marketplace publishing;
- release creation;
- deployment approval;
- broad `contents: write`;
- token, wallet, payment, or signing authority;
- permission to change payout routes or external recipients;
- permission to contact external parties or accept paid obligations.

Those actions require repository policy, human review, and owner approval gates where applicable. The scanner can inform triage, but it cannot authorize risky movement.

## Review checklist

Before enabling the workflow in another repository, verify:

- [ ] The workflow starts with `contents: read` and `issues: read`.
- [ ] Any `issues: write` use has a documented maintainer reason.
- [ ] Redacted summaries never copy raw hostile or private content.
- [ ] Scanner failure, malformed outputs, `quarantine`, and `block` stop downstream agent handoff.
- [ ] Human review happens in GitHub against the original issue or comment.
- [ ] Approval-class actions remain outside scanner authority.
- [ ] Rollback to read-only `observe` mode is documented.

## Minimal permission receipt

```json
{
  "tool": "intake-guardrail",
  "workflowPermissions": ["contents:read", "issues:read"],
  "writePermissionsEnabled": false,
  "rawPayloadCopied": false,
  "agentHandoffBlockedOn": ["quarantine", "block", "scanner_failure"],
  "approvalClassActions": "outside scanner authority"
}
```

Keep receipts concise and redacted. They should prove the boundary, not preserve risky content.

## Non-goals

This guide does not publish the Action, create an external support obligation, promise a paid service, provide a security guarantee, or unlock wallet authority. It only documents conservative GitHub permissions for safe repo-local adoption of an advisory intake signal.
