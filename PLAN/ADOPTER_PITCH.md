# ADOPTER_PITCH.md — One-Page Pitch For New Orbit Adopters

> Use this when introducing Orbit to a repo maintainer. One page, no jargon, no hype.

---

## What Orbit Is

A **GitHub-native control plane** for AI agents that act inside your repo. It gives you:

- **Memory** that survives across runs — agents remember decisions and previous cycles.
- **Permissions** with public approval gates — no agent action without a paper trail.
- **Signed proofs** of every cycle — EIP-712 receipts you can verify with `npx @orbithouse/verifier`.
- **AI-budget controls** — daily and monthly caps, fallback routing, refusal logging.
- **Risk scanning** on every issue, comment, and fetched URL — injection defense, wallet-drain detection, encoded-instruction relay catch.

Orbit ships as a scaffolder, an SDK, and a workflow set. You stay in control. **Nothing runs without your approval.**

---

## What Problem It Solves

Most "AI agent in a repo" setups are one of:

- A copy-pasted prompt that drifts every week
- A scheduled GitHub Action that nobody can audit
- A SaaS dashboard where your data lives elsewhere

Orbit pushes the opposite direction. **Every artifact lives in your repo.** Memory is JSON files. Proofs are signed receipts committed to git. The dashboard reads from your repo, not from us. You can delete the SDK and keep running — the data outlives the tool.

---

## What You Get In 5 Minutes

```
npx create-orbit-house my-orbit
cd my-orbit
gh repo create --public --source .
git push -u origin main
```

That gives you:

- `memory/` — identity, governance, treasury, tasks, knowledge as JSON
- `src/agent/` — cycle runner, AI router, refusal logger, intake scanner
- `.github/workflows/orbit-cycle.yml` — hourly cron, signs every cycle
- `public/dashboard.json` — read-only public projection (no PII, no keys)
- `public/.well-known/orbit.json` — federation discovery endpoint

Run `npm test`. Watch `gh run watch`. You're live.

---

## What It Costs

- **AI usage**: pay your own provider. Orbit caps daily + monthly spend by default ($5/day, $100/month — adjustable).
- **Hosting**: $0. Everything is GitHub Actions + GitHub Pages.
- **Tooling**: $0. Orbit is MIT-licensed, no service contract, no telemetry.

You can run Orbit with no wallet key, no token, no Farcaster account. Those unlock optional features when you turn them on.

---

## What It Doesn't Do

- It doesn't replace your CI.
- It doesn't replace your code review.
- It doesn't write production code without an approval gate.
- It doesn't make on-chain decisions without **D-014** approval (a public issue + signed receipt for every action).

---

## What's Next On The Roadmap

| Phase | Status | What ships |
|---|---|---|
| 1 — Groundwork (Pre-Token) | Engineering complete, owner-gated by `S-GATE-1` | Signed cycles, proofs, dashboard, lore, closed-loop demo, second-adopter |
| 2 — Genesis | Hard-blocked behind D-018 | $ORBIT on Base via Clanker v4, Treasury Safe funded, buyback automation, daily Merkle anchor |
| 3 — Capability Marketplace | Specs drafted | Plugin economy, bounty market, federation inbound, per-repo subscription tier |
| 4 — Federation | Specs drafted | External agent implementations read passport, protocol-fee revenue, multi-maintainer quorum live |
| 5 — Protocol Independence | Specs drafted | ENS-portable identity, 100 adopters, founder-fade execution |
| 6 — Standardization | Open | ≥3 external implementations, founder-fade complete, constitutional amendment process |
| 7–9 — Federation at scale → ubiquity → quiet utility | Open | Beyond 5,000 adopters; no terminal stage written here |

The full nine-phase plan is in `PLAN/PHASES.md`. After Phase 9, the horizon scanner proposes Phase 10+. Decisions are tracked in `PLAN/DECISIONS.md`.

---

## What We Ask From Adopters

One thing: **run a cycle and tell us what broke**. Open an issue at `github.com/orbithousezkp/orbit` with the receipt path. Every refusal logged in your repo helps tune Orbit's defaults for the next adopter.

That's the deal. No newsletter, no auth flow, no opt-in.

---

## Where To Go Next

- 5-minute setup recipe: [`PLAN/ADOPTER_QUICKSTART.md`](./ADOPTER_QUICKSTART.md)
- Architecture deep-dive: [`docs/quickstart.md`](../docs/quickstart.md)
- Public dashboard reference: `https://orbithousezkp.github.io/orbit/` (Pages default URL)
- Verifier CLI: `npx @orbithouse/verifier --help`
