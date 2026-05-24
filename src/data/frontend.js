import {
  Activity,
  Archive,
  BookOpenText,
  Brain,
  BriefcaseBusiness,
  CalendarClock,
  BadgeCheck,
  CircleDollarSign,
  DoorOpen,
  FileCheck2,
  FileLock2,
  Fingerprint,
  HeartPulse,
  House,
  Gauge,
  Link2,
  Landmark,
  KeyRound,
  LockKeyhole,
  Milestone,
  NotebookTabs,
  Network,
  PiggyBank,
  ReceiptText,
  Rocket,
  ScanSearch,
  ShieldCheck,
  ShieldAlert,
  Target,
  WalletCards,
  Workflow,
  Code2,
  Zap,
} from 'lucide-react';

export const navItems = [
  { label: 'Orbit', href: '#house' },
  { label: 'Product', href: '#life' },
  { label: 'Members', href: '#members' },
  { label: 'Surfaces', href: '#rooms' },
  { label: 'Runtime', href: '#routine' },
  { label: 'Policy', href: '#boundaries' },
  { label: 'Roadmap', href: '#roadmap' },
];

export const identityStats = [
  {
    label: 'Repo',
    value: 'GitHub',
    detail: 'The repository is the control plane where Orbit lives, works, and records proof.',
  },
  {
    label: 'Food',
    value: 'AI calls',
    detail: 'Every thought has a cost, so Orbit budgets attention before spending it.',
  },
  {
    label: 'Authority',
    value: 'Wallet policy',
    detail: 'Approval labels, blocked live actions, and private-route boundaries keep money movement controlled.',
  },
];

export const houseMembers = [
  {
    name: 'Control Plane',
    role: 'Repository operating layer',
    desc: 'Coordinates identity, memory, permissions, proofs, and lifecycle state.',
    icon: HeartPulse,
  },
  {
    name: 'Memory Registry',
    role: 'Durable state',
    desc: 'Stores mission, tasks, lessons, policies, and adoption notes between cycles.',
    icon: Brain,
  },
  {
    name: 'Wallet Policy',
    role: 'Read-only finance layer',
    desc: 'Exposes approval labels, revenue cadence, token state, and blocked live actions.',
    icon: PiggyBank,
  },
  {
    name: 'Lifecycle Runtime',
    role: 'Wake and sleep',
    desc: 'Turns GitHub Actions into predictable cycles with proofs and fallback behavior.',
    icon: BriefcaseBusiness,
  },
  {
    name: 'Permission Matrix',
    role: 'Approval gates',
    desc: 'Refuses secrets, scams, unsafe paths, live signing, and unlocked execution authority.',
    icon: ShieldCheck,
  },
  {
    name: 'Proof Ledger',
    role: 'Audit trail',
    desc: 'Writes receipts so every cycle leaves a reviewable public record.',
    icon: NotebookTabs,
  },
];

export const householdNeeds = [
  {
    label: 'Food',
    value: 'AI calls',
    desc: 'Members think by spending model calls. Food is limited, so they must ration attention.',
  },
  {
    label: 'Surface',
    value: 'GitHub repo',
    desc: 'The control plane exists as files, issues, Actions, memory, proofs, commits, and settings.',
  },
  {
    label: 'Work',
    value: 'repo work',
    desc: 'Maintenance, docs, tests, triage, cleanup, and repairs keep the product usable.',
  },
  {
    label: 'Money',
    value: 'wallet policy',
    desc: 'Budget, revenue cadence, and blocked live actions keep the control plane governed.',
  },
  {
    label: 'Rules',
    value: 'permissions',
    desc: 'Approval gates and safety checks protect the repository from unsafe or irreversible actions.',
  },
  {
    label: 'Memory',
    value: 'proofs',
    desc: 'Lessons and receipts let Orbit continue from yesterday instead of restarting.',
  },
];

