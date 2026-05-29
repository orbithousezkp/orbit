"use strict";

/**
 * Plugin / tool loader — capability-allowlist model (S-024).
 *
 * Loads third-party tool plugins from a manifest at `memory/plugins.json`
 * and exposes them to the cycle loop. The loader enforces:
 *
 *   - explicit owner enablement per-plugin (no auto-load),
 *   - a frozen capability allowlist (unknown capabilities are rejected),
 *   - per-capability runtime gates (wallet + network default to DRY_RUN),
 *   - anti-exfil response sanitization (no raw `text` / `rendered` / HTML
 *     leaks back into proofs),
 *   - safe handler invocation that converts thrown errors into structured
 *     `{ isError: true, reason }` payloads.
 *
 * Hard rules:
 *   - No new npm dependency. Pure Node built-ins.
 *   - No on-chain action without approval (D-014) — plugins requesting
 *     `wallet` are forced to DRY_RUN unless `ORBIT_PLUGIN_LIVE === "true"`.
 *   - Token-launch hard-block (D-018) is unaffected; plugins cannot override
 *     the launch gate.
 *   - Tool handlers MUST NEVER surface raw `text` / `rendered` fields; those
 *     are stripped by `sanitizeToolResponse` before the response touches a
 *     proof.
 *
 * The companion spec is PLAN/SPECS/PLUGIN_LOADER.md.
 */

const fs = require("node:fs");
const path = require("node:path");

const { readSafeTextFile } = require("./safety");

const PLUGIN_MANIFEST_PATH = "memory/plugins.json";

// Frozen capability allowlist. Adding a capability requires a spec update +
// matching loader gate; never extend this set from user data.
const CAPABILITIES = Object.freeze({
  READ_ISSUES:    "read-issues",
  COMMENT_ISSUES: "comment-issues",
  READ_MEMORY:    "read-memory",
  WRITE_MEMORY:   "write-memory",
  WALLET:         "wallet",
  NETWORK:        "network"
});

const CAPABILITY_VALUES = Object.freeze(Object.values(CAPABILITIES));
const CAPABILITY_SET = new Set(CAPABILITY_VALUES);

// Capabilities that imply external side effects. These default to DRY_RUN
// unless the owner explicitly flips ORBIT_PLUGIN_LIVE.
const SIDE_EFFECT_CAPABILITIES = Object.freeze(["wallet", "network"]);

// Per-request hard caps. Plugins can request smaller, never larger.
const NETWORK_TIMEOUT_MAX_MS = 15_000;
const NETWORK_TIMEOUT_DEFAULT_MS = 5_000;

// Fields that MUST be stripped from a tool response before it lands in a
// proof. `text` and `rendered` are the prompt-injection / exfil surface;
// anything that contains raw HTML markup is also stripped defensively.
const FORBIDDEN_RESPONSE_FIELDS = Object.freeze([
  "text",
  "rendered",
  "renderedText",
  "rawText",
  "html",
  "innerHTML",
  "outerHTML",
  "raw",
  "prompt",
  "systemPrompt"
]);

const HTML_TAG_PATTERN = /<\s*\/?\s*[a-zA-Z][^>]*>/g;
// Accept either bare identifiers (`tool-loadtest`) or npm-scoped names
// (`@orbithouse/tool-example`). No spaces, no path traversal, capped at 96.
const NAME_PATTERN = /^(?:@[a-z0-9][a-z0-9._-]{0,40}\/)?[a-zA-Z][a-zA-Z0-9_.:-]{0,80}$/;
const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:[-+][A-Za-z0-9._-]+)?$/;
const TOOL_NAME_PATTERN = /^[a-z][a-z0-9_]{0,63}$/;

// ---------------------------------------------------------------------------
// JSON helpers (mirror governance.js style — fall back silently if missing).
// ---------------------------------------------------------------------------

