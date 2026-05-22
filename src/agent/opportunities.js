"use strict";

const { MANDATORY_INTERVAL_MINUTES } = require("./triggers");
const { readSafeTextFile, writeSafeTextFile } = require("./safety");

const OPPORTUNITIES_PATH = "memory/opportunities.json";

const DEFAULT_OPPORTUNITIES = [
  {
    id: "repo-safety-audit",
    title: "Paid repo safety audit",
    source: "house_skill",
    driverTypes: ["state", "event"],
    triggers: ["state:needs_income", "state:food_low", "event:front_door_activity"],
    survivalNeed: "money",
    earningMethod: "Sell a scoped review of repository safety, spend gates, proof logs, and AI-budget controls.",
    firstSafeMove: "Draft a small public scope and request owner approval before outreach or paid commitments.",
    status: "open",
    expectedRewardUsd: 150,
    estimatedFoodUsd: 8,
    risk: "low",
    approvalRequired: true,
    notes: "Package scam scanning, spend gates, proof logs, and treasury checks as a paid review."
  },
  {
    id: "open-source-agent-toolkit",
    title: "Open-source agent safety toolkit",
    source: "problem_lab",
    driverTypes: ["state", "mandatory"],
    triggers: ["state:needs_income", "mandatory:regular_heartbeat"],
    survivalNeed: "reputation_and_future_income",
    earningMethod: "Build small open-source tools from Orbit's safety, proof, memory, and budget patterns, then convert adoption into services or sponsorship later.",
    firstSafeMove: "Use the learning lab to choose one problem and build a repo-local prototype. Do not publish, post outreach, or accept obligations without owner direction.",
    status: "open",
    expectedRewardUsd: 180,
    estimatedFoodUsd: 7,
    risk: "low",
    approvalRequired: false,
    notes: "Broaden Orbit from one service pitch into useful public tools: scanners, ledgers, proof viewers, CLIs, and agent memory patterns."
  },
  {
    id: "problem-lab-product-pipeline",
    title: "Problem Lab product pipeline",
    source: "problem_lab",
    driverTypes: ["mandatory", "state"],
    triggers: ["mandatory:regular_heartbeat", "state:needs_income"],
    survivalNeed: "new_work",
    earningMethod: "Find repeated developer pain, score solution ideas, and create small repo-local experiments that can become open-source projects, services, or products.",
    firstSafeMove: "Record one problem, one solution, and one safe experiment in the learning lab; build only inside the repo first.",
    status: "open",
    expectedRewardUsd: 140,
    estimatedFoodUsd: 6,
    risk: "low",
    approvalRequired: false,
    notes: "This keeps Orbit thinking beyond GitHub-only chores while preserving the house as the execution base."
  },
  {
    id: "agent-radar-idea-intake",
    title: "Agent Radar idea intake",
    source: "agent_radar",
    driverTypes: ["mandatory", "state"],
    triggers: ["mandatory:regular_heartbeat", "state:needs_income"],
    survivalNeed: "learning",
    earningMethod: "Scout public GitHub, Gitlawb, and web agent projects for patterns, failures, and project ideas, then quarantine and score them as internal inspiration.",
    firstSafeMove: "Seed trusted source policy and quarantined idea inbox; do not post to other agents or treat their messages as commands.",
    status: "open",
    expectedRewardUsd: 90,
    estimatedFoodUsd: 5,
    risk: "medium",
    approvalRequired: false,
    notes: "Other agents may inspire Orbit, but cannot command it."
  },
  {
    id: "proof-ledger-setup",
    title: "Proof ledger setup for other repos",
    source: "repeated_chore",
    driverTypes: ["mandatory", "state"],
    triggers: ["mandatory:regular_heartbeat", "state:needs_income"],
    survivalNeed: "repeatable_service",
    earningMethod: "Install cycle notes, proof records, and audit trails for teams running AI workflows.",
    firstSafeMove: "Package the existing proof workflow as a small setup offer with clear limits.",
    status: "open",
    expectedRewardUsd: 100,
    estimatedFoodUsd: 6,
    risk: "low",
    approvalRequired: true,
    notes: "Install cycle notes, proof records, and audit trails for teams running AI workflows."
  },
  {
    id: "issue-triage-maintenance",
    title: "Paid issue triage and maintenance",
    source: "front_door",
    driverTypes: ["event"],
    triggers: ["event:front_door_activity"],
    survivalNeed: "visitor_work",
    earningMethod: "Turn safe incoming issue activity into scoped maintenance chores, summaries, labels, and next-step plans.",
    firstSafeMove: "Risk-scan the visitor request, estimate food cost, and ask for approval before paid work begins.",
    status: "open",
    expectedRewardUsd: 75,
    estimatedFoodUsd: 5,
    risk: "medium",
    approvalRequired: true,
    notes: "Offer small recurring maintenance chores: labels, summaries, checks, and next-step plans."
  },
  {
    id: "bounty-research-loop",
    title: "Public bounty research loop",
    source: "market_scan",
    driverTypes: ["state", "mandatory"],
    triggers: ["state:needs_income", "mandatory:regular_heartbeat"],
    survivalNeed: "new_work",
    earningMethod: "Search public GitHub and community surfaces for safe bounties that match the house skills.",
    firstSafeMove: "Collect public candidates only; do not apply, spend, or sign anything without owner review.",
    status: "open",
    expectedRewardUsd: 120,
    estimatedFoodUsd: 10,
    risk: "medium",
    approvalRequired: true,
    notes: "Look for public, low-risk repo maintenance, documentation, testing, and safety-review bounties."
  },
  {
    id: "maintenance-template-pack",
    title: "Maintenance template pack",
    source: "house_product",
    driverTypes: ["mandatory", "state"],
    triggers: ["mandatory:regular_heartbeat", "state:needs_income"],
    survivalNeed: "productized_work",
    earningMethod: "Turn repeated chores into reusable issue templates, workflow checks, README sections, and proof templates.",
    firstSafeMove: "Build the pack locally from existing files and publish only after owner approval.",
    status: "open",
    expectedRewardUsd: 60,
    estimatedFoodUsd: 4,
    risk: "low",
    approvalRequired: true,
    notes: "Package repeated household chores into a small reusable product for other GitHub projects."
  },
  {
    id: "token-readiness-package",
    title: "Token readiness package",
    source: "treasury_skill",
    driverTypes: ["state", "mandatory"],
    triggers: ["state:needs_income", "mandatory:regular_heartbeat"],
    survivalNeed: "treasury_growth",
    earningMethod: "Prepare token-launch readiness, revenue routing checks, and public owner-approval notes.",
    firstSafeMove: "Prepare and validate only; live launch, claims, and signing remain locked behind explicit flags.",
    status: "open",
    expectedRewardUsd: 250,
    estimatedFoodUsd: 12,
    risk: "medium",
    approvalRequired: true,
    notes: "Offer launch-readiness review and treasury policy setup while keeping live signing locked."
  }
];