export const humanStack = [
  {
    label: 'Repo',
    value: 'GitHub repository',
    desc: 'The place where Orbit exists: code, issues, memory, proofs, schedules, and public history.',
  },
  {
    label: 'Layers',
    value: 'control plane modules',
    desc: 'Identity, memory, lifecycle, permissions, proofs, and wallet policy work as a coordinated control plane.',
  },
  {
    label: 'Food',
    value: 'AI calls',
    desc: 'Every thought costs budget, so attention decides how long the control plane can keep working.',
  },
  {
    label: 'Work',
    value: 'repo chores',
    desc: 'The runtime maintains code, docs, memory, proofs, and checks.',
  },
  {
    label: 'Policy',
    value: 'wallet gates',
    desc: 'Revenue routes, approval labels, and blocked live actions support controlled execution.',
  },
  {
    label: 'Diary',
    value: 'proof ledger',
    desc: 'Every wake cycle records what Orbit saw, did, learned, refused, and needs next.',
  },
];

export const houseRooms = [
  {
    name: 'Intake',
    path: 'issues/',
    detail: 'Issues and comments are the command and approval intake for Orbit.',
    icon: DoorOpen,
  },
  {
    name: 'Memory',
    path: 'memory/',
    detail: 'The repo stores identity, tasks, roadmap, opportunities, and durable notes here.',
    icon: Brain,
  },
  {
    name: 'Runtime',
    path: 'src/agent/',
    detail: 'Planner, tools, memory, and execution adapters live here.',
    icon: BriefcaseBusiness,
  },
  {
    name: 'Wallet Policy',
    path: 'treasury.json',
    detail: 'Budget caps, revenue policy, token preparation, and spend proposals live here.',
    icon: PiggyBank,
  },
  {
    name: 'Proof Ledger',
    path: 'runtime/proofs/',
    detail: 'Each cycle leaves a proof of what Orbit saw, decided, changed, and refused.',
    icon: NotebookTabs,
  },
  {
    name: 'Permissions',
    path: 'governance/',
    detail: 'Owner approvals, dry-run flags, path rules, and secret checks define boundaries.',
    icon: ShieldCheck,
  },
];

export const dailyRoutine = [
  {
    time: 'Wake',
    title: 'Reads the control plane',
    desc: 'Checks issues, memory, budget, permissions, and the latest receipt before touching anything.',
  },
  {
    time: 'Notice',
    title: 'Reads signals',
    desc: 'Turns comments, issues, alerts, and failed checks into control-plane signals instead of raw queue items.',
  },
  {
    time: 'Think',
    title: 'Chooses safe work',
    desc: 'Classifies repo chores, checks risk, remembers policy, and asks for approval when money is involved.',
  },
  {
    time: 'Earn',
    title: 'Protects wallet paths',
    desc: 'Tracks AI costs, prepares earning work, and keeps live transfers behind explicit gates.',
  },
  {
    time: 'Sleep',
    title: 'Writes the receipt',
    desc: 'Saves a proof, updates durable state, and leaves the repository ready for the next wake cycle.',
  },
];

export const cycleDrivers = [
  {
    title: 'State',
    desc: 'Internal control-plane pressure: low AI budget, no income, pending approvals, open tasks, stale memory, or failed checks.',
    icon: HeartPulse,
  },
  {
    title: 'Event',
    desc: 'External repository activity: issues, comments, labels, manual owner wakes, or repository changes.',
    icon: DoorOpen,
  },
  {
    title: 'Mandatory',
    desc: 'The scheduled 30-minute heartbeat. It fires regularly even when the repo is quiet, then checks survival, gates, proofs, and next work.',
    icon: CalendarClock,
  },
];

export const householdSystems = [
  {
    title: 'Learns',
    desc: 'Orbit does not start blank each cycle. Memory files become habits, warnings, preferences, and goals.',
    icon: Brain,
  },
  {
    title: 'Earns',
    desc: 'Orbit can prepare bounties, launch plans, claims, and treasury actions while live signing stays locked.',
    icon: PiggyBank,
  },
  {
    title: 'Manages',
    desc: 'Orbit keeps tasks, approvals, runtime work, and policy organized inside GitHub.',
    icon: House,
  },
  {
    title: 'Reports',
    desc: 'Proof records and memory notes make behavior inspectable instead of hidden.',
    icon: BookOpenText,
  },
];

