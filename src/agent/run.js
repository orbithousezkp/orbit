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
const { assertSignerMatches, signProof } = require("./proof-signing");
const { drawNextTarget, evaluateSkip } = require("./skip-guard");
const { assertStateWriteSafe } = require("./state-guard");
const { exportBundle, projectForDashboard } = require("../../packages/orbit-sdk");
const { projectForWellKnown } = require("./well-known");
const { scanMissions, buildMissionsRecord } = require("./missions");
const {
  processHandshakes,
  reverifyAdopters,
  buildEmptyRegistry,
  readRegistry,
  projectAdoptersForDashboard
} = require("./adopters");

const DASHBOARD_PATH = "public/dashboard.json";
const WELL_KNOWN_PATH = "public/.well-known/orbit.json";
const MISSIONS_PATH = "memory/missions.json";
const ADOPTERS_PATH = "memory/adopters-registry.json";
const PUBLIC_ADOPTERS_PATH = "public/adopters.json";
const DASHBOARD_MAX_BYTES = 60_000;

const REDACTED_PRIVATE_CONFIG = "[REDACTED_PRIVATE_CONFIG]";
const REDACTED_ADDRESS = "[REDACTED_ADDRESS]";
const OMITTED_LARGE_ARGUMENT = "[OMITTED_LARGE_TOOL_ARGUMENT]";
const OMITTED_LARGE_CONTENT = "[OMITTED_LARGE_TOOL_CONTENT]";
const PRIVATE_PROOF_KEYS = new Set([
  "acceptEncoding",
  "apiBase",
  "apiKey",
  "apiKeyEnv",
  "apiKeyRef",
  "authHeader",
  "authScheme",
  "baseRpcUrl",
  "githubToken",
  "headers",
  "launchRequest",
  "model",
  "operatorRevenueAddress",
  "operatorRevenueBps",
  "operatorShareBps",
  "operatorSharePct",
  "privateKey",
  "rewardRecipient",
  "tokenAdmin",
  "tokenAdminAddress",
  "tokenConfig",
  "treasuryAddress",
  "treasuryShareBps",
  "treasurySharePct",
  "walletPrivateKey"
]);
const PRIVATE_PROOF_KEY_PATTERNS = [
  /authorization/i,
  /private.*key/i,
  /secret/i,
  /token.*admin/i
];
const EVM_ADDRESS_PATTERN = /\b0x[a-fA-F0-9]{40}\b/g;

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

function shortGitCommit(repoRoot) {
  try {
    if (!gitAvailable(repoRoot)) return null;
    return git(repoRoot, ["rev-parse", "--short", "HEAD"]) || null;
  } catch {
    return null;
  }
}

function writeDashboardSnapshot(config) {
  const bundle = exportBundle(config.repoRoot, undefined, { receiptLimit: 10, includeMemory: false });
  const gitCommit = shortGitCommit(config.repoRoot);
  let slim = projectForDashboard(bundle, { gitCommit });
  let json = JSON.stringify(slim, null, 2);

  if (Buffer.byteLength(json) > DASHBOARD_MAX_BYTES) {
    slim = projectForDashboard(bundle, { gitCommit, receiptLimit: 5 });
    json = JSON.stringify(slim, null, 2);
  }
  if (Buffer.byteLength(json) > DASHBOARD_MAX_BYTES) {
    log(`dashboard snapshot ${Buffer.byteLength(json)}B exceeds ${DASHBOARD_MAX_BYTES}B cap; skipping`);
    return { written: false, bytes: Buffer.byteLength(json), path: DASHBOARD_PATH };
  }

  writeFile({ repoRoot: config.repoRoot }, DASHBOARD_PATH, `${json}\n`);

  // Also refresh the federation discovery document so other orbits can read
  // this repo's capabilities + signer at a well-known location.
  try {
    const wellKnown = projectForWellKnown(bundle, {
      repo: config.repoFullName || null,
      publicUrl: config.publicBaseUrl || null,
      signer: config.agentSigner || (slim && slim.signer) || null,
      githubRepo: config.repoFullName || null,
      dashboardUrl: "/dashboard.json"
    });
    writeFile({ repoRoot: config.repoRoot }, WELL_KNOWN_PATH, `${JSON.stringify(wellKnown, null, 2)}\n`);
  } catch (error) {
    log(`well-known refresh skipped: ${redactSecrets(error.message)}`);
  }

  return { written: true, bytes: Buffer.byteLength(json), path: DASHBOARD_PATH };
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

function maxToolArgumentBytes(config = {}) {
  const configured = Number(config.aiToolArgumentMaxBytes || 16_000);
  return Number.isFinite(configured) && configured > 0 ? configured : 16_000;
}

function compactToolArguments(argumentsText, toolName = "", maxBytes = 16_000) {
  const raw = String(argumentsText || "");
  if (Buffer.byteLength(raw) <= maxBytes) return redactSecrets(raw);

  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const compacted = { ...parsed };
      if (typeof compacted.content === "string") {
        compacted.contentBytes = Buffer.byteLength(compacted.content);
        compacted.content = OMITTED_LARGE_CONTENT;
      }
      if (typeof compacted.body === "string" && Buffer.byteLength(compacted.body) > maxBytes) {
        compacted.bodyBytes = Buffer.byteLength(compacted.body);
        compacted.body = OMITTED_LARGE_CONTENT;
      }
      compacted.argumentsCompacted = true;
      compacted.tool = toolName;
      const serialized = redactSecrets(JSON.stringify(compacted));
      if (Buffer.byteLength(serialized) <= maxBytes) return serialized;
    }
  } catch {
    // Fall through to a generic compact representation.
  }

  return genericCompactedToolArguments(raw, toolName, maxBytes);
}

