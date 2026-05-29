// what's actually running today. phrasing kept distinct from phases.js
// so no idea repeats across the page. no cadence claims here.

export const capabilities = [
  {
    n: '01',
    name: 'signed receipts',
    path: 'src/agent/proof-signing.js',
    status: 'live',
    desc: 'wallet-signed proofs on every operation. one signer, one verifiable chain of records.',
  },
  {
    n: '02',
    name: 'repo-native memory',
    path: 'memory/',
    status: 'live',
    desc: 'identity, tasks, knowledge, opportunities — versioned files, not a database. git is the source of truth.',
  },
  {
    n: '03',
    name: 'github intake',
    path: 'src/agent/run.js',
    status: 'live',
    desc: 'issues are commands. comments are approvals. labels are state. actions are runtime.',
  },
  {
    n: '04',
    name: 'capability registry',
    path: 'memory/infrastructure.json',
    status: 'live',
    desc: 'what an orbit can do is declared, discoverable, and machine-readable by any agent.',
  },
  {
    n: '05',
    name: 'permission boundaries',
    path: 'src/agent/governance.js',
    status: 'live',
    desc: 'sensitive moves are blocked by default. owner approval and live gates required.',
  },
  {
    n: '06',
    name: 'refusal log',
    path: 'memory/errors.jsonl',
    status: 'live',
    desc: 'unsafe requests are recorded out loud — never silenced, always auditable.',
  },
  {
    n: '07',
    name: 'intake hardening',
    path: 'src/agent/safety.js',
    status: 'live',
    desc: 'keyword scanner, drain-attempt detector, prompt-injection guard, url risk scoring.',
  },
  {
    n: '08',
    name: 'deterministic fallback',
    path: 'src/agent/inference.js',
    status: 'live',
    desc: 'when ai providers fail, a rule-based planner keeps the system delivering. no model, no excuse.',
  },
  {
    n: '09',
    name: 'public dashboard',
    path: 'src/sections/',
    status: 'live',
    desc: 'activity history, approval posture, refusal counts — served from github pages, no separate host.',
  },
  {
    n: '10',
    name: 'sdk + scaffolder',
    path: 'packages/orbit-sdk',
    status: 'live',
    desc: '@orbithouse/sdk · create-orbit-house · verifier cli — adopt the layer from a single command.',
  },
  {
    n: '11',
    name: 'closed loop',
    path: 'PLAN/SPECS/CLOSED_LOOP_DEMO.md',
    status: 'live',
    desc: 'request → approval → recorded decision → next operation obeys it. the full feedback path.',
  },
  {
    n: '12',
    name: 'budget enforcement',
    path: 'src/agent/treasury.js',
    status: 'live',
    desc: 'daily and monthly ai spend ceilings. costs visible, rate-limited at the boundary.',
  },
];
