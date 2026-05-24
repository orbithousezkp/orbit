'use strict';

/**
 * Orbit Reader — self-tests using the actual repository state.
 * No test framework required; uses Node.js assert.
 *
 * Run: node packages/orbit-reader/test.js
 */

const assert = require('assert');
const path = require('path');

// Resolve the reader from this file's location
const reader = require('./index');

// Use the repo root (two levels up from packages/orbit-reader/)
const REPO_ROOT = path.resolve(__dirname, '..', '..');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed++;
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
  }
}

console.log('Orbit Reader — self-tests\n');

// ─── resolveRepoRoot ────────────────────────────────────────────────────────

console.log('resolveRepoRoot:');

test('finds repo root from package location', () => {
  const root = reader.resolveRepoRoot();
  const statePath = path.join(root, 'memory', 'state.json');
  const fs = require('fs');
  assert.ok(fs.existsSync(statePath), `Expected ${statePath} to exist`);
});

test('accepts explicit override', () => {
  assert.strictEqual(reader.resolveRepoRoot('/tmp'), '/tmp');
});

// ─── Core readers ───────────────────────────────────────────────────────────

console.log('\ncore readers:');

test('readState returns lifecycle object', () => {
  const state = reader.readState(REPO_ROOT);
  assert.ok(state, 'state should not be null');
  assert.ok(typeof state.cycle === 'number', 'cycle should be a number');
  assert.ok(state.born, 'born should be set');
  assert.ok(state.lastActive, 'lastActive should be set');
});

test('readPassport returns identity object', () => {
  const passport = reader.readPassport(REPO_ROOT);
  assert.ok(passport, 'passport should not be null');
  assert.ok(passport.identity, 'should have identity');
  assert.ok(passport.identity.name === 'Orbit', 'name should be Orbit');
  assert.ok(Array.isArray(passport.capabilities), 'capabilities should be array');
  assert.ok(Array.isArray(passport.blockedActions), 'blockedActions should be array');
  assert.ok(passport.permissionModel, 'should have permissionModel');
  assert.ok(passport.adoptionChecklist, 'should have adoptionChecklist');
});

test('readGovernance returns policy object', () => {
  const gov = reader.readGovernance(REPO_ROOT);
  assert.ok(gov, 'governance should not be null');
  assert.ok(gov.externalSpend, 'should have externalSpend');
  assert.ok(gov.externalSpend.mode, 'should have spend mode');
  assert.ok(Array.isArray(gov.hardRules), 'hardRules should be array');
});

test('readTreasury returns budget object', () => {
  const treasury = reader.readTreasury(REPO_ROOT);
  assert.ok(treasury, 'treasury should not be null');
  assert.ok(treasury.ai, 'should have ai budget');
  assert.ok(typeof treasury.ai.dailyBudgetUsd === 'number', 'dailyBudgetUsd should be number');
  assert.ok(Array.isArray(treasury.ai.ledger), 'ledger should be array');
  assert.ok(treasury.revenue, 'should have revenue');
  assert.ok(treasury.token, 'should have token');
});

test('readRoadmap returns levels and lanes', () => {
  const roadmap = reader.readRoadmap(REPO_ROOT);
  assert.ok(roadmap, 'roadmap should not be null');
  assert.ok(roadmap.currentLevel, 'should have currentLevel');
  assert.ok(Array.isArray(roadmap.lanes), 'lanes should be array');
  assert.ok(Array.isArray(roadmap.levels), 'levels should be array');
});

test('readTasks returns task list', () => {
  const tasks = reader.readTasks(REPO_ROOT);
  assert.ok(tasks, 'tasks should not be null');
  assert.ok(Array.isArray(tasks.tasks), 'tasks.tasks should be array');
});

test('readKnowledge returns entries', () => {
  const knowledge = reader.readKnowledge(REPO_ROOT);
  assert.ok(knowledge, 'knowledge should not be null');
  assert.ok(Array.isArray(knowledge.entries), 'entries should be array');
  assert.ok(knowledge.entries.length > 0, 'should have at least one entry');
});

test('readInfrastructure returns product registry', () => {
  const infra = reader.readInfrastructure(REPO_ROOT);
  assert.ok(infra, 'infrastructure should not be null');
  assert.ok(infra.product, 'should have product');
  assert.ok(Array.isArray(infra.capabilities), 'capabilities should be array');
});

