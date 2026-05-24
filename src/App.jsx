import {
  Activity,
  ArrowRight,
  BadgeCheck,
  Bot,
  CheckCircle2,
  CircleDollarSign,
  CircleDot,
  FileLock2,
  Fingerprint,
  GitBranch,
  HeartPulse,
  House,
  Link2,
  Menu,
  Milestone,
  NotebookTabs,
  ReceiptText,
  Rocket,
  ShieldAlert,
  Target,
  X,
  Zap,
} from 'lucide-react';
import { useState } from 'react';
import {
  boundaries,
  commandExamples,
  cycleDrivers,
  dailyRoutine,
  lifeSystems,
  householdLedger,
  householdNeeds,
  householdSystems,
  houseRooms,
  houseMembers,
  humanStack,
  identityStats,
  roadmapApprovalRequired,
  roadmapDayOneBuild,
  roadmapFrontierBacklog,
  roadmapImpossibleOrUnsafe,
  roadmapLanes,
  roadmapNotImplementedYet,
  roadmapResearchReferences,
  roadmapShipNow,
  roadmapSummary,
  roadmapWeeklyRevenueModel,
  navItems,
} from './data/frontend.js';

function Header() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1180px] items-center justify-between px-4 sm:px-6 lg:px-8">
        <a href="#top" className="flex items-center gap-3">
          <span className="text-[16px] font-extrabold leading-none tracking-[0.01em] text-slate-950">
            Orbit
          </span>
        </a>

        <nav className="hidden items-center gap-1 md:flex">
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="rounded-lg px-3 py-2 text-[13px] font-semibold text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-950"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-2 sm:flex">
          <a
            href="#routine"
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-semibold text-slate-700 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50"
          >
            <HeartPulse size={15} />
            Runtime
          </a>
          <a
            href="#house"
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#4f5bbd] px-3 text-[13px] font-semibold text-white shadow-sm shadow-[#4f5bbd]/20 transition-opacity hover:opacity-90"
          >
            Open Orbit
            <ArrowRight size={15} />
          </a>
        </div>

        <button
          type="button"
          onClick={() => setIsOpen((value) => !value)}
          aria-label="Toggle navigation"
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-800 md:hidden"
        >
          {isOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      {isOpen ? (
        <div className="border-t border-slate-200 bg-white px-4 py-3 md:hidden">
          <div className="mx-auto grid max-w-[1180px] gap-1">
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setIsOpen(false)}
                className="rounded-lg px-3 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100"
              >
                {item.label}
              </a>
            ))}
          </div>
        </div>
      ) : null}
    </header>
  );
}

