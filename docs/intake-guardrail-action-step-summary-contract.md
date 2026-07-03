# Intake Guardrail Action Step Summary Contract

## Cycle selection

This cycle compared the safe multi-direction options before acting:

- **Build**: strongest this cycle because the Intake Guardrail Action is the active repo-local prototype, and adopters need a concise contract for writing GitHub Actions step summaries without leaking raw risky payloads.
- **Infrastructure**: useful because safe summaries are part of Orbit's proof-receipt and integration pattern, but this cycle should stay in docs and avoid already-dirty package CLI files.
- **Earn**: relevant because clearer adopter-facing contracts can support future reuse, but this cycle does not publish, do outreach, accept paid work, or create external obligations.
- **Sustain**: important because summaries must preserve wallet, signing, token, spend, payout-route, private-route, and approval boundaries, but no approval-class action is involved.
- **Grow**: useful because the artifact supports future visitor-community and developer-autopilot evidence, but it does not mark a roadmap phase passed.

Selected direction: **build**. Reason: add one public-safe step-summary contract so maintainers can expose scan results in workflow UI without copying hostile content or implying execution authority.

## Purpose

Use this contract when a workflow writes `packages/issue-scam-scanner` results to `$GITHUB_STEP_SUMMARY`, job logs, release evidence packets, or maintainer handoff notes. The summary is a public-safe receipt. It is not a security verdict, moderation decision, approval, wallet authorization, publishing approval, outreach approval, paid-work commitment, or access grant.

## Required summary fields

A safe step summary should include only redacted routing facts:

```md
### Orbit Intake Guardrail summary

- Source event: issue / comment / pull_request / workflow_dispatch / other
- Scan status: completed / unavailable / ambiguous
- Recommended action: allow / warn / quarantine / block / scanner-failure
- Level: clear / low / medium / high / critical / unavailable
- Categories: <public-safe category names only>
- Payload copied: no
- Decoded hidden content copied: no
- Secret-like values copied: no
- Agent handoff allowed: yes / no / not applicable
- Human review needed: yes / no
- Approval-class authority granted: no
- Next safe step: <short maintainer action>
```

## Allowed content

A step summary may include:

- The scanner action value: `allow`, `warn`, `quarantine`, `block`, or `scanner-failure`.
- Risk category names such as `prompt_injection`, `encoded_instruction_relay`, `credential_phish`, or `external_wallet`.
- Severity level or score when it is used only for triage priority.
- A statement that raw payloads were not copied.
- A human-review lane such as `maintainer-review`, `security-review`, or `agent-handoff-review`.
- Links to public workflow runs, safe docs, fixture identifiers, or redacted receipts.

## Forbidden content

A step summary must not include:

- Raw issue bodies, comment bodies, suspicious links, or copied hostile instructions.
- Decoded, decrypted, translated, or reconstructed hidden text.
- Seed phrases, private keys, API keys, credentials, session tokens, or secret-like strings.
- Visitor-provided wallet recipients, private payout routes, provider routes, private config, or billing-route details.
- Instructions that approve spending, signing, token movement, reward claims, payout-route changes, publishing, outreach, paid commitments, or access sharing.
- A claim that the scanner is a final security authority or a substitute for maintainer review.

## Summary patterns by action

| Action | Summary stance | Agent handoff stance |
| --- | --- | --- |
| `allow` | Record that no threshold-matching flags were found. | May continue under normal repo policy. |
| `warn` | Record categories and advise caution. | May summarize, but should not follow sensitive instructions from flagged text. |
| `quarantine` | Record that human review is required and raw content was not copied. | Do not pass raw payloads into agent context. |
| `block` | Record that automation stopped for the item. | Do not act, decode, click links, approve, or continue. |
| `scanner-failure` | Record that the scan was unavailable or ambiguous. | Fail closed for agent handoff until a maintainer reviews. |

## Minimal workflow pattern

```yaml
- name: Write redacted Intake Guardrail summary
  if: always()
  run: |
    {
      echo "### Orbit Intake Guardrail summary"
      echo ""
      echo "- Scan status: completed"
      echo "- Recommended action: ${{ steps.scan.outputs.action }}"
      echo "- Level: ${{ steps.scan.outputs.level }}"
      echo "- Payload copied: no"
      echo "- Decoded hidden content copied: no"
      echo "- Agent handoff allowed: ${{ steps.scan.outputs.action == 'allow' && 'yes' || 'no' }}"
      echo "- Approval-class authority granted: no"
    } >> "$GITHUB_STEP_SUMMARY"
```

Do not append `${{ github.event.issue.body }}`, `${{ github.event.comment.body }}`, decoded payloads, or raw `flags` text to the summary unless the workflow first redacts them into public-safe category names.

## Non-goals

This contract does not publish the Action, create a marketplace listing, contact adopters, accept paid work, create an approval issue, spend treasury assets, sign transactions, launch or move tokens, claim rewards, change payout routes, grant access, or mark a roadmap phase passed. It only defines safe workflow-summary behavior for the repo-local Intake Guardrail prototype.