test('readOpportunities returns opportunity list', () => {
  const opps = reader.readOpportunities(REPO_ROOT);
  assert.ok(opps, 'opportunities should not be null');
  assert.ok(Array.isArray(opps.opportunities), 'opportunities list should be array');
});

test('readCycleProofs returns array of proof records', () => {
  const proofs = reader.readCycleProofs(REPO_ROOT);
  assert.ok(Array.isArray(proofs), 'proofs should be array');
  assert.ok(proofs.length > 0, 'should have at least one proof');
  assert.ok(typeof proofs[0].cycle === 'number', 'proof should have cycle number');
});

// ─── Convenience queries ────────────────────────────────────────────────────

console.log('\nconvenience queries:');

test('quickStatus returns status with staleness check', () => {
  const status = reader.quickStatus(REPO_ROOT);
  assert.ok(status, 'status should not be null');
  assert.ok(typeof status.cycle === 'number', 'should have cycle');
  assert.ok(typeof status.ageMinutes === 'number', 'should have ageMinutes');
  assert.ok(typeof status.isStale === 'boolean', 'should have isStale');
});

test('openTasks returns only open items', () => {
  const open = reader.openTasks(REPO_ROOT);
  assert.ok(Array.isArray(open), 'should be array');
  // All returned tasks should be open (or the array is empty)
  open.forEach((t) => assert.strictEqual(t.status, 'open', `task ${t.id} should be open`));
});

test('activeCapabilities returns active items only', () => {
  const caps = reader.activeCapabilities(REPO_ROOT);
  assert.ok(Array.isArray(caps), 'should be array');
  assert.ok(caps.length > 0, 'should have active capabilities');
  caps.forEach((c) => {
    assert.ok(c.id, 'capability should have id');
    assert.ok(c.name, 'capability should have name');
  });
});

test('currentLevel returns active level', () => {
  const level = reader.currentLevel(REPO_ROOT);
  assert.ok(level, 'should have current level');
  assert.ok(level.id, 'should have id');
  assert.ok(level.name, 'should have name');
  assert.ok(level.goal, 'should have goal');
});

test('budgetSummary returns numeric budget fields', () => {
  const budget = reader.budgetSummary(REPO_ROOT);
  assert.ok(budget, 'budget should not be null');
  assert.ok(typeof budget.dailyBudgetUsd === 'number', 'dailyBudgetUsd should be number');
  assert.ok(typeof budget.monthlyBudgetUsd === 'number', 'monthlyBudgetUsd should be number');
  assert.ok(typeof budget.lifetimeSpendUsd === 'number', 'lifetimeSpendUsd should be number');
  assert.ok(typeof budget.dailyRemainingUsd === 'number', 'dailyRemainingUsd should be number');
  assert.ok(typeof budget.monthlyRemainingUsd === 'number', 'monthlyRemainingUsd should be number');
});

test('blockedActions returns non-empty array', () => {
  const blocked = reader.blockedActions(REPO_ROOT);
  assert.ok(Array.isArray(blocked), 'should be array');
  assert.ok(blocked.length > 0, 'should have blocked actions');
});

test('latestProof returns most recent cycle record', () => {
  const proof = reader.latestProof(REPO_ROOT);
  assert.ok(proof, 'should have a latest proof');
  assert.ok(typeof proof.cycle === 'number', 'should have cycle number');
});

// ─── Full dump ──────────────────────────────────────────────────────────────

console.log('\nreadAll:');

test('readAll returns all files in one call', () => {
  const all = reader.readAll(REPO_ROOT);
  assert.ok(all.state, 'should have state');
  assert.ok(all.passport, 'should have passport');
  assert.ok(all.governance, 'should have governance');
  assert.ok(all.treasury, 'should have treasury');
  assert.ok(all.roadmap, 'should have roadmap');
  assert.ok(all.tasks, 'should have tasks');
  assert.ok(all.knowledge, 'should have knowledge');
  assert.ok(all.infrastructure, 'should have infrastructure');
  assert.ok(all.opportunities, 'should have opportunities');
  assert.ok(Array.isArray(all.cycleProofs), 'cycleProofs should be array');
});

// ─── Summary ────────────────────────────────────────────────────────────────

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
