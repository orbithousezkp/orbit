"use strict";

const { readSafeTextFile } = require("./safety");
const { walletStatus } = require("./wallet");

const INFRASTRUCTURE_PATH = "memory/infrastructure.json";
const INFRASTRUCTURE_STATUSES = ["active", "planned", "research", "later", "blocked"];

function emptyInfrastructure() {
  return {
    version: 1,
    updatedAt: null,
    product: {},
    layers: [],
    activePhase: null,
    surfaces: [],
    capabilities: [],
    commands: [],
    access: [],
    wallet: {},
    receipts: {},
    blockedUntilApproved: []
  };
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function loadInfrastructure(repoRoot) {
  try {
    const parsed = JSON.parse(readSafeTextFile(repoRoot, INFRASTRUCTURE_PATH));
    return {
      ...emptyInfrastructure(),
      ...parsed,
      product: asObject(parsed.product),
      layers: asArray(parsed.layers),
      activePhase: asObject(parsed.activePhase),
      surfaces: asArray(parsed.surfaces),
      capabilities: asArray(parsed.capabilities),
      commands: asArray(parsed.commands),
      access: asArray(parsed.access),
      wallet: asObject(parsed.wallet),
      receipts: asObject(parsed.receipts),
      blockedUntilApproved: asArray(parsed.blockedUntilApproved)
    };
  } catch {
    return emptyInfrastructure();
  }
}

function normalizedStatus(status) {
  return INFRASTRUCTURE_STATUSES.includes(status) ? status : "planned";
}

function statusCounts(items = []) {
  const counts = Object.fromEntries(INFRASTRUCTURE_STATUSES.map((status) => [status, 0]));
  for (const item of asArray(items)) {
    counts[normalizedStatus(item && item.status)] += 1;
  }
  return counts;
}

function firstByStatus(items = [], statuses = []) {
  const wanted = new Set(statuses);
  return asArray(items).find((item) => wanted.has(normalizedStatus(item && item.status))) || null;
}

function infrastructureSummary(infrastructure = emptyInfrastructure()) {
  const surfaces = asArray(infrastructure.surfaces);
  const capabilities = asArray(infrastructure.capabilities);
  const commands = asArray(infrastructure.commands);
  const access = asArray(infrastructure.access);
  const wallet = asObject(infrastructure.wallet);
  const surfaceCounts = statusCounts(surfaces);
  const capabilityCounts = statusCounts(capabilities);
  const commandCounts = statusCounts(commands);
  const accessCounts = statusCounts(access);
  const activeSurface = firstByStatus(surfaces, ["active"]);
  const nextSurface = firstByStatus(surfaces, ["planned", "research", "later"]);
  const nextCapability = firstByStatus(capabilities, ["planned", "research", "later"]);

  return {
    version: infrastructure.version || 1,
    updatedAt: infrastructure.updatedAt || null,
    productName: infrastructure.product && infrastructure.product.name || "Orbit",
    category: infrastructure.product && infrastructure.product.category || "GitHub-native agent infrastructure",
    problem: infrastructure.product && infrastructure.product.problem || "",
    solution: infrastructure.product && infrastructure.product.solution || "",
    positioning: infrastructure.product && infrastructure.product.positioning || "",
    activePhase: infrastructure.activePhase || null,
    layers: asArray(infrastructure.layers),
    activeSurface,
    nextSurface,
    nextCapability,
    surfaceCounts,
    capabilityCounts,
    commandCounts,
    accessCounts,
    totalSurfaces: surfaces.length,
    totalCapabilities: capabilities.length,
    totalCommands: commands.length,
    totalAccess: access.length,
    activeCapabilities: capabilityCounts.active,
    plannedCapabilities: capabilityCounts.planned,
    blocked: surfaceCounts.blocked + capabilityCounts.blocked + commandCounts.blocked,
    receiptRoot: infrastructure.receipts && infrastructure.receipts.current || null,
    wallet,
    walletMode: wallet.approvalMode || null,
    walletBlockedLiveActions: Array.isArray(wallet.blockedLiveActions) ? wallet.blockedLiveActions : []
  };
}

function infrastructureStatus(repoRoot) {
  const infrastructure = loadInfrastructure(repoRoot);
  const wallet = walletStatus(repoRoot);
  const summary = infrastructureSummary(infrastructure);
  summary.wallet = wallet.summary;
  summary.walletMode = wallet.summary.approvalMode || summary.walletMode || null;
  summary.walletBlockedLiveActions = Array.isArray(wallet.summary.blockedLiveActions)
    ? wallet.summary.blockedLiveActions
    : summary.walletBlockedLiveActions;
  return {
    path: INFRASTRUCTURE_PATH,
    summary,
    product: infrastructure.product,
    layers: infrastructure.layers,
    activePhase: infrastructure.activePhase,
    surfaces: infrastructure.surfaces,
    capabilities: infrastructure.capabilities,
    commands: infrastructure.commands,
    access: infrastructure.access,
    wallet: wallet.summary,
    receipts: infrastructure.receipts,
    blockedUntilApproved: infrastructure.blockedUntilApproved
  };
}

module.exports = {
  INFRASTRUCTURE_PATH,
  INFRASTRUCTURE_STATUSES,
  infrastructureStatus,
  infrastructureSummary,
  loadInfrastructure
};
