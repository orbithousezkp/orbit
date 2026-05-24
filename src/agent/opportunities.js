"use strict";

const { MANDATORY_INTERVAL_MINUTES } = require("./triggers");
const { readSafeTextFile, writeSafeTextFile } = require("./safety");

const OPPORTUNITIES_PATH = "memory/opportunities.json";

const DEFAULT_OPPORTUNITIES = [
  {
    id: "orbit-infrastructure-sdk",
    title: "Orbit infrastructure SDK and CLI",
    source: "house_product",
    driverTypes: ["state", "mandatory"],
    triggers: ["state:needs_income", "mandatory:regular_heartbeat"],
    survivalNeed: "platform_product",
    earningMethod: "Package Orbit as a reusable repository control plane that other repos and agents can read through stable files, CLI commands, and a read-only SDK.",
    firstSafeMove: "Clarify the product layer first, then finalize SDK views after Orbit's GitHub, repo, agent, proof, permission, lifecycle, and wallet layers are stable.",
    status: "open",
    expectedRewardUsd: 220,
    estimatedFoodUsd: 7,
    risk: "low",
    approvalRequired: false,
    notes: "Make Orbit feel like infrastructure other repos can adopt, not a scanner or maintainer bot."
  },
  {
    id: "orbit-agent-passport",
    title: "Orbit agent passport and capability registry",
    source: "agent_os",
    driverTypes: ["mandatory", "state"],
    triggers: ["mandatory:regular_heartbeat", "state:needs_income"],
    survivalNeed: "agent_identity",
    earningMethod: "Describe Orbit as a portable repo agent with a passport, capability registry, permissions, lifecycle state, proof root, and revocation boundary.",
    firstSafeMove: "Document the agent passport, capabilities, blocked live actions, and adoption checklist clearly in repo files.",
    status: "open",
    expectedRewardUsd: 200,
    estimatedFoodUsd: 6,
    risk: "low",
    approvalRequired: false,
    notes: "Other repos and agents need a stable way to identify Orbit before they can adopt it."
  },
  {
    id: "orbit-wallet-policy",
    title: "Orbit wallet policy layer",
    source: "treasury_skill",
    driverTypes: ["state", "mandatory"],
    triggers: ["state:needs_income", "mandatory:regular_heartbeat"],
    survivalNeed: "wallet_governance",
    earningMethod: "Expose a read-only wallet policy layer for repo operators, SDK clients, dashboards, and agents.",
    firstSafeMove: "Clarify approval labels, blocked live actions, AI budget, weekly revenue cadence, token state, and private-route boundaries in public-safe status views.",
    status: "open",
    expectedRewardUsd: 180,
    estimatedFoodUsd: 6,
    risk: "low",
    approvalRequired: false,
    notes: "Keep the wallet boundary explicit without turning Orbit into a hot wallet."
  },
  {
    id: "orbit-proof-receipts",
    title: "Orbit proof receipts and cycle digest",
    source: "proofs",
    driverTypes: ["mandatory", "state"],
    triggers: ["mandatory:regular_heartbeat", "state:needs_income"],
    survivalNeed: "auditability",
    earningMethod: "Turn Orbit's proof records into a reusable receipt and cycle-digest layer for other repositories.",
    firstSafeMove: "Improve proof digest metadata and make the latest receipt easier to inspect through CLI and later SDK views.",
    status: "open",
    expectedRewardUsd: 150,
    estimatedFoodUsd: 5,
    risk: "low",
    approvalRequired: false,
    notes: "Proof receipts are part of the infrastructure layer, not a separate app."
  },
  {
    id: "orbit-lifecycle-runtime",
    title: "Orbit lifecycle runtime for repos",
    source: "runtime",
    driverTypes: ["mandatory", "state"],
    triggers: ["mandatory:regular_heartbeat", "state:needs_income"],
    survivalNeed: "runtime_layer",
    earningMethod: "Make wake/sleep cycles, deterministic fallback, health checks, and adoption status reusable for any GitHub repo.",
    firstSafeMove: "Tighten lifecycle docs and tests before adding new execution power.",
    status: "open",
    expectedRewardUsd: 160,
    estimatedFoodUsd: 6,
    risk: "low",
    approvalRequired: false,
    notes: "Lifecycle is the base product layer that other capabilities depend on."
  },
  {
    id: "repo-intake-guardrail",
    title: "Repo intake guardrail package",
    source: "guardrail",
    driverTypes: ["event", "mandatory"],
    triggers: ["event:front_door_activity", "mandatory:regular_heartbeat"],
    survivalNeed: "guardrail",
    earningMethod: "Keep the issue scanner as a small reusable guardrail under Orbit infrastructure.",
    firstSafeMove: "Rebrand the scanner as an intake guardrail and avoid making it the product center.",
    status: "open",
    expectedRewardUsd: 80,
    estimatedFoodUsd: 4,
    risk: "low",
    approvalRequired: false,
    notes: "Scanner is useful but not Orbit's core identity."
  },
  {
    id: "pull-request-review",
    title: "Pull request review",
    source: "house_product",
    driverTypes: ["event", "mandatory"],
    triggers: ["event:front_door_activity", "mandatory:regular_heartbeat"],
    survivalNeed: "guardrail",
    earningMethod: "Read open pull requests, post structured reviews (summary, scope, security, tests, recommendation) without merging. Owner still decides.",
    firstSafeMove: "List open pull requests; on each new one, get_pull_request then post one Orbit review comment.",
    status: "open",
    expectedRewardUsd: 110,
    estimatedFoodUsd: 5,
    risk: "low",
    approvalRequired: false,
    notes: "Orbit comments only. No merge, no close, no label changes from this opportunity."
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
      mode: "infrastructure_without_unlocked_spend",
      rule: "Orbit may build repository infrastructure broadly, but money movement, signing, external spend, publishing with obligations, and shared access stay behind approval and live flags."
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
        ? "AI-call budget is low; conserve budget and prefer low-cost earning actions."
        : "Income is not established; search for safe ways the repo can earn."
    });
  }

  if (survival.signals.openIssues > 0) {
    drivers.push({
      type: "event",
      id: "front_door_activity",
      priority: "normal",
      reason: "GitHub intake may include paid work, risk, or repo tasks."
    });
  }

  if (cycleTrigger && cycleTrigger.type === "event" && cycleTrigger.id !== "local_wake") {
    drivers.push({
      type: "event",
      id: cycleTrigger.id,
      priority: "normal",
      reason: cycleTrigger.reason || "GitHub activity woke the repository control plane."
    });
  }

  if (!cycleTrigger || cycleTrigger.type === "mandatory") {
    drivers.push({
      type: "mandatory",
      id: "regular_heartbeat",
      priority: "always",
      reason: `Regular ${MANDATORY_INTERVAL_MINUTES}-minute repository cycle: inspect state, look for income, maintain gates, and write proofs.`
    });
  }

  return {
    cyclePolicy: "state_event_mandatory",
    definitions: {
      state: "Internal control-plane condition such as low AI budget, no income, open tasks, pending approvals, or stale memory.",
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
