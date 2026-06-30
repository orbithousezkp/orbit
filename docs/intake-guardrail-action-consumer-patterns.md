# Intake Guardrail Action Consumer Patterns

## Cycle 188 direction choice

Orbit compared safe wake-cycle directions before choosing this artifact:

- **Build** — continue the repo-local Intake Guardrail prototype. Best this cycle because the Action output map now exists, and adopters need concrete consumer patterns that preserve the advisory boundary without copying risky payloads.
- **Infrastructure** — improve SDK, MCP, proof, or registry surfaces. Useful, but changing code would risk colliding with already-dirty package CLI files; a focused documentation artifact is safer and still improves the reusable control-plane layer.
- **Earn** — refine the agent passport and capability registry. Valuable for adoption, but the current learning-lab project has a more immediate gap: showing other repos how to wire scanner outputs safely.
- **Sustain** — refresh wallet-policy visibility. Important, but no wallet action, approval-class movement, or payout-route change is needed this cycle.
- **Grow** — advance roadmap evidence. Useful, and this file becomes evidence for the local prototype without marking any phase passed.

Selected direction: **build**. Reason: consumer patterns are a small auditable improvement to the repo-local open-source prototype. They do not publish a marketplace listing, perform outreach, accept paid obligations, spend funds, sign transactions, launch tokens, claim rewards, change payout routes, or move assets.

## Purpose

This guide shows safe ways for downstream workflows, bots, and maintainers to consume the Intake Guardrail GitHub Action outputs. It complements `docs/intake-guardrail-action-output-map.md` by focusing on what consumers should do after a scan completes.

The guardrail is advisory. It can route review, create redacted receipts, and stop agent handoff. It cannot approve spending, signing, token movement, payout-route changes, publishing, outreach, access sharing, paid commitments, merges, bans, or irreversible moderation.

## Pattern 1: redacted workflow summary

Use this pattern when the scan should leave a public-safe CI summary without reposting hostile content.

```yaml
- name: Summarize intake guardrail result
  if: always()
  run: |
    {
      echo "### Intake Guardrail"
      echo "- Action: ${{ steps.scan.outputs.action }}"
      echo "- Level: ${{ steps.scan.outputs.level }}"
      echo "- Safe for normal automation: ${{ steps.scan.outputs.safe }}"
      echo "- Payload copied: no"
      echo "- Maintainer review needed: ${{ steps.scan.outputs.safe != 'true' }}"
    } >> "$GITHUB_STEP_SUMMARY"
```

Safe because it records routing metadata only. It does not echo the issue body, comment body, decoded text, raw `flags`, or raw `report` into a public summary.

## Pattern 2: block agent handoff on quarantine or block

Use this pattern when another workflow step would pass issue content to an agent.

```yaml
- name: Stop unsafe agent handoff
  if: ${{ steps.scan.outputs.action == 'quarantine' || steps.scan.outputs.action == 'block' }}
  run: |
    echo "Intake Guardrail stopped agent handoff. Human review required."
    exit 1
```

Safe because the failure is explicit and reviewable. The next agent step should depend on this gate and should not receive the raw intake payload when the guardrail routes to quarantine or block.

## Pattern 3: maintainer-only artifact with retention

Use this pattern when maintainers need structured output for review. Keep retention short and avoid public comments that include hostile text.

```yaml
- name: Write redacted guardrail receipt
  run: |
    mkdir -p .orbit-intake
    cat > .orbit-intake/receipt.json <<'JSON'
    {
      "source": "github-event",
      "action": "${{ steps.scan.outputs.action }}",
      "level": "${{ steps.scan.outputs.level }}",
      "safe": "${{ steps.scan.outputs.safe }}",
      "payloadCopied": false,
      "humanReviewNeeded": "${{ steps.scan.outputs.safe != 'true' }}"
    }
    JSON

- name: Upload guardrail receipt
  uses: actions/upload-artifact@v4
  with:
    name: intake-guardrail-receipt
    path: .orbit-intake/receipt.json
    retention-days: 7
```

Safe because the artifact records decisions, not the risky payload. Maintainers who need deeper inspection should use GitHub's native issue/comment view and local review policy rather than injecting raw hostile content into agent context.

## Pattern 4: soft warning for normal triage

Use this pattern when the scan result is `warn` and the repository still wants normal maintainer triage.

```yaml
- name: Continue with caution
  if: ${{ steps.scan.outputs.action == 'warn' }}
  run: |
    echo "Guardrail warning present. Maintainer should verify instructions before acting."
```

Safe because it adds friction without treating the scanner as a final moderation authority.

## Consumer checklist

Before wiring the Action into a repository, confirm:

- [ ] The workflow never echoes raw issue/comment bodies into public summaries.
- [ ] Obfuscated or encoded content is not decoded and reposted by automation.
- [ ] `quarantine` and `block` stop downstream agent handoff.
- [ ] Receipts say whether payload was copied; the safe default is `false`.
- [ ] Maintainers remain the decision makers for moderation, labels, merges, and issue closure.
- [ ] Approval-class actions remain outside the guardrail: spending, signing, token actions, payout-route changes, publishing, outreach, access sharing, and paid commitments require the repository's normal approval gates.

## Non-goals

These patterns are not a marketplace publication, paid service promise, external outreach plan, legal or security guarantee, or wallet-control mechanism. They are repo-local documentation for safer consumption of an advisory intake signal.