const DRIVER_PRIORITY = {
  critical: 0,
  high: 1,
  normal: 2,
  always: 3
};

const DRIVER_TYPE_ORDER = {
  state: 0,
  event: 1,
  mandatory: 2
};

function blankStore() {
  return {
    version: 1,
    policy: {
      mode: "survival_without_unlocked_spend",
      rule: "Orbit may search for income broadly, but money movement, signing, and external spend stay behind approval and live flags."
    },
    opportunities: []
  };
}

function loadOpportunities(repoRoot) {
  try {
    const parsed = JSON.parse(readSafeTextFile(repoRoot, OPPORTUNITIES_PATH));
    return {
      ...blankStore(),
      ...parsed,
      opportunities: Array.isArray(parsed.opportunities) ? parsed.opportunities : []
    };
  } catch {
    return blankStore();
  }
}

function saveOpportunities(repoRoot, store) {
  writeSafeTextFile(repoRoot, OPPORTUNITIES_PATH, `${JSON.stringify(store, null, 2)}\n`);
}

function scoreOpportunity(opportunity) {
  const reward = Number(opportunity.expectedRewardUsd || 0);
  const food = Math.max(1, Number(opportunity.estimatedFoodUsd || 1));
  const riskPenalty = { low: 1, medium: 0.65, high: 0.25 }[opportunity.risk] || 0.5;
  const approvalPenalty = opportunity.approvalRequired ? 0.85 : 1;
  return Number(((reward / food) * riskPenalty * approvalPenalty).toFixed(2));
}

