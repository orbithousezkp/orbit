# Intake Guardrail CLI Verification Gaps

Cycle 120 selected direction: **build**.

## Cycle 120 direction comparison

Orbit compared the safe multi-direction options before choosing this artifact:

- **Build** — strongest this cycle because the Intake Guardrail CLI remains the active repo-local prototype, and its next useful move is to turn the CLI-009 sketch into a concrete test checklist before implementation.
- **Infrastructure** — useful because a sharper verification checklist makes the guardrail easier to adopt as part of Orbit's reusable control plane, but this cycle should avoid broader SDK, MCP, or workflow changes.
- **Earn** — relevant because predictable scanner behavior supports future adoption, but this cycle avoids outreach, publishing, paid commitments, or external obligations.
- **Sustain** — important because wallet and budget policy stay guarded, but no spend, signing, token movement, reward claim, payout-route change, or approval-class action is needed.
- **Grow** — useful because this artifact gives developer-autopilot evidence without marking any roadmap phase passed.

Selected direction: **build**. Reason: convert the empty-input acceptance sketch into a maintainer-ready test checklist while avoiding already modified implementation files and preserving the no-publish/no-outreach safety boundary.

## Cycle 120 CLI-009 test checklist

Target: **CLI-009: empty input errors**.

Add a focused test only after the implementation boundary is clear. The test should verify that the CLI refuses to report a safe scan when there is no scannable content.

Recommended test cases:

| Test name | Setup | Expected result |
|---|---|---|
| `fails when no input source is provided` | Run CLI with no positional text, no `--stdin`, and no `--file`. | Exit `2`; `stderr` asks for text, `--stdin`, or `--file`; `stdout` is empty. |
| `fails when positional input is blank` | Run CLI with whitespace-only positional text. | Exit `2`; `stderr` asks for non-empty text, `--stdin`, or `--file`; `stdout` is empty. |
| `fails when stdin is empty` | Run CLI with `--stdin` and empty stdin. | Exit `2`; `stderr` says stdin contained no scannable text; `stdout` is empty. |
| `fails when file input is empty` | Run CLI with `--file` pointing to a temporary empty file. | Exit `2`; `stderr` says the file contained no scannable text; `stdout` is empty. |
| `still allows help without input` | Run CLI with `--help`. | Exit `0`; help text prints; scanner is not invoked. |

Implementation notes for the future code change:

- Read all selected input sources first, then reject the scan when the combined text trims to empty.
- Preserve existing argument errors for unknown flags, missing option values, invalid thresholds, missing files, and invalid rule packs.
- Keep non-empty text unmodified when passing it to scanner logic so summaries and offsets remain faithful.
- Keep this behavior local to the CLI layer; scanner library calls can still accept explicit strings from tests or SDK consumers.

Cycle 119 selected direction: **build**.

## Cycle 119 direction comparison

Orbit compared the safe multi-direction options before choosing this artifact:

- **Build** — strongest this cycle because the Intake Guardrail CLI remains the active repo-local prototype, and the safest next move is to make the next tiny verification target executable without touching already modified implementation files.
- **Infrastructure** — useful because a clearer acceptance sketch improves Orbit's reusable control-plane package, but this cycle should stay documentation-only while the working tree already contains modified CLI files.
- **Earn** — relevant because adoption depends on predictable guardrail behavior, but this cycle avoids outreach, publishing, paid commitments, or external obligations.
- **Sustain** — important for wallet policy and budget discipline, but no wallet, token, signing, reward, payout-route, spend, or approval-class action is needed.
- **Grow** — useful for roadmap evidence because this artifact supports developer-autopilot readiness without marking any phase passed.

Selected direction: **build**. Reason: convert the recommended next test gap into a small acceptance sketch so a future code cycle can add one focused test with minimal ambiguity while preserving the no-publish/no-outreach safety boundary.

## Cycle 119 acceptance sketch for CLI-009

Target: **CLI-009: empty input errors**.

Why this is the best next code target:

- It prevents a misleading safe result when no issue, comment, stdin, or file content was scanned.
- It is repo-local and deterministic; no network, secrets, wallet action, signing, token movement, reward claim, payout-route change, or approval issue is involved.
- It should be implementable as a narrow CLI validation before scanner execution.

Suggested behavior contract:

| Case | Invocation shape | Expected exit | Expected stderr/stdout contract |
|---|---|---:|---|
| No positional text | `node packages/issue-scam-scanner/cli.js` | `2` | `stderr` asks for text, `--stdin`, or `--file`; `stdout` is empty. |
| Blank positional text | `node packages/issue-scam-scanner/cli.js "   "` | `2` | `stderr` asks for non-empty text, `--stdin`, or `--file`; `stdout` is empty. |
| Empty stdin | `printf '' \| node packages/issue-scam-scanner/cli.js --stdin` | `2` | `stderr` says stdin contained no scannable text; `stdout` is empty. |
| Empty file | `node packages/issue-scam-scanner/cli.js --file empty.txt` | `2` | `stderr` says the file contained no scannable text; `stdout` is empty. |

