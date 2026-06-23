# Intake Guardrail CLI README Sync Checklist

Cycle 134 selected direction: **build**.

## Direction comparison

Orbit compared the safe multi-direction options before choosing this artifact:

- **Build** — strongest this cycle because the Intake Guardrail CLI remains the active repo-local prototype, and README/CLI drift is one of the smallest risks before an adopter copies commands.
- **Infrastructure** — useful because consistent docs strengthen Orbit's reusable control-plane surface, but this cycle should stay scoped to the guardrail package instead of expanding SDK, MCP, wallet, or roadmap machinery.
- **Earn** — relevant because clearer adopter-facing docs support future adoption paths, but this cycle avoids outreach, package publishing, marketplace listing, paid commitments, or external obligations.
- **Sustain** — important because the guardrail protects wallet-adjacent requests, but no wallet action, token movement, reward claim, payout-route change, spend, signing, or approval-class request is needed.
- **Grow** — useful because the checklist can become evidence for developer-autopilot readiness later, but this note does not mark any roadmap phase passed.

Selected direction: **build**. Reason: create a small auditable README-sync checklist that helps maintainers compare the CLI implementation, help output, tests, and package README before any external release step.

## Sync targets

Keep these surfaces aligned:

- `packages/issue-scam-scanner/cli.js`
- `packages/issue-scam-scanner/README.md`
- `packages/issue-scam-scanner/action.yml`
- `tests/issue-scam-scanner-cli.test.js`
- `docs/intake-guardrail-cli-help-audit.md`
- `docs/intake-guardrail-cli-empty-input-contract.md`
- `docs/intake-guardrail-cli-output-contract.md` if added later; otherwise `docs/intake-guardrail-output-contract.md`

## README sync checklist

Before treating the CLI README as adopter-ready, verify:

- [ ] Every README CLI example runs with the currently supported flags.
- [ ] README flag names match parser aliases exactly, including short aliases such as `-f`, `-r`, `-t`, `-j`, and `-h`.
- [ ] README threshold defaults match the help output and implementation.
- [ ] README report modes match accepted CLI values.
- [ ] README exit-code table matches the CLI behavior for safe, risky, and error cases.
- [ ] README custom-rule examples use the same JSON shape that validation accepts.
- [ ] README stdin and file examples describe empty-input behavior consistently with the CLI-009 contract.
- [ ] README GitHub Action examples use minimal permissions and do not imply scanner authority over labels, comments, wallet actions, signing, payments, or external commitments.
- [ ] README output examples avoid real wallet addresses, live claim links, secrets, private routes, private payout details, or decoded hidden payloads.
- [ ] README guidance says findings are review signals, not proof of intent or autonomous enforcement authority.

## Suggested review receipt

A future review receipt can record:

```text
README sync reviewed: yes/no
CLI help compared: yes/no
Examples executed or inspected: yes/no
Tests checked: yes/no
Mismatches found: <short list or none>
Follow-up patch/task: <path or none>
Gated actions performed: none
```

## Safety boundary

This artifact is repo-local documentation only. It does not publish a package, list a GitHub Action, post outreach, accept paid work, spend funds, sign anything, launch or move tokens, claim rewards, change payout routes, create an approval issue, or make external commitments.
