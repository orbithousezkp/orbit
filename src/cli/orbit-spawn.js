#!/usr/bin/env node
"use strict";

// orbit-spawn — operator CLI for the spawn lifecycle.
//
// Subcommands:
//   list                  - print all spawn proposals.
//   show <id>             - dump the Nth proposal as JSON.
//   tick                  - advance approved proposals via the
//                           configured executor (dry-run unless
//                           ORBIT_SPAWN_TOKEN + ORBIT_SPAWN_ORG set).
//   family                - print the live children ledger.

const path = require("node:path");
const { listSpawns, listFamily, tickSpawns } = require("../agent/spawn");
const { makeExecutor } = require("../agent/spawn-executor");

const REPO_ROOT = path.resolve(__dirname, "..", "..");

function fmtTs(iso) {
  if (!iso) return "—";
  return String(iso).replace("T", " ").replace(/\.\d+Z$/, "").slice(0, 16);
}

function list() {
  const spawns = listSpawns(REPO_ROOT);
  console.log(`# orbit-spawn · ${spawns.length} proposal(s)`);
  console.log("");
  if (spawns.length === 0) {
    console.log("(none)");
    console.log("");
    console.log("propose via the propose_spawn tool from inside a cycle, or by");
    console.log("opening a github issue + APPROVE ORBIT-SPAWN <idem> comments");
    console.log("(see PLAN/SPECS/SPAWN.md).");
    return;
  }
  for (const s of spawns) {
    const approvals = (s.approvals || []).length;
    const rejections = (s.rejections || []).length;
    console.log(`  ${s.id}  [${s.status}]  ${s.type}  ${s.name}`);
    console.log(`    approvals: ${approvals}  rejections: ${rejections}  visibility: ${s.visibility || "public"}`);
    if (s.childUrl) console.log(`    child: ${s.childUrl}`);
    if (s.executionError) console.log(`    error: ${s.executionError}`);
  }
}

function show(id) {
  if (!id) {
    console.error("usage: orbit-spawn show <id>");
    process.exit(1);
  }
  const spawn = listSpawns(REPO_ROOT).find((s) => s && s.id === id);
  if (!spawn) {
    console.error(`no spawn with id "${id}"`);
    process.exit(2);
  }
  console.log(JSON.stringify(spawn, null, 2));
}

async function tick() {
  console.log("# orbit-spawn · tick");
  console.log("");
  const executor = makeExecutor(REPO_ROOT, process.env);
  const result = await tickSpawns(REPO_ROOT, { now: new Date(), executor });
  console.log(`advanced:  ${result.advanced.length}`);
  console.log(`errors:    ${result.errors.length}`);
  for (const a of result.advanced) {
    console.log(`  · ${a.id} -> ${a.status}${a.childUrl ? ` · ${a.childUrl}` : ""}`);
  }
  for (const e of result.errors) {
    console.log(`  ! ${e.id}: ${e.error}${e.code ? ` (${e.code})` : ""}`);
  }
}

function family() {
  const kids = listFamily(REPO_ROOT);
  console.log(`# orbit-spawn · family · ${kids.length} live child(ren)`);
  console.log("");
  if (kids.length === 0) {
    console.log("(none yet)");
    return;
  }
  for (const k of kids) {
    const tag = k.dryRun ? " [dry-run]" : "";
    console.log(`  ${k.id || "?"}  ${k.name}${tag}  (${k.type})  born ${fmtTs(k.bornAt)}`);
    if (k.url) console.log(`    ${k.url}`);
  }
}

async function main() {
  const [, , sub, arg] = process.argv;
  switch (sub) {
    case undefined:
    case "list":
      list();
      break;
    case "show":
      show(arg);
      break;
    case "tick":
      await tick();
      break;
    case "family":
      family();
      break;
    default:
      console.error(`unknown subcommand: ${sub}`);
      console.error("usage: orbit-spawn [list|show <id>|tick|family]");
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(err.stack || err.message);
  process.exit(1);
});
