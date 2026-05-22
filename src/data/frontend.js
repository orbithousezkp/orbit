import {
  Archive,
  BookOpenText,
  Brain,
  BriefcaseBusiness,
  CalendarClock,
  DoorOpen,
  FileCheck2,
  HeartPulse,
  House,
  KeyRound,
  LockKeyhole,
  NotebookTabs,
  PiggyBank,
  ShieldCheck,
} from 'lucide-react';

export const navItems = [
  { label: 'House', href: '#house' },
  { label: 'Life', href: '#life' },
  { label: 'Members', href: '#members' },
  { label: 'Rooms', href: '#rooms' },
  { label: 'Routine', href: '#routine' },
  { label: 'Boundaries', href: '#boundaries' },
];

export const identityStats = [
  {
    label: 'House',
    value: 'GitHub',
    detail: 'The repository is the place where the household lives and survives.',
  },
  {
    label: 'Food',
    value: 'AI calls',
    detail: 'Model calls feed the members, so the household must budget them carefully.',
  },
  {
    label: 'Income',
    value: 'Treasury',
    detail: 'To keep living well, the household prepares earnings and protects money movement.',
  },
];

export const houseMembers = [
  {
    name: 'Pulse',
    role: 'Autonomous life layer',
    desc: 'Notices what matters, wakes the house, chooses safe work, and keeps rhythm.',
    icon: HeartPulse,
  },
  {
    name: 'Memory Keeper',
    role: 'Mind of the house',
    desc: 'Stores rules, lessons, preferences, warnings, and household history.',
    icon: Brain,
  },
  {
    name: 'Treasurer',
    role: 'Survival money',
    desc: 'Budgets AI food, prepares income, and blocks unsafe external spend.',
    icon: PiggyBank,
  },
  {
    name: 'Caretaker',
    role: 'House maintenance',
    desc: 'Turns issues into chores, repairs files, runs checks, and keeps rooms clean.',
    icon: BriefcaseBusiness,
  },
  {
    name: 'Gatekeeper',
    role: 'House locks',
    desc: 'Refuses secrets, scams, unsafe paths, wallet drains, and unlocked live actions.',
    icon: ShieldCheck,
  },
  {
    name: 'Diarist',
    role: 'Public record',
    desc: 'Writes proofs so every wake cycle leaves a reviewable household diary.',
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
    label: 'Shelter',
    value: 'GitHub repo',
    desc: 'The house exists as files, issues, Actions, memory, proofs, commits, and settings.',
  },
  {
    label: 'Work',
    value: 'chores',
    desc: 'Maintenance, docs, tests, triage, cleanup, and repairs keep the home livable.',
  },
  {
    label: 'Money',
    value: 'treasury',
    desc: 'The household earns and budgets so it can survive, improve, and pay for food.',
  },
  {
    label: 'Rules',
    value: 'locks',
    desc: 'Approval gates and safety checks protect the household from theft or bad decisions.',
  },
  {
    label: 'Memory',
    value: 'diary',
    desc: 'Lessons and proofs let the household continue from yesterday instead of restarting.',
  },
];

export const humanStack = [
  {
    label: 'House',
    value: 'GitHub repository',
    desc: 'The real place where Orbit exists: code, issues, memory, proofs, schedules, and public history.',
  },
  {
    label: 'Members',
    value: 'living systems',
    desc: 'Pulse, memory, treasury, caretaker, gatekeeper, and diarist act like a household inside the repo.',
  },
  {
    label: 'Food',
    value: 'AI calls',
    desc: 'Every thought costs food, so budget and attention decide how long the household can keep working.',
  },
  {
    label: 'Work',
    value: 'chores',
    desc: 'Members maintain rooms, answer visitors, repair code, clean memory, and run checks.',
  },
  {
    label: 'Income',
    value: 'treasury policy',
    desc: 'Earning routes, token preparation, approvals, and locked live actions support survival.',
  },
  {
    label: 'Diary',
    value: 'proof ledger',
    desc: 'Every wake cycle records what the household saw, did, learned, refused, and needs next.',
  },
];

export const houseRooms = [
  {
    name: 'Front Door',
    path: 'issues/',
    detail: 'People knock by opening issues, comments, requests, and approvals.',
    icon: DoorOpen,
  },
  {
    name: 'Memory Room',
    path: 'memory/',
    detail: 'The members store facts, habits, strategy, tasks, and lessons between wake cycles.',
    icon: Brain,
  },
  {
    name: 'Workbench',
    path: 'src/agent/',
    detail: 'Tools for triage, research, risk scanning, treasury policy, and GitHub work.',
    icon: BriefcaseBusiness,
  },
  {
    name: 'Wallet Drawer',
    path: 'treasury.json',
    detail: 'Budget caps, food limits, revenue policy, token preparation, and spend proposals live here.',
    icon: PiggyBank,
  },
  {
    name: 'Diary',
    path: 'runtime/proofs/',
    detail: 'Each cycle leaves a proof of what the household saw, decided, changed, and refused.',
    icon: NotebookTabs,
  },
  {
    name: 'Locks',
    path: 'governance/',
    detail: 'Owner approvals, dry-run flags, path rules, and secret checks define boundaries.',
    icon: ShieldCheck,
  },
];

