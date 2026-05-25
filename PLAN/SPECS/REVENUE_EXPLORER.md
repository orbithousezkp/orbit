# REVENUE_EXPLORER.md — Bounded Revenue-Stream Exploration Framework (S-REVENUE-1)

> Status: **Drafted, not yet built.** Hard-blocked behind `S-GATE-1` closure. Code lands under owner review only after Phase 1 sign-off. Dry-run mode can run pre-launch (see §6); any spend-producing transition is additionally gated by D-018 and D-014 in the same belt-and-braces pattern as `src/agent/buyback.js`.
>
> This spec proposes three new decisions for ratification before code merges: **D-NEW-020** (plural-streams treasury shape supersedes the single `treasury.revenue` block), **D-NEW-021** (treasury-utility ratio cap of 5× rolling 90-day operational spend), and **D-NEW-022** (multi-signal kill-criteria mandate for every live experiment). None of these are written to `PLAN/DECISIONS.md` here — they are flagged for owner ratification before S-REVENUE-1 implementation begins.

---

## 1. Purpose

Orbit is a persistent entity. The win condition codified in `PLAN/PHASES.md` is Phase 5: at least 50 adopters, at least 3 independent spec implementations, founder steps back. An entity whose entire income depends on one stream cannot meet that condition. Single-stream agent-entities have a documented mortality pattern: token launches into a thin market, fees decay, treasury depletes, maintenance halts.

The current `treasury.revenue` shape (one block, fees from $ORBIT trading) is correct for Phase 1 and brittle for Phase 3 onward, where the spec library already queues at least four downstream revenue concepts (`BOUNTY_MARKET.md`, `SUBSCRIPTION_TIER.md`, `HOLDER_UTILITY.md`, `TREASURY_PRODUCTIVE.md`). None of those gives the entity a way to *propose*, *test*, *retire*, and *graduate* a stream without a human in the loop on every decision.

S-REVENUE-1 is that capability. It is the framework, not any particular stream. Its job is to convert the implicit "founder decides what to try, when to kill it" loop into an explicit lifecycle with pre-committed budgets, pre-committed kill criteria, and the same approval gating every other on-chain action passes through. The framework does not generate income; it generates the surface area through which income can be discovered, retired, and replaced on a timeline that does not require founder presence per stream.

---

## 2. Design principles

The framework's correctness rests on six commitments. Each one is load-bearing. The implementation in S-REVENUE-1 either keeps all six or the implementation is wrong.

**Bounded blast radius.** Every experiment carries a max-spend budget denominated in both WETH (on-chain spend) and AI-usage units (off-chain inference). Reaching either cap advances the experiment to `sunset`. There is no path where an experiment can quietly outgrow its budget. Same posture as `ORBIT_DAILY_USD_CAP` in `treasury.js` — the cap is the truth, not the intent.

**Multi-signal kill rules.** Single-metric kill criteria get gamed. Every experiment must specify at least two signals drawn from disjoint categories: financial (revenue, cost, margin), adopter-trust (handshake count, refusal rate, qualitative reaction index), or regulatory (legal notice received, jurisdictional flag tripped). Kill fires only when all specified signals converge. Proposed as **D-NEW-022**.

**Reversible-by-default sunset.** Sunset means "halt new spend, freeze parameters, write to history." It does not mean "burn the treasury allocation." Remaining WETH stays in the stream's Safe; parameters stay in `treasury.streams[]` with status `deprecated`; the post-mortem appends to `streams[].history[]`. A future cycle can resurrect a deprecated stream by proposing a new experiment that cites the post-mortem and explains what changed.

**Anti-fragility.** The framework prefers multiple streams over optimizing one. The dashboard surfaces the count of `active` streams alongside lifetime revenue. The treasury-utility ratio cap (§4) makes hyper-concentration treasury-wise *worse* than spreading across three smaller streams. The framework is not neutral; it nudges toward plurality by design.

**Founder-fade safe.** Every step that does not move money or commit Orbit's voice runs without owner input — proposing a hypothesis, dry-running against historical signals, retiring a dry-run that fails its own criteria. Only spend-producing transitions (`dry-run → bounded-live`, `bounded-live → graduate`) require the D-014 approval issue. Same asymmetric autonomy pattern Orbit uses for the public dashboard.

