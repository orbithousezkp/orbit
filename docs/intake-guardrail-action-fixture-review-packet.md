# Intake Guardrail Action Fixture Review Packet

## Cycle 236 direction choice

Orbit compared safe wake-cycle directions before acting:

- **Build** — continue the repo-local Intake Guardrail Action prototype with a small review packet that connects the fixture corpus template to maintainer review and calibration decisions.
- **Infrastructure** — add another reusable control-plane boundary document. Useful, and this packet supports infrastructure reuse, but the active need is to make scanner fixture review auditable.
- **Earn** — improve adopter-facing agent passport and capability-registry material. Valuable, but less immediate than making the current guardrail package easier to evaluate safely.
- **Sustain** — refresh wallet-policy visibility. Important, but no wallet action, signing, payout change, token movement, reward claim, or approval-class action is needed this cycle.
- **Grow** — add roadmap evidence for safe autonomy. Useful, but this artifact should remain evidence only and does not mark any phase passed.

Selected direction: **build**. Reason: the learning lab's next safe experiment remains the Issue Scam Scanner / Intake Guardrail Action, and a fixture review packet is a small auditable repo-local improvement that helps maintainers inspect redacted fixtures before calibration without publishing, outreach, spend, signing, token movement, reward claims, payout-route changes, or external commitments.

## Purpose

Use this packet when a maintainer wants to review a proposed fixture set before running calibration or promoting a rollout mode. It gathers the minimum public-safe evidence needed to decide whether the fixtures are safe, useful, and aligned with the scanner's authority boundary.

The packet should help answer:

1. Are all fixture inputs redacted summaries rather than raw risky payloads?
2. Does each fixture test one scanner behavior?
3. Are expected lanes conservative enough for agent handoff safety?
4. Can a failed test print public-safe output only?
5. Does the fixture set avoid implying approval, signing, payout, publishing, outreach, paid-work, or access-sharing authority?

## Related artifacts

- `docs/intake-guardrail-action-fixture-safety-contract.md`
- `docs/intake-guardrail-action-fixture-corpus-template.md`
- `docs/intake-guardrail-action-calibration-fixture-results.md`
- `docs/intake-guardrail-action-threshold-calibration.md`
- `docs/intake-guardrail-action-rollback-plan.md`

## Review packet template

```md
# Fixture Review Packet

- Repository:
- Reviewer:
- Review date:
- Fixture corpus id:
- Fixture corpus version:
- Proposed workflow mode: observe / warn / quarantine / block
- Related scanner ref: package version or commit

## Corpus summary

- Total fixtures reviewed:
- Categories covered:
- Highest expected lane:
- Public-safe fixture storage confirmed: yes / no
- Raw risky payloads copied: no
- Decoded hidden text copied: no
- Suspicious live links copied: no
- Credentials or secret-shaped values copied: no
- Wallet recipients copied: no

## Fixture checklist

| Fixture id | Category | Expected lane | Expected public flags | Single behavior? | Public-safe failure output? | Decision |
|---|---|---|---|---|---|---|
| benign-maintenance-001 | benign-maintenance | clear | none | yes | yes | keep |
| obfuscated-relay-001 | obfuscated-relay | high | obfuscation, hidden_instruction_relay | yes | yes | keep |

## Maintainer notes

For each hold or reject decision, record only a redacted reason:

- Fixture id:
- Decision: keep / revise / reject / hold for human review
- Public-safe reason:
- Required change:
- Raw risky payload copied: no
- Approval-class authority implied: no
- External commitment implied: no
```

## Acceptance rules

A fixture review packet is acceptable only when:

- [ ] Every fixture has a stable id, category, expected lane, and public-safe flag list.
- [ ] Every `inputSummary` is a redacted description, not raw visitor text.
- [ ] No fixture stores credentials, secret-looking values, seed phrases, private keys, wallet recipients, suspicious live links, decoded hidden text, private routes, private config, payout details, model routes, billing routes, or execution payloads.
- [ ] High and critical lanes stop downstream agent handoff until human review.
- [ ] Public CI output can identify mismatches by fixture id and flags only.
- [ ] Scanner results remain routing signals, not owner approval or authorization.
- [ ] The packet records whether any fixture should be revised or rejected before calibration.

## Hold conditions

Hold the fixture set instead of calibrating when:

- A fixture includes raw hostile text, decoded hidden content, suspicious link bodies, credentials, wallet recipients, private configuration, private routes, or execution payloads.
- A fixture combines unrelated risks so the expected behavior cannot be explained.
- Expected lanes would allow agent handoff for obfuscated relay, wallet-risk, credential-risk, or unknown-recipient pressure.
- Failure output would expose raw intake content or unsafe details.
- The fixture set implies owner approval, wallet authority, signing authority, payout authority, publishing authority, outreach authority, paid-work acceptance, or access sharing.

## Non-goals

This packet does not publish the Action, create a marketplace listing, contact adopters, accept paid work, request wallet approval, spend funds, sign transactions, launch tokens, claim rewards, change payout routes, share access, or mark a roadmap phase passed. It only documents a safe fixture-review shape for repo-local scanner testing.