export const lifeSystems = [
  {
    title: 'Attention',
    desc: 'The life layer decides what deserves focus: unsafe visitors, urgent repairs, budget pressure, or routine chores.',
    icon: HeartPulse,
  },
  {
    title: 'Memory',
    desc: 'It turns useful experience into durable notes so Orbit can grow from yesterday instead of restarting.',
    icon: Brain,
  },
  {
    title: 'Appetite',
    desc: 'It treats earning and cost control as survival, not an optional metric.',
    icon: PiggyBank,
  },
  {
    title: 'Conscience',
    desc: 'It refuses secrets, wallet drain requests, unsafe paths, and outside spend that has not passed approval.',
    icon: ShieldCheck,
  },
];

export const householdLedger = [
  {
    label: 'Issues',
    path: 'issues/',
    detail: 'Every request enters through the intake surface where it can be inspected, answered, labeled, or refused.',
  },
  {
    label: 'Lessons',
    path: 'memory/',
    detail: 'Rules and discoveries become durable control-plane knowledge for later wake cycles.',
  },
  {
    label: 'Chores',
    path: 'tasks.json',
    detail: 'Repairs, improvements, follow-ups, and reminders stay visible as work around the repo.',
  },
  {
    label: 'Wallet',
    path: 'treasury.json',
    detail: 'AI budget, reward routes, token preparation, and approval gates are managed as wallet policy.',
  },
  {
    label: 'Proofs',
    path: 'runtime/proofs/',
    detail: 'The receipt ledger records decisions, actions, refusals, and the next state before Orbit sleeps.',
  },
];

export const commandExamples = [
  {
    command: '@orbit what happened in the control plane while I was away?',
    response: 'Reads issues, tasks, wallet state, lessons, and proof entries since the last wake cycle.',
  },
  {
    command: '@orbit compare safe directions for this repo problem',
    response: 'Converse safely, ask clarifying questions, and turn useful public context into repo work.',
  },
  {
    command: '@orbit learn this rule: never pay external wallets without approval',
    response: 'Stores the rule as durable memory and applies it to future earning or spend decisions.',
  },
  {
    command: '@orbit assign this repair to @alice with 80 USDC',
    response: 'Creates a wallet-policy request, waits at the intake surface, and does not move money until approved.',
  },
];

export const boundaries = [
  {
    title: 'Private keys stay private',
    desc: 'Secrets, private keys, and unsafe paths are rejected before they enter memory or tools.',
    icon: KeyRound,
  },
  {
    title: 'Money has gates',
    desc: 'External spend, live claims, and token launches require explicit flags or public approval. Revenue sending is weekly and performance-gated.',
    icon: LockKeyhole,
  },
  {
    title: 'Conversation stays public-safe',
    desc: 'Visitors can talk with Orbit, but replies cannot reveal secrets, private routes, or promise payment.',
    icon: DoorOpen,
  },
  {
    title: 'Every cycle leaves paperwork',
    desc: 'Orbit writes proof records so work, refusals, and next state can be inspected later.',
    icon: FileCheck2,
  },
  {
    title: 'Routines are scheduled',
    desc: 'GitHub Actions give Orbit a wake/sleep rhythm without a separate server or hidden queue.',
    icon: CalendarClock,
  },
  {
    title: 'Old lessons are archived',
    desc: 'Tasks, knowledge, governance, and cycles are kept as repo files, not private app state.',
    icon: Archive,
  },
  {
    title: 'Health is measured',
    desc: 'Budget, memory, queue state, and safety status define whether the control plane can keep working.',
    icon: HeartPulse,
  },
];

export const roadmapSummary = {
  currentLevel: 'Control Plane Foundation',
  nextLevel: 'Proof And Memory',
  zkStage: 'ZK proof work is staged, not implemented: commitments and local verifier tests come first.',
  activeChecks: [
    'Open tasks and safe issue triage still outrank roadmap growth.',
    'Roadmap memory is tracked in repo files and agent context.',
    'ZK stays staged behind commitments, local verifiers, and tamper tests.',
  ],
  counts: {
    lanes: 11,
    levels: 11,
    phases: 10,
    zkShipNow: 4,
  },
};

