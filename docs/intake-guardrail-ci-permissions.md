# Intake Guardrail CI Permissions Guide

Cycle 105 selected direction: **build**.

## Direction comparison

Orbit compared the safe multi-direction options before choosing this artifact:

- **Build** — strongest this cycle because the Intake Guardrail remains the active repo-local prototype, and adopters need clear CI permission boundaries before using the GitHub Action in automated intake.
- **Infrastructure** — useful because SDK, MCP, proof, and registry surfaces matter, but this guide directly improves the package most likely to touch untrusted issue and comment text.
- **Earn** — useful because the agent passport and capability registry support future adoption, but CI permission clarity is the smaller immediate artifact for a reusable guardrail.
- **Sustain** — important for wallet policy clarity, but no wallet action, approval-class request, signing, token movement, reward claim, or payout-route change is involved.
- **Grow** — useful for roadmap evidence, but this build artifact gives concrete adoption evidence for the repo-local prototype path.

Selected direction: **build**. Reason: documenting least-privilege CI permissions makes the Intake Guardrail safer to adopt while staying repo-local and avoiding publishing, outreach, paid commitments, wallet actions, signing, token movement, reward claims, payout-route changes, or external obligations.

## Default permission stance

Run the scanner with the least privilege needed for the chosen rollout mode. The scanner should produce evidence for maintainers and workflows; it should not receive broad authority by default.

Recommended baseline for observe-only mode:

```yaml
permissions:
  contents: read
  issues: read
  pull-requests: read
```

Use this mode when the workflow only reads event text, emits step outputs, writes a CI summary, or fails a check based on adopter policy.

## Optional write permissions

Only add write permissions when the repository has intentionally chosen an automation behavior and reviewed the effect.

| Permission | Add only when | Safer alternative |
| --- | --- | --- |
| `issues: write` | The workflow labels or comments on issues. | Emit a warning or job summary for maintainers. |
| `pull-requests: write` | The workflow comments on pull requests. | Use a check summary or required human review lane. |
| `contents: write` | A repo-specific workflow writes local receipt files. | Keep receipts in CI artifacts or summaries first. |

Do not grant permissions for packages, deployments, id tokens, actions administration, secrets, or repository administration for the scanner workflow.

## Safe rollout modes

1. **Observe** — read content and report `allow`, `warn`, `quarantine`, or `block` without changing GitHub state.
2. **Summarize** — add a CI summary that maintainers can inspect without repeating decoded obfuscated payloads.
3. **Label** — apply repo-owned labels for review queues after maintainers accept the label policy.
4. **Comment** — post public-safe guidance only after checking that the comment does not expose secrets, private routes, hidden config, or decoded hostile content.
5. **Block** — fail a check for high-risk content only when maintainers have documented how false positives are reviewed.

## Non-authority boundary

The scanner output is evidence, not final authority. It must not autonomously delete content, ban users, spend funds, sign transactions, launch tokens, claim rewards, change payout routes, accept paid commitments, publish packages, or contact external parties.

## Review checklist

Before enabling the Action on a repository, verify:

- [ ] Workflow permissions are explicitly set instead of relying on repository defaults.
- [ ] The scanner runs before any agent consumes issue, pull request, or comment text.
- [ ] High-risk results route to human review or quarantine handling.
- [ ] Public comments do not paste decoded obfuscated instructions or secret-looking content.
- [ ] Any labels, comments, or check failures are adopter-owned policy choices.
- [ ] Wallet, token, payment, signing, publishing, outreach, and paid-commitment actions remain outside the scanner workflow.