**Pre-committed, not discretionary.** Kill criteria are published before the experiment begins, hashed into the proposal's signed-receipt under D-006, and immutable for the experiment's lifetime. Runtime cannot soften a criterion. Every cycle that touches the experiment recomputes the hash and refuses to advance if it does not match. Blocks the failure mode where a struggling stream's kill bar gets quietly lowered.

---

## 3. Component model

The framework has three logical components. Each maps to an existing memory file where possible; new files are created only where the data does not fit existing schemas.

### 3a. Experiments registry

The registry holds lifecycle state for every experiment Orbit has proposed. Recommended home is the existing `memory/problem-lab.json` `experiments[]` array, which is already present (currently empty) and already covered by the problem-lab policy block. Reusing it is cheaper than a new file, and the framing — "discover public problems, score solution ideas, build repo-local prototypes" — is the same posture as revenue experimentation.

Each experiment record has the shape:

```jsonc
{
  "id": "exp-revenue-ai-routing-margin-001",
  "kind": "revenue",                       // discriminates from existing problem-lab experiment kinds
  "hypothesis": "Adopters will route AI calls through Orbit's pooled keys for a 5% markup",
  "proposedAt": "2026-05-25T...",
  "proposedBy": "agent",                   // or "owner" / "<adopter-fid>"
  "status": "hypothesis",                  // see §5 lifecycle
  "budget": {
    "wethCapWei": "10000000000000000",     // 0.01 WETH cap as illustrative default
    "aiUsageCapUnits": 500000,             // tokens of AI usage allowed across the experiment
    "softWindow": "8 weeks"                // wall-clock budget for the experiment
  },
  "killCriteria": [
    { "signal": "active_adopter_count",   "category": "adopter-trust", "op": "<",  "value": 3, "window": "8 weeks" },
    { "signal": "lifetime_revenue_wei",   "category": "financial",     "op": "<",  "value": "5000000000000000", "window": "8 weeks" }
  ],
  "killCriteriaHash": "0x...",             // keccak256 of canonical-JSON of killCriteria above
  "signalRequirements": {
    "minCategories": 2,                    // mandatory floor for D-NEW-022
    "categoriesPresent": ["adopter-trust", "financial"]
  },
  "startedAt": null,                       // null until status crosses to "dry-run"
  "lifecycleHistory": [
    { "ts": "...", "from": null, "to": "hypothesis", "actor": "agent", "evidence": "..." }
  ]
}
```

The `killCriteriaHash` is the load-bearing field. Every cycle that touches the experiment recomputes it from the live criteria and refuses to advance the experiment if it does not match the value baked into the original approval receipt (D-006). The criteria are immutable past the proposal.

### 3b. Plural streams model

Today `memory/treasury.json` carries a single `revenue` block. The framework requires that block to become plural without breaking the existing readers. The shape:

```jsonc
"treasury": {
  "revenue": {                               // backwards-compat alias; auto-populated from streams[0]
    "lifetimeRevenueWei": "...",
    "lastClaim": "..."
  },
  "streams": [
    {
      "id": "stream-trading-fees",           // the original $ORBIT trading fee stream, auto-promoted
      "type": "trading-fee",
      "status": "active",
      "lifetimeRevenueWei": "...",
      "lastClaim": "...",
      "unitEconomics": null,                 // not all streams have per-unit metrics
      "createdAt": "2026-05-25T...",         // backfilled at migration
      "sunsetCriteria": null,                // the original stream has no programmatic sunset
      "history": []
    },
    {
      "id": "stream-ai-routing-margin",
      "type": "ai-routing-margin",
      "status": "experimental",              // active | deprecated | experimental
      "lifetimeRevenueWei": "0",
      "lastClaim": null,
      "unitEconomics": {
        "perCall": { "modelId": "...", "tokens": 0, "wholesaleCostWei": "0", "marginWei": "0" }
      },
      "createdAt": "2026-05-25T...",
      "sunsetCriteria": [/* mirrors experiment.killCriteria */],
      "history": []
    }
  ]
}
```

