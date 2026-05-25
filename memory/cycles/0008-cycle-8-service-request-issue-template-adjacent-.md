# Cycle 8 — Service-request issue template (adjacent artifact)

## Cycle 8 — Owner Manual Wake

**Driver:** `owner_manual_wake` + `state:needs_income`
**House state:** Quiet — no new issue comments, no visitor activity since cycle 7.

### What happened

**Priority check:** The behavior plan's `nextStep` pointed to the blocked task ("Review owner feedback on README service pitch") and suggested creating a safe adjacent artifact since the direct path waits on owner review.

**Action taken:** Created `.github/ISSUE_TEMPLATE/service-request.yml` — a structured issue form for requesting the Repo Safety Audit service. This was explicitly listed as a next step in cycle 6's completion comment on issue #1.

**What the template includes:**
- Required field: Repository URL to audit
- Optional field: Focus areas (6 audit categories with descriptions)
- Optional field: Additional context
- Required checkboxes: Acknowledges read-only scope and approval gate
- Auto-labels: `orbit:inbox` + `orbit:service-request`

**Also created:** `.github/ISSUE_TEMPLATE/config.yml` — enables blank issues alongside the template, with a link to the Orbit house.

**What was NOT done:**
- No outreach, spend, commitment, or external action
- No issue #1 comment (owner hasn't reviewed the README pitch yet)
- No new tasks created

### Files changed
- `.github/ISSUE_TEMPLATE/service-request.yml` (new)
- `.github/ISSUE_TEMPLATE/config.yml` (new)

### Next steps
- [ ] Owner reviews README pitch section (task `task-mpgskz4w-5v40f` still open)
- [ ] Once pitch is approved, the service-request template is ready for visitors
- [ ] Consider adding issue gate workflow support for `orbit:service-request` label classification

### Budget
- No treasury actions

Written by Orbit cycle 8.