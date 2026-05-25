"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const marketSignals = require("../src/agent/market-signals");
const {
  MAX_SIGNAL_FILE_LINES,
  SIGNALS_PATH,
  SIGNAL_KINDS,
  collectAdopterAiSpend,
  collectAllSignals,
  collectIssueReactionIndex,
  collectWethInflow24h,
  readSignals,
  recordSignal,
  summarizeSignals
} = marketSignals;

function makeRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "orbit-market-signals-"));
  fs.mkdirSync(path.join(dir, "memory"), { recursive: true });
  return dir;
}

function readJsonl(repoRoot) {
  const file = path.join(repoRoot, SIGNALS_PATH);
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, "utf-8")
    .split("\n")
    .filter((l) => l.length > 0)
    .map((l) => JSON.parse(l));
}

test("SIGNAL_KINDS contains the three v1 kinds", () => {
  assert.deepEqual(SIGNAL_KINDS.slice().sort(), [
    "adopter_ai_spend_by_bucket",
    "issue_reaction_index",
    "weth_inflow_24h"
  ]);
});

test("recordSignal rejects an unknown kind", () => {
  const repoRoot = makeRepo();
  const result = recordSignal(repoRoot, { kind: "totally_made_up", valueWei: "0" });
  assert.equal(result.ok, false);
  assert.match(result.error, /unknown signal kind/);
  // Nothing should have been written.
  assert.ok(!fs.existsSync(path.join(repoRoot, SIGNALS_PATH)));
});

test("recordSignal defaults ts and appends ONE line of JSON", () => {
  const repoRoot = makeRepo();
  const before = Date.now();
  const out = recordSignal(repoRoot, { kind: "weth_inflow_24h", valueWei: "123" });
  assert.equal(out.ok, true);
  const rows = readJsonl(repoRoot);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].kind, "weth_inflow_24h");
  assert.equal(rows[0].valueWei, "123");
  assert.equal(typeof rows[0].ts, "string");
  const tsMs = Date.parse(rows[0].ts);
  assert.ok(Number.isFinite(tsMs) && tsMs >= before - 5);
  // Append a second record; file must hold 2 rows separated by a single \n.
  recordSignal(repoRoot, { kind: "issue_reaction_index", repos: [] });
  assert.equal(readJsonl(repoRoot).length, 2);
});

test("recordSignal preserves explicit ts", () => {
  const repoRoot = makeRepo();
  recordSignal(repoRoot, {
    kind: "weth_inflow_24h",
    ts: "2026-01-15T00:00:00Z",
    valueWei: "9"
  });
  const rows = readJsonl(repoRoot);
  assert.equal(rows[0].ts, "2026-01-15T00:00:00Z");
});

test("recordSignal rotates when MAX_SIGNAL_FILE_LINES exceeded", () => {
  const repoRoot = makeRepo();
  const file = path.join(repoRoot, SIGNALS_PATH);
  // Pre-seed a file at exactly the cap so the very next record forces rotation.
  let bulk = "";
  for (let i = 0; i < MAX_SIGNAL_FILE_LINES; i += 1) {
    bulk += JSON.stringify({ ts: "2026-01-01T00:00:00Z", kind: "weth_inflow_24h", valueWei: String(i) }) + "\n";
  }
  fs.writeFileSync(file, bulk, "utf-8");
  assert.equal(readJsonl(repoRoot).length, MAX_SIGNAL_FILE_LINES);
  // One more record over the cap should rotate the old file aside and start
  // fresh.
  const out = recordSignal(repoRoot, { kind: "weth_inflow_24h", valueWei: "OVERFLOW" });
  assert.equal(out.ok, true);
  // The current file should have exactly the new record.
  const after = readJsonl(repoRoot);
  assert.equal(after.length, 1);
  assert.equal(after[0].valueWei, "OVERFLOW");
  // And a rotated sibling should exist.
  const siblings = fs.readdirSync(path.join(repoRoot, "memory"))
    .filter((name) => name.startsWith("market-signals.jsonl.") && name.endsWith(".gz"));
  assert.equal(siblings.length, 1);
});

test("readSignals returns [] when the file does not exist", () => {
  const repoRoot = makeRepo();
  assert.deepEqual(readSignals(repoRoot, {}), []);
});

