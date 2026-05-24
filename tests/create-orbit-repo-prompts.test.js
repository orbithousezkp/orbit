"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const path = require("node:path");
const { parseArgv, resolveOptions } = require("../packages/create-orbit-repo/src/index");

test("parseArgv collects target and flags", () => {
  const f = parseArgv(["./out", "--yes", "--no-install", "--name", "agent", "--owner", "me"]);
  assert.equal(f.target, "./out");
  assert.equal(f.yes, true);
  assert.equal(f.install, false);
  assert.equal(f.name, "agent");
  assert.equal(f.owner, "me");
});

test("parseArgv supports --help, --version, --here, --dry-run, --force", () => {
  const a = parseArgv(["--help"]);
  assert.equal(a.help, true);
  const b = parseArgv(["--version"]);
  assert.equal(b.version, true);
  const c = parseArgv([".", "--here", "--dry-run", "--force"]);
  assert.equal(c.here, true);
  assert.equal(c.dryRun, true);
  assert.equal(c.force, true);
});

test("parseArgv supports --key=value form", () => {
  const f = parseArgv(["--name=demo", "--owner=u", "--approval-label=foo:bar"]);
  assert.equal(f.name, "demo");
  assert.equal(f.owner, "u");
  assert.equal(f.approvalLabel, "foo:bar");
});

test("parseArgv rejects unknown options", () => {
  assert.throws(() => parseArgv(["--unknown"]), /unknown option/);
});

test("parseArgv -y alias works", () => {
  const f = parseArgv(["-y"]);
  assert.equal(f.yes, true);
});

test("resolveOptions handles --here with no target", () => {
  const flags = parseArgv(["--here", "--yes"]);
  const opts = resolveOptions(flags, "/work/repo");
  assert.equal(opts.targetDir, "/work/repo");
  assert.equal(opts.here, true);
  assert.equal(opts.yes, true);
});

test("resolveOptions resolves relative target", () => {
  const flags = parseArgv(["./sub", "--yes"]);
  const opts = resolveOptions(flags, "/work");
  assert.equal(opts.targetDir, path.resolve("/work", "./sub"));
});

test("resolveOptions accepts \".\" as cwd", () => {
  const flags = parseArgv([".", "--yes"]);
  const opts = resolveOptions(flags, "/work");
  assert.equal(opts.targetDir, "/work");
});

test("resolveOptions defaults agent name to orbit and approval-label to orbit:approval", () => {
  const flags = parseArgv(["./x", "--yes"]);
  const opts = resolveOptions(flags, "/w");
  assert.equal(opts.agentName, "orbit");
  assert.equal(opts.approvalLabel, "orbit:approval");
  assert.equal(opts.approvalAcceptedLabel, "orbit:approved");
  assert.equal(opts.approvalRejectedLabel, "orbit:rejected");
});

test("resolveOptions honors custom approval-label and derives variants", () => {
  const flags = parseArgv(["./x", "--yes", "--approval-label", "team:gate"]);
  const opts = resolveOptions(flags, "/w");
  assert.equal(opts.approvalLabel, "team:gate");
  assert.equal(opts.approvalAcceptedLabel, "team:gate-accepted");
  assert.equal(opts.approvalRejectedLabel, "team:gate-rejected");
});

test("resolveOptions returns null target when none given and not --here", () => {
  const flags = parseArgv(["--yes"]);
  const opts = resolveOptions(flags, "/w");
  assert.equal(opts.targetDir, null);
});
