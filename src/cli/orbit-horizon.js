#!/usr/bin/env node
"use strict";

// orbit-horizon
//
// CLI for the Horizon Scanner. Read-only by default; `scan` runs a dry-run
// scan that produces no public artifacts. See PLAN/SPECS/HORIZON_SCANNER.md
// for the spec and FOREVER_ROADMAP.md for the role of the scanner.
//
// Subcommands:
//   status              show config + source registry + candidate counts
//   scan                run one dry-run scan, log what would happen
//   list-candidates     list pending candidate specs (slug, current, age)
//   help                show this message
//
// Default subcommand is `status`. All output goes to stdout; the CLI never
// writes to PLAN/ or memory/ unless the underlying scan does (which only
// happens when dryRun=false in memory/horizon-config.json AND
// state.preLaunchVerified === true — neither of which is true by default).

const path = require("node:path");

const {
  loadSources,
  loadCandidates,
  loadConfig,
  getEnabledSources,
  runHorizonScan
} = require("../agent/horizon-scanner");

const REPO_ROOT = path.resolve(__dirname, "../..");

function fmtCount(n) {
  return typeof n === "number" ? String(n) : "—";
}

function status() {
  const cfg = loadConfig(REPO_ROOT);
  const sourcesRecord = loadSources(REPO_ROOT);
  const enabled = getEnabledSources(sourcesRecord);
  const candidatesRecord = loadCandidates(REPO_ROOT);
  const candidates = candidatesRecord.candidates;
  const pending = candidates.filter((c) => c && c.status === "pending");
  const promoted = candidates.filter((c) => c && c.status === "promoted");
  const archived = candidates.filter((c) => c && c.status === "archived");

  console.log("# orbit-horizon · status");
  console.log("");
  console.log("config:");
  console.log("  dryRun:                  " + cfg.dryRun);
  console.log("  scanCadenceHours:        " + cfg.scanCadenceHours);
  console.log("  maxItemsPerScan:         " + cfg.maxItemsPerScan);
  console.log("  maxCandidatesPerScan:    " + cfg.maxCandidatesPerScan);
  console.log("  archiveAfterCycles:      " + cfg.archiveAfterCycles);
  console.log("");
  console.log("sources:");
  console.log("  total in registry:       " + sourcesRecord.sources.length);
  console.log("  enabled:                 " + enabled.length);
  if (enabled.length > 0) {
    for (const s of enabled) {
      console.log("    · " + s.id + " (" + s.type + ", every " + s.fetchCadenceHours + "h)");
    }
  } else {
    console.log("  (all sources are disabled; scanner ships dormant)");
  }
  console.log("");
  console.log("candidates:");
  console.log("  pending:                 " + fmtCount(pending.length));
  console.log("  promoted (lifetime):     " + fmtCount(promoted.length));
  console.log("  archived (lifetime):     " + fmtCount(archived.length));
  console.log("");
  console.log("see PLAN/SPECS/HORIZON_SCANNER.md and PLAN/FOREVER_ROADMAP.md.");
}

async function scan() {
  console.log("# orbit-horizon · scan (dry-run)");
  console.log("");
  const summary = await runHorizonScan(REPO_ROOT);
  if (summary.guarded) {
    console.log("GUARDED: " + summary.guard);
    console.log("(dry-run mode is permitted pre-launch — see HORIZON_SCANNER.md §6)");
    console.log("");
  }
  console.log("dryRun:                  " + summary.dryRun);
  console.log("enabledSources:          " + summary.enabledSources);
  console.log("fetchedItems:            " + summary.fetchedItems);
  console.log("classifiedItems:         " + summary.classifiedItems);
  console.log("candidatesDrafted:       " + summary.candidatesDrafted);
  console.log("candidatesSkippedDup:    " + summary.candidatesSkippedDuplicate);
  console.log("classifierRejections:    " + summary.classifierRejections);
  if (summary.candidates.length > 0) {
    console.log("");
    console.log("candidates produced this scan:");
    for (const c of summary.candidates) {
      console.log("  · " + c.slug + " [" + c.primaryCurrent + "] " + c.filePath);
    }
  }
  if (summary.lifecycle) {
    console.log("");
    console.log("lifecycle ticker:");
    console.log("  archived this scan:    " + summary.lifecycle.archived.length);
    console.log("  still pending:         " + summary.lifecycle.stillPending);
  }
  if (Array.isArray(summary.errors) && summary.errors.length > 0) {
    console.log("");
    console.log("errors:");
    for (const e of summary.errors) {
      console.log("  · " + (e.sourceId || "—") + " (" + e.op + "): " + e.error);
    }
  }
  if (summary.enabledSources === 0) {
    console.log("");
    console.log("note: no sources are enabled. enable a source in");
    console.log("memory/horizon-sources.json to make the scanner do anything.");
  }
}

function listCandidates() {
  const candidatesRecord = loadCandidates(REPO_ROOT);
  const pending = candidatesRecord.candidates.filter((c) => c && c.status === "pending");
  console.log("# orbit-horizon · pending candidates (" + pending.length + ")");
  console.log("");
  if (pending.length === 0) {
    console.log("(none)");
    return;
  }
  pending.sort((a, b) => (Date.parse(a.proposedAt) || 0) - (Date.parse(b.proposedAt) || 0));
  for (const c of pending) {
    const age = c.ageOutAt
      ? Math.max(0, Math.round((Date.parse(c.ageOutAt) - Date.now()) / 86_400_000))
      : "?";
    console.log("· " + c.slug);
    console.log("    id:           " + c.id);
    console.log("    current:      " + c.primaryCurrent);
    console.log("    proposed:     " + c.proposedAt);
    console.log("    days to fade: " + age);
    console.log("    file:         " + c.filePath);
    if (c.issueUrl) console.log("    review:       " + c.issueUrl);
    console.log("");
  }
}

function help() {
  console.log("orbit-horizon · the meta-roadmap engine");
  console.log("");
  console.log("subcommands:");
  console.log("  status              show config + sources + candidate counts (default)");
  console.log("  scan                run one dry-run scan");
  console.log("  list-candidates     list pending candidate specs");
  console.log("  help                this message");
  console.log("");
  console.log("see PLAN/SPECS/HORIZON_SCANNER.md");
}

async function main() {
  const cmd = process.argv[2] || "status";
  switch (cmd) {
    case "status": return status();
    case "scan": return scan();
    case "list-candidates":
    case "list":
      return listCandidates();
    case "help":
    case "-h":
    case "--help":
      return help();
    default:
      console.error("unknown subcommand: " + cmd);
      console.error("run `orbit-horizon help` for usage");
      process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error("orbit-horizon failed:", e.message);
  process.exitCode = 1;
});