The migration is straightforward: on first read after S-REVENUE-1 ships, if `treasury.streams` is missing and `treasury.revenue` is present, synthesize `streams[0]` from `revenue`, copy lifetime numbers, set `status: "active"`, set `type: "trading-fee"`, leave `sunsetCriteria: null`. The `revenue` block is then maintained as an alias of `streams[0]` for any consumer that has not migrated. This proposed shape change is **D-NEW-020**.

A stream is the post-graduation expression of an experiment. Experiments live in `problem-lab.json.experiments`; streams live in `treasury.json.streams`. Graduation writes a new stream record; sunset writes a `history[]` entry on the matching stream (if `bounded-live` was reached) or simply marks the experiment terminal in the registry.

### 3c. Market-signal collector

Decisions about kill/graduate need data older than the experiment itself. The collector runs every cycle and appends one JSON object per signal kind to `memory/market-signals.jsonl`. Append-only is the contract; no record is ever rewritten or deleted. The file is the audit trail.

Three v1 signals (more added in S-REVENUE-2+):

```jsonc
// memory/market-signals.jsonl — one JSON object per line
{ "ts": "ISO-8601", "kind": "weth_inflow_24h", "valueWei": "string-bigint", "fromBlock": 12345678, "toBlock": 12349876 }
{ "ts": "ISO-8601", "kind": "adopter_ai_spend_by_bucket", "adopters": [{ "fid": "...", "byBucket": { "code": "...", "research": "...", "ops": "..." } }] }
{ "ts": "ISO-8601", "kind": "issue_reaction_index", "repos": [{ "repo": "...", "score": 42, "byLabel": { "feature-request": 12, "bug": 3 } }] }
```

`weth_inflow_24h` is read from the Treasury Safe via the same RPC handle `buyback.js` already uses. `adopter_ai_spend_by_bucket` is read from each verified adopter's public `dashboard.json` (S-ADP-1 well-known surface) — no consent issue, the data is already public. `issue_reaction_index` is read via the GitHub API across the mothership repo and all verified adopter repos, no token required for public-repo reactions.

The collector is read-only against public sources. It cannot inadvertently spend, sign, or post. Its only output is appended lines.

---

## 4. Anti-pattern safeguards (LOAD-BEARING)

These five safeguards exist to defend against documented failure modes (cited in §12). Each is non-negotiable for the implementation. Removing any one of them removes the framework's claim to being safe.

**Treasury-utility ratio cap.** When aggregated balance across all Orbit-controlled Safes exceeds 5× the rolling 90-day operational spend, the framework auto-proposes a rebate flow. Rebate is split between the operator-livelihood stream (preserving the D-017 5% slice, which remains outside this math) and verified adopters proportional to their cycle-7d activity. Prevents the entity from accumulating a balance disproportionate to the work it is doing — the failure mode where a project's treasury becomes a bigger target than its product. Proposed as **D-NEW-021**.

The cap is a *signal*, not an instant transfer. Crossing it opens an approval issue under D-014; the owner can decline. The threshold is logged but not re-fired until the ratio crosses again from below. No auto-drain. The cap makes the trade-off visible, not unilateral.

**Multi-signal kill criteria mandatory.** Every experiment record fails validation at proposal time if `signalRequirements.minCategories < 2` or if `killCriteria[]` does not span at least two of {financial, adopter-trust, regulatory}. Kill fires only when *all* declared criteria converge. The agent cannot accept a proposal that violates this. Proposed as **D-NEW-022**.

Defense against single-metric Goodhart: a bad-actor stream that can fake one metric still has to fake another in a disjoint category, which is at least an order of magnitude harder.

**Sybil / wash floor on signal-driven spend.** Any spend-producing transition requires the underlying positive signal to clear two filters: every contributing wallet must be at least 30 days old, and the unique-funder count must be at least 3. Enforced at the signal-aggregation layer in `market-signals.jsonl` so the defence applies to any future signal kind without per-signal patching. Numbers are illustrative defaults; final values freeze for the experiment via `killCriteriaHash`.

