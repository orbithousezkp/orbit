#!/usr/bin/env node
"use strict";

const path = require("path");
const {
  loadProof,
  loadAllProofs,
  loadRecentProofs,
  summarizeProof,
  formatSummary,
  aggregateStats,
  formatAggregate
} = require("./viewer");

function usage(exitCode = 0) {
  console.log(`Usage: proof-viewer <command> [args]

Commands:
  summary <proof.json>          One-line summary of a single proof file
  show <proof.json>             Full formatted summary of a single proof
  recent <proofs-dir> [N]       Summarize the N most-recent proofs (default 5)
  stats <proofs-dir>            Aggregate stats across all proofs in a directory
`);
  process.exit(exitCode);
}

const [, , cmd, ...rest] = process.argv;

try {
  switch (cmd) {
    case "summary":
    case "show": {
      if (!rest[0]) usage(1);
      const proof = loadProof(path.resolve(rest[0]));
      const summary = summarizeProof(proof);
      console.log(formatSummary(summary));
      break;
    }
    case "recent": {
      if (!rest[0]) usage(1);
      const root = path.resolve(rest[0]);
      const count = rest[1] ? Number(rest[1]) : 5;
      const proofs = loadRecentProofs(root, count);
      for (const p of proofs) console.log(formatSummary(summarizeProof(p)));
      break;
    }
    case "stats": {
      if (!rest[0]) usage(1);
      const root = path.resolve(rest[0]);
      const all = loadAllProofs(root);
      console.log(formatAggregate(aggregateStats(all)));
      break;
    }
    case "--help":
    case "-h":
    case undefined:
      usage(cmd ? 0 : 1);
      break;
    default:
      console.error(`unknown command: ${cmd}`);
      usage(1);
  }
} catch (error) {
  console.error(`proof-viewer: ${error.message}`);
  process.exit(1);
}
