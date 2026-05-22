"use strict";

const { assertSafeTextForWrite, readSafeTextFile, writeSafeTextFile } = require("./safety");

const TASKS_PATH = "memory/tasks.json";

function loadTasks(repoRoot) {
  try {
    const parsed = JSON.parse(readSafeTextFile(repoRoot, TASKS_PATH));
    return Array.isArray(parsed.tasks) ? parsed : { tasks: [] };
  } catch {
    return { tasks: [] };
  }
}

function saveTasks(repoRoot, store) {
  writeSafeTextFile(repoRoot, TASKS_PATH, JSON.stringify(store, null, 2));
}

function makeTaskId() {
  return `task-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function addTask(repoRoot, input) {
  assertSafeTextForWrite([
    input.title || "",
    input.source || "",
    input.notes || ""
  ].join("\n"));
  const store = loadTasks(repoRoot);
  const task = {
    id: makeTaskId(),
    title: String(input.title || "Untitled task").slice(0, 140),
    priority: input.priority || "normal",
    source: input.source || "orbit",
    status: "open",
    notes: input.notes || "",
    createdAt: new Date().toISOString(),
    completedAt: null,
    outcome: null
  };

  store.tasks.push(task);
  saveTasks(repoRoot, store);
  return task;
}

function completeTask(repoRoot, id, outcome = "") {
  assertSafeTextForWrite(outcome);
  const store = loadTasks(repoRoot);
  const task = store.tasks.find((item) => item.id === id);
  if (!task) throw new Error(`task not found: ${id}`);
  task.status = "done";
  task.completedAt = new Date().toISOString();
  task.outcome = outcome;
  saveTasks(repoRoot, store);
  return task;
}

module.exports = {
  TASKS_PATH,
  addTask,
  completeTask,
  loadTasks,
  saveTasks
};