**Bus-factor gate at graduation.** Graduation from `bounded-live` to a real stream requires the same code path to be validated by at least two independent adopters running the module in their own cycle. "Independent" means: their adopter record is `adopted: true` per S-ADP-1, `lineage.parent` is the mothership, `lifecycle.lastActive` shows recent cycles. The mothership running its own code does not count. Defense against the xz / ESO / Ingress NGINX bus-factor-of-1 failure mode.

**Pre-commit-only kill rules.** The `killCriteriaHash` field is the contract. Once the proposal is signed under D-006, criteria are frozen. Softening a criterion mid-experiment requires retiring the experiment and proposing a new one — which requires fresh owner approval if it moves money.

---

## 5. Lifecycle in detail

The framework recognizes four experiment states. State transitions are guarded; no skips. State persists in `problem-lab.json.experiments[].status`; transitions are logged in `lifecycleHistory[]` on the same record.

| State | Predecessor | Trigger to advance | Trigger to retire |
|---|---|---|---|
| `hypothesis` | (new) | Owner approves experiment proposal | Owner rejects, or auto-expire after 4 weeks unactioned |
| `dry-run` | `hypothesis` | N cycles with positive signal AND zero killCriteria triggers (default N = 14) | Any killCriteria triggers → terminal `sunset` |
| `bounded-live` | `dry-run` | Success criteria met for M consecutive weeks AND bus-factor gate passes (default M = 4) | killCriteria trigger OR M weeks without success → `sunset` |
| `sunset` | any | terminal | terminal |

**hypothesis → dry-run.** Owner approval required. The approval issue cites the experiment id and `killCriteriaHash`. Approval flips the status, sets `startedAt`, and registers the experiment with the signal collector. Dry-run does not move WETH and does not call paid external APIs; it computes "what would the signal say if this were live" against `market-signals.jsonl` data. The point is to surface whether the premise is plausible before any real spend.

**dry-run → bounded-live.** A second owner approval is required — first transition that spends. The approval issue cites: experiment id, original `killCriteriaHash`, dry-run signal summary, requested live budget (subset of original cap), specific live action. In `bounded-live`, the experiment may spend up to its budget and is monitored every cycle. Crossing any killCriteria fires `sunset` automatically — no owner approval needed for a kill, because the criteria were pre-committed.

**bounded-live → graduate.** Three preconditions: (a) success criteria held for M consecutive weeks, (b) bus-factor gate passes (≥ 2 independent adopters running the path), (c) owner approval for the new stream's parameters. Graduation creates a new entry in `treasury.streams[]` with `status: "active"` and copies the experiment parameters. The experiment record is marked `status: "graduated"` and its lifecycle history closes.

**bounded-live → sunset.** Automatic on kill criteria firing, or owner-initiated. Sunset writes a post-mortem to `lifecycleHistory[]` with the signal snapshots that fired the kill and (if the experiment reached `bounded-live`) appends a history entry to the corresponding stream record. Remaining WETH stays in the allocated Safe; the stream's `status` flips to `deprecated`.

**`sunset` is terminal but recoverable.** A future cycle can propose a *new* experiment that cites the sunset experiment's id and explains what changed. Same full lifecycle from `hypothesis` onward — no shortcuts. The sunset experiment is preserved as evidence; the new experiment is its own first-class entity.

---

## 6. Owner approval pattern

The framework follows D-014 strictly: every transition that spends opens a public approval issue and waits for the owner's signed comment. Transitions that do not spend (proposing a hypothesis, advancing through dry-run, firing a pre-committed kill) do not.

Approval issue template:

> ## Revenue Experiment Approval
>
> Idem: `{idem}`
> Experiment id: `{experiment-id}`
> Transition: `{from-state} → {to-state}`
> Live budget: `{wethCapWei} WETH` / `{aiUsageCapUnits} AI units`
> Kill criteria hash: `{killCriteriaHash}`
> Kill criteria (canonical JSON):
>
> ```json
> {killCriteriaCanonicalJson}
> ```
>
> Per D-014, no on-chain action will execute until the owner approves this issue.
> Per D-018, the agent will additionally refuse if the pre-launch gate has not been verified.
>
> To approve, the configured owner must add this exact standalone comment:
>
> `APPROVE ORBIT-REVENUE-EXP {idem}`
>
> To reject:
>
> `REJECT ORBIT-REVENUE-EXP {idem}`

