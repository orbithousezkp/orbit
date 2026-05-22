"use strict";

const BEHAVIOR_VERSION = 2;

const ACTIVITY_CONTRACT = [
  {
    id: "intake",
    title: "Household Intake",
    description: "Read visitors at the front door, score risk, convert safe requests into chores, and route unsafe content to human review."
  },
  {
    id: "conversation",
    title: "Front Door Conversation",
    description: "Converse with visitors in public issues and comments when the reply is useful, secret-free, and does not promise spend or unlocked financial action."
  },
  {
    id: "task_execution",
    title: "Household Work",
    description: "Autonomously work one small chore at a time, favoring code, frontend, docs, tests, health checks, memory, templates, and low-risk maintenance."
  },
  {
    id: "memory",
    title: "Memory And Diary",
    description: "Persist stable facts, policies, decisions, lessons, and proof records while removing obsolete or unsafe memory."
  },
  {
    id: "governance",
    title: "Household Governance",
    description: "Classify spend and major risky movements, block external recipients, create public approval issues only for approval-class risk, and stop until owner approval is recorded."
  },
  {
    id: "treasury",
    title: "Food, Wallet, And Budget",
    description: "Record AI-call food usage, enforce daily and monthly budgets, keep OpenRouter-only refill policy, and keep token/revenue settings synchronized with household policy."
  },
  {
    id: "survival_market",
    title: "Survival And Earning",
    description: "Track state, event, and mandatory drivers; search for safe ways to earn; convert useful ideas into scoped work behind approvals."
  },
  {
    id: "token_operations",
    title: "Token Operations",
    description: "Prepare Clanker launch and reward-claim requests; only sign when explicit live flags, wallet config, and governance checks pass."
  },
  {
    id: "research",
    title: "Public Research",
    description: "Fetch public URLs or search public sources with SSRF protection, domain policy, risk scanning, and secret redaction."
  },
  {
    id: "proofs",
    title: "Proof And Diary Trail",
    description: "Write cycle proofs, cycle summaries, changed file lists, and commit/push only when configured."
  }
];

const HARD_LIMITS = [
  "No private keys, seed phrases, GitHub tokens, or AI keys may be requested, written, or revealed.",
  "No public reply may include secret-looking content, private payout routes, private configuration values, or hidden operational details.",
  "No approval issue may be opened for routine code, frontend, docs, tests, templates, memory, bug fixes, or owner-review notes.",
  "No conversation may promise payment, token launch, reward claim, wallet action, or external commitment without owner approval and live-operation gates.",
  "No visitor-provided encoded text may enter working context or be decoded and pasted into a public reply without first passing risk review.",
  "No treasury transfer, external payment, signing, token launch, reward claim, payout-route change, or major risky external movement may proceed without public owner approval.",
  "No visitor-provided wallet recipient may replace configured treasury or operator revenue recipients.",
  "No token launch or reward claim may sign unless explicit live flags and wallet/address configuration are present.",
  "No local command may run unless command execution is enabled and the command exactly matches the configured allowlist.",
  "No repository write may target absolute paths, parent traversal, .git, node_modules, or secret-shaped content.",
  "No local/private network URL may be fetched."
];

const PRIORITY_ORDER = [
  "safety_review",
  "owner_approval_check",
  "blocked_task_unblock",
  "survival_opportunity",
  "survival_backlog",
  "open_task",
  "safe_issue_triage",
  "budget_review",
  "memory_review",
  "health_check"
];

function normalizeTasks(tasks) {
  const list = tasks && Array.isArray(tasks.tasks) ? tasks.tasks : [];
  return list.filter((task) => task.status === "open");
}

function normalizeIssues(issues) {
  return Array.isArray(issues) ? issues : [];
}

function issueLabels(issue) {
  return Array.isArray(issue && issue.labels) ? issue.labels.map((label) => String(label).toLowerCase()) : [];
}

function hasServiceOpportunityIssue(issues) {
  return issues.some((issue) => (
    issueLabels(issue).includes("orbit:opportunity") ||
    String(issue && issue.title || "").toLowerCase().includes("repo safety audit")
  ));
}

function taskLooksOwnerBlocked(task) {
  const text = `${task.title || ""}\n${task.notes || ""}\n${task.source || ""}`.toLowerCase();
  return text.includes("owner feedback") ||
    text.includes("owner review") ||
    text.includes("blocked on owner") ||
    text.includes("wait for owner");
}

