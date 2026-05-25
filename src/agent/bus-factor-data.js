"use strict";

// S-REVENUE-3: bus-factor data extraction.
//
// The bus-factor.js module is pure — it does no I/O. This module is the
// integration boundary that fetches commits (via `git log`) and adopter
// implementations (from memory/adopters-registry.json) and hands them to
// busFactor.assertBusFactorMet / busFactor.summarizeBusFactor.
//
// All functions are best-effort: missing git binary, missing registry,
// malformed JSON, etc. all return empty arrays rather than throwing. The
// safeguards above us treat zero data as "critical" (which is the correct
// recommendation), so silent fallthrough never lies.

const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const busFactor = require("./bus-factor");

const DELIMITER = "|||";

function loadCommitsFromGit(repoRoot, opts) {
  // opts = { sinceDays, maxCount? }
  // Runs `git log --since="<N> days ago" --pretty=format:"<sha>|||<email>|||<name>|||<authorDate>"`
  // and parses each line. Returns [{ sha, author: { email, name }, authoredDate }].
  // Defensive — never throws. Returns [] on any error.
  if (!repoRoot || typeof repoRoot !== "string") return [];
  const options = opts && typeof opts === "object" ? opts : {};
  const sinceDays = Number.isFinite(options.sinceDays) && options.sinceDays > 0
    ? Math.floor(options.sinceDays)
    : 90;
  const args = [
    "log",
    "--since=" + sinceDays + " days ago",
    "--pretty=format:%H" + DELIMITER + "%ae" + DELIMITER + "%an" + DELIMITER + "%aI"
  ];
  if (Number.isFinite(options.maxCount) && options.maxCount > 0) {
    args.push("--max-count=" + Math.floor(options.maxCount));
  }

  let raw;
  try {
    raw = execFileSync("git", args, {
      cwd: repoRoot,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 32 * 1024 * 1024
    });
  } catch (err) {
    return [];
  }

  if (!raw || typeof raw !== "string") return [];
  const lines = raw.split("\n");
  const out = [];
  for (const line of lines) {
    if (!line) continue;
    const parts = line.split(DELIMITER);
    if (parts.length < 4) continue;
    const sha = parts[0].trim();
    const email = parts[1].trim();
    const name = parts[2].trim();
    const authoredDate = parts[3].trim();
    if (!sha || !authoredDate) continue;
    out.push({
      sha,
      author: { email, name },
      authoredDate
    });
  }
  return out;
}

function safeReadAdoptersRegistry(repoRoot) {
  if (!repoRoot || typeof repoRoot !== "string") return null;
  const file = path.join(repoRoot, "memory", "adopters-registry.json");
  let raw;
  try {
    raw = fs.readFileSync(file, "utf-8");
  } catch (err) {
    return null;
  }
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch (err) {
    return null;
  }
}

function loadAdoptersForBusFactor(repoRoot) {
  // Reads memory/adopters-registry.json. If missing/malformed, returns [].
  // For each verified adopter, returns { repo, fid, lastActiveAt, missionsExecuted }.
  const registry = safeReadAdoptersRegistry(repoRoot);
  if (!registry) return [];
  const adopters = Array.isArray(registry.adopters) ? registry.adopters : [];
  const out = [];
  for (const a of adopters) {
    if (!a || typeof a !== "object") continue;
    // Heuristic for "verified": status === "verified" or "adopted" or
    // verifiedAt is set. Defensive — accept any of these markers.
    const status = typeof a.status === "string" ? a.status : "";
    const isVerified =
      a.adopted === true
      || status === "verified"
      || status === "adopted"
      || status === "active"
      || (typeof a.verifiedAt === "string" && a.verifiedAt.length > 0);
    if (!isVerified) continue;
    const repo = typeof a.repo === "string" ? a.repo : null;
    const fid = typeof a.fid === "string" ? a.fid : (typeof a.farcasterFid === "string" ? a.farcasterFid : null);
    const lastActiveAt =
      a.lastSeen
      || a.handshakeAt
      || a.lastVerifiedAt
      || a.verifiedAt
      || null;
    let missionsExecuted = 0;
    if (a.metrics && typeof a.metrics === "object" && Number.isFinite(a.metrics.missionsExecuted)) {
      missionsExecuted = a.metrics.missionsExecuted;
    } else if (Number.isFinite(a.cycleCount)) {
      missionsExecuted = a.cycleCount;
    } else if (Number.isFinite(a.missionsExecuted)) {
      missionsExecuted = a.missionsExecuted;
    }
    out.push({
      repo,
      fid,
      lastActiveAt,
      missionsExecuted
    });
  }
  return out;
}

function gatherBusFactorInputs(repoRoot, env) {
  // Calls loadCommitsFromGit + loadAdoptersForBusFactor.
  // lookback comes from busFactor.loadConfig(env).lookbackDays.
  let lookback = 90;
  try {
    const cfg = busFactor.loadConfig(env || {});
    if (cfg && Number.isFinite(cfg.lookbackDays)) lookback = cfg.lookbackDays;
  } catch (err) {
    // bad env — fall back to default lookback. summarize/assert will still
    // re-evaluate config and decide what to do.
  }
  const commits = loadCommitsFromGit(repoRoot, { sinceDays: lookback });
  const adopters = loadAdoptersForBusFactor(repoRoot);
  return { commits, adopters };
}

module.exports = {
  gatherBusFactorInputs,
  loadAdoptersForBusFactor,
  loadCommitsFromGit
};
