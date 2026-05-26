#!/usr/bin/env node
"use strict";

// orbit-handoff — operator CLI for founder handoff state.
//
// Subcommands:
//   list                  - print all handoffs with status, threshold progress, timelock.
//   show <id>             - dump the full record + history for one handoff.
//   tick                  - advance any expired timelocks (no executor wired here;
//                           the on-chain rotation primitive is owner-side).
//
// The proposal/vote machinery is driven by GitHub issues + comments,
// not by this CLI. This is the read/inspect surface.

const path = require("node:path");
const { loadConfig } = require("../agent/config");
const {
  listHandoffs,
  tickHandoffs,
  STATUSES
} = require("../agent/handoff");

const REPO_ROOT = path.resolve(__dirname, "..", "..");

function fmtCount(n) {
  return String(n);
}

function fmtTimelock(handoff) {
  if (!handoff.timelockEndsAt) return "—";
  const remainingMs = Date.parse(handoff.timelockEndsAt) - Date.now();
  if (remainingMs <= 0) return "elapsed";
  const days = remainingMs / (24 * 60 * 60 * 1000);
  if (days >= 1) return `${days.toFixed(1)}d remaining`;
  const hours = remainingMs / (60 * 60 * 1000);
  return `${hours.toFixed(1)}h remaining`;
}

function printRow(handoff) {
  const approvals = (handoff.approvals || []).length;
  const rejections = (handoff.rejections || []).length;
  console.log(`  ${handoff.id}  [${handoff.status}]  ${handoff.type}  ${handoff.from} -> ${handoff.to}`);
  console.log(`    approvals: ${approvals}  rejections: ${rejections}  ext: ${handoff.extensions}  ${fmtTimelock(handoff)}`);
  if (handoff.executionError) {
    console.log(`    executionError: ${handoff.executionError}`);
  }
}

function list() {
  const handoffs = listHandoffs(REPO_ROOT);
  console.log(`# orbit-handoff · ${fmtCount(handoffs.length)} record(s)`);
  console.log("");
  if (handoffs.length === 0) {
    console.log("(none)");
    console.log("");
    console.log("Handoffs are proposed via GitHub issues with the handoff label,");
    console.log("voted via APPROVE/REJECT/EXTEND ORBIT-HANDOFF <idem> comments.");
    console.log("See PLAN/SPECS/FOUNDER_HANDOFF.md for the lifecycle.");
    return;
  }
  for (const h of handoffs) printRow(h);
}

function show(id) {
  if (!id) {
    console.error("usage: orbit-handoff show <id>");
    process.exit(1);
  }
  const handoff = listHandoffs(REPO_ROOT).find((h) => h && h.id === id);
  if (!handoff) {
    console.error(`no handoff with id "${id}"`);
    process.exit(2);
  }
  console.log(JSON.stringify(handoff, null, 2));
}

async function tick() {
  console.log("# orbit-handoff · tick");
  console.log("");
  // Read adopter count + state — both feed the proposeHandoff guard, but
  // tickHandoffs itself only acts on existing TIMELOCK proposals.
  // No executor wired here; on-chain Safe rotation is an owner-driven
  // step performed off-CLI for now.
  const result = await tickHandoffs(REPO_ROOT, { now: new Date() });
  console.log(`advanced:  ${result.advanced.length}`);
  console.log(`errors:    ${result.errors.length}`);
  for (const a of result.advanced) {
    console.log(`  · ${a.id} -> ${a.status}${a.ready ? " (awaiting executor)" : ""}`);
  }
  for (const e of result.errors) {
    console.log(`  ! ${e.id}: ${e.error}`);
  }
}

async function main() {
  // Touch loadConfig so the CLI surfaces config errors early (consistent
  // with the rest of the cli/ scripts).
  try { loadConfig(); } catch { /* ignore — handoff CLI doesn't need full config */ }
  const [, , subcommand, ...rest] = process.argv;
  switch (subcommand) {
    case "list":
    case undefined:
      list();
      break;
    case "show":
      show(rest[0]);
      break;
    case "tick":
      await tick();
      break;
    default:
      console.error(`unknown subcommand: ${subcommand}`);
      console.error("usage: orbit-handoff [list|show <id>|tick]");
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(err.stack || err.message);
  process.exit(1);
});