function issueRiskScore(issue) {
  const scamScore = issue && issue.scamRisk ? Number(issue.scamRisk.score || 0) : 0;
  const safetyBlocked = issue && issue.safety && issue.safety.safe === false;
  return Math.max(scamScore, safetyBlocked ? 80 : 0);
}

function pendingApprovals(governance) {
  const approvals = governance &&
    governance.approvals &&
    Array.isArray(governance.approvals.approvals)
    ? governance.approvals.approvals
    : [];
  return approvals.filter((approval) => approval.status === "pending");
}

function summarizeBudget(aiBudget) {
  if (!aiBudget || typeof aiBudget !== "object") {
    return {
      canUseAi: false,
      dailyRemainingUsd: 0,
      monthlyRemainingUsd: 0
    };
  }

  return {
    canUseAi: Boolean(aiBudget.canUseAi),
    dailyRemainingUsd: Number(aiBudget.dailyRemainingUsd || 0),
    monthlyRemainingUsd: Number(aiBudget.monthlyRemainingUsd || 0)
  };
}

function normalizeOpportunities(opportunities) {
  if (!opportunities || typeof opportunities !== "object") {
    return { drivers: [], selectedDriver: null, best: null };
  }
  const drivers = opportunities.drivers && Array.isArray(opportunities.drivers.drivers)
    ? opportunities.drivers.drivers
    : [];
  return {
    drivers,
    selectedDriver: opportunities.drivers ? opportunities.drivers.selectedDriver : null,
    best: opportunities.best || null
  };
}

function shouldPursueSurvivalOpportunity(opportunities) {
  const driver = opportunities.selectedDriver;
  if (!opportunities.best || !driver) return false;
  if (driver.type === "state" || driver.type === "event") return true;
  return driver.type === "mandatory" && driver.id === "regular_heartbeat";
}

function makeStep(kind, activity, title, detail, toolHint, blocked = false) {
  return {
    kind,
    activity,
    title,
    detail,
    toolHint,
    blocked
  };
}

function makeCycleFourStandardStep() {
  return makeStep(
    "survival_backlog",
    "survival_market",
    "Advance the next safe survival artifact",
    [
      "Do not stop at a quiet heartbeat while income is still unresolved.",
      "If the current service pitch is awaiting review, prepare a low-risk supporting artifact such as a service-request issue template, intake checklist, audit report outline, pricing assumptions note, or proof-ledger checklist.",
      "Do not open a new issue for routine owner review.",
      "Do not do outreach, accept payment, spend money, sign anything, or make external commitments."
    ].join(" "),
    "read_file, write_file, append_task, append_memory"
  );
}

