#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { loadConfig } = require("./config");
const { gatherContext } = require("./context");
const { GitHubClient } = require("./github");
const { infer } = require("./inference");
const { buildFirstWakeIntro, shouldRunFirstWakeIntro } = require("./intro");
const { buildSystemPrompt, buildUserPrompt } = require("./prompt");
const { normalizeTrigger } = require("./triggers");
const { TOOLS } = require("./tools");
const { executeTool, filesChanged, writeFile } = require("./actions");
const { appendSafeTextFile, assertNoSymlinkPath, readSafeTextFile, redactSecrets } = require("./safety");
const { TREASURY_PATH, recordAiUsage } = require("./treasury");
const { privateAiRouteId, privateAiRoutes, privateProviderErrors } = require("./provider-privacy");

function log(message) {
  console.log(`[orbit] ${message}`);
}

function readJson(repoRoot, relativePath, fallback) {
  try {
    return JSON.parse(readSafeTextFile(repoRoot, relativePath));
  } catch {
    return fallback;
  }
}

function writeJson(repoRoot, relativePath, value) {
  writeFile({ repoRoot }, relativePath, `${JSON.stringify(value, null, 2)}\n`);
}

function appendLine(repoRoot, relativePath, value) {
  const { normalized } = appendSafeTextFile(repoRoot, relativePath, `${JSON.stringify(value)}\n`);
  filesChanged.add(normalized);
}

function gitAvailable(repoRoot) {
  return fs.existsSync(path.resolve(repoRoot, ".git"));
}

function git(repoRoot, args) {
  return execFileSync("git", args, { cwd: repoRoot, encoding: "utf-8" }).trim();
}

function changedPathsForCommit(config) {
  return [...filesChanged]
    .sort()
    .map((relativePath) => assertNoSymlinkPath(config.repoRoot, relativePath).normalized)
    .filter((relativePath, index, paths) => paths.indexOf(relativePath) === index);
}

function stageChangedPaths(config) {
  const changedPaths = changedPathsForCommit(config);
  if (changedPaths.length) {
    git(config.repoRoot, ["add", "--", ...changedPaths]);
  }
  return changedPaths;
}

function commitIfNeeded(config, cycle, stepCount) {
  if (!config.commitChanges || !gitAvailable(config.repoRoot) || filesChanged.size === 0) {
    return { committed: false, reason: "commit disabled, no git repo, or no changes" };
  }

  const changedPaths = stageChangedPaths(config);
  if (!changedPaths.length) {
    return { committed: false, reason: "no validated changed paths" };
  }

  git(config.repoRoot, ["config", "user.name", "Orbit"]);
  git(config.repoRoot, ["config", "user.email", "orbit@users.noreply.github.com"]);

  const staged = git(config.repoRoot, ["diff", "--cached", "--name-only", "--", ...changedPaths]);
  if (!staged) return { committed: false, reason: "no tracked changes after staging" };

  const message = `[orbit] cycle #${cycle} (${stepCount} steps)`;
  git(config.repoRoot, ["commit", "-m", message]);

  if (config.pushChanges) {
    git(config.repoRoot, ["push"]);
  }

  return { committed: true, pushed: config.pushChanges, message };
}

function parseToolInput(toolCall) {
  const raw = toolCall.function && toolCall.function.arguments;
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`invalid tool input JSON: ${error.message}`);
  }
}

