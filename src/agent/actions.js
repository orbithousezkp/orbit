"use strict";

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { behaviorStatus } = require("./behavior");
const { addTask, completeTask, loadTasks, TASKS_PATH } = require("./tasks");
const { launchNativeToken, prepareClankerLaunch, runRevenueCycle } = require("./clanker");
const { sanitizeCycleNoteForPublic, isCycleNotePath } = require("./cycle-note-sanitize");
const { featureSummary, listFeatures } = require("./features");
const {
  APPROVALS_PATH,
  GOVERNANCE_PATH,
  checkOwnerApproval,
  governanceStatus,
  guardSpend,
  requestOwnerApproval
} = require("./governance");
const {
  KNOWLEDGE_PATH,
  appendMemory,
  deleteMemory,
  listMemory,
  searchMemory
} = require("./memory");
const { omitUnsafeVisitorContent, scanSpendIntent, scanTextRisk } = require("./scam");
const {
  AGENT_SOURCES_PATH,
  IDEA_INBOX_PATH,
  PROBLEM_LAB_PATH,
  PROJECT_IDEAS_PATH,
  learningLabStatus,
  quarantineExternalIdea
} = require("./learning-lab");
const { OPPORTUNITIES_PATH, opportunityStatus } = require("./opportunities");
const { infrastructureStatus } = require("./infrastructure");
const { walletStatus } = require("./wallet");
const { roadmapStatus } = require("./roadmap");
const {
  assertNoSymlinkPath,
  assertSafePublicReply,
  assertSafeTextForWrite,
  readSafeTextFile,
  redactSecrets,
  writeSafeTextFile
} = require("./safety");
const { aiFoodPolicy, assertConfiguredAiFoodPurchase, buildAiFoodRefillRequest } = require("./ai-food");
const {
  BUYBACK_LEDGER_PATH,
  executeBuyback,
  proposeBuyback
} = require("./buyback");
const {
  ANCHOR_LEDGER_PATH,
  executeAnchor,
  proposeAnchor
} = require("./merkle-anchor");
const {
  TREASURY_PATH,
  budgetStatus,
  loadTreasury,
  recordAiCreditRefill,
  syncRevenuePolicy,
  upsertPendingTopUp
} = require("./treasury");
const { fetchUrl, webSearch } = require("./web");

const filesChanged = new Set();
const PROTECTED_WRITE_PATHS = new Set([
  "memory/approvals.json",
  "memory/governance.json",
  "memory/treasury.json"
]);
const SECRET_ENV_PATTERNS = [
  /TOKEN/i,
  /SECRET/i,
  /PRIVATE/i,
  /PASSWORD/i,
  /API_KEY/i,
  /WALLET/i,
  /^GH_/i,
  /^GITHUB_/i,
  /^ORBIT_.*KEY/i
];
const APPROVAL_ISSUE_LABEL = "orbit:approval";
const APPROVAL_ISSUE_PATTERNS = [
  /\b(owner approval|approval required|approval issue|external spend|wallet spend|send money|transfer funds|token launch|reward claim|change payout|payout route|operator revenue|treasury recipient|sign transaction|major movement|risky movement)\b/i
];
const BINARY_ASSET_EXTENSIONS = new Set([
  ".avif",
  ".gif",
  ".ico",
  ".jpeg",
  ".jpg",
  ".mp4",
  ".pdf",
  ".png",
  ".webm",
  ".webp"
]);
const TEXT_IMAGE_EXTENSIONS = new Set([
  ".svg"
]);
const MAX_INLINE_ASSET_BYTES = 32_000;
const MAX_INLINE_TEXT_ASSET_BYTES = 20_000;
const MAX_TEXT_WRITE_BYTES = 500_000;

function track(relativePath) {
  filesChanged.add(relativePath.replace(/\\/g, "/"));
}

function isBinaryAssetPath(relativePath) {
  return BINARY_ASSET_EXTENSIONS.has(path.extname(String(relativePath || "")).toLowerCase());
}

function isTextImageAssetPath(relativePath) {
  return TEXT_IMAGE_EXTENSIONS.has(path.extname(String(relativePath || "")).toLowerCase());
}

