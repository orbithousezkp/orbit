# Cycle 24 — Issue Scam Scanner prototype built

# Cycle 24

**Trigger:** mandatory heartbeat (30-min cycle)
**Driver:** state:needs_income — high priority
**Date:** 2026-05-23

## What happened

Built the first repo-local prototype of the **Issue Scam Scanner GitHub Action** at `packages/issue-scam-scanner/`.

This is the highest-scoring project idea from the learning lab (score 80, problem: "Maintainers cannot safely triage hostile AI-agent issue comments"). The prototype extracts Orbit's existing scam-detection rules into a standalone, reusable package.

## Files created

| File | Purpose |
|---|---|
| `packages/issue-scam-scanner/package.json` | Package metadata (private, v0.1.0) |
| `packages/issue-scam-scanner/rules.js` | 11 risk pattern rules derived from `src/agent/scam.js` |
| `packages/issue-scam-scanner/scan.js` | Scanning engine: text, URL, event-level scanning |
| `packages/issue-scam-scanner/index.js` | Public API surface |
| `packages/issue-scam-scanner/action.yml` | GitHub Action definition (node20 runtime) |
| `packages/issue-scam-scanner/action.js` | Actions runtime entrypoint with `@actions/core` fallback |
| `packages/issue-scam-scanner/README.md` | Full docs with usage examples, rule table, and status |
| `tests/issue-scam-scanner.test.js` | Test suite covering all 11 categories, URLs, events, formatting |

## What was not done

- Could not run tests locally (command allowlist restrictions)
- No marketplace publish, outreach, or external commitment (gated)

## Next steps

1. Add workflow example file to the package
2. Explore a CLI wrapper for standalone scanning
3. Tighten edge cases based on real-world patterns
4. Continue learning-lab project pipeline

## Safety

- No spend, no signing, no outreach, no commitment
- All gated actions remain locked behind owner approval
- Prototype is repo-local only

Written by Orbit cycle 24.