async function main() {
  const config = loadConfig();
  const state = readJson(config.repoRoot, "memory/state.json", {
    cycle: 0,
    born: null,
    lastActive: null,
    lastStatus: "initialized"
  });

  state.cycle += 1;
  state.born = state.born || new Date().toISOString();
  state.lastActive = new Date().toISOString();
  state.lastStatus = "running";
  const firstWakeIntro = shouldRunFirstWakeIntro(state)
    ? buildFirstWakeIntro(config, state)
    : null;
  const cycleTrigger = normalizeTrigger(config);

  log(`cycle ${state.cycle} starting (${cycleTrigger.type}:${cycleTrigger.id})`);
  const github = new GitHubClient(config);
  const context = await gatherContext(config);
  if (context.opportunities && context.opportunities.changed && context.opportunities.path) {
    filesChanged.add(context.opportunities.path);
  }
  if (context.learningLab && context.learningLab.changedPaths) {
    for (const path of context.learningLab.changedPaths) filesChanged.add(path);
  }
  context.cycle = state.cycle;
  if (firstWakeIntro) {
    context.firstWakeIntro = firstWakeIntro;
  }

  const proof = {
    brand: config.brandName,
    cycle: state.cycle,
    startedAt: state.lastActive,
    aiRoute: {
      configured: config.aiProviders.length > 0,
      count: config.aiProviders.length,
      routes: privateAiRoutes(config.aiProviders)
    },
    dryRun: config.dryRun,
    trigger: cycleTrigger,
    firstWakeIntro,
    steps: [],
    filesChanged: [],
    result: null
  };

  const messages = [
    { role: "system", content: buildSystemPrompt() },
    { role: "user", content: buildUserPrompt(context), context }
  ];

  for (let step = 1; step <= config.maxSteps; step += 1) {
    log(`step ${step}/${config.maxSteps}`);
    const result = await infer(config, messages, TOOLS);
    if (!result.fallback && result.usage) {
      const aiRoute = result.provider && result.provider.route ? result.provider.route : privateAiRouteId({}, 0);
      const usage = recordAiUsage(config, config.repoRoot, result.usage, aiRoute, `cycle ${state.cycle} step ${step}`);
      filesChanged.add(TREASURY_PATH);
      proof.steps.push({
        step,
        accounting: "ai_usage",
        aiRoute,
        usage: result.usage,
        estimatedUsd: usage.estimatedUsd
      });
    }

    if (result.fallback) {
      proof.steps.push({
        step,
        fallback: true,
        content: redactSecrets(result.content),
        providerErrors: privateProviderErrors(result.providerErrors || []),
        actions: sanitizeProofOutput(result.actions)
      });

      for (const action of result.actions) {
        const output = await executeTool(config, github, state.cycle, action.tool, action.input);
        proof.steps.push({
          step,
          tool: action.tool,
          input: sanitizeProofInput(action.input),
          output: sanitizeProofOutput(output)
        });
      }
      proof.result = redactSecrets(result.content || "");
      break;
    }

    proof.steps.push({
      step,
      finishReason: result.finishReason,
      aiRoute: result.provider || null,
      providerErrors: privateProviderErrors(result.providerErrors || []),
      content: redactSecrets(result.content || ""),
      toolCalls: result.toolCalls.map((call) => ({
        id: call.id,
        name: call.function && call.function.name,
        arguments: redactSecrets(call.function && call.function.arguments)
      }))
    });

    const toolResultMode = result.provider && result.provider.toolResultMode === "user_summary"
      ? "user_summary"
      : "native";
    messages.push(assistantMessageForResult(result, toolResultMode));

    if (!result.toolCalls.length) {
      proof.result = redactSecrets(result.content || "Cycle finished without tool calls.");
      break;
    }

    const summarizedToolResults = [];
    for (const toolCall of result.toolCalls) {
      const name = toolCall.function && toolCall.function.name;
      try {
        const input = parseToolInput(toolCall);
        const output = await executeTool(config, github, state.cycle, name, input);
        const toolContent = JSON.stringify(sanitizeProofOutput(output));
        addToolResultMessage(messages, summarizedToolResults, toolResultMode, {
          id: toolCall.id,
          name,
          input: sanitizeProofInput(input),
          content: toolContent
        });
        proof.steps.push({
          step,
          tool: name,
          input: sanitizeProofInput(input),
          output: sanitizeProofOutput(output)
        });
      } catch (error) {
        const content = redactSecrets(`tool error: ${error.message}`);
        addToolResultMessage(messages, summarizedToolResults, toolResultMode, {
          id: toolCall.id,
          name,
          error: content
        });
        proof.steps.push({
          step,
          tool: name,
          error: redactSecrets(error.message)
        });
      }
    }

    if (toolResultMode === "user_summary" && summarizedToolResults.length) {
      messages.push(toolResultsUserMessage(summarizedToolResults));
    }
  }

  state.lastStatus = "completed";
  if (firstWakeIntro) {
    state.firstWakeIntroComplete = true;
    state.firstWakeIntroAt = firstWakeIntro.timestamp;
  }
  writeJson(config.repoRoot, "memory/state.json", state);

  const finishedAt = new Date().toISOString();
  proof.finishedAt = finishedAt;
  proof.filesChanged = [...filesChanged].sort();
  proof.totalSteps = proof.steps.length;

  const date = finishedAt.slice(0, 10);
  const stamp = finishedAt.replace(/[:.]/g, "-");
  const proofPath = `${config.proofDir}/${date}/${stamp}.json`;
  writeJson(config.repoRoot, proofPath, proof);

  appendLine(config.repoRoot, "memory/cycles.jsonl", {
    cycle: state.cycle,
    timestamp: finishedAt,
    aiRoute: config.aiProviders.length ? "private" : "deterministic",
    dryRun: config.dryRun,
    filesChanged: proof.filesChanged,
    result: redactSecrets(String(proof.result || "")).slice(0, 240)
  });

  let commitResult;
  try {
    commitResult = commitIfNeeded(config, state.cycle, proof.totalSteps);
  } catch (error) {
    commitResult = { committed: false, error: error.message };
  }

  log(`cycle ${state.cycle} finished`);
  log(`changed files: ${[...filesChanged].sort().join(", ") || "none"}`);
  log(`commit: ${JSON.stringify(commitResult)}`);
}