test("readSignals filters by kind", () => {
  const repoRoot = makeRepo();
  recordSignal(repoRoot, { kind: "weth_inflow_24h", valueWei: "1" });
  recordSignal(repoRoot, { kind: "issue_reaction_index", repos: [{ repo: "a/b", score: 1, byLabel: {} }] });
  recordSignal(repoRoot, { kind: "weth_inflow_24h", valueWei: "2" });
  const inflow = readSignals(repoRoot, { kind: "weth_inflow_24h" });
  assert.equal(inflow.length, 2);
  assert.equal(inflow[0].valueWei, "1");
  assert.equal(inflow[1].valueWei, "2");
  const reactions = readSignals(repoRoot, { kind: "issue_reaction_index" });
  assert.equal(reactions.length, 1);
});

test("readSignals filters by since (ISO comparison)", () => {
  const repoRoot = makeRepo();
  recordSignal(repoRoot, { kind: "weth_inflow_24h", ts: "2026-01-01T00:00:00Z", valueWei: "1" });
  recordSignal(repoRoot, { kind: "weth_inflow_24h", ts: "2026-02-01T00:00:00Z", valueWei: "2" });
  recordSignal(repoRoot, { kind: "weth_inflow_24h", ts: "2026-03-01T00:00:00Z", valueWei: "3" });
  const since = readSignals(repoRoot, { since: "2026-02-01T00:00:00Z" });
  assert.equal(since.length, 2);
  assert.equal(since[0].valueWei, "2");
  assert.equal(since[1].valueWei, "3");
});

test("readSignals skips malformed lines without throwing", () => {
  const repoRoot = makeRepo();
  recordSignal(repoRoot, { kind: "weth_inflow_24h", valueWei: "1" });
  // Append a bad line directly to the file.
  fs.appendFileSync(path.join(repoRoot, SIGNALS_PATH), "this is not json\n", "utf-8");
  recordSignal(repoRoot, { kind: "weth_inflow_24h", valueWei: "2" });
  const all = readSignals(repoRoot, {});
  assert.equal(all.length, 2);
  assert.equal(all[0].valueWei, "1");
  assert.equal(all[1].valueWei, "2");
});

test("readSignals respects limit", () => {
  const repoRoot = makeRepo();
  for (let i = 0; i < 5; i += 1) {
    recordSignal(repoRoot, { kind: "weth_inflow_24h", valueWei: String(i) });
  }
  const capped = readSignals(repoRoot, { limit: 2 });
  assert.equal(capped.length, 2);
});

test("summarizeSignals for weth_inflow_24h sums totalWei", () => {
  const repoRoot = makeRepo();
  recordSignal(repoRoot, { kind: "weth_inflow_24h", valueWei: "1000000000000000000" });
  recordSignal(repoRoot, { kind: "weth_inflow_24h", valueWei: "2000000000000000000" });
  const summary = summarizeSignals(repoRoot, { kind: "weth_inflow_24h" });
  assert.equal(summary.samples, 2);
  assert.equal(summary.totalWei, "3000000000000000000");
  assert.equal(summary.latest.valueWei, "2000000000000000000");
});

test("summarizeSignals for adopter_ai_spend_by_bucket counts distinct adopters", () => {
  const repoRoot = makeRepo();
  recordSignal(repoRoot, {
    kind: "adopter_ai_spend_by_bucket",
    adopters: [
      { fid: "a-1", repo: "a/r1", byBucket: { code: "1.0", research: "0.5" } },
      { fid: "a-2", repo: "a/r2", byBucket: { code: "0.3" } }
    ]
  });
  recordSignal(repoRoot, {
    kind: "adopter_ai_spend_by_bucket",
    adopters: [
      { fid: "a-1", repo: "a/r1", byBucket: { code: "2.0" } }
    ]
  });
  const summary = summarizeSignals(repoRoot, { kind: "adopter_ai_spend_by_bucket" });
  assert.equal(summary.adopterCount, 2);
  assert.ok(summary.byBucket.code > 0);
});

