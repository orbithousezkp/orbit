#!/usr/bin/env node
"use strict";

// orbit-healthcheck — nightly self-monitoring.
//
// Lightweight checks that complement `npm run health` (file presence)
// and `npm test` (logic correctness). This script is run from a
// scheduled GitHub Actions workflow. It must:
//
//   - Exit 0 when the project is healthy.
//   - Exit non-zero with a clear summary when something is off.
//   - Print machine-parseable lines on stdout so the workflow can
//     post them as an issue body.
//
// Checks (in order, fail-fast on critical ones):
//   1. state.json exists and parses.
//   2. state.lastActive (or lastCycleAt) is within MAX_CYCLE_AGE_MS.
//      Cron fires every 15 min; a >1h gap means cycle is dead.
//   3. memory/errors.jsonl, if present, hasn't grown by more than
//      MAX_ERRORS_DELTA in the last 24h.
//   4. memory/launch-persist-failure.json marker absent (the
//      Layer 1 alert).
//   5. cycles.jsonl latest entry doesn't have a fatal-shaped result.

const fs = require("node:fs");
const path = require("node:path");

const MAX_CYCLE_AGE_MS = 3 * 60 * 60 * 1000;   // 3h — generous for a 15-min cron
const MAX_ERRORS_DELTA_24H = 100;              // unusual error spike

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const results = [];

function record(status, name, detail) {
  results.push({ status, name, detail });
  const tag = status === "PASS" ? "[ok]" : status === "WARN" ? "[warn]" : "[fail]";
  console.log(`${tag} ${name}${detail ? ": " + detail : ""}`);
}

function readJson(rel, fallback) {
  try {
    return JSON.parse(fs.readFileSync(path.join(REPO_ROOT, rel), "utf-8"));
  } catch {
    return fallback;
  }
}

// 1. state.json
const state = readJson("memory/state.json", null);
if (!state) {
  record("FAIL", "state.json", "missing or unparseable");
} else {
  record("PASS", "state.json", `cycle ${state.cycle ?? "?"}`);

  // 2. freshness
  const lastIso = state.lastActive || state.lastCycleAt || state.lastFinishedAt;
  if (!lastIso) {
    record("WARN", "cycle-freshness", "no lastActive / lastCycleAt in state");
  } else {
    const age = Date.now() - Date.parse(lastIso);
    if (!Number.isFinite(age)) {
      record("FAIL", "cycle-freshness", `unparseable timestamp: ${lastIso}`);
    } else if (age > MAX_CYCLE_AGE_MS) {
      const hours = (age / (60 * 60 * 1000)).toFixed(1);
      record("FAIL", "cycle-freshness", `last cycle ${hours}h ago (max ${MAX_CYCLE_AGE_MS / 3_600_000}h)`);
    } else {
      const minutes = (age / 60_000).toFixed(0);
      record("PASS", "cycle-freshness", `last cycle ${minutes}m ago`);
    }
  }
}

// 3. errors.jsonl growth
try {
  const errorsPath = path.join(REPO_ROOT, "memory/errors.jsonl");
  if (fs.existsSync(errorsPath)) {
    const contents = fs.readFileSync(errorsPath, "utf-8");
    const lines = contents.split("\n").filter((l) => l.length > 0);
    const recent24hThreshold = Date.now() - 24 * 60 * 60 * 1000;
    let recent24h = 0;
    for (const line of lines) {
      try {
        const e = JSON.parse(line);
        if (Date.parse(e.ts) > recent24hThreshold) recent24h++;
      } catch { /* malformed line — ignore */ }
    }
    if (recent24h > MAX_ERRORS_DELTA_24H) {
      record("FAIL", "errors-spike", `${recent24h} errors in 24h (threshold ${MAX_ERRORS_DELTA_24H})`);
    } else if (recent24h > 0) {
      record("PASS", "errors-recent-24h", `${recent24h} (within budget)`);
    } else {
      record("PASS", "errors-recent-24h", "0");
    }
  } else {
    record("PASS", "errors.jsonl", "no log (clean)");
  }
} catch (err) {
  record("WARN", "errors-check", err.message);
}

// 4. launch-persist-failure marker
if (fs.existsSync(path.join(REPO_ROOT, "memory/launch-persist-failure.json"))) {
  record("FAIL", "launch-persist-failure", "Layer 1 marker present — see memory/launch-persist-failure.json");
} else {
  record("PASS", "launch-persist-failure", "no marker");
}

// 5. latest cycles.jsonl entry sanity
try {
  const cyclesPath = path.join(REPO_ROOT, "memory/cycles.jsonl");
  if (fs.existsSync(cyclesPath)) {
    const tail = fs.readFileSync(cyclesPath, "utf-8")
      .split("\n").filter(Boolean).slice(-1)[0];
    if (tail) {
      const parsed = JSON.parse(tail);
      const resultStr = String(parsed.result || "");
      if (/fatal|crashed|abort/i.test(resultStr)) {
        record("WARN", "latest-cycle", `recent result mentions fatal/crashed/abort`);
      } else {
        record("PASS", "latest-cycle", `cycle ${parsed.cycle} ok`);
      }
    }
  }
} catch (err) {
  record("WARN", "cycles-check", err.message);
}

// Summary
const fails = results.filter((r) => r.status === "FAIL").length;
const warns = results.filter((r) => r.status === "WARN").length;
console.log("");
console.log(`summary: ${results.length - fails - warns} pass, ${warns} warn, ${fails} fail`);

if (fails > 0) {
  process.exit(1);
}
