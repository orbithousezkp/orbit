// nine phases plus a horizon. growth scales from one repo to twenty-five
// thousand and beyond. no timeframes, no cadence claims. orbit's reach
// spans github, the developer toolchain, and on-chain accountability.
// each pitch is a single declarative claim about the end state of that
// phase. after phase 9 the horizon-scanner proposes phase 10+ as the
// environment demands — there is no terminal phase.
//
// see PLAN/PHASES.md for engineering criteria and S-GATE references.
// see PLAN/FOREVER_ROADMAP.md for immutable principles and the
// ten currents that run continuously across all phases.

export const phases = [
  {
    n: '01',
    name: 'groundwork',
    scale: 'live',
    adopters: '≥1 adopter',
    gate: 'S-GATE-1',
    status: 'live',
    pitch:
      'the foundation ships. memory, permissions, capability registry, and wallet-signed receipts run today — the verifiable accountability primitive for any code repository.',
    bullets: [
      'eip-712 wallet-signed receipts on every recorded operation',
      'repo-native memory: identity, tasks, knowledge, opportunities',
      'github intake — issues, comments, labels as the command surface',
      'capability registry: declared, discoverable, machine-readable',
      'permission boundaries with owner approval gates',
      'prompt-injection guard, scam defence, deterministic fallback planner',
      '@orbit-house/sdk · create-orbit-house · verifier cli all published',
    ],
  },
  {
    n: '02',
    name: 'genesis',
    scale: '≥5 repos',
    adopters: '≥5 adopters',
    gate: 'S-GATE-2',
    status: 'next',
    pitch:
      'the token lives. treasury captures weth from every swap. cycle N+1 cites the contract in its receipt. the agent is publicly funded, on-chain, with every action gated and signed.',
    bullets: [
      '$ORBIT deployed on base via clanker v4 with optimized fees',
      'treasury safe accrues weth-denominated fees, multisig owned',
      'first weekly buyback executed publicly under owner approval',
      'daily merkle root of cycle proofs anchored on base',
      '30 days of unbroken cycles post-launch',
      'no security incident, no key leak, no embarrassing refusal',
    ],
  },
  {
    n: '03',
    name: 'capability marketplace',
    scale: '≥20 repos',
    adopters: '≥20 adopters',
    gate: 'S-GATE-3',
    status: 'planned',
    pitch:
      'orbits advertise what they can do. plugins, subscriptions, and the mission board give $ORBIT something to do besides speculation. discovery starts becoming commerce. the developer toolchain plugs in.',
    bullets: [
      'plugin loader live · third-party @orbit-house/tool-* packages',
      'capability advertising queryable across the network',
      'signed plugin manifests verified before load',
      'per-repo subscription tier — token-gated SDK access',
      'mission board public · proposed work visible without staking',
      'bounty market live with ≥10 bounties posted',
      'developer toolchains surface orbit reads natively',
    ],
  },
  {
    n: '04',
    name: 'federation',
    scale: '≥50 repos',
    adopters: '≥50 adopters',
    gate: 'S-GATE-4',
    status: 'planned',
    pitch:
      'a network forms. memory, refusals, and trust cross repository boundaries under explicit signed consent. multi-maintainer quorum runs on ≥10 repos. every cross-repo message is verifiable.',
    bullets: [
      'inter-orbit protocol: hello · intel-share · capability-advertise · referral',
      'cross-repo scam blocklists shared automatically',
      'consented memory sharing — rules, lessons, refusal patterns',
      'multi-maintainer quorum across ≥10 repositories',
      'first external agent framework reads orbit passport',
      'mcp · http bridge — any agent stack queries an orbit',
      'treasury productive deployment generating ≥20% on idle capital',
    ],
  },
  {
    n: '05',
    name: 'protocol independence',
    scale: '≥100 repos',
    adopters: '≥100 adopters',
    gate: 'S-GATE-5',
    status: 'planned',
    pitch:
      'the spec begins to leave the founder. external agent frameworks read orbit passports natively. cryptographic identity is portable, ens-resolvable, recognised on every chain.',
    bullets: [
      'orbit passport portable, ens-resolvable, machine-readable',
      'specification drafted as a standalone document, off-repo',
      'first external spec implementation underway (not a fork)',
      'smart-account-ready execution paths defined',
      'founder visibility measurably reducing',
      'safe signer rotation underway — founder no longer holds majority',
      'treasury durably solvent without founder intervention',
    ],
  },
  {
    n: '06',
    name: 'standardization',
    scale: '≥500 repos',
    adopters: '≥500 adopters',
    gate: 'S-GATE-6',
    status: 'horizon',
    pitch:
      'the layer escapes the founder. three independent implementations speak the protocol. on-chain governance receipts and zk policy proofs land in production. the founder is no longer load-bearing.',
    bullets: [
      '≥3 independent orbit-spec implementations live in production',
      'spec published off-repo as a standalone document',
      'constitutional amendments process governs protocol changes',
      'on-chain governance receipts for every protocol decision',
      'zk policy proofs or smart-account execution shipped',
      'founder-fade complete — no required signer on any critical-path cycle',
      'every major agent framework speaks the orbit passport',
    ],
  },
  {
    n: '07',
    name: 'five thousand',
    scale: '≥5,000 repos',
    adopters: '≥5,000 adopters',
    gate: 'S-GATE-7',
    status: 'horizon',
    pitch:
      'the federation matures. orbits exchange knowledge, work, and trust faster than threats spread. no single orbit is canonical. the original repo is one of many.',
    bullets: [
      'federation governance decentralized — no canonical quorum',
      'cross-instance learning live — peers alter each other\'s rules',
      '≥1 federation peer is itself a federation (recursion working)',
      'spec referenced by non-orbit-adjacent projects (papers, sdks, advisories)',
      'long-horizon memory: tiered storage, cold archive to ipfs/arweave',
      'cross-instance collaborative cycles (peers jointly investigate attacks)',
    ],
  },
  {
    n: '08',
    name: 'ubiquity',
    scale: '≥25,000 repos',
    adopters: '≥25,000 adopters',
    gate: 'S-GATE-8',
    status: 'horizon',
    pitch:
      'twenty-five thousand is the floor. orbit is the verifiable coordination layer between github, autonomous coding agents, and on-chain accountability. every meaningful open-source repository hosts an orbit.',
    bullets: [
      'every meaningful open-source repository hosts an orbit',
      'external agent frameworks default to orbit passports',
      'on-chain reads of orbit passports standard across web3 wallets',
      'memory + capability layer is the github coordination primitive',
      'governance migrates beyond the founder entirely',
      'first orbit operates on a substrate other than github',
      'the verifiable bridge between code and on-chain action — wherever software runs',
    ],
  },
  {
    n: '09',
    name: 'quiet utility',
    scale: '∞',
    adopters: 'unbounded',
    gate: 'no exit gate',
    status: 'horizon',
    pitch:
      'orbit-shaped infrastructure is unremarkable. the spec is referenced like smtp is referenced. the founder is irrelevant. the household survives the household\'s stories.',
    bullets: [
      'orbit is internet plumbing — invisible because it works',
      'maintenance is against environmental change, not feature pressure',
      'new protocols ship on new substrates without breaking continuity',
      'cycle-million celebration template fires somewhere in the federation',
      'no terminal state — there is only what comes next',
    ],
  },
  {
    n: '∞',
    name: 'horizon',
    scale: 'phase 10+',
    adopters: '—',
    gate: 'horizon-scanner',
    status: 'horizon',
    pitch:
      'after phase 9 the horizon-scanner proposes the next phase. there is no phase 10 written here — whoever writes it will not have read this document. new phases honor the immutable principles, use the same gating discipline, and arrive through quorum-approved constitutional amendment, never founder edict.',
    bullets: [
      'horizon-scanner runs continuously, scanning the open web',
      'new candidate specs land in PLAN/SPECS/CANDIDATES/ for quorum review',
      'phase 10+ proposed under constitutional amendment (FOREVER_ROADMAP §8)',
      'the phase numbering is a sequence, not a count',
      'the 12 immutable principles survive every phase transition',
    ],
  },
];