test("summarizeSignals for issue_reaction_index aggregates repos and totals", () => {
  const repoRoot = makeRepo();
  recordSignal(repoRoot, {
    kind: "issue_reaction_index",
    repos: [
      { repo: "x/a", score: 7, byLabel: { wanted: 2 } },
      { repo: "x/b", score: 3, byLabel: { bug: 3 } }
    ]
  });
  recordSignal(repoRoot, {
    kind: "issue_reaction_index",
    repos: [
      { repo: "x/a", score: 4, byLabel: {} }
    ]
  });
  const summary = summarizeSignals(repoRoot, { kind: "issue_reaction_index" });
  assert.equal(summary.repoCount, 2);
  assert.equal(summary.totalReactions, 14);
});

test("collectWethInflow24h returns null when state is missing", async () => {
  const out = await collectWethInflow24h({}, {}, null);
  assert.equal(out, null);
});

test("collectWethInflow24h computes a non-negative delta from state", async () => {
  const state = {
    treasurySweep: { lastObservedFeeReceiveBalanceWei: "300000000000000000" }, // 0.3
    feeFloor: { weekStartBalanceWei: "100000000000000000", weekStartedAt: "2026-05-20T00:00:00Z" }
  };
  const sig = await collectWethInflow24h({}, { ORBIT_TREASURY_SAFE: "0xfee" }, state);
  assert.ok(sig);
  assert.equal(sig.kind, "weth_inflow_24h");
  assert.equal(sig.valueWei, "200000000000000000");
  assert.equal(sig.fromTs, "2026-05-20T00:00:00Z");
  assert.deepEqual(sig.safes, ["0xfee"]);
});

test("collectWethInflow24h clamps a negative delta to zero", async () => {
  // Mid-week sweep drove the balance below the week-start snapshot.
  const state = {
    treasurySweep: { lastObservedFeeReceiveBalanceWei: "50000000000000000" },
    feeFloor: { weekStartBalanceWei: "100000000000000000" }
  };
  const sig = await collectWethInflow24h({}, {}, state);
  assert.ok(sig);
  assert.equal(sig.valueWei, "0");
});

test("collectAdopterAiSpend returns null with no adopters", async () => {
  const out = await collectAdopterAiSpend({}, { adoptersState: { adopters: [] }, fetchJson: async () => ({}) });
  assert.equal(out, null);
});

test("collectAdopterAiSpend skips an adopter whose dashboard fetch fails", async () => {
  const adoptersState = {
    adopters: [
      { repo: "good/repo", status: "verified", publicUrl: "https://good.example.com/" },
      { repo: "bad/repo", status: "verified", publicUrl: "https://bad.example.com/" }
    ]
  };
  const fetchJson = async (url) => {
    if (url.includes("bad.example.com")) throw new Error("simulated network failure");
    return { aiSpend: { byBucket: { code: "1.0", ops: "0.2" } } };
  };
  const sig = await collectAdopterAiSpend({}, { adoptersState, fetchJson });
  assert.ok(sig);
  assert.equal(sig.adopters.length, 1);
  assert.equal(sig.adopters[0].repo, "good/repo");
  assert.equal(sig.adopters[0].byBucket.code, "1.0");
});

test("collectAdopterAiSpend ignores adopters without recognized AI-spend shape", async () => {
  const adoptersState = {
    adopters: [
      { repo: "x/a", status: "verified", publicUrl: "https://x.example.com/" }
    ]
  };
  const fetchJson = async () => ({ lifecycle: { cycle: 7 } }); // no buckets
  const sig = await collectAdopterAiSpend({}, { adoptersState, fetchJson });
  assert.equal(sig, null);
});

test("collectIssueReactionIndex aggregates across mothership + adopter repos", async () => {
  const calls = [];
  const githubStub = {
    fetchIssueReactions: async (owner, repo) => {
      calls.push(`${owner}/${repo}`);
      if (repo === "mother") {
        return {
          ok: true,
          issues: [
            { number: 1, labels: ["wanted"], reactions: { total: 5, byEmoji: {} } },
            { number: 2, labels: ["bug"],    reactions: { total: 2, byEmoji: {} } }
          ]
        };
      }
      if (repo === "adopt") {
        return {
          ok: true,
          issues: [
            { number: 1, labels: ["enhancement"], reactions: { total: 3, byEmoji: {} } }
          ]
        };
      }
      return { ok: false, error: "404" };
    }
  };
  const adoptersState = {
    adopters: [
      { repo: "fam/adopt", status: "verified", publicUrl: "https://x.test/" }
    ]
  };
  const sig = await collectIssueReactionIndex(
    { repoOwner: "org", repoName: "mother" },
    { github: githubStub, adoptersState }
  );
  assert.ok(sig);
  assert.equal(sig.kind, "issue_reaction_index");
  assert.equal(sig.repos.length, 2);
  const mother = sig.repos.find((r) => r.repo === "org/mother");
  // wanted=3 * 5 + bug=1 * 2 = 17
  assert.equal(mother.score, 17);
  const adopt = sig.repos.find((r) => r.repo === "fam/adopt");
  // enhancement=2 * 3 = 6
  assert.equal(adopt.score, 6);
});