function readFileForTool(config, relativePath) {
  const { normalized, resolved } = assertNoSymlinkPath(config.repoRoot, relativePath);
  const stats = fs.statSync(resolved);
  if (isBinaryAssetPath(normalized) || (isTextImageAssetPath(normalized) && stats.size > MAX_INLINE_TEXT_ASSET_BYTES)) {
    return {
      path: normalized,
      contentOmitted: true,
      binaryAsset: isBinaryAssetPath(normalized),
      frontendAsset: true,
      sizeBytes: stats.size,
      reason: "Large frontend asset bytes are omitted from AI context. Reference this repository path from frontend code instead of reading or embedding the asset."
    };
  }

  return {
    path: normalized,
    content: redactSecrets(readSafeTextFile(config.repoRoot, normalized)).slice(0, 20_000),
    truncated: stats.size > 20_000
  };
}

function embeddedImageBytes(content) {
  const value = String(content || "");
  const matches = value.match(/data:image\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=\r\n]+/gi) || [];
  return matches.reduce((total, match) => total + Buffer.byteLength(match), 0);
}

function assertNoLargeInlineAssets(content) {
  const inlineBytes = embeddedImageBytes(content);
  if (inlineBytes > MAX_INLINE_ASSET_BYTES) {
    throw new Error("refusing to write large inline image data; keep frontend images as repository assets and reference their paths");
  }
}

function assertTextWriteSize(relativePath, content) {
  const bytes = Buffer.byteLength(String(content || ""));
  if (isBinaryAssetPath(relativePath)) {
    throw new Error("write_file writes text only; keep binary frontend images as assets and reference their paths");
  }
  if (bytes > MAX_TEXT_WRITE_BYTES) {
    throw new Error(`refusing to write oversized text payload (${bytes} bytes) through write_file`);
  }
}

function writeFile(config, relativePath, content) {
  const { normalized } = assertNoSymlinkPath(config.repoRoot, relativePath);
  if (PROTECTED_WRITE_PATHS.has(normalized)) {
    throw new Error(`direct writes to ${normalized} are not allowed`);
  }
  // Cycle notes are GitHub-visible. Strip any AI cost / budget figures before
  // committing — feedback_no_money_on_github + belt-and-braces over prompt
  // instructions that already tell the agent not to write money figures.
  const sanitized = isCycleNotePath(normalized)
    ? sanitizeCycleNoteForPublic(String(content || ""))
    : content;
  assertTextWriteSize(normalized, sanitized);
  assertNoLargeInlineAssets(sanitized);
  assertSafeTextForWrite(sanitized);
  writeSafeTextFile(config.repoRoot, normalized, sanitized);
  track(normalized);
  return { path: normalized, bytes: Buffer.byteLength(String(sanitized || "")) };
}

function safeCommandEnv(env = process.env) {
  return Object.fromEntries(
    Object.entries(env).filter(([key]) => (
      !SECRET_ENV_PATTERNS.some((pattern) => pattern.test(key))
    ))
  );
}

function safePublicLabels(labels = []) {
  if (!Array.isArray(labels)) return [];
  const normalized = labels
    .map((label) => String(label || "").trim())
    .filter(Boolean)
    .slice(0, 20);
  assertSafeTextForWrite(normalized.join("\n"));
  return normalized;
}

function assertApprovalIssueOnly(config, title, body, labels = []) {
  const normalizedLabels = safePublicLabels(labels);
  const requiredLabel = String(config.approvalIssueLabel || APPROVAL_ISSUE_LABEL).toLowerCase();
  if (!normalizedLabels.some((label) => String(label || "").toLowerCase() === requiredLabel)) {
    throw new Error("generic create_issue is limited to approval-class issues with the approval label");
  }

  const text = `${title}\n${body}`;
  const risk = scanTextRisk(text);
  const approvalSignals = APPROVAL_ISSUE_PATTERNS.some((pattern) => pattern.test(text));

  if (!approvalSignals && risk.score < 70) {
    throw new Error("generic create_issue is limited to approval-class issues for wallet spending or major risky movements");
  }

  return normalizedLabels;
}

