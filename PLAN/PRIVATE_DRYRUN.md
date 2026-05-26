# PRIVATE_DRYRUN.md — 12-hour real-AI test in a private repo

> Step 3 of `PLAN/LAUNCH_PLAN.md`. Owner-driven. Goal: take the launch-ready engineering output, run it in a private GitHub repo against real MiMo for 12 hours, surface any real-world bugs before they reach the public repo. No on-chain action, no token launch, no public dashboard — just signed cycles flowing.

## What this proves

If 12 hours of cycles produce 24+ signed proofs with `lastStatus: completed`, 0 fatal errors, and no `nightly-healthcheck.yml` alarms, the build is fluent enough to flip `state.preLaunchVerified = true` and start the public-launch ceremony (Step 6).

If anything regresses, the error-log and nightly healthcheck surface it before any public visibility.

---

## 0. Prerequisites (10 min)

```bash
# In the orbithousezkp/orbit repo (this one):
gh auth status                          # must be logged in as the owner
npm test                                # must show 1498/1498 pass
npm run env:check                       # must say clean
npm run launch:build                    # produces launch-ready/ with audit PASS
```

If any of those fail, stop — fix before proceeding.

---

## 1. Create the private test repo (3 min)

The memory note `project_orbit_public_org` says the canonical private test repo is **`candyburst/orbit-private-live`**. If it doesn't exist yet:

```bash
gh repo create candyburst/orbit-private-live \
  --private \
  --description "Orbit private dry-run · 12-hour soak test before public launch" \
  --clone

cd orbit-private-live
```

If it already exists, clone it fresh and clear it:

```bash
git clone https://github.com/candyburst/orbit-private-live.git
cd orbit-private-live
git rm -rf .   # empty for a clean push
git commit -m "chore: reset for fresh dry-run" --allow-empty
```

---

## 2. Push the launch-ready snapshot (2 min)

```bash
# from inside orbit-private-live, copy launch-ready/* in:
cp -r /home/asuran/Downloads/orbit/launch-ready/. .
git add -A
git commit -m "chore: dry-run snapshot from orbithousezkp/orbit@$(cd /home/asuran/Downloads/orbit && git rev-parse --short HEAD)"
git push -u origin main
```

The repo now contains: src, packages, tests, docs, .github/workflows, dashboard, all clean template stubs in memory/. No PLAN/, no .env, no live state. (Verified by `npm run launch:build` audit.)

---

## 3. Wire the MiMo provider + signer (5 min)

Repo Settings → Secrets and variables → Actions:

**Variables** (`gh variable set --repo candyburst/orbit-private-live NAME --body "..."`):

```bash
gh variable set ORBIT_OWNER_USERNAME      --body "<your-github-handle>"
gh variable set ORBIT_AGENT_SIGNER        --body "0x<the EOA pubkey matching the wallet key below>"
gh variable set ORBIT_AI_PROVIDERS        --body '[{"name":"opengateway","apiBase":"<mimo endpoint>","model":"<mimo model id>","chatPath":"/chat/completions","priority":1}]'
gh variable set ORBIT_DRY_RUN             --body "false"
gh variable set ORBIT_AI_DAILY_BUDGET_USD --body "2"
gh variable set ORBIT_AI_MONTHLY_BUDGET_USD --body "20"
```

**Secrets** (`gh secret set --repo candyburst/orbit-private-live NAME --body "..."`):

```bash
gh secret set ORBIT_WALLET_PRIVATE_KEY    --body "0x<EOA private key — generate fresh, NEVER reuse the public-repo signer>"
gh secret set ORBIT_AI_PROVIDER_KEYS      --body '{"opengateway":"<mimo api key>"}'
```

⚠ **DO NOT** set `ORBIT_TOKEN_ADMIN_ADDRESS`, `ORBIT_TREASURY_ADDRESS`, `ORBIT_ENABLE_TOKEN_LAUNCH`, `NPM_TOKEN`, or `ORBIT_SPAWN_TOKEN` in this private test. The whole point is to soak the cycle WITHOUT any on-chain or publish-class action.

---

## 4. Trigger the first manual cycle (1 min)

```bash
gh workflow run orbit-cycle.yml -R candyburst/orbit-private-live
gh run watch -R candyburst/orbit-private-live
```

When the run completes (~30–90s), pull the commit it just pushed:

```bash
git pull
ls runtime/proofs/$(date +%Y-%m-%d)/   # should contain step JSONs
cat memory/state.json | jq '{cycle, lastStatus, born}'
```

