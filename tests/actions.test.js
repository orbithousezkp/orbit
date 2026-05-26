"use strict";

// actions.js is the gateway every tool call goes through. Its job is to
// make sure the LLM cannot write to protected files, cannot inline
// binary assets, and cannot smuggle oversized payloads. These guards
// are load-bearing — they're the last line between the model and the
// disk — and they had no dedicated tests until Patch Set L.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { writeFile, readFileForTool } = require("../src/agent/actions");

function tempRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "orbit-actions-test-"));
  fs.mkdirSync(path.join(dir, "memory"), { recursive: true });
  return dir;
}

test("writeFile refuses to write protected paths", () => {
  const repoRoot = tempRepo();
  for (const protectedPath of [
    "memory/approvals.json",
    "memory/governance.json",
    "memory/state.json",
    "memory/treasury.json"
  ]) {
    assert.throws(
      () => writeFile({ repoRoot }, protectedPath, "{}\n"),
      /direct writes.+not allowed/,
      `expected refusal for ${protectedPath}`
    );
  }
});

// Patch Set AF: writeFile + readFileForTool must refuse secret-bearing
// files at the path-normalizer layer. A real .env on disk should never
// be reachable through the tool surface (defense in depth).
test("writeFile refuses .env and credential files", () => {
  const repoRoot = tempRepo();
  for (const bad of [".env", ".env.local", ".npmrc", "id_rsa", "packages/foo/.env"]) {
    assert.throws(
      () => writeFile({ repoRoot }, bad, "TOKEN=ghp_attacker\n"),
      /secret-bearing/,
      `expected secret-bearing refusal for ${bad}`
    );
  }
});

test("readFileForTool refuses .env and credential files (even if on disk)", () => {
  const repoRoot = tempRepo();
  // Plant a fake .env locally — readFileForTool must still refuse.
  fs.writeFileSync(path.join(repoRoot, ".env"), "ORBIT_WALLET_PRIVATE_KEY=0xdeadbeef\n");
  fs.writeFileSync(path.join(repoRoot, ".npmrc"), "//registry.npmjs.org/:_authToken=npm_secret\n");
  assert.throws(
    () => readFileForTool({ repoRoot }, ".env"),
    /secret-bearing/
  );
  assert.throws(
    () => readFileForTool({ repoRoot }, ".npmrc"),
    /secret-bearing/
  );
});

test("readFileForTool ALLOWS .env.example (placeholder doc)", () => {
  const repoRoot = tempRepo();
  fs.writeFileSync(
    path.join(repoRoot, ".env.example"),
    "# placeholder vars only\nFAKE_KEY=replace-me\n"
  );
  assert.doesNotThrow(() => readFileForTool({ repoRoot }, ".env.example"));
});

test("writeFile rejects binary asset extensions", () => {
  const repoRoot = tempRepo();
  for (const binPath of [
    "public/logo.png",
    "public/clip.mp4",
    "public/doc.pdf"
  ]) {
    assert.throws(
      () => writeFile({ repoRoot }, binPath, "definitely not binary"),
      /write_file writes text only/,
      `expected refusal for ${binPath}`
    );
  }
});

test("writeFile rejects oversized text payloads", () => {
  const repoRoot = tempRepo();
  // The exact cap is internal, but >1 MB of text is definitely past it.
  const huge = "x".repeat(2 * 1024 * 1024);
  assert.throws(
    () => writeFile({ repoRoot }, "docs/giant.md", huge),
    /oversized|too large|exceeds/i
  );
});

test("writeFile succeeds for normal text paths and tracks the change", () => {
  const repoRoot = tempRepo();
  const result = writeFile({ repoRoot }, "docs/notes.md", "hello\n");
  assert.equal(result.path, "docs/notes.md");
  assert.equal(result.bytes, "hello\n".length);
  assert.equal(
    fs.readFileSync(path.join(repoRoot, "docs/notes.md"), "utf-8"),
    "hello\n"
  );
});

test("readFileForTool returns metadata-only for binary assets", () => {
  // The LLM must not be able to inline a 5MB PNG into its context.
  const repoRoot = tempRepo();
  const pngPath = "public/banner.png";
  fs.mkdirSync(path.join(repoRoot, "public"), { recursive: true });
  // Real PNG header so we're not just relying on extension. (Though
  // actions.js identifies by extension; either way the result is the same.)
  fs.writeFileSync(
    path.join(repoRoot, pngPath),
    Buffer.from([0x89, 0x50, 0x4e, 0x47, ...new Array(2048).fill(0)])
  );
  const result = readFileForTool({ repoRoot }, pngPath);
  // The exact shape varies; the invariant is that the file bytes are NOT
  // returned as the body.
  assert.ok(result, "readFileForTool returned nothing for a binary asset");
  const body = result.content || result.body || "";
  assert.ok(
    body.length < 100 || /binary|asset|metadata/i.test(JSON.stringify(result)),
    "binary asset must come back as metadata, not raw bytes"
  );
});

test("readFileForTool tolerates a missing file without throwing", () => {
  const repoRoot = tempRepo();
  assert.doesNotThrow(() => {
    try {
      readFileForTool({ repoRoot }, "memory/never-existed.json");
    } catch (e) {
      // ENOENT is acceptable — the caller catches and surfaces a tool error.
      // What's not acceptable is an uncaught internal crash.
      if (!/ENOENT|not found|exist/i.test(String(e.message || e))) throw e;
    }
  });
});
