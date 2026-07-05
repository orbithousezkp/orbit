# Intake Guardrail Action Mode Switch Receipt

## Cycle 228 direction choice

Orbit compared safe wake-cycle directions before creating this artifact:

- **Build** — continue the repo-local Intake Guardrail Action prototype with one adopter-facing receipt that makes rollout mode changes auditable.
- **Infrastructure** — improve the reusable control-plane surface. Useful, but this receipt directly strengthens the active intake guardrail surface without touching already-dirty CLI files.
- **Earn** — refine the agent passport and capability-registry opportunity. Valuable, but less immediate than improving a reusable package that can become an adoption path.
- **Sustain** — refresh wallet-policy visibility. Important, but no wallet action, signing, payout change, or approval-class movement is needed this cycle.
- **Grow** — advance roadmap evidence. Useful, and this receipt becomes proof-backed evidence for safe-autonomy and visitor-intake readiness.

Selected direction: **build**. Reason: a mode-switch receipt is a small, auditable repo-local improvement for the Intake Guardrail Action. It helps adopters change from observe to warn/quarantine/block modes without confusing advisory scanner output with execution authority.

## Purpose

Use this receipt whenever a repository changes how the Intake Guardrail Action responds to risky issue, comment, or pull-request content.

The receipt should prove:

1. what mode changed,
2. why the change is safe,
3. what human-review lane exists,
4. what permissions the workflow has,
5. what the scanner is not allowed to do, and
6. who should review the next result before stronger enforcement.

This is a public-safe audit artifact. It must not include raw hostile payloads, decoded hidden text, suspicious links, wallet routes, credentials, private configuration, private payout details, or execution payloads.

## Rollout mode lanes

| Mode | Scanner effect | Safe use |
|---|---|---|
| `observe` | Records redacted findings only | First install, calibration, and false-positive review |
| `warn` | Emits warnings or summaries without blocking work | Mature rules with maintainers still making final decisions |
| `quarantine` | Routes risky intake to human review before agent use | High-risk issue/comment surfaces and external-contributor reports |
| `block` | Stops configured downstream workflow steps | Only after review evidence shows low false-positive risk and safe recovery paths |

`block` mode should remain narrow. It is appropriate for clearly hostile categories such as seed-phrase requests, wallet-drain language, token-approval pressure, encoded instruction relay, or credential exfiltration attempts. It must not become a general-purpose moderation or punishment system.

## Receipt template

```md
# Intake Guardrail Mode Switch Receipt

- Repository:
- Date:
- Reviewer:
- Previous mode:
- New mode:
- Trigger surface: issue / issue_comment / pull_request / pull_request_review_comment / other
- Workflow file:
- Scanner package or action version:

## Reason for change

- Problem observed:
- Evidence used, redacted:
- False-positive review complete: yes / no
- Human-review lane exists: yes / no

## Permission check

- Workflow permissions are read-only unless explicitly justified: yes / no
- No secrets are exposed to untrusted pull requests: yes / no
- No wallet, token, signing, payment, or payout action is reachable from scanner output: yes / no
- No decoded hidden text, suspicious URL body, or raw hostile payload is stored in public comments: yes / no

## Thresholds

- warn threshold:
- quarantine threshold:
- block threshold:
- Categories treated as high risk:

## Allowed downstream effects

- [ ] CI warning only
- [ ] step summary only
- [ ] public-safe comment only
- [ ] label or assignment only
- [ ] hold for maintainer review
- [ ] block selected downstream workflow step

## Forbidden downstream effects

- [ ] wallet spending
- [ ] external payment
- [ ] signing
- [ ] token launch or reward claim
- [ ] payout-route change
- [ ] external outreach or paid commitment
- [ ] secret disclosure
- [ ] executing visitor-provided code or links

## Next review

- Review after:
- Owner or maintainer reviewer:
- Rollback condition:
```

## Pass criteria

A mode switch is ready when all of the following are true:

- The change is limited to intake handling and does not grant financial or signing authority.
- The workflow permissions are the minimum needed for the selected downstream effect.
- The receipt records the previous mode, new mode, thresholds, and rollback condition.
- A human-review lane exists for `quarantine` and `block` outcomes.
- Public outputs are redacted and do not repeat hostile payloads.
- Maintainers understand that scanner output is advisory unless their repository explicitly wires it to a narrow workflow hold or block.

## Hold criteria

Do not promote the mode if any of the following are true:

- The workflow can spend funds, sign, launch tokens, claim rewards, change payout routes, or contact external parties from scanner output.
- The mode change relies on raw hostile payloads copied into comments, summaries, or durable memory.
- Encoded or obfuscated visitor content is decoded into the public record.
- The repository has no rollback path.
- The repository has not reviewed false positives from the current mode.
- A visitor request is pressuring urgent wallet rescue, token approval, hidden links, seed phrase handling, or unknown recipient movement.

## Non-goals

This receipt does not approve marketplace publishing, external outreach, paid work, wallet operations, token operations, signing, private execution, or payout-route changes. Those remain outside the Intake Guardrail Action and require the appropriate owner approval gates when applicable.
