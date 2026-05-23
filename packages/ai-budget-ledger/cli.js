#!/usr/bin/env node
"use strict";

/**
 * AI Budget Ledger — CLI
 *
 * Commands: create, record, summarize, check
 * Zero external dependencies.
 */

const fs = require("fs");
const path = require("path");
const { createLedger, record, totals, checkBudget, summarize, estimateCost } = require("./ledger");
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
AI Budget Ledger — track AI API costs, enforce budgets

Usage:
  ai-budget create <path>     [options]   Create a new ledger file
  ai-budget record <path>     [options]   Record a usage entry
  ai-budget summarize <path>              Show spend summary
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
  --json, -j            Output raw JSON
  --help, -h            Show this help

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

  if (args.flags.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    if (result.message) console.log(result.message);
    if (result.summary) {
      const s = result.summary;
      console.log(`\n--- Budget Summary ---`);
      console.log(`Entries: ${s.entryCount}`);
      console.log(`Today:   $${s.today.spent.toFixed(6)}${s.today.limit ? ` / $${s.today.limit}` : ""}${s.today.remaining !== null ? ` (remaining: $${s.today.remaining.toFixed(6)})` : ""}`);
      console.log(`Month:   $${s.month.spent.toFixed(6)}${s.month.limit ? ` / $${s.month.limit}` : ""}${s.month.remaining !== null ? ` (remaining: $${s.month.remaining.toFixed(6)})` : ""}`);
      console.log(`Total:   $${s.lifetime.toFixed(6)}`);
    }
    if (result.allowed !== undefined) {
      console.log(`\nBudget: ${result.allowed ? "OK" : "EXCEEDED"}`);
      if (!result.allowed) {
        console.log(`Reason: ${result.reason}`);
      }
      console.log(`Estimated cost: $${result.estimatedCost.toFixed(8)}`);
      console.log(`Daily remaining: $${result.dailyRemaining === Infinity ? "unlimited" : result.dailyRemaining.toFixed(6)}`);
      console.log(`Monthly remaining: $${result.monthlyRemaining === Infinity ? "unlimited" : result.monthlyRemaining.toFixed(6)}`);
    }
  }

  // Exit code for check command
  if (command === "check" && result.ok === false) {
    process.exit(1);
  }
}

main();