function genericCompactedToolArguments(raw, toolName, maxBytes) {
  const originalBytes = Buffer.byteLength(raw);
  let preview = redactSecrets(raw).slice(0, Math.min(maxBytes, 2000));
  const build = (previewText) => JSON.stringify({
    argumentsCompacted: true,
    tool: toolName,
    originalBytes,
    preview: previewText,
    omitted: OMITTED_LARGE_ARGUMENT
  });

  let serialized = build(preview);
  while (Buffer.byteLength(serialized) > maxBytes && preview.length > 0) {
    const overage = Buffer.byteLength(serialized) - maxBytes;
    preview = preview.slice(0, Math.max(0, preview.length - overage - 16));
    serialized = build(preview);
  }
  if (Buffer.byteLength(serialized) <= maxBytes) return serialized;

  return JSON.stringify({
    argumentsCompacted: true,
    tool: toolName,
    originalBytes,
    omitted: OMITTED_LARGE_ARGUMENT
  });
}

function compactToolCallsForHistory(toolCalls = [], config = {}) {
  const maxBytes = maxToolArgumentBytes(config);
  return (Array.isArray(toolCalls) ? toolCalls : []).map((call) => {
    const name = call.function && call.function.name;
    return {
      ...call,
      function: {
        ...(call.function || {}),
        arguments: compactToolArguments(call.function && call.function.arguments, name, maxBytes)
      }
    };
  });
}

