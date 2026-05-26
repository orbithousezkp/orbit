"use strict";

// Spawn executor (S-SPAWN-1, Patch Set AD).
//
// Two modes:
//   1. dry-run (default when ORBIT_SPAWN_TOKEN or ORBIT_SPAWN_ORG is
//      missing) — writes the scaffold to runtime/spawn/dry/<name>/
//      and returns a stub URL. Lets operators test the whole
//      lifecycle pre-launch.
//   2. live — calls the GitHub API to create the repo under the
//      target org, then writes a small initial commit via the
//      contents API. Issues are opened via the same fetch+retry
//      pattern used in github.js.
//
// The executor does NOT copy any secrets, env files, wallet keys,
// or .git history from the parent. It uses the create-orbit-house
// scaffolder templates as the only source of truth for the child's
// initial files. (FRONTEND_RULES §5 + SPAWN.md §2 secret hygiene.)
//
// The executor returns:
//   { ok, childUrl, fullName, dryRun, issuesOpened }
// or throws with err.code set: NO_TOKEN | NO_ORG | NAME_CONFLICT |
// PERMISSION_DENIED | API_ERROR.

const fs = require("node:fs");
const path = require("node:path");
const { atomicWriteFile } = require("./safety");

const SPAWN_API_BASE = "https://api.github.com";
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_RETRIES = 3;

// Fetched lazily and only when we actually need to scaffold a child.
// Letting require fail loudly here would crash the cycle for repos
// that don't ship the scaffolder package.
function loadScaffolder() {
  // Templates live in packages/create-orbit-house/templates/.
  // We DON'T require the writer module because it depends on
  // prompts/interactive bits we don't want during autonomous
  // execution. Instead we read the .tpl files directly and render
  // a small set of placeholders.
  const tplDir = path.resolve(__dirname, "..", "..", "packages", "create-orbit-house", "templates");
  if (!fs.existsSync(tplDir)) return null;
  return tplDir;
}

function listTemplateFiles(tplDir) {
  // Walk the template tree, return array of { rel, abs }.
  const out = [];
  function walk(dir, prefix) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, e.name);
      const rel = prefix ? path.join(prefix, e.name) : e.name;
      if (e.isDirectory()) walk(abs, rel);
      else if (e.isFile()) out.push({ rel, abs });
    }
  }
  walk(tplDir, "");
  return out;
}

// Render a template body with the scaffolder's known placeholders.
// SECRET HYGIENE: the placeholders are limited to the child's own
// public identity (name, repo, owner) — never the parent's signer,
// wallet, or token.
function renderTemplate(body, ctx) {
  return String(body || "")
    .replace(/\{\{AGENT_NAME\}\}/g, ctx.name)
    .replace(/\{\{MOTHERSHIP_REPO\}\}/g, ctx.parentRepo)
    .replace(/\{\{OWNER_USERNAME\}\}/g, ctx.ownerUsername || "")
    .replace(/\{\{NOW_ISO\}\}/g, new Date().toISOString())
    .replace(/\{\{[A-Z_]+\}\}/g, "");
}

// Strip the ".tpl" suffix and rewrite known internal paths to the
// final child-repo paths.
function finalRelPath(rel) {
  return rel
    .replace(/\.tpl$/, "")
    .replace(/^memory\.dotgithub/, ".github");
}

// === fetch helpers (same retry/backoff as github.js) =========================

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function ghFetch(url, options = {}, opts = {}) {
  const maxRetries = opts.maxRetries ?? DEFAULT_MAX_RETRIES;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  let attempt = 0;
  while (attempt <= maxRetries) {
    const aborter = new AbortController();
    const timer = setTimeout(() => aborter.abort(), timeoutMs);
    let res;
    try {
      res = await fetch(url, { ...options, signal: aborter.signal });
    } catch (err) {
      clearTimeout(timer);
      if (attempt >= maxRetries) {
        const wrap = new Error(`spawn: network error after ${attempt + 1} attempts: ${err.message}`);
        wrap.code = "API_ERROR";
        throw wrap;
      }
      await sleep(Math.min(8000, 250 * Math.pow(2, attempt) * (0.5 + Math.random())));
      attempt++;
      continue;
    }
    clearTimeout(timer);
    if (res.ok) return res;
    if (res.status === 429 || (res.status >= 500 && res.status <= 599)) {
      if (attempt >= maxRetries) {
        const body = await res.text().catch(() => "");
        const err = new Error(`spawn: GitHub ${res.status} after ${attempt + 1} attempts: ${body.slice(0, 240)}`);
        err.code = "API_ERROR";
        throw err;
      }
      const retryAfter = Number(res.headers.get("retry-after"));
      const wait = Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1000
        : Math.min(8000, 250 * Math.pow(2, attempt) * (0.5 + Math.random()));
      try { await res.text(); } catch { /* drain */ }
      await sleep(wait);
      attempt++;
      continue;
    }
    // Non-retryable; surface with semantic code.
    const body = await res.text().catch(() => "");
    if (res.status === 401 || res.status === 403) {
      const err = new Error(`spawn: ${res.status} ${body.slice(0, 240)}`);
      err.code = "PERMISSION_DENIED";
      throw err;
    }
    if (res.status === 422 && /name already exists/i.test(body)) {
      const err = new Error("spawn: repo name already exists in the org");
      err.code = "NAME_CONFLICT";
      throw err;
    }
    const err = new Error(`spawn: GitHub ${res.status}: ${body.slice(0, 240)}`);
    err.code = "API_ERROR";
    throw err;
  }
  throw new Error("spawn: unreachable retry loop");
}

