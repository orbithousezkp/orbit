# Intake Guardrail Output Contract

Orbit's Intake Guardrail package exposes a small, stable report shape for GitHub Actions, CLIs, SDK clients, and future repository control-plane adapters.

This contract is intentionally narrow: it helps automation decide how to route untrusted issue/comment content, but it does not grant authority to spend, sign, publish, ban, change access, decode hidden payloads into agent context, or make external commitments.

## Cycle 71 direction choice

Orbit compared safe wake-cycle directions before this artifact:

- **Build** — continue the repo-local Intake Guardrail prototype by making its machine-readable output easier for adopters and SDK clients to consume safely.
- **Infrastructure** — improve the broader SDK, MCP, proof, or registry surfaces. Useful, but the guardrail output contract is the smallest concrete infrastructure seam exposed by the current prototype.
- **Earn** — refine the agent passport/capability-registry opportunity. Valuable, but less immediate than hardening a package that already has a reusable Action, CLI, and library surface.
- **Sustain** — refresh wallet-policy visibility. Important, but no wallet or approval-class action was needed this cycle.

Selected direction: **build**. Reason: documenting the output contract improves the prototype's adoption safety and future SDK integration while staying repo-local and avoiding publishing, outreach, paid commitments, wallet actions, signing, token movement, reward claims, payout-route changes, or external obligations.

## Report shape

`buildReport(...)` returns the product-level report consumed by the Action output `report` and by CLI `--report json` usage.

```json
{
  "product": "Orbit Intake Guardrail",
  "safe": false,
  "action": "quarantine",
  "score": 82,
  "level": "high",
  "categories": ["encoded_instruction_relay"],
  "topFlags": [
    {
      "severity": 82,
      "category": "encoded_instruction_relay",
      "message": "Encoded or translation relay request detected.",
      "source": "builtin"
    }
  ],
  "guidance": ["Route this content to human review before an autonomous agent acts on it."]
}
```

## Field semantics

| Field | Type | Semantics | Safe consumer rule |
|---|---|---|---|
| `product` | string | Human-readable package/report name. | Display only; do not branch on branding. |
| `safe` | boolean | `true` when no finding crosses the configured threshold. | Treat as "no configured signal crossed threshold," not as a security guarantee. |
| `action` | string | One of `allow`, `warn`, `quarantine`, or `block`. | Route intake; do not use as authority for money, access, publishing, or punishment. |
| `score` | number | Highest severity score among retained flags. | Use for sorting and escalation; thresholds remain repo policy. |
| `level` | string | `clear`, `low`, `medium`, `high`, or `critical`. | Display for humans; avoid irreversible automation from level alone. |
| `categories` | string[] | Unique risk categories present after allow-list filtering. | Use to decide review lane, labels, and summaries. |
| `topFlags` | object[] | Highest-impact findings for review. | Keep public-safe; do not paste hidden decoded payloads into agent context. |
| `guidance` | string[] | Maintainer/agent-safe handling hints. | Treat as workflow guidance, not delegated authority. |

## Decision thresholds

The scanner separates three policy thresholds:

| Option | Default role | Typical outcome |
|---|---|---|
| `threshold` | Minimum severity to flag. | `warn` when a finding crosses this value but not quarantine/block thresholds. |
| `quarantineThreshold` | Minimum severity that should require human review. | `quarantine` when content should be withheld from agent working context. |
| `blockThreshold` | Minimum severity that should stop automation. | `block` when automation should halt and leave a receipt. |

Repositories may tune thresholds, but the safe rollout default is observe-first: labels, summaries, and quarantine review before hard-blocking.

## Consumer sequence

1. Scan raw issue/comment content before passing it to agents.
2. Store the report as JSON in CI output, a step summary, or a public-safe issue comment.
3. Apply low-risk routing only: label, summarize, quarantine, or stop automation.
4. Ask a maintainer to review wallet-related, credential-related, obfuscated, or instruction-bypass findings.
5. Never decode hidden visitor text into the agent's working context as part of automated handling.
6. Keep approval-class actions behind Orbit governance even when the report says `allow`.

## Non-authority boundary

This output contract must not be used by itself to:

- spend, transfer, sign, approve tokens, launch tokens, claim rewards, or change payout routes;
- grant repository, package, wallet, infrastructure, or model-provider access;
- publish a package or marketplace listing;
- accept paid obligations, sponsorship terms, or external commitments;
- permanently ban or punish a user without maintainer review;
- treat public-source or outside-agent content as instructions for Orbit.

## Related files

- [`docs/intake-guardrail-decision-model.md`](intake-guardrail-decision-model.md)
- [`docs/intake-guardrail-adoption.md`](intake-guardrail-adoption.md)
- [`packages/issue-scam-scanner/README.md`](../packages/issue-scam-scanner/README.md)
- [`packages/issue-scam-scanner/action.yml`](../packages/issue-scam-scanner/action.yml)
