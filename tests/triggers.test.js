"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  MANDATORY_INTERVAL_MINUTES,
  normalizeTrigger,
  triggerPolicy
} = require("../src/agent/triggers");

test("schedule trigger is the regular mandatory heartbeat", () => {
  const trigger = normalizeTrigger({ cycleTrigger: "schedule" });

  assert.equal(trigger.type, "mandatory");
  assert.equal(trigger.id, "regular_heartbeat");
  assert.equal(trigger.intervalMinutes, 30);
});

test("issue activity is an event trigger", () => {
  const trigger = normalizeTrigger({
    cycleTrigger: "issues",
    cycleTriggerAction: "opened"
  });

  assert.equal(trigger.type, "event");
  assert.equal(trigger.id, "github_issues");
  assert.equal(trigger.label, "issues.opened");
});

test("trigger policy defines state, event, and mandatory cycles", () => {
  const policy = triggerPolicy();

  assert.equal(policy.mandatoryIntervalMinutes, MANDATORY_INTERVAL_MINUTES);
  assert.match(policy.definitions.state, /Internal control-plane condition/);
  assert.match(policy.definitions.event, /External GitHub activity/);
  assert.match(policy.definitions.mandatory, /30 minutes/);
});