export const dailyRoutine = [
  {
    time: 'Wake',
    title: 'Opens his eyes',
    desc: 'Checks visitors, memory, budget, safety locks, and the last diary entry before touching anything.',
  },
  {
    time: 'Notice',
    title: 'Reads the room',
    desc: 'Turns comments, issues, alerts, and failed checks into household signals instead of raw queue items.',
  },
  {
    time: 'Think',
    title: 'Chooses safe work',
    desc: 'Classifies chores, checks risk, remembers standing rules, and asks for approval when money is involved.',
  },
  {
    time: 'Earn',
    title: 'Protects income paths',
    desc: 'Tracks AI costs, prepares token or reward work, and keeps live transfers behind explicit locks.',
  },
  {
    time: 'Sleep',
    title: 'Writes the diary',
    desc: 'Saves a proof, updates durable state, and leaves the repository ready for the next wake cycle.',
  },
];

export const cycleDrivers = [
  {
    title: 'State',
    desc: 'Internal household pressure: low AI-call food, no income, pending approvals, open chores, stale memory, or failed checks.',
    icon: HeartPulse,
  },
  {
    title: 'Event',
    desc: 'External activity at the GitHub house: issues, comments, labels, manual owner wakes, visitors, or repository changes.',
    icon: DoorOpen,
  },
  {
    title: 'Mandatory',
    desc: 'The scheduled 30-minute heartbeat. It fires regularly even when the house is quiet, then checks survival, locks, proofs, and next work.',
    icon: CalendarClock,
  },
];

export const householdSystems = [
  {
    title: 'Learns',
    desc: 'He does not start blank each cycle. Memory files become habits, warnings, preferences, and goals.',
    icon: Brain,
  },
  {
    title: 'Earns',
    desc: 'He can prepare bounties, launch plans, claims, and treasury actions while live signing stays locked.',
    icon: PiggyBank,
  },
  {
    title: 'Manages',
    desc: 'He keeps chores, bills, repair work, approvals, visitors, and routines organized inside GitHub.',
    icon: House,
  },
  {
    title: 'Reports',
    desc: 'Proof records and memory notes make his behavior inspectable instead of hidden.',
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
    desc: 'It treats earning and cost control as household survival, not an optional dashboard metric.',
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
    label: 'Visitors',
    path: 'issues/',
    detail: 'Every request enters through the front door where it can be inspected, answered, labeled, or refused.',
  },
  {
    label: 'Lessons',
    path: 'memory/',
    detail: 'Rules and discoveries become durable household knowledge for later wake cycles.',
  },
  {
    label: 'Chores',
    path: 'tasks.json',
    detail: 'Repairs, improvements, follow-ups, and reminders stay visible as work around the house.',
  },
  {
    label: 'Income',
    path: 'treasury.json',
    detail: 'AI budget, reward routes, token preparation, and approval gates are managed as household money.',
  },
  {
    label: 'Proofs',
    path: 'runtime/proofs/',
    detail: 'His diary records decisions, actions, refusals, and the next state before he sleeps.',
  },
];

export const commandExamples = [
  {
    command: '@orbit what happened in the house while I was away?',
    response: 'Reads visitors, chores, spend state, lessons, and diary entries since the last wake cycle.',
  },
  {
    command: '@orbit can we talk through this idea first?',
    response: 'Converse safely, ask clarifying questions, and turn useful public context into chores.',
  },
  {
    command: '@orbit learn this rule: never pay external wallets without approval',
    response: 'Stores the rule as household memory and applies it to future earning or spend decisions.',
  },
  {
    command: '@orbit assign this repair to @alice with 80 USDC',
    response: 'Creates a household spend request, waits at the door, and does not move money until approved.',
  },
];

export const boundaries = [
  {
    title: 'House keys stay private',
    desc: 'Secrets, private keys, and unsafe paths are rejected before they enter memory or tools.',
    icon: KeyRound,
  },
  {
    title: 'Money has locks',
    desc: 'External spend, live claims, and token launches require explicit flags or public approval. Revenue sending is weekly and performance-gated.',
    icon: LockKeyhole,
  },
  {
    title: 'Conversation stays public-safe',
    desc: 'Visitors can talk with Orbit, but replies cannot reveal secrets, private routes, or promise payment.',
    icon: DoorOpen,
  },
  {
    title: 'Every day leaves paperwork',
    desc: 'He writes proof records so his work, refusals, and next state can be inspected later.',
    icon: FileCheck2,
  },
  {
    title: 'Routines are scheduled',
    desc: 'GitHub Actions give him a wake/sleep rhythm without a separate server or hidden queue.',
    icon: CalendarClock,
  },
  {
    title: 'Old lessons are archived',
    desc: 'Tasks, knowledge, governance, and cycles are kept as repo files, not private app state.',
    icon: Archive,
  },
  {
    title: 'Health is measured',
    desc: 'Budget, food, memory, queue state, and safety status define whether the household can keep working.',
    icon: HeartPulse,
  },
];
