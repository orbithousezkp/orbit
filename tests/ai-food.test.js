"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const {
  aiFoodPolicy,
  assertConfiguredAiFoodPurchase,
  buildAiFoodRefillRequest
} = require("../src/agent/ai-food");
const { executeTool } = require("../src/agent/actions");
const { loadConfig } = require("../src/agent/config");
const { budgetStatus, loadTreasury, recordAiCreditRefill } = require("../src/agent/treasury");

function tempRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "orbit-ai-food-test-"));
  fs.mkdirSync(path.join(dir, "memory"), { recursive: true });
  return dir;
}

function config(repoRoot) {
  return {
    ...loadConfig({
      GITHUB_REPOSITORY: "owner/orbit",
      ORBIT_OWNER_USERNAME: "owner"
    }),
    repoRoot,
    aiProviders: [
      {
        name: "route-one",
        label: "Route One",
        model: "model-one",
        priority: 1
      },
      {
        name: "route-two",
        label: "Route Two",
        model: "model-two",
        priority: 2
      },
      {
        name: "configured-ai-credit-provider",
        label: "Credit Route",
        model: "credit-route-model",
        priority: 3
      }
    ]
  };
}

test("AI food policy keeps private route priority and configured-provider buying", () => {
  const repoRoot = tempRepo();
  const cfg = config(repoRoot);
  const treasury = loadTreasury(repoRoot, cfg);
  const policy = aiFoodPolicy(cfg, treasury);

  assert.deepEqual(policy.inferencePriority.map((provider) => provider.route), [
    "private-ai-route-1",
    "private-ai-route-2",
    "private-ai-route-3"
  ]);
  assert.equal(policy.purchaseProvider, "configured-ai-credit-provider");
  assert.equal(policy.purchaseOnlyOnConfiguredProvider, true);
  assert.equal(policy.liveApiPurchase, false);
});

test("AI credit purchase rejects non-configured providers", () => {
  const cfg = config(tempRepo());

  assert.equal(
    assertConfiguredAiFoodPurchase(cfg, "configured-ai-credit-provider"),
    "configured-ai-credit-provider"
  );
  assert.throws(
    () => assertConfiguredAiFoodPurchase(cfg, "visitor-provider"),
    /configured owner-approved credit provider/
  );
});

test("AI credit purchase accepts private configured provider but publishes generic alias", () => {
  const cfg = {
    ...config(tempRepo()),
    aiFoodPurchaseProvider: "private-credit-vendor"
  };

  assert.equal(
    assertConfiguredAiFoodPurchase(cfg, "private-credit-vendor"),
    "configured-ai-credit-provider"
  );

  const request = buildAiFoodRefillRequest(cfg, loadTreasury(cfg.repoRoot, cfg), {
    amountUsd: 5,
    provider: "private-credit-vendor"
  });

  assert.equal(request.recipient, "configured-ai-credit-provider");
  assert.doesNotMatch(JSON.stringify(request), /private-credit-vendor/);
});

test("builds configured-provider refill spend request", () => {
  const repoRoot = tempRepo();
  const cfg = config(repoRoot);
  const request = buildAiFoodRefillRequest(cfg, loadTreasury(repoRoot, cfg), {
    amountUsd: 12.5,
    reason: "low food"
  });

  assert.equal(request.category, "ai_food_refill");
  assert.equal(request.recipient, "configured-ai-credit-provider");
  assert.equal(request.amount, 12.5);
  assert.equal(request.url, "");
  assert.doesNotMatch(request.notes, /Route One|Route Two|Credit Route|model-one|model-two|credit-route-model/);
});

test("budget status exposes configured-provider purchase policy", () => {
  const repoRoot = tempRepo();
  const cfg = config(repoRoot);
  const status = budgetStatus(cfg);

  assert.equal(status.purchasePolicy.purchaseProvider, "configured-ai-credit-provider");
  assert.equal(status.purchasePolicy.purchaseOnlyOnConfiguredProvider, true);
});

test("request_ai_food_refill creates approval and pending configured-provider top-up", async () => {
  const repoRoot = tempRepo();
  const cfg = config(repoRoot);
  const createdIssues = [];
  const github = {
    async createIssue(issue) {
      createdIssues.push(issue);
      return {
        number: 7,
        url: "https://github.com/owner/orbit/issues/7"
      };
    }
  };

  const result = await executeTool(cfg, github, 1, "request_ai_food_refill", {
    amountUsd: 20,
    reason: "monthly food reserve is low"
  });

  assert.equal(result.status, "blocked_pending_owner_approval");
  assert.equal(result.purchaseProvider, "configured-ai-credit-provider");
  assert.equal(createdIssues.length, 1);
  assert.match(createdIssues[0].body, /configured-ai-credit-provider/);

  const treasury = loadTreasury(repoRoot, cfg);
  assert.equal(treasury.ai.pendingTopUps.length, 1);
  assert.equal(treasury.ai.pendingTopUps[0].provider, "configured-ai-credit-provider");
  assert.equal(treasury.ai.pendingTopUps[0].amountUsd, 20);
});

test("records completed AI-credit refill without executing payment", () => {
  const repoRoot = tempRepo();
  const cfg = config(repoRoot);
  const entry = recordAiCreditRefill(cfg, repoRoot, {
    amountUsd: 15,
    approvalId: "abc123",
    proof: "owner bought credits through configured provider"
  });

  const treasury = loadTreasury(repoRoot, cfg);
  assert.equal(entry.provider, "configured-ai-credit-provider");
  assert.equal(treasury.ai.refills.length, 1);
  assert.equal(treasury.ai.refills[0].amountUsd, 15);
});

test("credit refill ledger rejects secret-like proof content", () => {
  const repoRoot = tempRepo();
  const cfg = config(repoRoot);

  assert.throws(() => recordAiCreditRefill(cfg, repoRoot, {
    amountUsd: 15,
    approvalId: "abc123",
    proof: "OPENAI_API_KEY=sk-abcdefghijklmnopqrstuvwxyz"
  }), /secret/);
});

test("record_ai_food_refill tool blocks until owner approval exists", async () => {
  const repoRoot = tempRepo();
  const cfg = config(repoRoot);
  const result = await executeTool(cfg, null, 1, "record_ai_food_refill", {
    amountUsd: 15,
    approvalId: "missing",
    proof: "owner bought credits through configured provider"
  });

  assert.equal(result.status, "blocked_pending_owner_approval");
  assert.equal(result.approvalStatus.status, "not_found");
});

test("record_ai_food_refill does not trust local approval without remote issue", async () => {
  const repoRoot = tempRepo();
  const cfg = config(repoRoot);
  fs.writeFileSync(path.join(repoRoot, "memory", "approvals.json"), JSON.stringify({
    approvals: [
      {
        id: "local-approved",
        status: "approved",
        issueNumber: null
      }
    ]
  }, null, 2));

  const result = await executeTool(cfg, null, 1, "record_ai_food_refill", {
    amountUsd: 15,
    approvalId: "local-approved",
    proof: "owner bought credits through configured provider"
  });

  assert.equal(result.status, "blocked_pending_owner_approval");
  assert.equal(result.approvalStatus.status, "pending");
});
