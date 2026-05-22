"use strict";

const dns = require("dns").promises;
const net = require("net");
const { redactSecrets } = require("./safety");
const { omitUnsafeVisitorContent, scanTextRisk, scanUrl } = require("./scam");

const MAX_REDIRECTS = 5;
const SENSITIVE_REDIRECT_HEADERS = new Set([
  "authorization",
  "cookie",
  "proxy-authorization"
]);

function hostMatches(hostname, allowedDomains) {
  if (!allowedDomains || allowedDomains.length === 0) return true;
  const host = String(hostname || "").toLowerCase();
  return allowedDomains.some((domain) => {
    const normalized = String(domain || "").toLowerCase().replace(/^\*\./, "");
    return host === normalized || host.endsWith(`.${normalized}`);
  });
}

function isPrivateIpv4(address) {
  const parts = address.split(".").map((part) => Number.parseInt(part, 10));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) return false;
  const [a, b] = parts;
  return (
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    a === 0
  );
}

function isPrivateIpv6(address) {
  const value = normalizeIpLiteral(address).toLowerCase();
  const firstHextet = Number.parseInt(value.split(":")[0] || "0", 16);
  return (
    value === "::" ||
    value === "::1" ||
    value.startsWith("::ffff:") ||
    (Number.isInteger(firstHextet) && (firstHextet & 0xfe00) === 0xfc00) ||
    (Number.isInteger(firstHextet) && (firstHextet & 0xffc0) === 0xfe80)
  );
}

function normalizeIpLiteral(address) {
  const value = String(address || "").trim();
  return value.startsWith("[") && value.endsWith("]")
    ? value.slice(1, -1)
    : value;
}

function isPrivateAddress(address) {
  const normalized = normalizeIpLiteral(address);
  const family = net.isIP(normalized);
  if (family === 4) return isPrivateIpv4(normalized);
  if (family === 6) return isPrivateIpv6(normalized);
  return false;
}

function parsePublicUrl(rawUrl) {
  const parsed = new URL(String(rawUrl || ""));
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("only http and https URLs are allowed");
  }
  if (parsed.username || parsed.password) {
    throw new Error("URLs with embedded credentials are not allowed");
  }
  const hostname = parsed.hostname.toLowerCase();
  if (["localhost", "localhost.localdomain"].includes(hostname) || hostname.endsWith(".local")) {
    throw new Error("local hostnames are not allowed");
  }
  if (isPrivateAddress(hostname)) {
    throw new Error("private IP URLs are not allowed");
  }
  return parsed;
}

async function assertPublicDns(parsed) {
  if (net.isIP(normalizeIpLiteral(parsed.hostname))) return;
  const records = await dns.lookup(parsed.hostname, { all: true });
  if (records.some((record) => isPrivateAddress(record.address))) {
    throw new Error("URL resolves to a private network address");
  }
}

function isRedirectStatus(status) {
  return status >= 300 && status < 400;
}

function headerEntries(headers = {}) {
  if (!headers) return [];
  if (typeof Headers !== "undefined" && headers instanceof Headers) {
    return Array.from(headers.entries());
  }
  if (Array.isArray(headers)) return headers;
  return Object.entries(headers);
}

function normalizeHeaders(headers = {}) {
  return Object.fromEntries(headerEntries(headers));
}

function stripSensitiveRedirectHeaders(headers = {}) {
  return Object.fromEntries(
    headerEntries(headers).filter(([key]) => !SENSITIVE_REDIRECT_HEADERS.has(String(key).toLowerCase()))
  );
}

async function fetchWithPublicRedirects(parsed, options = {}, validateTarget = async () => null) {
  let current = parsed;
  let currentOptions = {
    ...options,
    headers: normalizeHeaders(options.headers || {})
  };
  const redirects = [];

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const blocked = await validateTarget(current);
    if (blocked) {
      return {
        blocked,
        redirects,
        finalUrl: current.toString()
      };
    }

    const response = await fetch(current, {
      ...currentOptions,
      redirect: "manual"
    });

    const location = response.headers.get("location");
    if (!isRedirectStatus(response.status) || !location) {
      return {
        response,
        redirects,
        finalUrl: current.toString()
      };
    }

    const next = parsePublicUrl(new URL(location, current).toString());
    redirects.push({
      status: response.status,
      from: current.toString(),
      to: next.toString()
    });
    if (next.origin !== current.origin) {
      currentOptions = {
        ...currentOptions,
        headers: stripSensitiveRedirectHeaders(currentOptions.headers)
      };
    }
    current = next;
  }

  throw new Error(`too many redirects; maximum is ${MAX_REDIRECTS}`);
}

function summarizeJsonSearch(data) {
  const items = Array.isArray(data)
    ? data
    : data.results || data.items || (data.webPages && data.webPages.value) || [];

  return items.slice(0, 10).map((item) => ({
    title: safeResearchText(item.title || item.name || item.full_name || "", 300),
    url: item.url || item.html_url || item.link || "",
    snippet: safeResearchText(item.snippet || item.description || item.body || item.text || "", 2000)
  }));
}

