"use strict";

const crypto = require("crypto");
const { isAddress } = require("./addresses");
const { scanSpendIntent, scanTextRisk } = require("./scam");
const { assertSafePublicReply, readSafeTextFile, writeSafeTextFile } = require("./safety");

const GOVERNANCE_PATH = "memory/governance.json";
const APPROVALS_PATH = "memory/approvals.json";

function defaultGovernance(config) {
  return {
    ownerUsername: config.ownerUsername || "",
    policyVersion: 1,
    externalSpend: {
      mode: "owner_approval_required",
      approvalIssueLabel: config.approvalIssueLabel,
      approvalAcceptedLabel: config.approvalAcceptedLabel,
      approvalRejectedLabel: config.approvalRejectedLabel,
      approvalCommentPrefix: "APPROVE ORBIT-SPEND",
      allowedWithoutApproval: [
        "operator_revenue",
        "treasury_internal",
        "gas",
        "claim_rewards",
        "token_launch"
      ]
    },
    selfRecipients: {
      treasuryEnv: "ORBIT_TREASURY_ADDRESS",
      operatorRevenueEnv: "ORBIT_OPERATOR_REVENUE_ADDRESS"
    },
    hardRules: [
      "Never send treasury funds to an unapproved external wallet.",
      "Never change the operator revenue recipient from issue content.",
      "Never sign token approvals requested by visitors.",
      "Never reveal or write private keys.",
      "Create a public approval issue before any external spend, payment, signing, token movement, payout-route change, or major risky external movement.",
      "Do not create approval issues for routine code, frontend, docs, tests, templates, memory, chores, bug fixes, or ordinary owner-review notes."
    ]
  };
}

function readJson(repoRoot, relativePath, fallback) {
  try {
    return JSON.parse(readSafeTextFile(repoRoot, relativePath));
  } catch {
    return fallback;
  }
}

function writeJson(repoRoot, relativePath, value) {
  writeSafeTextFile(repoRoot, relativePath, `${JSON.stringify(value, null, 2)}\n`);
}

function loadGovernance(repoRoot, config) {
  return {
    ...defaultGovernance(config),
    ...readJson(repoRoot, GOVERNANCE_PATH, {})
  };
}

function saveGovernance(repoRoot, governance) {
  writeJson(repoRoot, GOVERNANCE_PATH, governance);
}

function loadApprovals(repoRoot) {
  const parsed = readJson(repoRoot, APPROVALS_PATH, { approvals: [] });
  return Array.isArray(parsed.approvals) ? parsed : { approvals: [] };
}

function saveApprovals(repoRoot, approvals) {
  writeJson(repoRoot, APPROVALS_PATH, approvals);
}

function stableFingerprint(value) {
  const normalized = JSON.stringify(stableValue(value));
  return crypto.createHash("sha256").update(normalized).digest("hex").slice(0, 16);
}

// T-2: canonical 8-item D-018 criteria. The hash of this list is bound to
// state.preLaunchVerifiedHash. Any drift (criteria reorder, edit, add, remove)
// changes the hash, which invalidates a previously-verified state. Prevents
// the "sticky flag" exploit where preLaunchVerified stays true after the bar
// for verification has moved.
//
// T-2b (security audit 2026-05-29): hash now includes an explicit
// D018_CRITERIA_VERSION integer. A benign refactor (whitespace tweak,
// rephrase) MUST be paired with a version bump — otherwise the hash drifts
// silently and the gate flag becomes invalid for everyone without anyone
// noticing the intent. The version makes "did we intend to invalidate
// existing verifications?" a yes/no question instead of a "look at the
// hash" question.
//
// To add/edit a criterion: bump D018_CRITERIA_VERSION + edit list. Re-verify.
const D018_CRITERIA_VERSION = 1;
const D018_CRITERIA = Object.freeze([
  { id: 1, label: "health 0 FAIL, 0 OPEN BLOCKERS" },
  { id: 2, label: "tests 0 fail" },
  { id: 3, label: "AI provider configured" },
  { id: 4, label: "12-hour clean Actions stretch" },
  { id: 5, label: "Signed proofs verifiable via npx @orbit-house/verifier" },
  { id: 6, label: "Dashboard reachable" },
  { id: 7, label: "Treasury Safe live" },
  { id: 8, label: "Pre-deploy checklist complete" }
]);

function d018CriteriaHash() {
  return stableFingerprint({ version: D018_CRITERIA_VERSION, items: D018_CRITERIA });
}

