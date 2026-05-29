#!/usr/bin/env node
"use strict";

// scripts/rotate-ai-key.js — T-6 producer (security audit 2026-05-29).
//
// Stamps `state.aiKeyRotation.lastRotatedAt = ISO-now` in
// `memory/state.json` to mark that the AI provider key was just rotated.
// Owner runs this AFTER rotating the actual API key in the provider
// dashboard (Anthropic / OpenAI / OpenGateway / etc.) and updating the
// `ORBIT_AI_PROVIDER_KEYS` GitHub secret.
//
// The src/agent/ai-key-rotation.js predicate reads this timestamp and
// emits a `due:true` signal once the value is >90 days old. T-6 is
// advisory-only — it never auto-blocks AI work. The cycle opens an
// `orbit:rotation-due` GitHub issue (idempotent) when due.
//
// Usage:
//   node scripts/rotate-ai-key.js                # stamps now
//   node scripts/rotate-ai-key.js --dry-run      # prints plan, no write
//   node scripts/rotate-ai-key.js --interval=60  # set custom interval (days)
//
// Exit 0: stamped. Exit 1: failed to write.

const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "..");
const STATE_PATH = path.join(REPO_ROOT, "memory", "state.json");

function parseArgs(argv) {
  const out = { dryRun: false, intervalDays: null };
  for (const arg of argv.slice(2)) {
    if (arg === "--dry-run" || arg === "-n") out.dryRun = true;
    else if (arg.startsWith("--interval=")) {
      const n = Number(arg.slice("--interval=".length));
      if (Number.isInteger(n) && n > 0) out.intervalDays = n;
    }
  }
  return out;
}

function main() {
  const args = parseArgs(process.argv);

  let state;
  try {
    state = JSON.parse(fs.readFileSync(STATE_PATH, "utf-8"));
  } catch (err) {
    console.error(`error: cannot read ${STATE_PATH}: ${err.message}`);
    process.exit(1);
  }

  const now = new Date().toISOString();
  const prev = state.aiKeyRotation || {};
  const next = {
    ...prev,
    lastRotatedAt: now
  };
  if (args.intervalDays !== null) next.intervalDays = args.intervalDays;

  const before = prev.lastRotatedAt || "<never>";
  const after = next.lastRotatedAt;
  console.log(`T-6 key rotation stamp`);
  console.log(`  state file:    ${path.relative(REPO_ROOT, STATE_PATH)}`);
  console.log(`  previous:      ${before}`);
  console.log(`  new:           ${after}`);
  if (next.intervalDays != null) {
    console.log(`  intervalDays:  ${next.intervalDays}`);
  }

  if (args.dryRun) {
    console.log(`  (--dry-run; no write)`);
    return;
  }

  state.aiKeyRotation = next;
  try {
    fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2) + "\n", "utf-8");
  } catch (err) {
    console.error(`error: cannot write ${STATE_PATH}: ${err.message}`);
    process.exit(1);
  }
  console.log(`stamped. commit & push memory/state.json to record the rotation.`);
}

main();