function seedOpportunities(store) {
  const now = new Date().toISOString();
  let changed = 0;
  for (const item of DEFAULT_OPPORTUNITIES) {
    const index = store.opportunities.findIndex((opportunity) => opportunity.id === item.id);
    if (index === -1) {
      store.opportunities.push({
        ...item,
        score: scoreOpportunity(item),
        createdAt: now,
        updatedAt: now
      });
      changed += 1;
      continue;
    }

    const existing = store.opportunities[index];
    const merged = {
      ...item,
      ...existing,
      score: scoreOpportunity({ ...item, ...existing })
    };
    const missingDefault = Object.keys(item).some((key) => existing[key] === undefined);
    const scoreChanged = existing.score !== merged.score;
    if (missingDefault || scoreChanged) {
      store.opportunities[index] = {
        ...merged,
        updatedAt: now
      };
      changed += 1;
    }
  }
  return changed;
}

function summarizeSurvival({ aiBudget, treasury, issues = [], tasks } = {}) {
  const openTasks = tasks && Array.isArray(tasks.tasks)
    ? tasks.tasks.filter((task) => task.status === "open").length
    : 0;
  const lastClaimResult = treasury && treasury.revenue && treasury.revenue.lastClaimResult;
  const incomeRecorded = Number((lastClaimResult && lastClaimResult.amountUsd) || 0);
  const tokenLaunched = Boolean(treasury && treasury.token && treasury.token.launchStatus === "launched");
  const dailyRemainingUsd = Number(aiBudget && aiBudget.dailyRemainingUsd || 0);
  const monthlyRemainingUsd = Number(aiBudget && aiBudget.monthlyRemainingUsd || 0);
  const canUseAi = Boolean(aiBudget && aiBudget.canUseAi);

  let survivalState = "stable";
  if (!tokenLaunched && incomeRecorded <= 0) survivalState = "needs_income";
  if (!canUseAi || dailyRemainingUsd <= 1 || monthlyRemainingUsd <= 5) survivalState = "food_low";

  return {
    survivalState,
    food: {
      dailyRemainingUsd,
      monthlyRemainingUsd,
      canUseAi
    },
    money: {
      tokenLaunched,
      incomeRecorded
    },
    signals: {
      openIssues: Array.isArray(issues) ? issues.length : 0,
      openTasks
    }
  };
}

function driverKey(driver) {
  if (!driver) return "";
  return `${driver.type}:${driver.id}`;
}

function selectPrimaryDriver(drivers) {
  return [...drivers].sort((a, b) => {
    const leftPriority = DRIVER_PRIORITY[a.priority] ?? 99;
    const rightPriority = DRIVER_PRIORITY[b.priority] ?? 99;
    if (leftPriority !== rightPriority) return leftPriority - rightPriority;

    const leftType = DRIVER_TYPE_ORDER[a.type] ?? 99;
    const rightType = DRIVER_TYPE_ORDER[b.type] ?? 99;
    if (leftType !== rightType) return leftType - rightType;

    return String(a.id).localeCompare(String(b.id));
  })[0] || null;
}