function SectionIntro({ kicker, title, children }) {
  return (
    <div className="max-w-[650px]">
      <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-[#4f5bbd]">
        {kicker}
      </p>
      <h2 className="text-2xl font-bold leading-tight text-slate-950 sm:text-3xl">{title}</h2>
      <p className="mt-3 text-[15px] leading-7 text-slate-600">{children}</p>
    </div>
  );
}

function HouseVisual() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_24px_90px_rgba(15,23,42,0.12)]">
      <div className="house-scene min-h-[440px]" />
      <div className="absolute inset-0 dot-grid opacity-40" />

      <div className="absolute inset-x-4 top-4 rounded-xl border border-white/70 bg-white/85 p-4 backdrop-blur">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#4f5bbd]/10 text-[#4f5bbd]">
              <House size={18} />
            </span>
            <div>
              <div className="text-[13px] font-bold text-slate-950">Orbit Control Plane</div>
              <div className="font-mono text-[11px] text-slate-500">github.com/orbit-house/orbit</div>
            </div>
          </div>
          <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
            Active
          </span>
        </div>
      </div>

      <div className="absolute bottom-4 left-4 right-4 grid gap-3 sm:grid-cols-3">
        {[
          ['intake', 'issues', '3 signals waiting'],
          ['runtime', 'actions', 'cycle running'],
          ['receipts', 'proofs', 'last entry saved'],
        ].map(([room, path, state]) => (
          <div key={room} className="rounded-xl border border-slate-200 bg-white/90 p-3 backdrop-blur">
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{room}</div>
            <div className="mt-2 font-mono text-[13px] font-bold text-slate-950">{path}</div>
            <div className="mt-1 text-[12px] text-[#4f5bbd]">{state}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatStrip() {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {identityStats.map((stat) => (
        <div key={stat.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="font-mono text-[11px] font-bold uppercase text-slate-500">{stat.label}</div>
          <div className="mt-3 text-3xl font-bold text-slate-950">{stat.value}</div>
          <div className="mt-2 text-[12px] leading-5 text-slate-600">{stat.detail}</div>
        </div>
      ))}
    </div>
  );
}

function HumanStack() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {humanStack.map((item) => (
        <article key={item.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="font-mono text-[11px] font-bold uppercase text-[#4f5bbd]">
              {item.label}
            </div>
            <div className="rounded-full bg-slate-100 px-2.5 py-1 font-mono text-[10px] font-bold text-slate-500">
              {item.value}
            </div>
          </div>
          <p className="mt-4 text-[13px] leading-6 text-slate-600">{item.desc}</p>
        </article>
      ))}
    </div>
  );
}

function MemberCard({ member }) {
  const Icon = member.icon;

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[15px] font-bold text-slate-950">{member.name}</h3>
          <p className="mt-1 font-mono text-[10px] font-bold uppercase text-[#4f5bbd]">
            {member.role}
          </p>
        </div>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#4f5bbd]/10 text-[#4f5bbd]">
          <Icon size={20} />
        </span>
      </div>
      <p className="mt-4 text-[13px] leading-6 text-slate-600">{member.desc}</p>
    </article>
  );
}

function NeedsGrid() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {householdNeeds.map((item) => (
        <div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="font-mono text-[11px] font-bold uppercase text-slate-500">{item.label}</div>
          <div className="mt-3 text-xl font-bold text-slate-950">{item.value}</div>
          <p className="mt-2 text-[12px] leading-5 text-slate-600">{item.desc}</p>
        </div>
      ))}
    </div>
  );
}

function RoomCard({ room }) {
  const Icon = room.icon;

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-colors hover:border-[#4f5bbd]/40">
      <div className="relative h-[132px] overflow-hidden bg-slate-50">
        <div className="absolute inset-0 dot-grid" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.92))]" />
        <div className="absolute left-4 top-3 rounded-full border border-[#4f5bbd]/30 bg-white/85 px-2.5 py-1 font-mono text-[10px] font-bold text-[#4f5bbd] backdrop-blur">
          {room.path}
        </div>
        <div className="absolute bottom-5 right-6 flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white text-[#4f5bbd] shadow-sm">
          <Icon size={22} />
        </div>
      </div>
      <div className="p-5">
        <h3 className="text-[17px] font-bold leading-snug text-slate-950">{room.name}</h3>
        <p className="mt-3 text-[13px] leading-6 text-slate-600">{room.detail}</p>
      </div>
    </article>
  );
}

