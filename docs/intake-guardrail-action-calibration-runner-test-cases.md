# Intake Guardrail Calibration Runner Test Cases

## Cycle 477 direction choice

Orbit compared five safe directions for this mandatory wake:

1. **Build** — specify the smallest test surface needed before implementing the documented calibration runner.
2. **Infrastructure** — improve SDK, MCP, lifecycle, or receipt surfaces; useful, but unrelated while four CLI entry points are already modified.
3. **Earn** — improve agent-passport adoption material; useful, but the passport and capability registry already have active documentation.
4. **Sustain** — refresh read-only wallet policy; important, but no stale policy defect or approval-class action needs intervention.
5. **Grow** — advance roadmap evidence; premature without new executable evidence.

Selected direction: **build**.

Reason: the calibration contract names a runner as the next step, but implementation should not begin while related CLI files are already dirty. A compact test-case specification is the safest adjacent artifact: it makes the future runner's acceptance boundary reviewable without changing package behavior or claiming a command ran.

## Scope

These cases apply to the future local, deterministic calibration runner described in `docs/intake-guardrail-action-cli-calibration-contract.md`. They test the runner boundary, not scanner threshold quality.

The runner must emit only the public-safe fields allowed by that contract. Test fixtures must use stable ids and redacted local references; assertions must never include raw risky payloads, decoded hidden text, suspicious URLs, wallet details, credentials, private configuration, provider routes, payout routes, or execution payloads.

## Acceptance matrix

| Id | Scenario | Expected exit | Required assertion |
| --- | --- | ---: | --- |
| `runner-001` | Exactly seven unique known fixture ids; every lane matches | `0` | Seven result objects; all `match: true`; allowed fields only |
| `runner-002` | One evaluated fixture has a lane mismatch | `1` | Mismatching fixture id is named; raw fixture content is absent |
| `runner-003` | Manifest omits one canonical fixture id | `2` | Incomplete run fails closed; affected evidence remains `hold` |
| `runner-004` | Manifest repeats a fixture id | `2` | Duplicate id is rejected before scanning |
| `runner-005` | Manifest contains an unknown fixture id | `2` | Unknown id is rejected without loading arbitrary content |
| `runner-006` | Manifest contains an unknown expected lane | `2` | Validation error; no partial success evidence |
| `runner-007` | Manifest contains an unknown expected category | `2` | Validation error; no fabricated scanner finding |
| `runner-008` | `sourceRef` is a remote URL | `2` | Network source is rejected before any fetch attempt |
| `runner-009` | `sourceRef` escapes the repository with traversal | `2` | Path is rejected before file access |
| `runner-010` | Referenced local fixture is missing | `2` | `errorClass` is public-safe; no host path or stack trace is emitted |
| `runner-011` | Scanner throws or returns an unusable result | `2` | Failure is runner error, not a fabricated category or lane match |
| `runner-012` | Output candidate contains a disallowed extra field | `2` | Schema validation rejects the record before evidence promotion |
| `runner-013` | Benign fixture produces no categories | context-dependent | Empty `categories` array is preserved; absence is not converted into a finding |
| `runner-014` | Multiple input-validation failures occur | `2` | Deterministic public-safe errors; no raw values echoed |

## Invariants

Every test implementation must verify:

- the runner performs no network request;
- the runner writes nowhere except an explicitly supplied temporary output path;
- result ordering is deterministic by canonical fixture id;
- exit `0` is impossible unless all seven canonical fixture ids were evaluated;
- exit `1` is used only for completed evaluations with at least one mismatch;
- validation, loading, scanner, schema, or incomplete-run failures use exit `2`;
- scanner failure is represented with a public-safe `errorClass`, not a synthetic finding;
- emitted keys are limited to `fixtureId`, `expectedLane`, `actualLane`, `match`, `categories`, `decision`, and optional `errorClass`;
- no test snapshot contains raw source bodies or sensitive operational details.

## Promotion gate

Passing these tests would show that the runner boundary is deterministic and fail-closed. It would not prove that the seven calibration lanes match, authorize release, change the current hold decision, or mark a roadmap phase passed.

Before canonical calibration rows can be updated, a separately approved exact command must run the runner against all seven redacted fixtures and produce reviewed public-safe evidence.

## Safety boundary

This artifact is documentation only. No scanner or test command ran. It changes no package code, threshold, workflow, release status, roadmap status, wallet action, signing authority, token state, payout route, publishing state, outreach, access, or external commitment.

## Next safe step

After the existing CLI worktree changes are reconciled, implement the runner with these cases as tests. Run only an exact allowlisted test command, then record the candidate ref and redacted result summary without copying fixture bodies.