async function main() {
  const config = loadConfig();
  if (config.agentSigner && !config.walletPrivateKey) {
    throw new Error("ORBIT_AGENT_SIGNER set but ORBIT_WALLET_PRIVATE_KEY missing");
  }
  if (config.walletPrivateKey && config.agentSigner) {
    assertSignerMatches(config.walletPrivateKey, config.agentSigner);
  }
  const state = readJson(config.repoRoot, "memory/state.json", {
    cycle: 0,
    born: null,
    lastActive: null,
    lastStatus: "initialized",
    launchOnceFired: false
  });
  // S-FLOOR-1: cold-start the weekly fee-floor counter. The fee-floor module
  // treats `state.feeFloor == null` as "first-ever observation" (gate returns
  // due-but-zero-inflow), so this default is functionally equivalent to
  // omitting it — but writing the shape eagerly keeps memory/state.json
  // self-documenting for operators inspecting the file by hand.
  const feeFloor = require("./fee-floor");
  if (!state.feeFloor) state.feeFloor = feeFloor.defaultState();
  // Snapshot the on-disk state before this cycle started so the state-guard
  // can detect rollback attempts at write time (S-LAUNCH-1 Layer 3).
  const stateBeforeCycle = JSON.parse(JSON.stringify(state));
  // Snapshot treasury.json BEFORE any executeTool/saveTreasury call so the
  // Layer 3 launchStatus rollback guard has a real "before" image to compare
  // against. Reading once at end-of-cycle (after saveTreasury already ran
  // inside actions.js) makes prev === next, which silently disarms the guard.
  const treasuryPath = path.resolve(config.repoRoot, "memory/treasury.json");
  let prevTreasury = null;
  try {
    prevTreasury = JSON.parse(fs.readFileSync(treasuryPath, "utf-8"));
  } catch {
    prevTreasury = null; // no treasury yet — fresh repo / pre-launch
  }

  const skipDecision = evaluateSkip(config, state);
  if (skipDecision.skip) {
    const detail = skipDecision.reason === "floor"
      ? `elapsed=${Math.round(skipDecision.elapsedMs / 1000)}s floor=${Math.round(skipDecision.floorMs / 1000)}s`
      : `remaining=${Math.round(skipDecision.remainingMs / 1000)}s target=${skipDecision.nextCycleTargetAt}`;
    log(`cycle ${state.cycle + 1} skipped (reason=${skipDecision.reason} ${detail})`);
    return;
  }

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

  // Mission board widget — lift open `orbit:mission` issues into a public
  // record that the SDK projects onto /dashboard.json. Phase 1/2 scope; no
  // staking, no on-chain action. See PLAN/SPECS/MISSION_BOARD.md for the
  // Phase 3 staking-contract version.
  try {
    const rawIssues = Array.isArray(context.issues) ? context.issues : [];
    const missionList = scanMissions(rawIssues);
    const missionsRecord = buildMissionsRecord(missionList, { cycle: state.cycle });
    writeFile({ repoRoot: config.repoRoot }, MISSIONS_PATH, `${JSON.stringify(missionsRecord, null, 2)}\n`);
    context.missions = missionsRecord;
  } catch (error) {
    log(`mission scan skipped: ${redactSecrets(error.message)}`);
  }

  // Adopter tracking — process handshake issues + re-verify the registry's
  // existing entries. Updates memory/adopters-registry.json and writes a
  // public projection at public/adopters.json. See src/agent/adopters.js.
  try {
    const rawIssues = Array.isArray(context.issues) ? context.issues : [];
    const registry = readJson(config.repoRoot, ADOPTERS_PATH, buildEmptyRegistry());
    const ownRepo = config.repoFullName || null;
    const fetchJson = async (url) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10000);
      try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
      } finally {
        clearTimeout(timer);
      }
    };
    const { registry: afterHandshakes } = await processHandshakes({
      registry,
      issues: rawIssues,
      ownRepo,
      fetchJson,
      logRefusal: (entry) => log(`adopter refusal: ${entry.code} ${entry.repo || entry.issueNumber || ""}`)
    });
    const finalRegistry = await reverifyAdopters({ registry: afterHandshakes, fetchJson });
    writeFile({ repoRoot: config.repoRoot }, ADOPTERS_PATH, `${JSON.stringify(finalRegistry, null, 2)}\n`);
    writeFile({ repoRoot: config.repoRoot }, PUBLIC_ADOPTERS_PATH, `${JSON.stringify(projectAdoptersForDashboard(finalRegistry), null, 2)}\n`);
    context.adopters = finalRegistry;
  } catch (error) {
    log(`adopter scan skipped: ${redactSecrets(error.message)}`);
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

  // T-8: keep AI routing telemetry across cycles so auto-demote/promote
  // logic can accumulate. Lives in memory/state.json under aiRouting.
  state.aiRouting = state.aiRouting && typeof state.aiRouting === "object"
    ? state.aiRouting
    : { providers: {} };

  for (let step = 1; step <= config.maxSteps; step += 1) {
    log(`step ${step}/${config.maxSteps}`);
    const result = await infer(config, messages, TOOLS, state.aiRouting);
    if (result.routing && typeof result.routing === "object") {
      state.aiRouting = result.routing;
    }
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
        arguments: compactToolArguments(
          call.function && call.function.arguments,
          call.function && call.function.name,
          maxToolArgumentBytes(config)
        )
      }))
    });

    const toolResultMode = result.provider && result.provider.toolResultMode === "user_summary"
      ? "user_summary"
      : "native";
    messages.push(assistantMessageForResult(result, toolResultMode, config));

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

  const finishedAt = new Date().toISOString();
  proof.finishedAt = finishedAt;
  proof.filesChanged = [...filesChanged].sort();
  proof.totalSteps = proof.steps.length;

  const date = finishedAt.slice(0, 10);
  const stamp = finishedAt.replace(/[:.]/g, "-");
  const proofPath = `${config.proofDir}/${date}/${stamp}.json`;

  if (config.walletPrivateKey && config.agentSigner) {
    try {
      Object.assign(proof, await signProof(proof, config.walletPrivateKey));
      state.firstSignedCycle = state.firstSignedCycle || state.cycle;
    } catch (error) {
      proof.signError = redactSecrets(`sign_failed:${error.message}`);
    }
  }

  try {
    const nextTarget = drawNextTarget(config, finishedAt);
    state.lastCycleAt = nextTarget.lastCycleAt;
    state.nextCycleTargetAt = nextTarget.nextCycleTargetAt;
    state.skipGuardSig = nextTarget.skipGuardSig;
  } catch (error) {
    log(`skip-guard target draw failed: ${redactSecrets(error.message)}`);
  }

  // S-LAUNCH-1 Layer 3: refuse to write state if launchOnceFired or
  // treasury.token.launchStatus would roll back. Throws explicitly so we
  // can't silently lose the once-only guarantee.
  // Re-read on-disk state in case actions.js wrote launchOnceFired during
  // the cycle (launch_native_token persists it via clanker.js).
  let onDiskState = stateBeforeCycle;
  try {
    onDiskState = JSON.parse(fs.readFileSync(path.resolve(config.repoRoot, "memory/state.json"), "utf-8"));
  } catch {
    onDiskState = stateBeforeCycle;
  }
  if (onDiskState && onDiskState.launchOnceFired === true) {
    state.launchOnceFired = true;
  }
  // Bug B: re-read treasury.json now to capture saveTreasury writes that
  // happened during this cycle (e.g. clanker.launchNativeToken flipped
  // launchStatus to "launched"). prevTreasury was snapshotted at the top of
  // main() before any executeTool call ran, so prev/next are real distinct
  // images and the launchStatus rollback guard can actually fire.
  let nextTreasury = null;
  try {
    nextTreasury = JSON.parse(fs.readFileSync(treasuryPath, "utf-8"));
  } catch {
    nextTreasury = null;
  }
  assertStateWriteSafe(onDiskState, state, { prevTreasury, nextTreasury });
  writeJson(config.repoRoot, "memory/state.json", state);
  writeJson(config.repoRoot, proofPath, proof);

  appendLine(config.repoRoot, "memory/cycles.jsonl", {
    cycle: state.cycle,
    timestamp: finishedAt,
    aiRoute: config.aiProviders.length ? "private" : "deterministic",
    dryRun: config.dryRun,
    filesChanged: proof.filesChanged,
    result: redactSecrets(String(proof.result || "")).slice(0, 240)
  });

  try {
    writeDashboardSnapshot(config);
  } catch (error) {
    log(`dashboard snapshot skipped: ${redactSecrets(error.message)}`);
  }

  try {
    const { postCycleCast, summarizeCycleForCast } = require("./farcaster");
    const cycleSummary = summarizeCycleForCast(proof, context, config);
    const cast = await postCycleCast(config, cycleSummary, proof);
    proof.cast = cast;
    if (cast && cast.ledgerPath) filesChanged.add(cast.ledgerPath);
    writeJson(config.repoRoot, proofPath, proof);
  } catch (error) {
    proof.cast = { ok: false, error: redactSecrets(`cast_failed:${error.message}`) };
    writeJson(config.repoRoot, proofPath, proof);
  }

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
  return sanitizePublicArtifact(input);
}

