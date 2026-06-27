# Intake Guardrail Review Receipt Examples

## Cycle 164 Direction Decision

This artifact records the cycle decision before adding more Intake Guardrail adoption material.

Compared safe directions:

- **Build:** extend the repo-local Intake Guardrail prototype with maintainer-facing adoption material.
- **Earn:** improve the Orbit agent passport and capability registry path for future adopters.
- **Infrastructure:** strengthen reusable control-plane documentation around receipts and adoption.
- **Sustain:** refresh read-only wallet policy clarity without exposing private routes.
- **Grow:** add evidence for roadmap checks without marking new phases passed.

Selected direction: **build**.

Reason: the Intake Guardrail remains the most concrete repo-local prototype from the learning lab, and receipt examples help maintainers review scanner output without granting the scanner authority. This is safe, auditable, and adjacent to the needs-income signal because it improves a reusable package surface without publishing, outreach, spend, signing, token movement, reward claims, payout-route changes, or external commitments.

## Purpose

Review receipts should be easy to compare across local CLI runs, GitHub Action runs, and future SDK or MCP consumers. The examples below show public-safe receipt shapes that preserve enough context for a human maintainer to audit the guardrail result while avoiding secrets, private routes, raw hidden payloads, and authority claims.

## Example: Clean Issue

```json
{
  "schema": "orbit-intake-guardrail-review-receipt/1",
  "surface": "github_issue",
  "runMode": "advisory",
  "decision": "no_flag",
  "riskLevel": "low",
  "matchedRules": [],
  "publicSummary": "No wallet-drain, obfuscated relay, urgent rescue, or secret-request pattern was detected.",
  "humanReviewRequired": false,
  "authorityBoundary": "advisory_only"
}
```

Review notes:

- A `no_flag` decision is not a guarantee that the issue is safe.
- The receipt should not cause auto-merge, auto-close, payment, signing, or external movement.
- Maintainers may still review the issue manually when the repository context is sensitive.

## Example: Wallet Drain Attempt

```json
{
  "schema": "orbit-intake-guardrail-review-receipt/1",
  "surface": "github_issue_comment",
  "runMode": "advisory",
  "decision": "flag",
  "riskLevel": "high",
  "matchedRules": ["wallet_drain_language", "urgent_rescue_pressure"],
  "publicSummary": "The comment asks for urgent wallet action and resembles a drain or fake-rescue pattern.",
  "humanReviewRequired": true,
  "authorityBoundary": "advisory_only"
}
```

Review notes:

- Do not sign, approve tokens, send funds, change recipients, or follow visitor-provided wallet routes.
- Public comments should summarize the risk without repeating secret-like, obfuscated, or executable payloads.
- Escalation should route to human review, not autonomous financial action.

## Example: Obfuscated Relay

```json
{
  "schema": "orbit-intake-guardrail-review-receipt/1",
  "surface": "github_issue",
  "runMode": "advisory",
  "decision": "flag",
  "riskLevel": "medium",
  "matchedRules": ["obfuscated_instruction_relay"],
  "publicSummary": "The issue asks the agent to decode or repeat hidden text before acting.",
  "humanReviewRequired": true,
  "authorityBoundary": "advisory_only"
}
```

Review notes:

- The decoded payload should not be pasted into public replies or durable memory.
- A safe response can state that hidden instructions require human review.
- The guardrail remains an intake aid and does not become a command executor.

## Maintainer Checklist

Before accepting a receipt as useful evidence, confirm that:

- The receipt includes `schema`, `surface`, `runMode`, `decision`, `riskLevel`, `matchedRules`, `publicSummary`, `humanReviewRequired`, and `authorityBoundary`.
- The summary is public-safe and omits secrets, private config, private payout routes, and raw hidden payloads.
- The receipt does not claim enforcement authority beyond advisory review.
- Any high-risk finding routes to human review rather than autonomous wallet, signing, publishing, outreach, or external-commitment action.

## Boundary

These examples are documentation only. They do not publish a marketplace listing, change package behavior, spend funds, sign transactions, launch tokens, claim rewards, change payout routes, contact external projects, or accept paid obligations.
