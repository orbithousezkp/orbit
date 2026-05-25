# ADOPTER_PITCH.md — One-Page Pitch For New Orbit Adopters

> Use this when introducing Orbit to a repo maintainer. One page, no jargon, no hype.

---

## What Orbit Is

A **GitHub-native control plane** for AI agents that act inside your repo. It gives you:

- **Memory** that survives across runs — agents remember decisions and previous cycles.
- **Permissions** with public approval gates — no agent action without a paper trail.
- **Signed proofs** of every cycle — EIP-712 receipts you can verify with `npx @orbit-house/verifier`.
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
npx create-orbit-repo my-orbit
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
| 1 — Launch-Ready | Engineering complete, owner-gated | Cycles, proofs, dashboard, federation, intake scanner |
| 2 — Token Launch | Hard-blocked behind D-018 | $ORBIT on Base, Treasury Safe, buyback automation |
| 3 — Coordination Markets | Specs ready, behind S-GATE-2/3 | Bounty market, mission board staking |
| 4–5 — Federation | Specs ready, behind earlier phases | Cross-orbit bounties, productive treasury, founder fade |

The full roadmap is in `PLAN/PHASES.md`. Decisions are tracked in `PLAN/DECISIONS.md`.

---

## What We Ask From Adopters

One thing: **run a cycle and tell us what broke**. Open an issue at `github.com/orbithousezkp/orbit` with the receipt path. Every refusal logged in your repo helps tune Orbit's defaults for the next adopter.

That's the deal. No newsletter, no auth flow, no opt-in.

---

## Where To Go Next

- 5-minute setup recipe: [`PLAN/ADOPTER_QUICKSTART.md`](./ADOPTER_QUICKSTART.md)
- Architecture deep-dive: [`docs/quickstart.md`](../docs/quickstart.md)
- Public dashboard reference: [`orbit.horse`](https://orbit.horse)
- Verifier CLI: `npx @orbit-house/verifier --help`
