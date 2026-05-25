"use strict";

const path = require("path");
const fs = require("fs");

const PACKAGE_VERSION = require("../package.json").version;

const HELP = `npx create-orbit-repo [target] [options]

target              Directory path. Default: current dir if --here else prompt
                    Use "." for current directory

--here              Scaffold into existing repo at cwd (same as target=".")
--name <str>        Agent name (default: prompt or "orbit")
--owner <str>       GitHub username of owner (default: prompt)
--approval-label <s> Approval issue label (default: orbit:approval)
--yes, -y           Non-interactive, use defaults for unanswered prompts
--dry-run           Print plan, write nothing
--no-install        Skip \`npm install\` after scaffold
--force             Overwrite existing files (NEVER default)
--handshake         Opt in to mothership adopter handshake on first cycle (default off)
--no-handshake      Explicit opt-out (this is the default)
--mothership <repo> Override mothership repo for handshake (default: orbithousezkp/orbit)
--help, -h          Show usage
--version           Show version
`;

function parseArgv(argv) {
  const flags = {
    target: null,
    here: false,
    name: null,
    owner: null,
    approvalLabel: null,
    yes: false,
    dryRun: false,
    install: true,
    force: false,
    help: false,
    version: false,
    handshake: false,
    mothership: null
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--help" || a === "-h") { flags.help = true; continue; }
    if (a === "--version") { flags.version = true; continue; }
    if (a === "--here") { flags.here = true; continue; }
    if (a === "--yes" || a === "-y") { flags.yes = true; continue; }
    if (a === "--dry-run") { flags.dryRun = true; continue; }
    if (a === "--no-install") { flags.install = false; continue; }
    if (a === "--force") { flags.force = true; continue; }
    if (a === "--handshake") { flags.handshake = true; continue; }
    if (a === "--no-handshake") { flags.handshake = false; continue; }
    if (a === "--name") { flags.name = argv[++i] || null; continue; }
    if (a === "--owner") { flags.owner = argv[++i] || null; continue; }
    if (a === "--approval-label") { flags.approvalLabel = argv[++i] || null; continue; }
    if (a === "--mothership") { flags.mothership = argv[++i] || null; continue; }
    if (a.startsWith("--name=")) { flags.name = a.slice("--name=".length); continue; }
    if (a.startsWith("--owner=")) { flags.owner = a.slice("--owner=".length); continue; }
    if (a.startsWith("--approval-label=")) { flags.approvalLabel = a.slice("--approval-label=".length); continue; }
    if (a.startsWith("--mothership=")) { flags.mothership = a.slice("--mothership=".length); continue; }
    if (a.startsWith("--")) { throw new Error(`unknown option: ${a}`); }
    if (flags.target === null) { flags.target = a; continue; }
    throw new Error(`unexpected positional argument: ${a}`);
  }
  return flags;
}

function resolveOptions(flags, cwd) {
  let target = flags.target;
  if (flags.here && (target === null || target === ".")) target = cwd;
  if (target === null) target = null;
  else if (target === ".") target = cwd;
  else if (!path.isAbsolute(target)) target = path.resolve(cwd, target);
  const name = flags.name || "orbit";
  const owner = flags.owner || "";
  const approvalLabel = flags.approvalLabel || "orbit:approval";
  return {
    targetDir: target,
    agentName: name,
    owner,
    approvalLabel,
    approvalAcceptedLabel: approvalLabel === "orbit:approval" ? "orbit:approved" : `${approvalLabel}-accepted`,
    approvalRejectedLabel: approvalLabel === "orbit:approval" ? "orbit:rejected" : `${approvalLabel}-rejected`,
    handshakeOptedIn: Boolean(flags.handshake),
    mothershipRepo: flags.mothership || "orbithousezkp/orbit",
    yes: flags.yes,
    dryRun: flags.dryRun,
    install: flags.install,
    force: flags.force,
    here: flags.here,
    nodeVersion: "24"
  };
}

async function main(argv) {
  const flags = parseArgv(argv);
  if (flags.help) { process.stdout.write(HELP); return; }
  if (flags.version) { process.stdout.write(`${PACKAGE_VERSION}\n`); return; }

  const detect = require("./detect");
  const writer = require("./writer");
  const summary = require("./summary");
  const prompts = require("./prompts");

  detect.checkNodeVersion(process.version);

  const opts = resolveOptions(flags, process.cwd());

  if (!opts.targetDir) {
    if (opts.yes) throw new Error("target directory required (pass [target] or --here)");
    const answered = await prompts.interactive(opts);
    Object.assign(opts, answered);
    if (!opts.targetDir) throw new Error("target directory required");
  }

  detect.ensureTargetWritable(opts.targetDir);

  const isTty = Boolean(process.stdin && process.stdin.isTTY);
  if (!opts.yes && isTty && !opts.here) {
    const answered = await prompts.confirmIfNonEmpty(opts.targetDir);
    if (!answered) throw new Error("aborted by user");
  }

  const plan = await writer.buildPlan(opts);
  const result = await writer.execute(plan, opts);
  const text = summary.render(result, opts);
  process.stdout.write(text);
  return result;
}

module.exports = { main, parseArgv, resolveOptions, HELP, PACKAGE_VERSION };