If `lastStatus: "completed"` and a signed proof landed: **first cycle is real**. Move to step 5.

If anything failed — read `gh run view --log` for the failing run. The error-log (`npm run orbit:errors tail`) will also surface it. Fix the issue in `orbithousezkp/orbit`, re-run `npm run launch:build`, re-push the snapshot, retry.

---

## 5. Let the cron soak for 12 hours (12 hours, hands-off)

After step 4, the schedule cron (`*/15 * * * *`) will fire automatically every 15 minutes. You don't need to do anything for 12 hours. Some quick sanity checks you can do periodically:

```bash
# How many cycles have fired?
gh run list -R candyburst/orbit-private-live --workflow=orbit-cycle.yml --limit 50

# Latest state
git pull && cat memory/state.json | jq '{cycle, lastStatus, lastActive}'

# Any errors?
npm run orbit:errors -- --repo candyburst/orbit-private-live   # if you wire a remote variant
# Or just: git pull && cat memory/errors.jsonl 2>/dev/null | tail -5

# Healthcheck (manual)
gh workflow run nightly-healthcheck.yml -R candyburst/orbit-private-live
gh run watch -R candyburst/orbit-private-live
```

12 hours × 4 cycles/hour = **48 cycles target** (15-min cron). The S-GATE-1 spec says 24 consecutive clean cycles is enough proof for the gate. 48 is comfortable margin.

---

## 6. Verdict after 12 hours

After the soak window:

```bash
# Pull final state
git pull

# Count clean cycles
gh run list -R candyburst/orbit-private-live --workflow=orbit-cycle.yml --limit 60 --json status,conclusion \
  | jq '[.[] | select(.conclusion == "success")] | length'

# Check error log
wc -l memory/errors.jsonl 2>/dev/null || echo "no errors file"

# Confirm signer matches throughout
ls runtime/proofs/$(date +%Y-%m-%d)/cycle-*/
# Random sample a few:
cat runtime/proofs/<date>/cycle-NN/step-N.json | jq '{signer, signatureScheme}'
```

**Pass criteria:**
- ≥24 successful cycle runs in 12 hours.
- All signed proofs have `signer === ORBIT_AGENT_SIGNER`.
- `memory/errors.jsonl` is empty (or contains only known-cosmetic entries like "AI route timeout, retried successfully").
- `memory/launch-persist-failure.json` does NOT exist.
- `nightly-healthcheck.yml` did not open any `orbit:healthcheck-fail` issue.

**Fail criteria (any one is enough to abort):**
- A cycle exits non-zero and posts to error-log with phase=fatal.
- Signer mismatch on any proof.
- The dashboard at the dist/ output diverges from `dashboard.json` (rendering bug).
- AI provider hung past the 60s timeout and the cycle stalled past 15 min.

If pass → proceed to Step 5 of `LAUNCH_PLAN.md` (owner punch list for the public-going-live ceremony).
If fail → file the regression on `orbithousezkp/orbit`, patch, redeploy, restart the 12h clock.

---

## 7. Tear-down (when done)

```bash
# Archive the dry-run for reference (don't delete — proofs are part of the trail)
gh repo edit candyburst/orbit-private-live --visibility private  # already is, but confirm
gh repo archive candyburst/orbit-private-live

# Remove the now-unused secrets so they can't be re-triggered accidentally:
gh secret delete ORBIT_WALLET_PRIVATE_KEY -R candyburst/orbit-private-live
gh secret delete ORBIT_AI_PROVIDER_KEYS   -R candyburst/orbit-private-live
```

The private signer key used here MUST NEVER be reused for the public repo. Generate a fresh EOA for the public launch.

---

## Why this works

- The launch-ready folder is the EXACT bytes that will ship publicly (audited by `npm run launch:build`). What runs here is what runs there.
- MiMo via OpenGateway already has 16 successful calls + 0 failures recorded in `state.aiRouting`. The provider is known-good.
- The cron will fire on its own — no babysitting required.
- The nightly healthcheck alarms if cycles drift past 3h stale.
- The error-log captures any silent failures with stack + phase.
- Every cycle proof is signed and committed — a 12-hour run produces ~48 anchored proofs that survive the dry-run and become the verification corpus.

If the 12 hours pass clean, the project has demonstrated real autonomy on real AI under real GitHub Actions. That's the strongest evidence S-GATE-1 can give.