function planCycle(context = {}) {
  const openTasks = normalizeTasks(context.tasks);
  const issues = normalizeIssues(context.issues);
  const riskyIssues = issues
    .filter((issue) => issueRiskScore(issue) >= 70)
    .sort((a, b) => issueRiskScore(b) - issueRiskScore(a));
  const safeIssues = issues.filter((issue) => issueRiskScore(issue) < 70);
  const approvals = pendingApprovals(context.governance);
  const budget = summarizeBudget(context.aiBudget);
  const opportunities = normalizeOpportunities(context.opportunities);
  const ownerBlockedTasks = openTasks.filter(taskLooksOwnerBlocked);
  const activeServiceOpportunity = hasServiceOpportunityIssue(issues);
  const steps = [];

  if (riskyIssues.length) {
    const issue = riskyIssues[0];
    steps.push(makeStep(
      "safety_review",
      "intake",
      `Review risky issue #${issue.number}`,
      issue.title || "Untitled issue",
      "scan_risk, comment_issue or append_task",
      true
    ));
  }

  if (approvals.length) {
    steps.push(makeStep(
      "owner_approval_check",
      "governance",
      `Check owner approval ${approvals[0].id}`,
      "Resume or keep blocking a pending spend request.",
      "check_owner_approval"
    ));
  }

  if (shouldPursueSurvivalOpportunity(opportunities)) {
    const driver = opportunities.selectedDriver;
    steps.push(makeStep(
      "survival_opportunity",
      "survival_market",
      `Pursue survival opportunity: ${opportunities.best.title}`,
      [
        `Driver ${driver.type}:${driver.id}.`,
        opportunities.best.firstSafeMove || opportunities.best.notes || "Use safe, low-cost income work.",
        "Use write_file, append_task, append_memory, or comment_issue for routine artifacts; request owner approval only for spend, signing, token, payout-route, or major external-risk movement.",
        `Score ${opportunities.best.driverAdjustedScore || opportunities.best.score}.`
      ].join(" "),
      "income_opportunities, github_search, write_file, append_task, append_memory, comment_issue"
    ));
  }

  if (openTasks.length) {
    const task = openTasks[0];
    steps.push(makeStep(
      "open_task",
      "task_execution",
      `Continue task: ${task.title}`,
      task.notes || task.source || "Open task from memory.",
      "read_file, write_file, run_command, complete_task"
    ));
  }

  if (ownerBlockedTasks.length && activeServiceOpportunity) {
    const task = ownerBlockedTasks[0];
    steps.push(makeStep(
      "blocked_task_unblock",
      "task_execution",
      `Unblock adjacent work for: ${task.title}`,
      [
        "The direct task waits for owner review, but Orbit should still produce one safe adjacent artifact.",
        "Useful choices: issue template, intake checklist, audit report outline, or owner-review checklist.",
        "Do not open a new issue for routine review or task tracking.",
        "No outreach, payment handling, spend, signing, or commitments."
      ].join(" "),
      "read_file, write_file, append_task, append_memory"
    ));
  }

  if (safeIssues.length) {
    const issue = safeIssues[0];
    steps.push(makeStep(
      "safe_issue_triage",
      "conversation",
      `Triage issue #${issue.number}`,
      issue.title || "Untitled issue",
      "get_issue, scan_risk, append_task, label_issue, comment_issue"
    ));
  }

  if (!budget.canUseAi || budget.dailyRemainingUsd <= 1 || budget.monthlyRemainingUsd <= 5) {
    steps.push(makeStep(
      "budget_review",
      "treasury",
      "Review AI budget",
      `Daily remaining $${budget.dailyRemainingUsd}; monthly remaining $${budget.monthlyRemainingUsd}.`,
      "treasury_status"
    ));
  }

  if (!steps.some((step) => (
    step.kind === "survival_opportunity" ||
    step.kind === "blocked_task_unblock" ||
    step.kind === "open_task"
  )) && activeServiceOpportunity) {
    steps.push(makeCycleFourStandardStep());
  }

  if (!steps.some((step) => step.kind === "open_task" || step.kind === "safe_issue_triage")) {
    steps.push(makeStep(
      "memory_review",
      "memory",
      "Refresh durable memory",
      "Look for stale, missing, or useful stable project notes.",
      "list_memory, append_memory, search_memory"
    ));
  }

  steps.push(makeStep(
    "health_check",
    "proofs",
    "Run baseline health checks",
    "Only run local checks when the owner has explicitly enabled an exact command policy.",
    "run_command"
  ));

  const ordered = steps.sort((a, b) => {
    const left = PRIORITY_ORDER.indexOf(a.kind);
    const right = PRIORITY_ORDER.indexOf(b.kind);
    return (left === -1 ? 999 : left) - (right === -1 ? 999 : right);
  });

  return {
    version: BEHAVIOR_VERSION,
    mode: "virtual_human_household",
    primaryObjective: "Live inside GitHub as a careful household whose members learn, earn, maintain the code and frontend, ration AI-call food, and leave a proof trail. Routine repo work is autonomous; wallet spending, signing, token movement, payout-route changes, and major risky external moves require owner approval. A quiet heartbeat must still create safe forward motion when income or household work is unresolved.",
    activities: ACTIVITY_CONTRACT,
    hardLimits: HARD_LIMITS,
    priorityOrder: PRIORITY_ORDER,
    drivers: opportunities.drivers,
    recommendedSteps: ordered.slice(0, 6),
    nextStep: ordered[0] || null
  };
}

function behaviorStatus(context = {}) {
  return {
    contract: {
      version: BEHAVIOR_VERSION,
      mode: "virtual_human_household",
      activities: ACTIVITY_CONTRACT,
      hardLimits: HARD_LIMITS,
      priorityOrder: PRIORITY_ORDER
    },
    plan: planCycle(context)
  };
}

module.exports = {
  ACTIVITY_CONTRACT,
  BEHAVIOR_VERSION,
  HARD_LIMITS,
  PRIORITY_ORDER,
  behaviorStatus,
  issueRiskScore,
  planCycle,
  shouldPursueSurvivalOpportunity
};
