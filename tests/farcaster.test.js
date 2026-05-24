"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const {
  CAST_BYTE_LIMIT,
  LEDGER_PATH,
  NEYNAR_CAST_URL,
  castIdempotencyKey,
  loadCastLedger,
  pickTemplate,
  postCycleCast,
  publishCast,
  recordCastReceipt,
  renderCast,
  saveCastLedger,
  scanOutbound,
  summarizeCycleForCast
} = require("../src/agent/farcaster");

function mkRepo() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "orbit-farcaster-"));
}

function baseSummary(overrides = {}) {
  return Object.assign(
    {
      cycle: 27,
      finishedAt: "2026-05-24T00:01:00.000Z",
      triggerLabel: "schedule",
      receiptUrl: "https://orbit.horse/receipts/27",
      fallbackReceiptUrl: "",
      bullets: ["replied to issue #4", "logged knowledge: hello"],
      aiUsdLabel: "$0.04",
      refusedCount: 0,
      pendingCount: 0,
      approvalIssueUrl: null,
      mistakeAcknowledgment: null,
      buybackTxHash: null,
      notableStat: null,
      refusal: null
    },
    overrides
  );
}

function installFetchMock(impl) {
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    return impl(url, init, calls.length);
  };
  return {
    calls,
    restore() {
      globalThis.fetch = original;
    }
  };
}

function jsonResponse(status, body) {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => body
  };
}

test("pickTemplate honors priority ordering", () => {
  assert.equal(
    pickTemplate(baseSummary({ mistakeAcknowledgment: "issue #1" })).kind,
    "mistake"
  );
  assert.equal(
    pickTemplate(baseSummary({ buybackTxHash: "0xabc" })).kind,
    "buyback"
  );
  assert.equal(pickTemplate(baseSummary({ cycle: 100 })).kind, "milestone");
  assert.equal(
    pickTemplate(baseSummary({ notableStat: "first signed cycle" })).kind,
    "milestone"
  );
  assert.equal(
    pickTemplate(
      baseSummary({ approvalIssueUrl: "https://github.com/x/y/issues/3" })
    ).kind,
    "approval-pending"
  );
  assert.equal(
    pickTemplate(
      baseSummary({
        refusal: { oneLineSummary: "blocked", category: "scam" }
      })
    ).kind,
    "refusal"
  );
  assert.equal(pickTemplate(baseSummary()).kind, "routine");
  assert.equal(
    pickTemplate(
      baseSummary({
        cycle: 100,
        mistakeAcknowledgment: "earlier comment",
        approvalIssueUrl: "https://github.com/x/y/issues/3"
      })
    ).kind,
    "mistake"
  );
});

test("renderCast routine stays within 320 bytes and truncates bullets", () => {
  const summary = baseSummary({
    bullets: [
      "logged knowledge: " + "x".repeat(120),
      "logged knowledge: " + "y".repeat(120),
      "logged knowledge: " + "z".repeat(120)
    ]
  });
  const template = pickTemplate(summary);
  const a = renderCast(template, template.data, {
    receiptUrl: summary.receiptUrl
  });
  const b = renderCast(template, template.data, {
    receiptUrl: summary.receiptUrl
  });
  assert.ok(Buffer.byteLength(a.text, "utf8") <= CAST_BYTE_LIMIT);
  assert.equal(a.text, b.text);
  assert.equal(a.text, a.text.toLowerCase());
  assert.ok(a.text.includes("receipt: https://orbit.horse/receipts/27"));
});

test("renderCast emits at most 2 allowlisted embeds", () => {
  const summary = baseSummary({
    fallbackReceiptUrl: "https://github.com/owner/repo/blob/main/runtime/proofs/x.json"
  });
  const template = pickTemplate(summary);
  const { embeds } = renderCast(template, template.data, {
    receiptUrl: summary.receiptUrl
  });
  assert.equal(embeds.length, 2);
  assert.equal(embeds[0].url, summary.receiptUrl);
  assert.ok(embeds[1].url.startsWith("https://github.com/"));
});

