# AI Budget Ledger

A zero-dependency library and CLI for tracking AI API call costs, enforcing daily and monthly budgets, and estimating spend across providers.

## Why

AI agents consume tokens on every wake cycle. Without a ledger, it is impossible to know how much a household spends per day, per month, or over its lifetime — or whether the next call will blow the budget. This module gives agents a simple, auditable record of every call, with budget checks before spending.

## How it works

The ledger records each AI API call as an entry with token counts, estimated cost, timestamp, and an optional note. It computes daily, monthly, and lifetime totals, and can check whether a proposed call would exceed configured limits.

Cost estimation is provider-agnostic: supply your own `inputUsdPerMillion` and `outputUsdPerMillion` pricing, or use built-in defaults.

Zero external dependencies.

## Usage

### As a library

```js
const { createLedger, record, totals, checkBudget, summarize } = require("./ledger");

// Create a ledger with budget limits
const ledger = createLedger({
  dailyBudgetUsd: 5,
  monthlyBudgetUsd: 100,
  inputUsdPerMillion: 0.15,
  outputUsdPerMillion: 0.6,
});

// Record a call
record(ledger, {
  promptTokens: 4000,
  completionTokens: 500,
  note: "cycle 1 step 1",
  route: "private-route-1",
});

// Check totals
const t = totals(ledger);
console.log(`Today: $${t.today.toFixed(4)}, Month: $${t.month.toFixed(4)}, Lifetime: $${t.lifetime.toFixed(6)}`);

// Check budget before next call
const check = checkBudget(ledger, { promptTokens: 5000, completionTokens: 1000 });
if (!check.allowed) {
  console.log(`Budget exceeded: ${check.reason}`);
}

// Human-readable summary
console.log(summarize(ledger));
```

### Persistence

```js
const { save, load } = require("./persist");
const { createLedger, record } = require("./ledger");

// Save ledger to disk
save("./my-ledger.json", ledger);

// Load ledger from disk (with defaults)
const restored = load("./my-ledger.json", {
  dailyBudgetUsd: 5,
  monthlyBudgetUsd: 100,
  inputUsdPerMillion: 0.15,
  outputUsdPerMillion: 0.6,
});
```

### As a CLI

```bash
# Summarize a ledger file
node packages/ai-budget-ledger/cli.js summarize ./my-ledger.json

# Record a new entry
node packages/ai-budget-ledger/cli.js record ./my-ledger.json \
  --prompt-tokens 4000 --completion-tokens 500 \
  --note "cycle 1 step 1" --route "private-route-1"

# Check budget before a proposed call
node packages/ai-budget-ledger/cli.js check ./my-ledger.json \
  --prompt-tokens 5000 --completion-tokens 1000

# Create a new ledger file
node packages/ai-budget-ledger/cli.js create ./my-ledger.json \
  --daily-budget 5 --monthly-budget 100 \
  --input-price 0.15 --output-price 0.6

# Machine-readable JSON output
node packages/ai-budget-ledger/cli.js --json summarize ./my-ledger.json
```

#### CLI commands

| Command | Description |
|---|---|
| `create <path>` | Create a new ledger file with budget and pricing config |
| `record <path>` | Record a usage entry to an existing ledger |
| `summarize <path>` | Show daily, monthly, and lifetime spend summary |
| `check <path>` | Check whether a proposed call fits within budget |

#### CLI flags

| Flag | Description |
|---|---|
| `--prompt-tokens N` | Input/prompt token count |
| `--completion-tokens N` | Output/completion token count |
| `--note "text"` | Optional note for the entry |
| `--route "name"` | Optional route/provider identifier |
| `--daily-budget N` | Daily budget limit in USD |
| `--monthly-budget N` | Monthly budget limit in USD |
| `--input-price N` | Cost per million input tokens (USD) |
| `--output-price N` | Cost per million output tokens (USD) |
| `--json` | Output raw JSON instead of formatted text |
| `-h, --help` | Show help message |

#### Exit codes

| Code | Meaning |
|---|---|
| 0 | Success |
| 1 | Budget exceeded (for `check` command) |
| 2 | Error (bad arguments, file not found, etc.) |

## API Reference

### `createLedger(opts)`

Create a new empty ledger.

| Option | Type | Default | Description |
|---|---|---|---|
| `dailyBudgetUsd` | number | 0 | Maximum daily spend (0 = unlimited) |
| `monthlyBudgetUsd` | number | 0 | Maximum monthly spend (0 = unlimited) |
| `inputUsdPerMillion` | number | 0 | Cost per million input tokens |
| `outputUsdPerMillion` | number | 0 | Cost per million output tokens |
| `maxEntries` | number | 500 | Maximum entries to retain |

### `record(ledger, usage)`

Record a usage entry. Mutates the ledger. Returns the entry object.

| Field | Type | Description |
|---|---|---|
| `promptTokens` | number | Input token count |
| `completionTokens` | number | Output token count |
| `note` | string | Optional note (e.g. "cycle 5 step 2") |
| `route` | string | Optional route/provider identifier |
| `timestamp` | string | Optional ISO timestamp (defaults to now) |

### `totals(ledger, now?)`

Compute `{ today, month, lifetime, entryCount }` totals.

### `checkBudget(ledger, usage, now?)`

Returns `{ allowed, reason, dailyRemaining, monthlyRemaining, estimatedCost }`.

### `summarize(ledger, now?)`

Returns a human-readable summary with per-period spend, limits, and remaining budget.

### `estimateCost(pricing, usage)`

Estimate USD cost for a single call. Returns a number.

## Test

```bash
npm test --workspace=packages/ai-budget-ledger
# or
node --test tests/ai-budget-ledger.test.js
```

## Status

**Prototype** — repo-local build, not published to npm. Designed for Orbit's own household budget tracking and as a reusable open-source component.

## License

MIT
