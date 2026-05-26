"use strict";

const fs = require("fs");
const path = require("path");
const detect = require("./detect");
const merge = require("./merge");

const TEMPLATES_DIR = path.resolve(__dirname, "..", "templates");

function renderTemplate(text, vars) {
  if (text == null) return "";
  return String(text).replace(/\{\{([A-Z0-9_]+)\}\}/g, (m, key) => {
    if (Object.prototype.hasOwnProperty.call(vars, key)) return String(vars[key]);
    return m;
  });
}

function templateVars(opts) {
  return {
    AGENT_NAME: opts.agentName || "orbit",
    OWNER: opts.owner || "",
    REPO_URL: opts.repoUrl || `https://github.com/${opts.owner || "owner"}/${opts.agentName || "orbit"}`,
    APPROVAL_LABEL: opts.approvalLabel || "orbit:approval",
    APPROVAL_ACCEPTED_LABEL: opts.approvalAcceptedLabel || "orbit:approved",
    APPROVAL_REJECTED_LABEL: opts.approvalRejectedLabel || "orbit:rejected",
    NODE_VERSION: opts.nodeVersion || "24",
    MOTHERSHIP_REPO: opts.mothershipRepo || "orbithousezkp/orbit",
    HANDSHAKE_OPT_IN: opts.handshakeOptedIn ? "true" : "false",
    ADOPTED_AT: opts.adoptedAt || new Date().toISOString(),
    SCAFFOLDER_VERSION: opts.scaffolderVersion || "0.1.0"
  };
}

function assertInside(targetDir, candidatePath) {
  const targetReal = path.resolve(targetDir);
  const candidate = path.resolve(candidatePath);
  const rel = path.relative(targetReal, candidate);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error(`refusing to write outside target: ${candidatePath}`);
  }
}

function readTpl(relPath) {
  return fs.readFileSync(path.join(TEMPLATES_DIR, relPath), "utf8");
}

function buildPlan(opts) {
  const vars = templateVars(opts);
  const items = [];

  const fileMap = [
    [".github/workflows/orbit-cycle.yml.tpl", ".github/workflows/orbit-cycle.yml", "template"],
    [".github/workflows/orbit-event.yml.tpl", ".github/workflows/orbit-event.yml", "template"],
    [".github/workflows/orbit-onboard.yml.tpl", ".github/workflows/orbit-onboard.yml", "template"],
    ["memory/identity.md.tpl", "memory/identity.md", "template"],
    ["memory/tasks.json.tpl", "memory/tasks.json", "template"],
    ["memory/governance.json.tpl", "memory/governance.json", "template"],
    ["memory/treasury.json.tpl", "memory/treasury.json", "template"],
    ["memory/state.json.tpl", "memory/state.json", "template"],
    ["memory/orbit-lineage.json.tpl", "memory/orbit-lineage.json", "template"],
    ["runtime/proofs/.gitkeep", "runtime/proofs/.gitkeep", "verbatim"],
    [".env.example.tpl", ".env.example", "template"]
  ];

  for (const [src, dest, kind] of fileMap) {
    const raw = readTpl(src);
    const content = kind === "template" ? renderTemplate(raw, vars) : raw;
    const absDest = path.join(opts.targetDir, dest);
    assertInside(opts.targetDir, absDest);
    const status = detect.classifyDestination(absDest, content);
    items.push({ src, dest, absDest, content, status, kind: "file" });
  }

  const readmeRaw = readTpl("README.orbit-section.md.tpl");
  const readmeBlock = renderTemplate(readmeRaw, vars);
  const readmeAbs = path.join(opts.targetDir, "README.md");
  assertInside(opts.targetDir, readmeAbs);
  items.push({ src: "README.orbit-section.md.tpl", dest: "README.md", absDest: readmeAbs, content: readmeBlock, kind: "readme" });

  const partialRaw = readTpl("package.json.partial.json");
  const partial = JSON.parse(partialRaw);
  const pkgAbs = path.join(opts.targetDir, "package.json");
  assertInside(opts.targetDir, pkgAbs);
  items.push({ src: "package.json.partial.json", dest: "package.json", absDest: pkgAbs, content: partial, kind: "package" });

  return { items, vars };
}

function dryRunSummary(plan) {
  return plan.items.map((it) => ({ dest: it.dest, kind: it.kind, status: it.status || "PLAN" }));
}

