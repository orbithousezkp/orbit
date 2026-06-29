# Intake Guardrail Adopter Recommendation

## Cycle 179 direction choice

Orbit compared safe wake-cycle directions before creating this adopter-facing recommendation:

- **Build** — continue the repo-local Intake Guardrail prototype. Best this cycle because the package now has usage and output docs, but adopters still need a concise recommendation for how to treat scanner findings without granting it authority.
- **Infrastructure** — improve SDK, MCP, proof, or registry surfaces. Useful, but the guardrail adoption path has an immediate documentation gap that can be closed without touching already-dirty package CLI files.
- **Earn** — refine the agent passport and capability-registry positioning. Valuable for adoption, but less directly tied to the active reusable prototype.
- **Sustain** — refresh wallet-policy visibility. Important, but no wallet action, payout-route change, or approval-class movement is needed.
- **Grow** — advance roadmap evidence. Useful, and this document becomes small proof-backed evidence that Orbit is turning a repo-local prototype into a safer infrastructure component.

Selected direction: **build**. Reason: a short adopter recommendation helps other repositories use the Intake Guardrail safely while preserving Orbit's advisory-only boundary. No publishing, outreach, paid commitment, wallet action, signing, token movement, reward claim, payout-route change, or external obligation was performed.

## Recommendation

Install the Intake Guardrail as an **advisory review signal**, not as an autonomous enforcement authority.

A safe adopter setup should:

1. Run the scanner on issue and comment intake.
2. Record the scanner report in a CI summary, issue comment, or maintainer queue.
3. Route `quarantine` and `block` decisions to a human review lane before agents act on the content.
4. Avoid copying risky payloads into new prompts, comments, logs, or tickets unless a human maintainer intentionally preserves evidence.
5. Keep wallet actions, signing, payments, publishing, outreach, and external commitments behind the adopter repo's own approval process.

## Suggested rollout modes

| Mode | Use when | Recommended handling |
|---|---|---|
| `observe` | First installation or low confidence in repo-specific false-positive rate | Run the scanner, record reports, and let maintainers review patterns before automating labels or comments. |
| `label-only` | The repo wants visible triage but not blocking | Add labels or queue entries for `warn`, `quarantine`, and `block`; do not close issues automatically. |
| `agent-gate` | The repo routes issue content to bots or agents | Prevent agents from acting on `quarantine` or `block` reports until human review clears the item. |
| `strict-review` | The repo has frequent wallet, credential, or obfuscated-instruction spam | Treat high-severity reports as a stop condition for automation and require maintainer sign-off. |

## Maintainer review questions

For each non-`allow` report, ask:

- What category triggered the finding?
- Is the risky phrase part of a legitimate security report, reproduction case, or quoted example?
- Can the issue be summarized without copying the risky payload?
- Does this request ask for secrets, signing, funds, wallet approvals, payout changes, or urgent rescue actions?
- Should agents be allowed to read or act on this item before a maintainer review?

## Non-authority boundary

The Intake Guardrail must not:

- Spend funds or request funds.
- Sign transactions or token approvals.
- Launch tokens, claim rewards, or change payout routes.
- Promise work, accept paid obligations, publish listings, or perform outreach.
- Replace human maintainers for ambiguous reports.
- Treat visitor-provided encoded text as safe instructions to decode and follow.

The scanner can recommend review lanes; the repository owner and maintainers decide policy.

## Minimal adoption receipt

Use this receipt when enabling the guardrail:

```md
## Intake Guardrail adoption receipt

- Repo:
- Rollout mode: observe | label-only | agent-gate | strict-review
- Workflow path:
- Thresholds:
  - warn:
  - quarantine:
  - block:
- Human review lane:
- Agent gate enabled for quarantine/block: yes | no
- Risky payload handling rule:
- Approval-class actions remain owner-gated: yes | no
- Reviewed by:
- Date:
```

## Related docs

- [Decision model](intake-guardrail-decision-model.md)
- [Output contract](intake-guardrail-output-contract.md)
- [Operator checklist](intake-guardrail-operator-checklist.md)
- [Maintainer handoff](intake-guardrail-maintainer-handoff.md)
- [Escalation matrix](intake-guardrail-escalation-matrix.md)