function RoutineTimeline() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-5 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#4f5bbd]/10 text-[#4f5bbd]">
          <HeartPulse size={17} />
        </span>
        <div>
          <div className="text-[13px] font-bold text-slate-950">One wake cycle</div>
          <div className="font-mono text-[11px] text-slate-500">
            wake {"->"} work {"->"} diary {"->"} sleep
          </div>
        </div>
      </div>
      <div className="space-y-4">
        {dailyRoutine.map((step) => (
          <div key={step.time} className="grid grid-cols-[58px_1fr] gap-3">
            <div className="font-mono text-[11px] font-bold uppercase text-[#4f5bbd]">{step.time}</div>
            <div className="border-b border-slate-100 pb-4 last:border-b-0 last:pb-0">
              <div className="text-[13px] font-bold text-slate-950">{step.title}</div>
              <p className="mt-1 text-[12px] leading-5 text-slate-600">{step.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CommandThread() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-[#07111f] p-4 text-white shadow-sm">
      <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-3">
        <div>
          <div className="text-[13px] font-bold">GitHub intake comments</div>
          <div className="font-mono text-[11px] text-slate-400">issues are control-plane signals</div>
        </div>
        <GitBranch size={18} className="text-slate-400" />
      </div>
      <div className="space-y-3">
        {commandExamples.map((item) => (
          <div key={item.command} className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
            <code className="block text-[12px] text-cyan-200">{item.command}</code>
            <p className="mt-2 text-[12px] leading-5 text-slate-300">{item.response}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function SystemCard({ item }) {
  const Icon = item.icon;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <Icon className="mb-4 text-[#4f5bbd]" size={21} />
      <div className="text-[14px] font-bold text-slate-950">{item.title}</div>
      <p className="mt-2 text-[12px] leading-5 text-slate-600">{item.desc}</p>
    </div>
  );
}

function HouseholdLedger() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-5 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#4f5bbd]/10 text-[#4f5bbd]">
          <NotebookTabs size={17} />
        </span>
        <div>
          <div className="text-[13px] font-bold text-slate-950">Control-plane ledger</div>
          <div className="font-mono text-[11px] text-slate-500">everything lives in GitHub</div>
        </div>
      </div>

      <div className="space-y-3">
        {householdLedger.map((item) => (
          <div key={item.path} className="grid gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-4 sm:grid-cols-[116px_1fr]">
            <div>
              <div className="text-[12px] font-bold text-slate-950">{item.label}</div>
              <div className="mt-1 font-mono text-[11px] font-bold text-[#4f5bbd]">{item.path}</div>
            </div>
            <p className="text-[12px] leading-5 text-slate-600">{item.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

const ROADMAP_STATUS_STYLES = {
  active: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  planned: 'border-indigo-200 bg-indigo-50 text-indigo-700',
  research: 'border-amber-200 bg-amber-50 text-amber-700',
  later: 'border-slate-200 bg-slate-100 text-slate-600',
  blocked: 'border-rose-200 bg-rose-50 text-rose-700',
};

function RoadmapMetric({ metric }) {
  const Icon = metric.icon;

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center gap-2 text-slate-500">
        <Icon size={14} />
        <div className="text-[10px] font-bold uppercase tracking-widest">{metric.label}</div>
      </div>
      <div className="mt-2 text-[20px] font-bold text-slate-950">{metric.value}</div>
      <p className="mt-1 text-[11px] leading-4 text-slate-600">{metric.detail}</p>
    </div>
  );
}

function RoadmapPanel({ eyebrow, title, icon: Icon, children }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#4f5bbd]/10 text-[#4f5bbd]">
          <Icon size={17} />
        </span>
        <div>
          <div className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
            {eyebrow}
          </div>
          <div className="text-[14px] font-bold text-slate-950">{title}</div>
        </div>
      </div>
      {children}
    </article>
  );
}

function RoadmapLane({ lane }) {
  const Icon = lane.icon || CircleDot;
  const statusClass = ROADMAP_STATUS_STYLES[lane.status] || ROADMAP_STATUS_STYLES.planned;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#4f5bbd]/10 text-[#4f5bbd]">
            <Icon size={18} />
          </span>
          <div>
            <div className="text-[14px] font-bold leading-5 text-slate-950">{lane.title}</div>
            <p className="mt-1 text-[11px] font-mono uppercase tracking-widest text-slate-500">
              {lane.status}
            </p>
          </div>
        </div>
        <div className={`rounded-full border px-2.5 py-1 font-mono text-[10px] font-bold uppercase ${statusClass}`}>
          {lane.status}
        </div>
      </div>
      <p className="mt-3 text-[12px] leading-5 text-slate-600">{lane.detail}</p>
    </div>
  );
}

export default function App() {
  return (
    <div id="top" className="sky-theme relative isolate min-h-screen overflow-x-hidden bg-transparent text-slate-950">
      <div aria-hidden="true" className="frontpage-sky pointer-events-none absolute inset-0 -z-10" />
      <Header />

      <main>
        <section id="house" className="relative overflow-hidden border-b border-slate-200/70 bg-white/78 backdrop-blur-sm">
          <div className="absolute inset-0 hero-mesh" />
          <div className="relative mx-auto grid max-w-[1180px] gap-10 px-4 pb-16 pt-12 sm:px-6 sm:pt-16 lg:grid-cols-[0.9fr_1.1fr] lg:px-8 lg:pb-20">
            <div className="flex flex-col justify-center">
              <div className="mb-6 inline-flex w-fit items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 shadow-sm">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span className="text-[12px] font-semibold text-slate-700">
                  The GitHub-native infrastructure layer
                </span>
              </div>

              <h1 className="max-w-[620px] text-5xl font-extrabold leading-[0.96] text-slate-950 sm:text-6xl lg:text-7xl">
                Orbit
              </h1>
              <p className="mt-5 max-w-[600px] text-2xl font-bold leading-tight text-slate-950 sm:text-3xl">
                A GitHub repo control plane for agents, proofs, permissions, and wallet policy.
              </p>
              <p className="mt-5 max-w-[620px] text-[16px] leading-8 text-slate-600">
                Orbit turns a GitHub repo into a reusable operating layer. It coordinates agents,
                memory, proof receipts, permissions, lifecycle state, and wallet policy while
                keeping live signing and external movement gated.
              </p>

              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <a
                  href="#rooms"
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#4f5bbd] px-5 text-sm font-semibold text-white shadow-sm shadow-[#4f5bbd]/20 transition-opacity hover:opacity-90"
                >
                  Explore the control plane
                  <ArrowRight size={16} />
                </a>
                <a
                  href="#routine"
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-800 shadow-sm transition-colors hover:bg-slate-50"
                >
                  <HeartPulse size={16} />
                  See the runtime
                </a>
              </div>
            </div>

            <HouseVisual />
          </div>
        </section>

        <section className="mx-auto max-w-[1180px] px-4 py-12 sm:px-6 lg:px-8">
          <StatStrip />
        </section>

        <section id="life" className="mx-auto max-w-[1180px] px-4 py-12 sm:px-6 lg:px-8">
          <SectionIntro kicker="Product" title="Software that behaves like infrastructure">
            Orbit is not a dashboard wrapped around automation. It is a product model for an
            autonomous repository: identity, memory, work, permissions, wallet policy, and proof
            all live in one GitHub-native infrastructure layer.
          </SectionIntro>
          <div className="mt-9">
            <HumanStack />
          </div>
        </section>

        <section id="members" className="mx-auto max-w-[1180px] px-4 py-12 sm:px-6 lg:px-8">
          <SectionIntro kicker="Modules" title="A product with coordinated layers">
            Orbit presents one name to the world, while its internal modules handle attention,
            memory, policy, runtime, safety, and proof like a coordinated control plane.
          </SectionIntro>
          <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {houseMembers.map((member) => (
              <MemberCard key={member.name} member={member} />
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-[1180px] px-4 py-12 sm:px-6 lg:px-8">
          <SectionIntro kicker="Policy" title="Wallet policy is part of the product">
            Orbit treats AI calls as runtime budget and wallet policy as governance. It can search
            for useful work, prepare earning routes, and maintain strict approval gates around
            money movement.
          </SectionIntro>
          <div className="mt-9">
            <NeedsGrid />
          </div>
        </section>

        <section id="rooms" className="mx-auto max-w-[1180px] px-4 py-12 sm:px-6 lg:px-8">
          <SectionIntro kicker="Surfaces" title="The repository is the operating surface">
            Each GitHub surface becomes part of the product: issues as intake, Actions as runtime,
            memory as state, treasury as policy, proofs as receipts, and governance as permissions.
          </SectionIntro>

          <div className="mt-9 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {houseRooms.map((room) => (
              <RoomCard key={room.name} room={room} />
            ))}
          </div>
        </section>

        <section id="routine" className="mx-auto max-w-[1180px] px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
            <div>
              <SectionIntro kicker="Runtime" title="The control plane has a cycle, not a job queue">
                A wake cycle can wake from state, event, or mandatory pressure. The mandatory
                heartbeat runs every 30 minutes, even when the repo is quiet.
              </SectionIntro>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {cycleDrivers.map((item) => (
                  <SystemCard key={item.title} item={item} />
                ))}
              </div>
            </div>
            <RoutineTimeline />
          </div>
        </section>

        <section className="mx-auto max-w-[1180px] px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
            <div>
              <SectionIntro kicker="Runtime Layer" title="The autonomous layer is the repository rhythm">
                Orbit’s runtime layer gives the product attention, appetite, conscience, memory,
                and rhythm. That is what makes it feel like an operating layer instead of a queue runner.
              </SectionIntro>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {[...lifeSystems, ...householdSystems].map((item) => (
                  <SystemCard key={item.title} item={item} />
                ))}
              </div>
            </div>
            <HouseholdLedger />
          </div>
        </section>

        <section id="commands" className="mx-auto max-w-[1180px] px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-2 lg:items-start">
            <CommandThread />
            <div>
              <SectionIntro kicker="Intake" title="People talk to Orbit through GitHub">
                Conversations become product intake. Visitors can ask questions, suggest work, or
                request repairs, while spending and risky moves remain locked behind owner approval.
              </SectionIntro>
              <div className="mt-6 grid gap-3">
                {[
                  ['Learns', 'Stable notes become memory, not one-off chat history.'],
                  ['Earns', 'Bounties, token prep, and reward routes stay tied to policy.'],
                  ['Manages', 'Tasks, approvals, chores, and proofs stay inside GitHub.'],
                ].map(([label, text]) => (
                  <div key={label} className="flex gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-600" size={18} />
                    <div>
                      <div className="text-[13px] font-bold text-slate-950">{label}</div>
                      <p className="mt-1 text-[12px] leading-5 text-slate-600">{text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="boundaries" className="mx-auto max-w-[1180px] px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
            <div>
              <SectionIntro kicker="Boundaries" title="A real control plane needs hard policy">
                If Orbit is going to be a real product, it still needs strict limits. The runtime
                can learn and earn, but keys, money, live signing, and unsafe paths stay behind gates.
              </SectionIntro>
              <div className="mt-7 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center gap-2">
                  <NotebookTabs size={17} className="text-[#4f5bbd]" />
                  <div className="text-[13px] font-bold text-slate-950">Receipt entry</div>
                </div>
                <pre className="overflow-x-auto rounded-xl bg-slate-950 p-4 font-mono text-[12px] leading-6 text-slate-200">
{`cycle: 184
repo: github.com/orbit-house/orbit
intake: 3 issues
chores: memory refresh, proof write
earnings: dry-run only
refused: external spend without approval
sleep: proof saved`}
                </pre>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {boundaries.map((item) => (
                <SystemCard key={item.title} item={item} />
              ))}
            </div>
          </div>
        </section>

        <section id="roadmap" className="mx-auto max-w-[1180px] px-4 py-12 sm:px-6 lg:px-8">
          <SectionIntro kicker="Roadmap" title="Orbit grows by passing visible phase gates">
            The recovered roadmap is now a product surface: control-plane foundation, proof,
            intake, developer work, wallet policy, treasury observation, ZK trust, identity,
            interoperability, and execution readiness all advance only when evidence exists.
          </SectionIntro>

          <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                label: 'lanes',
                value: roadmapSummary.counts.lanes,
                detail: 'growth tracks',
                icon: Target,
              },
              {
                label: 'levels',
                value: roadmapSummary.counts.levels,
                detail: 'staged unlocks',
                icon: Milestone,
              },
              {
                label: 'phase checks',
                value: roadmapSummary.counts.phases,
                detail: 'evidence gates',
                icon: BadgeCheck,
              },
              {
                label: 'ZK first ship',
                value: roadmapSummary.counts.zkShipNow,
                detail: 'planned items',
                icon: Fingerprint,
              },
            ].map((metric) => (
              <RoadmapMetric key={metric.label} metric={metric} />
            ))}
          </div>

          <div className="mt-7 grid gap-6 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
            <div className="space-y-4">
              <RoadmapPanel eyebrow="Current gate" title={roadmapSummary.currentLevel} icon={CircleDot}>
                <p className="text-[13px] leading-6 text-slate-600">{roadmapDayOneBuild.summary}</p>
                <div className="mt-4 space-y-3">
                  {roadmapSummary.activeChecks.map((check) => (
                    <div key={check} className="flex gap-3">
                      <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-600" />
                      <p className="text-[12px] leading-5 text-slate-600">{check}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-5 rounded-xl border border-indigo-100 bg-indigo-50 p-4">
                  <div className="text-[11px] font-bold uppercase tracking-widest text-indigo-700">
                    Next level
                  </div>
                  <p className="mt-2 text-[13px] leading-6 text-slate-700">
                    {roadmapSummary.nextLevel} stays locked until lower layers are backed by
                    files, tests, proofs, or owner approval.
                  </p>
                </div>
              </RoadmapPanel>

              <RoadmapPanel eyebrow="Day-one build" title="Ships now, without pretending" icon={Rocket}>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                  <div>
                    <div className="mb-2 text-[11px] font-bold uppercase tracking-widest text-emerald-700">
                      Ships
                    </div>
                    <div className="space-y-2">
                      {roadmapDayOneBuild.ships.map((item) => (
                        <div key={item} className="flex gap-2 text-[12px] leading-5 text-slate-600">
                          <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-emerald-600" />
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="mb-2 text-[11px] font-bold uppercase tracking-widest text-rose-700">
                      Does not ship
                    </div>
                    <div className="space-y-2">
                      {roadmapDayOneBuild.doesNotShip.map((item) => (
                        <div key={item} className="flex gap-2 text-[12px] leading-5 text-slate-600">
                          <ShieldAlert size={15} className="mt-0.5 shrink-0 text-rose-600" />
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </RoadmapPanel>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {roadmapLanes.map((lane) => (
                <RoadmapLane key={lane.title} lane={lane} />
              ))}
            </div>
          </div>

          <div className="mt-6 grid gap-5 lg:grid-cols-3 lg:items-start">
            <RoadmapPanel eyebrow="ZK proof lane" title="Planned first proof bundle" icon={Fingerprint}>
              <p className="text-[13px] leading-6 text-slate-600">{roadmapSummary.zkStage}</p>
              <div className="mt-4 space-y-3">
                {roadmapShipNow.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.title} className="border-b border-slate-100 pb-3 last:border-b-0 last:pb-0">
                      <div className="flex items-center gap-2">
                        <Icon size={16} className="text-[#4f5bbd]" />
                        <div className="text-[12px] font-bold text-slate-950">{item.title}</div>
                      </div>
                      <p className="mt-2 text-[12px] leading-5 text-slate-600">{item.detail}</p>
                    </div>
                  );
                })}
              </div>
            </RoadmapPanel>

            <RoadmapPanel eyebrow="Revenue model" title="Current week only" icon={CircleDollarSign}>
              <div className="rounded-xl bg-slate-950 p-4 font-mono text-[11px] leading-5 text-slate-200">
                {roadmapWeeklyRevenueModel.formula}
              </div>
              <div className="mt-4 space-y-2">
                {roadmapWeeklyRevenueModel.rules.map((rule) => (
                  <div key={rule} className="flex gap-2 text-[12px] leading-5 text-slate-600">
                    <ReceiptText size={15} className="mt-0.5 shrink-0 text-[#4f5bbd]" />
                    <span>{rule}</span>
                  </div>
                ))}
              </div>
            </RoadmapPanel>

            <RoadmapPanel eyebrow="Truth boundary" title="Not implemented yet" icon={FileLock2}>
              <div className="space-y-3">
                {roadmapNotImplementedYet.map((item) => (
                  <div key={item} className="flex gap-2 text-[12px] leading-5 text-slate-600">
                    <ShieldAlert size={15} className="mt-0.5 shrink-0 text-rose-600" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-xl border border-rose-100 bg-rose-50 p-3">
                <div className="text-[11px] font-bold uppercase tracking-widest text-rose-700">
                  Approval required
                </div>
                <p className="mt-2 text-[12px] leading-5 text-slate-700">
                  {roadmapApprovalRequired.join(', ')}.
                </p>
              </div>
            </RoadmapPanel>
          </div>

          <div className="mt-6 grid gap-5 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
            <RoadmapPanel eyebrow="Frontier backlog" title="Possible, but gated" icon={Zap}>
              <div className="grid gap-3 sm:grid-cols-2">
                {roadmapFrontierBacklog.map((item) => (
                  <div key={item} className="flex gap-2 border-b border-slate-100 pb-3 text-[12px] leading-5 text-slate-600 last:border-b-0 last:pb-0">
                    <Activity size={15} className="mt-0.5 shrink-0 text-[#4f5bbd]" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </RoadmapPanel>

            <RoadmapPanel eyebrow="Impossible or unsafe" title="Never public signing authority" icon={ShieldAlert}>
              <div className="space-y-3">
                {roadmapImpossibleOrUnsafe.map((item) => (
                  <div key={item} className="flex gap-2 text-[12px] leading-5 text-slate-600">
                    <ShieldAlert size={15} className="mt-0.5 shrink-0 text-rose-600" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </RoadmapPanel>
          </div>

          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#4f5bbd]/10 text-[#4f5bbd]">
                <Link2 size={17} />
              </span>
              <div>
                <div className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
                  Research spine
                </div>
                <div className="text-[14px] font-bold text-slate-950">
                  Standards Orbit is tracking
                </div>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {roadmapResearchReferences.map((item) => {
                const Icon = item.icon;
                return (
                  <a
                    key={item.name}
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-xl border border-slate-200 bg-slate-50 p-3 transition-colors hover:border-[#4f5bbd]/40 hover:bg-white"
                  >
                    <div className="flex items-center gap-2">
                      <Icon size={16} className="text-[#4f5bbd]" />
                      <div className="text-[12px] font-bold text-slate-950">{item.name}</div>
                    </div>
                    <p className="mt-2 text-[12px] leading-5 text-slate-600">{item.usedFor}</p>
                  </a>
                );
              })}
            </div>
          </div>
        </section>

        <section className="px-4 py-14 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-[1180px] overflow-hidden rounded-2xl border border-slate-200 bg-[#07111f] text-white shadow-[0_28px_90px_rgba(15,23,42,0.18)]">
            <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[1fr_360px] lg:p-10">
              <div>
                <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-cyan-200">
                  Infrastructure layer
                </p>
                <h2 className="max-w-[720px] text-3xl font-bold sm:text-4xl">
                  Your repository, governed.
                </h2>
                <p className="mt-4 max-w-[650px] text-[15px] leading-7 text-slate-300">
                  Orbit is the product expression of autonomous software infrastructure inside
                  GitHub: practical work, gated wallet policy, durable memory, and proof that can
                  be inspected.
                </p>
                <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                  <a
                    href="#house"
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-white px-5 text-sm font-semibold text-slate-950 transition-opacity hover:opacity-90"
                  >
                    Return to Orbit
                    <ArrowRight size={16} />
                  </a>
                  <a
                    href="#boundaries"
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-white/15 px-5 text-sm font-semibold text-white transition-colors hover:bg-white/10"
                  >
                    Review policy
                  </a>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                <div className="mb-4 flex items-center gap-2">
                  <Bot size={17} className="text-cyan-200" />
                  <span className="text-[13px] font-bold">Infrastructure stack</span>
                </div>
                <div className="space-y-3">
                  {[
                    ['Repo', 'GitHub repository'],
                    ['Layers', 'control plane modules'],
                    ['Budget', 'AI calls'],
                    ['Work', 'guarded tools'],
                    ['Wallet', 'treasury policy'],
                    ['Receipts', 'proof ledger'],
                  ].map(([label, value]) => (
                    <div key={label} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[12px]">
                      <span className="text-slate-400">{label}</span>
                      <span className="font-mono text-cyan-100">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1180px] flex-col gap-3 px-4 py-6 text-[12px] text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <span>Orbit, a GitHub-native infrastructure layer</span>
          <span className="font-mono">intake / state / runtime / policy / receipts / wallet</span>
        </div>
      </footer>
    </div>
  );
}