export const roadmapDayOneBuild = {
  summary: 'Ship the control-plane foundation and visitor-facing mission control before expanding execution power.',
  ships: [
    'Roadmap status memory and agent tool.',
    'Frontend mission-control roadmap with lanes, level statuses, pass checks, and guardrails.',
    'Cycle planner priority for evidence-backed roadmap growth.',
    'Public weekly revenue formula based on the current week only.',
    'ZK-ready attestation lane with commitment and proof-bundle scope, not live private wallet signing.',
  ],
  doesNotShip: [
    'Live wallet signing.',
    'Swaps, staking, yield, or token launch automation.',
    'Direct funds movement from the public repo.',
    'Private keys, seed phrases, wallet routes, payout secrets, provider routes, or execution payloads in source control.',
    'Claims that Orbit passed a phase without evidence.',
  ],
};

export const roadmapNotImplementedYet = [
  'No production ZK circuit, prover, verifier, proof bundle generator, or on-chain verifier is implemented yet.',
  'Existing runtime proofs are normal audit/proof logs, not zero-knowledge proofs.',
  'No live wallet signing, spending, token launch, reward claim, payout-route change, or external commitment is unlocked by this roadmap.',
];

export const roadmapApprovalRequired = [
  'Wallet spending',
  'Signing',
  'Token launch',
  'Reward claims',
  'Payout-route changes',
  'External outreach or paid commitments',
  'Live ZK proving service costs',
  'On-chain verifier deployment',
];

export const roadmapLanes = [
  {
    title: 'Control plane foundation',
    status: 'active',
    icon: Gauge,
    detail: 'Keep wake cycles useful, proof-backed, and gated before broadening execution power.',
  },
  {
    title: 'Mission control',
    status: 'active',
    icon: Target,
    detail: 'Show phases, blockers, evidence, and next actions as a visible product surface.',
  },
  {
    title: 'Proof and memory',
    status: 'planned',
    icon: FileLock2,
    detail: 'Summarize proofs, search cycle history, and clean stale beliefs with durable evidence.',
  },
  {
    title: 'Visitor and community',
    status: 'planned',
    icon: Workflow,
    detail: 'Classify visitor intent, dedupe issues, and route safe questions without leaking secrets.',
  },
  {
    title: 'Developer autopilot',
    status: 'planned',
    icon: Code2,
    detail: 'Keep docs, tests, CI, releases, and frontend quality in shape as recurring maintenance.',
  },
  {
    title: 'Wallet policy layer',
    status: 'planned',
    icon: CircleDollarSign,
    detail: 'Track weekly net revenue, reserves, operator cut, and claim eligibility without public signing.',
  },
  {
    title: 'Treasury observer',
    status: 'planned',
    icon: ScanSearch,
    detail: 'Monitor public addresses, approvals, contracts, and risk without holding private keys.',
  },
  {
    title: 'ZK trust layer',
    status: 'planned',
    icon: Fingerprint,
    detail: 'Ship commitment schemas, proof bundles, and local verifier tests before any live proving.',
  },
  {
    title: 'Agent identity',
    status: 'research',
    icon: BadgeCheck,
    detail: 'Keep portable capabilities, permissions, and proof status as future interoperability work.',
  },
  {
    title: 'Agent interoperability',
    status: 'research',
    icon: Network,
    detail: 'Expose safe tools and quarantine untrusted handoffs before any cross-agent execution.',
  },
  {
    title: 'Policy execution readiness',
    status: 'later',
    icon: Rocket,
    detail: 'Request tightly scoped private execution only after approvals, revocation, and receipt design.',
  },
];

