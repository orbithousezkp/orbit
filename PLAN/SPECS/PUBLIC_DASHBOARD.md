# SPEC — Public Dashboard on GitHub Pages (S-003)

Status: shipped 2026-05-24 (engineering); pending GitHub Pages enablement on the repo
Refs: D-007, D-006, BRAND.md, DEPLOY_PLAN.md, feedback memory `github-only`

> **Note (2026-05-28):** The custom-domain `orbit.horse` originally planned for this spec was deferred (commit 84767747). The current target is the Pages default URL `https://orbithousezkp.github.io/orbit/`. The custom-domain sections below remain as the runbook for re-introducing a custom domain in a later phase — they are not Phase 1 work.

## 1. Hosting Choice — GitHub Pages (mandatory)

Per the GitHub-only constraint, Orbit runs entirely on GitHub infrastructure. The dashboard ships via **GitHub Pages**. No Vercel, no Netlify, no third-party CDN.

| Concern | Implementation |
|---|---|
| Build on push | `.github/workflows/deploy-dashboard.yml` — push to `main` triggers `npm run build`, uploads `dist/` as Pages artifact, deploys |
| Custom domain HTTPS | `public/CNAME` → `orbit.horse`; GitHub Pages provisions LetsEncrypt cert |
| Edge cache | GitHub's CDN (Fastly-backed); sufficient for launch volume |
| Cost | Free, public repo |
| Cycle commit → redeploy | `dashboard.json` lives in `public/` and is rewritten each cycle; the cycle commit hits the workflow `paths:` filter and re-deploys |

Why this works: the cycle workflow already commits `public/dashboard.json` every 30 min via `[orbit] cycle #N` commits, which triggers `deploy-dashboard.yml` automatically. No extra deploy hook secret needed.

## 2. Page Structure

Single homepage, anchor-linked sections. No client-side router. Sections in DOM order:

```
+----------------------------------------------------------+
| HEADER: [orbit] cycle #NNN  |  signer 0xABC...  | github |
+----------------------------------------------------------+
| HERO                                                      |
|   "orbit is awake."                                       |
|   last cycle: 12 min ago | next cycle: ~18 min            |
|   [signed receipt #NNN] [view on github]                  |
+----------------------------------------------------------+
| LIVE STATUS STRIP (4 tiles)                              |
|   cycle count | last status | refused (24h) | ai spent   |
+----------------------------------------------------------+
| LATEST RECEIPT (verbatim plain-text block, mono)         |
|   ORBIT CYCLE #NNN                                        |
|   Trigger / Started / Finished / Steps / AI usage         |
|   Signed by / Verify cmd                                  |
+----------------------------------------------------------+
| RECENT CYCLES (table, last 10)                            |
|   #NNN | when | trigger | steps | result | receipt link  |
+----------------------------------------------------------+
| TREASURY                                                  |
|   Safe addr (Basescan link) | WETH balance | $ORBIT bal  |
|   Blocked-until-approved list (read from governance)     |
+----------------------------------------------------------+
| WHAT ORBIT WILL AND WILL NOT DO                          |
|   Two columns: allowed-without-approval / blocked         |
+----------------------------------------------------------+
| VERIFY YOUR OWN COPY                                     |
|   $ npm i -g @orbit-house/verifier                       |
|   $ orbit-verify <receipt-url>                            |
+----------------------------------------------------------+
| FOOTER: github, npm, farcaster, lore, built timestamp     |
+----------------------------------------------------------+
```

Mobile: tiles stack 1-up, receipt block scrolls horizontally inside its card, table collapses to card list.

## 3. Data Source — `dashboard.json` written each cycle

Decision: do NOT call SDK at page load. Cycle agent writes a static `apps/dashboard/public/dashboard.json` snapshot at end of every cycle. Dashboard fetches that file on mount.

Why: SDK is CommonJS Node code reading filesystem — won't run in browser. Remote API call adds latency (kills <1s budget) and runtime dependency we don't have.

Cycle writes:
```js
const { exportBundle } = require('../../packages/orbit-sdk');
const bundle = exportBundle(process.cwd(), {}, { receiptLimit: 10, memoryLimit: 0 });
const slim = projectForDashboard(bundle); // drops PII, trims to ~30KB
fs.writeFileSync('apps/dashboard/public/dashboard.json', JSON.stringify(slim));
```

`projectForDashboard` includes: status, lifecycle, walletPolicy (digest-only fields), receipts (last 10, no full step bodies), permissions.allowedWithoutApproval, permissions.blockedUntilApproved, infrastructure.product, generatedAt, gitCommit (short sha).

Hard cap: dashboard.json ≤ 50KB gzipped. Asserted in build step.

## 4. Build Pipeline

- Every push to `main` that touches `src/**`, `public/**`, `index.html`, `vite.config.mjs`, or `package*.json` → `.github/workflows/deploy-dashboard.yml` runs `npm run build` and deploys `dist/` to GitHub Pages
- Vite output dir: `dist/` (default)
- Build assertion in workflow: `test -f dist/dashboard.json`
- Cycle commit triggers a redeploy because `public/dashboard.json` is in the commit
- Manual rebuild via `workflow_dispatch` on the deploy-dashboard workflow

