#!/usr/bin/env node
/**
 * orbit-query — CLI for reading Orbit's machine-readable repository state.
 *
 * Usage:
 *   orbit-query status [repo-path]
 *   orbit-query state [repo-path]
 *   orbit-query passport [repo-path]
 *   orbit-query governance [repo-path]
 *   orbit-query budget [repo-path]
 *   orbit-query roadmap [repo-path]
 *   orbit-query tasks [--priority high|normal|low] [repo-path]
 *   orbit-query knowledge [--kind <kind>] [--tag <tag>] [--limit N] [repo-path]
 *   orbit-query capabilities [repo-path]
 *   orbit-query blocked [repo-path]
 *   orbit-query revenue [repo-path]
 *   orbit-query lanes [repo-path]
 *   orbit-query phases [repo-path]
 *   orbit-query approvals [repo-path]
 *   orbit-query files [repo-path]
 *   orbit-query check-approval <category> [repo-path]
 */

const sdk = require('./index.js');

const args = process.argv.slice(2);
const command = args[0];

function getRepoPath() {
  // Last arg is repo path if it doesn't start with --
  const last = args[args.length - 1];
  if (last && !last.startsWith('--') && last !== command) {
    // Check if it's a flag value
    const flagIndex = args.indexOf('--priority') ;
    const kindIndex = args.indexOf('--kind');
    const tagIndex = args.indexOf('--tag');
    const limitIndex = args.indexOf('--limit');
    const valueIndices = [flagIndex + 1, kindIndex + 1, tagIndex + 1, limitIndex + 1].filter(i => i > 0);
    if (!valueIndices.includes(args.length - 1)) {
      return last;
    }
  }
  return undefined;
}

function getFlag(name) {
  const idx = args.indexOf(name);
  if (idx === -1) return undefined;
  return args[idx + 1];
}

function print(obj) {
  console.log(JSON.stringify(obj, null, 2));
}

function usage() {
  console.log(`
orbit-query — Read Orbit's machine-readable repository state

Commands:
  status              Quick status summary (cycle, budget, tasks, level)
  state               Lifecycle state (cycle, born, last active)
  passport            Full agent passport (identity, capabilities, permissions)
  governance          Approval model and hard rules
  budget              AI-call budget summary with lifetime and daily spend
  roadmap             Current level, lanes, and phase checks
  tasks [--priority]  Open (or filtered) tasks
  knowledge [--kind] [--tag] [--limit]  Durable knowledge entries
  capabilities        Active capabilities from passport
  blocked             Blocked actions from passport
  revenue             Revenue policy and token status
  lanes               Active roadmap lanes
  phases              Active phase checks
  approvals           Pending approval requests
  files               Machine-readable file inventory
  check-approval <category>  Check if an action category needs approval

Options:
  --priority <level>  Filter tasks by priority (high, normal, low)
  --kind <kind>       Filter knowledge by kind
  --tag <tag>         Filter knowledge by tag
  --limit <N>         Limit results to last N entries

Examples:
  orbit-query status
  orbit-query budget /path/to/orbit/repo
  orbit-query tasks --priority high
  orbit-query knowledge --kind cycle_summary --limit 3
  orbit-query check-approval external_payment
`);
}

try {
  if (!command || command === '--help' || command === '-h') {
    usage();
    process.exit(0);
  }

  const repoPath = getRepoPath();

  switch (command) {
    case 'status':
      print(sdk.quickStatus(repoPath));
      break;

    case 'state':
      print(sdk.readState(repoPath));
      break;

    case 'passport':
      print(sdk.readPassport(repoPath));
      break;

    case 'governance':
      print(sdk.readGovernance(repoPath));
      break;

    case 'budget':
      print(sdk.budgetSummary(repoPath));
      break;

    case 'roadmap': {
      const roadmap = sdk.readRoadmap(repoPath);
      print({
        currentLevel: roadmap.currentLevel,
        activeLanes: (roadmap.lanes || []).filter(l => l.status === 'active').map(l => ({ id: l.id, name: l.name })),
        activePhaseChecks: (roadmap.phaseChecks || []).filter(p => p.status === 'active').map(p => p.phaseId),
        operatingRules: roadmap.operatingRules,
      });
      break;
    }

    case 'tasks': {
      const priority = getFlag('--priority');
      print(sdk.openTasks(repoPath, priority));
      break;
    }

    case 'knowledge': {
      const kind = getFlag('--kind');
      const tag = getFlag('--tag');
      const limitStr = getFlag('--limit');
      const limit = limitStr ? parseInt(limitStr, 10) : undefined;
      print(sdk.queryKnowledge(repoPath, { kind, tag, limit }));
      break;
    }

    case 'capabilities':
      print(sdk.activeCapabilities(repoPath));
      break;

    case 'blocked':
      print(sdk.blockedActions(repoPath));
      break;

    case 'revenue':
      print(sdk.revenueStatus(repoPath));
      break;

    case 'lanes':
      print(sdk.activeLanes(repoPath));
      break;

    case 'phases':
      print(sdk.activePhaseChecks(repoPath));
      break;

    case 'approvals':
      print(sdk.pendingApprovals(repoPath));
      break;

    case 'files':
      print(sdk.machineReadableFiles(repoPath));
      break;

    case 'check-approval': {
      const category = args[1];
      if (!category) {
        console.error('Usage: orbit-query check-approval <category> [repo-path]');
        process.exit(1);
      }
      print(sdk.checkApprovalRequired(repoPath, category));
      break;
    }

    default:
      console.error(`Unknown command: ${command}`);
      usage();
      process.exit(1);
  }
} catch (err) {
  console.error(`Error: ${err.message}`);
  process.exit(1);
}
