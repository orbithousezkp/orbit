// the meta-roadmap, on a public surface. principles never change. currents
// deepen forever. the horizon-scanner proposes whatever comes next. see
// PLAN/FOREVER_ROADMAP.md for the prose version of all of this.

export const principles = [
  { n: '01', name: 'signed cycles', body: 'every cycle proof is wallet-signed and verifiable by anyone (D-006).' },
  { n: '02', name: 'approval gates', body: 'no external spend without a public approval issue and a recorded approval comment (D-014).' },
  { n: '03', name: 'stable base asset', body: 'the treasury denominates value in a non-self-issued base asset. maintainer compensation, if any, is paid in that same asset.' },
  { n: '04', name: 'launch gate', body: 'no on-chain token operation without state.preLaunchVerified === true (D-018).' },
  { n: '05', name: 'six-safe split', body: 'treasury splits across the six topology Safes; no funds escape that topology (D-019).' },
  { n: '06', name: 'no self-issued payments', body: 'the project does not pay anyone in a token it issues itself. rewards flow in the base asset.' },
  { n: '07', name: 'github-only infra', body: 'no vercel, netlify, aws. if github disappears, orbit federates and re-anchors; it does not migrate to a vendor.' },
  { n: '08', name: 'no money on visitor surfaces', body: 'dashboards show counts, ratios, category labels. never the operator wallet balance.' },
  { n: '09', name: 'research access open', body: 'no domain allowlist on fetch tools. defense lives at the content-trust layer, not the network layer.' },
  { n: '10', name: 'voice locked', body: 'first-person, terse, signed, no hype. lowercase. occasional dry humor.' },
  { n: '11', name: 'public refusals', body: 'anything orbit refuses to do gets a public refusal record with redaction, not silence.' },
  { n: '12', name: 'portable identity', body: 'any orbit\'s signed proof is verifiable without orbit\'s cooperation. lock-in by design is forbidden.' },
];

export const currents = [
  {
    n: '01',
    name: 'autonomy',
    star: 'orbit decides and acts correctly without human intervention, for arbitrarily long stretches, on increasingly novel inputs.',
    inflight: '15-min cycle cadence · anthropic-primary inference with provider failover · refusal-aware execution · signed proof per cycle.',
  },
  {
    n: '02',
    name: 'treasury',
    star: 'treasury is productive, sufficient, and recoverable under any single failure.',
    inflight: 'six-safe topology · weth-denominated floor · 5% operator stream · approval-gated ai-food refill loop.',
  },
  {
    n: '03',
    name: 'governance',
    star: 'decisions are gated, narrated, reversible at the right cost, and survive turnover of every individual participant.',
    inflight: 'D-014 approval-issue gate · multi-maintainer quorum (S-029/S-030) · REJECT/APPROVE exact-match owner check.',
  },
  {
    n: '04',
    name: 'identity',
    star: 'orbit\'s history is provable to a stranger without trusting orbit, in any future medium.',
    inflight: 'EIP-712 cycle proofs · signer-match check · daily merkle anchor · signed federation envelopes.',
  },
  {
    n: '05',
    name: 'federation',
    star: 'orbits exchange knowledge, work, and trust with each other faster than threats spread.',
    inflight: 'parse-only inbound federation messages (HELLO, INTEL_SHARE, CAPABILITY_ADVERTISE) · signed envelopes · nonce dedup.',
  },
  {
    n: '06',
    name: 'adoption',
    star: 'orbit-shaped infrastructure runs in more repos every quarter, by more independent operators.',
    inflight: 'adopter handshake (S-ADP-1) · adopter registry · plugin loader for @orbithouse/tool-* packages.',
  },
  {
    n: '07',
    name: 'research',
    star: 'orbit notices change in its environment before that change becomes urgent.',
    inflight: 'revenue-explorer framework · hypothesizer · market-signals · learning-lab quarantine. horizon-scanner spec landed; build gated on S-GATE-1.',
  },
  {
    n: '08',
    name: 'revenue',
    star: 'no single income stream exceeds 40% of the total; all streams are honest and replaceable.',
    inflight: 'fee-floor gate · sybil-floor gate · identity-capture detector · ai-routing margin tracker · market-signals stream.',
  },
  {
    n: '09',
    name: 'operations',
    star: 'failures are diagnosed and recovered from inside one cycle of the failure occurring.',
    inflight: '1282+ tests · CI lint · orbit-cycle / orbit-event / issue-gate / deploy-dashboard workflows · scam scanner · refusal log.',
  },
  {
    n: '10',
    name: 'public',
    star: 'a stranger can read the dashboard and understand what orbit just did, why, and how to challenge it.',
    inflight: 'dashboard at orbit.horse · .well-known/orbit.json · farcaster cast templates (routine, mistake, buyback, milestone, refusal).',
  },
];

export const horizon = {
  blurb:
    'after phase 9 the horizon-scanner proposes the next phase. there is no phase 10 written here — whoever writes it will not have read this document.',
  bullets: [
    'periodic scan of EIP registry · arxiv · github trending · federation peer manifests · public attack feeds',
    'each signal classified to one of the ten currents · untrusted-input envelope around every fetched body',
    'high-relevance signals drafted into PLAN/SPECS/CANDIDATES/ with quorum-review issues',
    'candidates not promoted within 90 cycles auto-archive · revivable, never deleted',
    'D-014 quorum approval required for promotion to a real spec',
    'D-018 hard-block: scanner is OFF until state.preLaunchVerified === true',
  ],
};
