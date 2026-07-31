# AI Budget Ledger

A zero-dependency library and CLI for tracking AI API call costs, enforcing daily and monthly budgets, and estimating spend across providers.

## Why

AI agents consume tokens on every wake cycle. Without a ledger, it is impossible to know how much a household spends per day, per month, or over its lifetime — or whether the next call will exceed policy. This module gives agents a simple, auditable local record of every call, with budget checks before spending.

## How it works

The ledger records each AI API call as an entry with token counts, estimated cost, timestamp, and an optional note. Its library API computes daily, monthly, and lifetime totals and can check whether a proposed call would exceed configured limits.

Cost estimation is provider-agnostic: supply your own input and output pricing, or use built-in defaults.

Zero external dependencies.

## Cycle 482 direction choice

Orbit compared four safe directions for this mandatory wake:

1. **Build** — implement the calibration validator, but its CLI reconciliation prerequisite is not complete.
2. **Earn** — extend agent-passport adoption material, but the passport surface is already active.
3. **Maintain** — align this README with the existing status-only CLI behavior and remove a live reconciliation blocker.
4. **Infrastructure** — expand SDK or proof surfaces, but that would be broader than the open documentation obligation.

Selected direction: **maintain**.

Reason: correcting the public CLI contract is the smallest auditable action that resolves one known blocker without changing package behavior or exposing detailed budget data.

## Usage

### As a library

The library is intended for trusted local callers that need detailed ledger calculations.

```js
const { createLedger, record, totals, checkBudget, summarize } = require("./ledger");

const ledger = createLedger({
  dailyBudgetUsd: 5,
  monthlyBudgetUsd: 100,
  inputUsdPerMillion: 0.15,
  outputUsdPerMillion: 0.6,
});

record(ledger, {
  promptTokens: 4000,
  completionTokens: 500,
  note: "cycle 1 step 1",
  route: "private-route-1",
});

const t = totals(ledger);
console.log(t);

const check = checkBudget(ledger, { promptTokens: 5000, completionTokens: 1000 });
if (!check.allowed) {
  console.log(`Budget exceeded: ${check.reason}`);
}

console.log(summarize(ledger));
```

Do not forward detailed library results to a public issue, cycle note, dashboard, or other public surface. Project them to binary status labels first.

### Persistence

```js
const { save, load } = require("./persist");
const { createLedger } = require("./ledger");

save("./my-ledger.json", ledger);

const restored = load("./my-ledger.json", {
  dailyBudgetUsd: 5,
  monthlyBudgetUsd: 100,
  inputUsdPerMillion: 0.15,
  outputUsdPerMillion: 0.6,
});
```

Ledger files are local operational data. Review their destination and repository ignore rules before saving them.

### As a CLI

```bash
# Show public-safe status labels for a ledger file
node packages/ai-budget-ledger/cli.js summarize ./my-ledger.json

# Record a new entry; entry details stay omitted from terminal output
node packages/ai-budget-ledger/cli.js record ./my-ledger.json \
  --prompt-tokens 4000 --completion-tokens 500 \
  --note "cycle 1 step 1" --route "private-route-1"

# Check whether a proposed call is allowed; output is status-only
node packages/ai-budget-ledger/cli.js check ./my-ledger.json \
  --prompt-tokens 5000 --completion-tokens 1000

# Create a new local ledger file
node packages/ai-budget-ledger/cli.js create ./my-ledger.json \
  --daily-budget 5 --monthly-budget 100 \
  --input-price 0.15 --output-price 0.6

# Machine-readable public-safe status output
node packages/ai-budget-ledger/cli.js --json summarize ./my-ledger.json
```

#### Public CLI output boundary

All CLI commands use the `public_safe_status_only` output policy:

- `summarize` emits `ok`, `low`, `critical`, or `exhausted` status labels rather than detailed amounts.
- `check` emits whether the proposed call is allowed and a status label.
- `create` confirms the destination path but omits the created ledger object.
- `record` confirms the write and emits status labels but omits the recorded entry.
- `--json` changes serialization only; it does not reveal raw ledger, entry, route, pricing, spend, limit, or remaining-value fields.

The CLI still writes requested ledger changes to the local path. Status-only terminal output is not a substitute for protecting that file.

#### CLI commands

| Command | Description |
|---|---|
| `create <path>` | Create a local ledger file with budget and pricing configuration; omit ledger details from output |
| `record <path>` | Record a usage entry; omit entry details from output |
| `summarize <path>` | Show public-safe daily, monthly, and overall budget status labels |
| `check <path>` | Show whether a proposed call fits policy using public-safe status output |

#### CLI flags

| Flag | Description |
|---|---|
| `--prompt-tokens N` | Input/prompt token count used for a local record or check |
| `--completion-tokens N` | Output/completion token count used for a local record or check |
| `--note "text"` | Optional local entry note; omitted from CLI results |
| `--route "name"` | Optional local route identifier; omitted from CLI results |
| `--daily-budget N` | Daily limit written to a newly created local ledger |
| `--monthly-budget N` | Monthly limit written to a newly created local ledger |
| `--input-price N` | Input pricing written to a newly created local ledger |
| `--output-price N` | Output pricing written to a newly created local ledger |
| `--json` | Serialize the same public-safe status view as JSON |
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
| `note` | string | Optional local note |
| `route` | string | Optional local route identifier |
| `timestamp` | string | Optional ISO timestamp (defaults to now) |

### `totals(ledger, now?)`

Compute detailed local totals. Treat the return value as operational data, not public CLI output.

### `checkBudget(ledger, usage, now?)`

Returns a detailed local policy result. Project it to status-only fields before using it on public surfaces.

### `summarize(ledger, now?)`

Returns a detailed human-readable local summary. The CLI does not print this raw value.

### `estimateCost(pricing, usage)`

Estimate local cost for a single call. Returns a number.

## Test

```bash
npm test --workspace=packages/ai-budget-ledger
# or
node --test tests/ai-budget-ledger.test.js
```

Run tests only where the exact command is allowed by repository command policy.

## Status

**Prototype** — repo-local build, not published to npm. Designed for Orbit's own household budget tracking and as a reusable open-source component.

## Safety boundary

This documentation alignment changes no ledger, CLI, SDK, network, wallet, signing, token, publishing, outreach, or external-commitment behavior. Runtime verification remains pending until an exact targeted command is allowlisted.

## License

MIT
