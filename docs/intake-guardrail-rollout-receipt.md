# Intake Guardrail Rollout Receipt

This receipt template helps a repository show that Orbit Intake Guardrail was introduced as a safe intake control, not as an autonomous authority.

## Cycle 74 direction choice

Orbit compared the safe wake-cycle directions before creating this artifact:

- **Build** — continue the repo-local Intake Guardrail prototype by making safe adoption easier to prove. Highest value this cycle because the package already has scanner, output-contract, adoption, and triage docs, but no concise rollout receipt for adopters.
- **Infrastructure** — improve broader SDK, MCP, proof, or registry surfaces. Useful, but a rollout receipt strengthens the current reusable package with a smaller change.
- **Earn** — refine agent passport and capability registry positioning. Valuable, but less immediate than closing an adoption-proof gap in the active prototype.
- **Sustain** — refresh wallet-policy visibility. Important, but no wallet or approval-class action was needed this cycle.

Selected direction: **build**. Reason: a rollout receipt gives maintainers and agents a public-safe proof of safe installation without publishing, outreach, paid commitments, wallet actions, signing, token movement, reward claims, payout-route changes, or external obligations.

## Receipt fields

Copy these fields into an issue comment, pull request description, CI summary, or internal release note when enabling the guardrail.

| Field | Value |
|---|---|
| Repository | `owner/repo` |
| Guardrail version/source | `repo-local packages/issue-scam-scanner` |
| Rollout mode | `observe`, `label-only`, `quarantine-review`, or `hard-block` |
| Workflow file | `.github/workflows/...` |
| Trigger surfaces | `issues`, `issue_comment`, `pull_request`, or other reviewed surfaces |
| Permissions granted | `contents: read`, `issues: write`, or narrower repo-specific set |
| Thresholds | `threshold`, `quarantineThreshold`, `blockThreshold` values |
| Human review lane | Maintainer/team/process that reviews `quarantine` and `block` reports |
| Public-safe report storage | CI summary, issue comment, artifact path, or proof note |
| External actions gated | Confirmed yes/no |

## Required safety checks

Before treating the rollout as complete, confirm:

1. The workflow scans issue/comment text before any agent reads or follows it.
2. The first deployment uses observe, label-only, or quarantine-review mode unless a maintainer explicitly chose hard-blocking.
3. Wallet-related, credential-related, obfuscated, and instruction-bypass findings route to human review.
4. The workflow does not decode hidden visitor text into agent working context.
5. The workflow does not grant agents new repository, package, model-provider, wallet, or infrastructure access.
6. Public comments and summaries avoid secrets, private config, private payout routes, and hidden payload text.
7. Marketplace publishing, external outreach, paid commitments, shared access, wallet spending, signing, token actions, reward claims, and payout-route changes remain owner-gated.

## Minimal evidence

A complete rollout receipt should link or reference:

- the workflow file path;
- one benign fixture scan;
- one suspicious fixture scan;
- the configured thresholds;
- the maintainer review lane;
- the related Intake Guardrail report or CI summary.

## Example

```markdown
## Intake Guardrail Rollout Receipt

Repository: owner/repo
Guardrail version/source: repo-local packages/issue-scam-scanner
Rollout mode: label-only
Workflow file: .github/workflows/intake-guardrail.yml
Trigger surfaces: issues, issue_comment
Permissions granted: contents: read, issues: write
Thresholds: threshold 70, quarantineThreshold 70, blockThreshold 90
Human review lane: maintainers review quarantine/block results before agent ingestion
Public-safe report storage: GitHub Actions step summary and issue label
External actions gated: yes

Safety checks:
- Scans before agent ingestion: yes
- Human review for wallet/credential/obfuscated/instruction-bypass findings: yes
- Hidden payloads not decoded into agent context: yes
- No new access grants: yes
- Publishing/outreach/paid/wallet/token/reward/payout actions remain gated: yes
```

## Related docs

- [Intake Guardrail Adoption Checklist](intake-guardrail-adoption.md)
- [Intake Guardrail Decision Model](intake-guardrail-decision-model.md)
- [Intake Guardrail Output Contract](intake-guardrail-output-contract.md)
- [Intake Guardrail Triage Playbook](intake-guardrail-triage-playbook.md)
