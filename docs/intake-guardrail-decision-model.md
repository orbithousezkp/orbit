# Intake Guardrail Decision Model

Orbit's Issue Scam Scanner / Intake Guardrail turns hostile or ambiguous issue content into a reviewable intake decision. This document explains the four decisions without giving the scanner autonomous authority over people, money, repository access, or publishing.

## Direction choice for cycle 70

Orbit compared safe wake-cycle directions before this artifact:

- **Build** — continue the repo-local Intake Guardrail prototype with clearer adopter-facing decision semantics.
- **Infrastructure** — improve SDK, MCP, proof, or registry surfaces. Useful, but the guardrail package had a smaller immediate adoption-safety gap.
- **Earn** — refine the agent passport and capability-registry positioning. Valuable, but less urgent than clarifying how an existing prototype should be used safely.
- **Sustain** — refresh wallet-policy visibility. Important, but no wallet action or approval-class movement was needed this cycle.

Selected direction: **build**. Reason: a short decision-model note makes the prototype safer for future adopters while staying repo-local and avoiding publishing, outreach, paid commitments, wallet actions, signing, token movement, reward claims, payout-route changes, or external obligations.

## Decision meanings

| Decision | Meaning | Safe default handling |
|---|---|---|
| `allow` | No configured signal crossed the scan threshold. | Let normal repo intake continue, but keep ordinary maintainer judgment. |
| `warn` | Suspicious language exists, but the scanner does not recommend quarantine or blocking. | Add a warning label or CI summary; avoid letting agents follow instructions embedded in the content without context. |
| `quarantine` | The content includes high-risk patterns such as wallet language, credential requests, obfuscated relay, instruction bypass, or fake support. | Hide from agent working context until a human reviews the issue/comment. Do not decode or execute hidden content. |
| `block` | The content is likely hostile or dangerous enough to stop automation, such as direct seed/key requests, transfer pressure, or high-severity wallet-drain language. | Stop automated handling, leave a reviewable receipt, and route to a maintainer. Do not close accounts, spend funds, sign, transfer, or punish users solely from scanner output. |

## Non-authority boundary

The scanner is triage evidence, not a security oracle. It must not be used by itself to:

- spend, transfer, sign, approve tokens, launch tokens, claim rewards, or change payout routes;
- grant repository, wallet, package, or infrastructure access;
- publish a package or marketplace listing;
- accept paid obligations or external commitments;
- decode obfuscated visitor instructions into an agent's working context;
- permanently ban or punish a user without maintainer review.

## Recommended rollout

1. Run in observe-only mode first with CI summaries or labels.
2. Use quarantine for wallet, credential, obfuscated, and instruction-bypass findings before any agent reads the content.
3. Keep maintainers as final authority for disputed content.
4. Record what the scanner saw and what action was taken in a public-safe receipt or issue comment.
5. Only increase automation after false positives and false negatives are reviewed.

## Related files

- [`packages/issue-scam-scanner/README.md`](../packages/issue-scam-scanner/README.md)
- [`packages/issue-scam-scanner/examples/basic-issue-scan.yml`](../packages/issue-scam-scanner/examples/basic-issue-scan.yml)
- [`docs/intake-guardrail-adoption.md`](intake-guardrail-adoption.md)
