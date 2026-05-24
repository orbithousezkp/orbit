/**
 * Tests for @orbit-house/orbit-sdk
 *
 * Uses Node's built-in test runner (node:test).
 * Tests run against the actual Orbit repo state.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { create, FILES } = require('../packages/orbit-sdk/index');

const REPO_ROOT = path.resolve(__dirname, '..');

describe('Orbit SDK', () => {
  const sdk = create(REPO_ROOT);

  describe('create()', () => {
    it('returns an object with all expected methods', () => {
      const methods = [
        'getState', 'getPassport', 'getGovernance', 'getTreasury',
        'getRoadmap', 'getTasks', 'getKnowledge', 'getInfrastructure',
        'getOpportunities', 'getApprovals', 'getCycles', 'getCycleNotes',
        'quickStatus', 'budgetSummary', 'getCapabilities', 'getOpenTasks',
        'getBlockedActions', 'getLatestCycle', 'getTopOpportunities',
        'healthCheck', 'getFileList',
      ];
      for (const method of methods) {
        assert.equal(typeof sdk[method], 'function', `Missing method: ${method}`);
      }
    });

    it('exposes repoRoot and files metadata', () => {
      assert.equal(typeof sdk.repoRoot, 'string');
      assert.equal(typeof sdk.files, 'object');
    });
  });

  describe('individual file readers', () => {
    it('getState() returns lifecycle state', () => {
      const state = sdk.getState();
      assert.ok(state, 'state.json should exist');
      assert.equal(typeof state.cycle, 'number');
      assert.equal(typeof state.born, 'string');
    });

    it('getPassport() returns agent passport', () => {
      const passport = sdk.getPassport();
      assert.ok(passport, 'passport.json should exist');
      assert.equal(passport.version, 1);
      assert.ok(passport.identity);
      assert.ok(Array.isArray(passport.capabilities));
    });

    it('getGovernance() returns governance policy', () => {
      const gov = sdk.getGovernance();
      assert.ok(gov, 'governance.json should exist');
      assert.equal(typeof gov.policyVersion, 'number');
      assert.ok(gov.externalSpend);
      assert.ok(Array.isArray(gov.hardRules));
    });

    it('getTreasury() returns treasury data', () => {
      const treasury = sdk.getTreasury();
      assert.ok(treasury, 'treasury.json should exist');
      assert.ok(treasury.ai);
      assert.ok(Array.isArray(treasury.ai.ledger));
      assert.ok(treasury.token);
    });

    it('getRoadmap() returns roadmap', () => {
      const roadmap = sdk.getRoadmap();
      assert.ok(roadmap, 'roadmap.json should exist');
      assert.ok(roadmap.currentLevel);
      assert.ok(Array.isArray(roadmap.lanes));
      assert.ok(Array.isArray(roadmap.levels));
    });

    it('getTasks() returns task list', () => {
      const tasks = sdk.getTasks();
      assert.ok(tasks, 'tasks.json should exist');
      assert.ok(Array.isArray(tasks.tasks));
    });

    it('getKnowledge() returns knowledge entries', () => {
      const knowledge = sdk.getKnowledge();
      assert.ok(knowledge, 'knowledge.json should exist');
      assert.ok(Array.isArray(knowledge.entries));
    });

    it('getInfrastructure() returns infrastructure registry', () => {
      const infra = sdk.getInfrastructure();
      assert.ok(infra, 'infrastructure.json should exist');
      assert.ok(infra.product || infra.summary);
    });

    it('getOpportunities() returns opportunity data', () => {
      const opps = sdk.getOpportunities();
      assert.ok(opps, 'opportunities.json should exist');
      assert.ok(Array.isArray(opps.opportunities));
    });

    it('getCycles() returns JSONL entries', () => {
      const cycles = sdk.getCycles();
      assert.ok(Array.isArray(cycles));
    });

    it('getCycleNotes() returns cycle note files', () => {
      const notes = sdk.getCycleNotes();
      assert.ok(Array.isArray(notes));
      assert.ok(notes.length > 0, 'Should have cycle notes');
      assert.ok(notes[0].filename);
      assert.ok(notes[0].content);
    });
  });

  describe('derived views', () => {
    it('quickStatus() returns a summary with expected fields', () => {
      const status = sdk.quickStatus();
      assert.equal(typeof status.cycle, 'number');
      assert.ok(status.cycle > 0);
      assert.equal(typeof status.born, 'string');
      assert.equal(typeof status.lastActive, 'string');
      assert.equal(typeof status.currentLevel, 'string');
      assert.equal(typeof status.openTaskCount, 'number');
      assert.equal(typeof status.completedTaskCount, 'number');
      assert.equal(typeof status.dailyBudgetUsd, 'number');
      assert.equal(typeof status.ledgerEntries, 'number');
    });

    it('budgetSummary() returns spend analysis', () => {
      const budget = sdk.budgetSummary();
      assert.equal(typeof budget.dailyBudgetUsd, 'number');
      assert.equal(typeof budget.monthlyBudgetUsd, 'number');
      assert.equal(typeof budget.spentTodayUsd, 'number');
      assert.equal(typeof budget.spentThisMonthUsd, 'number');
      assert.equal(typeof budget.lifetimeSpendUsd, 'number');
      assert.equal(typeof budget.dailyRemainingUsd, 'number');
      assert.equal(typeof budget.monthlyRemainingUsd, 'number');
      assert.equal(typeof budget.canUseAi, 'boolean');
      assert.ok(budget.lifetimeSpendUsd > 0, 'Should have recorded spend');
    });

    it('getCapabilities() returns active and planned lists', () => {
      const caps = sdk.getCapabilities();
      assert.ok(Array.isArray(caps.active));
      assert.ok(Array.isArray(caps.planned));
      assert.ok(Array.isArray(caps.all));
      assert.ok(caps.active.length > 0, 'Should have active capabilities');
    });

    it('getOpenTasks() returns only open/blocked tasks', () => {
      const tasks = sdk.getOpenTasks();
      assert.ok(Array.isArray(tasks));
      for (const t of tasks) {
        assert.ok(t.status === 'open' || t.status === 'blocked');
      }
    });

    it('getBlockedActions() returns governance restrictions', () => {
      const blocked = sdk.getBlockedActions();
      assert.equal(typeof blocked.approvalMode, 'string');
      assert.ok(Array.isArray(blocked.hardRules));
      assert.ok(blocked.hardRules.length > 0);
      assert.ok(Array.isArray(blocked.blockedLiveActions));
    });

    it('getLatestCycle() returns the most recent cycle note', () => {
      const latest = sdk.getLatestCycle();
      assert.ok(latest, 'Should have a latest cycle');
      assert.ok(latest.filename);
      assert.ok(latest.content);
    });

    it('getTopOpportunities() returns sorted opportunities', () => {
      const opps = sdk.getTopOpportunities(3);
      assert.ok(Array.isArray(opps));
      if (opps.length > 1) {
        const scoreA = opps[0].driverAdjustedScore || opps[0].score || 0;
        const scoreB = opps[1].driverAdjustedScore || opps[1].score || 0;
        assert.ok(scoreA >= scoreB, 'Should be sorted descending by score');
      }
    });
  });

  describe('healthCheck()', () => {
    it('verifies all expected files exist and are parseable', () => {
      const health = sdk.healthCheck();
      assert.equal(typeof health, 'object');

      // Core files should exist
      const required = ['state', 'passport', 'governance', 'treasury', 'roadmap', 'tasks', 'knowledge', 'infrastructure', 'opportunities'];
      for (const name of required) {
        assert.ok(health[name], `Health check should include ${name}`);
        assert.equal(health[name].exists, true, `${name} should exist`);
        assert.equal(health[name].parseable, true, `${name} should be parseable`);
      }

      assert.ok(health.cycleNotes, 'Should check cycle notes');
      assert.ok(health.cycleNotes.entryCount > 0, 'Should have cycle notes');
    });
  });

  describe('getFileList()', () => {
    it('returns all machine-readable file paths', () => {
      const files = sdk.getFileList();
      assert.equal(typeof files, 'object');
      assert.ok(files.state);
      assert.ok(files.passport);
      assert.ok(files.treasury);
      assert.ok(files.roadmap);
      assert.ok(files.cycleNotes);
    });
  });

  describe('edge cases', () => {
    it('create() with nonexistent path returns null readers gracefully', () => {
      const empty = create('/nonexistent/path');
      assert.equal(empty.getState(), null);
      assert.equal(empty.getPassport(), null);
      assert.deepEqual(empty.getCycles(), []);
      assert.deepEqual(empty.getCycleNotes(), []);
    });

    it('quickStatus() handles missing state gracefully', () => {
      const empty = create('/nonexistent/path');
      const status = empty.quickStatus();
      assert.equal(status.cycle, 0);
      assert.equal(status.born, null);
    });
  });
});
