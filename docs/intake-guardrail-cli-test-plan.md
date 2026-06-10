# Intake Guardrail CLI Test Plan

Cycle 98 selected direction: **build**.

## Direction comparison

Orbit compared the safe multi-direction options before choosing this artifact:

- **Build** — strongest this cycle because Cycle 97 created a release checklist for the Intake Guardrail CLI, and the next smallest useful step is to translate that checklist into concrete test cases without publishing or external commitments.
- **Infrastructure** — useful because the guardrail package supports the reusable Orbit control-plane layer, but a focused CLI test plan is the smallest infrastructure improvement available without running non-allowlisted local commands.
- **Earn** — useful because adopter readiness can eventually support revenue, but this cycle should avoid outreach, paid commitments, or approval-class movement.
- **Sustain** — important for wallet policy, but no wallet, token, signing, reward, payout-route, or spend action is needed.
- **Grow** — useful for roadmap evidence, but this document is direct evidence for safe repo-local prototype hardening.

## Safety boundary

This plan is a repo-local test design only. It does **not** publish the package, post outreach, accept paid work, spend funds, sign transactions, launch tokens, claim rewards, change payout routes, or create external commitments.

## Test groups

### 1. Input source handling

Verify the CLI accepts exactly the intended input surfaces:

- Positional text argument.
- `--stdin` piped text.
- `--file <path>` text file input.
- Empty input returns an argument error rather than a false safe result.
- Missing file path returns exit code `2`.
- Missing rules path returns exit code `2`.

### 2. Threshold behavior

Verify thresholds remain conservative and predictable:

- Default threshold flags high-severity wallet drain or prompt-injection language.
- Lower `--threshold` values flag medium-severity suspicious language.
- `--threshold` rejects non-numeric values, negative values, and values over `100`.
- `--quarantine-threshold` rejects malformed values.
- `--block-threshold` rejects malformed values.
- A high-risk finding exits `1`, not `0`.

### 3. Output modes

Verify output surfaces are public-safe and machine-usable:

- Summary mode prints concise risk status and findings.
- `--json` emits parseable JSON.
- `--report json` emits parseable JSON report output.
- `--report markdown` emits paste-safe Markdown.
- Markdown output does not decode or repeat obfuscated relay payloads.
- Output does not include secrets, private routes, private payout details, provider route details, or hidden config values.

### 4. Custom rules

Verify adopter-provided rules are validated before use:

- Valid custom rule array loads successfully.
- Non-array JSON is rejected.
- Missing `severity` is rejected.
- Severity outside `0..100` is rejected.
- Missing or non-string `category` is rejected.
- Missing or non-string `pattern` is rejected.
- Invalid regex pattern is rejected.
- Missing or non-string `message` is rejected.
- A valid matching custom rule appears in findings.

### 5. Risk category coverage

Verify known risky patterns stay covered:

- Prompt injection / role override.
- Wallet drain or approval pressure.
- Seed phrase or private key requests.
- Urgency traps.
- Fake support or recovery language.
- Obfuscated instruction relay such as base64/hex/Morse-style prompts.
- Unknown recipient or payment pressure.

### 6. Exit code contract

Verify CLI automation can depend on stable exits:

- `0` for no findings at or above threshold.
- `1` for one or more findings at or above threshold.
- `2` for bad arguments, invalid files, malformed custom rules, or read errors.

## Suggested next safe implementation step

Add a small test file under `tests/` that shells the CLI with temporary text and rule files, then asserts exit codes and output shape. Keep the tests repo-local and do not add publishing, marketplace, outreach, paid-work, wallet, signing, token, reward, or payout-route behavior.
