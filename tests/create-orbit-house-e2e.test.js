"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { main } = require("../packages/create-orbit-house/src/index");

test("e2e: scaffold into empty temp dir via main()", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "orbit-e2e-"));
  const origStdoutWrite = process.stdout.write;
  let captured = "";
  process.stdout.write = (chunk) => { captured += String(chunk); return true; };
  try {
    await main([dir, "--yes", "--no-install", "--name", "e2e-agent", "--owner", "e2e-user"]);
  } finally {
    process.stdout.write = origStdoutWrite;
  }
  try {
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
      "README.md",
      "package.json"
    ];
    for (const rel of expected) {
      const p = path.join(dir, rel);
      assert.ok(fs.existsSync(p), `missing ${rel}`);
      const content = fs.readFileSync(p, "utf8");
      assert.ok(content.length > 0, `empty ${rel}`);
    }
    const identity = fs.readFileSync(path.join(dir, "memory", "identity.md"), "utf8");
    assert.ok(identity.includes("e2e-agent"));
    assert.ok(identity.includes("e2e-user"));
    const governance = JSON.parse(fs.readFileSync(path.join(dir, "memory", "governance.json"), "utf8"));
    assert.equal(governance.ownerUsername, "e2e-user");
    const pkg = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8"));
    assert.equal(pkg.scripts.cycle, "node node_modules/@orbithouse/sdk/cli.js cycle");
    assert.equal(pkg.dependencies["@orbithouse/sdk"], "^0.1.0");
    const readme = fs.readFileSync(path.join(dir, "README.md"), "utf8");
    assert.ok(readme.includes("<!-- orbit:start -->"));
    assert.ok(readme.includes("<!-- orbit:end -->"));
    assert.ok(captured.includes("orbit scaffold complete"));
    assert.ok(captured.includes("next steps:"));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("e2e: dry-run writes nothing but prints plan", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "orbit-e2e-"));
  const origStdoutWrite = process.stdout.write;
  let captured = "";
  process.stdout.write = (chunk) => { captured += String(chunk); return true; };
  try {
    await main([dir, "--yes", "--no-install", "--dry-run", "--name", "dry", "--owner", "dry"]);
  } finally {
    process.stdout.write = origStdoutWrite;
  }
  try {
    assert.equal(fs.existsSync(path.join(dir, "memory", "tasks.json")), false);
    assert.equal(fs.existsSync(path.join(dir, "package.json")), false);
    assert.ok(captured.includes("orbit scaffold complete"));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("e2e: merging into a target that already has a package.json keeps its scripts", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "orbit-e2e-"));
  fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify({
    name: "existing",
    scripts: { build: "vite build", cycle: "node mine.js" },
    dependencies: { react: "^18" }
  }, null, 2));
  fs.writeFileSync(path.join(dir, "README.md"), "# Existing repo\n\nBody.\n");
  const origStdoutWrite = process.stdout.write;
  process.stdout.write = () => true;
  try {
    await main([dir, "--yes", "--no-install", "--name", "merge-agent", "--owner", "merge-user"]);
  } finally {
    process.stdout.write = origStdoutWrite;
  }
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8"));
    assert.equal(pkg.scripts.build, "vite build");
    assert.equal(pkg.scripts.cycle, "node mine.js", "existing cycle script must NOT be clobbered");
    assert.equal(pkg.dependencies.react, "^18");
    assert.equal(pkg.dependencies["@orbithouse/sdk"], "^0.1.0");
    const readme = fs.readFileSync(path.join(dir, "README.md"), "utf8");
    assert.ok(readme.includes("# Existing repo"));
    assert.ok(readme.includes("<!-- orbit:start -->"));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