test("scanOutbound refuses secrets, scam, non-treasury addresses; accepts clean cast", () => {
  const safe = scanOutbound("cycle #27 · schedule\n\nreceipt: https://orbit.horse/receipts/27");
  assert.equal(safe.safe, true);

  const secret = scanOutbound(
    "token leak ghp_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA here"
  );
  assert.equal(secret.safe, false);
  assert.ok(["secret_pattern", "unsafe_public_reply"].includes(secret.reason));

  const promise = scanOutbound(
    "we will transfer 1 ETH to 0x1111111111111111111111111111111111111111"
  );
  assert.equal(promise.safe, false);

  const stranger = scanOutbound(
    "see address 0x1234567890abcdef1234567890abcdef12345678",
    { treasuryAddress: "0xAAAAaaaaAAaaaaAaaaAAAaaaAaAaAAaAAaAAAaAa" }
  );
  assert.equal(stranger.safe, false);
  assert.equal(stranger.reason, "evm_address");

  const treasury = scanOutbound(
    "treasury at 0xAAAAaaaaAAaaaaAaaaAAAaaaAaAaAAaAAaAAAaAa",
    { treasuryAddress: "0xAAAAaaaaAAaaaaAaaaAAAaaaAaAaAAaAAaAAAaAa" }
  );
  assert.equal(treasury.safe, true);

  const huge = "x".repeat(CAST_BYTE_LIMIT + 5);
  const overflow = scanOutbound(huge);
  assert.equal(overflow.safe, false);
  assert.equal(overflow.reason, "too_long");
});

test("castIdempotencyKey is stable per (cycle, finishedAt) and 32 hex chars", () => {
  const a = castIdempotencyKey(27, "2026-05-24T00:01:00.000Z");
  const b = castIdempotencyKey(27, "2026-05-24T00:01:00.000Z");
  const c = castIdempotencyKey(27, "2026-05-24T00:02:00.000Z");
  const d = castIdempotencyKey(28, "2026-05-24T00:01:00.000Z");
  assert.equal(a, b);
  assert.notEqual(a, c);
  assert.notEqual(a, d);
  assert.match(a, /^[0-9a-f]{32}$/);
});

test("publishCast respects dryRun and never invokes fetch", async () => {
  const mock = installFetchMock(() => {
    throw new Error("should not fetch in dry run");
  });
  try {
    const result = await publishCast(
      { farcaster: { dryRun: true, apiKey: "k", signerUuid: "s" } },
      { text: "hello", embeds: [], idem: "x" }
    );
    assert.equal(result.ok, true);
    assert.equal(result.dryRun, true);
    assert.equal(result.hash, null);
    assert.equal(mock.calls.length, 0);
  } finally {
    mock.restore();
  }
});

test("publishCast returns not_configured when api key or signer missing", async () => {
  const mock = installFetchMock(() => {
    throw new Error("should not fetch");
  });
  try {
    const result = await publishCast(
      { farcaster: { dryRun: false, apiKey: "", signerUuid: "" } },
      { text: "hi", embeds: [], idem: "x" }
    );
    assert.equal(result.ok, false);
    assert.equal(result.error, "not_configured");
    assert.equal(mock.calls.length, 0);
  } finally {
    mock.restore();
  }
});

test("publishCast 200 posts to neynar with expected headers and body", async () => {
  const mock = installFetchMock((url, init) => {
    assert.equal(url, NEYNAR_CAST_URL);
    assert.equal(init.method, "POST");
    assert.equal(init.headers["Content-Type"], "application/json");
    assert.equal(init.headers["x-api-key"], "api-key-abc");
    const parsed = JSON.parse(init.body);
    assert.equal(parsed.signer_uuid, "signer-123");
    assert.equal(parsed.idem, "idem-xyz");
    assert.equal(parsed.text, "hello world");
    return jsonResponse(200, { cast: { hash: "0xfeed" } });
  });
  try {
    const result = await publishCast(
      {
        farcaster: { dryRun: false, apiKey: "api-key-abc", signerUuid: "signer-123" }
      },
      { text: "hello world", embeds: [], idem: "idem-xyz" }
    );
    assert.equal(result.ok, true);
    assert.equal(result.hash, "0xfeed");
    assert.equal(mock.calls.length, 1);
  } finally {
    mock.restore();
  }
});

test("publishCast 429 returns rate_limit and does not retry", async () => {
  const mock = installFetchMock(() => jsonResponse(429, { error: "rate" }));
  try {
    const result = await publishCast(
      { farcaster: { dryRun: false, apiKey: "k", signerUuid: "s" } },
      { text: "hi", embeds: [], idem: "i" }
    );
    assert.equal(result.ok, false);
    assert.equal(result.error, "rate_limit");
    assert.equal(result.status, 429);
    assert.equal(mock.calls.length, 1);
  } finally {
    mock.restore();
  }
});

