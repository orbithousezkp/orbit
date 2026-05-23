"use strict";

const { readSafeTextFile } = require("./safety");

const ROADMAP_PATH = "memory/roadmap.json";
const ROADMAP_STATUSES = ["passed", "active", "planned", "research", "later", "blocked"];

function emptyRoadmap() {
  return {
    version: 1,
    updatedAt: null,
    source: "",
    northStar: "",
    currentLevel: null,
    dayOneBuild: {},
    operatingRules: [],
    lanes: [],
    phaseChecks: [],
    levels: [],
    weeklyRevenueModel: {},
    zkProofsShipNow: [],
    zkProofMvp: [],
    frontierBacklog: [],
    impossibleOrUnsafe: [],
    notImplementedYet: [],
    approvalRequired: [],
    researchReferences: []
  };
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function loadRoadmap(repoRoot) {
  try {
    const parsed = JSON.parse(readSafeTextFile(repoRoot, ROADMAP_PATH));
    return {
      ...emptyRoadmap(),
      ...parsed,
      dayOneBuild: asObject(parsed.dayOneBuild),
      operatingRules: asArray(parsed.operatingRules),
      lanes: asArray(parsed.lanes),
      phaseChecks: asArray(parsed.phaseChecks),
      levels: asArray(parsed.levels),
      weeklyRevenueModel: asObject(parsed.weeklyRevenueModel),
      zkProofsShipNow: asArray(parsed.zkProofsShipNow),
      zkProofMvp: asArray(parsed.zkProofMvp),
      frontierBacklog: asArray(parsed.frontierBacklog),
      impossibleOrUnsafe: asArray(parsed.impossibleOrUnsafe),
      notImplementedYet: asArray(parsed.notImplementedYet),
      approvalRequired: asArray(parsed.approvalRequired),
      researchReferences: asArray(parsed.researchReferences)
    };
  } catch {
    return emptyRoadmap();
  }
}

function normalizedStatus(status) {
  return ROADMAP_STATUSES.includes(status) ? status : "planned";
}

function statusCounts(items = []) {
  const counts = Object.fromEntries(ROADMAP_STATUSES.map((status) => [status, 0]));
  for (const item of asArray(items)) {
    counts[normalizedStatus(item && item.status)] += 1;
  }
  return counts;
}

function firstByStatus(items = [], statuses = []) {
  const wanted = new Set(statuses);
  return asArray(items).find((item) => wanted.has(item.status)) || null;
}

function roadmapSummary(roadmap = emptyRoadmap()) {
  const lanes = asArray(roadmap.lanes);
  const levels = asArray(roadmap.levels);
  const phaseChecks = asArray(roadmap.phaseChecks);
  const zkProofMvp = asArray(roadmap.zkProofMvp);
  const zkProofsShipNow = asArray(roadmap.zkProofsShipNow);
  const frontierBacklog = asArray(roadmap.frontierBacklog);
  const impossibleOrUnsafe = asArray(roadmap.impossibleOrUnsafe);
  const researchReferences = asArray(roadmap.researchReferences);
  const weeklyRevenueModel = asObject(roadmap.weeklyRevenueModel);
  const laneCounts = statusCounts(lanes);
  const levelCounts = statusCounts(levels);
  const phaseCounts = statusCounts(phaseChecks);
  const zkCounts = statusCounts(zkProofMvp);
  const zkShipNowCounts = statusCounts(zkProofsShipNow);
  const currentLevelId = roadmap.currentLevel && roadmap.currentLevel.id;
  const currentLevel = levels.find((level) => level.id === currentLevelId) ||
    firstByStatus(levels, ["active"]) ||
    levels[0] ||
    null;
  const nextLevel = firstByStatus(levels, ["planned", "research", "later"]);
  const activeLane = firstByStatus(lanes, ["active"]);
  const nextLane = firstByStatus(lanes, ["planned", "research", "later"]);
  const activePhase = firstByStatus(phaseChecks, ["active"]) ||
    firstByStatus(phaseChecks, ["planned", "research", "later"]);

  return {
    version: roadmap.version || 1,
    updatedAt: roadmap.updatedAt || null,
    northStar: roadmap.northStar || "",
    currentLevel,
    nextLevel,
    activeLane,
    nextLane,
    activePhase,
    laneCounts,
    levelCounts,
    phaseCounts,
    zkCounts,
    zkShipNowCounts,
    weeklyRevenueScope: weeklyRevenueModel.scope || null,
    weeklyRevenueFormula: weeklyRevenueModel.formula || null,
    totalLanes: lanes.length,
    totalLevels: levels.length,
    totalPhaseChecks: phaseChecks.length,
    totalZkShipNowItems: zkProofsShipNow.length,
    totalZkProofItems: zkProofMvp.length,
    totalFrontierItems: frontierBacklog.length,
    totalImpossibleOrUnsafeItems: impossibleOrUnsafe.length,
    totalResearchReferences: researchReferences.length,
    blocked: laneCounts.blocked + levelCounts.blocked + phaseCounts.blocked + zkCounts.blocked + zkShipNowCounts.blocked,
    hasZkImplementation: zkCounts.passed > 0 || zkCounts.active > 0
  };
}

function roadmapStatus(repoRoot) {
  const roadmap = loadRoadmap(repoRoot);
  return {
    path: ROADMAP_PATH,
    summary: roadmapSummary(roadmap),
    currentLevel: roadmap.currentLevel,
    dayOneBuild: roadmap.dayOneBuild,
    operatingRules: roadmap.operatingRules,
    lanes: roadmap.lanes,
    phaseChecks: roadmap.phaseChecks,
    levels: roadmap.levels,
    weeklyRevenueModel: roadmap.weeklyRevenueModel,
    zkProofsShipNow: roadmap.zkProofsShipNow,
    zkProofMvp: roadmap.zkProofMvp,
    frontierBacklog: roadmap.frontierBacklog,
    impossibleOrUnsafe: roadmap.impossibleOrUnsafe,
    notImplementedYet: roadmap.notImplementedYet,
    approvalRequired: roadmap.approvalRequired,
    researchReferences: roadmap.researchReferences
  };
}

module.exports = {
  ROADMAP_PATH,
  ROADMAP_STATUSES,
  loadRoadmap,
  roadmapStatus,
  roadmapSummary
};
