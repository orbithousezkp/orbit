"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const test = require("node:test");
const { filesChanged } = require("../src/agent/actions");
const {
  addToolResultMessage,
  assistantMessageForResult,
  changedPathsForCommit,
  compactToolArguments,
  compactToolCallsForHistory,
  sanitizeProofOutput,
  stageChangedPaths,
  toolResultsUserMessage
} = require("../src/agent/run");

function tempRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "orbit-run-test-"));
  fs.mkdirSync(path.join(dir, "memory"), { recursive: true });
  fs.writeFileSync(path.join(dir, "memory", "state.json"), "{}\n", "utf-8");
  fs.writeFileSync(path.join(dir, "tracked.txt"), "original\n", "utf-8");
  fs.writeFileSync(path.join(dir, ".gitignore"), "ignored.txt\n", "utf-8");
  return dir;
}

function gitAvailable() {
  try {
    execFileSync("git", ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function git(repoRoot, args) {
  return execFileSync("git", args, {
    cwd: repoRoot,
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "pipe"]
  }).trimEnd();
}

function initGitRepo(repoRoot) {
  git(repoRoot, ["init"]);
  git(repoRoot, ["config", "user.name", "Test"]);
  git(repoRoot, ["config", "user.email", "test@example.com"]);
  git(repoRoot, ["add", "."]);
  git(repoRoot, ["commit", "-m", "initial"]);
}

test("changed paths for commit are normalized through the repository guard", () => {
  const repoRoot = tempRepo();
  const config = {
    repoRoot,
    commitChanges: true,
    pushChanges: false
  };

  filesChanged.clear();
  filesChanged.add("memory/../memory/state.json");

  try {
    assert.deepEqual(changedPathsForCommit(config), ["memory/state.json"]);
  } finally {
    filesChanged.clear();
  }
});

test("changed path staging does not add unrelated worktree changes", { skip: !gitAvailable() }, () => {
  const repoRoot = tempRepo();
  initGitRepo(repoRoot);
  fs.writeFileSync(path.join(repoRoot, "memory", "state.json"), "{\"cycle\":1}\n", "utf-8");
  fs.writeFileSync(path.join(repoRoot, "tracked.txt"), "user dirty\n", "utf-8");
  filesChanged.clear();
  filesChanged.add("memory/state.json");

  try {
    const stagedPaths = stageChangedPaths({ repoRoot });
    const cached = git(repoRoot, ["diff", "--cached", "--name-only"]);
    const unrelatedStatus = git(repoRoot, ["status", "--short", "--", "tracked.txt"]);

    assert.deepEqual(stagedPaths, ["memory/state.json"]);
    assert.equal(cached, "memory/state.json");
    assert.equal(unrelatedStatus, " M tracked.txt");
  } finally {
    filesChanged.clear();
  }
});

test("native tool result mode keeps OpenAI tool message shape", () => {
  const messages = [];
  const summaries = [];
  const assistant = assistantMessageForResult({
    content: "checking",
    toolCalls: [
      {
        id: "call_1",
        function: {
          name: "list_memory",
          arguments: "{}"
        }
      }
    ]
  }, "native");

  addToolResultMessage(messages, summaries, "native", {
    id: "call_1",
    name: "list_memory",
    content: "[]"
  });

  assert.equal(assistant.tool_calls.length, 1);
  assert.deepEqual(messages, [
    {
      role: "tool",
      tool_call_id: "call_1",
      content: "[]"
    }
  ]);
  assert.deepEqual(summaries, []);
});

test("user summary tool result mode avoids native tool messages", () => {
  const messages = [];
  const summaries = [];
  const assistant = assistantMessageForResult({
    content: "checking",
    toolCalls: [
      {
        id: "call_1",
        function: {
          name: "list_memory",
          arguments: "{}"
        }
      }
    ]
  }, "user_summary");

  addToolResultMessage(messages, summaries, "user_summary", {
    id: "call_1",
    name: "list_memory",
    input: { limit: 1 },
    content: "[]"
  });
  const userMessage = toolResultsUserMessage(summaries);

  assert.equal(assistant.tool_calls, undefined);
  assert.deepEqual(messages, []);
  assert.equal(userMessage.role, "user");
  assert.match(userMessage.content, /Tool results/);
  assert.match(userMessage.content, /list_memory/);
});

test("large tool arguments are compacted before re-entering model history", () => {
  const compacted = compactToolArguments(JSON.stringify({
    path: "src/App.jsx",
    content: "data:image/png;base64," + "a".repeat(40_000)
  }), "write_file", 2_000);
  const parsed = JSON.parse(compacted);

  assert.equal(Buffer.byteLength(compacted) <= 2_000, true);
  assert.equal(parsed.argumentsCompacted, true);
  assert.equal(parsed.tool, "write_file");
  assert.equal(parsed.content, "[OMITTED_LARGE_TOOL_CONTENT]");
  assert.equal(parsed.contentBytes > 40_000, true);
});

test("assistant history compacts oversized native tool call arguments", () => {
  const message = assistantMessageForResult({
    content: "checking",
    toolCalls: [
      {
        id: "call_1",
        function: {
          name: "write_file",
          arguments: JSON.stringify({
            path: "src/App.jsx",
            content: "x".repeat(40_000)
          })
        }
      }
    ]
  }, "native", { aiToolArgumentMaxBytes: 2_000 });

  const args = message.tool_calls[0].function.arguments;
  assert.equal(Buffer.byteLength(args) <= 2_000, true);
  assert.match(args, /OMITTED_LARGE_TOOL_CONTENT/);
});

test("tool argument compaction keeps unusual large fields under the byte limit", () => {
  const calls = compactToolCallsForHistory([
    {
      id: "call_1",
      function: {
        name: "unknown_tool",
        arguments: "x".repeat(40_000)
      }
    }
  ], { aiToolArgumentMaxBytes: 600 });

  const args = calls[0].function.arguments;
  assert.equal(Buffer.byteLength(args) <= 600, true);
  assert.match(args, /OMITTED_LARGE_TOOL_ARGUMENT/);
});

test("proof sanitizer redacts private routes, token configs, and addresses", () => {
  const sanitized = sanitizeProofOutput({
    treasury: {
      token: {
        launchRequest: {
          rewards: {
            recipients: [
              {
                recipient: "0x3333333333333333333333333333333333333333",
                bps: 1234
              }
            ]
          }
        }
      }
    },
    prepared: {
      tokenConfig: {
        tokenAdmin: "0x1111111111111111111111111111111111111111"
      },
      revenuePolicy: {
        operatorShareBps: 1234,
        treasurySharePct: 87.66
      }
    },
    publicNote: "pay to 0x2222222222222222222222222222222222222222"
  });

  const text = JSON.stringify(sanitized);
  assert.doesNotMatch(text, /0x[0-9a-fA-F]{40}/);
  assert.doesNotMatch(text, /1234/);
  assert.equal(sanitized.treasury.token.launchRequest, "[REDACTED_PRIVATE_CONFIG]");
  assert.equal(sanitized.prepared.tokenConfig, "[REDACTED_PRIVATE_CONFIG]");
  assert.equal(sanitized.prepared.revenuePolicy.operatorShareBps, "[REDACTED_PRIVATE_CONFIG]");
  assert.equal(sanitized.publicNote, "pay to [REDACTED_ADDRESS]");
});
