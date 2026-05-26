"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const detect = require("../packages/create-orbit-house/src/detect");

test("parseNodeVersion handles v-prefix and plain", () => {
  assert.deepEqual(detect.parseNodeVersion("v20.10.1"), { major: 20, minor: 10, patch: 1 });
  assert.deepEqual(detect.parseNodeVersion("18.0.0"), { major: 18, minor: 0, patch: 0 });
});

test("checkNodeVersion fails below 18", () => {
  assert.throws(() => detect.checkNodeVersion("v16.20.0"), /requires Node 18\+/);
});

test("checkNodeVersion passes for 18 and 24", () => {
  detect.checkNodeVersion("v18.0.0");
  detect.checkNodeVersion("v24.0.0");
});

test("ensureTargetWritable accepts an existing writable dir", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "orbit-detect-"));
  try {
    detect.ensureTargetWritable(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("ensureTargetWritable rejects a file path", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "orbit-detect-"));
  const file = path.join(dir, "f.txt");
  fs.writeFileSync(file, "x");
  try {
    assert.throws(() => detect.ensureTargetWritable(file), /not a directory/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("ensureTargetWritable rejects when parent does not exist", () => {
  const missing = path.join(os.tmpdir(), `nope-${Date.now()}`, "deep", "child");
  assert.throws(() => detect.ensureTargetWritable(missing), /parent directory does not exist/);
});

test("directoryIsNonEmpty distinguishes empty vs filled", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "orbit-detect-"));
  try {
    assert.equal(detect.directoryIsNonEmpty(dir), false);
    fs.writeFileSync(path.join(dir, "a"), "x");
    assert.equal(detect.directoryIsNonEmpty(dir), true);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("classifyDestination returns WRITE/NOOP/SKIP per file state", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "orbit-detect-"));
  const p = path.join(dir, "f");
  try {
    assert.equal(detect.classifyDestination(p, "abc"), "WRITE");
    fs.writeFileSync(p, "abc");
    assert.equal(detect.classifyDestination(p, "abc"), "NOOP");
    assert.equal(detect.classifyDestination(p, "different"), "SKIP");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("hasGitDir reflects .git directory", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "orbit-detect-"));
  try {
    assert.equal(detect.hasGitDir(dir), false);
    fs.mkdirSync(path.join(dir, ".git"));
    assert.equal(detect.hasGitDir(dir), true);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
