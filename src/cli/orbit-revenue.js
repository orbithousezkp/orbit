#!/usr/bin/env node
"use strict";

// orbit-revenue
//
// Prints a summary of the revenue framework state: live streams, active
// experiments, draft proposals from the hypothesizer, warnings (identity
// capture, treasury-utility), AI routing margin telemetry, and recent
// market signals. Read-only, side-effect-free.
//
// Usage:
//   node src/cli/orbit-revenue.js [--json] [--repo-root <path>] [--help]
//
// Exit code: 0 always (read-only). 1 only if the CLI itself errors before
// it can produce output.

const fs = require("fs");
const path = require("path");

const revenueSummary = require("../agent/revenue-summary");
const { loadTreasury } = require("../agent/treasury");

function safeReadJson(file) {
  try {
    const raw = fs.readFileSync(file, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function parseArgv(argv) {
  const args = Array.isArray(argv) ? argv.slice(2) : [];
  const flags = {
    json: false,
    help: false,
    repoRoot: null
  };
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--json") {
      flags.json = true;
    } else if (arg === "--help" || arg === "-h") {
      flags.help = true;
    } else if (arg === "--repo-root") {
      const next = args[i + 1];
      if (typeof next === "string" && next.length > 0 && !next.startsWith("--")) {
        flags.repoRoot = next;
        i += 1;
      }
    } else if (arg.startsWith("--repo-root=")) {
      flags.repoRoot = arg.slice("--repo-root=".length);
    }
  }
  return flags;
}

function helpText() {
  return [
    "orbit-revenue — print a summary of the revenue framework state.",
    "",
    "Usage:",
    "  node src/cli/orbit-revenue.js [--json] [--repo-root <path>] [--help]",
    "",
    "Options:",
    "  --json             Emit the summary as JSON (machine-readable).",
    "  --repo-root <p>    Override the repo root (defaults to process.cwd()).",
    "  --help, -h         Show this message.",
    ""
  ].join("\n");
}

function loadStateFor(repoRoot) {
  const file = path.join(repoRoot, "memory", "state.json");
  const parsed = safeReadJson(file);
  return parsed && typeof parsed === "object" ? parsed : {};
}

function loadTreasuryFor(repoRoot) {
  try {
    const treasury = loadTreasury(repoRoot);
    return treasury && typeof treasury === "object" ? treasury : {};
  } catch {
    // Fallback: read treasury.json directly. We never want a missing
    // treasury to crash the CLI.
    const file = path.join(repoRoot, "memory", "treasury.json");
    const parsed = safeReadJson(file);
    return parsed && typeof parsed === "object" ? parsed : {};
  }
}

function main(argv, options) {
  const opts = options && typeof options === "object" ? options : {};
  const stdout = opts.stdout || process.stdout;
  const stderr = opts.stderr || process.stderr;
  const env = opts.env || process.env;
  const flags = parseArgv(argv || process.argv);

  if (flags.help) {
    stdout.write(helpText());
    return 0;
  }

  const repoRoot = flags.repoRoot || opts.repoRoot || process.cwd();
  let state;
  let treasury;
  try {
    state = loadStateFor(repoRoot);
    treasury = loadTreasuryFor(repoRoot);
  } catch (err) {
    stderr.write(`orbit-revenue: failed to load inputs: ${err && err.message ? err.message : err}\n`);
    return 1;
  }

  let summary;
  try {
    summary = revenueSummary.buildSummary(state, treasury, env, {
      repoRoot,
      now: new Date()
    });
  } catch (err) {
    stderr.write(`orbit-revenue: buildSummary failed: ${err && err.message ? err.message : err}\n`);
    return 1;
  }

  if (flags.json) {
    stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  } else {
    stdout.write(`${revenueSummary.renderSummary(summary)}\n`);
  }
  return 0;
}

if (require.main === module) {
  const code = main(process.argv);
  process.exit(code);
}

module.exports = {
  main,
  parseArgv,
  helpText
};
