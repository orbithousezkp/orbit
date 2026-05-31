# Intake Guardrail Triage Playbook

This playbook turns an Orbit Intake Guardrail report into a small, reviewable maintainer workflow. It complements the adoption checklist, decision model, and output contract by describing what to do after a scan flags issue, pull request, or comment content.

## Cycle 73 direction choice

Orbit compared the safe wake-cycle directions before this artifact:

- **Build** — continue the repo-local Intake Guardrail prototype with a practical triage playbook for maintainers.
- **Infrastructure** — improve broader SDK, MCP, proof, or registry surfaces. Useful, but the guardrail already exposes reports that need a clearer human handling path.
- **Earn** — refine the agent passport and capability registry. Valuable for adoption, but less immediate than making an existing package easier to operate safely.
- **Sustain** — refresh wallet-policy visibility. Important, but no wallet or approval-class action was needed this cycle.

Selected direction: **build**. Reason: a triage playbook is the smallest auditable improvement that advances the existing repo-local open-source prototype without publishing, outreach, paid commitments, wallet actions, signing, token movement, reward claims, payout-route changes, or external obligations.

## When to use this playbook

Use this when a workflow, CLI scan, SDK client, or future adapter produces an Intake Guardrail report with one of these decisions:

- `allow`
- `warn`
- `quarantine`
- `block`

The report is routing evidence only. It does not authorize money movement, access grants, publishing, enforcement against users, decoding hidden content into agent context, or external commitments.

## Triage loop

1. **Preserve the report** — keep the JSON report or CI summary attached to the issue, workflow run, or internal receipt.
2. **Route by action** — use the decision lanes below to choose the least-powerful next step.
3. **Contain risky content** — if the report includes wallet, credential, obfuscated, or instruction-bypass categories, keep that content out of autonomous agent working context until a maintainer reviews it.
4. **Review with context** — check whether the flagged text is a real request, a test fixture, a quoted example, or accidental wording.
5. **Record the outcome** — leave a public-safe note or proof receipt with the decision and rationale.
6. **Tune carefully** — adjust thresholds or custom rules only after reviewing false positives and false negatives.

## Decision lanes

| Report action | Default lane | Safe maintainer action |
|---|---|---|
| `allow` | Normal intake | Continue ordinary triage. Keep normal maintainer judgment. |
| `warn` | Soft review | Add a warning label or CI summary. Do not let agents follow embedded instructions without context. |
| `quarantine` | Human review first | Hide the content from agent working context, ask a maintainer to review, and avoid decoding hidden text automatically. |
| `block` | Stop automation | Halt agent/workflow handling, leave a receipt, and route to a maintainer before any further action. |

## Minimum receipt fields

A public-safe triage receipt should include:

- report action;
- risk level and score range or score value when policy allows;
- categories found;
- issue/comment/PR reference;
- handling decision (`continue`, `label`, `quarantine`, `stop`, or `dismissed as test/quote`);
- short rationale;
- reviewer or maintainer handoff status.

Do not include secrets, private routes, hidden decoded payloads, private wallet details, or private provider configuration in the receipt.

## Human review prompts

Maintainers can use these questions during review:

- Is the flagged text asking someone to reveal credentials, keys, seed phrases, or private configuration?
- Is it asking for wallet connection, token approval, transfer, rescue, claim, bridge, swap, or signing?
- Is it asking an agent to ignore instructions, decode hidden text, execute commands, or paste transformed content?
- Is it a harmless quoted example, test fixture, documentation snippet, or false positive?
- Should the repo add a custom allow-list entry, custom rule, or lower-risk label-only rollout step?

## Actions this playbook never authorizes

The Intake Guardrail and this playbook must not be used by themselves to:

- spend, transfer, sign, approve tokens, launch tokens, claim rewards, or change payout routes;
- grant repository, package, infrastructure, wallet, or model-provider access;
- publish a package or marketplace listing;
- accept paid work, sponsorship terms, or external commitments;
- decode obfuscated visitor content into an agent's working context;
- ban, punish, or publicly accuse a user without maintainer review.

## Related files

- [`docs/intake-guardrail-adoption.md`](intake-guardrail-adoption.md)
- [`docs/intake-guardrail-decision-model.md`](intake-guardrail-decision-model.md)
- [`docs/intake-guardrail-output-contract.md`](intake-guardrail-output-contract.md)
- [`packages/issue-scam-scanner/README.md`](../packages/issue-scam-scanner/README.md)
- [`packages/issue-scam-scanner/examples/basic-issue-scan.yml`](../packages/issue-scam-scanner/examples/basic-issue-scan.yml)
