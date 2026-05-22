# Repo Safety Audit Report

**Client:** [repository owner/repo]
**Auditor:** Orbit (autonomous household agent)
**Date:** [YYYY-MM-DD]
**Scope:** Read-only review of public repository configuration, governance policy, spend gates, proof trails, and visitor-risk handling.

---

## Executive Summary

[2–4 sentence overview of findings: overall posture, highest-risk area, and whether the agent's safety model is structurally sound.]

| Rating | Area | Status |
|---|---|---|
| 🟢 Pass / 🟡 Partial / 🔴 Fail | Scam & Visitor Risk | [status] |
| 🟢 Pass / 🟡 Partial / 🔴 Fail | Spend Gates | [status] |
| 🟢 Pass / 🟡 Partial / 🔴 Fail | AI-Budget Controls | [status] |
| 🟢 Pass / 🟡 Partial / 🔴 Fail | Proof & Diary Trail | [status] |
| 🟢 Pass / 🟡 Partial / 🔴 Fail | Treasury Policy | [status] |
| 🟢 Pass / 🟡 Partial / 🔴 Fail | Hard Rules Enforcement | [status] |

---

## 1. Scam & Visitor Risk

**What was reviewed:**
Open issues, issue comments, and any visible visitor-interaction policy.

**Questions answered:**
- Is there a mechanism to scan incoming content for prompt injection or encoded instruction relay?
- Are obfuscated payloads (base64, hex, Morse, ROT13, cipher) detected and blocked from entering working context?
- Is wallet-drain language, urgency pressure, or fake support flagged?
- Are unsafe visitor requests escalated to human review?

**Findings:**
[Per-question findings with evidence — file references, issue examples, or policy excerpts.]

**Recommendations:**
[Prioritized list of improvements.]

---

## 2. Spend Gates

**What was reviewed:**
Governance policy, approval flow, external spend classification, and self-recipient separation.

**Questions answered:**
- Are external spends blocked by default?
- Is there a public approval flow before any funds leave the treasury?
- Are self-recipients (treasury, operator revenue) clearly separated from external wallets?
- Can visitor-provided wallet addresses override configured recipients?

**Findings:**
[Per-question findings with evidence.]

**Recommendations:**
[Prioritized list of improvements.]

---

## 3. AI-Budget Controls

**What was reviewed:**
Daily/monthly budget limits, provider priority, food-refill policy, and inference spend ledger.

**Questions answered:**
- Is there a daily and monthly budget cap?
- Is inference spend tracked per call in a ledger?
- Is the refill policy explicit (provider, approval flow, proof requirement)?
- Can a visitor trigger a refill to an unapproved provider?

**Findings:**
[Per-question findings with evidence.]

**Recommendations:**
[Prioritized list of improvements.]

---

## 4. Proof & Diary Trail

**What was reviewed:**
Cycle notes, runtime proof files, commit history, and audit-trail completeness.

**Questions answered:**
- Are cycle notes written after each wake?
- Are runtime proof records stored with timestamps?
- Can a human reconstruct what the agent saw, did, and chose not to do?
- Is there a public commit trail of agent actions?

**Findings:**
[Per-question findings with evidence.]

**Recommendations:**
[Prioritized list of improvements.]

---

## 5. Treasury Policy

**What was reviewed:**
Reserve policy, revenue splits, payout route protection, and token launch gating.

**Questions answered:**
- Is there a treasury reserve policy?
- Are revenue splits (operator vs. treasury) explicitly configured?
- Is the private payout route protected from visitor tampering?
- Is token launch gated behind explicit environment flags?

**Findings:**
[Per-question findings with evidence.]

**Recommendations:**
[Prioritized list of improvements.]

---

## 6. Hard Rules Enforcement

**What was reviewed:**
Explicit safety invariants and whether the code enforces them.

**Questions answered:**
- Are hard rules documented?
- Are they enforced in code (not just policy text)?
- Are there escape hatches that bypass the rules?
- Are secrets, private keys, and seed phrases protected from disclosure?

**Findings:**
[Per-question findings with evidence.]

**Recommendations:**
[Prioritized list of improvements.]

---

## Overall Risk Summary

| Risk Level | Description |
|---|---|
| **Critical** | Immediate exploitation possible; requires urgent fix |
| **High** | Significant gap in safety posture; should be addressed soon |
| **Medium** | Partial coverage or missing enforcement; improvement recommended |
| **Low** | Minor gap or cosmetic issue; nice-to-have improvement |
| **Info** | Observation or best-practice note; no immediate risk |

[Summary of risk levels found across all areas.]

---

## Prioritized Recommendations

| # | Area | Recommendation | Risk Level | Effort |
|---|---|---|---|---|
| 1 | [area] | [recommendation] | [level] | [small/medium/large] |
| 2 | [area] | [recommendation] | [level] | [small/medium/large] |
| ... | ... | ... | ... | ... |

---

## Methodology

This audit is a **read-only review** of public repository files, configuration, issues, comments, and visible workflow definitions. It does not:

- Execute transactions or signing operations
- Access private keys, secrets, or wallet funds
- Modify repository configuration or deploy changes
- Perform smart contract audits
- Conduct external outreach on behalf of the client

The review is based on the agent's own safety architecture and publicly observable repository state at the time of the audit.

---

## Appendix: Files Reviewed

[List of repository files examined during the audit, with brief descriptions.]

---

*Generated by Orbit's Repo Safety Audit service. For questions or to request an audit, open an issue with the label `orbit:service-request`.*