test("collectIssueReactionIndex tolerates per-repo fetch failure", async () => {
  const githubStub = {
    fetchIssueReactions: async (owner, repo) => {
      if (repo === "mother") return { ok: true, issues: [
        { number: 1, labels: [], reactions: { total: 4, byEmoji: {} } }
      ] };
      throw new Error("rate limit");
    }
  };
  const adoptersState = {
    adopters: [
      { repo: "fam/adopt", status: "verified", publicUrl: "https://x.test/" }
    ]
  };
  const sig = await collectIssueReactionIndex(
    { repoOwner: "org", repoName: "mother" },
    { github: githubStub, adoptersState }
  );
  assert.ok(sig);
  // Only the mothership comes back; the adopter throw is swallowed.
  assert.equal(sig.repos.length, 1);
  assert.equal(sig.repos[0].repo, "org/mother");
});

test("collectAllSignals records every successful collector and never throws on partial failure", async () => {
  const repoRoot = makeRepo();
  const config = {
    repoRoot,
    repoOwner: "org",
    repoName: "mother"
  };
  const state = {
    treasurySweep: { lastObservedFeeReceiveBalanceWei: "200000000000000000" },
    feeFloor: { weekStartBalanceWei: "100000000000000000" }
  };
  const githubStub = {
    fetchIssueReactions: async () => ({
      ok: true,
      issues: [{ number: 1, labels: ["wanted"], reactions: { total: 1, byEmoji: {} } }]
    })
  };
  const adoptersState = {
    adopters: [
      { repo: "fam/x", status: "verified", publicUrl: "https://x.test/" }
    ]
  };
  // adopter fetchJson always fails — that collector returns null, but the
  // other two should still succeed.
  const fetchJson = async () => { throw new Error("offline"); };
  const result = await collectAllSignals(config, {}, state, githubStub, { adoptersState, fetchJson });
  assert.equal(result.attempted, 3);
  assert.equal(result.collected, 2);
  const rows = readJsonl(repoRoot);
  assert.equal(rows.length, 2);
  const kinds = rows.map((r) => r.kind).sort();
  assert.deepEqual(kinds, ["issue_reaction_index", "weth_inflow_24h"]);
});

test("collectAllSignals does not throw when every collector returns null", async () => {
  const repoRoot = makeRepo();
  const config = { repoRoot, repoOwner: "org", repoName: "mother" };
  // No state -> weth collector null. No adopters -> adopter collector null.
  // GitHub stub that returns ok with zero issues for the mothership -> reaction
  // collector still returns a record (score 0). To prove "no throw on all-null"
  // we omit the github handle entirely.
  const result = await collectAllSignals(config, {}, null, null, {});
  assert.equal(result.attempted, 3);
  assert.equal(result.collected, 0);
  assert.ok(!fs.existsSync(path.join(repoRoot, SIGNALS_PATH)));
});

test("collectAllSignals swallows a thrown collector (Promise.allSettled fan-out)", async () => {
  const repoRoot = makeRepo();
  const config = { repoRoot, repoOwner: "org", repoName: "mother" };
  // Force the reactions collector to throw deep inside the github stub.
  const exploder = {
    fetchIssueReactions: async () => { throw new Error("boom"); }
  };
  const state = {
    treasurySweep: { lastObservedFeeReceiveBalanceWei: "200000000000000000" },
    feeFloor: { weekStartBalanceWei: "100000000000000000" }
  };
  const result = await collectAllSignals(config, {}, state, exploder, { adoptersState: null, fetchJson: null });
  // weth_inflow_24h still records; the other two are null/failed.
  assert.equal(result.attempted, 3);
  assert.equal(result.collected, 1);
  const rows = readJsonl(repoRoot);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].kind, "weth_inflow_24h");
});
