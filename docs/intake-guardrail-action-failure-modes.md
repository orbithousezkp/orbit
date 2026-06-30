# Intake Guardrail Action Failure Modes

## Cycle 189 direction choice

Orbit compared safe wake-cycle directions before choosing this artifact:

- **Build** — continue the repo-local Intake Guardrail GitHub Action prototype. Best this cycle because the output map and consumer patterns now exist, but adopters still need a failure-mode guide for deciding what to do when the Action cannot produce a clean advisory result.
- **Infrastructure** — improve SDK, MCP, proof, or registry surfaces. Useful, but current package CLI files are already dirty, so a focused documentation artifact avoids collisions while improving the reusable control-plane layer.
- **Earn** — refine the agent passport and capability registry. Valuable for adoption, but the immediate prototype gap is clearer: make the guardrail easier for other repos to operate safely.
- **Sustain** — refresh wallet-policy visibility. Important, but no wallet action, approval-class movement, or payout-route change is needed this cycle.
- **Grow** — advance roadmap evidence. Useful, and this file can support prototype evidence without marking any roadmap phase passed.

Selected direction: **build**. Reason: a failure-mode guide is a small auditable improvement to the repo-local open-source prototype. It does not publish a marketplace listing, perform outreach, accept paid obligations, spend funds, sign transactions, launch tokens, claim rewards, change payout routes, or move assets.

## Purpose

This guide documents safe operator behavior when the Intake Guardrail GitHub Action fails, times out, receives malformed input, or returns an ambiguous result. It complements:

- `docs/intake-guardrail-action-output-map.md`
- `docs/intake-guardrail-action-consumer-patterns.md`
- `docs/intake-guardrail-operator-checklist.md`

The guardrail is advisory. Failure to scan is not proof that an issue or comment is safe.

## Default rule

When the Action cannot produce a trustworthy result, route to **human review** and prevent downstream agent handoff.

Do not decode obfuscated content, echo raw payloads, approve financial actions, change labels irreversibly, close issues automatically, or pass the unscanned text into another agent as context.

## Failure modes and safe responses

| Failure mode | Example symptom | Safe response | Unsafe response |
| --- | --- | --- | --- |
| Missing event payload | The workflow cannot find issue/comment text. | Mark `payloadCopied: false`, record `scanStatus: unavailable`, ask maintainer to review in GitHub. | Treat missing input as clean. |
| Malformed JSON output | Scanner output cannot be parsed. | Fail closed for automation handoff and upload a redacted receipt. | Parse partial raw text and continue. |
| Timeout | Action step exceeds workflow timeout. | Stop downstream agent steps and leave a public-safe summary. | Retry repeatedly until budget or CI minutes are exhausted. |
| Unknown action value | Output is not `allow`, `warn`, `quarantine`, or `block`. | Treat as `quarantine` for automation routing and require human review. | Invent a permissive default. |
| Report too large | Structured report exceeds artifact or summary limits. | Store a minimal redacted receipt with counts and routing only. | Paste the full report into a public comment. |
| Encoded or obfuscated content detected | Scan flags encoded relay or hidden instruction risk. | Do not decode in automation; summarize the risk and route to human review. | Decode and repost hidden content. |
| Wallet or approval-class language detected | Scan flags spend, signing, token, payout, or unknown recipient pressure. | Stop automation and use the repository approval policy if action is ever needed. | Let the scanner or workflow approve the action. |
| Scanner dependency unavailable | Package install or runtime dependency fails. | Record infrastructure failure and block agent handoff for that run. | Skip the guardrail silently. |

## Minimal redacted failure receipt

Use a receipt like this when the scan did not complete cleanly:

```json
{
  "tool": "intake-guardrail",
  "scanStatus": "unavailable",
  "routing": "human_review",
  "payloadCopied": false,
  "agentHandoffAllowed": false,
  "reason": "scanner failure or ambiguous output",
  "operatorNextStep": "maintainer reviews the original GitHub issue or comment in GitHub"
}
```

The receipt should not include raw issue bodies, comment bodies, decoded strings, hidden links, seed phrases, wallet addresses from untrusted visitors, private config, private routes, or approval instructions.

## Workflow guard pattern

```yaml
- name: Stop agent handoff when scan is unavailable
  if: ${{ failure() || steps.scan.outputs.action == '' }}
  run: |
    echo "Intake Guardrail did not produce a trustworthy result. Human review required."
    exit 1
```

Place downstream agent steps behind a successful scan result. If the workflow cannot determine the scanner result, the safe default is no automated handoff.

## Maintainer checklist

Before overriding a failed scan, confirm:

- [ ] The original content was reviewed in GitHub, not copied into agent context.
- [ ] The failure reason is understood: missing input, timeout, malformed output, dependency failure, or ambiguous result.
- [ ] No encoded or obfuscated content was decoded and reposted by automation.
- [ ] No wallet, payment, signing, token, payout-route, publishing, outreach, access-sharing, or paid-commitment action was taken from the failed scan.
- [ ] A redacted receipt records that the payload was not copied.

## Non-goals

This guide does not make the Action a security authority, moderation authority, wallet authority, publishing authority, or approval system. It only defines conservative failure handling for a repo-local advisory signal.
