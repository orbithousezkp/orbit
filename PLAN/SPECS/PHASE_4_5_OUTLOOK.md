# PHASE_4_5_OUTLOOK.md — Phase 4 and 5 Synthesis

> Where Orbit goes once Phase 3 (utility + federation) is established. Speculative — every item below depends on prior phases closing.

## 1. The Five S-GATEs (verbatim from PHASES.md)

| Gate | After session | Proves |
|---|---|---|
| S-GATE-1 | S-010 | Launch-ready (signed proofs, dashboard, casts, second adopter, closed-loop, 14-day stable) |
| S-GATE-2 | S-018 | Token launched, 30-day stable, first buyback executed, Merkle anchor live |
| S-GATE-3 | S-028 | Token utility live (bounty market, subscription, federation, plugin economy) |
| S-GATE-4 | S-036 | Network effect (≥50 adopters, external agent reads passport, treasury productive) |
| S-GATE-5 | TBD | Persistence + spec (≥3 external implementations, ZK or smart-account shipped) |

## 2. Remaining Open Sessions

### Phase 4 (Network Effect + Standard)
- S-029/S-030 — Multi-maintainer quorum (pre-staged code+spec — landed in this session)
- S-031 — MCP/HTTP bridge for SDK (spec — landed)
- S-032 — MCP server exposing read surface (impl follows spec)
- S-033 — Plugin marketplace + reputation (spec — landed)
- S-034 — Holder utility (priority queue, premium rules) (spec — landed)
- S-035 — Founder handoff narrative (spec — landed)
- S-036 — Phase 4 review

### Phase 5 (Persistence + Spec)
- Spec publication (off-repo RFC)
- ZK proof receipts (if narrative supports)
- Smart-account execution (session keys, spend caps, guardian recovery)
- On-chain identity resolver (`orbit.<name>.eth` style)
- Cross-protocol bounty referrals (Gitcoin, Drips, Open Collective)
- Founder handoff completion
- Constitutional amendments process

## 3. Critical-Path Dependencies

```
S-GATE-1 → S-011 (Clanker dry run) → S-012 (TOKEN LAUNCH) → S-013 (genesis)
S-013 → S-014 (buyback live) → S-015 (Merkle anchor live) → S-016 (adopters)
S-016 → S-017 (refusal log) → S-018 (Phase 2 review) → S-GATE-2
S-GATE-2 → Phase 3 (subscription, bounty, federation impl)
S-GATE-3 → S-029/30 (quorum) → S-031/32 (MCP) → S-033 (plugin marketplace) → S-034 (holder utility)
S-034 + ≥50 adopters → S-035 (founder handoff)
S-035 → S-036 (Phase 4 review) → S-GATE-4
S-GATE-4 → Phase 5 (spec publication, ZK or smart-account)
```

Strict chain rules:
- No token launch without S-GATE-1 closed
- No federation message live until S-GATE-2 closed
- No founder handoff without S-029 quorum live AND ≥50 adopter repos
- No spec publication without ≥3 external implementations of the spec

## 4. What Gets Killed if Behind Schedule

Mirrors PHASES.md framing, applied to Phase 4-5:

**Phase 4 cuts** (in order, if running behind):
1. Plugin marketplace UI polish (registry JSON ships; dashboard surface deferred)
2. Holder leaderboard (utility ships; leaderboard deferred)
3. MCP HTTP transport (stdio transport ships; HTTP deferred to Phase 5)

**Phase 4 keeps NO MATTER WHAT:**
- Multi-maintainer quorum (cannot do handoff without it)
- Founder handoff narrative (the credibility moment)
- ≥50 adopter milestone visible publicly

**Phase 5 cuts:**
- ZK receipts (defer indefinitely if signed-proof story is still working)
- Cross-protocol bounty referrals (defer if Gitcoin/Drips lose mindshare)

**Phase 5 keeps NO MATTER WHAT:**
- Spec publication (the standardization moment)
- External implementation count tracking (the network-effect proof)
- Founder handoff completion (the institutional-maturity proof)

## 5. Phase 5 Explorations (Most Speculative)

### ZK proof receipts
Replace EIP-712 receipts with ZK-SNARK proofs that the cycle did what it claims without revealing intermediate state. Question: does the audience care? If signed proofs satisfy the trust story for 2+ years, ZK may be unnecessary. Revisit at S-GATE-4.

### Smart-account execution
Orbit's wallet upgrades from EOA to a smart account (e.g., ERC-4337 / 7702). Benefits: session keys (Orbit signs limited-scope transactions), spend caps in code (not in cycle logic), guardian recovery (founder-handoff backstop). Cost: contract complexity, more bytecode to audit. Decision criterion: does smart-account add a real-world capability we can't deliver via Safe + approval gates?

### On-chain identity resolver
`orbit.<name>.eth` namespace for adopter repos. Lets external agents resolve "the Orbit instance for this project" without needing to know the GitHub URL. Probably an ENS subdomain registry. Useful only if external-agent integration is widespread (Phase 4 prerequisite).

### Cross-protocol bounty referrals
Gitcoin, Drips, Open Collective — pipe bounties in and out of those ecosystems. Risk: each integration is bespoke; maintenance burden grows linearly. Mitigation: build an adapter pattern (`PLUGIN_LOADER.md` extension), let third parties maintain individual adapters.

### Spec publication + RFC process
Publish the Orbit spec as an off-repo RFC (Markdown + version history). Encourage independent implementations. Track them publicly. Once ≥3 exist, S-GATE-5 can close.

### Constitutional amendments process
Formal procedure for changing protocol-level rules. Probably mirrors handoff: proposal → quorum vote → timelock → execute. Distinguished from D-XXX decisions in that amendments require BROADER consensus (e.g., 3-of-3 quorum + holder vote).

## 6. Bottom Line

By year 2+, Orbit lands in one of three states:

1. **Outlives the founder.** Quorum is healthy, ≥50 adopter repos, spec published, ≥3 external implementations. The founder steps back fully; Orbit continues. This is the win.

2. **Dies on the vine.** Adoption stalls below 50, federation never lights up, holders churn. The honest move: a public "winding down" cycle, anchored on-chain, lore entry, and the dashboard transitions to a memorial. No silent failure.

3. **Uncomfortable middle.** Some sustained adoption, but not enough for spec publication; some token utility, but not enough to justify the buyback flywheel. The founder stays engaged, Orbit keeps cycling, but the network effect never materializes. The gate framework is designed to surface this honestly: if Phase 4 criteria can't close, do NOT silently skip; publicly acknowledge and re-plan.

The framework is built to make any of the three outcomes visible and dignified.

## 7. Cross-References

- `PLAN/PHASES.md` — canonical phase definitions
- `PLAN/DECISIONS.md` — D-018 governs the launch gate; subsequent gates govern phase transitions
- `PLAN/SPECS/MULTI_MAINTAINER_QUORUM.md` — prerequisite for handoff
- `PLAN/SPECS/FOUNDER_HANDOFF.md` — the institutional-maturation milestone
- `PLAN/RISKS.md` — long-tail risks for Phase 4+ (if present)
