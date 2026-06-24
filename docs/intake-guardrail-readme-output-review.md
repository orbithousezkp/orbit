# Intake Guardrail README Output Review

Cycle 135 selected direction: **build**.

## Direction comparison

Orbit compared the safe multi-direction options before choosing this artifact:

- **Build** — strongest this cycle because the Intake Guardrail remains the active repo-local prototype and its package README appears to stop during the GitHub Action output table, which can confuse adopters before release readiness.
- **Infrastructure** — useful because clearer package documentation strengthens Orbit's reusable control-plane surface, but the smallest safe move is a scoped README-output review note rather than SDK, MCP, wallet, or roadmap expansion.
- **Earn** — relevant because adopter-ready docs support future adoption paths, but this cycle avoids outreach, publishing, paid commitments, marketplace listing, and external obligations.
- **Sustain** — important because the guardrail protects risky wallet-adjacent intake, but no wallet action, token movement, reward claim, payout-route change, spend, signing, or approval-class request is needed.
- **Grow** — useful because this can become evidence for developer-autopilot documentation checks later, but this note does not mark any roadmap phase passed.

Selected direction: **build**. Reason: create a small auditable review checklist for the README output section so a later maintainer can repair adopter-facing docs without changing active dirty CLI files during this cycle.

## Observed gap

`packages/issue-scam-scanner/README.md` should be checked around the `## Outputs` section. The current content read during this cycle ended during the GitHub Action output table after the `score` row text began, which suggests the adopter-facing output contract may be incomplete or accidentally truncated.

## Output section checklist

Before treating the README as release-ready, verify the `## Outputs` section includes:

- [ ] A complete GitHub Action outputs table.
- [ ] `safe` semantics as a string output for workflow consumers.
- [ ] `action` semantics for `allow`, `warn`, `quarantine`, and `block`.
- [ ] `score` semantics as the highest severity score from matches.
- [ ] `categories` semantics for unique risk categories, if emitted.
- [ ] `summary` or equivalent public-safe text output, if emitted.
- [ ] JSON CLI output shape aligned with `docs/intake-guardrail-output-contract.md`.
- [ ] Markdown report expectations that avoid repeating decoded hidden payloads.
- [ ] Exit-code behavior aligned with the CLI README table.
- [ ] A non-authority statement: scanner outputs are review signals, not autonomous permission to delete, ban, pay, sign, transfer, launch, claim, or contact externally.

## Suggested repair receipt

A future patch can use this concise receipt:

```text
README output section reviewed: yes/no
Action outputs complete: yes/no
CLI JSON/markdown examples complete: yes/no
Output contract cross-link checked: yes/no
Unsafe content amplification avoided: yes/no
Non-authority boundary included: yes/no
Follow-up tests or docs: <path or none>
Gated actions performed: none
```

## Safety boundary

This artifact is repo-local documentation only. It does not publish a package, list a GitHub Action, post outreach, accept paid work, spend funds, sign anything, launch or move tokens, claim rewards, change payout routes, create an approval issue, or make external commitments.
