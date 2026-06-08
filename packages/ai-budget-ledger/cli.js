#!/usr/bin/env node
"use strict";

/**
 * AI Budget Ledger — CLI
 *
 * Commands: create, record, summarize, check
 * Zero external dependencies.
 *
 * Cycle 94 direction choice:
 * - Compared build, infrastructure, earn, sustain, and grow.
 * - Selected build/infrastructure because toolkit CLIs are adoption surfaces and
 *   the budget ledger needed to expose only public-safe budget status, not
 *   detailed inference spend, remaining amounts, provider routes, or billing
 *   details. This keeps the repo-local prototype useful without adding wallet,
 *   token, publishing, outreach, or external-commitment behavior.
 */

const { createLedger, record, checkBudget, summarize } = require("./ledger");
const { save, load } = require("./persist");

// ---------------------------------------------------------------------------
// Arg parsing (minimal, zero-dep)
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = { _: [], flags: {} };
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === "--json" || token === "-j") {
      args.flags.json = true;
    } else if (token === "--help" || token === "-h") {
      args.flags.help = true;
    } else if (token.startsWith("--")) {
      const key = token.replace(/^--/, "").replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        args.flags[key] = next;
        i++;
      } else {
        args.flags[key] = true;
      }
    } else {
      args._.push(token);
    }
  }
  return args;
}

function num(val, fallback = 0) {
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}

function levelFromRemaining(remaining, limit) {
  if (remaining === Infinity || !Number.isFinite(remaining) || !limit) return "ok";
  if (remaining <= 0) return "exhausted";
  const ratio = remaining / limit;
  if (ratio <= 0.1) return "critical";
  if (ratio <= 0.25) return "low";
  return "ok";
}

function mostSevereLevel(levels) {
  const order = ["ok", "low", "critical", "exhausted"];
  return levels.reduce((worst, level) => (order.indexOf(level) > order.indexOf(worst) ? level : worst), "ok");
}

function publicSummary(summary) {
  const todayLevel = levelFromRemaining(summary.today.remaining, summary.today.limit);
  const monthLevel = levelFromRemaining(summary.month.remaining, summary.month.limit);
  return {
    ok: true,
    policy: "public_safe_status_only",
    budgetStatus: mostSevereLevel([todayLevel, monthLevel]),
    todayStatus: todayLevel,
    monthStatus: monthLevel,
    entryCount: summary.entryCount,
    note: "Detailed inference spend, budget amounts, remaining amounts, provider routes, and billing routes are intentionally omitted from CLI output.",
  };
}

function publicCheck(result) {
  const dailyLimit = result.dailyRemaining === Infinity ? null : result.dailyRemaining + result.estimatedCost;
  const monthlyLimit = result.monthlyRemaining === Infinity ? null : result.monthlyRemaining + result.estimatedCost;
  const dailyLevel = levelFromRemaining(result.dailyRemaining, dailyLimit);
  const monthlyLevel = levelFromRemaining(result.monthlyRemaining, monthlyLimit);
  return {
    ok: result.allowed,
    allowed: result.allowed,
    policy: "public_safe_status_only",
    budgetStatus: result.allowed ? mostSevereLevel([dailyLevel, monthlyLevel]) : "exhausted",
    reason: result.allowed ? undefined : result.reason,
    note: "Detailed inference spend, budget amounts, remaining amounts, provider routes, and billing routes are intentionally omitted from CLI output.",
  };
}

