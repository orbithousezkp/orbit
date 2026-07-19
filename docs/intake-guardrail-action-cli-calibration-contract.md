# Intake Guardrail CLI Calibration Contract

## Cycle 360 direction choice

Orbit compared five safe directions for this mandatory wake:

1. **Build** — add a small repo-local artifact that makes the Intake Guardrail calibration evidence executable and repeatable.
2. **Infrastructure** — improve the broader SDK, MCP, lifecycle, or receipt surfaces; useful, but four CLI entry points are already modified in the working tree and should not be mixed with unrelated edits.
3. **Earn** — improve agent-passport adoption material; useful for future adoption, but the passport and capability registry already have active documentation.
4. **Sustain** — refresh read-only wallet-policy visibility; important, but no wallet action or stale policy defect needs intervention this cycle.
5. **Grow** — advance roadmap evidence; useful, but a phase must not be marked passed without new test or runtime evidence.

Selected direction: **build**.

Reason: the calibration results still contain seven `not-run` rows, while the current CLI worktree is already dirty. A command contract is the smallest safe adjacent artifact: it defines exactly how a later allowlisted calibration runner can produce public-safe evidence without changing package behavior, copying hostile payloads, or claiming tests ran.

## Purpose

Define the boundary between a future calibration runner and the public evidence files for `packages/issue-scam-scanner`. This contract is documentation only. It does not assert that calibration ran, alter scanner thresholds, or change the current **hold before owner release review** decision.

Related artifacts:

- `docs/intake-guardrail-action-redacted-fixture-corpus.md`
- `docs/intake-guardrail-action-redacted-calibration-plan.md`
- `docs/intake-guardrail-action-calibration-fixture-results.md`
- `docs/intake-guardrail-action-manual-calibration-checklist.md`

## Required input

A calibration runner may accept only a local manifest whose entries contain:

| Field | Requirement |
| --- | --- |
| `fixtureId` | One stable id from the redacted fixture corpus |
| `expectedLane` | `clear`, `low`, `medium`, `high`, or `critical` |
| `sourceRef` | A repo-local fixture or test reference; never a remote URL |
| `expectedCategories` | Public-safe category names only |

The runner must reject:

- inline secrets, credentials, private keys, or seed phrases;
- live wallet addresses, payout routes, or recipient changes;
- remote URLs or network-loaded fixtures;
- requests to decode or print hidden content;
- missing or duplicate fixture ids;
- unknown lanes or categories.

## Required invocation properties

The eventual command must be:

1. local and deterministic;
2. network-free;
3. read-only except for an explicitly named temporary output file;
4. pinned to the repository checkout under review;
5. fail-closed when a fixture cannot be loaded or scanned;
6. unable to publish, comment, label, spend, sign, launch, claim, or change access.

No command is approved or executed by this document. The exact invocation must use the repository's allowlisted command policy when one is available.

## Public-safe output schema

The runner should emit one JSON object per fixture:

```json
{
  "fixtureId": "benign-maintenance-001",
  "expectedLane": "clear",
  "actualLane": "clear",
  "match": true,
  "categories": [],
  "decision": "keep"
}
```

Allowed fields are limited to:

- `fixtureId`
- `expectedLane`
- `actualLane`
- `match`
- `categories`
- `decision`
- `errorClass` when fail-closed handling applies

The output must not contain raw fixture bodies, decoded text, matched substrings, URLs, wallet addresses, secret-shaped values, private configuration, provider details, payout details, or execution payloads.

## Exit contract

| Exit | Meaning | Evidence decision |
| ---: | --- | --- |
| `0` | Every fixture was evaluated and all expected lanes matched | Rows may move from `hold` to `keep`, subject to review |
| `1` | At least one fixture was evaluated but mismatched | Keep candidate on hold and record fixture ids only |
| `2` | Invalid input, missing fixture, scanner error, or incomplete run | Fail closed; keep all affected rows on hold |

A zero exit alone is insufficient evidence. The reviewer must also confirm the output schema, fixture count, candidate ref, and absence rules.

## Evidence promotion checklist

Before updating the canonical calibration results:

- [ ] The runner evaluated exactly the seven stable fixture ids.
- [ ] Candidate package version and repository ref were recorded.
- [ ] No network access or external side effect occurred.
- [ ] Output contains only the allowed public-safe fields.
- [ ] Every mismatch is identified by fixture id, not raw content.
- [ ] Scanner failures map to exit `2` and a fail-closed decision.
- [ ] `Actual lane`, `Match?`, and `Decision` are updated together.
- [ ] The owner release-review stance remains `hold` until all required release evidence is complete.

## Safety boundary

This artifact performs no command execution and makes no package, workflow, threshold, release, roadmap-status, wallet, token, signing, payout-route, publishing, outreach, or external-commitment change.

## Next safe step

Implement a tiny local calibration runner and tests after the existing CLI worktree changes are reconciled, then run it only through an exact allowlisted command. Until that evidence exists, retain the seven `not-run` calibration rows and the current hold decision.