function assertPreLaunchHashIntegrity(state = {}) {
  const expectedHash = d018CriteriaHash();
  if (state.preLaunchVerified !== true) {
    return { ok: true, reason: "pre_launch_not_verified", expectedHash, currentHash: null };
  }
  const currentHash = typeof state.preLaunchVerifiedHash === "string"
    ? state.preLaunchVerifiedHash
    : null;
  if (currentHash === null) {
    return {
      ok: false,
      reason: "pre_launch_hash_missing",
      detail: "state.preLaunchVerified is true but state.preLaunchVerifiedHash is unset",
      expectedHash,
      currentHash: null
    };
  }
  if (currentHash !== expectedHash) {
    return {
      ok: false,
      reason: "pre_launch_hash_drift",
      detail: `D-018 criteria changed since verification (was ${currentHash}, now ${expectedHash})`,
      expectedHash,
      currentHash
    };
  }
  return { ok: true, reason: "verified", expectedHash, currentHash };
}

// T-7: time-based expiry on state.preLaunchVerified. 30-day max age forces
// owner re-verification even if D-018 criteria haven't drifted (T-2). Catches
// stale verifications where the environment (deps, infra, market) moved but
// the criteria definition did not.
const PRE_LAUNCH_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function assertPreLaunchNotExpired(state = {}, now = new Date()) {
  if (state.preLaunchVerified !== true) {
    return { ok: true, reason: "pre_launch_not_verified" };
  }
  const verifiedAtRaw = state.preLaunchVerifiedAt;
  if (!verifiedAtRaw || typeof verifiedAtRaw !== "string") {
    return {
      ok: false,
      reason: "pre_launch_age_unknown",
      detail: "state.preLaunchVerified is true but state.preLaunchVerifiedAt is unset"
    };
  }
  const verifiedAtMs = Date.parse(verifiedAtRaw);
  if (Number.isNaN(verifiedAtMs)) {
    return {
      ok: false,
      reason: "pre_launch_age_unknown",
      detail: `state.preLaunchVerifiedAt is not a valid ISO date: ${verifiedAtRaw}`
    };
  }
  const nowMs = now instanceof Date ? now.getTime() : Number(now);
  const ageMs = nowMs - verifiedAtMs;
  if (ageMs > PRE_LAUNCH_MAX_AGE_MS) {
    return {
      ok: false,
      reason: "pre_launch_expired",
      detail: `verification is ${Math.round(ageMs / (24 * 60 * 60 * 1000))} days old (max 30)`,
      ageMs,
      maxAgeMs: PRE_LAUNCH_MAX_AGE_MS,
      verifiedAt: verifiedAtRaw
    };
  }
  return { ok: true, reason: "verified", ageMs, maxAgeMs: PRE_LAUNCH_MAX_AGE_MS };
}

// T-2/T-7d (security audit 2026-05-29): convenience helper that all
// on-chain gates call before producing a tx. Combines the three checks:
//   1. state.preLaunchVerified === true (the D-018 master gate)
//   2. assertPreLaunchHashIntegrity (T-2 — criteria-drift defense)
//   3. assertPreLaunchNotExpired (T-7 — age defense)
// Returns { ok, reason, detail? }. The same blocked-shape consumers
// (clanker, treasury-sweep, etc.) already use.
//
// Backward-compat: legacy state that has preLaunchVerified=true but
// neither preLaunchVerifiedHash nor preLaunchVerifiedAt set is treated
// as LEGACY-ALLOWED (returns ok:true with reason="verified_legacy").
// This is so existing deployments + test fixtures do not silently break
// when T-2/T-7 wiring lands. Pre-launch verification post-2026-05-29
// MUST set both fields per OWNER_PUNCH_LIST.md §7; T-2/T-7 then bind.
function assertPreLaunchGate(state = {}, now = new Date()) {
  if (state.preLaunchVerified !== true) {
    return {
      ok: false,
      reason: "pre_launch_not_verified",
      detail: "state.preLaunchVerified is not true (D-018 pre-launch gate)"
    };
  }
  const hasHash = typeof state.preLaunchVerifiedHash === "string" && state.preLaunchVerifiedHash.length > 0;
  const hasTimestamp = typeof state.preLaunchVerifiedAt === "string" && state.preLaunchVerifiedAt.length > 0;
  if (!hasHash && !hasTimestamp) {
    return { ok: true, reason: "verified_legacy" };
  }
  const hashCheck = assertPreLaunchHashIntegrity(state);
  if (!hashCheck.ok) {
    return {
      ok: false,
      reason: hashCheck.reason,
      detail: hashCheck.detail,
      expectedHash: hashCheck.expectedHash,
      currentHash: hashCheck.currentHash
    };
  }
  const ageCheck = assertPreLaunchNotExpired(state, now);
  if (!ageCheck.ok) {
    return {
      ok: false,
      reason: ageCheck.reason,
      detail: ageCheck.detail,
      ageMs: ageCheck.ageMs,
      maxAgeMs: ageCheck.maxAgeMs
    };
  }
  return { ok: true, reason: "verified" };
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce((result, key) => {
        if (value[key] !== undefined) result[key] = stableValue(value[key]);
        return result;
      }, {});
  }
  return value;
}

