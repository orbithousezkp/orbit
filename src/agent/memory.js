"use strict";

const {
  assertSafeTextForWrite,
  readSafeTextFile,
  redactSecrets,
  writeSafeTextFile
} = require("./safety");

const KNOWLEDGE_PATH = "memory/knowledge.json";

function loadKnowledge(repoRoot) {
  try {
    const parsed = JSON.parse(readSafeTextFile(repoRoot, KNOWLEDGE_PATH));
    return Array.isArray(parsed.entries) ? parsed : { entries: [] };
  } catch {
    return { entries: [] };
  }
}

function saveKnowledge(repoRoot, store) {
  writeSafeTextFile(repoRoot, KNOWLEDGE_PATH, `${JSON.stringify(store, null, 2)}\n`);
}

function makeMemoryId() {
  return `mem-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function normalizeTags(tags) {
  if (!Array.isArray(tags)) return [];
  return tags
    .map((tag) => String(tag || "").trim().toLowerCase().replace(/[^a-z0-9:_-]+/g, "-"))
    .filter(Boolean)
    .slice(0, 12);
}

function appendMemory(repoRoot, input = {}) {
  const title = String(input.title || "Untitled memory").trim().slice(0, 140);
  const content = String(input.content || "").trim();
  const rawTags = Array.isArray(input.tags) ? input.tags.map((tag) => String(tag || "")).join("\n") : "";
  if (!content) throw new Error("memory content is required");
  assertSafeTextForWrite([
    title,
    content,
    input.kind || "",
    input.source || "",
    rawTags
  ].join("\n"));

  const store = loadKnowledge(repoRoot);
  const entry = {
    id: makeMemoryId(),
    kind: String(input.kind || "note").slice(0, 40),
    title,
    content: content.slice(0, 12_000),
    tags: normalizeTags(input.tags),
    source: String(input.source || "orbit").slice(0, 160),
    createdAt: new Date().toISOString(),
    updatedAt: null
  };

  store.entries.push(entry);
  saveKnowledge(repoRoot, store);
  return entry;
}

function listMemory(repoRoot, filter = {}) {
  const limit = Math.min(Number.parseInt(filter.limit, 10) || 25, 100);
  const tag = filter.tag ? String(filter.tag).toLowerCase() : "";
  const kind = filter.kind ? String(filter.kind) : "";
  const entries = loadKnowledge(repoRoot).entries
    .filter((entry) => !tag || entry.tags.includes(tag))
    .filter((entry) => !kind || entry.kind === kind)
    .slice(-limit)
    .reverse();

  return entries.map((entry) => ({
    ...entry,
    kind: redactSecrets(entry.kind),
    title: redactSecrets(entry.title),
    tags: Array.isArray(entry.tags) ? entry.tags.map((tag) => redactSecrets(tag)) : [],
    source: redactSecrets(entry.source),
    content: redactSecrets(entry.content).slice(0, 4000)
  }));
}

function preview(text, query = "") {
  const value = redactSecrets(String(text || "").replace(/\s+/g, " ").trim());
  if (!query) return value.slice(0, 280);
  const lower = value.toLowerCase();
  const index = lower.indexOf(query.toLowerCase());
  if (index < 0) return value.slice(0, 280);
  return value.slice(Math.max(0, index - 80), index + query.length + 200);
}

function scoreText(text, terms) {
  const value = String(text || "").toLowerCase();
  return terms.reduce((score, term) => score + (value.includes(term) ? 1 : 0), 0);
}

function readMemoryFile(repoRoot, relativePath) {
  try {
    return readSafeTextFile(repoRoot, relativePath);
  } catch {
    return "";
  }
}

function searchMemory(repoRoot, input = {}) {
  const query = String(input.query || "").trim();
  if (!query) throw new Error("query is required");
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const limit = Math.min(Number.parseInt(input.limit, 10) || 20, 100);
  const results = [];

  for (const entry of loadKnowledge(repoRoot).entries) {
    const haystack = [entry.title, entry.kind, entry.tags.join(" "), entry.source, entry.content].join("\n");
    const score = scoreText(haystack, terms);
    if (score > 0) {
      results.push({
        type: "knowledge",
        id: entry.id,
        title: redactSecrets(entry.title),
        kind: redactSecrets(entry.kind),
        tags: Array.isArray(entry.tags) ? entry.tags.map((tag) => redactSecrets(tag)) : [],
        score,
        preview: preview(entry.content, query)
      });
    }
  }

  const files = [
    "memory/identity.md",
    "memory/strategy.md",
    "memory/state.json",
    "memory/tasks.json",
    "memory/treasury.json",
    "memory/governance.json",
    "memory/approvals.json",
    "memory/cycles.jsonl"
  ];

  for (const relativePath of files) {
    const content = readMemoryFile(repoRoot, relativePath);
    const score = scoreText(content, terms);
    if (score > 0) {
      results.push({
        type: "file",
        path: relativePath,
        score,
        preview: preview(content, query)
      });
    }
  }

  return results.sort((a, b) => b.score - a.score).slice(0, limit);
}

function deleteMemory(repoRoot, id) {
  const store = loadKnowledge(repoRoot);
  const index = store.entries.findIndex((entry) => entry.id === id);
  if (index < 0) throw new Error(`memory entry not found: ${id}`);
  const [removed] = store.entries.splice(index, 1);
  saveKnowledge(repoRoot, store);
  return { deleted: true, id: removed.id, title: redactSecrets(removed.title) };
}

module.exports = {
  KNOWLEDGE_PATH,
  appendMemory,
  deleteMemory,
  listMemory,
  loadKnowledge,
  saveKnowledge,
  searchMemory
};