test("publishCast retries once on 5xx and returns success on second attempt", async () => {
  const mock = installFetchMock((_url, _init, attempt) => {
    if (attempt === 1) return jsonResponse(502, { error: "bad gateway" });
    return jsonResponse(200, { cast: { hash: "0xdead" } });
  });
  try {
    const result = await publishCast(
      { farcaster: { dryRun: false, apiKey: "k", signerUuid: "s" } },
      { text: "hi", embeds: [], idem: "i" }
    );
    assert.equal(result.ok, true);
    assert.equal(result.hash, "0xdead");
    assert.equal(mock.calls.length, 2);
  } finally {
    mock.restore();
  }
});

test("postCycleCast short-circuits when ledger contains a matching prior cast", async () => {
  const repoRoot = mkRepo();
  const summary = baseSummary();
  const idem = castIdempotencyKey(summary.cycle, summary.finishedAt);
  saveCastLedger(repoRoot, {
    casts: [
      {
        cycle: summary.cycle,
        idem,
        hash: "0xpriorcast",
        castedAt: "2026-05-24T00:00:00.000Z",
        kind: "routine",
        dryRun: false
      }
    ]
  });
  const mock = installFetchMock(() => {
    throw new Error("should not fetch on idempotent short-circuit");
  });
  try {
    const result = await postCycleCast(
      {
        repoRoot,
        farcaster: { dryRun: false, apiKey: "k", signerUuid: "s" }
      },
      summary,
      { cycle: summary.cycle, finishedAt: summary.finishedAt }
    );
    assert.equal(result.ok, true);
    assert.equal(result.idempotent, true);
    assert.equal(result.hash, "0xpriorcast");
    assert.equal(mock.calls.length, 0);
  } finally {
    mock.restore();
    fs.rmSync(repoRoot, { recursive: true, force: true });
  }
});

test("postCycleCast in dry-run writes ledger entry and reports dryRun true", async () => {
  const repoRoot = mkRepo();
  const summary = baseSummary({ cycle: 31, finishedAt: "2026-05-24T00:10:00.000Z" });
  const mock = installFetchMock(() => {
    throw new Error("should not fetch in dry run");
  });
  try {
    const result = await postCycleCast(
      { repoRoot, farcaster: { dryRun: true } },
      summary,
      { cycle: summary.cycle }
    );
    assert.equal(result.ok, true);
    assert.equal(result.dryRun, true);
    assert.equal(result.kind, "routine");
    assert.equal(result.ledgerPath, LEDGER_PATH);
    const ledger = loadCastLedger(repoRoot);
    assert.equal(ledger.casts.length, 1);
    assert.equal(ledger.casts[0].cycle, 31);
    assert.equal(ledger.casts[0].dryRun, true);
    assert.equal(mock.calls.length, 0);
  } finally {
    mock.restore();
    fs.rmSync(repoRoot, { recursive: true, force: true });
  }
});

test("summarizeCycleForCast extracts required fields from a proof", () => {
  const proof = {
    cycle: 27,
    finishedAt: "2026-05-24T00:01:00.000Z",
    trigger: { type: "schedule", id: "regular_heartbeat" },
    steps: [
      {
        step: 1,
        accounting: "ai_usage",
        estimatedUsd: 0.012
      },
      {
        step: 2,
        tool: "comment_issue",
        input: { issueNumber: 4, body: "hi" }
      },
      {
        step: 3,
        tool: "append_memory",
        input: { title: "what we learned today" }
      },
      {
        step: 4,
        tool: "propose_spend",
        input: { amount: 1 }
      }
    ]
  };
  const summary = summarizeCycleForCast(
    proof,
    { proofPath: "runtime/proofs/2026-05-24/cycle-27.json", repoSlug: "owner/repo" },
    { publicBaseUrl: "https://orbit.horse" }
  );
  assert.equal(summary.cycle, 27);
  assert.equal(summary.finishedAt, "2026-05-24T00:01:00.000Z");
  assert.equal(summary.triggerLabel, "schedule");
  assert.equal(summary.receiptUrl, "https://orbit.horse/receipts/27");
  assert.equal(summary.aiUsdLabel, "$0.01");
  assert.equal(summary.refusedCount, 0);
  assert.equal(summary.pendingCount, 0);
  assert.deepEqual(summary.bullets, [
    "replied to issue #4",
    "logged knowledge: what we learned today",
    "proposed spend, gated"
  ]);
  assert.ok(summary.fallbackReceiptUrl.includes("owner/repo"));
});

test("recordCastReceipt sets proof.cast", () => {
  const proof = { cycle: 27 };
  const cast = { ok: true, kind: "routine", hash: "0xabc" };
  recordCastReceipt(proof, cast);
  assert.deepEqual(proof.cast, cast);
});