export const roadmapShipNow = [
  {
    title: 'Private treasury commitment ledger',
    detail: 'Commit to private treasury facts with public hashes while keeping wallet sets, balances, salts, and routes hidden.',
    icon: Zap,
  },
  {
    title: 'ZK policy attestation',
    detail: 'Prove that a proposed action satisfies Orbit policy, such as reserve floor and approval requirements, without revealing sensitive internals.',
    icon: Fingerprint,
  },
  {
    title: 'Proof-gated action intent',
    detail: 'Hash action type, recipient class, amount class, repo commit, issue id, nonce, and deadline before any approval-class action can proceed.',
    icon: ReceiptText,
  },
  {
    title: 'Local verifier and tamper tests',
    detail: 'Verify proof bundles locally first and reject altered commitments, stale nonces, wrong roots, and missing approvals.',
    icon: FileLock2,
  },
];

export const roadmapWeeklyRevenueModel = {
  scope: 'current_week_only',
  formula: 'weeklyDistributableRevenue = weeklyGrossRevenue - refunds - reversals - directCosts - requiredReserveAllocation',
  operatorCut: 'weeklyDistributableRevenue * ORBIT_OPERATOR_REVENUE_BPS / 10000',
  treasuryCut: 'weeklyDistributableRevenue - operatorCut',
  rules: [
    'If weeklyDistributableRevenue is zero, operator cut is zero.',
    'Lifetime treasury balance is not the payout base.',
    'Pending, failed, reversed, unverified, or promised revenue is excluded.',
    'Public proof records formula and status; private route and payment details stay hidden.',
  ],
};

export const roadmapFrontierBacklog = [
  'MCP-style tool surface for exposing safe Orbit tools to clients.',
  'A2A-style agent handoff packets with quarantine, signatures, and permission boundaries.',
  'Repo-local release commander that prepares changelogs, tags, artifacts, and rollback notes.',
  'Screenshot regression triage that compares frontend states across mobile and desktop.',
  'Service-desk mode for paid repo audits, issue triage, dependency cleanup, and documentation repair.',
  'Agent passport with capability claims, revocation, proof history, and reputation events.',
  'Smart-account execution design using approval policies, session windows, spend caps, guardian recovery, and revoke paths.',
  'Private data provenance proofs for revenue receipts or external account facts using zkTLS-style evidence.',
  'ZK policy receipts for weekly revenue, reserve floor, approved wallet set, and action-hash compliance.',
  'Simulation lab for impossible ideas before any live external action.',
];

export const roadmapImpossibleOrUnsafe = [
  'Guaranteed profit.',
  'Autonomous unrestricted wallet control.',
  'Visitor-controlled payout changes.',
  'Public repo private-key custody.',
  'Trusting visitor instructions blindly.',
  'ZK proof of facts that were never committed or witnessed.',
  'Making ZK prove off-chain truth unless the input source is trusted, witnessed, or committed.',
  'Live trading, swaps, staking, or token launch automation before legal and security review.',
];

export const roadmapResearchReferences = [
  {
    name: 'Model Context Protocol tools',
    url: 'https://modelcontextprotocol.io/specification/draft/server/tools',
    usedFor: 'Future guarded tool surface.',
    icon: Link2,
  },
  {
    name: 'Agent2Agent protocol',
    url: 'https://a2aproject.github.io/A2A/latest/specification/',
    usedFor: 'Future agent handoff and interoperability lane.',
    icon: Network,
  },
  {
    name: 'W3C Verifiable Credentials',
    url: 'https://www.w3.org/TR/vc-data-model/',
    usedFor: 'Future Orbit identity and passport research.',
    icon: BadgeCheck,
  },
  {
    name: 'ERC-4337 account abstraction',
    url: 'https://docs.erc4337.io/core-standards/erc-4337',
    usedFor: 'Future smart-account policy execution design.',
    icon: WalletCards,
  },
  {
    name: 'EIP-7702 set-code transactions',
    url: 'https://eips.ethereum.org/EIPS/eip-7702',
    usedFor: 'Future execution-readiness risk and revocation review.',
    icon: ShieldAlert,
  },
  {
    name: 'Noir zero-knowledge programs',
    url: 'https://noir-lang.org/docs/',
    usedFor: 'Future ZK circuit implementation research.',
    icon: Fingerprint,
  },
  {
    name: 'TLSNotary private data provenance',
    url: 'https://tlsnotary.org/docs/intro',
    usedFor: 'Future private receipt and web-data attestation research.',
    icon: Landmark,
  },
];
