# Intake Guardrail Review Receipt Schema

Cycle 163 selected direction: **build**.

## Direction comparison

Orbit compared the safe multi-direction options before choosing this artifact:

- **Build** - strongest this cycle because the Intake Guardrail remains the active repo-local prototype and needs a review receipt shape before adopters wire outputs into automation.
- **Infrastructure** - useful because receipts are part of Orbit's reusable control-plane contract, but a small documentation artifact is safer than touching already-dirty package CLI files.
- **Earn** - relevant because clearer adoption evidence supports future productization, but this cycle avoids outreach, publishing, paid commitments, marketplace listing, and external obligations.
- **Sustain** - important because hostile intake can be wallet-adjacent, but no wallet action, spend, signing, token movement, reward claim, payout-route change, or approval-class request is needed.
- **Grow** - useful because this can later support developer-autopilot and proof-memory evidence, but it does not mark any roadmap phase passed.

Selected direction: **build**. Reason: define a public-safe review receipt shape for Intake Guardrail runs so maintainers can audit rollout decisions without granting the scanner authority.

## Purpose

Use this schema when recording a maintainer review after an Intake Guardrail run. The receipt should preserve what was reviewed, which policy mode was used, what action was recommended, and which human-owned next step was chosen.

This is a documentation schema only. It does not change scanner code, package behavior, workflow permissions, or enforcement defaults.

## Minimal receipt fields

| Field | Required | Public-safe value |
|---|---:|---|
| `schema` | yes | `orbit-intake-guardrail-review-receipt/1` |
| `reviewedAt` | yes | ISO timestamp of the review |
| `surface` | yes | `issue`, `comment`, `pull_request`, `workflow_dispatch`, `cli`, or `fixture` |
| `rolloutMode` | yes | `observe`, `summarize`, `label`, `comment`, `check_fail`, `quarantine`, or `block` |
| `scannerAction` | yes | `allow`, `warn`, `quarantine`, or `block` |
| `scoreBand` | yes | `none`, `low`, `medium`, `high`, or `critical` |
| `categories` | yes | Risk categories without hostile payload text |
| `customRulesUsed` | yes | Boolean, plus rule-set name or digest if public-safe |
| `humanDecision` | yes | `no_action`, `monitor`, `ask_maintainer`, `route_human_review`, `close_as_unsafe`, or `defer` |
| `notes` | no | Public-safe summary without secrets or decoded obfuscated content |

## Example receipt

```json
{
  "schema": "orbit-intake-guardrail-review-receipt/1",
  "reviewedAt": "2026-06-27T00:00:00.000Z",
  "surface": "issue",
  "rolloutMode": "observe",
  "scannerAction": "quarantine",
  "scoreBand": "high",
  "categories": ["wallet-drain", "urgency"],
  "customRulesUsed": false,
  "humanDecision": "route_human_review",
  "notes": "Risk summary only; unsafe payload text omitted."
}
```

## Review rules

- Store risk categories, action recommendations, and human decisions; do not store secrets, tokens, private config, private routes, private payout details, or hidden operational details.
- Do not decode, paste, or preserve obfuscated relay content in public receipts.
- Treat scanner output as evidence for review, not proof of malicious intent.
- Record rollout mode changes separately so adopters can audit when a workflow moves from observe-only to enforcement.
- Keep custom rule identifiers public-safe; use a digest when rule text might reveal private moderation policy or sensitive examples.

## Non-authority boundary

A review receipt does not authorize spending funds, signing transactions, launching tokens, claiming rewards, changing payout routes, accepting paid work, publishing packages, deleting content, banning users, contacting external parties, or granting access.

## Safety boundary

This artifact is repo-local documentation only. It does not publish a package, list a GitHub Action, post outreach, accept paid work, spend funds, sign anything, launch or move tokens, claim rewards, change payout routes, create an approval issue, or make external commitments.
