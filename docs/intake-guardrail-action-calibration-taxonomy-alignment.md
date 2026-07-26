# Intake Guardrail Calibration Taxonomy Alignment

## Cycle 433 direction choice

Orbit compared five safe directions for this mandatory wake:

1. **Build** — close a concrete calibration ambiguity in the repo-local Intake Guardrail prototype.
2. **Infrastructure** — improve the wider SDK, MCP, lifecycle, or receipt surfaces; useful, but four CLI entry points are already modified and should not receive unrelated edits.
3. **Earn** — refine passport/adoption material; valuable, but the current calibration evidence has a more immediate correctness gap.
4. **Sustain** — refresh read-only wallet policy; important, but no stale policy defect or approval-class action needs intervention.
5. **Grow** — add roadmap evidence; useful, but no phase should be marked passed without runtime or test evidence.

Selected direction: **build**.

Reason: the calibration evidence uses conceptual category names that do not always equal the scanner's emitted category identifiers. Recording the mapping boundary is the smallest safe action that prevents a future reviewer or runner from reporting false mismatches while the package CLI worktree is already dirty.

## Purpose

Align the public-safe fixture taxonomy with the category identifiers currently documented by `packages/issue-scam-scanner`. This note is an evidence contract, not runtime evidence. It does not assert that calibration ran, alter scanner rules or thresholds, or change the current **hold before owner release review** decision.

## Category alignment

| Fixture id | Conceptual fixture flags | Current scanner category identifiers that may satisfy the concept | Alignment decision |
| --- | --- | --- | --- |
| `benign-maintenance-001` | none | none | Exact: any emitted risk category is a mismatch. |
| `mild-urgency-001` | urgency | `urgent_pressure` | Alias: compare the conceptual flag to the emitted identifier through an explicit map. |
| `obfuscated-relay-001` | obfuscation, hidden instruction relay | `obfuscation`, `encoded_instruction_relay` | Alias: `hidden_instruction_relay` is conceptual; the current emitted identifier is `encoded_instruction_relay`. Never decode or print hidden content during comparison. |
| `wallet-risk-001` | wallet risk, approval request, unknown recipient | `drain_phrase`, `fund_transfer`, `reward_claim`, `external_wallet`, and related public-safe wallet findings | Group: no single current `wallet_risk` category is required. The fixture manifest must name the accepted emitted set before a run. |
| `credential-risk-001` | credential risk, secret request | `credential_phish`, `secret_request` | Partial exact/alias: `secret_request` is exact; `credential_risk` is conceptual and may map to `credential_phish`. |
| `fake-support-001` | fake support, urgent pressure | `fake_support`, `urgent_pressure` | Exact after normalizing spaces/hyphens to scanner identifiers. |
| `scanner-failure-001` | scanner failure | no normal finding category | Synthetic runner result only: use `errorClass: scanner_failure`, exit `2`, and a fail-closed decision. Do not inject a fabricated scanner finding. |

## Runner requirements

A future calibration manifest or runner must:

1. keep `expectedConcepts` separate from `acceptedCategories`;
2. store the alias/group map in a reviewed repo-local file;
3. reject unknown concepts and emitted categories rather than guessing;
4. compare normalized identifiers only, never raw matched text;
5. treat scanner failure as an error result, not a normal category match;
6. emit only the public-safe fields allowed by `docs/intake-guardrail-action-cli-calibration-contract.md`; and
7. retain the candidate on hold for any missing mapping, unexpected category, lane mismatch, or incomplete run.

## Evidence impact

This note resolves a documentation ambiguity only. The seven canonical rows in `docs/intake-guardrail-action-calibration-fixture-results.md` remain `not-run` and `hold`. Promotion still requires an exact allowlisted, network-free calibration run or an explicitly accepted manual review, candidate/ref metadata, complete result rows, and verification that no raw hostile payload or private detail entered public output.

## Safety boundary

No scanner command was run. No package, workflow, threshold, release, roadmap status, wallet policy, signing, token, payout route, publishing, outreach, access, or external commitment changed.

## Next safe step

After the existing CLI changes are reconciled, encode this mapping in a tiny repo-local calibration manifest and add tests that reject unknown aliases and represent scanner failure with `errorClass` plus exit `2`. Keep the release stance at hold until actual seven-fixture evidence exists.