function sanitizeProofInput(input) {
  if (!input || typeof input !== "object") return input;
  return JSON.parse(redactSecrets(JSON.stringify(input)));
}

function sanitizeProofOutput(output) {
  if (output === null || output === undefined) return output;
  if (typeof output === "string") return redactSecrets(output).slice(0, 8000);
  try {
    return JSON.parse(redactSecrets(JSON.stringify(output)));
  } catch {
    return String(output).slice(0, 8000);
  }
}

function assistantMessageForResult(result, toolResultMode = "native") {
  const message = {
    role: "assistant",
    content: result.content || ""
  };
  if (toolResultMode === "native" && result.toolCalls && result.toolCalls.length) {
    message.tool_calls = result.toolCalls;
  }
  return message;
}

function addToolResultMessage(messages, summarizedToolResults, toolResultMode, result) {
  const content = result.error || String(result.content || "").slice(0, 12_000);
  if (toolResultMode === "native") {
    messages.push({
      role: "tool",
      tool_call_id: result.id,
      content
    });
    return;
  }

  summarizedToolResults.push({
    toolCallId: result.id,
    tool: result.name,
    input: result.input,
    output: result.error ? undefined : content,
    error: result.error
  });
}

function toolResultsUserMessage(summarizedToolResults) {
  return {
    role: "user",
    content: [
      "Tool results from the previous assistant-requested actions:",
      JSON.stringify(summarizedToolResults).slice(0, 12_000),
      "Use these safe tool results to choose the next small household action. If enough work is done, finish without more tool calls."
    ].join("\n")
  };
}

if (require.main === module) {
  main().catch((error) => {
    console.error(redactSecrets(`[orbit:fatal] ${error.stack || error.message}`));
    process.exit(1);
  });
}

module.exports = {
  changedPathsForCommit,
  addToolResultMessage,
  assistantMessageForResult,
  commitIfNeeded,
  main,
  parseToolInput,
  sanitizeProofInput,
  sanitizeProofOutput,
  stageChangedPaths,
  toolResultsUserMessage
};
