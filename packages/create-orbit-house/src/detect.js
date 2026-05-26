"use strict";

const fs = require("fs");
const path = require("path");

function parseNodeVersion(versionString) {
  const m = String(versionString || "").match(/^v?(\d+)\.(\d+)\.(\d+)/);
  if (!m) return { major: 0, minor: 0, patch: 0 };
  return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) };
}

function checkNodeVersion(versionString) {
  const v = parseNodeVersion(versionString);
  if (v.major < 18) {
    const err = new Error(`requires Node 18+, found ${versionString}`);
    err.code = "ENODEVERSION";
    throw err;
  }
  return v;
}

function ensureTargetWritable(targetDir) {
  if (!targetDir) throw new Error("targetDir required");
  if (fs.existsSync(targetDir)) {
    const stat = fs.statSync(targetDir);
    if (!stat.isDirectory()) throw new Error(`target is not a directory: ${targetDir}`);
    try {
      fs.accessSync(targetDir, fs.constants.W_OK);
    } catch (e) {
      const err = new Error(`cannot write to ${targetDir}: EACCES`);
      err.code = "EACCES";
      throw err;
    }
  } else {
    const parent = path.dirname(targetDir);
    if (!fs.existsSync(parent)) {
      const err = new Error(`parent directory does not exist: ${parent}`);
      err.code = "ENOENT";
      throw err;
    }
    try {
      fs.accessSync(parent, fs.constants.W_OK);
    } catch (e) {
      const err = new Error(`cannot write to ${parent}: EACCES`);
      err.code = "EACCES";
      throw err;
    }
  }
}

function directoryIsNonEmpty(targetDir) {
  if (!fs.existsSync(targetDir)) return false;
  const entries = fs.readdirSync(targetDir).filter((n) => n !== "." && n !== "..");
  return entries.length > 0;
}

function hasGitDir(targetDir) {
  return fs.existsSync(path.join(targetDir, ".git"));
}

function classifyDestination(destPath, candidateContent) {
  if (!fs.existsSync(destPath)) return "WRITE";
  let existing;
  try {
    existing = fs.readFileSync(destPath, "utf8");
  } catch (e) {
    return "SKIP";
  }
  return existing === candidateContent ? "NOOP" : "SKIP";
}

module.exports = {
  parseNodeVersion,
  checkNodeVersion,
  ensureTargetWritable,
  directoryIsNonEmpty,
  hasGitDir,
  classifyDestination
};
