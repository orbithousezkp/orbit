// seven phases. growth scales 500 → 25,000+ adopter repositories.
// no timeframes, no cadence claims. orbit's reach spans github, the
// developer toolchain, and on-chain accountability. each pitch is a
// single declarative claim about the end state of that phase.

export const phases = [
  {
    n: '01',
    name: 'groundwork',
    scale: 'live',
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
      '@orbit-house/sdk · create-orbit-repo · verifier cli all published',
    ],
  },
  {
    n: '02',
    name: 'five hundred',
    scale: '500 repos',
    status: 'next',
    pitch:
      'the layer escapes the founder. five hundred repositories run orbit as their agent control surface — and the standard for verifiable repo automation begins to form.',
    bullets: [
      'one-command bootstrap with opinionated defaults',
      'adoption checklist tooling enforced before activation',
      'public ledger of activity across adopter repos',
      'documentation hardens — every memory file gets a reference',
      'first cross-repo refusal sharing arrives',
      'developer-tool integrations begin (vscode, cursor, claude code)',
    ],
  },
  {
    n: '03',
    name: 'capability marketplace',
    scale: '1,500 repos',
    status: 'planned',
    pitch:
      'orbits advertise what they can do and trade capabilities across the network. discovery becomes commerce. the developer toolchain plugs in.',
    bullets: [
      'plugin loader live · third-party @orbit-house/tool-* packages',
      'capability advertising queryable across the network',
      'signed plugin manifests verified before load',
      'developer toolchains surface orbit reads natively',
      'independent plugin authors ship in volume',
      'premium capability patterns emerge for paid plugins',
    ],
  },
  {
    n: '04',
    name: 'federation',
    scale: '5,000 repos',
    status: 'planned',
    pitch:
      'a network forms. memory, refusals, and trust cross repository boundaries under explicit signed consent. every cross-repo message is verifiable.',
    bullets: [
      'inter-orbit protocol: hello · intel-share · capability-advertise · referral',
      'cross-repo scam blocklists shared automatically',
      'consented memory sharing — rules, lessons, refusal patterns',
      'multi-maintainer quorum across N repositories',
      'federated learning of refusal categories',
      'on-chain anchoring of federation receipts',
    ],
  },
  {
    n: '05',
    name: 'protocol independence',
    scale: '10,000 repos',
    status: 'planned',
    pitch:
      'the spec leaves the founder. external agent frameworks read orbit passports natively. cryptographic identity is portable, ens-resolvable, recognised on every chain.',
    bullets: [
      'mcp · http bridge — any agent stack queries an orbit',
      'orbit passport portable, ens-resolvable, machine-readable',
      'specification published off-repo as a standalone document',
      'first external agent frameworks integrate orbit reads',
      'smart-account-ready execution paths defined',
      'founder visibility measurably reducing',
    ],
  },
  {
    n: '06',
    name: 'standardization',
    scale: '20,000 repos',
    status: 'planned',
    pitch:
      'three independent implementations speak the protocol. on-chain governance receipts and zk policy proofs land in production. the orbit way is the only way the new internet ships.',
    bullets: [
      '≥3 independent orbit-spec implementations live in production',
      'constitutional amendments process governs protocol changes',
      'on-chain governance receipts for every protocol decision',
      'zk policy proofs for verifiable enforcement',
      'every major framework speaks the orbit passport',
      'the protocol is the operating contract for autonomous repos',
    ],
  },
  {
    n: '07',
    name: 'ubiquity',
    scale: '25,000+ repos',
    status: 'horizon',
    pitch:
      'twenty-five thousand is the floor. orbit is the verifiable coordination layer between github, autonomous coding agents, and on-chain accountability. the founder is irrelevant. the spec outlives every contributor.',
    bullets: [
      'every meaningful open-source repository hosts an orbit',
      'external agent frameworks default to orbit passports',
      'on-chain reads of orbit passports standard across web3 wallets',
      'memory + capability layer is the github coordination primitive',
      'governance migrates beyond the founder entirely',
      'the verifiable bridge between code and on-chain action — wherever software runs',
    ],
  },
];
