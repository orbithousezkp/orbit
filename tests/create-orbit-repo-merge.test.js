"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const merge = require("../packages/create-orbit-repo/src/merge");

test("mergePackageJson preserves existing scripts and deps", () => {
  const existing = JSON.stringify({
    name: "host",
    scripts: { build: "vite build", test: "node --test" },
    dependencies: { react: "^18.0.0" }
  });
  const additions = {
    scripts: { cycle: "node node_modules/@orbit-house/sdk/cli.js cycle" },
    dependencies: { "@orbit-house/sdk": "^0.1.0" }
  };
  const r = merge.mergePackageJson(existing, additions);
  assert.equal(r.malformed, false);
  assert.equal(r.merged.scripts.build, "vite build");
  assert.equal(r.merged.scripts.test, "node --test");
  assert.equal(r.merged.scripts.cycle, "node node_modules/@orbit-house/sdk/cli.js cycle");
  assert.equal(r.merged.dependencies.react, "^18.0.0");
  assert.equal(r.merged.dependencies["@orbit-house/sdk"], "^0.1.0");
  assert.ok(r.addedKeys.includes("scripts.cycle"));
  assert.ok(r.addedKeys.includes("dependencies.@orbit-house/sdk"));
});

test("mergePackageJson does NOT clobber existing cycle script", () => {
  const existing = JSON.stringify({
    scripts: { cycle: "node my/own.js" }
  });
  const additions = {
    scripts: { cycle: "node node_modules/@orbit-house/sdk/cli.js cycle" }
  };
  const r = merge.mergePackageJson(existing, additions);
  assert.equal(r.merged.scripts.cycle, "node my/own.js");
  assert.ok(r.conflicts.includes("scripts.cycle"));
});

test("mergePackageJson handles missing package.json", () => {
  const r = merge.mergePackageJson("", {
    scripts: { cycle: "node x.js" },
    dependencies: { "@orbit-house/sdk": "^0.1.0" }
  });
  assert.equal(r.malformed, false);
  assert.equal(r.merged.scripts.cycle, "node x.js");
});

test("mergePackageJson flags malformed JSON without throwing", () => {
  const r = merge.mergePackageJson("{ not: json", { scripts: { cycle: "x" } });
  assert.equal(r.malformed, true);
  assert.equal(r.merged, null);
});

test("mergeReadme appends a block when no marker exists", () => {
  const r = merge.mergeReadme("# Hello\n\nbody", "<!-- orbit:start -->\n## Orbit\n<!-- orbit:end -->");
  assert.equal(r.action, "APPEND");
  assert.ok(r.merged.includes("<!-- orbit:start -->"));
  assert.ok(r.merged.includes("# Hello"));
});

test("mergeReadme is NOOP if marker already present", () => {
  const existing = "# Hi\n<!-- orbit:start -->\nold\n<!-- orbit:end -->\nfooter";
  const r = merge.mergeReadme(existing, "<!-- orbit:start -->\nnew\n<!-- orbit:end -->");
  assert.equal(r.action, "NOOP");
  assert.equal(r.merged, existing);
});

test("mergeReadme writes fresh when no existing README", () => {
  const r = merge.mergeReadme("", "<!-- orbit:start -->\nX\n<!-- orbit:end -->");
  assert.equal(r.action, "WRITE");
  assert.ok(r.merged.includes("<!-- orbit:start -->"));
});

test("deepMerge merges nested objects without losing existing values", () => {
  const existing = { a: { x: 1, y: 2 }, b: 3 };
  const additions = { a: { y: 99, z: 5 }, c: 7 };
  const r = merge.deepMerge(existing, additions);
  assert.deepEqual(r.merged.a, { x: 1, y: 2, z: 5 });
  assert.equal(r.merged.b, 3);
  assert.equal(r.merged.c, 7);
  assert.ok(r.conflicts.includes("y"));
});
