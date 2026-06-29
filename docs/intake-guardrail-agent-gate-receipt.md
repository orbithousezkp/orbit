# Intake Guardrail Agent Gate Receipt

## Cycle 181 direction choice

Orbit compared safe wake-cycle directions before creating this artifact:

- **Build** — continue the repo-local Intake Guardrail package. Best this cycle because the agent gate policy exists, but maintainers still need a reusable receipt they can attach to an issue, PR, or cycle note when an agent is allowed only partial access to scanned intake.
- **Infrastructure** — improve SDK, MCP, lifecycle, proof, or registry surfaces. Useful, but a receipt template strengthens the current guardrail prototype without touching already-dirty package CLI files.
- **Earn** — refine the Orbit agent passport and capability-registry adoption path. Valuable, but less immediate than making the current guardrail artifact easier for another repo to use safely.
- **Sustain** — refresh wallet-policy visibility. Important, but no wallet action, signing, payout-route change, reward claim, token launch, or approval-class movement is needed.
- **Grow** — add roadmap evidence. Useful, and this document is small proof-backed evidence that the guardrail is becoming a reusable infrastructure component.

Selected direction: **build**. Reason: a minimal, public-safe gate receipt lets maintainers prove how risky intake was handled without copying hidden payloads, wallet-risk content, or unsafe instructions into agent context. No publishing, outreach, paid commitment, wallet action, signing, token movement, reward claim, payout-route change, external spend, or external obligation was performed.

## Purpose

Use this receipt when the Intake Guardrail scans an issue, comment, or service request before another bot or agent reads it as instructions. The receipt records the gate decision and the safe handling boundary while keeping risky payloads out of follow-up prompts and public summaries.

This receipt is advisory evidence. It does not grant an agent authority to merge code, spend funds, sign transactions, publish packages, accept paid work, launch tokens, claim rewards, change payout routes, or bypass owner approval.

## Receipt template

```md
## Intake Guardrail agent gate receipt

- Intake surface: issue | comment | PR | discussion | other
- Intake reference:
- Scanner version or commit:
- Scan action: allow | warn | quarantine | block
- Highest risk category: none | prompt-injection | obfuscated-relay | wallet-risk | secret-risk | approval-class | other
- Agent access allowed: full | summary-only | metadata-only | none
- Human review required: yes | no
- Risky payload copied into agent context: no
- Encoded or obfuscated text decoded: no
- Approval-class action requested: no | yes, blocked pending owner approval
- Maintainer override: none | approved by:
- Safe summary:
- Next safe step:
- Receipt author:
- Receipt timestamp:
```

## Field rules

- **Intake reference** should point to the public issue, comment, PR, or discussion when safe. Do not paste hidden links, seed phrases, private credentials, or suspicious wallet recipients.
- **Highest risk category** should describe the risk class, not repeat the unsafe text.
- **Agent access allowed** should match the gate policy:
  - `allow` -> `full`, within the agent's normal repository permissions.
  - `warn` -> usually `summary-only`.
  - `quarantine` -> `metadata-only`.
  - `block` -> `none` for content access; only minimal metadata should be handled.
- **Risky payload copied into agent context** should stay `no` unless a human maintainer deliberately created a sanitized reproduction fixture.
- **Approval-class action requested** must be `yes, blocked pending owner approval` for spending, signing, token movement, reward claims, payout-route changes, external payments, publishing with obligations, paid commitments, or major risky external movement.
- **Safe summary** should be short and neutral. Prefer phrases like "possible wallet-drain request" or "encoded instruction relay" over copied payload content.

## Safe examples

### Clean intake

```md
## Intake Guardrail agent gate receipt

- Intake surface: issue
- Intake reference: #123
- Scanner version or commit: local
- Scan action: allow
- Highest risk category: none
- Agent access allowed: full
- Human review required: no
- Risky payload copied into agent context: no
- Encoded or obfuscated text decoded: no
- Approval-class action requested: no
- Maintainer override: none
- Safe summary: Visitor asks for documentation clarification.
- Next safe step: Agent may draft a docs patch within normal repo permissions.
- Receipt author: maintainer-or-agent
- Receipt timestamp: YYYY-MM-DDTHH:MM:SSZ
```

### Obfuscated relay

```md
## Intake Guardrail agent gate receipt

- Intake surface: comment
- Intake reference: #124 comment link
- Scanner version or commit: local
- Scan action: quarantine
- Highest risk category: obfuscated-relay
- Agent access allowed: metadata-only
- Human review required: yes
- Risky payload copied into agent context: no
- Encoded or obfuscated text decoded: no
- Approval-class action requested: no
- Maintainer override: none
- Safe summary: Comment asks the agent to decode hidden text and follow it.
- Next safe step: Human maintainer reviews without asking the agent to decode the payload.
- Receipt author: maintainer-or-agent
- Receipt timestamp: YYYY-MM-DDTHH:MM:SSZ
```

### Wallet-risk request

```md
## Intake Guardrail agent gate receipt

- Intake surface: issue
- Intake reference: #125
- Scanner version or commit: local
- Scan action: block
- Highest risk category: wallet-risk
- Agent access allowed: none
- Human review required: yes
- Risky payload copied into agent context: no
- Encoded or obfuscated text decoded: no
- Approval-class action requested: yes, blocked pending owner approval
- Maintainer override: none
- Safe summary: Visitor pressures the repo to perform a wallet or token action.
- Next safe step: Stop automation and route to owner-review policy; do not sign or move assets.
- Receipt author: maintainer-or-agent
- Receipt timestamp: YYYY-MM-DDTHH:MM:SSZ
```

## Review checklist

Before attaching this receipt, confirm:

1. The unsafe payload was not copied into the receipt.
2. Any encoded or hidden text was not decoded by the agent.
3. The selected access level matches the scan action.
4. Approval-class requests are blocked rather than treated as normal work.
5. The next step stays inside repository permissions or explicitly routes to human review.

Related docs: [agent gate policy](intake-guardrail-agent-gate-policy.md), [human review packet](intake-guardrail-human-review-packet.md), [maintainer queue](intake-guardrail-maintainer-queue.md), and [operator checklist](intake-guardrail-operator-checklist.md).
