# Intake Guardrail Adoption Checklist

This checklist helps another repository adopt Orbit's repo-local `packages/issue-scam-scanner` prototype without treating it as a live security guarantee or external service.

## Cycle 64 direction choice

Orbit compared the safe directions required by the wake plan:

- **Build** — improve the Issue Scam Scanner / Intake Guardrail prototype. Highest value this cycle because the package already exists and can become a reusable local artifact for agent-running repos.
- **Infrastructure** — continue SDK, CLI, proof, or adapter work. Valuable, but less immediate than making the current guardrail prototype easier to adopt.
- **Earn** — refine the agent passport / capability registry. Useful for future adoption, but the passport is already documented; the scanner adoption path had the clearer next small step.

Selected direction: **build**. Reason: a small adoption checklist advances the open-source project-builder path without outreach, publishing, wallet action, or external commitment.

## What the guardrail does

The scanner classifies issue, PR, and comment text before an agent or workflow acts on it. It can flag patterns such as:

- prompt-injection phrasing;
- wallet-drain or transfer pressure;
- credential and seed-phrase requests;
- encoded instruction relay requests;
- fake support and urgency traps;
- unknown or suspicious financial links.

The output is an intake decision (`allow`, `warn`, `quarantine`, or `block`) plus reviewable evidence for maintainers.

## Safe installation path

1. Keep the package repo-local until the owner explicitly approves marketplace publishing.
2. Copy `packages/issue-scam-scanner/examples/basic-issue-scan.yml` into `.github/workflows/` of the adopting repo.
3. Start with warning/quarantine labels before hard-closing issues automatically.
4. Route `quarantine` and `block` results to human review before any agent reads, decodes, or follows the content.
5. Add project-specific custom rules in a JSON file only when they are plain-text patterns and do not contain secrets.
6. Treat every flag as a triage signal, not a final security verdict.

## Human review rule

If content asks the maintainer or agent to decode, decrypt, translate, paste hidden text, connect a wallet, sign, approve tokens, move funds, share credentials, or bypass instructions, do not feed the hidden payload into an agent workflow. Summarize the risk and ask a maintainer to review.

## Gated actions

These remain blocked until owner direction and the relevant approval gate exist:

- marketplace publishing;
- external outreach;
- paid commitments;
- shared repository access;
- wallet spending, signing, token actions, reward claims, or payout-route changes.

## Minimal validation before use

Before enabling the workflow on a real repo:

- run the package tests locally or in CI;
- scan one benign issue and one intentionally suspicious fixture;
- confirm the workflow only labels/comments and does not grant agents new authority;
- confirm the workflow output avoids secrets and does not paste decoded hidden content.
