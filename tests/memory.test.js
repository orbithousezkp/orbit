"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const {
  KNOWLEDGE_PATH,
  appendMemory,
  deleteMemory,
  listMemory,
  searchMemory
} = require("../src/agent/memory");

function tempRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "orbit-memory-test-"));
  fs.mkdirSync(path.join(dir, "memory"), { recursive: true });
  fs.writeFileSync(path.join(dir, "memory", "strategy.md"), "Protect treasury before outside spend. Owner approval is required for outside spend.\n");
  return dir;
}

test("appends, lists, searches, and deletes durable memory", () => {
  const repo = tempRepo();
  const entry = appendMemory(repo, {
    title: "Approval policy",
    content: "External treasury spend requires owner approval.",
    kind: "policy",
    tags: ["Treasury", "Approval"],
    source: "test"
  });

  assert.ok(entry.id.startsWith("mem-"));
  assert.equal(fs.existsSync(path.join(repo, KNOWLEDGE_PATH)), true);
  assert.equal(listMemory(repo, { tag: "treasury" }).length, 1);

  const results = searchMemory(repo, { query: "owner approval" });
  assert.ok(results.some((result) => result.type === "knowledge"));
  assert.ok(results.some((result) => result.path === "memory/strategy.md"));

  const deleted = deleteMemory(repo, entry.id);
  assert.equal(deleted.deleted, true);
  assert.equal(listMemory(repo).length, 0);
});

test("durable memory refuses secret-looking content", () => {
  assert.throws(() => appendMemory(tempRepo(), {
    title: "bad",
    content: "OPENAI_API_KEY=sk-abcdefghijklmnopqrstuvwxyz"
  }));
});

test("durable memory refuses secret-looking metadata", () => {
  assert.throws(() => appendMemory(tempRepo(), {
    title: "safe",
    content: "safe content",
    source: "apiKey: \"abcdefghijklmnopqrstuvwxyz123456\""
  }), /secret/);

  assert.throws(() => appendMemory(tempRepo(), {
    title: "safe",
    content: "safe content",
    tags: ["OPENAI_API_KEY=sk-abcdefghijklmnopqrstuvwxyz"]
  }), /secret/);
});