function sanitizeProofOutput(output) {
  return sanitizePublicArtifact(output);
}

function isPrivateProofKey(key) {
  if (!key) return false;
  return PRIVATE_PROOF_KEYS.has(key) || PRIVATE_PROOF_KEY_PATTERNS.some((pattern) => pattern.test(key));
}

function sanitizePublicString(value) {
  return redactSecrets(String(value || ""))
    .replace(EVM_ADDRESS_PATTERN, REDACTED_ADDRESS)
    .slice(0, 8000);
}

function sanitizePublicArtifact(value, key = "") {
  if (value === null || value === undefined) return value;
  if (isPrivateProofKey(key)) return REDACTED_PRIVATE_CONFIG;
  if (typeof value === "string") return sanitizePublicString(value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) {
    return value.map((item) => sanitizePublicArtifact(item, key));
  }
  if (typeof value === "object") {
    const result = {};
    for (const [entryKey, entryValue] of Object.entries(value)) {
      result[entryKey] = sanitizePublicArtifact(entryValue, entryKey);
    }
    return result;
  }
  return sanitizePublicString(value);
}

function assistantMessageForResult(result, toolResultMode = "native", config = {}) {
  const message = {
    role: "assistant",
    content: result.content || ""
  };
  if (toolResultMode === "native" && result.toolCalls && result.toolCalls.length) {
    message.tool_calls = compactToolCallsForHistory(result.toolCalls, config);
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
      "Use these safe tool results to choose the next small repository action. If enough work is done, finish without more tool calls."
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
  compactToolArguments,
  compactToolCallsForHistory,
  main,
  parseToolInput,
  sanitizeProofInput,
  sanitizeProofOutput,
  sanitizePublicArtifact,
  stageChangedPaths,
  toolResultsUserMessage,
  writeDashboardSnapshot
};
