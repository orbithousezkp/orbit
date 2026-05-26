#!/usr/bin/env node
"use strict";

// orbit-errors — operator CLI for the structured error log
// (memory/errors.jsonl, Patch Set M).
//
// Subcommands:
//   tail [N]     - last N entries (default 10), newest last.
//   count        - per-phase counts (tool, fatal, handoff-tick, etc).
//   list [N]     - same as tail but newest first.
//   show <N>     - dump the Nth-most-recent entry as full JSON.
//   clear        - WARNING: truncates the log. Owner only.

const fs = require("node:fs");
const path = require("node:path");
const { readRecentErrors, DEFAULT_LOG_PATH } = require("../agent/error-log");

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const LOG_ABS = path.join(REPO_ROOT, DEFAULT_LOG_PATH);

function fmtTs(iso) {
  if (!iso) return "—";
  // YYYY-MM-DD HH:MM (drop seconds + Z for readability).
  return String(iso).replace("T", " ").replace(/\.\d+Z$/, "").slice(0, 16);
}

function readAll() {
  return readRecentErrors(REPO_ROOT, { limit: 10_000 });
}

function tail(n) {
  const limit = Number.parseInt(n, 10) || 10;
  const entries = readRecentErrors(REPO_ROOT, { limit });
  if (entries.length === 0) {
    console.log("(no errors logged)");
    return;
  }
  console.log(`# orbit-errors · tail ${entries.length}`);
  console.log("");
  for (const e of entries) {
    const tool = e.tool ? ` [${e.tool}]` : "";
    const code = e.code ? ` ${e.code}` : "";
    console.log(`${fmtTs(e.ts)}  ${e.phase}${tool}${code}`);
    if (e.message) console.log(`  ${String(e.message).slice(0, 240)}`);
  }
}

function list(n) {
  const limit = Number.parseInt(n, 10) || 10;
  const entries = readRecentErrors(REPO_ROOT, { limit }).reverse();
  if (entries.length === 0) {
    console.log("(no errors logged)");
    return;
  }
  console.log(`# orbit-errors · last ${entries.length} (newest first)`);
  console.log("");
  for (const e of entries) {
    const tool = e.tool ? ` [${e.tool}]` : "";
    console.log(`${fmtTs(e.ts)}  ${e.phase}${tool}`);
    if (e.message) console.log(`  ${String(e.message).slice(0, 240)}`);
  }
}

function count() {
  const entries = readAll();
  if (entries.length === 0) {
    console.log("(no errors logged)");
    return;
  }
  const byPhase = new Map();
  for (const e of entries) {
    byPhase.set(e.phase || "unknown", (byPhase.get(e.phase || "unknown") || 0) + 1);
  }
  console.log(`# orbit-errors · count by phase (${entries.length} total)`);
  console.log("");
  const rows = Array.from(byPhase.entries()).sort((a, b) => b[1] - a[1]);
  for (const [phase, n] of rows) {
    console.log(`  ${String(n).padStart(5)}  ${phase}`);
  }
}

function show(n) {
  const idx = Number.parseInt(n, 10) || 1;
  const entries = readRecentErrors(REPO_ROOT, { limit: idx });
  const entry = entries[entries.length - idx];
  if (!entry) {
    console.error(`no entry at offset ${idx} from the end`);
    process.exit(2);
  }
  console.log(JSON.stringify(entry, null, 2));
}

function clear() {
  if (!fs.existsSync(LOG_ABS)) {
    console.log("(nothing to clear — log doesn't exist)");
    return;
  }
  // Truncate, don't unlink — keeps the file in git history if committed.
  fs.writeFileSync(LOG_ABS, "");
  console.log(`cleared ${DEFAULT_LOG_PATH}`);
}

function main() {
  const [, , subcommand, arg] = process.argv;
  switch (subcommand) {
    case undefined:
    case "tail":
      tail(arg);
      break;
    case "list":
      list(arg);
      break;
    case "count":
      count();
      break;
    case "show":
      show(arg);
      break;
    case "clear":
      clear();
      break;
    default:
      console.error(`unknown subcommand: ${subcommand}`);
      console.error("usage: orbit-errors [tail|list|count|show <n>|clear] [N]");
      process.exit(1);
  }
}

main();
