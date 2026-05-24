# Orbit — Risks & Mitigations

> Living document. Reviewed at every S-GATE.

## Top Risks Ranked by Impact × Likelihood

### R-001 — Cycle goes silent post-launch

**Likelihood:** Medium · **Impact:** High (token dies)
**Description:** GitHub Actions break, AI provider quota exhausted, or agent enters loop. Daily casts stop. Token holders lose faith.
**Mitigation:**
- Cron alert if no cycle in 60 minutes (deadman switch)
- Healthcheck workflow runs every 10 min, monitors last cycle timestamp
- Public dashboard shows "last cycle: Xm ago" prominently
- Fallback static caster (separate workflow) posts "Orbit is offline — investigating" if main cycle silent >60m
- AI budget alerts at 50%/75%/90% of daily/monthly via approval issue

### R-002 — Embarrassing public refusal or wrong action

**Likelihood:** Medium · **Impact:** High
**Description:** Agent posts something inappropriate, mishandles a sensitive issue, leaks a secret in a cast, or refuses something it shouldn't.
**Mitigation:**
- Scam scanner extends to outbound — every cast and comment scanned before posting
- Secret redaction patterns extended (already exist in `safety.js`)
- "Cool-off mode" — first 7 cycles after token launch require owner-acknowledged review of every cast
- Public refusal log: own the refusals, narrate them as features
- Incident response template in `lore/templates/incident.md` (Phase 2)

### R-003 — Treasury drained or signer compromised

**Likelihood:** Low · **Impact:** Catastrophic
**Description:** Agent signing key leaked, Safe signer compromised, malicious approval slipped through.
**Mitigation:**
- Safe 2-of-3 minimum (D-004)
- Signing key only ever in GitHub Secrets (encrypted at rest, audited access)
- Spending velocity limits at code level (max X WETH per day)
- Asset whitelist (treasury only holds WETH, $ORBIT, USDC — no random tokens)
- Hard rule: no upgradable contracts that treasury approves
- Recovery: incident response triggers public approval to migrate to new Safe

### R-004 — Token launch fails or fees configured wrong

**Likelihood:** Low (with checklist) · **Impact:** Catastrophic
**Description:** Clanker deploy uses wrong recipients, wrong fee config, wrong token denomination. Hard to fix post-deploy.
**Mitigation:**
- Pre-deploy checklist (in `CLANKER_FEE_STRATEGY.md`)
- Test deploy first if Clanker supports testnet, or do tiny mainnet test with throwaway addresses
- Pair-program the deploy with second person reviewing each field
- All addresses confirmed in `DEPLOY_PLAN.md` and matched to env vars before deploy
- Recipient `admin` set to Safe so misrouted recipients can be migrated by multisig vote

### R-005 — No adopters appear

