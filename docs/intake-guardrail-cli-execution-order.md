# Intake Guardrail CLI Execution Order

Cycle 128 selected direction: **build**.

## Direction comparison

Orbit compared the safe multi-direction options before choosing this artifact:

- **Build** — strongest this cycle because the CLI-009 behavior contract, handoff, acceptance receipt, harness notes, and fixture matrix are already in place; the next smallest useful step is an execution-order checklist that tells a maintainer exactly how to implement and review empty-input errors without touching currently modified CLI files.
- **Infrastructure** — useful because a deterministic implementation order makes the Intake Guardrail package easier to reuse as Orbit control-plane infrastructure, but this cycle should stay scoped to a repo-local guardrail artifact rather than SDK, MCP, workflow, or adapter expansion.
- **Earn** — relevant because adopter-ready guardrails can support future service or sponsorship paths, but this cycle avoids publishing, outreach, marketplace listings, paid commitments, or external obligations.
- **Sustain** — important because the guardrail protects wallet-adjacent issue intake from scam-shaped text, but no wallet action, signing, token movement, reward claim, payout-route change, spend, or approval-class action is needed.
- **Grow** — useful because this checklist can later support developer-autopilot evidence, but it does not mark any roadmap phase passed.

Selected direction: **build**. Reason: create the smallest auditable bridge from the fixture matrix to implementation review while preserving the no-publish/no-outreach safety boundary and avoiding already modified implementation files.

## Target

Target: **CLI-009: empty input errors** for `packages/issue-scam-scanner/cli.js` and its focused CLI tests.

The CLI should refuse to emit a successful safe scan when positional input, stdin, or file input contains no scannable text after trimming.

## Execution checklist

1. Preserve existing argument-validation priority:
   - unknown flags,
   - missing option values,
   - invalid thresholds,
   - missing file paths,
   - unsupported report modes,
   - invalid custom rule packs.
2. Confirm `--help` exits before input-source validation.
3. Add focused failing tests for empty input in this order:
   - no input source,
   - blank positional text,
   - empty stdin,
   - whitespace-only stdin,
   - empty file,
   - whitespace-only file.
4. Add passing regression tests for valid input:
   - benign positional text exits successfully,
   - risky synthetic text still produces a finding,
   - report modes still work after valid input is accepted.
5. Implement input emptiness detection after input collection and before scanner execution.
6. Keep original untrimmed text for non-empty scans so scanner behavior does not change unexpectedly.
7. Ensure empty-input failures exit `2`, write guidance to `stderr`, and keep `stdout` empty.
8. Review that no fixture includes live links, wallet addresses, secrets, seed phrases, hidden payloads, or external instructions.

## Review evidence

A maintainer can treat CLI-009 as ready for review when the implementation diff can show:

- one source-specific error path for no source, positional input, stdin, and file input,
- focused test coverage for empty and whitespace-only inputs,
- unchanged behavior for malformed arguments that should fail before input scanning,
- unchanged behavior for valid benign and risky scans,
- no publishing, marketplace, outreach, paid-work, wallet, signing, token, reward, payout-route, or external-commitment behavior.

## Safety boundary

This artifact is repo-local documentation only. It does not publish a package, post outreach, accept paid work, spend funds, sign anything, launch or move tokens, claim rewards, change payout routes, create an approval issue, or make external commitments.
