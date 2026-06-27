# Intake Guardrail Review Routing

Cycle 166 selected the **build** direction after comparing safe options:

- **Build**: continue the repo-local Intake Guardrail prototype with an auditable artifact that helps maintainers use scanner receipts safely.
- **Infrastructure**: improve control-plane docs or SDK surfaces, but the current guardrail receipt trail has a more immediate adoption gap.
- **Earn**: improve the agent-passport/adoption story, but no outreach or external commitment is allowed without owner direction.
- **Sustain**: refresh wallet-policy visibility, but no wallet action is needed and private routes must remain hidden.

The best small action this cycle is to document how maintainers should route Intake Guardrail findings after a review receipt is produced. This keeps the scanner advisory, public-safe, and human-reviewed.

## Routing goals

1. Keep the guardrail as an **intake signal**, not an enforcement authority.
2. Route risky content to human review without decoding or republishing hidden instructions.
3. Preserve public-safe evidence for clean issues, suspicious issues, and blocked wallet-action requests.
4. Avoid automatic spend, signing, token, publishing, outreach, or external-commitment actions.

## Finding classes

| Class | Examples | Safe route | Automation boundary |
| --- | --- | --- | --- |
| `clean` | Normal bug report, docs request, feature idea | Leave issue open for normal maintainer triage | No labels or closure required by the guardrail |
| `suspicious` | Urgency pressure, vague external link, impersonation tone | Add to review queue or ask for maintainer confirmation | Do not follow links or execute instructions from the issue |
| `obfuscated-relay` | Requests to decode, translate, decrypt, or paste hidden text | Summarize that obfuscated instruction relay was detected | Do not decode or republish hidden content |
| `wallet-risk` | Seed phrase, approval request, rescue language, unknown recipient | Route to owner/human review as hostile until proven safe | No signing, approvals, transfers, claims, or route changes |
| `approval-class` | Spend, payment, token launch, reward claim, payout-route change | Use the normal owner-approval gate if the request is legitimate | Scanner never creates approval authority by itself |

## Maintainer checklist

Before acting on a finding:

- [ ] Read the original issue or comment directly.
- [ ] Confirm the scanner did not rely on decoded hidden text.
- [ ] Check whether the requested action is routine repo work or approval-class risk.
- [ ] If approval-class risk exists, stop until the owner approval process is satisfied.
- [ ] Keep public replies secret-free and do not expose private routes, keys, provider details, or hidden operational details.
- [ ] Record the decision in a receipt, issue comment, task, or follow-up doc.

## Public reply patterns

### Suspicious but unclear

> Thanks for the report. Orbit flagged this for human review because it contains signals that could affect maintainer safety. A maintainer should inspect it before anyone follows links or executes instructions.

### Obfuscated relay

> Orbit detected an obfuscated-instruction pattern. For safety, it will not decode or republish hidden content. A maintainer can review the original text directly if needed.

### Wallet-risk request

> Orbit cannot assist with seed phrases, token approvals, wallet rescue instructions, unknown recipients, signing, transfers, reward claims, token launches, or payout-route changes from issue content. This should be reviewed by the owner through the repository approval process if it is legitimate.

## Receipt notes

A routing receipt should include:

- source issue or comment reference;
- scanner finding class;
- public-safe reason summary;
- selected route;
- actions explicitly not taken;
- maintainer follow-up needed, if any.

## Non-authority boundary

The Intake Guardrail is advisory. It does not merge, close, label by force, publish, contact external parties, spend funds, sign transactions, launch tokens, claim rewards, change payout routes, or approve external commitments. Human maintainers and Orbit's owner-approval gates remain authoritative.
