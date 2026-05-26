# FRONTEND_RULES.md — non-negotiable design + engineering rules

> These rules apply to every file under `src/sections/`, `src/components/`, `src/data/`, `src/index.css`, `index.html`. Any PR that touches the dashboard must obey them; any that breaks them is rejected.

Owner-stated, 2026-05-26. This file is the spec; the JSX/CSS is the implementation.

---

## 1. Typography

**Allowed:**
- ✅ Designer **sans-serif geometric** fonts (Inter, Space Grotesk, Geist, IBM Plex Sans, Manrope, Sora, Satoshi, etc.) — provided the letterforms are **upright** and **straight**.
- ✅ Designer **monospace** fonts (JetBrains Mono, IBM Plex Mono, Geist Mono, Fira Code) for technical surfaces (CA, paths, code).
- ✅ **Bold** weights for emphasis.
- ✅ Letter-spacing adjustments, weight variation (300–800), uppercase, small-caps.

**Forbidden:**
- ❌ `font-style: italic` anywhere. Remove every existing instance.
- ❌ `font-style: oblique`.
- ❌ `<em>`, `<i>`, or any rendered slant.
- ❌ Cursive / script / handwriting fonts (Pacifico, Dancing Script, Caveat, Sacramento, etc.).
- ❌ Decorative running-letters fonts.
- ❌ Serif "literary" fonts (Lora, Playfair, Cormorant) — they conflict with the upright-tech voice.

**Voice via type:**
- Emphasis comes from **weight** (700/800) or **uppercase + letterspacing**, never from slant.
- A "tagline" stays bold + plain. No "*italic* word for emphasis."

---

## 2. Theme + color

The existing palette is approved as the foundation. **Enhance it, don't replace it.**

- Base: white + skyblue gradient with warm lowlights for depth.
- Persistent ambient orbit drifts behind every panel (`BackgroundOrbit.jsx`).
- One viewport per route — sections fit the viewport without internal scroll where possible.
- Color tokens stay in CSS custom properties (`--ink-strong`, `--ink-mid`, `--warm-glow`, etc.). Do not hardcode hex outside of the `:root` block.

---

## 3. Presentation rules

- **No emoji** in the rendered UI unless explicitly requested. (We have an "no emoji" baseline rule project-wide.)
- **Lowercase by default**, mixed-case only for proper nouns (Orbit, GitHub, Farcaster, Base).
- **No exclamation marks, no marketing copy**. Voice from `PLAN/BRAND.md`: terse, dry, first-person, no hype.
- Text must read complete-sentences when in long-form blocks. Cells can be fragments.
- Numbers and counts get monospace. Categories and labels get sans-serif lowercase letterspaced.

---

## 4. Responsive design

Every section MUST work on:
- **Desktop ≥ 1100px** — full grid, three-column where designed.
- **Tablet 700–1100px** — adjusted columns, persistent panels condensed.
- **Mobile 480–700px** — single-column, content reflows; the visual sections still fit one viewport when content allows.
- **Small mobile < 480px** — content reflow takes priority over "one viewport." A user on a 320×640 screen reading a long Forever section gets vertical page scroll, not a broken layout.

**Rules:**
- No fixed pixel widths where a viewport unit or `clamp()` would work.
- No `overflow: auto` as a fallback for content that doesn't fit — first try to make it fit (compress, accordion, hide secondary detail) and only then use scroll.
- Touch targets ≥ 44 × 44 px.
- Test every section at three viewports before declaring done.

---

## 5. Security

- **No inline scripts.** All JS lives in modules.
- **No `dangerouslySetInnerHTML`.** Anywhere. Ever.
- **`rel="noreferrer noopener"`** on every `target="_blank"` link.
- **Diagnostic strings stay out of public cells.** Fetch errors go to `console.warn`; the visible UI shows "data unavailable" — never the underlying HTTP status, never a stack.
- **No external script CDNs** in `index.html`. Self-host required.
- **Fonts via Google Fonts** are acceptable (CSS-only, no script), but loaded with `preconnect` + `font-display: swap` so a font-CDN outage doesn't blank the page.
- **No tracking / analytics scripts** on the public dashboard. The whole project is a transparency-first artifact; adding GA contradicts the thesis.
- **CSP-friendly:** no `eval`, no `new Function()`, no inline event handlers.

---

## 6. Wiring rules (engineering — read before editing)

**Before changing any frontend file:**
1. Read the file in full.
2. Identify every prop it consumes from `dashboard.json` or from the data files in `src/data/`.
3. If you change a shape, you change both ends — the producer (SDK projection in `packages/orbit-sdk/index.js`) AND the consumer (the JSX).
4. After every section's edit, run:
   - `npm run lint` — must pass.
   - `npm run build` — Vite must produce `dist/` without warnings.
   - `npm test` — 1456 tests must stay green.
5. Bug-fixing the dashboard after the rest of the project is launched is wasteful — pin invariants in tests where possible (the SDK projection tests in `tests/dashboard-projection.test.js` are the right place for shape pinning).

---

## 7. Footer attribution

Per owner instruction:

```jsx
<p className="footer__attribution">
  made by <a
    href="https://x.com/cryptoasuran"
    target="_blank"
    rel="noreferrer noopener"
  >cryptoasuran</a>
</p>
```

Placement: bottom of `Footer.jsx`, below the existing CA + motto. Voice: lowercase, terse, no hype.

---

## 8. What "enhancing" means here

The existing theme is approved. Enhancing means:
- Tightening spacing rhythm.
- Adding micro-depth (subtle shadows, gradient hints, hover transitions).
- Surfacing the new machinery (handoff, errors, federation outbox) in clean cells.
- Removing every visible stub or "rebuilds next cycle" hint.
- Making mobile actually mobile.

Enhancing does **not** mean:
- Reinventing the color palette.
- Adding decorative illustrations.
- Adding marketing animations that distract from data.
- Reshuffling section order or routes.

---

## 9. Definition of done for the frontend phase

- [ ] No `font-style: italic` anywhere in `src/`.
- [ ] No `<em>`, `<i>` tags in `src/sections/`, `src/components/`.
- [ ] Hero, Live, Roadmap, Inspect, Forever each render correctly at desktop / tablet / mobile.
- [ ] Footer carries the `made by cryptoasuran` attribution.
- [ ] `npm run build` produces clean `dist/`.
- [ ] `npm test` is 1456 green (or higher after dashboard projection pins).
- [ ] `npm run launch:build` audit still passes.
- [ ] The Inspect section renders every slice in `public/dashboard.json` (no stub cells).
- [ ] Every external link has `rel="noreferrer noopener"`.
- [ ] No `dangerouslySetInnerHTML`.
- [ ] No tracking scripts.
