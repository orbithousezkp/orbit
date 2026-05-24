"use strict";

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { planCycle } = require("./behavior");
const { GitHubClient } = require("./github");
const { learningLabStatus } = require("./learning-lab");
const { listMemory } = require("./memory");
const { opportunityStatus } = require("./opportunities");
const { infrastructureStatus } = require("./infrastructure");
const { walletStatus } = require("./wallet");
const { roadmapStatus } = require("./roadmap");
const { loadTasks } = require("./tasks");
const { prepareClankerLaunch } = require("./clanker");
const { featureSummary } = require("./features");
const { governanceStatus } = require("./governance");
const { normalizeTrigger, triggerPolicy } = require("./triggers");
const { omitUnsafeVisitorContent, scanTextRisk } = require("./scam");
const { budgetStatus, loadTreasury } = require("./treasury");
const { readSafeTextFile, redactSecrets, scoreIssueSafety } = require("./safety");
const { privateAiRoutes } = require("./provider-privacy");

const CONTEXT_FILE_LIMIT = 120;

function readIfExists(repoRoot, relativePath, fallback = "") {
  try {
    return readSafeTextFile(repoRoot, relativePath);
  } catch {
    return fallback;
  }
}

function listFiles(repoRoot) {
  if (fs.existsSync(path.resolve(repoRoot, ".git"))) {
    try {
      return execFileSync("git", ["ls-files"], {
        cwd: repoRoot,
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "ignore"]
      })
        .trim()
        .split("\n")
        .filter(Boolean);
    } catch {
      return [];
    }
  }

  const result = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if ([".git", "node_modules"].includes(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else result.push(path.relative(repoRoot, full).replace(/\\/g, "/"));
    }
  };
  walk(repoRoot);
  return result.sort();
}

function recentCommits(repoRoot) {
  if (!fs.existsSync(path.resolve(repoRoot, ".git"))) {
    return "no git history";
  }
  try {
    return execFileSync("git", ["log", "--oneline", "-8"], {
      cwd: repoRoot,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"]
    }).trim();
  } catch {
    return "";
  }
}

function gitStatus(repoRoot) {
  if (!fs.existsSync(path.resolve(repoRoot, ".git"))) {
    return "no git repository";
  }
  try {
    return execFileSync("git", ["status", "--short"], {
      cwd: repoRoot,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"]
    }).trim();
  } catch {
    return "";
  }
}

function summarizeIssues(issues) {
  return issues.map((issue) => {
    const title = issue.title || "";
    const body = issue.body || "";
    const titleRisk = scanTextRisk(title);
    const bodyRisk = scanTextRisk(body);
    const scamRisk = scanTextRisk(`${title}\n${body}`);
    const safety = scoreIssueSafety(issue);
    return {
      ...issue,
      title: omitUnsafeVisitorContent(redactSecrets(title), titleRisk),
      body: omitUnsafeVisitorContent(redactSecrets(body), bodyRisk).slice(0, 2000),
      safety,
      scamRisk
    };
  });
}

async function gatherContext(config) {
  const github = new GitHubClient(config);
  const files = listFiles(config.repoRoot);
  let issues = [];
  let issueError = null;

  try {
    issues = await github.listIssues({ perPage: 25 });
  } catch (error) {
    issueError = error.message;
  }

  const context = {
    brandName: config.brandName,
    cycleConfig: {
      dryRun: config.dryRun,
      commitChanges: config.commitChanges,
      pushChanges: config.pushChanges,
      maxSteps: config.maxSteps,
      aiRoute: {
        configured: config.aiProviders.length > 0,
        count: config.aiProviders.length,
        routes: privateAiRoutes(config.aiProviders)
      },
      githubConfigured: github.configured(),
      trigger: normalizeTrigger(config),
      triggerPolicy: triggerPolicy()
    },
    files: files.slice(0, CONTEXT_FILE_LIMIT),
    fileCount: files.length,
    status: gitStatus(config.repoRoot),
    recentCommits: recentCommits(config.repoRoot),
    identity: readIfExists(config.repoRoot, "memory/identity.md"),
    strategy: readIfExists(config.repoRoot, "memory/strategy.md"),
    state: readIfExists(config.repoRoot, "memory/state.json", "{}"),
    tasks: loadTasks(config.repoRoot),
    knowledge: listMemory(config.repoRoot, { limit: 12 }),
    treasury: loadTreasury(config.repoRoot, config),
    governance: governanceStatus(config),
    infrastructure: infrastructureStatus(config.repoRoot),
    wallet: walletStatus(config.repoRoot),
    roadmap: roadmapStatus(config.repoRoot),
    features: featureSummary(),
    aiBudget: budgetStatus(config),
    tokenLaunch: prepareClankerLaunch(config),
    issues: summarizeIssues(issues),
    issueError
  };

  context.opportunities = opportunityStatus(config.repoRoot, context);
  context.learningLab = learningLabStatus(config.repoRoot);
  context.behaviorPlan = planCycle(context);
  return context;
}

module.exports = {
  gatherContext,
  gitStatus,
  listFiles,
  readIfExists
};
