#!/usr/bin/env node
"use strict";

// orbit-preflight — single command that says whether a token launch can
// proceed. Groups checks into 7 sections (repo, Safes, signer/operator/AI,
// D-018 gate, treasury topology, public surface, OWNER_ACTIONS punch list).
// Each gate prints PASS / WARN / FAIL with a short hint. Exit 0 if no
// FAILs (WARNs are OK), exit 1 if any FAIL.
//
// CLI flags:
//   --strict   Exit code is non-zero if ANY check is not PASS (WARNs also
//              fail). Use this in launch-day CI gates so a "WARN on
//              feature branch / dirty working tree" cannot silently
//              proceed to a real launch step.
//
// The module exposes a programmatic `runPreflight({ env, repoRoot, state,
// treasury, ownerActions, strict })` for tests; the CLI is a thin wrapper
// that reads from disk + process.env and prints the produced lines.

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const { loadSafes, SAFE_DEFINITIONS } = require("../agent/safes");
const { isAddress } = require("../agent/addresses");

const PASS = "PASS";
const WARN = "WARN";
const FAIL = "FAIL";
const INFO = "INFO";

const COLOR = {
  reset: "[0m",
  green: "[32m",
  yellow: "[33m",
  red: "[31m",
  cyan: "[36m",
  bold: "[1m"
};

function colorize(text, color, useColor) {
  if (!useColor) return text;
  return `${color}${text}${COLOR.reset}`;
}

function marker(status, useColor) {
  switch (status) {
    case PASS: return colorize("PASS", COLOR.green, useColor);
    case WARN: return colorize("WARN", COLOR.yellow, useColor);
    case FAIL: return colorize("FAIL", COLOR.red, useColor);
    case INFO: return colorize("INFO", COLOR.cyan, useColor);
    default:   return status;
  }
}

function safeReadFile(file) {
  try { return fs.readFileSync(file, "utf-8"); }
  catch { return null; }
}

function safeReadJson(file) {
  const raw = safeReadFile(file);
  if (raw == null) return { ok: false, reason: "missing", data: null };
  try { return { ok: true, data: JSON.parse(raw) }; }
  catch (err) { return { ok: false, reason: "parse_error", error: err.message, data: null }; }
}