function normalizeSpendRequest(request = {}) {
  return {
    category: request.category || "external_spend",
    purpose: request.purpose || "unspecified",
    asset: request.asset || "unknown",
    amount: request.amount === undefined ? null : request.amount,
    recipient: request.recipient || "",
    url: request.url || "",
    notes: request.notes || "",
    requestedAt: request.requestedAt || new Date().toISOString()
  };
}

function selfAddresses(config) {
  return {
    treasury: config.treasuryAddress || "",
    operatorRevenue: config.operatorRevenueAddress || ""
  };
}

function recipientClass(config, recipient) {
  const value = String(recipient || "").toLowerCase();
  const addresses = selfAddresses(config);
  if (!value) return "none";
  if (addresses.treasury && value === addresses.treasury.toLowerCase()) return "treasury";
  if (addresses.operatorRevenue && value === addresses.operatorRevenue.toLowerCase()) return "operator_revenue";
  if (isAddress(value)) return "external_wallet";
  return "non_address_or_protocol";
}

function classifySpend(config, rawRequest = {}) {
  const request = normalizeSpendRequest(rawRequest);
  const recipientKind = recipientClass(config, request.recipient);
  const risk = scanSpendIntent({
    ...request,
    treasuryAddress: config.treasuryAddress,
    operatorRevenueAddress: config.operatorRevenueAddress
  });

  const allowedOperatorRevenue = request.category === "operator_revenue" && recipientKind === "operator_revenue";
  const allowedTreasuryInternal = request.category === "treasury_internal" && recipientKind === "treasury";
  const allowedGas = request.category === "gas" && recipientKind === "none";
  const allowedClaim = request.category === "claim_rewards" && ["operator_revenue", "treasury", "none"].includes(recipientKind);
  const allowedLaunch = request.category === "token_launch" && ["treasury", "operator_revenue", "none", "non_address_or_protocol"].includes(recipientKind);

  const allowedWithoutApproval = allowedOperatorRevenue || allowedTreasuryInternal || allowedGas || allowedClaim || allowedLaunch;
  const requiresOwnerApproval = !allowedWithoutApproval || risk.score >= 70;

  return {
    request,
    recipientKind,
    risk,
    allowedWithoutApproval,
    requiresOwnerApproval,
    decision: requiresOwnerApproval ? "owner_approval_required" : "allowed",
    reason: requiresOwnerApproval
      ? "External or high-risk spend requires public owner approval."
      : "Spend is inside Orbit's allowed self/revenue policy."
  };
}