function printPublicResult(command, result, json) {
  let safeResult = result;
  if (result.summary) {
    safeResult = { ...result, summary: publicSummary(result.summary) };
  }
  if (result.allowed !== undefined) {
    safeResult = publicCheck(result);
  }
  if (result.ledger) {
    safeResult = {
      ok: result.ok,
      message: result.message,
      policy: "public_safe_status_only",
      note: "Ledger details are written to the requested local path but omitted from CLI output.",
    };
  }
  if (result.entry) {
    safeResult = {
      ok: result.ok,
      message: result.message,
      summary: result.summary ? publicSummary(result.summary) : undefined,
      policy: "public_safe_status_only",
      note: "Recorded entry details are omitted from CLI output to avoid publishing inference spend or route details.",
    };
  }

  if (json) {
    console.log(JSON.stringify(safeResult, null, 2));
    return;
  }

  if (safeResult.message) console.log(safeResult.message);
  if (safeResult.summary) {
    const s = safeResult.summary;
    console.log(`\n--- Budget Status ---`);
    console.log(`Status:  ${s.budgetStatus}`);
    console.log(`Today:   ${s.todayStatus}`);
    console.log(`Month:   ${s.monthStatus}`);
    console.log(`Entries: ${s.entryCount}`);
    console.log(`Note:    ${s.note}`);
  } else if (command === "check") {
    console.log(`\nBudget: ${safeResult.allowed ? "OK" : "EXCEEDED"}`);
    console.log(`Status: ${safeResult.budgetStatus}`);
    if (!safeResult.allowed && safeResult.reason) {
      console.log(`Reason: ${safeResult.reason}`);
    }
    console.log(`Note: ${safeResult.note}`);
  } else if (safeResult.note) {
    console.log(`Note: ${safeResult.note}`);
  }
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

function cmdCreate(ledgerPath, flags) {
  const ledger = createLedger({
    dailyBudgetUsd: num(flags.dailyBudget),
    monthlyBudgetUsd: num(flags.monthlyBudget),
    inputUsdPerMillion: num(flags.inputPrice),
    outputUsdPerMillion: num(flags.outputPrice),
  });
  save(ledgerPath, ledger);
  return { ok: true, message: `Ledger created at ${ledgerPath}`, ledger };
}

function cmdRecord(ledgerPath, flags) {
  const defaults = createLedger({
    dailyBudgetUsd: 5,
    monthlyBudgetUsd: 100,
    inputUsdPerMillion: 0.15,
    outputUsdPerMillion: 0.6,
  });
  const ledger = load(ledgerPath, defaults);

  const usage = {
    promptTokens: num(flags.promptTokens),
    completionTokens: num(flags.completionTokens),
    note: flags.note || "",
    route: flags.route || "",
  };

  const entry = record(ledger, usage);
  save(ledgerPath, ledger);
  return { ok: true, message: "Entry recorded", entry, summary: summarize(ledger) };
}

function cmdSummarize(ledgerPath) {
  const defaults = createLedger({
    dailyBudgetUsd: 5,
    monthlyBudgetUsd: 100,
    inputUsdPerMillion: 0.15,
    outputUsdPerMillion: 0.6,
  });
  const ledger = load(ledgerPath, defaults);
  const summary = summarize(ledger);
  return { ok: true, summary };
}

function cmdCheck(ledgerPath, flags) {
  const defaults = createLedger({
    dailyBudgetUsd: 5,
    monthlyBudgetUsd: 100,
    inputUsdPerMillion: 0.15,
    outputUsdPerMillion: 0.6,
  });
  const ledger = load(ledgerPath, defaults);

  const usage = {
    promptTokens: num(flags.promptTokens),
    completionTokens: num(flags.completionTokens),
  };

  const result = checkBudget(ledger, usage);
  return { ok: result.allowed, ...result };
}

// ---------------------------------------------------------------------------
// Help
// ---------------------------------------------------------------------------

function printHelp() {
  console.log(`
AI Budget Ledger — track AI API costs and enforce budgets locally

Usage:
  ai-budget create <path>     [options]   Create a new ledger file
  ai-budget record <path>     [options]   Record a usage entry
  ai-budget summarize <path>              Show public-safe budget status
  ai-budget check <path>      [options]   Check budget before a call

Create options:
  --daily-budget N      Daily budget limit in USD
  --monthly-budget N    Monthly budget limit in USD
  --input-price N       Cost per million input tokens (USD)
  --output-price N      Cost per million output tokens (USD)

Record / Check options:
  --prompt-tokens N       Input token count
  --completion-tokens N   Output token count
  --note "text"           Note for the entry (record only)
  --route "name"          Route/provider identifier (record only)

Global options:
  --json, -j            Output public-safe JSON
  --help, -h            Show this help

Safety:
  CLI output is intentionally limited to ok/low/critical/exhausted style
  status. Detailed inference spend, remaining budget amounts, provider routes,
  billing routes, and private operational details are not printed.

Exit codes:
  0   Success
  1   Budget exceeded (check command)
  2   Error
`.trim());
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const args = parseArgs(process.argv.slice(2));
  const [command, ledgerPath] = args._;

  if (args.flags.help || !command) {
    printHelp();
    process.exit(command ? 0 : 2);
  }

  if (!ledgerPath && command !== "help") {
    console.error("Error: ledger file path required");
    process.exit(2);
  }

  let result;
  try {
    switch (command) {
      case "create":
        result = cmdCreate(ledgerPath, args.flags);
        break;
      case "record":
        result = cmdRecord(ledgerPath, args.flags);
        break;
      case "summarize":
        result = cmdSummarize(ledgerPath);
        break;
      case "check":
        result = cmdCheck(ledgerPath, args.flags);
        break;
      case "help":
        printHelp();
        process.exit(0);
        break;
      default:
        console.error(`Unknown command: ${command}`);
        printHelp();
        process.exit(2);
    }
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(2);
  }

  printPublicResult(command, result, args.flags.json);

  // Exit code for check command
  if (command === "check" && result.ok === false) {
    process.exit(1);
  }
}

main();