function gitCmd(args, repoRoot) {
  try {
    const out = execFileSync("git", args, {
      cwd: repoRoot,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"]
    });
    return { ok: true, out: out.trim() };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// ===========================================================================
// Section 1: Repo state
// ===========================================================================

function checkRepoState(repoRoot) {
  const checks = [];
  const gitDir = path.join(repoRoot, ".git");
  const hasGit = fs.existsSync(gitDir);

  checks.push({
    status: hasGit ? PASS : FAIL,
    label: "git initialized",
    detail: hasGit ? ".git directory present" : ".git directory missing"
  });

  if (!hasGit) {
    checks.push({ status: FAIL, label: "on main branch",         detail: "not a git repo" });
    checks.push({ status: FAIL, label: "working tree clean",     detail: "not a git repo" });
    checks.push({ status: FAIL, label: "recent commit",          detail: "not a git repo" });
    return checks;
  }

  const branch = gitCmd(["rev-parse", "--abbrev-ref", "HEAD"], repoRoot);
  if (branch.ok) {
    const onMain = branch.out === "main";
    checks.push({
      status: onMain ? PASS : WARN,
      label: "on main branch",
      detail: onMain ? "main" : `current branch: ${branch.out}`
    });
  } else {
    checks.push({ status: WARN, label: "on main branch", detail: "could not read branch" });
  }

  const status = gitCmd(["status", "--porcelain"], repoRoot);
  if (status.ok) {
    const lines = status.out ? status.out.split("\n").filter(Boolean) : [];
    if (lines.length === 0) {
      checks.push({ status: PASS, label: "working tree clean", detail: "no uncommitted changes" });
    } else {
      checks.push({
        status: WARN,
        label: "working tree clean",
        detail: `${lines.length} uncommitted file(s)`
      });
    }
  } else {
    checks.push({ status: WARN, label: "working tree clean", detail: "could not read status" });
  }

  const lastCommit = gitCmd(["log", "-1", "--format=%cI"], repoRoot);
  if (lastCommit.ok && lastCommit.out) {
    const when = Date.parse(lastCommit.out);
    if (Number.isFinite(when)) {
      const ageDays = (Date.now() - when) / (1000 * 60 * 60 * 24);
      if (ageDays < 30) {
        checks.push({
          status: PASS,
          label: "recent commit",
          detail: `${formatAgo(when)}`
        });
      } else {
        checks.push({
          status: WARN,
          label: "recent commit",
          detail: `last commit ${formatAgo(when)} (>30 days)`
        });
      }
    } else {
      checks.push({ status: WARN, label: "recent commit", detail: "could not parse commit date" });
    }
  } else {
    checks.push({ status: WARN, label: "recent commit", detail: "no commits yet" });
  }

  return checks;
}

function formatAgo(timestampMs) {
  const seconds = Math.max(0, Math.floor((Date.now() - timestampMs) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ===========================================================================
// Section 2: Configuration — Safes (D-019)
// ===========================================================================

function checkSafes(env) {
  const result = loadSafes(env || {});
  const checks = [];

  if (result.ok) {
    for (const safe of result.safes) {
      checks.push({
        status: PASS,
        label: pad(safe.id, 18),
        detail: `${pad(safe.env, 28)} ${safe.address}`
      });
    }
    return checks;
  }

  // Mixed: per-Safe row showing its specific state.
  for (const safe of result.safes) {
    if (safe.valid) {
      checks.push({
        status: PASS,
        label: pad(safe.id, 18),
        detail: `${pad(safe.env, 28)} ${safe.address}`
      });
    } else {
      let detail;
      if (safe.reason === "missing") {
        detail = `${pad(safe.env, 28)} <missing>  (${safe.purpose})`;
      } else if (safe.reason === "invalid") {
        detail = `${pad(safe.env, 28)} invalid address: ${safe.address}`;
      } else if (safe.reason === "duplicate") {
        detail = `${pad(safe.env, 28)} duplicate of another Safe`;
      } else {
        detail = `${pad(safe.env, 28)} ${safe.reason || "not configured"}`;
      }
      checks.push({
        status: FAIL,
        label: pad(safe.id, 18),
        detail
      });
    }
  }

  if (result.conflicts.length > 0) {
    for (const c of result.conflicts) {
      checks.push({
        status: FAIL,
        label: "duplicate-address",
        detail: `${c.address} reused by [${c.ids.join(", ")}]`
      });
    }
  }

  return checks;
}

function pad(str, width) {
  const s = String(str == null ? "" : str);
  if (s.length >= width) return s;
  return s + " ".repeat(width - s.length);
}

// ===========================================================================
// Section 3: Configuration — signer + operator + AI
// ===========================================================================

function checkSignerOperatorAi(env) {
  const e = env || {};
  const checks = [];
  const signer = String(e.ORBIT_AGENT_SIGNER || "").trim();
  const pkey = String(e.ORBIT_WALLET_PRIVATE_KEY || "").trim();

  if (signer === "") {
    checks.push({ status: FAIL, label: "ORBIT_AGENT_SIGNER",         detail: "not set" });
  } else if (!isAddress(signer)) {
    checks.push({ status: FAIL, label: "ORBIT_AGENT_SIGNER",         detail: `not a valid address: ${signer}` });
  } else {
    checks.push({ status: PASS, label: "ORBIT_AGENT_SIGNER",         detail: signer });
  }

  if (pkey === "") {
    checks.push({ status: FAIL, label: "ORBIT_WALLET_PRIVATE_KEY",   detail: "not set" });
  } else {
    checks.push({ status: PASS, label: "ORBIT_WALLET_PRIVATE_KEY",   detail: "present (not displayed)" });
  }

  if (signer && pkey) {
    // Best-effort signer/key match. We do NOT import viem here to keep
    // preflight cheap; instead we surface the WARN so the operator knows
    // a live cycle is the source of truth.
    let matched = null;
    try {
      const { privateKeyToAccount } = require("viem/accounts");
      const { getAddress } = require("viem");
      const account = privateKeyToAccount(pkey);
      const derived = getAddress(account.address);
      const expected = getAddress(signer);
      matched = derived === expected;
      checks.push({
        status: matched ? PASS : FAIL,
        label: "signer/key match",
        detail: matched
          ? "private key recovers the configured signer"
          : `key recovers ${derived}, signer is ${expected}`
      });
    } catch (err) {
      checks.push({
        status: WARN,
        label: "signer/key match",
        detail: `could not verify (${err.message || err}); a cycle will catch this`
      });
    }
  } else {
    checks.push({
      status: WARN,
      label: "signer/key match",
      detail: "skipped — signer or key not set"
    });
  }

  const operator = String(e.ORBIT_OPERATOR_REVENUE_ADDRESS || "").trim();
  if (operator === "") {
    checks.push({ status: FAIL, label: "ORBIT_OPERATOR_REVENUE_ADDRESS", detail: "not set" });
  } else if (!isAddress(operator)) {
    checks.push({ status: FAIL, label: "ORBIT_OPERATOR_REVENUE_ADDRESS", detail: `not a valid address: ${operator}` });
  } else {
    checks.push({ status: PASS, label: "ORBIT_OPERATOR_REVENUE_ADDRESS", detail: operator });
  }

  const providersRaw = String(e.ORBIT_AI_PROVIDERS || "").trim();
  let providers = [];
  if (providersRaw === "") {
    checks.push({ status: FAIL, label: "ORBIT_AI_PROVIDERS",  detail: "not set (deterministic fallback only)" });
  } else {
    try {
      const parsed = JSON.parse(providersRaw);
      if (!Array.isArray(parsed)) {
        checks.push({ status: FAIL, label: "ORBIT_AI_PROVIDERS", detail: "must be a JSON array" });
      } else {
        providers = parsed;
        checks.push({
          status: providers.length > 0 ? PASS : FAIL,
          label: "ORBIT_AI_PROVIDERS",
          detail: `${providers.length} provider(s) configured`
        });
      }
    } catch (err) {
      checks.push({ status: FAIL, label: "ORBIT_AI_PROVIDERS", detail: `not valid JSON: ${err.message}` });
    }
  }

  const keysRaw = String(e.ORBIT_AI_PROVIDER_KEYS || "").trim();
  let keys = null;
  if (keysRaw === "") {
    checks.push({ status: FAIL, label: "ORBIT_AI_PROVIDER_KEYS", detail: "not set" });
  } else {
    try {
      const parsed = JSON.parse(keysRaw);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        checks.push({ status: FAIL, label: "ORBIT_AI_PROVIDER_KEYS", detail: "must be a JSON object" });
      } else {
        keys = parsed;
        checks.push({
          status: PASS,
          label: "ORBIT_AI_PROVIDER_KEYS",
          detail: `${Object.keys(keys).length} key(s) present (not displayed)`
        });
      }
    } catch (err) {
      checks.push({ status: FAIL, label: "ORBIT_AI_PROVIDER_KEYS", detail: `not valid JSON: ${err.message}` });
    }
  }

  if (providers.length > 0 && keys) {
    const missingKeys = [];
    for (const p of providers) {
      const name = p && typeof p === "object" ? String(p.name || "") : "";
      if (!name) continue;
      if (!Object.prototype.hasOwnProperty.call(keys, name) || String(keys[name] || "").trim() === "") {
        missingKeys.push(name);
      }
    }
    if (missingKeys.length === 0) {
      checks.push({
        status: PASS,
        label: "provider/key alignment",
        detail: `every provider has a matching key`
      });
    } else {
      checks.push({
        status: FAIL,
        label: "provider/key alignment",
        detail: `missing key(s) for: ${missingKeys.join(", ")}`
      });
    }
  }

  return checks;
}

// ===========================================================================
// Section 4: D-018 gate state
// ===========================================================================

function checkD018(state) {
  const checks = [];
  if (!state || typeof state !== "object") {
    checks.push({ status: FAIL, label: "state.json", detail: "not found or unreadable" });
    return checks;
  }

  if (state.preLaunchVerified === true) {
    checks.push({ status: PASS, label: "preLaunchVerified", detail: "true (D-018 gate open)" });
  } else {
    checks.push({
      status: FAIL,
      label: "preLaunchVerified",
      detail: "not true — token launch is mechanically blocked (D-018)"
    });
  }

  const first = state.firstCleanCycle;
  const last = state.lastCleanCycle;
  if (Number.isFinite(first) && Number.isFinite(last)) {
    const gap = last - first + 1;
    if (gap >= 24) {
      checks.push({
        status: PASS,
        label: "consecutive clean cycles",
        detail: `${gap} clean cycles recorded (first=${first}, last=${last})`
      });
    } else {
      checks.push({
        status: WARN,
        label: "consecutive clean cycles",
        detail: `only ${gap} consecutive clean cycle(s) recorded (need 24)`
      });
    }
  } else {
    checks.push({
      status: WARN,
      label: "consecutive clean cycles",
      detail: "firstCleanCycle/lastCleanCycle not set"
    });
  }

  if (state.launchOnceFired === true) {
    checks.push({
      status: FAIL,
      label: "launchOnceFired",
      detail: "launch already fired — re-launch is mechanically blocked"
    });
  } else {
    checks.push({
      status: PASS,
      label: "launchOnceFired",
      detail: "false (token has not yet launched)"
    });
  }

  return checks;
}

// ===========================================================================
// Section 5: Treasury topology
// ===========================================================================

function checkTreasury(treasury) {
  const checks = [];
  if (!treasury || typeof treasury !== "object") {
    checks.push({ status: WARN, label: "treasury.json", detail: "not found or unreadable" });
    return checks;
  }

  const revenue = treasury.revenue || {};
  const opBps = revenue.operatorShareBps;
  const trBps = revenue.treasuryShareBps;

  if (opBps === 500 && trBps === 9500) {
    checks.push({
      status: PASS,
      label: "revenue split",
      detail: "operator=500 / treasury=9500 (D-019 default)"
    });
  } else if (opBps === 0 && trBps === 0) {
    checks.push({
      status: WARN,
      label: "revenue split",
      detail: "both shares are 0 (fail-closed default)"
    });
  } else {
    checks.push({
      status: WARN,
      label: "revenue split",
      detail: `operator=${opBps} / treasury=${trBps} (expected 500/9500)`
    });
  }

  const buckets = treasury.buckets || {};
  const list = Array.isArray(buckets.list) ? buckets.list : null;
  if (!list) {
    checks.push({ status: FAIL, label: "buckets.list", detail: "missing or not an array" });
  } else if (list.length !== 6) {
    checks.push({
      status: FAIL,
      label: "buckets.list",
      detail: `expected 6 buckets, found ${list.length}`
    });
  } else {
    const sum = list.reduce((acc, b) => acc + (Number.isFinite(b.bps) ? b.bps : 0), 0);
    if (sum === 10000) {
      checks.push({
        status: PASS,
        label: "buckets.list",
        detail: "6 buckets summing to 10000 bps"
      });
    } else {
      checks.push({
        status: FAIL,
        label: "buckets.list",
        detail: `6 buckets, but bps sum is ${sum} (expected 10000)`
      });
    }
  }

  const token = treasury.token || {};
  const status = token.launchStatus || "(unset)";
  if (status === "launched") {
    checks.push({
      status: INFO,
      label: "token.launchStatus",
      detail: `launched at ${token.address || "(no address recorded)"}`
    });
  } else {
    checks.push({
      status: status === "not_launched" ? PASS : WARN,
      label: "token.launchStatus",
      detail: status
    });
  }

  return checks;
}

// ===========================================================================
// Section 6: Public surface
// ===========================================================================

function checkPublicSurface(repoRoot) {
  const checks = [];
  const dashPath = path.join(repoRoot, "public", "dashboard.json");
  const wkPath = path.join(repoRoot, "public", ".well-known", "orbit.json");

  for (const [label, file] of [
    ["public/dashboard.json", dashPath],
    ["public/.well-known/orbit.json", wkPath]
  ]) {
    if (!fs.existsSync(file)) {
      checks.push({ status: WARN, label, detail: "not found" });
      continue;
    }
    const result = safeReadJson(file);
    if (result.ok) {
      checks.push({ status: PASS, label, detail: "present + valid JSON" });
    } else {
      checks.push({
        status: FAIL,
        label,
        detail: `present but not valid JSON (${result.error || result.reason})`
      });
    }
  }
  return checks;
}

// ===========================================================================
// Section 7: OWNER_ACTIONS punch list
// ===========================================================================

function parseOwnerActions(text) {
  if (typeof text !== "string" || text.length === 0) return null;
  const lines = text.split(/\r?\n/);
  const sections = [];
  let current = null;
  const HEADING = /^##\s+(.+?)\s*$/;
  const BOX = /^\s*[-*]\s*\[( |x|X)\]/;
  for (const line of lines) {
    const h = HEADING.exec(line);
    if (h) {
      current = { heading: h[1].trim(), open: 0, closed: 0 };
      sections.push(current);
      continue;
    }
    if (!current) continue;
    const b = BOX.exec(line);
    if (b) {
      if (b[1] === " ") current.open += 1;
      else current.closed += 1;
    }
  }
  return sections;
}

function checkOwnerActions(text) {
  const checks = [];
  const sections = parseOwnerActions(text);
  if (sections === null) {
    checks.push({ status: WARN, label: "OWNER_ACTIONS.md", detail: "not found or empty" });
    return checks;
  }
  const totalOpen = sections.reduce((a, s) => a + s.open, 0);
  const totalClosed = sections.reduce((a, s) => a + s.closed, 0);
  if (totalOpen === 0 && totalClosed === 0) {
    checks.push({
      status: PASS,
      label: "OWNER_ACTIONS.md",
      detail: "no checkboxes found (likely narrative — nothing to track)"
    });
    return checks;
  }
  for (const s of sections) {
    if (s.open === 0 && s.closed === 0) continue;
    const total = s.open + s.closed;
    const headingShort = s.heading.length > 56 ? `${s.heading.slice(0, 53)}...` : s.heading;
    checks.push({
      status: s.open === 0 ? PASS : WARN,
      label: pad(headingShort, 56),
      detail: `${s.closed}/${total} closed`
    });
  }
  checks.push({
    status: totalOpen === 0 ? PASS : WARN,
    label: "punch list total",
    detail: `${totalClosed} closed / ${totalOpen} open`
  });
  return checks;
}

// ===========================================================================
// runPreflight
// ===========================================================================

function runPreflight(options = {}) {
  const opts = options || {};
  const repoRoot = opts.repoRoot || process.cwd();
  const env = opts.env || process.env;

  let state = opts.state;
  if (state === undefined) {
    const r = safeReadJson(path.join(repoRoot, "memory", "state.json"));
    state = r.ok ? r.data : null;
  }

  let treasury = opts.treasury;
  if (treasury === undefined) {
    const r = safeReadJson(path.join(repoRoot, "memory", "treasury.json"));
    treasury = r.ok ? r.data : null;
  }

  let ownerActions = opts.ownerActions;
  if (ownerActions === undefined) {
    ownerActions = safeReadFile(path.join(repoRoot, "OWNER_ACTIONS.md"));
  }

  const sections = [
    { title: "Repo state",                                  checks: checkRepoState(repoRoot) },
    { title: "Safes (D-019) - 7 addresses required",        checks: checkSafes(env) },
    { title: "Signer + operator + AI",                      checks: checkSignerOperatorAi(env) },
    { title: "D-018 gate state",                            checks: checkD018(state) },
    { title: "Treasury topology",                           checks: checkTreasury(treasury) },
    { title: "Public surface",                              checks: checkPublicSurface(repoRoot) },
    { title: "OWNER_ACTIONS punch list",                    checks: checkOwnerActions(ownerActions) }
  ];

  let pass = 0;
  let warn = 0;
  let fail = 0;
  let info = 0;
  for (const s of sections) {
    for (const c of s.checks) {
      if (c.status === PASS) pass += 1;
      else if (c.status === WARN) warn += 1;
      else if (c.status === FAIL) fail += 1;
      else if (c.status === INFO) info += 1;
    }
  }

  const summary = { pass, warn, fail, info };
  const strict = Boolean(opts.strict);
  const exitCode = strict
    ? (fail > 0 || warn > 0) ? 1 : 0
    : (fail > 0) ? 1 : 0;

  return { sections, summary, exitCode, strict };
}

// ===========================================================================
// rendering
// ===========================================================================

function renderLines(result, options = {}) {
  const useColor = Boolean(options.color);
  const now = options.now || new Date().toISOString();
  const strict = Boolean(result.strict);
  const lines = [];

  lines.push("=== Orbit Preflight Check ===");
  lines.push(`Run: ${now}`);
  if (strict) {
    lines.push("Mode: STRICT (WARNs are treated as failures)");
  }
  lines.push("");

  result.sections.forEach((section, idx) => {
    lines.push(`[${idx + 1}/${result.sections.length}] ${section.title}`);
    if (section.checks.length === 0) {
      lines.push("  (no checks)");
    } else {
      for (const c of section.checks) {
        lines.push(`  ${marker(c.status, useColor)}  ${c.label}  ${c.detail || ""}`.trimEnd());
      }
    }
    lines.push("");
  });

  const { pass, warn, fail, info } = result.summary;
  const modeTag = strict ? " [STRICT]" : "";
  lines.push(`Summary${modeTag}: ${pass} PASS / ${warn} WARN / ${fail} FAIL${info ? ` / ${info} INFO` : ""}`);
  if (fail > 0) {
    lines.push(`Exit: 1 (FAIL count > 0; launch is blocked)`);
    lines.push("Next actions:");
    const hints = collectNextActions(result);
    for (const h of hints) lines.push(`  - ${h}`);
  } else if (strict && warn > 0) {
    lines.push(`Exit: 1 (STRICT: ${warn} WARN treated as failure; launch is blocked)`);
  } else if (warn > 0) {
    lines.push(`Exit: 0 (no FAILs; ${warn} WARN to review)`);
  } else {
    lines.push(`Exit: 0 (all gates pass)`);
  }
  return lines;
}

function collectNextActions(result) {
  const hints = [];
  const safesSection = result.sections.find((s) => /Safes/.test(s.title));
  if (safesSection && safesSection.checks.some((c) => c.status === FAIL)) {
    hints.push("Deploy the 7 Safes per OWNER_ACTIONS.md §4 and set the matching repo secrets");
  }
  const soaSection = result.sections.find((s) => /Signer/.test(s.title));
  if (soaSection) {
    if (soaSection.checks.find((c) => c.label === "ORBIT_OPERATOR_REVENUE_ADDRESS" && c.status === FAIL)) {
      hints.push("Set ORBIT_OPERATOR_REVENUE_ADDRESS via `gh secret set`");
    }
    if (soaSection.checks.find((c) => c.label === "ORBIT_AGENT_SIGNER" && c.status === FAIL)) {
      hints.push("Set ORBIT_AGENT_SIGNER repo variable to the agent EOA");
    }
    if (soaSection.checks.find((c) => c.label === "ORBIT_WALLET_PRIVATE_KEY" && c.status === FAIL)) {
      hints.push("Set ORBIT_WALLET_PRIVATE_KEY repo secret (the key for ORBIT_AGENT_SIGNER)");
    }
    if (soaSection.checks.find((c) => (c.label === "ORBIT_AI_PROVIDERS" || c.label === "ORBIT_AI_PROVIDER_KEYS") && c.status === FAIL)) {
      hints.push("Configure AI providers + keys per OWNER_ACTIONS.md §6");
    }
    if (soaSection.checks.find((c) => c.label === "provider/key alignment" && c.status === FAIL)) {
      hints.push("Every entry in ORBIT_AI_PROVIDERS needs a matching ORBIT_AI_PROVIDER_KEYS entry");
    }
  }
  const d018 = result.sections.find((s) => /D-018/.test(s.title));
  if (d018) {
    if (d018.checks.find((c) => c.label === "preLaunchVerified" && c.status === FAIL)) {
      hints.push("Achieve preLaunchVerified via a 12-hour clean cycle stretch (OWNER_ACTIONS §7)");
    }
    if (d018.checks.find((c) => c.label === "launchOnceFired" && c.status === FAIL)) {
      hints.push("Token launch has already fired — no re-launch is possible by design");
    }
  }
  const treasury = result.sections.find((s) => /Treasury/.test(s.title));
  if (treasury && treasury.checks.some((c) => c.status === FAIL)) {
    hints.push("Repair memory/treasury.json — buckets.list must have 6 entries summing to 10000 bps");
  }
  const surf = result.sections.find((s) => /Public surface/.test(s.title));
  if (surf && surf.checks.some((c) => c.status === FAIL)) {
    hints.push("Re-generate public/dashboard.json and public/.well-known/orbit.json (run a cycle)");
  }
  if (hints.length === 0) {
    hints.push("Read the FAIL lines above and fix each in turn");
  }
  return hints;
}

// ===========================================================================
// CLI entry
// ===========================================================================

function parseArgv(argv) {
  const args = Array.isArray(argv) ? argv.slice(2) : [];
  return {
    strict: args.includes("--strict")
  };
}

function main() {
  const flags = parseArgv(process.argv);
  const result = runPreflight({ strict: flags.strict });
  const lines = renderLines(result, { color: Boolean(process.stdout.isTTY) });
  for (const l of lines) process.stdout.write(`${l}\n`);
  process.exit(result.exitCode);
}

if (require.main === module) {
  main();
}

module.exports = {
  PASS,
  WARN,
  FAIL,
  INFO,
  runPreflight,
  renderLines,
  parseArgv,
  // exported for tests
  checkRepoState,
  checkSafes,
  checkSignerOperatorAi,
  checkD018,
  checkTreasury,
  checkPublicSurface,
  checkOwnerActions,
  parseOwnerActions
};