function upsertApproval(repoRoot, approval) {
  const store = loadApprovals(repoRoot);
  const index = store.approvals.findIndex((item) => item.id === approval.id);
  if (index >= 0) {
    store.approvals[index] = { ...store.approvals[index], ...approval, updatedAt: new Date().toISOString() };
  } else {
    store.approvals.push({ ...approval, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  }
  saveApprovals(repoRoot, store);
  return store.approvals.find((item) => item.id === approval.id);
}

function approvalIssueBody(approval) {
  const request = approval.classification.request;
  const purchaseUrl = typeof request.url === "string" ? request.url.trim() : "";
  const lines = [
    "Orbit is blocking an external or risky spend request until owner approval is public.",
    "",
    `Approval ID: \`${approval.id}\``,
    `Category: \`${request.category}\``,
    `Asset: \`${request.asset}\``,
    `Amount: \`${request.amount ?? "unspecified"}\``,
    `Recipient: \`${request.recipient || "none"}\``,
    `Purpose: ${request.purpose}`
  ];
  if (purchaseUrl) {
    lines.push(`Purchase URL: ${purchaseUrl}`);
  }
  lines.push(
    "",
    "Risk flags:",
    approval.classification.risk.flags.length
      ? approval.classification.risk.flags.map((flag) => `- ${flag.category}: ${flag.message}`).join("\n")
      : "- none",
    "",
    "To approve, the configured owner must add this exact standalone comment:",
    "",
    `\`APPROVE ORBIT-SPEND ${approval.id}\``,
    "",
    "To reject, the configured owner must add this exact standalone comment:",
    "",
    `\`REJECT ORBIT-SPEND ${approval.id}\``
  );
  return lines.join("\n");
}

// T-5 (STABILITY_SECURITY.md): public approval-issue bodies must not leak
// the sensitive fields of a spend request (Amount; Recipient; Purpose; URL
// on external_spend) when posted to a GitHub issue. Approver looks up the
// full request in memory/approvals.json by ID.
//
// T-5c (security audit, 2026-05-29): previous version redacted Recipient
// only when it matched /^0x[40]/. That missed ENS names, CAIP-10
// addresses, Bitcoin/Solana strings — all would leak as plain Recipient
// on a public repo. New default: redact unless the request category is on
// the SAFE_RECIPIENT_CATEGORIES allowlist (where recipient is a public
// class label, e.g. ai_food_refill's "configured-ai-credit-provider").
//
// Risk-flag CATEGORIES surface (they ARE the signal the approver needs);
// flag MESSAGES stay private (may themselves contain incident detail).
const SAFE_RECIPIENT_CATEGORIES = new Set([
  "ai_food_refill" // recipient is a configured provider name, not an address
]);

function approvalIssueBodyPublic(approval) {
  const request = approval.classification.request;
  const recipient = String(request.recipient || "");
  const recipientCategorySafe = SAFE_RECIPIENT_CATEGORIES.has(request.category);
  const recipientLine = recipient.length === 0
    ? "Recipient: `none`"
    : recipientCategorySafe
      ? `Recipient: \`${recipient}\``
      : "Recipient: `<redacted; see private state>`";

  const isExternalSpend = request.category === "external_spend";
  const purchaseUrl = typeof request.url === "string" ? request.url.trim() : "";

  const lines = [
    "Orbit is blocking an external or risky spend request until owner approval is public.",
    "",
    `Approval ID: \`${approval.id}\``,
    `Category: \`${request.category}\``,
    `Asset: \`${request.asset}\``,
    "Amount: `<redacted; see private state>`",
    recipientLine,
    "Purpose: `<redacted; see private state>`"
  ];
  // For non-external_spend categories (e.g. ai_food_refill), the URL is a
  // public click-target to the configured provider — keep it.
  if (!isExternalSpend && purchaseUrl) {
    lines.push(`Purchase URL: ${purchaseUrl}`);
  }
  lines.push(
    "",
    "Approver must inspect the full request locally in `memory/approvals.json`",
    "(keyed by Approval ID) before commenting APPROVE or REJECT.",
    "",
    "Risk-flag categories:",
    approval.classification.risk.flags.length
      ? approval.classification.risk.flags.map((flag) => `- ${flag.category}`).join("\n")
      : "- none",
    "",
    "To approve, the configured owner must add this exact standalone comment:",
    "",
    `\`APPROVE ORBIT-SPEND ${approval.id}\``,
    "",
    "To reject, the configured owner must add this exact standalone comment:",
    "",
    `\`REJECT ORBIT-SPEND ${approval.id}\``
  );
  return lines.join("\n");
}

async function requestOwnerApproval(config, github, rawRequest = {}) {
  const classification = classifySpend(config, rawRequest);
  if (!classification.requiresOwnerApproval) {
    return {
      status: "allowed",
      classification
    };
  }

  const { requestedAt, ...fingerprintRequest } = classification.request;
  const id = stableFingerprint({
    ...fingerprintRequest,
    recipientKind: classification.recipientKind
  });

  const existing = loadApprovals(config.repoRoot).approvals.find((item) => item.id === id);
  if (existing && ["approved", "rejected"].includes(existing.status)) {
    if (github && existing.issueNumber) {
      const checked = await checkOwnerApproval(config, github, id, { forceRemote: true });
      return {
        status: checked.status,
        approval: checked.approval,
        classification
      };
    }
    return {
      status: "pending",
      approval: upsertApproval(config.repoRoot, {
        id,
        status: "pending",
        lastCheckedAt: new Date().toISOString()
      }),
      classification
    };
  }

  const existingStatus = existing && existing.issueNumber ? existing.status : "pending";
  const approvalPreview = {
    id,
    status: existingStatus,
    classification,
    issueNumber: existing ? existing.issueNumber : null,
    issueUrl: existing ? existing.issueUrl : null
  };
  assertSafePublicReply(`[orbit approval] external spend ${id}\n${approvalIssueBody(approvalPreview)}`);

  let approval = upsertApproval(config.repoRoot, approvalPreview);

  if (!approval.issueNumber && github) {
    const issue = await github.createIssue({
      title: `[orbit approval] external spend ${id}`,
      body: approvalIssueBodyPublic(approval),
      labels: [config.approvalIssueLabel, "orbit:external-spend"].filter(Boolean)
    });
    approval = upsertApproval(config.repoRoot, {
      id,
      issueNumber: issue.number || null,
      issueUrl: issue.html_url || issue.url || null
    });
  }

  return {
    status: "blocked_pending_owner_approval",
    approval,
    classification
  };
}

function commentApproves(config, comment, id) {
  const author = comment.author || comment.user || "";
  const owner = String(config.ownerUsername || "").trim();
  const body = comment.body || "";
  if (!owner) return null;

  // Patch Set AH: reject bot accounts. The default GitHub Actions
  // token posts as `github-actions[bot]`, but operators sometimes
  // configure a PAT owned by themselves — without this guard,
  // an LLM with create_issue + comment_issue could self-approve.
  const a = String(author).toLowerCase().trim();
  if (a.endsWith("[bot]") || a === "github-actions") return null;

  const fromOwner = a === owner.toLowerCase();
  if (!fromOwner) return null;

  // Patch Set AH: same hardening as parseQuorumComments — skip lines
  // inside ``` code fences, blockquotes, or 4+ space/tab indented
  // code blocks. The maintainer's "here's how to approve, example:"
  // demo must not register as a real approval.
  const rawLines = body.split(/\r?\n/);
  let inCodeFence = false;
  for (const raw of rawLines) {
    const trimmed = raw.trim();
    if (/^`{3,}/.test(trimmed)) { inCodeFence = !inCodeFence; continue; }
    if (inCodeFence) continue;
    if (/^>/.test(trimmed)) continue;
    if (/^[ \t]{4,}\S/.test(raw)) continue;
    if (trimmed === `APPROVE ORBIT-SPEND ${id}`) return "approved";
    if (trimmed === `REJECT ORBIT-SPEND ${id}`) return "rejected";
  }
  return null;
}

async function checkOwnerApproval(config, github, approvalId, options = {}) {
  const store = loadApprovals(config.repoRoot);
  const approval = store.approvals.find((item) => item.id === approvalId);
  if (!approval) return { status: "not_found", approvalId };
  if ((approval.status === "approved" || approval.status === "rejected") && !options.forceRemote) {
    return { status: approval.status, approval };
  }
  if (!github || !approval.issueNumber) {
    const status = options.forceRemote ? "pending" : approval.status;
    const updated = options.forceRemote && approval.status !== "pending"
      ? upsertApproval(config.repoRoot, {
          id: approvalId,
          status,
          lastCheckedAt: new Date().toISOString()
        })
      : approval;
    return { status, approval: updated };
  }

  const issues = await github.listIssues({ state: "all", perPage: 100 });
  const issue = issues.find((item) => item.number === approval.issueNumber);
  if (!issue) {
    const updated = upsertApproval(config.repoRoot, {
      id: approvalId,
      status: "pending",
      lastCheckedAt: new Date().toISOString()
    });
    return { status: "pending", approval: updated };
  }

  let status = "pending";

  if (typeof github.listIssueComments === "function") {
    const comments = await github.listIssueComments(approval.issueNumber);
    for (const comment of comments) {
      const verdict = commentApproves(config, comment, approvalId);
      if (verdict) {
        status = verdict;
        break;
      }
    }
  }

  const updated = upsertApproval(config.repoRoot, {
    id: approvalId,
    status,
    lastCheckedAt: new Date().toISOString()
  });

  return { status, approval: updated };
}

async function guardSpend(config, github, request) {
  const classification = classifySpend(config, request);
  if (!classification.requiresOwnerApproval) {
    return {
      allowed: true,
      status: "allowed",
      classification
    };
  }

  const requested = await requestOwnerApproval(config, github, request);
  if (requested.approval) {
    const checked = await checkOwnerApproval(config, github, requested.approval.id, { forceRemote: true });
    if (checked.status === "approved") {
      return {
        allowed: true,
        status: "approved",
        approval: checked.approval,
        classification
      };
    }
    if (checked.status === "rejected") {
      return {
        allowed: false,
        status: "rejected",
        approval: checked.approval,
        classification
      };
    }
  }

  return {
    allowed: false,
    status: requested.status,
    approval: requested.approval,
    classification
  };
}

function governanceStatus(config) {
  const governance = loadGovernance(config.repoRoot, config);
  const approvals = loadApprovals(config.repoRoot);
  return {
    governance,
    approvals,
    approvalCounts: approvals.approvals.reduce((counts, item) => {
      counts[item.status] = (counts[item.status] || 0) + 1;
      return counts;
    }, {})
  };
}

const ACTION_TIER_MAP = {
  buyback: "high",
  "merkle-anchor": "medium",
  handoff: "critical",
  "federation-trust": "high",
  "treasury-deploy": "high"
};

function actionTier(actionType) {
  if (!actionType) return "medium";
  const key = String(actionType).toLowerCase();
  return ACTION_TIER_MAP[key] || "medium";
}

function normalizeActionToken(actionType) {
  return String(actionType || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseQuorumComments(comments, idemKey, maintainers) {
  const approvals = new Set();
  const rejections = new Set();
  let lastActivity = null;
  const allowed = new Set((Array.isArray(maintainers) ? maintainers : []).map((m) => String(m || "").toLowerCase()));
  const idem = String(idemKey || "").trim();
  if (!idem || !Array.isArray(comments)) {
    return { approvals, rejections, lastActivity };
  }

  for (const comment of comments) {
    if (!comment) continue;
    const author = String(comment.author || comment.user || "").toLowerCase().trim();
    // Patch Set AH: bot guard. Reject github-actions[bot] and any
    // future [bot]-suffixed account. The default GH Actions token
    // posts as `github-actions[bot]`, but a misconfigured PAT may
    // collide with a maintainer's handle — without this guard, the
    // LLM could create_issue + comment_issue + self-approve.
    if (!author || author.endsWith("[bot]") || author === "github-actions") continue;
    if (!allowed.has(author)) continue;
    const body = String(comment.body || "");
    // Track markdown code-fence and blockquote state. Without this, a
    // maintainer can post a comment that LOOKS like documentation
    // ("here's an example: ```APPROVE ORBIT-SPEND abc```") and the
    // line-anchored regex would still match the inner line — counting
    // a docs example as a real vote. See pentest 2026-05-26 §quorum.
    const rawLines = body.split(/\r?\n/);
    let inCodeFence = false;
    let voted = false;
    for (const raw of rawLines) {
      const trimmed = raw.trim();
      // A bare ``` (or ```lang) toggles fence state. Indented code blocks
      // (4+ leading spaces) on the raw line also count as code per
      // GitHub Markdown — skip those too.
      if (/^`{3,}/.test(trimmed)) {
        inCodeFence = !inCodeFence;
        continue;
      }
      if (inCodeFence) continue;
      // Quoted text (a "> "-prefix line) is also semantically a quote,
      // not a vote — strip it from consideration.
      if (/^>/.test(trimmed)) continue;
      // Indented code (4+ spaces in the RAW line).
      if (/^[ \t]{4,}\S/.test(raw)) continue;
      const approveMatch = trimmed.match(/^APPROVE\s+ORBIT-([A-Z0-9-]+)\s+(\S+)$/);
      const rejectMatch = trimmed.match(/^REJECT\s+ORBIT-([A-Z0-9-]+)\s+(\S+)$/);
      if (approveMatch && approveMatch[2] === idem) {
        approvals.add(author);
        voted = true;
      }
      if (rejectMatch && rejectMatch[2] === idem) {
        rejections.add(author);
        voted = true;
      }
    }
    if (voted) {
      const created = comment.createdAt || comment.created_at || comment.timestamp || null;
      if (created && (!lastActivity || String(created) > String(lastActivity))) {
        lastActivity = created;
      }
    }
  }

  return { approvals, rejections, lastActivity };
}

function evaluateQuorum({ comments, idemKey, actionTier: tier, quorum } = {}) {
  if (!quorum || quorum.enabled !== true) {
    return { status: "disabled" };
  }
  const maintainers = Array.isArray(quorum.maintainers) ? quorum.maintainers : [];
  const total = maintainers.length;
  const tierKey = tier || "medium";
  const thresholds = quorum.thresholds || {};
  const threshold = Math.max(1, Math.min(total, Number(thresholds[tierKey]) || 1));

  const { approvals, rejections, lastActivity } = parseQuorumComments(comments, idemKey, maintainers);

  if (rejections.size > 0) {
    const rejector = Array.from(rejections)[0];
    return {
      status: "rejected",
      rejector,
      reason: "maintainer-reject",
      approvals,
      rejections,
      lastActivity
    };
  }

  if (approvals.size >= threshold) {
    return {
      status: "approved",
      approvals,
      threshold,
      total,
      lastActivity
    };
  }

  return {
    status: "pending",
    approvals,
    rejections,
    needed: Math.max(0, threshold - approvals.size),
    threshold,
    total,
    lastActivity
  };
}

function requiresQuorum(actionType, quorum) {
  if (!quorum || quorum.enabled !== true) return false;
  const tier = actionTier(actionType);
  if (tier === "low") return false;
  const maintainers = Array.isArray(quorum.maintainers) ? quorum.maintainers : [];
  if (maintainers.length <= 1) return false;
  return true;
}

// ── Treasury floor guard (T-1) ─────────────────────────────────────────────
// Operator-configured hard cap on outbound on-chain spending. Defaults disable
// the guard so existing deployments are unaffected; opt in by populating
// state.treasury (or config.treasury) with `floorWei`, `balanceEstimateWei`,
// `maxSpendPerCycleWei`, and/or `hardCapPerCycleWei`.
//
// T-1b (security audit, 2026-05-28): when floorWei IS set, the check is
// fail-CLOSED on missing/stale balance evidence. Spec is "every on-chain
// action calls this before producing a tx" — an attacker who blanks
// state.treasury.balanceEstimateWei must not silently re-enable spending.
// Freshness window: 1 hour by default. Override via state.treasury.balanceEstimateFreshnessMs
// or config.treasury.balanceEstimateFreshnessMs.

const TREASURY_BALANCE_FRESHNESS_MS_DEFAULT = 60 * 60 * 1000;

function toBigInt(value) {
  if (value === null || value === undefined || value === "") return null;
  try {
    if (typeof value === "bigint") return value;
    if (typeof value === "number" && Number.isFinite(value)) return BigInt(Math.trunc(value));
    const str = String(value).trim();
    if (!/^-?\d+$/.test(str)) return null;
    return BigInt(str);
  } catch {
    return null;
  }
}

function treasuryPolicy(state, config) {
  const fromState = (state && state.treasury) || {};
  const fromConfig = (config && config.treasury) || {};
  const freshnessRaw = fromState.balanceEstimateFreshnessMs != null
    ? fromState.balanceEstimateFreshnessMs
    : fromConfig.balanceEstimateFreshnessMs;
  const freshnessMs = Number.isFinite(Number(freshnessRaw)) && Number(freshnessRaw) > 0
    ? Number(freshnessRaw)
    : TREASURY_BALANCE_FRESHNESS_MS_DEFAULT;
  return {
    floorWei: toBigInt(fromState.floorWei != null ? fromState.floorWei : fromConfig.floorWei),
    balanceEstimateWei: toBigInt(
      fromState.balanceEstimateWei != null
        ? fromState.balanceEstimateWei
        : fromConfig.balanceEstimateWei
    ),
    balanceEstimateAt: fromState.balanceEstimateAt || fromConfig.balanceEstimateAt || null,
    balanceEstimateFreshnessMs: freshnessMs,
    maxSpendPerCycleWei: toBigInt(
      fromState.maxSpendPerCycleWei != null
        ? fromState.maxSpendPerCycleWei
        : fromConfig.maxSpendPerCycleWei
    ),
    hardCapPerCycleWei: toBigInt(
      fromState.hardCapPerCycleWei != null
        ? fromState.hardCapPerCycleWei
        : fromConfig.hardCapPerCycleWei
    )
  };
}

function assertTreasuryFloor({ state, config, amountWei, actionType, actionLabel, now } = {}) {
  const planned = toBigInt(amountWei);
  if (planned === null) {
    return {
      ok: false,
      reason: "treasury_floor_invalid_amount",
      detail: "spend amount must be a numeric wei value",
      actionType: actionType || null
    };
  }
  if (planned < 0n) {
    return {
      ok: false,
      reason: "treasury_floor_invalid_amount",
      detail: "spend amount cannot be negative",
      actionType: actionType || null
    };
  }
  const policy = treasuryPolicy(state, config);

  // T-1b: hostile / corrupted state defense. A negative floor would let
  // any spend pass the "after >= floor" check, so reject the policy itself.
  if (policy.floorWei !== null && policy.floorWei < 0n) {
    return {
      ok: false,
      reason: "treasury_floor_invalid_policy",
      detail: "treasury.floorWei cannot be negative",
      actionType: actionType || null,
      floorWei: policy.floorWei.toString()
    };
  }

  // T-1b: when the operator has opted into the floor (floorWei present),
  // the balance evidence becomes load-bearing. Missing balance or stale
  // balance must fail-closed — never skip the check.
  if (policy.floorWei !== null) {
    if (policy.balanceEstimateWei === null) {
      return {
        ok: false,
        reason: "treasury_floor_balance_missing",
        detail: "treasury.floorWei is set but balanceEstimateWei is missing; refusing fail-open",
        actionType: actionType || null,
        floorWei: policy.floorWei.toString()
      };
    }
    const nowMs = now instanceof Date ? now.getTime()
      : Number.isFinite(Number(now)) ? Number(now)
      : Date.now();
    const stampMs = policy.balanceEstimateAt ? Date.parse(policy.balanceEstimateAt) : NaN;
    if (Number.isNaN(stampMs) || (nowMs - stampMs) > policy.balanceEstimateFreshnessMs) {
      return {
        ok: false,
        reason: "treasury_floor_balance_stale",
        detail: `balanceEstimateAt (${policy.balanceEstimateAt || "missing"}) is older than ${policy.balanceEstimateFreshnessMs}ms or unparseable`,
        actionType: actionType || null,
        balanceEstimateAt: policy.balanceEstimateAt,
        balanceEstimateFreshnessMs: policy.balanceEstimateFreshnessMs
      };
    }
  }

  if (policy.hardCapPerCycleWei !== null && planned > policy.hardCapPerCycleWei) {
    return {
      ok: false,
      reason: "treasury_floor_hard_cap_exceeded",
      detail: `${actionLabel || actionType || "spend"} ${planned.toString()} wei exceeds hard cap ${policy.hardCapPerCycleWei.toString()} wei`,
      actionType: actionType || null,
      plannedWei: planned.toString(),
      hardCapPerCycleWei: policy.hardCapPerCycleWei.toString()
    };
  }
  if (policy.maxSpendPerCycleWei !== null && planned > policy.maxSpendPerCycleWei) {
    return {
      ok: false,
      reason: "treasury_floor_max_per_cycle_exceeded",
      detail: `${actionLabel || actionType || "spend"} ${planned.toString()} wei exceeds per-cycle cap ${policy.maxSpendPerCycleWei.toString()} wei`,
      actionType: actionType || null,
      plannedWei: planned.toString(),
      maxSpendPerCycleWei: policy.maxSpendPerCycleWei.toString()
    };
  }
  if (policy.floorWei !== null && policy.balanceEstimateWei !== null) {
    const after = policy.balanceEstimateWei - planned;
    if (after < policy.floorWei) {
      return {
        ok: false,
        reason: "treasury_floor_breach",
        detail: `${actionLabel || actionType || "spend"} would leave treasury at ${after.toString()} wei, below floor ${policy.floorWei.toString()} wei`,
        actionType: actionType || null,
        plannedWei: planned.toString(),
        balanceEstimateWei: policy.balanceEstimateWei.toString(),
        balanceEstimateAt: policy.balanceEstimateAt,
        floorWei: policy.floorWei.toString(),
        projectedAfterWei: after.toString()
      };
    }
  }
  return {
    ok: true,
    plannedWei: planned.toString(),
    floorWei: policy.floorWei !== null ? policy.floorWei.toString() : null,
    balanceEstimateWei:
      policy.balanceEstimateWei !== null ? policy.balanceEstimateWei.toString() : null,
    maxSpendPerCycleWei:
      policy.maxSpendPerCycleWei !== null ? policy.maxSpendPerCycleWei.toString() : null,
    hardCapPerCycleWei:
      policy.hardCapPerCycleWei !== null ? policy.hardCapPerCycleWei.toString() : null
  };
}

module.exports = {
  ACTION_TIER_MAP,
  APPROVALS_PATH,
  D018_CRITERIA,
  D018_CRITERIA_VERSION,
  GOVERNANCE_PATH,
  PRE_LAUNCH_MAX_AGE_MS,
  actionTier,
  approvalIssueBody,
  approvalIssueBodyPublic,
  assertPreLaunchGate,
  assertPreLaunchHashIntegrity,
  assertPreLaunchNotExpired,
  assertTreasuryFloor,
  checkOwnerApproval,
  classifySpend,
  d018CriteriaHash,
  evaluateQuorum,
  governanceStatus,
  guardSpend,
  loadApprovals,
  loadGovernance,
  normalizeActionToken,
  parseQuorumComments,
  requestOwnerApproval,
  requiresQuorum,
  saveApprovals,
  saveGovernance,
  scanTextRisk,
  stableFingerprint
};