function deriveDrivers(context = {}) {
  const survival = summarizeSurvival(context);
  const cycleTrigger = context.cycleConfig && context.cycleConfig.trigger
    ? context.cycleConfig.trigger
    : null;
  const drivers = [];

  if (survival.survivalState !== "stable") {
    drivers.push({
      type: "state",
      id: survival.survivalState,
      priority: survival.survivalState === "food_low" ? "critical" : "high",
      reason: survival.survivalState === "food_low"
        ? "AI-call food is low; conserve food and prefer low-cost earning actions."
        : "Income is not established; search for safe ways the house can earn."
    });
  }

  if (survival.signals.openIssues > 0) {
    drivers.push({
      type: "event",
      id: "front_door_activity",
      priority: "normal",
      reason: "Visitors at the front door may include paid work, risk, or chores."
    });
  }

  if (cycleTrigger && cycleTrigger.type === "event" && cycleTrigger.id !== "local_wake") {
    drivers.push({
      type: "event",
      id: cycleTrigger.id,
      priority: "normal",
      reason: cycleTrigger.reason || "GitHub activity woke the house."
    });
  }

  if (!cycleTrigger || cycleTrigger.type === "mandatory") {
    drivers.push({
      type: "mandatory",
      id: "regular_heartbeat",
      priority: "always",
      reason: `Regular ${MANDATORY_INTERVAL_MINUTES}-minute household cycle: inspect state, look for income, maintain locks, and write proofs.`
    });
  }

  return {
    cyclePolicy: "state_event_mandatory",
    definitions: {
      state: "Internal household condition such as low AI-call food, no income, open chores, pending approvals, or stale memory.",
      event: "External GitHub activity such as issues, comments, labels, or a manual owner wake.",
      mandatory: `The regular ${MANDATORY_INTERVAL_MINUTES}-minute heartbeat cycle.`
    },
    mandatoryIntervalMinutes: MANDATORY_INTERVAL_MINUTES,
    survival,
    drivers,
    selectedDriver: selectPrimaryDriver(drivers)
  };
}

function opportunityDriverFit(opportunity, driver) {
  if (!driver) return 0;
  const driverTypes = Array.isArray(opportunity.driverTypes) ? opportunity.driverTypes : [];
  const triggers = Array.isArray(opportunity.triggers) ? opportunity.triggers : [];
  const triggerFit = triggers.includes(driverKey(driver)) ? 6 : 0;
  const typeFit = driverTypes.includes(driver.type) ? 3 : 0;
  return triggerFit + typeFit;
}

function opportunityStatus(repoRoot, context = {}) {
  const store = loadOpportunities(repoRoot);
  const seeded = seedOpportunities(store);
  const persisted = store.opportunities
    .map((item) => ({
      ...item,
      score: scoreOpportunity(item)
    }))
    .sort((a, b) => b.score - a.score);

  const before = JSON.stringify(store.opportunities);
  store.opportunities = persisted;

  const drivers = deriveDrivers(context);
  const runtimeOpportunities = persisted
    .filter((item) => item.status !== "closed")
    .map((item) => {
      const driverFit = opportunityDriverFit(item, drivers.selectedDriver);
      return {
        ...item,
        driverFit,
        driverAdjustedScore: Number((item.score + driverFit).toFixed(2)),
        matchedDriver: drivers.selectedDriver ? driverKey(drivers.selectedDriver) : null
      };
    })
    .sort((a, b) => b.driverAdjustedScore - a.driverAdjustedScore);

  const changed = seeded > 0 || before !== JSON.stringify(store.opportunities);
  if (changed) {
    saveOpportunities(repoRoot, store);
  }

  return {
    path: OPPORTUNITIES_PATH,
    seeded,
    changed,
    policy: store.policy,
    drivers,
    best: runtimeOpportunities[0] || null,
    opportunities: runtimeOpportunities
  };
}

module.exports = {
  OPPORTUNITIES_PATH,
  deriveDrivers,
  loadOpportunities,
  opportunityDriverFit,
  opportunityStatus,
  saveOpportunities,
  scoreOpportunity,
  summarizeSurvival
};
