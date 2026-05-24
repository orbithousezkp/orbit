/**
 * Tests for the Orbit SDK — read-only access to machine-readable repository state.
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const sdk = require('../packages/orbit-sdk/index.js');

// Create a temporary repo with test fixtures
let tmpDir;

function setupTmpRepo() {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'orbit-sdk-test-'));
  const memDir = path.join(tmpDir, 'memory');
  fs.mkdirSync(memDir, { recursive: true });
  fs.mkdirSync(path.join(tmpDir, 'docs'), { recursive: true });

  // state.json
  fs.writeFileSync(path.join(memDir, 'state.json'), JSON.stringify({
    cycle: 49,
    born: '2026-05-22T01:46:39.981Z',
    lastActive: new Date().toISOString(),
    lastStatus: 'completed',
    firstWakeIntroComplete: true,
  }));

  // passport.json
  fs.writeFileSync(path.join(memDir, 'passport.json'), JSON.stringify({
    version: 1,
    identity: { name: 'Orbit', category: 'GitHub-native agent infrastructure' },
    capabilities: [
      { id: 'identity', name: 'Identity And Mission', status: 'active', mode: 'repo_public', evidence: ['memory/identity.md'] },
      { id: 'lifecycle', name: 'Wake/Sleep Lifecycle', status: 'active', mode: 'github_actions', evidence: ['.github/workflows/orbit-cycle.yml'] },
      { id: 'zk-receipts', name: 'ZK Policy Receipts', status: 'planned', mode: 'commitments_first', evidence: ['memory/roadmap.json'] },
    ],
    blockedActions: [
      'wallet spending', 'external payments', 'signing',
      'token launch', 'reward claims', 'payout-route changes',
    ],
    permissionModel: { defaultMode: 'owner_approval_required' },
    budget: { dailyBudgetUsd: 5, monthlyBudgetUsd: 100 },
    token: { symbol: 'ORBIT', launchStatus: 'not_launched' },
  }));

  // governance.json
  fs.writeFileSync(path.join(memDir, 'governance.json'), JSON.stringify({
    ownerUsername: '',
    policyVersion: 1,
    externalSpend: {
      mode: 'owner_approval_required',
      approvalIssueLabel: 'orbit:approval',
      approvalAcceptedLabel: 'orbit:approved',
      approvalCommentPrefix: 'APPROVE ORBIT-SPEND',
      allowedWithoutApproval: ['operator_revenue', 'treasury_internal', 'gas'],
    },
    selfRecipients: { treasuryEnv: 'ORBIT_TREASURY_ADDRESS' },
    hardRules: ['Never send treasury funds to an unapproved external wallet.'],
  }));

  // treasury.json
  const now = new Date().toISOString();
  fs.writeFileSync(path.join(memDir, 'treasury.json'), JSON.stringify({
    ai: {
      dailyBudgetUsd: 5,
      monthlyBudgetUsd: 100,
      inputUsdPerMillion: 0.15,
      outputUsdPerMillion: 0.6,
      reserveUsd: 0,
      ledger: [
        { timestamp: now, note: 'test call', promptTokens: 1000, completionTokens: 500, totalTokens: 1500, estimatedUsd: 0.002, aiRoute: 'private-ai-route-1' },
        { timestamp: '2026-05-23T10:00:00.000Z', note: 'older call', promptTokens: 2000, completionTokens: 1000, totalTokens: 3000, estimatedUsd: 0.005, aiRoute: 'private-ai-route-1' },
      ],
    },
    revenue: {
      cadence: 'weekly_performance',
      claimIntervalDays: 7,
      operatorShareBps: 0,
      treasuryShareBps: 10000,
      lastClaimSentAt: null,
    },
    token: { name: 'Orbit', symbol: 'ORBIT', launchStatus: 'not_launched', address: null },
  }));

  // roadmap.json
  fs.writeFileSync(path.join(memDir, 'roadmap.json'), JSON.stringify({
    currentLevel: { id: 'level-1', name: 'Control Plane Foundation', status: 'active', goal: 'Make every cycle measurable.' },
    lanes: [
      { id: 'control-plane-foundation', name: 'Control Plane Foundation', status: 'active', mission: 'Wake every cycle.' },
      { id: 'mission-control', name: 'Mission Control', status: 'active', mission: 'Show visitors.' },
      { id: 'proof-memory', name: 'Proof And Memory', status: 'planned', mission: 'Make proofs searchable.' },
    ],
    phaseChecks: [
      { phaseId: 'safe-autonomy-core', status: 'active', checks: ['Emergency pause flag exists.'], evidence: ['memory/roadmap.json'] },
      { phaseId: 'proof-memory-upgrade', status: 'planned', checks: ['Proof viewer works.'], evidence: [] },
    ],
    operatingRules: ['Roadmap progress must be backed by files.'],
  }));

  // tasks.json
  fs.writeFileSync(path.join(memDir, 'tasks.json'), JSON.stringify({
    tasks: [
      { id: 'task-1', title: 'Build SDK', priority: 'high', status: 'open', source: 'cycle_49', notes: 'Test task', createdAt: now },
      { id: 'task-2', title: 'Old task', priority: 'normal', status: 'done', source: 'cycle_1', notes: '', createdAt: '2026-05-22T00:00:00.000Z', completedAt: now, outcome: 'Done.' },
      { id: 'task-3', title: 'Another open', priority: 'low', status: 'open', source: 'cycle_2', notes: '', createdAt: now },
    ],
  }));

  // knowledge.json
  fs.writeFileSync(path.join(memDir, 'knowledge.json'), JSON.stringify({
    entries: [
      { id: 'k1', kind: 'cycle_summary', title: 'Cycle 48 summary', content: 'Created status query reference.', tags: ['cycle', 'infrastructure'], source: 'cycle_48', createdAt: now },
      { id: 'k2', kind: 'household_note', title: 'SDK created', content: 'Built orbit-sdk package.', tags: ['sdk', 'infrastructure'], source: 'cycle_49', createdAt: now },
      { id: 'k3', kind: 'decision', title: 'Zero deps rule', content: 'All packages must have zero npm dependencies.', tags: ['principle'], source: 'cycle_5', createdAt: '2026-05-22T00:00:00.000Z' },
    ],
  }));

  // infrastructure.json
  fs.writeFileSync(path.join(memDir, 'infrastructure.json'), JSON.stringify({
    product: { name: 'Orbit', category: 'GitHub-native agent infrastructure' },
    capabilities: [
      { id: 'identity', name: 'Identity And Mission', status: 'active' },
      { id: 'lifecycle', name: 'Wake/Sleep Lifecycle', status: 'active' },
      { id: 'agent-passport', name: 'Agent Passport', status: 'active' },
    ],
    walletBlockedLiveActions: ['wallet spending', 'signing'],
  }));

  // opportunities.json
  fs.writeFileSync(path.join(memDir, 'opportunities.json'), JSON.stringify({
    best: { id: 'orbit-agent-passport', title: 'Orbit agent passport', score: 42.33 },
    opportunities: [
      { id: 'orbit-agent-passport', title: 'Orbit agent passport', status: 'open', score: 42.33 },
      { id: 'orbit-infrastructure-sdk', title: 'Orbit infrastructure SDK', status: 'open', score: 40.43 },
    ],
  }));

  // approvals.json
  fs.writeFileSync(path.join(memDir, 'approvals.json'), JSON.stringify({
    approvals: [
      { id: 'ap-1', purpose: 'Test approval', status: 'pending', createdAt: now },
      { id: 'ap-2', purpose: 'Old approval', status: 'approved', createdAt: '2026-05-22T00:00:00.000Z' },
    ],
  }));

  // Empty cycles.jsonl
  fs.writeFileSync(path.join(memDir, 'cycles.jsonl'), '');

  return tmpDir;
}

function cleanupTmpRepo() {
  if (tmpDir) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

describe('Orbit SDK', () => {
  before(() => {
    setupTmpRepo();
  });

  after(() => {
    cleanupTmpRepo();
  });

  describe('File readers', () => {
    it('readState returns lifecycle state', () => {
      const state = sdk.readState(tmpDir);
      assert.strictEqual(state.cycle, 49);
      assert.strictEqual(state.lastStatus, 'completed');
      assert.strictEqual(state.firstWakeIntroComplete, true);
    });

    it('readPassport returns agent identity', () => {
      const passport = sdk.readPassport(tmpDir);
      assert.strictEqual(passport.identity.name, 'Orbit');
      assert.strictEqual(passport.version, 1);
      assert.ok(Array.isArray(passport.capabilities));
      assert.ok(passport.blockedActions.length > 0);
    });

    it('readGovernance returns approval policy', () => {
      const gov = sdk.readGovernance(tmpDir);
      assert.strictEqual(gov.externalSpend.mode, 'owner_approval_required');
      assert.ok(Array.isArray(gov.hardRules));
      assert.ok(gov.hardRules.length > 0);
    });

    it('readTreasury returns budget and revenue', () => {
      const treasury = sdk.readTreasury(tmpDir);
      assert.strictEqual(treasury.ai.dailyBudgetUsd, 5);
      assert.strictEqual(treasury.ai.monthlyBudgetUsd, 100);
      assert.strictEqual(treasury.token.symbol, 'ORBIT');
      assert.strictEqual(treasury.revenue.cadence, 'weekly_performance');
      assert.ok(Array.isArray(treasury.ai.ledger));
    });

    it('readRoadmap returns levels and lanes', () => {
      const roadmap = sdk.readRoadmap(tmpDir);
      assert.strictEqual(roadmap.currentLevel.id, 'level-1');
      assert.ok(Array.isArray(roadmap.lanes));
      assert.ok(roadmap.lanes.length > 0);
    });

    it('readTasks returns work items', () => {
      const tasks = sdk.readTasks(tmpDir);
      assert.ok(Array.isArray(tasks.tasks));
      assert.strictEqual(tasks.tasks.length, 3);
    });

    it('readKnowledge returns entries', () => {
      const knowledge = sdk.readKnowledge(tmpDir);
      assert.ok(Array.isArray(knowledge.entries));
      assert.strictEqual(knowledge.entries.length, 3);
    });

    it('readInfrastructure returns product registry', () => {
      const infra = sdk.readInfrastructure(tmpDir);
      assert.strictEqual(infra.product.name, 'Orbit');
      assert.ok(Array.isArray(infra.capabilities));
    });

    it('readOpportunities returns earning ideas', () => {
      const opps = sdk.readOpportunities(tmpDir);
      assert.strictEqual(opps.best.id, 'orbit-agent-passport');
      assert.ok(Array.isArray(opps.opportunities));
    });

    it('readApprovals returns approval queue', () => {
      const approvals = sdk.readApprovals(tmpDir);
      assert.ok(Array.isArray(approvals.approvals));
      assert.strictEqual(approvals.approvals.length, 2);
    });
  });

  describe('Convenience queries', () => {
    it('quickStatus returns compact summary', () => {
      const status = sdk.quickStatus(tmpDir);
      assert.strictEqual(status.cycle, 49);
      assert.strictEqual(status.lastStatus, 'completed');
      assert.strictEqual(typeof status.staleMinutes, 'number');
      assert.strictEqual(status.currentLevel.id, 'level-1');
      assert.strictEqual(status.openTaskCount, 2);
      assert.strictEqual(typeof status.aiBudget.dailyBudgetUsd, 'number');
      assert.strictEqual(typeof status.aiBudget.canUseAi, 'boolean');
      assert.strictEqual(status.tokenLaunchStatus, 'not_launched');
    });

    it('activeCapabilities filters to active', () => {
      const caps = sdk.activeCapabilities(tmpDir);
      assert.strictEqual(caps.length, 2);
      assert.ok(caps.every(c => c.id !== 'zk-receipts'));
      assert.ok(caps[0].id);
      assert.ok(caps[0].name);
    });

    it('blockedActions returns list', () => {
      const blocked = sdk.blockedActions(tmpDir);
      assert.ok(blocked.includes('wallet spending'));
      assert.ok(blocked.includes('signing'));
      assert.strictEqual(blocked.length, 6);
    });

    it('checkApprovalRequired returns correct for external_payment', () => {
      const check = sdk.checkApprovalRequired(tmpDir, 'external_payment');
      assert.strictEqual(check.requiresApproval, true);
      assert.strictEqual(check.mode, 'owner_approval_required');
      assert.ok(check.hardRules.length > 0);
    });

    it('checkApprovalRequired returns false for allowed category', () => {
      const check = sdk.checkApprovalRequired(tmpDir, 'gas');
      assert.strictEqual(check.requiresApproval, false);
    });

    it('openTasks returns open tasks', () => {
      const tasks = sdk.openTasks(tmpDir);
      assert.strictEqual(tasks.length, 2);
      assert.ok(tasks.every(t => !t.status || t.id)); // has id
    });

    it('openTasks filters by priority', () => {
      const high = sdk.openTasks(tmpDir, 'high');
      assert.strictEqual(high.length, 1);
      assert.strictEqual(high[0].title, 'Build SDK');
    });

    it('budgetSummary calculates derived values', () => {
      const budget = sdk.budgetSummary(tmpDir);
      assert.strictEqual(budget.dailyBudgetUsd, 5);
      assert.strictEqual(budget.monthlyBudgetUsd, 100);
      assert.strictEqual(typeof budget.lifetimeSpendUsd, 'number');
      assert.strictEqual(typeof budget.spentTodayUsd, 'number');
      assert.strictEqual(typeof budget.dailyRemainingUsd, 'number');
      assert.strictEqual(budget.lifetimeCalls, 2);
      assert.ok(budget.lifetimeSpendUsd > 0);
    });

    it('revenueStatus returns revenue and token', () => {
      const rev = sdk.revenueStatus(tmpDir);
      assert.strictEqual(rev.revenue.cadence, 'weekly_performance');
      assert.strictEqual(rev.token.symbol, 'ORBIT');
      assert.strictEqual(rev.token.launchStatus, 'not_launched');
    });

    it('activeLanes returns active lanes only', () => {
      const lanes = sdk.activeLanes(tmpDir);
      assert.strictEqual(lanes.length, 2);
      assert.ok(lanes.every(l => l.id !== 'proof-memory'));
    });

    it('activePhaseChecks returns active checks', () => {
      const phases = sdk.activePhaseChecks(tmpDir);
      assert.strictEqual(phases.length, 1);
      assert.strictEqual(phases[0].phaseId, 'safe-autonomy-core');
    });

    it('queryKnowledge filters by kind', () => {
      const summaries = sdk.queryKnowledge(tmpDir, { kind: 'cycle_summary' });
      assert.strictEqual(summaries.length, 1);
      assert.strictEqual(summaries[0].kind, 'cycle_summary');
    });

    it('queryKnowledge filters by tag', () => {
      const infra = sdk.queryKnowledge(tmpDir, { tag: 'infrastructure' });
      assert.strictEqual(infra.length, 2);
    });

    it('queryKnowledge applies limit', () => {
      const recent = sdk.queryKnowledge(tmpDir, { limit: 1 });
      assert.strictEqual(recent.length, 1);
    });

    it('machineReadableFiles returns file inventory', () => {
      const files = sdk.machineReadableFiles(tmpDir);
      assert.strictEqual(files.state.exists, true);
      assert.strictEqual(files.passport.exists, true);
      assert.ok(files.state.sizeBytes > 0);
      // cycles.jsonl exists but may have sizeBytes === 0
      assert.strictEqual(files.cycles.exists, true);
    });

    it('pendingApprovals filters to pending', () => {
      const pending = sdk.pendingApprovals(tmpDir);
      assert.strictEqual(pending.length, 1);
      assert.strictEqual(pending[0].id, 'ap-1');
    });
  });

  describe('Error handling', () => {
    it('readState throws on missing file', () => {
      assert.throws(() => sdk.readState('/nonexistent/path'));
    });

    it('safeReadJson returns null on missing file', () => {
      const result = sdk.safeReadJson('/nonexistent/path', 'memory/state.json');
      assert.strictEqual(result, null);
    });

    it('readApprovals uses safeReadJson for missing file', () => {
      const approvals = sdk.readApprovals('/nonexistent/path');
      assert.deepStrictEqual(approvals, { approvals: [] });
    });
  });

  describe('FILES constant', () => {
    it('defines all 11 machine-readable files', () => {
      assert.strictEqual(Object.keys(sdk.FILES).length, 11);
      assert.ok(sdk.FILES.state);
      assert.ok(sdk.FILES.passport);
      assert.ok(sdk.FILES.governance);
      assert.ok(sdk.FILES.treasury);
      assert.ok(sdk.FILES.roadmap);
      assert.ok(sdk.FILES.tasks);
      assert.ok(sdk.FILES.knowledge);
      assert.ok(sdk.FILES.infrastructure);
      assert.ok(sdk.FILES.opportunities);
      assert.ok(sdk.FILES.cycles);
      assert.ok(sdk.FILES.approvals);
    });
  });
});