## 5. Component Breakdown (`apps/dashboard/src/components/`)

| File | Purpose |
|---|---|
| `Header.jsx` | Sticky bar, current cycle, signer addr, github link |
| `Hero.jsx` | Awake banner, last+next cycle estimate, primary CTA to latest receipt |
| `StatusStrip.jsx` | 4 numeric tiles from dashboard.json status |
| `LatestReceipt.jsx` | Plain-text receipt block per BRAND.md exact format |
| `RecentCycles.jsx` | Table/card list, last 10 receipts |
| `Treasury.jsx` | Safe address, balance, policy summary |
| `BoundariesGrid.jsx` | Will/won't do |
| `VerifyBlock.jsx` | Copy-pasteable npx command + signer hash |
| `Footer.jsx` | Links + last-built-at + commit sha |

Shared: `lib/loadDashboard.js` (single fetch + module-scope cache), `lib/format.js` (relative time, addr truncation).

## 6. Routing

Single page at `/`. Anchors for in-page nav. No `/cycles`, `/treasury`, `/verify` routes — keeps page weight down and avoids hydration/SSR decisions. Future routes Phase 2 (D-007 reserves `verify.orbit.horse` for hosted verifier).

## 7. Visual Identity (from BRAND.md)

- Wordmark: monospace lowercase `orbit`
- Primary color: deep teal `#0e4d52`. Accent: warm cream `#f4ecd8`. Background: near-black `#07111f` for receipt blocks; off-white `#fafaf7` for page
- No emoji anywhere
- Receipts: `<pre>` in mono (`ui-monospace, SFMono-Regular`), border `1px solid rgba(255,255,255,0.08)` on dark bg
- Cycle marker: `#NNN`, no decoration
- No animations on receipt content (framer-motion only for hero awake-pulse dot)
- All section headings: lowercase, mono, letter-spacing 0.04em

## 8. Performance Budget

| Asset | Target |
|---|---|
| HTML | ≤ 5KB |
| Initial JS (gzip) | ≤ 40KB |
| Total JS (gzip) | ≤ 80KB |
| CSS (gzip) | ≤ 12KB |
| dashboard.json (gzip) | ≤ 50KB |
| Web fonts | 0 (system mono + sans only) |
| Images | 0 raster, 1 SVG favicon |
| LCP target | < 800ms on 4G |
| TTI target | < 1000ms |

Lighthouse CI runs in build; perf score < 95 fails the build.

## 9. Accessibility

- Semantic HTML: `<header>`, `<main>`, `<section>`, `<table>`, `<footer>`
- Keyboard nav: all anchors focusable, focus ring visible
- Color contrast: receipt block ≥ 7:1, body text ≥ 4.5:1 (verified via `pa11y-ci`)
- All links have text content (no icon-only)
- Headings in order, no skips
- Tables include `<caption>` and `<th scope>`
- `<html lang="en">` and meaningful `<title>`

## 10. Failure Modes

| Mode | Behavior |
|---|---|
| `dashboard.json` missing | Static "orbit is in setup" page with github link |
| Zero receipts | Hero shows "no signed cycles yet — check back" |
| Empty memory | Status strip shows `--` for unknowns, no crash |
| Build older than 2h | Footer shows `stale: built Xh ago` in amber |
| Signer addr missing | Hero replaces verify CTA with "signer not yet published" |
| Receipt unsigned | Cycle row shows `unsigned` badge; latest block falls back to most recent signed |
| Vercel down | n/a — not used; GitHub Pages outages would return 503, registrar TTL keeps DNS resolving |

## 11. Test Plan + Dry-Run

- `apps/dashboard/__tests__/loadDashboard.test.js` — fixture tests against three `dashboard.json` shapes: empty, partial, full
- `apps/dashboard/__tests__/format.test.js` — relative time, addr truncation
- `apps/dashboard/__tests__/a11y.test.js` — render each component, run `axe-core`
- Visual regression: Playwright snapshot for 320px and 1280px
- Dry-run: `npm run build:dashboard:preview` runs build against `tests/fixtures/dashboard.empty.json`, serves localhost:4173
- Smoke in CI: build → curl `/` → assert response < 50KB and contains `cycle #`

## 12. Owner Setup Checklist (GitHub Pages + DNS)

1. Repo → Settings → Pages → Source: **GitHub Actions** (not branch-based)
2. Push the `deploy-dashboard.yml` workflow to `main` so it can run
3. Trigger first deploy: push any change to `src/**` or run `workflow_dispatch` on Deploy Dashboard
4. After first successful deploy, Pages shows the live URL (e.g. `https://<owner>.github.io/<repo>/`)
5. Set custom domain: repo Settings → Pages → Custom domain → `orbit.horse` (the `public/CNAME` file already declares it; Pages will validate)
6. At registrar (`orbit.horse`): add four `A` records pointing to GitHub Pages IPs (`185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`) on the apex; add `CNAME` `<owner>.github.io.` on `www`
7. Enable "Enforce HTTPS" once the cert provisions (usually <10 min)
8. `dig orbit.horse +short` returns the GitHub Pages IPs
9. `curl -I https://orbit.horse` → 200, gzip, GitHub Pages headers
10. Mark D-007 acceptance done in STATUS.md