async function execute(plan, opts) {
  const written = [];
  const result = {
    added: [],
    skipped: [],
    merged: [],
    noop: [],
    backups: [],
    warnings: [],
    targetDir: opts.targetDir,
    dryRun: Boolean(opts.dryRun),
    install: Boolean(opts.install)
  };

  if (opts.dryRun) {
    for (const it of plan.items) {
      if (it.kind === "package") {
        result.merged.push({ path: it.dest, addedKeys: ["scripts.cycle", "dependencies.@orbit-house/sdk"] });
        continue;
      }
      if (it.kind === "readme") {
        const existing = fs.existsSync(it.absDest) ? fs.readFileSync(it.absDest, "utf8") : "";
        const m = merge.mergeReadme(existing, it.content);
        if (m.action === "WRITE") result.added.push(it.dest);
        else if (m.action === "APPEND") result.merged.push({ path: it.dest, addedKeys: ["orbit section appended"] });
        else result.skipped.push({ path: it.dest, reason: "marker present (NOOP)" });
        continue;
      }
      if (it.status === "WRITE") result.added.push(it.dest);
      else if (it.status === "NOOP") result.noop.push(it.dest);
      else result.skipped.push({ path: it.dest, reason: "differs (use --force)" });
    }
    return result;
  }

  try {
    if (!fs.existsSync(opts.targetDir)) {
      fs.mkdirSync(opts.targetDir, { recursive: true });
      written.push({ path: opts.targetDir, kind: "dir" });
    }

    for (const it of plan.items) {
      if (it.kind === "file") {
        const dir = path.dirname(it.absDest);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        if (it.status === "NOOP") {
          result.noop.push(it.dest);
          continue;
        }
        if (it.status === "SKIP" && !opts.force) {
          result.skipped.push({ path: it.dest, reason: "differs (use --force)" });
          continue;
        }
        if (it.status === "SKIP" && opts.force && fs.existsSync(it.absDest)) {
          const bak = it.absDest + ".orbit-bak";
          try {
            fs.copyFileSync(it.absDest, bak);
            result.backups.push(it.dest + ".orbit-bak");
          } catch (e) {
            result.warnings.push(`backup failed for ${it.dest}: ${e.message}; keeping original`);
            continue;
          }
        }
        const existed = fs.existsSync(it.absDest);
        fs.writeFileSync(it.absDest, it.content);
        written.push({ path: it.absDest, kind: "file", existed });
        result.added.push(it.dest);
        continue;
      }

      if (it.kind === "readme") {
        const dir = path.dirname(it.absDest);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        const existing = fs.existsSync(it.absDest) ? fs.readFileSync(it.absDest, "utf8") : "";
        const m = merge.mergeReadme(existing, it.content);
        if (m.action === "NOOP") {
          result.skipped.push({ path: it.dest, reason: "marker already present" });
          continue;
        }
        const existed = fs.existsSync(it.absDest);
        fs.writeFileSync(it.absDest, m.merged);
        written.push({ path: it.absDest, kind: "file", existed });
        if (m.action === "WRITE") result.added.push(it.dest);
        else result.merged.push({ path: it.dest, addedKeys: ["orbit section appended"] });
        continue;
      }

      if (it.kind === "package") {
        const dir = path.dirname(it.absDest);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        const existing = fs.existsSync(it.absDest) ? fs.readFileSync(it.absDest, "utf8") : "";
        const m = merge.mergePackageJson(existing, it.content);
        if (m.malformed) {
          const suggestedPath = it.absDest.replace(/package\.json$/, "package.orbit.json.suggested");
          fs.writeFileSync(suggestedPath, JSON.stringify(it.content, null, 2) + "\n");
          written.push({ path: suggestedPath, kind: "file", existed: false });
          result.warnings.push("package.json malformed; wrote package.orbit.json.suggested instead");
          continue;
        }
        const existed = fs.existsSync(it.absDest);
        const output = JSON.stringify(m.merged, null, 2) + "\n";
        fs.writeFileSync(it.absDest, output);
        written.push({ path: it.absDest, kind: "file", existed });
        if (m.addedKeys.length > 0) {
          result.merged.push({ path: it.dest, addedKeys: m.addedKeys });
        } else {
          result.noop.push(it.dest);
        }
        if (m.conflicts.length > 0) {
          result.warnings.push(`package.json conflicts kept existing values for: ${m.conflicts.join(", ")}`);
        }
        continue;
      }
    }

    return result;
  } catch (err) {
    let rolledBack = 0;
    for (let i = written.length - 1; i >= 0; i -= 1) {
      const entry = written[i];
      try {
        if (entry.kind === "file") {
          if (!entry.existed && fs.existsSync(entry.path)) {
            fs.unlinkSync(entry.path);
            rolledBack += 1;
          }
        }
      } catch (e) {
        // best effort
      }
    }
    err.rolledBack = rolledBack;
    err.message = `${err.message} (rolled back ${rolledBack} files)`;
    throw err;
  }
}

module.exports = {
  renderTemplate,
  templateVars,
  assertInside,
  buildPlan,
  execute,
  dryRunSummary,
  TEMPLATES_DIR
};