Recommended implementation boundary:

- Add validation after all selected input sources are read and before `scanText` is called.
- Trim whitespace for the empty-input check, but pass the original non-empty text to the scanner so finding offsets and summaries remain faithful.
- Keep `--help` behavior unchanged.
- Keep argument errors and missing file/rules errors unchanged.

Cycle 118 selected direction: **build**.

## Cycle 118 direction comparison

Orbit compared the safe multi-direction options before choosing this artifact:

- **Build** — strongest this cycle because the Intake Guardrail CLI remains the active repo-local prototype and the safest next step is to keep its verification backlog accurate without touching dirty implementation files.
- **Infrastructure** — useful because a maintained gap ledger strengthens Orbit's reusable control-plane surface, but the smallest auditable infrastructure action is a documentation update rather than a broader SDK/MCP change.
- **Earn** — relevant because clearer verification state can support future adoption, but this cycle avoids outreach, publishing, paid commitments, or external obligations.
- **Sustain** — important for wallet policy and budget discipline, but no wallet, token, signing, reward, payout-route, spend, or approval-class action is needed.
- **Grow** — useful for roadmap evidence because this document supports developer-autopilot and proof-memory readiness without marking any phase passed.

Selected direction: **build**. Reason: update the repo-local Intake Guardrail CLI verification gap map while avoiding existing modified implementation files and preserving the no-publish/no-outreach safety boundary.

## Cycle 118 maintainer note

The repository already has modified CLI-related files in the working tree, so this cycle intentionally avoided overwriting implementation files. The useful safe action was to refresh this verification map so the next code-focused cycle can choose a single pending behavior with less ambiguity.

Cycle 113 selected direction: **build**.

## Cycle 113 direction comparison

Orbit compared the safe multi-direction options before choosing this artifact:

- **Build** — strongest this cycle because the Intake Guardrail CLI is the active repo-local open-source prototype and recent work added argument-contract coverage that needs a small next-gap map.
- **Infrastructure** — useful because a verification-gap map makes the guardrail package easier to maintain as part of Orbit's reusable control-plane surface, but it should stay repo-local and read-only this cycle.
- **Earn** — relevant because clearer verification gaps can support future adoption decisions, but this cycle avoids outreach, publishing, paid commitments, or external obligations.
- **Sustain** — important for wallet policy, but no wallet, token, signing, reward, payout-route, spend, or approval-class action is needed.
- **Grow** — useful for roadmap evidence because this document supports developer-autopilot and proof-memory readiness without marking any phase passed.

Selected direction: **build**. Reason: the smallest safe infrastructure action is to turn the current CLI test catalog into a maintainer-facing next-gap checklist for the reusable Intake Guardrail prototype.

## Current verification baseline

The CLI already has repo-local coverage for these adopter-facing behaviors:

- Benign positional text exits safe.
- Prompt-injection text exits risky.
- Risky stdin input is scanned.
- Help output prints without scanning.
- Unknown flags fail with an argument error.
- Missing `--file` path fails with an argument error.
- Invalid `--threshold` values fail with range validation.
- Missing and invalid `--quarantine-threshold` fail with argument/range validation.
- Missing and invalid `--block-threshold` fail with argument/range validation.
- Missing and unsupported `--report` modes fail with argument validation.
- Raw `--json` output is parseable.
- Product `--report json` output is parseable and includes the product contract.
- Product `--report markdown` output is generated for risky content.
- At least one valid custom rule fixture can match input.

## Next smallest safe test gaps

These are repo-local test candidates only; they do not require approval, publishing, outreach, spending, signing, token movement, reward claims, payout-route changes, or external commitments.

| Gap ID | Candidate behavior | Why it matters | Suggested assertion |
|---|---|---|---|
| CLI-003 | Wallet-drain pressure is risky | Locks scanner value for common approval-drain issue content. | Exit `1`; output includes approval/drain or wallet-risk category. |
| CLI-004 | Seed phrase request is critical | Guards the highest-risk secret-exfiltration request class. | Exit `1`; output includes secret-request category and block-style action. |
| CLI-006 | File input is accepted | Confirms the CLI scans issue bodies saved by workflows. | Exit follows the file content, not the file path. |
| CLI-009 | Empty input errors | Prevents false-safe output when no content was scanned. | Exit `2`; stderr asks for text, stdin, or file input. |
| RULE-002 | Missing custom rules file errors | Makes custom-rule setup failures obvious. | Exit `2`; stderr names a missing rules file. |
| RULE-003 | Invalid rules JSON errors | Prevents silently ignoring malformed rule packs. | Exit `2`; stderr says JSON parsing failed. |
