"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const path = require("node:path");

const PKG_DIR = path.resolve(__dirname, "..", "packages", "orbit-sdk");

function runPack() {
  const out = execFileSync("npm", ["pack", "--dry-run", "--json"], {
    cwd: PKG_DIR,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
  const parsed = JSON.parse(out);
  return Array.isArray(parsed) ? parsed[0] : parsed;
}

test("npm pack --dry-run produces a publish-ready @orbit-house/sdk tarball", () => {
  const info = runPack();

  assert.equal(info.name, "@orbit-house/sdk", "package name");
  assert.match(info.version, /^\d+\.\d+\.\d+(?:[-+].+)?$/, "valid semver");

  const files = (info.files || []).map((f) => f.path);
  const required = ["package.json", "index.js", "cli.js", "README.md", "LICENSE"];
  for (const f of required) {
    assert.ok(files.includes(f), `tarball includes ${f} (got: ${files.join(", ")})`);
  }

  const forbiddenPatterns = [/^node_modules\//, /\.test\.js$/, /^__tests__\//, /\.DS_Store$/];
  for (const f of files) {
    for (const pattern of forbiddenPatterns) {
      assert.ok(
        !pattern.test(f),
        `tarball must not include file matching ${pattern}: ${f}`
      );
    }
  }

  const size = info.size ?? info.unpackedSize;
  assert.ok(typeof size === "number" && size > 0, "size is reported");
  assert.ok(size < 50 * 1024, `tarball size ${size} bytes < 50KB`);
});