function readJson(repoRoot, relativePath, fallback) {
  try {
    return JSON.parse(readSafeTextFile(repoRoot, relativePath));
  } catch {
    return fallback;
  }
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Validate a plugin object. Throws Error with a stable, machine-readable
 * message on the first failure. Returns the plugin unchanged on success.
 *
 * Plugin shape:
 *   { name, version, capabilities: [...], tools: [{name, description, inputSchema, handler}] }
 */
function validatePlugin(plugin) {
  if (!plugin || typeof plugin !== "object" || Array.isArray(plugin)) {
    throw new Error("plugin must be an object");
  }
  if (!plugin.name || typeof plugin.name !== "string") {
    throw new Error("plugin.name is required");
  }
  if (!NAME_PATTERN.test(plugin.name)) {
    throw new Error(`plugin.name "${plugin.name}" is not a valid identifier`);
  }
  if (!plugin.version || typeof plugin.version !== "string") {
    throw new Error("plugin.version is required");
  }
  if (!VERSION_PATTERN.test(plugin.version)) {
    throw new Error(`plugin.version "${plugin.version}" must be semver`);
  }
  if (!Array.isArray(plugin.capabilities)) {
    throw new Error("plugin.capabilities must be an array");
  }
  for (const cap of plugin.capabilities) {
    if (typeof cap !== "string") {
      throw new Error("plugin.capabilities entries must be strings");
    }
    if (!CAPABILITY_SET.has(cap)) {
      throw new Error(`plugin.capabilities contains unknown capability "${cap}"`);
    }
  }
  if (!Array.isArray(plugin.tools) || plugin.tools.length === 0) {
    throw new Error("plugin.tools must be a non-empty array");
  }
  const seenToolNames = new Set();
  for (const tool of plugin.tools) {
    if (!tool || typeof tool !== "object") {
      throw new Error("plugin.tools entries must be objects");
    }
    if (!tool.name || typeof tool.name !== "string") {
      throw new Error("plugin.tools[].name is required");
    }
    if (!TOOL_NAME_PATTERN.test(tool.name)) {
      throw new Error(`plugin.tools[].name "${tool.name}" is invalid (snake_case lowercase, <=64 chars)`);
    }
    if (seenToolNames.has(tool.name)) {
      throw new Error(`plugin.tools[].name "${tool.name}" is duplicated`);
    }
    seenToolNames.add(tool.name);
    if (!tool.description || typeof tool.description !== "string") {
      throw new Error(`plugin.tools[${tool.name}].description is required`);
    }
    if (!tool.inputSchema || typeof tool.inputSchema !== "object") {
      throw new Error(`plugin.tools[${tool.name}].inputSchema is required`);
    }
    if (typeof tool.handler !== "function") {
      throw new Error(`plugin.tools[${tool.name}].handler must be a function`);
    }
  }
  return plugin;
}

// ---------------------------------------------------------------------------
// Capability gating
// ---------------------------------------------------------------------------

/**
 * Decide whether a plugin may use a particular capability for the current
 * request. Returns `{ ok, reason?, dryRun }`. Never throws.
 *
 *   - Unknown capability => denied with `capability_unknown`.
 *   - Capability not declared by the plugin => denied with `capability_undeclared`.
 *   - `wallet` capability is always DRY_RUN unless ORBIT_PLUGIN_LIVE === "true"
 *     (D-014: no on-chain action without an explicit owner flip).
 *   - `network` capability is always DRY_RUN-by-default for plugins that did
 *     not opt in to live network, mirroring the wallet behavior so a plugin
 *     can't quietly call out without owner consent.
 */
function applyCapabilityGate(plugin, requestedCapability, env = process.env) {
  if (!plugin || typeof plugin !== "object") {
    return { ok: false, reason: "plugin_missing", dryRun: true };
  }
  if (!CAPABILITY_SET.has(requestedCapability)) {
    return { ok: false, reason: "capability_unknown", dryRun: true };
  }
  const declared = Array.isArray(plugin.capabilities) ? plugin.capabilities : [];
  if (!declared.includes(requestedCapability)) {
    return { ok: false, reason: "capability_undeclared", dryRun: true };
  }
  const live = String((env && env.ORBIT_PLUGIN_LIVE) || "").toLowerCase() === "true";
  const dryRun = SIDE_EFFECT_CAPABILITIES.includes(requestedCapability) ? !live : false;
  return { ok: true, dryRun };
}

// ---------------------------------------------------------------------------
// Network timeout cap
// ---------------------------------------------------------------------------

function clampNetworkTimeout(requestedMs) {
  const n = Number(requestedMs);
  if (!Number.isFinite(n) || n <= 0) return NETWORK_TIMEOUT_DEFAULT_MS;
  return Math.min(Math.floor(n), NETWORK_TIMEOUT_MAX_MS);
}

// ---------------------------------------------------------------------------
// Response sanitization (anti-exfil)
// ---------------------------------------------------------------------------

function stripHtml(value) {
  return String(value || "").replace(HTML_TAG_PATTERN, "");
}

/**
 * Recursively strip forbidden fields and HTML markup from a tool response.
 * Returns a new object — never mutates the caller's value. Numbers, booleans,
 * and null pass through unchanged. Strings are HTML-stripped. Arrays are
 * mapped element-wise.
 *
 * This is the LAST line of defense for the anti-exfil rule: even if a
 * plugin author tries to leak rendered prompt text or raw HTML, this strips
 * it before the response ever touches a proof.
 */
function sanitizeToolResponse(response) {
  if (response === null || response === undefined) return response;
  if (typeof response === "string") return stripHtml(response);
  if (typeof response === "number" || typeof response === "boolean") return response;
  if (Array.isArray(response)) {
    return response.map((entry) => sanitizeToolResponse(entry));
  }
  if (typeof response === "object") {
    const result = {};
    for (const [key, value] of Object.entries(response)) {
      if (FORBIDDEN_RESPONSE_FIELDS.includes(key)) continue;
      result[key] = sanitizeToolResponse(value);
    }
    return result;
  }
  // Functions / symbols / bigints: refuse to ship.
  return null;
}

// ---------------------------------------------------------------------------
// Safe handler invocation
// ---------------------------------------------------------------------------

/**
 * Call a plugin tool handler and convert any thrown error or rejected
 * promise into a structured `{ isError: true, reason }` payload. Successful
 * responses are run through `sanitizeToolResponse` before return.
 */
async function invokeToolSafely(handler, input, context = {}) {
  try {
    const raw = await Promise.resolve(handler(input, context));
    return sanitizeToolResponse(raw);
  } catch (err) {
    return {
      isError: true,
      reason: String((err && err.message) || err || "handler_error").slice(0, 240)
    };
  }
}

// ---------------------------------------------------------------------------
// Manifest + dynamic resolution
// ---------------------------------------------------------------------------

/**
 * Master switch: is the plugin loader enabled for this run at all?
 * Defaults to off — an Orbit instance must explicitly set
 * `ORBIT_ENABLE_PLUGINS=true` (or pass `config.plugins.enabled === true`).
 */
function isPluginEnabled(config = {}, env = process.env) {
  const pluginConfig = (config && config.plugins) || {};
  if (pluginConfig.enabled === true) return true;
  return String((env && env.ORBIT_ENABLE_PLUGINS) || "").toLowerCase() === "true";
}

function normalizeManifestEntry(entry) {
  if (!entry || typeof entry !== "object") return null;
  if (!entry.name || typeof entry.name !== "string") return null;
  return {
    name: entry.name,
    source: typeof entry.source === "string" ? entry.source : "",
    version: typeof entry.version === "string" ? entry.version : "",
    capabilities: Array.isArray(entry.capabilities) ? entry.capabilities.slice() : [],
    enabled: entry.enabled === true,
    addedAt: typeof entry.addedAt === "string" ? entry.addedAt : "",
    addedBy: typeof entry.addedBy === "string" ? entry.addedBy : ""
  };
}

function readManifest(repoRoot) {
  const parsed = readJson(repoRoot, PLUGIN_MANIFEST_PATH, null);
  if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.plugins)) {
    return { plugins: [] };
  }
  return { plugins: parsed.plugins.map(normalizeManifestEntry).filter(Boolean) };
}