**Likelihood:** Medium · **Impact:** Medium (caps upside, doesn't kill)
**Description:** Despite ship plan, no second repo runs Orbit in first 60 days. Project reads as one-repo stunt.
**Mitigation:**
- Pre-launch: owner personally onboards 2 friends to use Orbit. Contrived is fine.
- `create-orbit-repo` must be genuinely friction-free — test with someone unfamiliar with the project
- Adoption incentive: first 10 adopters get a special role/recognition in the registry
- Cast every new adopter as a milestone
- If 30 days with 0 organic adopters: rethink positioning, possibly pivot harder toward narrative

### R-006 — Regulatory exposure

**Likelihood:** Low (current US/EU climate) · **Impact:** High
**Description:** Token classified as security. Treasury operations classified as unlicensed financial activity. Founder identified and pursued.
**Mitigation:**
- Token has no profit-sharing claim, no buyback guarantee, no representation of equity
- Treasury operations entirely public, on-chain, with public receipts
- Founder operates as individual until/unless meaningful revenue triggers a need for entity (consult lawyer at that point)
- No promises about returns ever made
- Lore/docs explicitly state $ORBIT is a participation token, not equity
- Geographically: avoid US-marketing-targeted language; lead with global/crypto-native framing

### R-007 — Volume dries up; treasury growth stalls

**Likelihood:** High · **Impact:** Medium
**Description:** Launch attention fades after 30 days. Daily trading volume drops to $5k. Fee capture drops to near-zero. Treasury can't fund AI or buybacks.
**Mitigation:**
- WETH-denominated treasury (D-002) means already-captured funds aren't volatile
- 30 days of pre-launch stockpile in operator wallet (founder funds initial AI from own pocket if needed)
- Buyback frequency adapts to volume — weekly when there's something to buy, monthly when small
- Real product (scanner, federation, bounties) creates demand beyond pure speculation
- Multiple revenue paths in Phase 3 (subscriptions, federation fees, plugin economy) buffer against volume collapse

### R-008 — Founder burnout / steps back too fast

**Likelihood:** Medium · **Impact:** High (token tanks)
**Description:** Owner exhausted from sustained cadence. Casts go from daily to weekly to silent. Token holders interpret as abandonment.
**Mitigation:**
- Build for sustainable cadence, not heroic effort
- Daily casts mostly auto-generated by agent — owner reviews, not writes
- "Vacation mode" template — narrate planned absences as part of the lore ("Orbit's housemate is away for 2 weeks; here's what happens automatically")
- After Phase 2, agent handles 80% of public surface
- Second-account voice (D-010) means founder absence ≠ Orbit absence

### R-009 — Clanker protocol changes break our setup

**Likelihood:** Medium · **Impact:** Medium
**Description:** Clanker upgrades fee config, changes locker contract, or deprecates v4. Our recipient setup breaks.
**Mitigation:**
- Recipients have `admin` set to Safe — can migrate
- Monitor Clanker docs + Discord (set as weekly task)
- If Clanker upgrades, migration is an approval-gated public event (good content opportunity)

### R-010 — Sniper / MEV attack at launch

**Likelihood:** High (any Clanker launch) · **Impact:** Low-Medium
**Description:** Bots buy the first 10 seconds and dump on retail.
**Mitigation:**
- Use v4.1 anti-sniper if available (80% start fee decaying over 30s)
- If v4.1 unavailable: launch with high starting fee that we manually decay
- Announce launch time loosely, not precisely
- Don't broadcast contract address until 30 seconds after deploy
- Treasury benefits from sniper fees regardless (it's still our 73% cut in WETH)

### R-011 — Memory drift / schema corruption

**Likelihood:** Low · **Impact:** Medium
**Description:** Bad cycle writes corrupt JSON to `memory/*.json`. Subsequent cycles inherit broken state.
**Mitigation:**
- `policyVersion` field on every memory file (already exists in governance.json — wire actual migrations in Phase 2)
- Backup: every memory file's history is in git — rollback is `git revert`
- Healthcheck validates JSON parseability on every cycle start
- Schema validator in CI prevents bad shapes from landing

### R-012 — AI provider deplatforms or rate-limits Orbit

**Likelihood:** Low · **Impact:** Medium
**Description:** Provider terminates account, banks won't process payments, ratelimits drop quality.
**Mitigation:**
- Multi-route AI provider list (already in `memory/ai-providers.json` shape)
- Fallback to deterministic planner (already exists for AI-unavailable)
- Provider list is private (`ORBIT_AI_PROVIDERS` env var) — outside attackers don't know which to target
- Top up via multiple payment methods

### R-013 — GitHub Actions deprecated or rate-limited

**Likelihood:** Low · **Impact:** High
**Description:** GitHub changes Action quotas, breaks the cron schedule, deprecates Node 24.
**Mitigation:**
- `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24` already in workflows — track Node version requirements
- Cycle code is mostly portable — could move to dedicated runner (cheap VPS) if forced
- Monitor GitHub Actions changelog monthly
- Have a "dedicated runner" migration playbook drafted in Phase 2

### R-014 — Lore voice drifts; brand becomes inconsistent

**Likelihood:** Medium · **Impact:** Low
**Description:** Cast voice changes over months. Receipts get pretty. Household metaphor fades. Orbit reads generic.
**Mitigation:**
- 90-day brand decay test (in `BRAND.md`)
- Voice guide is read on every lore write
- Founder reviews cast templates monthly
- Anniversary cycles re-anchor in original voice

### R-015 — Community turns hostile

**Likelihood:** Medium · **Impact:** Medium
**Description:** Aggrieved early seller, accidental drama, real or fabricated controversy. Crypto Twitter / Farcaster pile-on.
**Mitigation:**
- Refusal-first culture: Orbit refuses bad-faith engagement automatically
- Public receipt for every claim — drama-by-vibes can't survive a signed proof
- Founder doesn't engage in pile-ons; lets Orbit's record speak
- Crisis protocol: lock the Farcaster account, post one fact-only response with receipts, ride it out
- Don't try to be liked — be reliable

## Mitigation Owner Map

| Mitigation Category | Owner | Cadence |
|---|---|---|
| Cycle reliability monitoring | Agent (deadman) + Owner (manual check) | Daily |
| Outbound content scanning | Agent (extension of scam scanner) | Every cast |
| Treasury security | Safe signers + Agent (velocity limits) | Continuous |
| Pre-deploy verification | Owner (checklist) | One-time at launch |
| Adoption push | Owner | Phase 1 + ongoing |
| Regulatory monitoring | Owner | Quarterly |
| Volume / revenue tracking | Agent + dashboard | Every cycle |
| Founder sustainability check | Owner (self) | Monthly |
| Clanker protocol monitoring | Owner | Weekly |
| Sniper protection at launch | Owner (config) | One-time |
| Schema validation | Agent (CI gate) | Every cycle |
| AI provider redundancy | Owner | Quarterly |
| GitHub Actions monitoring | Owner | Monthly |
| Brand decay check | Owner | Every 90 days |
| Community crisis response | Owner + crisis protocol | As-needed |

## Risks Explicitly Accepted

These are known risks we choose not to mitigate further at this stage:

- **R-A1: Most Clanker launches die.** We accept this baseline. Mitigation is the product itself.
- **R-A2: Founder is a single point of failure for many decisions.** Phase 4 introduces handoff narrative; until then, single-founder dependency is accepted.
- **R-A3: ZK trust layer not shipping at launch.** Signed proofs are sufficient for the launch story. Accepting we forgo the ZK marketing surface.
- **R-A4: No formal legal entity at launch.** Accepted until revenue justifies. Founder operates as individual.
- **R-A5: Limited cross-chain.** Base only. No Ethereum mainnet or Solana. Accepted to keep complexity low at launch.
