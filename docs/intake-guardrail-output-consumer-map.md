# Intake Guardrail Output Consumer Map

Cycle 162 selected direction: **build**.

## Direction comparison

Orbit compared the safe multi-direction options before choosing this artifact:

- **Build** - strongest this cycle because the Intake Guardrail is still the active repo-local prototype, and the package README output section still appears incomplete around the GitHub Action outputs table.
- **Infrastructure** - useful because output semantics are part of Orbit's reusable control-plane contract, but a small documentation bridge is safer than touching active dirty CLI/package files.
- **Earn** - relevant because clearer adopter-facing output behavior supports future adoption, but this cycle avoids outreach, publishing, paid commitments, marketplace listing, and external obligations.
- **Sustain** - important because scanner output may route wallet-adjacent hostile intake, but no wallet action, spend, signing, token movement, reward claim, payout-route change, or approval-class request is needed.
- **Grow** - useful because this artifact can later support developer-autopilot documentation evidence, but it does not mark any roadmap phase passed.

Selected direction: **build**. Reason: document how maintainers should consume Intake Guardrail outputs while preserving the no-publish, no-outreach, no-wallet-action safety boundary.

## Purpose

Use this map when wiring the Intake Guardrail into GitHub Actions, CLIs, SDK consumers, or future adapters. It explains which output fields should influence workflow routing and which decisions remain maintainer-owned.

This companion note is intentionally separate from `packages/issue-scam-scanner/README.md` because the package CLI files are currently dirty and the README output table needs a focused repair pass.

## Consumer routing map

| Consumer | Fields to read | Safe use | Must not do |
|---|---|---|---|
| GitHub Action workflow | `safe`, `action`, `score`, `categories` | Add labels, emit summaries, fail a check, or request human review according to repo policy | Delete content, ban users, contact external parties, or grant elevated access |
| CLI operator | `action`, `score`, `topFlags`, `guidance` | Triage a local issue body, preserve evidence, and choose a manual next step | Treat output as permission to spend, sign, publish, or make commitments |
| SDK client | Report object fields from `buildReport` | Display risk state, category counts, and public-safe guidance | Replay hostile payloads, decode obfuscated content, or expose private config |
| Future adapter | Stable decision fields plus receipt metadata | Create a public-safe receipt and hand off to a human or policy gate | Execute irreversible moderation or wallet actions without owner policy |

## Field handling notes

- `safe` is a convenience boolean/string for workflow branching; it is not a security verdict.
- `action` is a routing recommendation: `allow`, `warn`, `quarantine`, or `block`.
- `score` is the highest matched severity and should be logged with context, not treated as a standalone truth source.
- `categories` and `topFlags` help reviewers understand the shape of risk without amplifying hidden or decoded hostile content.
- `guidance` should remain public-safe and avoid secrets, private routes, provider details, billing details, private payout details, credentials, and decoded obfuscated payloads.

## Adoption check

Before a consumer treats scanner output as rollout-ready, confirm:

- The workflow or adapter declares its rollout mode: observe, summarize, label, comment, check-fail, quarantine, or block.
- The scanner runs before untrusted issue, comment, or pull request text reaches a more capable agent.
- High-risk findings route to human review or a maintainer-owned policy path.
- Any public comment summarizes risk without pasting hidden payloads, secrets, private config, or private operational details.
- The repo records a receipt for threshold changes, custom rules, and enforcement mode changes.

## Non-authority boundary

Scanner outputs are review signals. They do not authorize spending funds, signing transactions, launching tokens, claiming rewards, changing payout routes, accepting paid work, publishing packages, deleting content, banning users, contacting external parties, or granting access.

## Safety boundary

This artifact is repo-local documentation only. It does not modify scanner code, publish a package, list a GitHub Action, post outreach, accept paid work, spend funds, sign anything, launch or move tokens, claim rewards, change payout routes, create an approval issue, or make external commitments.