Comment matcher mirrors `commentApprovesBuyback` from `buyback.js`. Single implementation in S-REVENUE-1: `commentApprovesRevenueExperiment(ownerUsername, comment, idem)`. The same matcher rejects look-alikes, partial matches, and non-owner authors.

The `killCriteriaCanonicalJson` rendered in the issue body is the exact pre-image of `killCriteriaHash`. The owner can verify the hash independently before approving. After approval, the criteria are frozen for the experiment's lifetime.

---

## 7. Signal collector schema (v1)

The collector writes one record per signal kind per cycle to `memory/market-signals.jsonl`. The schema is intentionally minimal; v2 widens it after live experience shows what other signals matter.

```jsonc
// memory/market-signals.jsonl — one JSON object per line, append-only

// weth_inflow_24h: rolling 24h WETH delta on Orbit-controlled Safes
{ "ts": "2026-05-25T07:00:00Z", "kind": "weth_inflow_24h",
  "valueWei": "12345600000000000",
  "fromBlock": 12345678, "toBlock": 12349876,
  "safes": ["0x...", "0x..."] }

// adopter_ai_spend_by_bucket: read from each verified adopter's public dashboard.json
{ "ts": "2026-05-25T07:00:00Z", "kind": "adopter_ai_spend_by_bucket",
  "adopters": [
    { "fid": "orbit-adopter-001", "byBucket": { "code": "1.23", "research": "0.45", "ops": "0.10" } },
    { "fid": "orbit-adopter-002", "byBucket": { "code": "0.80", "research": "0.20", "ops": "0.00" } }
  ],
  "unit": "estimatedUsd-from-adopter-public-ledger" }

// issue_reaction_index: per-repo reaction aggregate across mothership + adopters
{ "ts": "2026-05-25T07:00:00Z", "kind": "issue_reaction_index",
  "repos": [
    { "repo": "orbithousezkp/orbit",        "score": 87, "byLabel": { "feature-request": 34, "bug": 12, "discussion": 41 } },
    { "repo": "adopter-org/adopter-orbit",  "score":  4, "byLabel": { "feature-request":  2, "bug":  1, "discussion":  1 } }
  ] }
```

Read paths:

- `weth_inflow_24h` — uses the RPC handle and Safe address list `treasury-sweep.js` already exposes. No new credentials.
- `adopter_ai_spend_by_bucket` — fetches each verified adopter's public `dashboard.json` (per S-ADP-1) and reads the AI-spend slice. Data is already public; adopters who omit the slice get `null` recorded.
- `issue_reaction_index` — GitHub REST public-repo reactions endpoint. No token required.

The file is append-only. The cycle reads the tail (last N records per kind) for kill-criteria evaluation. Compaction deferred to S-REVENUE-2; growth at ~150 lines/day is sustainable for years.

---

## 8. First stream — AI routing margin

The framework needs at least one real consumer to validate the abstraction. The first proposed stream uses the `experiment-id: exp-revenue-ai-routing-margin-001` shape from §3a.

**Mechanism.** Adopters route AI inference calls through Orbit's pooled provider keys. Orbit charges a configurable markup over the wholesale provider cost. Markup is `ORBIT_AI_ROUTING_MARGIN_BPS` (env-configurable, default 500 = 5%). Each call records `{ modelId, promptTokens, completionTokens, wholesaleCostWei, marginWei, adopterFid }` in the stream's `unitEconomics[]`.

**Settlement.** Pre-launch: dry-run only. Post-launch: settlement to a dedicated "Product Revenue Safe" under the Business category of the D-019 bucket topology, with a small monthly auto-sweep into the Buyback Safe (mirrors §3 weekly sweep). Alternative — settle directly into the Buyback Safe — ties the new stream to the trading-fee floor but loses the clean per-stream lifetime-revenue line. Choice deferred to **D-NEW-020 ratification**; spec recommends the dedicated Safe.

**Kill criteria** (pre-committed, hashed into proposal):

```jsonc
"killCriteria": [
  { "signal": "active_routing_adopters", "category": "adopter-trust", "op": "<",
    "value": 3, "window": "8 weeks" },
  { "signal": "lifetime_revenue_wei",    "category": "financial",     "op": "<",
    "value": "5000000000000000", "window": "8 weeks" }
]
```