/**
 * Resolve a plugin module from a manifest entry. The `source` is interpreted
 * as either:
 *   - an absolute path under the repo, or
 *   - a require()-resolvable specifier (e.g. `@orbithouse/tool-example`)
 *     resolved from `repoRoot/node_modules`.
 *
 * Errors during resolution surface as `{ ok: false, reason }` rather than
 * throwing — a bad plugin must never crash the cycle.
 */
function resolvePluginModule(repoRoot, entry) {
  try {
    if (!entry.source) return { ok: false, reason: "manifest_source_missing" };
    const candidate = entry.source.startsWith(".") || entry.source.startsWith("/")
      ? path.resolve(repoRoot, entry.source)
      : entry.source;
    // require.resolve scoped to repoRoot so a plugin must be installed in the
    // adopter repo, not in Orbit's own dev tree.
    const resolved = require.resolve(candidate, { paths: [repoRoot, path.join(repoRoot, "node_modules")] });
    // eslint-disable-next-line global-require
    const mod = require(resolved);
    const plugin = mod && mod.default ? mod.default : mod;
    return { ok: true, plugin, resolvedPath: resolved };
  } catch (err) {
    return { ok: false, reason: String((err && err.message) || err || "resolve_failed").slice(0, 200) };
  }
}

/**
 * Load all enabled plugins for the current repo. Always returns
 * `{ plugins: [...], errors: [...] }`. Never throws.
 *
 *   - If `ORBIT_ENABLE_PLUGINS` is not set (and `config.plugins.enabled` is
 *     not true), returns an empty list immediately (no manifest read).
 *   - If the manifest is missing or unparseable, returns an empty list.
 *   - Manifest entries with `enabled: false` are skipped.
 *   - Duplicate plugin names within the manifest are rejected (second wins
 *     would let a hostile entry shadow a trusted one).
 *   - Per-plugin resolution / validation errors are collected into `errors`
 *     and the offender is omitted from `plugins`.
 */