function safeResearchText(text, maxLength = 4000) {
  const redacted = redactSecrets(String(text || ""));
  return omitUnsafeVisitorContent(redacted, scanTextRisk(redacted)).slice(0, maxLength);
}

async function fetchUrl(config, input = {}) {
  const parsed = parsePublicUrl(input.url);
  const maxBytes = Math.min(Number.parseInt(input.maxBytes, 10) || config.fetchMaxBytes, config.fetchMaxBytes);
  const urlRisk = [];
  const fetched = await fetchWithPublicRedirects(parsed, {
    redirect: "follow",
    signal: AbortSignal.timeout(config.fetchTimeoutMs),
    headers: {
      "User-Agent": "OrbitAgent/0.1 (+https://github.com)"
    }
  }, async (target) => {
    if (!hostMatches(target.hostname, config.fetchAllowedDomains)) {
      throw new Error(`domain is not in ORBIT_FETCH_ALLOWED_DOMAINS: ${target.hostname}`);
    }

    const targetRisk = scanUrl(target.toString());
    urlRisk.push(...targetRisk);
    const maxRisk = targetRisk.reduce((max, flag) => Math.max(max, flag.severity), 0);
    if (maxRisk >= 80 && !config.allowRiskyFetch) {
      return {
        blocked: true,
        reason: "URL risk is too high for automatic fetch",
        url: target.toString(),
        risk: targetRisk
      };
    }

    await assertPublicDns(target);
    return null;
  });

  if (fetched.blocked) {
    return {
      ...fetched.blocked,
      redirects: fetched.redirects
    };
  }

  const response = fetched.response;
  const contentType = response.headers.get("content-type") || "";
  const { text, truncated } = await readLimitedText(response, maxBytes);
  const redactedBody = redactSecrets(text);
  const textRisk = scanTextRisk(redactedBody);
  const body = omitUnsafeVisitorContent(redactedBody, textRisk);
  return {
    url: fetched.finalUrl,
    status: response.status,
    ok: response.ok,
    contentType,
    truncated,
    redirects: fetched.redirects,
    bytesRead: Buffer.byteLength(body),
    risk: { url: urlRisk, text: textRisk },
    body
  };
}

async function readLimitedText(response, maxBytes) {
  const reader = response.body && typeof response.body.getReader === "function"
    ? response.body.getReader()
    : null;
  if (!reader) {
    const text = await response.text();
    return {
      text: text.slice(0, maxBytes),
      truncated: Buffer.byteLength(text) > maxBytes
    };
  }

  const chunks = [];
  let total = 0;
  let truncated = false;

  while (total < maxBytes) {
    const { done, value } = await reader.read();
    if (done) break;
    const buffer = Buffer.from(value);
    const remaining = maxBytes - total;
    if (buffer.length > remaining) {
      chunks.push(buffer.subarray(0, remaining));
      total += remaining;
      truncated = true;
      break;
    }
    chunks.push(buffer);
    total += buffer.length;
  }

  if (!truncated) {
    const next = await reader.read();
    truncated = !next.done;
  }
  if (truncated && typeof reader.cancel === "function") {
    await reader.cancel();
  }

  return {
    text: Buffer.concat(chunks, total).toString("utf-8"),
    truncated
  };
}

async function webSearch(config, input = {}) {
  const query = String(input.query || "").trim();
  if (!query) throw new Error("query is required");
  if (!config.webSearchEndpoint) {
    return {
      available: false,
      query,
      reason: "ORBIT_WEB_SEARCH_ENDPOINT is not configured"
    };
  }

  const endpoint = config.webSearchEndpoint.includes("{query}")
    ? config.webSearchEndpoint.replace("{query}", encodeURIComponent(query))
    : `${config.webSearchEndpoint}${config.webSearchEndpoint.includes("?") ? "&" : "?"}q=${encodeURIComponent(query)}`;
  const parsedEndpoint = parsePublicUrl(endpoint);
  const fetched = await fetchWithPublicRedirects(parsedEndpoint, {
    signal: AbortSignal.timeout(config.fetchTimeoutMs),
    headers: {
      Accept: "application/json",
      ...(config.webSearchKey ? { Authorization: `Bearer ${config.webSearchKey}` } : {})
    }
  }, async (target) => {
    await assertPublicDns(target);
    return null;
  });

  const response = fetched.response;
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`search provider ${response.status}: ${text.slice(0, 300)}`);
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    const redacted = redactSecrets(text);
    return {
      available: true,
      query,
      raw: omitUnsafeVisitorContent(redacted, scanTextRisk(redacted)).slice(0, 4000)
    };
  }

  return {
    available: true,
    query,
    results: summarizeJsonSearch(parsed)
  };
}

module.exports = {
  fetchUrl,
  hostMatches,
  isPrivateAddress,
  normalizeIpLiteral,
  parsePublicUrl,
  readLimitedText,
  webSearch
};
