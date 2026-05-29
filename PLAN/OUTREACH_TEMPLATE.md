# OUTREACH_TEMPLATE.md — Adopter Outreach Templates

> Drop-in copy for the S-016 push. Five repos is the Phase 1 target. Each template is short on purpose — adopters don't read long sales pitches from strangers.

All templates assume the SDK + scaffolder are published to npm (S-GATE-1 item 5). Until then, swap `npx create-orbit-house` for the clone instructions in `PLAN/ADOPTER_QUICKSTART.md` step 1.

---

## 1. Cold DM (Twitter / Farcaster) — under 280 characters

```
hey {{name}} — saw {{repo}} doing {{specific thing}}. built a thing called orbit: github-native agent control plane (memory, signed proofs, intake scanner, ai-budget). 5-min scaffold, mit, no service. repo: github.com/orbithousezkp/orbit. interested?
```

Rules:
- Always name a specific commit, issue, or PR from their repo. Generic compliments get filtered.
- Lead with what they already do, not what Orbit does.
- Never sign with your job title. They can look it up.

---

## 2. Email — under 150 words

**Subject:** orbit — agent infra for {{repo}}

```
hi {{name}},

i'm reaching out because {{repo}} is doing {{specific thing}} and that's the kind of repo orbit was built for.

orbit is a github-native control plane for agents running inside a repo:
- memory that survives across runs
- public approval gates (no agent action without a paper trail)
- eip-712 signed proofs of every cycle (verifiable with npx @orbithouse/verifier)
- ai-budget caps, refusal logging, intake risk scanning
- $0 hosting — github actions + pages

5-minute scaffold:
  npx create-orbit-house {{their-repo-slug}}-orbit

mit licensed, no service, no telemetry. repo: github.com/orbithousezkp/orbit

if it's not a fit, i'd love to hear what's missing. one issue with a receipt path helps more than ten LGTM responses.

{{your-name}}
```

Rules:
- One paragraph of pitch maximum. The bullet list is the body.
- Always include the scaffold command. People want a copy-paste.
- The ask is "tell us what's broken," not "use this." That's lower-friction.

---

## 3. Issue on their repo — only when it's genuinely relevant

Open this only if their repo has an existing AI-agent surface (issue triage bot, comment responder, scheduled action) that Orbit could replace or augment. Don't spam-open across unrelated repos.

**Title:** Possible interest: agent control plane (orbit)

**Body:**

```markdown
Hi {{maintainer}},

Noticed {{specific file or workflow}} — looks like you're running {{description of their agent setup}}.

I work on [Orbit](https://github.com/orbithousezkp/orbit), a GitHub-native control plane for agents: memory, public approval gates, signed proofs, AI-budget caps, intake risk scanning. MIT, no service, no telemetry.

It's not "another agent framework" — it's the bookkeeping layer underneath one. Each cycle commits its own signed receipt to your repo.

If you have 5 minutes:

    npx create-orbit-house {{their-repo}}-orbit

Even a "tried it, broken because X" issue back on [orbit](https://github.com/orbithousezkp/orbit) would be hugely useful.

(Closing this if there's no reply in a week — not trying to clog your backlog.)
```

Rules:
- Always close your own issue with a "tried it, didn't fit" reply if no response in 7 days. Don't leave it dangling.
- Never open this on a repo whose maintainer has publicly said they hate AI tooling. Read their issues first.
- Never open this on a repo where the agent surface is the maintainer's own funded business — that's a competitor, not an adopter.

---

## 4. Conference / IRL — under 60 seconds

```
"I work on a thing called Orbit. It's an agent control plane that lives entirely in a GitHub repo. Memory in JSON files, approval gates on every action, signed receipts that anyone can verify. No SaaS, no auth flow, $0 hosting. Five-minute setup with npx create-orbit-house. I'm trying to get five repos running it by {{deadline}}. What's the smallest agent thing you do that hates its current bookkeeping?"
```

Rules:
- Always end with a question that surfaces their pain point. Don't pitch first.
- Have the scaffold command memorized: `npx create-orbit-house <name>`. Don't fumble.
- If they care, hand them a sticker with the dashboard URL and `github.com/orbithousezkp/orbit`. No business card.

---

## 5. Follow-up after a "tried it" reply

```
thanks for trying it — what broke?

if it was scaffold-time (npm, gh cli, perms): probably something in PLAN/ADOPTER_QUICKSTART.md that needs to be clearer. if you can paste the failure mode in an issue on orbithousezkp/orbit, i'll fix it before the next adopter hits it.

if it was conceptual (didn't match how you think about agents): even more useful. drop a paragraph explaining what model you were expecting. that's what changes the docs.
```

Rules:
- Treat the failure mode as a bug in Orbit, not in their attention span.
- Always link a specific file you'll edit based on their feedback. Names them as the input to the fix.

---

## 6. Tracking sheet

Keep this as `PLAN/ADOPTER_OUTREACH.md` (private to the build repo, not synced to the public org). Five rows minimum, ten ideal:

| Repo | Maintainer | Channel | Sent | Response | Notes |
|---|---|---|---|---|---|
| {{repo}} | {{handle}} | DM/email/issue | YYYY-MM-DD | yes/no/tried | one-line summary |

Update on every interaction. The point of S-016 isn't "5 adopters" — it's *"5 honest signals about why Orbit doesn't fit."* Both convert to fixes faster than ten lukewarm yeses.

---

## What "adopted" actually means

A repo is an Orbit adopter when:

- It has a green run of `orbit-cycle.yml` in the last 7 days, **AND**
- Its `public/dashboard.json` is reachable at a public URL, **AND**
- Its `public/.well-known/orbit.json` validates against the federation schema (`npm run orbit:query <url>` against it returns OK)

Two of three isn't enough — federation discovery only works if all three are true. Track this in `PLAN/ADOPTER_OUTREACH.md` Status column.

The Phase 1 exit criterion is *5 adopters meeting all three*. That's the actual finish line.
