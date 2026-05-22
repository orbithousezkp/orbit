"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { addTask, completeTask, loadTasks } = require("../src/agent/tasks");

function tempRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "orbit-test-"));
  fs.mkdirSync(path.join(dir, "memory"), { recursive: true });
  return dir;
}

test("adds and completes tasks", () => {
  const repo = tempRepo();
  const task = addTask(repo, {
    title: "Improve docs",
    priority: "high",
    source: "test",
    notes: "Make first run clearer"
  });

  assert.equal(task.status, "open");
  assert.equal(loadTasks(repo).tasks.length, 1);

  const completed = completeTask(repo, task.id, "Done");
  assert.equal(completed.status, "done");
  assert.equal(completed.outcome, "Done");
});

test("task memory refuses secret-looking content", () => {
  const repo = tempRepo();
  assert.throws(() => addTask(repo, {
    title: "bad",
    notes: "OPENAI_API_KEY=sk-abcdefghijklmnopqrstuvwxyz"
  }), /secret/);

  const task = addTask(repo, { title: "safe" });
  assert.throws(() => completeTask(repo, task.id, "apiKey: \"abcdefghijklmnopqrstuvwxyz123456\""), /secret/);
});
