#!/usr/bin/env node
/**
 * Orbit CLI — Query Orbit's state from the command line.
 *
 * Usage:
 *   orbit status [--repo /path/to/repo]
 *   orbit budget [--repo /path/to/repo]
 *   orbit capabilities [--repo /path/to/repo]
 *   orbit tasks [--repo /path/to/repo]
 *   orbit blocked [--repo /path/to/repo]
 *   orbit opportunities [--repo /path/to/repo] [--limit 5]
 *   orbit latest-cycle [--repo /path/to/repo]
 *   orbit health [--repo /path/to/repo]
 *   orbit files [--repo /path/to/repo]
 *
 * Cycle 92 direction choice:
 * - Compared build, infrastructure, earn, sustain, and grow.
 * - Selected infrastructure/build because the SDK CLI is an adoption surface and
 *   its public budget command needed to enforce the shared toolkit safety
 *   contract without changing wallet, token, publishing, or external behavior.
 */

const path = require('path');
const { create } = require('./index');

function parseArgs(argv) {
  const args = { command: null, repo: process.cwd(), limit: 5 };
  let i = 2;
  while (i < argv.length) {
    const arg = argv[i];
    if (arg === '--repo' || arg === '-r') {
      args.repo = argv[++i];
    } else if (arg === '--limit' || arg === '-l') {
      args.limit = parseInt(argv[++i], 10) || 5;
    } else if (arg === '--help' || arg === '-h') {
      args.command = 'help';
    } else if (!args.command) {
      args.command = arg;
    }
    i++;
  }
  return args;
}

function printJson(obj) {
  console.log(JSON.stringify(obj, null, 2));
}

function budgetLevel(summary) {
  if (!summary || summary.canUseAi === false) return 'exhausted';

  const dailyLimit = Number(summary.dailyBudgetUsd || 0);
  const monthlyLimit = Number(summary.monthlyBudgetUsd || 0);
  const dailyRemaining = Number(summary.dailyRemainingUsd || 0);
  const monthlyRemaining = Number(summary.monthlyRemainingUsd || 0);

  const ratios = [];
  if (dailyLimit > 0) ratios.push(dailyRemaining / dailyLimit);
  if (monthlyLimit > 0) ratios.push(monthlyRemaining / monthlyLimit);
  const lowestRatio = ratios.length ? Math.min(...ratios) : 1;

  if (lowestRatio <= 0) return 'exhausted';
  if (lowestRatio <= 0.1) return 'critical';
  if (lowestRatio <= 0.25) return 'low';
  return 'ok';
}

function publicBudgetSummary(sdk) {
  const summary = sdk.budgetSummary();
  return {
    status: budgetLevel(summary),
    canUseAi: Boolean(summary.canUseAi),
    policy: 'public_safe_status_only',
    note: 'Detailed inference spend and remaining budget amounts are intentionally omitted from CLI output.',
  };
}

function help() {
  console.log(`
Orbit CLI — Query Orbit's machine-readable state.

Commands:
  status          Quick status summary (cycle, level, tasks, budget status)
  budget          Public-safe AI-call budget status only
  capabilities    Active and planned capabilities
  tasks           Open and blocked tasks
  blocked         Wallet and external action restrictions
  opportunities   Top earning opportunities by score
  latest-cycle    Most recent cycle note
  health          Verify that expected files exist and are parseable
  files           List all machine-readable file paths

Options:
  --repo, -r      Path to Orbit repo (default: current directory)
  --limit, -l     Number of items to show (default: 5)
  --help, -h      Show this help message

Safety:
  Budget output is intentionally limited to ok/low/critical/exhausted style
  status. Do not publish detailed inference-spend figures, remaining budget
  amounts, provider routes, billing routes, or private operational details.
`.trim());
}

function main() {
  const args = parseArgs(process.argv);

  if (args.command === 'help' || !args.command) {
    help();
    process.exit(args.command ? 0 : 1);
  }

  const sdk = create(args.repo);

  switch (args.command) {
    case 'status':
      printJson(sdk.quickStatus());
      break;

    case 'budget':
      printJson(publicBudgetSummary(sdk));
      break;

    case 'capabilities': {
      const caps = sdk.getCapabilities();
      printJson({
        active: caps.active.map(c => ({ id: c.id, name: c.name, mode: c.mode })),
        planned: caps.planned.map(c => ({ id: c.id, name: c.name, mode: c.mode })),
      });
      break;
    }

    case 'tasks':
      printJson(sdk.getOpenTasks());
      break;

    case 'blocked':
      printJson(sdk.getBlockedActions());
      break;

    case 'opportunities': {
      const opps = sdk.getTopOpportunities(args.limit);
      printJson(opps.map(o => ({
        id: o.id,
        title: o.title,
        score: o.driverAdjustedScore || o.score,
        status: o.status,
        risk: o.risk,
        approvalRequired: o.approvalRequired,
      })));
      break;
    }

    case 'latest-cycle':
      printJson(sdk.getLatestCycle());
      break;

    case 'health':
      printJson(sdk.healthCheck());
      break;

    case 'files':
      printJson(sdk.getFileList());
      break;

    default:
      console.error(`Unknown command: ${args.command}`);
      help();
      process.exit(1);
  }
}

main();