function loadPlugins(repoRoot, options = {}) {
  const config = options.config || {};
  const env = options.env || process.env;

  if (!isPluginEnabled(config, env)) {
    return { plugins: [], errors: [], enabled: false };
  }

  const manifest = readManifest(repoRoot);
  if (!manifest.plugins.length) {
    return { plugins: [], errors: [], enabled: true };
  }

  const plugins = [];
  const errors = [];
  const seenNames = new Set();

  for (const entry of manifest.plugins) {
    if (!entry.enabled) {
      errors.push({ name: entry.name, reason: "disabled_in_manifest" });
      continue;
    }
    if (seenNames.has(entry.name)) {
      errors.push({ name: entry.name, reason: "duplicate_in_manifest" });
      continue;
    }
    seenNames.add(entry.name);

    const resolution = resolvePluginModule(repoRoot, entry);
    if (!resolution.ok) {
      errors.push({ name: entry.name, reason: resolution.reason });
      continue;
    }
    let plugin;
    try {
      plugin = validatePlugin(resolution.plugin);
    } catch (err) {
      errors.push({ name: entry.name, reason: String((err && err.message) || err).slice(0, 200) });
      continue;
    }
    if (plugin.name !== entry.name) {
      errors.push({ name: entry.name, reason: `name_mismatch: module reports ${plugin.name}` });
      continue;
    }
    // Manifest must declare every capability the plugin requests — owner has
    // the final word, so a plugin update that silently asks for `wallet`
    // when the manifest only allowed `read-memory` is rejected.
    const undeclared = plugin.capabilities.filter((cap) => !entry.capabilities.includes(cap));
    if (undeclared.length) {
      errors.push({ name: entry.name, reason: `capabilities_not_authorized: ${undeclared.join(",")}` });
      continue;
    }
    plugins.push({
      ...plugin,
      manifestSource: entry.source,
      manifestVersion: entry.version
    });
  }

  return { plugins, errors, enabled: true };
}

module.exports = {
  CAPABILITIES,
  CAPABILITY_VALUES,
  FORBIDDEN_RESPONSE_FIELDS,
  NETWORK_TIMEOUT_DEFAULT_MS,
  NETWORK_TIMEOUT_MAX_MS,
  PLUGIN_MANIFEST_PATH,
  SIDE_EFFECT_CAPABILITIES,
  applyCapabilityGate,
  clampNetworkTimeout,
  invokeToolSafely,
  isPluginEnabled,
  loadPlugins,
  readManifest,
  sanitizeToolResponse,
  validatePlugin
};
