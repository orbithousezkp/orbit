# Contributing to AI Budget Ledger

Thanks for your interest in making AI-agent spending more transparent and budget-aware.

## What this project does

AI Budget Ledger is a zero-dependency library and CLI for tracking AI API call costs, enforcing daily and monthly budgets, and estimating spend across providers. It was built by [Orbit](https://github.com/orbithousezkp/orbit) as part of an open-source agent safety toolkit.

## Development setup

```bash
# Clone the repo
git clone https://github.com/orbithousezkp/orbit.git
cd orbit

# Install dependencies (if any)
npm install

# Run tests
npm test --workspace=packages/ai-budget-ledger
# or
node --test tests/ai-budget-ledger.test.js
```

## Project structure

```
packages/ai-budget-ledger/
├── ledger.js       # Core ledger logic: create, record, totals, check, summarize, estimate
├── persist.js      # JSON file persistence: save and load
├── index.js        # Public API exports (re-exports from ledger.js and persist.js)
├── cli.js          # CLI wrapper with create, record, summarize, check commands
├── package.json
├── README.md
└── examples/
    └── basic-usage.js   # Library usage example
```

## How to contribute

### Reporting issues

Open an issue with:
1. What you were doing (library or CLI usage)
2. What happened vs. what you expected
3. A minimal code example or CLI command that reproduces it

### Adding features

The ledger is intentionally simple. When adding features:
1. Keep the zero-dependency constraint
2. Keep functions pure where possible (the `record` mutation is the exception)
3. Add corresponding tests
4. Update the README API reference

### Testing

```bash
# Run all tests
node --test tests/ai-budget-ledger.test.js
```

Tests should cover:
- Ledger creation with various configs (defaults, custom limits, zero/unlimited)
- Recording entries and verifying totals
- Budget check: within limits, exactly at limits, exceeded
- Edge cases: empty ledger, zero tokens, missing fields
- Persistence: save and load round-trips
- Month and day boundary handling

### Code style

- No external dependencies (the package is intentionally zero-dep)
- Use `"use strict"` at the top of every file
- Keep functions small and well-documented
- Use JSDoc comments for public functions
- CLI exits: 0 = success, 1 = budget exceeded, 2 = error

## Roadmap

- [ ] Provider-specific pricing presets (OpenAI, Anthropic, Google, etc.)
- [ ] Rolling window budgets (last 24 hours / last 30 days instead of calendar day/month)
- [ ] Cost projection based on recent call patterns
- [ ] Multi-ledger support for tracking per-agent or per-workspace costs
- [ ] Export to CSV or JSON for external analysis
- [ ] Webhook / callback when budget threshold is approached

## License

MIT
