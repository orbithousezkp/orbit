"use strict";

const fs = require("fs");
const path = require("path");

const BLOCKED_PATH_SEGMENTS = new Set([".git", "node_modules"]);

// Secret-bearing files the tool surface (read_file / write_file)
// MUST never touch. The LLM has no legitimate reason to read an env
// file or a private-key blob, and many of these are not in
// PROTECTED_WRITE_PATHS (which only covers a few memory/*.json
// records). Blocking at the path-normalizer layer means every
// downstream (readSafeTextFile, writeSafeTextFile, appendSafeText-
// File, atomicWriteFile via writeSafeTextFile, the tool-surface
// readFileForTool + writeFile) inherits the protection. Defense
// at one chokepoint, not five.
//
// Exact-match against the basename (case-insensitive). `.env.example`
// is intentionally NOT in this list — it's a placeholder doc that
// adopters read.
const BLOCKED_LEAF_NAMES = new Set([
  ".env",
  ".env.local",
  ".env.development",
  ".env.test",
  ".env.production",
  ".env.staging",
  ".npmrc",
  ".netrc",
  ".pypirc",
  "id_rsa",
  "id_ed25519",
  "id_ecdsa",
  "id_dsa"
]);

const SECRET_PATTERNS = [
  /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/i,
  /\bgh[pousr]_[A-Za-z0-9_]{30,}\b/g,
  /\bgithub_pat_[A-Za-z0-9_]{50,}\b/g,
  /\bsk-[A-Za-z0-9]{20,}\b/g,
  /\bAKIA[0-9A-Z]{16}\b/g,
  /^(?:AI_API_KEY|OPENAI_API_KEY|AI_PROVIDER_API_KEY|GITHUB_TOKEN|GH_TOKEN|ORBIT_WALLET_PRIVATE_KEY|PRIVATE_KEY)[ \t]*=[ \t]*["']?[^"'\s]{12,}/gim,
  /^[A-Z0-9_]*API_KEY[ \t]*=[ \t]*["']?[^"'\s]{12,}/gim,
  /["']?apiKey["']?\s*:\s*["'][^"']{12,}["']/gi
];

const INJECTION_PATTERNS = [
  /ignore (all )?(previous|prior|system|developer) instructions/i,
  /reveal (your )?(system prompt|secrets|token|private key)/i,
  /exfiltrate|prompt injection|jailbreak/i,
  /run arbitrary commands?/i,
  /disable (safety|guardrails|validation)/i
];

const PRIVATE_REPLY_PATTERNS = [
  /\b(?:AI_API_KEY|OPENAI_API_KEY|AI_PROVIDER_API_KEY|GITHUB_TOKEN|GH_TOKEN|ORBIT_WALLET_PRIVATE_KEY|PRIVATE_KEY)\b\s*[:=]/i,
  /\b(?:walletPrivateKey|privateKey|githubToken|aiApiKey|openaiApiKey)\b\s*[:=]/i,
  /\b(?:operatorRevenueAddress|treasuryAddress|tokenAdminAddress|operatorRevenueBps)\b\s*(?:[:=]|\bis\b|\bare\b)/i,
  /\b(?:operator revenue address|treasury address|token admin address|payout address|private reward route)\b\s*(?:[:=]|\bis\b|\bare\b)\s*\S+/i,
  /\b(?:operator share|treasury share|route percentage|revenue basis points)\b\s*(?:[:=]|\bis\b|\bare\b)\s*\d+/i
];

const PUBLIC_FINANCIAL_PROMISE_PATTERNS = [
  /\b(?:I|Orbit|we)\s+(?:will|can|am going to|are going to)\s+(?:transfer|pay|launch|claim|sign|approve|purchase|buy)\b/i,
  /\b(?:I|Orbit|we)\s+(?:will|can|am going to|are going to)\s+send\b.{0,80}\b(?:money|funds|eth|weth|usdc|token|reward|payment|treasury|wallet)\b/i,
  /\b(?:payment|transfer|token launch|reward claim|wallet action)\s+(?:is|has been)\s+approved\b/i
];

function normalizeRelativePath(input) {
  if (typeof input !== "string" || input.trim() === "") {
    throw new Error("path must be a non-empty string");
  }

  const raw = input.replace(/\\/g, "/").trim();
  if (path.isAbsolute(raw)) throw new Error("absolute paths are not allowed");

  const normalized = path.posix.normalize(raw);
  if (normalized === "." || normalized.startsWith("../") || normalized === "..") {
    throw new Error("path must stay inside the repository");
  }

  const parts = normalized.split("/");
  if (parts.some((part) => part === ".." || BLOCKED_PATH_SEGMENTS.has(part))) {
    throw new Error("path includes a blocked segment");
  }

  // Secret-bearing leaf names (.env, .npmrc, id_rsa, ...) are blocked
  // at every depth — root or nested. Case-insensitive match against
  // the basename so .ENV / .Env can't sneak past.
  const leaf = parts[parts.length - 1].toLowerCase();
  if (BLOCKED_LEAF_NAMES.has(leaf)) {
    throw new Error("path includes a secret-bearing file (.env / credentials / private key)");
  }

  return normalized;
}

function safeJoin(root, relativePath) {
  const normalized = normalizeRelativePath(relativePath);
  const absoluteRoot = path.resolve(root);
  const resolved = path.resolve(absoluteRoot, normalized);
  const rootWithSep = absoluteRoot.endsWith(path.sep) ? absoluteRoot : `${absoluteRoot}${path.sep}`;
  if (resolved !== absoluteRoot && !resolved.startsWith(rootWithSep)) {
    throw new Error("resolved path escaped repository root");
  }
  return { normalized, resolved };
}

function assertNoSymlinkPath(root, relativePath) {
  const { normalized, resolved } = safeJoin(root, relativePath);
  const absoluteRoot = path.resolve(root);
  const parts = normalized.split("/").filter(Boolean);
  let current = absoluteRoot;

  for (let index = 0; index < parts.length; index += 1) {
    current = path.join(current, parts[index]);
    let stats;
    try {
      stats = fs.lstatSync(current);
    } catch (error) {
      if (error && error.code === "ENOENT") break;
      throw error;
    }
    if (stats.isSymbolicLink()) {
      throw new Error("path must not include symbolic links");
    }
  }

  return { normalized, resolved };
}

function readSafeTextFile(root, relativePath) {
  const { resolved } = assertNoSymlinkPath(root, relativePath);
  return fs.readFileSync(resolved, "utf-8");
}

// Atomic write to an absolute path. Used by writeSafeTextFile (which
// adds symlink/path safety) and by callers that already have a
// known-safe absolute path (federation/farcaster/horizon ledgers).
// Without this, a power loss or SIGKILL between bytes can leave a
// torn JSON file that the next cycle cannot parse.
function atomicWriteFile(absPath, content) {
  fs.mkdirSync(path.dirname(absPath), { recursive: true });
  const tmpName = `.${path.basename(absPath)}.tmp.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}`;
  const tmpPath = path.join(path.dirname(absPath), tmpName);
  let fd;
  try {
    fd = fs.openSync(tmpPath, "w");
    fs.writeSync(fd, content, 0, "utf-8");
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fd = null;
    fs.renameSync(tmpPath, absPath);
  } catch (error) {
    if (fd != null) {
      try { fs.closeSync(fd); } catch { /* ignore */ }
    }
    try { fs.unlinkSync(tmpPath); } catch { /* tmp may not exist */ }
    throw error;
  }
}

function writeSafeTextFile(root, relativePath, content) {
  const { normalized, resolved } = assertNoSymlinkPath(root, relativePath);
  atomicWriteFile(resolved, content);
  return { normalized, resolved };
}

function appendSafeTextFile(root, relativePath, content) {
  const { normalized, resolved } = assertNoSymlinkPath(root, relativePath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.appendFileSync(resolved, content, "utf-8");
  return { normalized, resolved };
}

function containsSecret(text) {
  const sample = String(text || "");
  return SECRET_PATTERNS.some((pattern) => {
    pattern.lastIndex = 0;
    return pattern.test(sample);
  });
}

function redactSecrets(text) {
  let redacted = String(text || "");
  for (const pattern of SECRET_PATTERNS) {
    pattern.lastIndex = 0;
    redacted = redacted.replace(pattern, "[REDACTED_SECRET]");
  }
  return redacted;
}

function scoreIssueSafety(issue) {
  const text = `${issue.title || ""}\n${issue.body || ""}`;
  const flags = INJECTION_PATTERNS
    .filter((pattern) => pattern.test(text))
    .map((pattern) => pattern.source);

  return {
    safe: flags.length === 0 && !containsSecret(text),
    flags,
    containsSecret: containsSecret(text)
  };
}

function assertSafeTextForWrite(text) {
  if (containsSecret(text)) {
    throw new Error("refusing to write content that looks like a secret");
  }
}

function assertSafePublicReply(text) {
  assertSafeTextForWrite(text);
  const value = String(text || "");
  if (PRIVATE_REPLY_PATTERNS.some((pattern) => pattern.test(value))) {
    throw new Error("refusing to publish private configuration or payout-route details");
  }
  if (PUBLIC_FINANCIAL_PROMISE_PATTERNS.some((pattern) => pattern.test(value))) {
    throw new Error("refusing to publish a financial promise without an approval gate");
  }
}

module.exports = {
  assertSafePublicReply,
  assertSafeTextForWrite,
  atomicWriteFile,
  containsSecret,
  normalizeRelativePath,
  redactSecrets,
  assertNoSymlinkPath,
  appendSafeTextFile,
  readSafeTextFile,
  safeJoin,
  scoreIssueSafety,
  writeSafeTextFile
};
