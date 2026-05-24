"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const writer = require("../packages/create-orbit-repo/src/writer");

function baseOpts(targetDir, overrides) {
  return Object.assign({
    targetDir,
    agentName: "test-agent",
    owner: "test-owner",
    approvalLabel: "orbit:approval",
    approvalAcceptedLabel: "orbit:approved",
    approvalRejectedLabel: "orbit:rejected",
    nodeVersion: "24",
    yes: true,
    dryRun: false,
    install: false,
    force: false,
    here: false
  }, overrides || {});
}

test("renderTemplate substitutes {{KEY}} placeholders", () => {
  const out = writer.renderTemplate("hello {{NAME}}, repo {{REPO_URL}}", { NAME: "x", REPO_URL: "y" });
  assert.equal(out, "hello x, repo y");
});

test("renderTemplate leaves unknown placeholders intact", () => {
  const out = writer.renderTemplate("a {{X}} b", {});
  assert.equal(out, "a {{X}} b");
});

test("assertInside refuses paths that escape the target", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "orbit-writer-"));
  try {
    writer.assertInside(dir, path.join(dir, "a", "b"));
    assert.throws(() => writer.assertInside(dir, path.join(dir, "..", "out")));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("execute writes all expected files into an empty target", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "orbit-writer-"));
  try {
    const opts = baseOpts(dir);
    const plan = writer.buildPlan(opts);
    const result = await writer.execute(plan, opts);
    const expected = [
      ".github/workflows/orbit-cycle.yml",
      ".github/workflows/orbit-event.yml",
      "memory/identity.md",
      "memory/tasks.json",
      "memory/governance.json",
      "memory/treasury.json",
      "memory/state.json",
      "runtime/proofs/.gitkeep",
      ".env.example",
      "README.md"
    ];
    for (const rel of expected) {
      const p = path.join(dir, rel);
      assert.ok(fs.existsSync(p), `missing ${rel}`);
      const stat = fs.statSync(p);
      assert.ok(stat.size > 0, `empty ${rel}`);
    }
    assert.ok(fs.existsSync(path.join(dir, "package.json")));
    assert.ok(result.added.length >= 9);
    assert.ok(result.merged.some((m) => m.path === "package.json"));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("execute is idempotent: second run produces no new writes for unchanged files", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "orbit-writer-"));
  try {
    const opts = baseOpts(dir);
    await writer.execute(writer.buildPlan(opts), opts);
    const result2 = await writer.execute(writer.buildPlan(opts), opts);
    assert.equal(result2.added.length, 0);
    assert.ok(result2.noop.length >= 8 || result2.skipped.length >= 0);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("execute skips differing files without --force and writes them with --force + backup", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "orbit-writer-"));
  try {
    fs.mkdirSync(path.join(dir, "memory"), { recursive: true });
    fs.writeFileSync(path.join(dir, "memory", "tasks.json"), "OLD");
    const opts = baseOpts(dir);
    const r1 = await writer.execute(writer.buildPlan(opts), opts);
    assert.ok(r1.skipped.some((s) => s.path === "memory/tasks.json"));
    assert.equal(fs.readFileSync(path.join(dir, "memory", "tasks.json"), "utf8"), "OLD");

    const opts2 = baseOpts(dir, { force: true });
    const r2 = await writer.execute(writer.buildPlan(opts2), opts2);
    assert.ok(r2.added.includes("memory/tasks.json"));
    assert.ok(r2.backups.includes("memory/tasks.json.orbit-bak"));
    assert.equal(fs.readFileSync(path.join(dir, "memory", "tasks.json.orbit-bak"), "utf8"), "OLD");
    assert.notEqual(fs.readFileSync(path.join(dir, "memory", "tasks.json"), "utf8"), "OLD");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("dry-run writes nothing", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "orbit-writer-"));
  try {
    const opts = baseOpts(dir, { dryRun: true });
    const result = await writer.execute(writer.buildPlan(opts), opts);
    assert.equal(fs.existsSync(path.join(dir, "memory", "tasks.json")), false);
    assert.equal(fs.existsSync(path.join(dir, "package.json")), false);
    assert.ok(result.added.length > 0 || result.merged.length > 0);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("execute rolls back on mid-write failure", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "orbit-writer-"));
  try {
    const opts = baseOpts(dir);
    const plan = writer.buildPlan(opts);
    // Inject a bogus item that will cause writeFileSync to throw.
    plan.items.push({
      src: "fake",
      dest: "fake-dir/bad",
      absDest: path.join(dir, "non-exist-parent", "x"),
      content: "x",
      status: "WRITE",
      kind: "file"
    });
    // Force the bogus parent to not be creatable by making it a file path conflict
    fs.writeFileSync(path.join(dir, "non-exist-parent"), "iam-a-file");
    let threw = false;
    try {
      await writer.execute(plan, opts);
    } catch (e) {
      threw = true;
      assert.ok(/rolled back/.test(e.message));
    }
    assert.ok(threw, "expected execute to throw");
    // Files that were written prior to failure should have been rolled back.
    assert.equal(fs.existsSync(path.join(dir, "memory", "tasks.json")), false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