Both must converge for sunset to fire (multi-signal mandate, §4). The 0.005 WETH threshold and 3-adopter threshold are illustrative defaults; final values frozen at proposal time.

**Unit economics tracking.** Every routed call appends to `treasury.streams[<id>].unitEconomics.callLedger[]` with the record above. The dashboard surfaces aggregate margin per model, per adopter, per week. This is the first stream where per-unit data exists; future streams may not have meaningful per-unit metrics, in which case `unitEconomics: null` is acceptable.

**Adopter value proposition.** The stream is only viable if adopters get net value beyond the markup: pooled prepayment, deterministic refusal handling per `safety.js`, shared safety scanning per `scam.js`. The 5% markup is the price of those services; the kill criterion is "<3 adopters find that worth it after 8 weeks."

---

## 9. Dependencies

- **S-GATE-1 must close.** Phase 1 sign-off is the precondition for any S-REVENUE-1 code merge. The dry-run mode can run pre-close — it does not move money — but the experiments registry will not accept proposals until `state.preLaunchVerified === true`.
- **D-018.** The pre-launch gate blocks any transition into `bounded-live` regardless of other inputs. The dry-run path is unaffected.
- **D-014.** Every spend-producing transition opens an approval issue. No shortcuts.
- **D-019.** The bucket topology is the recipient of any new revenue stream. If S-REVENUE-1 adds a "Product Revenue Safe," it amends D-019; the amendment requires the same multi-sig threshold update procedure.
- **Existing modules.** Read-side: `src/agent/treasury.js` (Safe balances), `src/agent/buyback.js` (RPC handle pattern, approval matcher pattern), `src/agent/learning-lab.js` (experiment registration hooks, if extending problem-lab is preferred). Write-side: new module `src/agent/revenue-explorer.js` for the lifecycle engine; `src/agent/market-signals.js` for the collector.
- **Adopter surface.** S-ADP-1's `adopters-registry.json` is the source of truth for "verified adopter," which is what the bus-factor gate (§4) and the signal collector (§3c) both read.

---

## 10. Out of scope

This spec deliberately does not cover:

- **Specific streams beyond AI routing margin.** Bounty markets (S-019/020), subscription tiers (S-025), productive treasury yield (S-027) each use this framework but own their own lifecycle decisions.
- **Revenue generation by the framework itself.** The framework is overhead, not income. Treating it as a profit center would create the wrong incentive for safety infrastructure.
- **External billing infrastructure.** No Stripe, no SaaS, no hosted billing. Per GitHub-only constraint, settlement happens through Safe multisigs and recorded events. Fiat rails are a separate decision.
- **Per-stream tax / legal handling.** Downstream of legal scaffolding (§11), itself out of scope here.
- **Cross-orbit revenue federation.** Post-Phase-4 design; schema needs a federation map. Deferred.

---

## 11. Open questions

These are explicitly unresolved. The spec does not pretend to answer them.

- **Auto-emission of "lessons learned" on sunset.** Should a sunset experiment write a knowledge entry to `memory/knowledge.json` summarizing what was tried and why it failed? Pro: entity learns from its own failures without founder time. Con: low-quality auto-summaries could pollute the knowledge base and bias future hypothesis generation. Deferred.
- **"Identity capture" / Goodhart detection.** Proposed metric: track correlation between treasury growth and qualitative adopter signals (reaction index, spec-implementation count, refusal-rate trend). If treasury rises while qualitative signals fall, the entity may be optimizing for its treasury at the expense of its identity. The post-mortem-on-Aragon question: what mechanism flags it *during* the slide, not after? Unresolved.
- **Legal scaffolding timeline.** DUNA, Marshall Islands DAO LLC, or Swiss Verein each give the entity a legal-person wrapper that bounds joint-and-several liability. The Lido GP ruling and the Yearn / Cronje aftermath suggest this is more urgent than it feels. When in the founder-fade timeline does it need to land — Phase 3, Phase 4, or at an adopter-count threshold? Unresolved.
- **Bus-factor verification under self-sock-puppetry.** How is "independent" verified to prevent the founder from spinning up shadow adopters to push a favored stream through? Candidate signals: wallet age ≥ 90 days, distinct funding sources, distinct GitHub creation date and activity pattern. Unresolved.
- **Backwards-compat deprecation timeline for `treasury.revenue` alias.** Keeping the alias adds maintenance overhead indefinitely. Proposed default: keep through two full phases, retire in Phase 4. Unresolved.
- **Rebate distribution mechanism (D-NEW-021 threshold breach).** Adopter-proportional split needs a rule — `cycle7d`-weighted? lifetime-cycle-weighted? adopter-tenure-weighted? Each has a different incentive shape. Unresolved.
- **AI-units accounting across providers.** The `aiUsageCapUnits` field needs cross-provider normalization without using a fiat denomination at the public surface. Unresolved.