function assertNoApprovalDecisionLabels(config, labels = []) {
  const blocked = new Set([
    String(config.approvalAcceptedLabel || "").toLowerCase(),
    String(config.approvalRejectedLabel || "").toLowerCase()
  ].filter(Boolean));
  const attempted = labels.find((label) => blocked.has(String(label || "").toLowerCase()));
  if (attempted) {
    throw new Error(`approval decision labels can only be applied by the repository owner: ${attempted}`);
  }
}

function tokenizeCommand(command) {
  const value = String(command || "").trim();
  if (!value) throw new Error("command is required");
  if (/[;&|<>`$\\\n\r"']/.test(value)) {
    throw new Error("command contains shell syntax that is not allowed");
  }
  return value.split(/\s+/);
}

function commandAllowed(config, command) {
  if (!config.allowCommands) return { allowed: false, tokens: [] };
  const tokens = tokenizeCommand(command);
  const allowed = config.commandAllowlist.some((entry) => {
    const allowedTokens = tokenizeCommand(entry);
    return allowedTokens.length === tokens.length &&
      allowedTokens.every((token, index) => tokens[index] === token);
  });
  return { allowed, tokens };
}

function runCommand(config, command) {
  const { allowed, tokens } = commandAllowed(config, command);
  if (!allowed) {
    throw new Error(`command is not allowlisted: ${command}`);
  }

  const output = execFileSync(tokens[0], tokens.slice(1), {
    cwd: config.repoRoot,
    encoding: "utf-8",
    env: safeCommandEnv(),
    timeout: 60_000,
    maxBuffer: 1024 * 1024
  });

  return redactSecrets(output).slice(0, 12_000);
}

function cycleNotePath(cycle, title) {
  const slug = String(title || "note")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48) || "note";
  return `memory/cycles/${String(cycle).padStart(4, "0")}-${slug}.md`;
}

async function executeTool(config, github, cycle, name, input) {
  switch (name) {
    case "behavior_status": {
      return behaviorStatus({
        tasks: loadTasks(config.repoRoot),
        governance: governanceStatus(config),
        aiBudget: budgetStatus(config),
        issues: []
      });
    }

    case "roadmap_status": {
      return roadmapStatus(config.repoRoot);
    }

    case "infrastructure_status": {
      return infrastructureStatus(config.repoRoot);
    }

    case "wallet_status": {
      return walletStatus(config.repoRoot);
    }

    case "read_file": {
      return readFileForTool(config, input.path);
    }

    case "write_file": {
      return writeFile(config, input.path, input.content);
    }

    case "append_task": {
      const task = addTask(config.repoRoot, input);
      track(TASKS_PATH);
      return task;
    }

    case "complete_task": {
      const task = completeTask(config.repoRoot, input.id, input.outcome || "");
      track(TASKS_PATH);
      return task;
    }

    case "list_issues": {
      const issues = await github.listIssues({
        state: input.state || "open",
        perPage: input.perPage || 20
      });
      return issues.map((issue) => ({
        ...issue,
        title: omitUnsafeVisitorContent(redactSecrets(issue.title || "")),
        body: omitUnsafeVisitorContent(redactSecrets(issue.body || "")).slice(0, 2_000)
      }));
    }

    case "get_issue": {
      const issue = await github.getIssue(input.issueNumber);
      if (!issue) return null;
      const result = {
        ...issue,
        title: omitUnsafeVisitorContent(redactSecrets(issue.title || "")),
        body: omitUnsafeVisitorContent(redactSecrets(issue.body || "")).slice(0, 8_000)
      };
      if (input.includeComments) {
        const comments = await github.listIssueComments(input.issueNumber);
        result.commentList = comments.map((comment) => ({
          ...comment,
          body: omitUnsafeVisitorContent(redactSecrets(comment.body || "")).slice(0, 4_000)
        }));
      }
      return result;
    }

    case "comment_issue": {
      assertSafePublicReply(input.body);
      return github.commentIssue(input.issueNumber, input.body);
    }

    case "create_issue": {
      assertSafePublicReply(`${input.title}\n${input.body}`);
      const labels = assertApprovalIssueOnly(config, input.title, input.body, input.labels || []);
      assertNoApprovalDecisionLabels(config, labels);
      return github.createIssue({
        title: input.title,
        body: input.body,
        labels
      });
    }

    case "close_issue": {
      if (input.body) assertSafePublicReply(input.body);
      return github.closeIssue(input.issueNumber, input.body || "");
    }

    case "label_issue": {
      const labels = safePublicLabels(input.labels);
      assertNoApprovalDecisionLabels(config, labels);
      return github.addLabels(input.issueNumber, labels);
    }

    case "append_memory": {
      const entry = appendMemory(config.repoRoot, input);
      track(KNOWLEDGE_PATH);
      return entry;
    }

    case "list_memory": {
      return listMemory(config.repoRoot, input || {});
    }

    case "search_memory": {
      return searchMemory(config.repoRoot, input || {});
    }

    case "delete_memory": {
      const result = deleteMemory(config.repoRoot, input.id);
      track(KNOWLEDGE_PATH);
      return result;
    }

    case "fetch_url": {
      return fetchUrl(config, input);
    }

    case "web_search": {
      return webSearch(config, input);
    }

    case "github_search": {
      return github.search({
        type: input.type,
        query: input.query,
        perPage: input.perPage
      });
    }

    case "list_pull_requests": {
      const pulls = await github.listPullRequests({
        state: input.state || "open",
        perPage: input.perPage || 20
      });
      return pulls.map((pr) => ({
        ...pr,
        title: omitUnsafeVisitorContent(redactSecrets(pr.title || "")),
        body: omitUnsafeVisitorContent(redactSecrets(pr.body || "")).slice(0, 2_000),
        author: redactSecrets(String(pr.author || "")).slice(0, 80),
        labels: safePublicLabels(pr.labels || []),
        url: String(pr.url || "").slice(0, 500),
        headRef: redactSecrets(String(pr.headRef || "")).slice(0, 200),
        baseRef: redactSecrets(String(pr.baseRef || "")).slice(0, 200)
      }));
    }

    case "get_pull_request": {
      const pr = await github.getPullRequest(input.pullNumber);
      if (!pr) return null;
      const result = {
        ...pr,
        title: omitUnsafeVisitorContent(redactSecrets(pr.title || "")),
        body: omitUnsafeVisitorContent(redactSecrets(pr.body || "")).slice(0, 8_000),
        author: redactSecrets(String(pr.author || "")).slice(0, 80),
        labels: safePublicLabels(pr.labels || []),
        url: String(pr.url || "").slice(0, 500),
        headRef: redactSecrets(String(pr.headRef || "")).slice(0, 200),
        baseRef: redactSecrets(String(pr.baseRef || "")).slice(0, 200)
      };
      if (input.includeFiles) {
        const files = await github.getPullRequestFiles(input.pullNumber);
        result.files = files.map((file) => ({
          ...file,
          filename: redactSecrets(String(file.filename || "")).slice(0, 500),
          previousFilename: file.previousFilename
            ? redactSecrets(String(file.previousFilename)).slice(0, 500)
            : null
        }));
      }
      return result;
    }

    case "review_pull_request": {
      const sections = ["summary", "scope", "security", "tests"];
      for (const key of sections) {
        if (typeof input[key] !== "string" || input[key].trim().length === 0) {
          throw new Error(`review_pull_request requires non-empty ${key}`);
        }
        assertSafePublicReply(input[key]);
      }
      const recommendation = input.recommendation;
      if (!["approve", "request_changes", "comment"].includes(recommendation)) {
        throw new Error("review_pull_request recommendation must be approve, request_changes, or comment");
      }
      const recommendationLabel = {
        approve: "Approve",
        request_changes: "Request changes",
        comment: "Comment only"
      }[recommendation];
      const body = [
        "## Orbit review",
        "",
        `**Recommendation:** ${recommendationLabel}`,
        "",
        "### Summary",
        input.summary.trim(),
        "",
        "### Scope",
        input.scope.trim(),
        "",
        "### Security",
        input.security.trim(),
        "",
        "### Tests",
        input.tests.trim(),
        "",
        "_Posted by Orbit cycle. Owner approval still gates any merge or follow-up action._"
      ].join("\n");
      assertSafePublicReply(body);
      return github.commentIssue(input.pullNumber, body);
    }

    case "run_command": {
      return {
        command: input.command,
        output: runCommand(config, input.command)
      };
    }

    case "write_cycle_note": {
      const note = [
        `# ${input.title}`,
        "",
        input.body,
        "",
        `Written by Orbit cycle ${cycle}.`
      ].join("\n");
      return writeFile(config, cycleNotePath(cycle, input.title), note);
    }

    case "treasury_status": {
      const treasury = syncRevenuePolicy(config);
      track(TREASURY_PATH);
      return {
        budget: budgetStatus(config),
        treasury,
        tokenLaunch: prepareClankerLaunch(config, cycle)
      };
    }

    case "ai_food_status": {
      const treasury = syncRevenuePolicy(config);
      track(TREASURY_PATH);
      return {
        budget: budgetStatus(config),
        policy: aiFoodPolicy(config, treasury),
        providerCredits: treasury.ai.providerCredits || [],
        pendingTopUps: treasury.ai.pendingTopUps || [],
        refills: treasury.ai.refills || []
      };
    }

    case "request_ai_food_refill": {
      const treasury = syncRevenuePolicy(config);
      assertConfiguredAiFoodPurchase(config, input.provider);
      const spendRequest = buildAiFoodRefillRequest(config, treasury, input);
      const result = await requestOwnerApproval(config, github, spendRequest);
      if (result.approval) {
        upsertPendingTopUp(config, config.repoRoot, {
          approvalId: result.approval.id,
          amountUsd: spendRequest.amount,
          issueNumber: result.approval.issueNumber,
          issueUrl: result.approval.issueUrl,
          status: result.status === "approved" ? "approved_waiting_manual_purchase" : "pending_owner_approval",
          reason: input.reason || "",
          purchaseUrl: spendRequest.url
        });
      }
      track(APPROVALS_PATH);
      track(GOVERNANCE_PATH);
      track(TREASURY_PATH);
      return {
        ...result,
        purchaseProvider: spendRequest.recipient,
        purchaseUrl: spendRequest.url,
        message: "Orbit only requests AI-call budget credits through the configured provider. Owner approval records intent; the manual top-up is still required before recording completion."
      };
    }

    case "record_ai_food_refill": {
      assertConfiguredAiFoodPurchase(config, input.provider);
      const amountUsd = Number(input.amountUsd);
      if (!Number.isFinite(amountUsd) || amountUsd <= 0) {
        throw new Error("amountUsd must be a positive number");
      }
      if (!input.approvalId) {
        throw new Error("approvalId is required to record an AI food refill");
      }
      if (!input.proof) {
        throw new Error("proof is required to record an AI food refill");
      }
      assertSafeTextForWrite(input.proof);
      const approvalStatus = await checkOwnerApproval(config, github, input.approvalId, { forceRemote: true });
      track(APPROVALS_PATH);
      if (approvalStatus.status !== "approved") {
        return {
          status: "blocked_pending_owner_approval",
          approval: approvalStatus.approval || null,
          approvalStatus,
          message: "AI-credit refill completion can only be recorded after the owner approval is approved."
        };
      }
      const entry = recordAiCreditRefill(config, config.repoRoot, {
        amountUsd,
        approvalId: input.approvalId,
        proof: input.proof
      });
      track(TREASURY_PATH);
      return {
        status: "recorded",
        entry,
        message: "Recorded completed AI-credit purchase. This tool does not execute payment."
      };
    }

    case "prepare_token_launch": {
      const treasury = syncRevenuePolicy(config);
      track(TREASURY_PATH);
      return {
        treasury,
        prepared: prepareClankerLaunch(config, cycle)
      };
    }

    case "launch_native_token": {
      const guard = await guardSpend(config, github, {
        category: "token_launch",
        purpose: "Launch Orbit native token through Clanker",
        asset: "ETH",
        amount: config.devBuyEth || 0,
        recipient: "",
        notes: "Token launch is considered Orbit self-development when reward recipients are treasury and operator revenue only."
      });
      track(APPROVALS_PATH);
      track(GOVERNANCE_PATH);
      if (!guard.allowed) return guard;
      const stateForLaunch = (() => {
        try { return JSON.parse(readSafeTextFile(config.repoRoot, "memory/state.json")); }
        catch { return { cycle }; }
      })();
      const result = await launchNativeToken(config, cycle, stateForLaunch);
      track(TREASURY_PATH);
      return result;
    }

    case "run_revenue_cycle": {
      const guard = await guardSpend(config, github, {
        category: "claim_rewards",
        purpose: "Claim Orbit paired-token rewards to configured revenue recipients",
        asset: "paired-token rewards",
        amount: "claimable",
        recipient: config.operatorRevenueAddress,
        notes: "The configured private reward route is the exception to external spend blocking."
      });
      track(APPROVALS_PATH);
      track(GOVERNANCE_PATH);
      if (!guard.allowed) return guard;
      const stateForRevenue = (() => {
        try { return JSON.parse(readSafeTextFile(config.repoRoot, "memory/state.json")); }
        catch { return { cycle }; }
      })();
      const result = await runRevenueCycle(config, stateForRevenue);
      track(TREASURY_PATH);
      return {
        treasury: loadTreasury(config.repoRoot, config),
        result
      };
    }

    case "income_opportunities": {
      const result = opportunityStatus(config.repoRoot, {
        aiBudget: budgetStatus(config),
        treasury: loadTreasury(config.repoRoot, config),
        tasks: loadTasks(config.repoRoot),
        issues: []
      });
      track(OPPORTUNITIES_PATH);
      return result;
    }

    case "learning_lab_status": {
      const result = learningLabStatus(config.repoRoot);
      for (const path of result.changedPaths || []) track(path);
      return result;
    }

    case "quarantine_external_idea": {
      const result = quarantineExternalIdea(config.repoRoot, input);
      track(IDEA_INBOX_PATH);
      return result;
    }

    case "feature_catalog": {
      return {
        summary: featureSummary(),
        features: listFeatures(input || {})
      };
    }

    case "governance_status": {
      return governanceStatus(config);
    }

    case "scan_risk": {
      return {
        textRisk: input.text ? scanTextRisk(input.text) : null,
        spendRisk: input.spendIntent ? scanSpendIntent({
          ...input.spendIntent,
          treasuryAddress: config.treasuryAddress,
          operatorRevenueAddress: config.operatorRevenueAddress
        }) : null
      };
    }

    case "propose_spend": {
      const result = await guardSpend(config, github, input);
      track(APPROVALS_PATH);
      track(GOVERNANCE_PATH);
      return result;
    }

    case "request_owner_approval": {
      const result = await requestOwnerApproval(config, github, input);
      track(APPROVALS_PATH);
      track(GOVERNANCE_PATH);
      return result;
    }

    case "check_owner_approval": {
      const result = await checkOwnerApproval(config, github, input.approvalId);
      track(APPROVALS_PATH);
      return result;
    }

    case "propose_buyback": {
      const stateNow = (() => {
        try { return JSON.parse(readSafeTextFile(config.repoRoot, "memory/state.json")); }
        catch { return { cycle }; }
      })();
      const result = await proposeBuyback(config, {
        cycle,
        state: stateNow,
        github
      }, input || {});
      track(BUYBACK_LEDGER_PATH);
      return {
        kind: "buyback",
        action: "propose",
        ok: Boolean(result.ok),
        dryRun: Boolean(result.dryRun),
        blocked: Boolean(result.blocked),
        proposalIssueUrl: result.proposalIssueUrl || null,
        proposalIssueNumber: result.proposalIssueNumber || null,
        idem: result.idem || null,
        idempotent: Boolean(result.idempotent),
        status: result.status || (result.ok ? "proposed" : "blocked"),
        reason: result.reason || null
      };
    }

    case "execute_buyback": {
      const stateNow = (() => {
        try { return JSON.parse(readSafeTextFile(config.repoRoot, "memory/state.json")); }
        catch { return { cycle }; }
      })();
      const result = await executeBuyback(config, {
        cycle,
        state: stateNow,
        github
      }, input || {});
      track(BUYBACK_LEDGER_PATH);
      return {
        kind: "buyback",
        action: "execute",
        ok: Boolean(result.ok),
        dryRun: Boolean(result.dryRun),
        blocked: Boolean(result.blocked),
        txHash: result.txHash || null,
        wethSpent: result.wethSpent || null,
        orbitReceived: result.orbitReceived || null,
        slippageBps: result.slippageBps || null,
        idem: result.idem || null,
        status: result.status || (result.ok ? "executed" : "blocked"),
        reason: result.reason || null
      };
    }

    case "propose_merkle_anchor": {
      const stateNow = (() => {
        try { return JSON.parse(readSafeTextFile(config.repoRoot, "memory/state.json")); }
        catch { return { cycle }; }
      })();
      const result = await proposeAnchor(config, {
        cycle,
        state: stateNow,
        github
      }, input || {});
      track(ANCHOR_LEDGER_PATH);
      return {
        kind: "merkle_anchor",
        action: "propose",
        ok: Boolean(result.ok),
        dryRun: Boolean(result.dryRun),
        blocked: Boolean(result.blocked),
        root: result.root || null,
        leafCount: result.leafCount == null ? null : result.leafCount,
        proposalIssueUrl: result.proposalIssueUrl || null,
        proposalIssueNumber: result.proposalIssueNumber || null,
        idem: result.idem || null,
        idempotent: Boolean(result.idempotent),
        status: result.status || (result.ok ? "proposed" : "blocked"),
        reason: result.reason || null
      };
    }

    case "execute_merkle_anchor": {
      const stateNow = (() => {
        try { return JSON.parse(readSafeTextFile(config.repoRoot, "memory/state.json")); }
        catch { return { cycle }; }
      })();
      const result = await executeAnchor(config, {
        cycle,
        state: stateNow,
        github
      }, input || {});
      track(ANCHOR_LEDGER_PATH);
      return {
        kind: "merkle_anchor",
        action: "execute",
        ok: Boolean(result.ok),
        dryRun: Boolean(result.dryRun),
        blocked: Boolean(result.blocked),
        root: result.root || null,
        leafCount: result.leafCount == null ? null : result.leafCount,
        txHash: result.txHash || null,
        idem: result.idem || null,
        status: result.status || (result.ok ? "executed" : "blocked"),
        reason: result.reason || null
      };
    }

    case "cast_to_farcaster": {
      const { postCycleCast, summarizeCycleForCast } = require("./farcaster");
      const stateNow = (() => {
        try { return JSON.parse(readSafeTextFile(config.repoRoot, "memory/state.json")); }
        catch { return { cycle }; }
      })();
      const partialProof = {
        cycle: stateNow.cycle || cycle,
        finishedAt: new Date().toISOString(),
        steps: [],
        filesChanged: [...filesChanged]
      };
      const summary = summarizeCycleForCast(partialProof, {}, config);
      if (input && input.templateHint) summary.templateHint = input.templateHint;
      const result = await postCycleCast(config, summary, partialProof);
      if (result && result.ledgerPath) track(result.ledgerPath);
      return {
        kind: result.kind,
        hash: result.hash,
        dryRun: Boolean(result.dryRun),
        idempotent: Boolean(result.idempotent),
        blocked: Boolean(result.blocked),
        error: result.error || null,
        status: result.status
      };
    }

    default:
      throw new Error(`unknown tool: ${name}`);
  }
}

module.exports = {
  executeTool,
  filesChanged,
  AGENT_SOURCES_PATH,
  IDEA_INBOX_PATH,
  PROBLEM_LAB_PATH,
  PROJECT_IDEAS_PATH,
  runCommand,
  safeCommandEnv,
  readFileForTool,
  writeFile
};
