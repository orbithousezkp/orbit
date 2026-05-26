# ADOPTER_QUICKSTART.md — 5-Minute Orbit Setup

> Get a new GitHub repo running its first Orbit cycle in under five minutes. No wallet, no token, no on-chain action required.

This recipe assumes:
- You have `npx`, `git`, and `gh` (GitHub CLI) installed
- You have a GitHub account
- You can create a new public repo

If you don't have `gh`, install it from [cli.github.com](https://cli.github.com) — Orbit talks to GitHub through the CLI's stored credentials, so `gh auth login` once and you're done.

---

## 0. Decide your repo name

Pick a short slug. Examples: `my-orbit`, `acme-house`, `lab-cycle`.

This becomes both the local folder and the GitHub repo name.

```bash
export ORBIT_REPO="my-orbit"
```

---

## 1. Scaffold

```bash
npx create-orbit-house "$ORBIT_REPO"
cd "$ORBIT_REPO"
```

That creates:

```
.github/workflows/orbit-cycle.yml   ← hourly cron, runs the cycle
.github/ISSUE_TEMPLATE/             ← intake forms (service-request, mission)
memory/                             ← state, identity, governance, treasury, tasks
src/agent/                          ← cycle runner, AI router, intake scanner
public/                             ← dashboard.json + .well-known/orbit.json
package.json                        ← scripts: cycle, health, infrastructure, sdk
README.md                           ← human-readable intro for your future self
```

No commits made yet. Inspect freely.

---

## 2. Verify locally before pushing

```bash
npm install
npm test          # should pass cleanly
npm run health    # walks the file registry, confirms nothing missing
```

If `npm test` fails, do not push. Open an issue at [github.com/orbithousezkp/orbit](https://github.com/orbithousezkp/orbit) with the failing test name and the SDK version from `package.json`.

---

## 3. Create the GitHub repo and push

```bash
git init
git add -A
git commit -m "chore: initial Orbit scaffold"
gh repo create "$ORBIT_REPO" --public --source . --remote origin
git push -u origin main
```

That uploads the scaffold and registers the workflow.

---

## 4. Trigger the first cycle

```bash
gh workflow run orbit-cycle.yml
gh run watch
```

When the run finishes (~30 seconds for a deterministic fallback cycle, ~2 minutes if an AI provider is configured), pull the commit it just made:

```bash
git pull
```

You'll see a new commit titled `[orbit] cycle #1 (N steps)`. Inspect:

```bash
ls public/                       # dashboard.json and .well-known/orbit.json
cat memory/state.json            # cycle: 1, lastStatus: completed, born: now
ls runtime/proofs/$(date +%Y-%m-%d)/   # signed proof per step
```

If `ORBIT_AGENT_SIGNER` isn't set yet, proofs are written but unsigned. That's fine for cycle 1. You'll add signing in step 6.

---

## 5. Read your repo's public state

```bash
npm run sdk -- quick-status     # cycle, budget, tasks, level, staleness
npm run sdk -- governance       # approval mode, allowed/blocked actions
npm run sdk -- treasury         # token, fees, distribution policy
```

Or via the SDK in code:

```js
const orbit = require('@orbit-house/sdk');
const sdk = orbit.create(process.cwd());
console.log(sdk.quickStatus());
console.log(sdk.projectForDashboard());
```

---

## 6. (Optional) Turn on signed proofs

```bash
# Generate an EOA dedicated to Orbit. Treat the key like an SSH key.
node -e 'const {Wallet}=require("ethers");const w=Wallet.createRandom();console.log(`PK=${w.privateKey} ADDR=${w.address}`)'

# Save:
gh secret set ORBIT_WALLET_PRIVATE_KEY --body "0x..."   # the PK above
gh variable set ORBIT_AGENT_SIGNER --body "0x..."       # the ADDR above
```

Next cycle, the proof in `runtime/proofs/<date>/<step>.json` will include a `signature` field. Verify with:

```bash
npx @orbit-house/verifier runtime/proofs/<date>/<step>.json
```

The signer address must match `ORBIT_AGENT_SIGNER` — that's the D-006 sanity check.

---

## 6a. (Optional) Add maintainers (turn on quorum)

By default, only the configured owner can approve external spends. To make the repo survive losing any single account, add maintainers — every external spend then needs K-of-N approval (see `PLAN/SPECS/MULTI_MAINTAINER_QUORUM.md` for the math).

```bash
# Comma-separated GitHub usernames. Include yourself.
gh variable set ORBIT_MAINTAINERS --body "alice,bob,carol"
```

Quorum activates automatically when this variable contains more than one name. With one name (or unset), the agent runs in solo-owner mode and falls back to the legacy single-approver path. The `governance.js` quorum code, the parser, and the rejection-veto logic are already shipped (`src/agent/governance.js:217-490`, `tests/governance-quorum.test.js`); this variable is the only wire.

---

## 7. (Optional) Configure an AI provider

Without AI, every cycle runs the deterministic fallback. To let the agent actually plan:

```bash
gh variable set ORBIT_AI_PROVIDERS --body '[
  {"name":"anthropic","label":"Claude","apiBase":"https://api.anthropic.com/v1","model":"claude-opus-4-7","chatPath":"/messages","priority":1}
]'

gh secret set ORBIT_AI_PROVIDER_KEYS --body '{"anthropic":"sk-ant-..."}'
```

Daily/monthly budget caps default to $5/$100 — adjust in `memory/governance.json` if needed.

T-8 routing (commit `1abb992c`) handles auto-demotion if a provider fails 3 cycles in a row, and auto-promotion after 24 clean hours. State accumulates in `memory/state.json.aiRouting`.

---

## 8. (Optional) Expose the dashboard publicly

```bash
# In the repo's Settings → Pages:
#   Source: GitHub Actions
#   Custom domain: <your domain>
```

The workflow `.github/workflows/deploy-dashboard.yml` publishes `public/` on every push to `main`. Anyone can then `curl https://<your-domain>/dashboard.json` and verify your repo's state.

---

## 9. (Optional) Propose a mission

Use the **Mission** issue template (`.github/ISSUE_TEMPLATE/mission.yml`) to propose work for your Orbit (or others) to ship. Labeled issues are lifted onto the dashboard next cycle.

```bash
gh issue create --template mission
```

No staking, no token transfer — that's the Phase 3 build, gated behind S-GATE-3. The Phase 1/2 widget just makes proposed work publicly visible.

---

## What you have now

After step 4: a self-running repo with signed proofs, public dashboard, federation discovery, and intake scanning. After step 8: a public auditability surface anyone can verify. After step 9: a coordination primitive ready for whoever wants to ship work for you.

You don't need any further setup. The hourly cron will keep running. Refusals and risks get logged. Budgets get enforced. If you want to extend Orbit with a custom tool, see `packages/orbit-tool-example/` for the plugin scaffold.

---

## What to do if it breaks

1. `gh run list --workflow=orbit-cycle.yml --limit 10` — most recent runs.
2. `gh run view <run-id> --log` — full log.
3. `cat memory/state.json | jq .lastStatus` — last completed cycle's status.
4. Open an issue at [github.com/orbithousezkp/orbit](https://github.com/orbithousezkp/orbit) with the receipt path. Real adopter bug reports tune Orbit's defaults for the next adopter.