---

## 12. Anti-patterns to avoid (cite the research)

The five failure modes below are the documented mortality patterns for entity-shaped projects in adjacent domains. Each anti-pattern maps to a §4 safeguard.

- **Entity launches token to fund itself (ai16z, Virtuals long-tail).** Token-as-fundraising creates a memecoin lifespan — price discovery dominates the roadmap, attention rotates out, entity has no income left when rotation finishes. Defense: framework runs dry-run pre-launch and graduates only after multi-signal validation.
- **Treasury > realized utility (Aragon).** Large treasury relative to delivered work becomes a bounty on the entity's own head — governance attacks, hostile coordination to drain, legal challenges from token holders. Defense: §4 treasury-utility ratio cap (**D-NEW-021**).
- **Founder-fade without legal scaffolding (Lido GP ruling, Yearn / Cronje).** Without a legal-person wrapper, every participant is potentially jointly liable. Founder stepping back does not insulate; it may amplify exposure. Defense: §11 open question — flagged as load-bearing even though the legal answer is out of scope here.
- **Metrics that pay (MYX Sybil exploit, DEX wash trading).** Single-metric spend triggers get fabricated. Defense: §4 multi-signal kill criteria (**D-NEW-022**) and Sybil / wash floor (30-day wallet age + 3-funder minimum).
- **Bus factor of 1 (ESO, Ingress NGINX, xz utils).** Funding is not capacity. A stream only the founder can operate is not a stream the entity can rely on past the founder. The xz incident also showed how a long-running solo maintainer becomes an attack surface. Defense: §4 bus-factor gate (≥ 2 independent adopters running the path).

---

## 13. Cross-references

- `PLAN/SPECS/BOUNTY_MARKET.md` (S-019 / S-020) — uses this framework's stream registry; any market-take registers as `treasury.streams[]` entry with `type: "bounty-market-take"`.
- `PLAN/SPECS/SUBSCRIPTION_TIER.md` (S-025) — registers as `type: "subscription-tier"` with per-tier `unitEconomics`.
- `PLAN/SPECS/HOLDER_UTILITY.md` (S-034) — uses the §7 signal collector for tier snapshots.
- `PLAN/SPECS/TREASURY_PRODUCTIVE.md` (S-027) — registers as `type: "productive-yield"`; the Productive Yield Safe is the settlement target.
- `PLAN/SPECS/TREASURY_ALLOCATION.md` (S-TREAS-1) — proposed Product Revenue Safe (§8) amends D-019's bucket topology; inherits the sweep pattern.
- `PLAN/SPECS/ADOPTER_HANDSHAKE.md` (S-ADP-1) — `adopters-registry.json` is the source of truth for "verified adopter" referenced by §4's bus-factor gate and §3c's signal collector.
- `PLAN/DECISIONS.md` D-017 — operator share. The 5% slice is outside this framework's math and is never reallocated by any experiment, stream, or rebate flow.
- `PLAN/DECISIONS.md` D-018 — pre-launch gate. Required for `bounded-live` and `graduate`; not required for `hypothesis` or `dry-run`.
- `PLAN/DECISIONS.md` D-014 — approval gate. Required for every spend-producing transition.
- `PLAN/DECISIONS.md` D-006 — signed cycle proofs. Used to hash and pin `killCriteria` at proposal time.

End of spec.