// === dry-run executor ========================================================
// Writes the rendered scaffold to runtime/spawn/dry/<name>/. Useful
// for inspecting the scaffold before flipping the live token.
function dryRunExecutor(repoRoot, env = {}) {
  return async function executor(spawn) {
    const tplDir = loadScaffolder();
    if (!tplDir) {
      const err = new Error("spawn-executor: create-orbit-house templates not found");
      err.code = "TEMPLATES_MISSING";
      throw err;
    }
    const outDir = path.resolve(repoRoot, "runtime/spawn/dry", spawn.name);
    fs.mkdirSync(outDir, { recursive: true });
    const ctx = {
      name: spawn.name,
      parentRepo: env.GITHUB_REPOSITORY || env.ORBIT_PARENT_REPO || "",
      ownerUsername: env.ORBIT_OWNER_USERNAME || ""
    };
    const files = listTemplateFiles(tplDir);
    for (const { rel, abs } of files) {
      const body = renderTemplate(fs.readFileSync(abs, "utf-8"), ctx);
      const dest = path.join(outDir, finalRelPath(rel));
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      atomicWriteFile(dest, body);
    }
    // Write a manifest so the operator can audit what we'd push.
    atomicWriteFile(
      path.join(outDir, ".spawn-manifest.json"),
      JSON.stringify({
        spawnId: spawn.id,
        type: spawn.type,
        name: spawn.name,
        description: spawn.description,
        rationale: spawn.rationale,
        visibility: spawn.visibility,
        aiBudgetUsd: spawn.aiBudgetUsd,
        scaffoldedAt: new Date().toISOString(),
        fileCount: files.length
      }, null, 2) + "\n"
    );
    return {
      ok: true,
      dryRun: true,
      childUrl: `runtime://spawn/dry/${spawn.name}`,
      fullName: `(dry-run)/${spawn.name}`,
      issuesOpened: 0
    };
  };
}

// === live executor ===========================================================
// Calls the GitHub API to:
//   1. POST /orgs/{org}/repos          — create the empty repo
//   2. PUT  /repos/{full}/contents/... — for each scaffold file
//   3. POST /repos/{full}/issues       — for each declared initial issue
function liveExecutor(env = {}) {
  return async function executor(spawn) {
    const token = env.ORBIT_SPAWN_TOKEN;
    const org = env.ORBIT_SPAWN_ORG;
    if (!token) { const e = new Error("spawn: ORBIT_SPAWN_TOKEN missing"); e.code = "NO_TOKEN"; throw e; }
    if (!org) { const e = new Error("spawn: ORBIT_SPAWN_ORG missing"); e.code = "NO_ORG"; throw e; }
    const tplDir = loadScaffolder();
    if (!tplDir) { const e = new Error("spawn: templates missing"); e.code = "TEMPLATES_MISSING"; throw e; }

    const headers = {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "orbit-spawn/1",
      "X-GitHub-Api-Version": "2022-11-28"
    };

    // 1. Create repo
    const createRes = await ghFetch(`${SPAWN_API_BASE}/orgs/${encodeURIComponent(org)}/repos`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: spawn.name,
        description: spawn.description || `orbit spawn · ${spawn.type}`,
        private: spawn.visibility === "private",
        has_issues: true,
        has_wiki: false,
        has_projects: false,
        auto_init: true,
        license_template: "mit"
      })
    });
    const created = await createRes.json();
    const fullName = created.full_name;
    const htmlUrl = created.html_url;

    // 2. Push scaffold files via the contents API.
    const ctx = {
      name: spawn.name,
      parentRepo: env.GITHUB_REPOSITORY || "",
      ownerUsername: env.ORBIT_OWNER_USERNAME || ""
    };
    const files = listTemplateFiles(tplDir);
    for (const { rel, abs } of files) {
      const body = renderTemplate(fs.readFileSync(abs, "utf-8"), ctx);
      const childPath = finalRelPath(rel);
      const b64 = Buffer.from(body, "utf-8").toString("base64");
      await ghFetch(`${SPAWN_API_BASE}/repos/${fullName}/contents/${encodeURIComponent(childPath)}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({
          message: `chore: scaffold ${childPath}`,
          content: b64
        })
      });
    }

    // 3. Open the declared initial issues.
    let issuesOpened = 0;
    for (const iss of spawn.initialIssues || []) {
      try {
        await ghFetch(`${SPAWN_API_BASE}/repos/${fullName}/issues`, {
          method: "POST",
          headers,
          body: JSON.stringify({ title: iss.title, body: iss.body })
        });
        issuesOpened++;
      } catch {
        // Best-effort — the spawn itself is already created. Operator
        // can open the issues manually if any fails.
      }
    }

    return {
      ok: true,
      dryRun: false,
      childUrl: htmlUrl,
      fullName,
      issuesOpened
    };
  };
}

// Pick the right executor based on env. Live requires both
// ORBIT_SPAWN_TOKEN and ORBIT_SPAWN_ORG; everything else dry-runs.
function makeExecutor(repoRoot, env = process.env) {
  const token = env.ORBIT_SPAWN_TOKEN;
  const org = env.ORBIT_SPAWN_ORG;
  if (token && org) return liveExecutor(env);
  return dryRunExecutor(repoRoot, env);
}

module.exports = {
  SPAWN_API_BASE,
  dryRunExecutor,
  liveExecutor,
  makeExecutor,
  listTemplateFiles,
  renderTemplate,
  finalRelPath
};
