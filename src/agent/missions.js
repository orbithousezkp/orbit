"use strict";

// Mission board widget — Phase 1/2 scope (no token, no stake, no contract).
// Reads GitHub issues labeled `orbit:mission` and lifts them onto the public
// dashboard so anyone can see what work has been proposed for Orbit (or any
// adopter repo) to ship. The on-chain staking version is specced separately
// in PLAN/SPECS/MISSION_BOARD.md and gated behind S-GATE-3.

const MISSION_LABEL = "orbit:mission";
const MISSION_SCHEMA = "orbit-missions/1";
const DEFAULT_LIST_LIMIT = 20;
const TITLE_MAX = 160;
const RATIONALE_MAX = 600;
const CRITERIA_MAX_LINES = 10;
const CRITERIA_LINE_MAX = 160;

const CRITERIA_HEADING = /^#{1,6}\s+acceptance criteria\s*$/i;
const CRITERIA_BULLET = /^\s*[-*]\s*(?:\[[ xX]\]\s*)?(.+)$/;
const HEADING_LINE = /^#{1,6}\s+/;
const DEADLINE_LINE = /^\s*deadline\s*[:：]\s*(.+?)\s*$/i;

function clamp(str, max) {
  if (typeof str !== "string") return "";
  const trimmed = str.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

function parseAcceptanceCriteria(body) {
  if (typeof body !== "string" || !body) return [];
  const lines = body.split(/\r?\n/);
  const criteria = [];
  let inBlock = false;
  for (const raw of lines) {
    if (CRITERIA_HEADING.test(raw)) {
      inBlock = true;
      continue;
    }
    if (inBlock && HEADING_LINE.test(raw)) {
      break;
    }
    if (!inBlock) continue;
    const match = raw.match(CRITERIA_BULLET);
    if (match) {
      const item = clamp(match[1], CRITERIA_LINE_MAX);
      if (item) criteria.push(item);
      if (criteria.length >= CRITERIA_MAX_LINES) break;
    }
  }
  return criteria;
}

function parseDeadline(body) {
  if (typeof body !== "string" || !body) return null;
  for (const raw of body.split(/\r?\n/)) {
    const match = raw.match(DEADLINE_LINE);
    if (match) {
      return clamp(match[1], 64);
    }
  }
  return null;
}

function rationaleFromBody(body) {
  if (typeof body !== "string" || !body) return "";
  const parts = body.split(/^#{1,6}\s+/m);
  const prelude = parts[0] || "";
  const cleaned = prelude
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !DEADLINE_LINE.test(line))
    .join(" ");
  return clamp(cleaned, RATIONALE_MAX);
}

function hasMissionLabel(issue) {
  if (!issue || !Array.isArray(issue.labels)) return false;
  return issue.labels.some((label) => {
    if (typeof label === "string") return label.toLowerCase() === MISSION_LABEL;
    if (label && typeof label.name === "string") return label.name.toLowerCase() === MISSION_LABEL;
    return false;
  });
}

function parseMissionFromIssue(issue) {
  if (!issue || typeof issue !== "object") return null;
  if (typeof issue.number !== "number" || !Number.isFinite(issue.number)) return null;
  if (!hasMissionLabel(issue)) return null;
  const proposer = typeof issue.author === "string"
    ? issue.author
    : (issue.user && typeof issue.user.login === "string" ? issue.user.login : "unknown");
  return {
    id: `mission-${issue.number}`,
    issueNumber: issue.number,
    issueUrl: typeof issue.url === "string"
      ? issue.url
      : (typeof issue.html_url === "string" ? issue.html_url : null),
    title: clamp(issue.title || "", TITLE_MAX),
    proposer,
    rationale: rationaleFromBody(issue.body || ""),
    acceptanceCriteria: parseAcceptanceCriteria(issue.body || ""),
    deadline: parseDeadline(issue.body || ""),
    status: typeof issue.state === "string" ? issue.state : "open",
    createdAt: issue.createdAt || issue.created_at || null,
    updatedAt: issue.updatedAt || issue.updated_at || null
  };
}

function scanMissions(issues) {
  if (!Array.isArray(issues)) return [];
  const out = [];
  for (const issue of issues) {
    const mission = parseMissionFromIssue(issue);
    if (mission) out.push(mission);
  }
  out.sort((a, b) => {
    const dA = String(a.updatedAt || a.createdAt || "");
    const dB = String(b.updatedAt || b.createdAt || "");
    return dB.localeCompare(dA);
  });
  return out;
}

function buildMissionsRecord(missions, options = {}) {
  const list = Array.isArray(missions) ? missions : [];
  return {
    schema: MISSION_SCHEMA,
    lastScannedCycle: Number.isFinite(options.cycle) ? options.cycle : null,
    lastScannedAt: options.at || new Date().toISOString(),
    missions: list
  };
}

function projectMissionsForDashboard(missionsRecord, options = {}) {
  const limit = Number.isFinite(options.limit) ? options.limit : DEFAULT_LIST_LIMIT;
  const record = missionsRecord && typeof missionsRecord === "object" ? missionsRecord : {};
  const list = Array.isArray(record.missions) ? record.missions : [];
  const open = list.filter((m) => (m.status || "open") === "open");
  const projected = open.slice(0, limit).map((m) => ({
    id: m.id,
    issueNumber: m.issueNumber,
    issueUrl: m.issueUrl || null,
    title: m.title || "",
    proposer: m.proposer || "unknown",
    deadline: m.deadline || null,
    acceptanceCount: Array.isArray(m.acceptanceCriteria) ? m.acceptanceCriteria.length : 0,
    updatedAt: m.updatedAt || m.createdAt || null
  }));
  return {
    schema: MISSION_SCHEMA,
    active: open.length,
    total: list.length,
    list: projected
  };
}

module.exports = {
  MISSION_LABEL,
  MISSION_SCHEMA,
  parseMissionFromIssue,
  scanMissions,
  buildMissionsRecord,
  projectMissionsForDashboard,
  hasMissionLabel
};
