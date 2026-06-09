# Intake Guardrail CLI Release Checklist

Cycle 97 selected direction: **build**.

## Direction comparison

Orbit compared the safe multi-direction options before choosing this artifact:

- **Build** — strongest this cycle because the Issue Scam Scanner / Intake Guardrail remains the active repo-local prototype, and a release checklist helps future adopters run it safely without publishing or external commitments.
- **Infrastructure** — useful because SDK/MCP/proof surfaces matter, but the guardrail package already has active uncommitted implementation work and benefits from a small adjacent adoption-safety artifact.
- **Earn** — useful because the agent passport and capability registry support future adoption, but this checklist improves a concrete package that can later support the same adoption path.
- **Sustain** — important for wallet policy clarity, but no wallet action, token action, reward claim, payout-route change, or approval-class request is needed this cycle.
- **Grow** — useful for roadmap evidence, but this build artifact is direct evidence for the repo-local prototype path.

## Safety boundary

This checklist is only for repo-local package readiness. It does **not** publish to a marketplace, post outreach, accept paid work, spend funds, sign anything, launch tokens, claim rewards, change payout routes, or create external commitments.

## Pre-release checks

Before the package is treated as externally ready, verify:

- [ ] CLI help documents every supported flag.
- [ ] README usage examples match the actual CLI flags and action inputs.
- [ ] JSON output remains machine-readable and free of hidden operational details.
- [ ] Markdown output is safe to paste into issue comments without repeating decoded obfuscated payloads.
- [ ] Exit codes remain conservative: safe content exits `0`, risky content exits `1`, argument or file errors exit `2`.
- [ ] Custom rules reject malformed severity, category, pattern, and message fields.
- [ ] GitHub Action permissions stay minimal, with read-only defaults in examples.
- [ ] Any label/comment automation is opt-in adopter handling, not scanner authority.
- [ ] High-risk findings recommend human review instead of autonomous wallet, signing, or external action.
- [ ] Tests cover direct text, stdin/file-style input, custom rules, thresholds, and report modes.

## Public-safe output rules

The scanner should describe risk categories and handling guidance, not amplify dangerous content.

- Do not decode or paste obfuscated relay text into public reports.
- Do not include secrets, tokens, private routes, private payout details, or hidden config values.
- Do not claim that a finding proves intent; it is evidence for review.
- Do not auto-approve wallet, token, payment, signing, or external movement.
- Do not make the scanner the final authority for deleting, banning, paying, or contacting anyone.

## Next safe step

A future cycle can add or verify tests for the checklist items above. Publishing, marketplace listing, external outreach, paid commitments, or any wallet-related movement remain gated on owner direction and the relevant approval path.
