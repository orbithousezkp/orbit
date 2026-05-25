"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  DEFAULT_LOOKBACK_DAYS,
  DEFAULT_MIN_COMMITS_PER_MAINTAINER,
  DEFAULT_MIN_MAINTAINERS,
  assertBusFactorMet,
  countUniqueAuthors,
  evaluateBusFactor,
  loadConfig,
  summarizeBusFactor
} = require("../src/agent/bus-factor");

const NOW = Date.parse("2026-05-25T12:00:00Z");
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function daysAgo(d) {
  return new Date(NOW - d * MS_PER_DAY).toISOString();
}

test("loadConfig: defaults when env empty", () => {
  const cfg = loadConfig({});
  assert.equal(cfg.minMaintainers, DEFAULT_MIN_MAINTAINERS);
  assert.equal(cfg.lookbackDays, DEFAULT_LOOKBACK_DAYS);
  assert.equal(cfg.minCommitsPerMaintainer, DEFAULT_MIN_COMMITS_PER_MAINTAINER);
});

test("loadConfig: env overrides applied", () => {
  const cfg = loadConfig({
    ORBIT_BUS_FACTOR_MIN_MAINTAINERS: "5",
    ORBIT_BUS_FACTOR_LOOKBACK_DAYS: "30",
    ORBIT_BUS_FACTOR_MIN_COMMITS: "10"
  });
  assert.equal(cfg.minMaintainers, 5);
  assert.equal(cfg.lookbackDays, 30);
  assert.equal(cfg.minCommitsPerMaintainer, 10);
});

test("loadConfig: throws on invalid minMaintainers (0)", () => {
  assert.throws(
    () => loadConfig({ ORBIT_BUS_FACTOR_MIN_MAINTAINERS: "0" }),
    /minMaintainers/
  );
});

test("loadConfig: throws on invalid lookbackDays (5)", () => {
  assert.throws(
    () => loadConfig({ ORBIT_BUS_FACTOR_LOOKBACK_DAYS: "5" }),
    /lookbackDays/
  );
});

test("loadConfig: throws on invalid minCommitsPerMaintainer (0)", () => {
  assert.throws(
    () => loadConfig({ ORBIT_BUS_FACTOR_MIN_COMMITS: "0" }),
    /minCommitsPerMaintainer/
  );
});

test("loadConfig: throws on non-integer", () => {
  assert.throws(
    () => loadConfig({ ORBIT_BUS_FACTOR_MIN_MAINTAINERS: "abc" }),
    /must be an integer/
  );
});

test("loadConfig: throws on out-of-range upper bound", () => {
  assert.throws(
    () => loadConfig({ ORBIT_BUS_FACTOR_MIN_MAINTAINERS: "100" }),
    /minMaintainers/
  );
});

test("countUniqueAuthors: empty commits returns 0", () => {
  const r = countUniqueAuthors([], { lookbackDays: 90, now: NOW });
  assert.equal(r.uniqueAuthors, 0);
  assert.deepEqual(r.authorDetails, []);
  assert.ok(r.windowStart);
  assert.ok(r.windowEnd);
});

test("countUniqueAuthors: 3 commits from 1 author (above minCommits=3) -> 1", () => {
  const commits = [
    { author: { email: "alice@example.com" }, authoredDate: daysAgo(1), sha: "a1" },
    { author: { email: "alice@example.com" }, authoredDate: daysAgo(2), sha: "a2" },
    { author: { email: "alice@example.com" }, authoredDate: daysAgo(3), sha: "a3" }
  ];
  const r = countUniqueAuthors(commits, {
    lookbackDays: 90,
    now: NOW,
    minCommitsPerAuthor: 3
  });
  assert.equal(r.uniqueAuthors, 1);
  assert.equal(r.authorDetails[0].commitCount, 3);
  assert.equal(r.authorDetails[0].key, "alice@example.com");
});

test("countUniqueAuthors: 3 commits from 3 authors (each 1, below minCommits=3) -> 0", () => {
  const commits = [
    { author: { email: "alice@example.com" }, authoredDate: daysAgo(1), sha: "a" },
    { author: { email: "bob@example.com" }, authoredDate: daysAgo(2), sha: "b" },
    { author: { email: "carol@example.com" }, authoredDate: daysAgo(3), sha: "c" }
  ];
  const r = countUniqueAuthors(commits, {
    lookbackDays: 90,
    now: NOW,
    minCommitsPerAuthor: 3
  });
  assert.equal(r.uniqueAuthors, 0);
});

test("countUniqueAuthors: commits outside window excluded", () => {
  const commits = [
    // 200 days ago — outside a 90-day window.
    { author: { email: "alice@example.com" }, authoredDate: daysAgo(200), sha: "old1" },
    { author: { email: "alice@example.com" }, authoredDate: daysAgo(201), sha: "old2" },
    { author: { email: "alice@example.com" }, authoredDate: daysAgo(202), sha: "old3" },
    // Inside window.
    { author: { email: "bob@example.com" }, authoredDate: daysAgo(5), sha: "n1" }
  ];
  const r = countUniqueAuthors(commits, {
    lookbackDays: 90,
    now: NOW,
    minCommitsPerAuthor: 1
  });
  assert.equal(r.uniqueAuthors, 1);
  assert.equal(r.authorDetails[0].key, "bob@example.com");
});

test("countUniqueAuthors: email case normalized, login & name fallback", () => {
  const commits = [
    // Same email, different case -> dedupe to one author.
    { author: { email: "Alice@Example.com" }, authoredDate: daysAgo(1), sha: "a1" },
    { author: { email: "alice@example.com" }, authoredDate: daysAgo(2), sha: "a2" },
    // No email, has login.
    { author: { login: "bob-login" }, authoredDate: daysAgo(3), sha: "b1" },
    // No email, no login, has name.
    { author: { name: "Carol Q" }, authoredDate: daysAgo(4), sha: "c1" }
  ];
  const r = countUniqueAuthors(commits, {
    lookbackDays: 90,
    now: NOW,
    minCommitsPerAuthor: 1
  });
  assert.equal(r.uniqueAuthors, 3);
  const keys = r.authorDetails.map((a) => a.key).sort();
  assert.deepEqual(keys, ["alice@example.com", "bob-login", "carol q"]);
});

test("countUniqueAuthors: malformed commits skipped, not thrown", () => {
  const commits = [
    null,
    "not-an-object",
    { author: null, authoredDate: daysAgo(1) },
    { author: { email: "" }, authoredDate: daysAgo(1) },
    { author: { email: "ok@example.com" }, authoredDate: "not-a-date" },
    { author: { email: "ok@example.com" } },
    { author: { email: "ok@example.com" }, authoredDate: daysAgo(2), sha: "z" }
  ];
  const r = countUniqueAuthors(commits, {
    lookbackDays: 90,
    now: NOW,
    minCommitsPerAuthor: 1
  });
  assert.equal(r.uniqueAuthors, 1);
});

test("evaluateBusFactor: 3 commit authors + 0 adopters -> busFactor 3, ok with default min", () => {
  const commits = [];
  for (const name of ["alice", "bob", "carol"]) {
    for (let i = 0; i < 3; i++) {
      commits.push({
        author: { email: name + "@example.com" },
        authoredDate: daysAgo(i + 1),
        sha: name + i
      });
    }
  }
  const r = evaluateBusFactor(commits, [], {}, { now: NOW });
  assert.equal(r.busFactor, 3);
  assert.equal(r.minRequired, 3);
  assert.equal(r.ok, true);
  assert.equal(r.commitAuthors.uniqueAuthors, 3);
  assert.equal(r.adopters.uniqueCount, 0);
  assert.equal(r.reason, undefined);
});

test("evaluateBusFactor: 1 commit author + 2 active adopters -> busFactor 3", () => {
  const commits = [
    { author: { email: "alice@example.com" }, authoredDate: daysAgo(1), sha: "x1" },
    { author: { email: "alice@example.com" }, authoredDate: daysAgo(2), sha: "x2" },
    { author: { email: "alice@example.com" }, authoredDate: daysAgo(3), sha: "x3" }
  ];
  const adopters = [
    { repo: "bob/orbit", lastActiveAt: daysAgo(2), missionsExecuted: 5 },
    { repo: "carol/orbit", lastActiveAt: daysAgo(10), missionsExecuted: 2 }
  ];
  const r = evaluateBusFactor(commits, adopters, {}, { now: NOW });
  assert.equal(r.commitAuthors.uniqueAuthors, 1);
  assert.equal(r.adopters.uniqueCount, 2);
  assert.equal(r.busFactor, 3);
  assert.equal(r.ok, true);
});

test("evaluateBusFactor: stale adopter (outside window) excluded -> busFactor 2, fail", () => {
  const commits = [
    { author: { email: "alice@example.com" }, authoredDate: daysAgo(1), sha: "x1" },
    { author: { email: "alice@example.com" }, authoredDate: daysAgo(2), sha: "x2" },
    { author: { email: "alice@example.com" }, authoredDate: daysAgo(3), sha: "x3" }
  ];
  const adopters = [
    { repo: "bob/orbit", lastActiveAt: daysAgo(2), missionsExecuted: 5 },
    // 200 days ago is well outside the 90-day default.
    { repo: "carol/orbit", lastActiveAt: daysAgo(200), missionsExecuted: 99 }
  ];
  const r = evaluateBusFactor(commits, adopters, {}, { now: NOW });
  assert.equal(r.commitAuthors.uniqueAuthors, 1);
  assert.equal(r.adopters.uniqueCount, 1);
  assert.equal(r.busFactor, 2);
  assert.equal(r.ok, false);
  assert.equal(r.reason, "too_few_maintainers");
});

test("evaluateBusFactor: adopter with missionsExecuted=0 doesn't count", () => {
  const commits = [
    { author: { email: "alice@example.com" }, authoredDate: daysAgo(1), sha: "x1" },
    { author: { email: "alice@example.com" }, authoredDate: daysAgo(2), sha: "x2" },
    { author: { email: "alice@example.com" }, authoredDate: daysAgo(3), sha: "x3" }
  ];
  const adopters = [
    { repo: "bob/orbit", lastActiveAt: daysAgo(2), missionsExecuted: 0 },
    { repo: "carol/orbit", lastActiveAt: daysAgo(3), missionsExecuted: 4 }
  ];
  const r = evaluateBusFactor(commits, adopters, {}, { now: NOW });
  assert.equal(r.adopters.uniqueCount, 1);
  assert.equal(r.busFactor, 2);
  assert.equal(r.ok, false);
});

test("evaluateBusFactor: malformed adopter entries dropped silently", () => {
  const commits = [
    { author: { email: "alice@example.com" }, authoredDate: daysAgo(1), sha: "x1" },
    { author: { email: "alice@example.com" }, authoredDate: daysAgo(2), sha: "x2" },
    { author: { email: "alice@example.com" }, authoredDate: daysAgo(3), sha: "x3" }
  ];
  const adopters = [
    null,
    {},
    { repo: "", lastActiveAt: daysAgo(1), missionsExecuted: 5 },
    { repo: "bob/orbit", lastActiveAt: "not-a-date", missionsExecuted: 5 },
    { repo: "carol/orbit", lastActiveAt: daysAgo(2), missionsExecuted: 3 }
  ];
  const r = evaluateBusFactor(commits, adopters, {}, { now: NOW });
  assert.equal(r.adopters.uniqueCount, 1);
});

test("assertBusFactorMet: throws BUS_FACTOR_NOT_MET on fail", () => {
  const commits = [
    { author: { email: "alice@example.com" }, authoredDate: daysAgo(1), sha: "x1" },
    { author: { email: "alice@example.com" }, authoredDate: daysAgo(2), sha: "x2" },
    { author: { email: "alice@example.com" }, authoredDate: daysAgo(3), sha: "x3" }
  ];
  let caught = null;
  try {
    assertBusFactorMet(commits, [], {}, { now: NOW });
  } catch (err) {
    caught = err;
  }
  assert.ok(caught, "expected an error to be thrown");
  assert.equal(caught.code, "BUS_FACTOR_NOT_MET");
  assert.ok(caught.details);
  assert.equal(caught.details.ok, false);
  assert.equal(caught.details.busFactor, 1);
  assert.match(caught.message, /bus-factor/);
});

test("assertBusFactorMet: returns evaluation on success", () => {
  const commits = [];
  for (const name of ["alice", "bob", "carol"]) {
    for (let i = 0; i < 3; i++) {
      commits.push({
        author: { email: name + "@example.com" },
        authoredDate: daysAgo(i + 1),
        sha: name + i
      });
    }
  }
  const r = assertBusFactorMet(commits, [], {}, { now: NOW });
  assert.equal(r.ok, true);
  assert.equal(r.busFactor, 3);
});

test("summarizeBusFactor: critical when busFactor < minRequired", () => {
  const s = summarizeBusFactor([], [], {}, { now: NOW });
  assert.equal(s.ok, false);
  assert.equal(s.busFactor, 0);
  assert.equal(s.minRequired, 3);
  assert.equal(s.recommendation, "critical");
  assert.equal(s.commitAuthorCount, 0);
  assert.equal(s.adopterImplementationCount, 0);
  assert.deepEqual(s.topContributors, []);
});

test("summarizeBusFactor: fragile when busFactor === minRequired", () => {
  const commits = [];
  for (const name of ["alice", "bob", "carol"]) {
    for (let i = 0; i < 3; i++) {
      commits.push({
        author: { email: name + "@example.com" },
        authoredDate: daysAgo(i + 1),
        sha: name + i
      });
    }
  }
  const s = summarizeBusFactor(commits, [], {}, { now: NOW });
  assert.equal(s.ok, true);
  assert.equal(s.recommendation, "fragile");
  assert.equal(s.busFactor, 3);
});

test("summarizeBusFactor: ok when busFactor > minRequired, topContributors sorted desc", () => {
  const commits = [];
  // alice: 5 commits, bob: 4, carol: 3, dave: 3, eve: 3, frank: 3 -> 6 authors total
  const counts = { alice: 5, bob: 4, carol: 3, dave: 3, eve: 3, frank: 3 };
  for (const [name, count] of Object.entries(counts)) {
    for (let i = 0; i < count; i++) {
      commits.push({
        author: { email: name + "@example.com" },
        authoredDate: daysAgo(i + 1),
        sha: name + i
      });
    }
  }
  const s = summarizeBusFactor(commits, [], {}, { now: NOW });
  assert.equal(s.ok, true);
  assert.equal(s.recommendation, "ok");
  assert.equal(s.commitAuthorCount, 6);
  assert.equal(s.busFactor, 6);
  // topContributors capped at 5, sorted desc by commitCount.
  assert.equal(s.topContributors.length, 5);
  assert.equal(s.topContributors[0].commitCount, 5);
  assert.equal(s.topContributors[0].displayName.toLowerCase(), "alice@example.com");
  assert.equal(s.topContributors[1].commitCount, 4);
  // The remaining three are tied at 3 — verify descending order is maintained.
  for (let i = 1; i < s.topContributors.length; i++) {
    assert.ok(s.topContributors[i - 1].commitCount >= s.topContributors[i].commitCount);
  }
});

test("summarizeBusFactor: returns safe shape when env config invalid", () => {
  const s = summarizeBusFactor([], [], { ORBIT_BUS_FACTOR_MIN_MAINTAINERS: "0" }, { now: NOW });
  assert.equal(s.ok, false);
  assert.equal(s.recommendation, "critical");
  assert.ok(typeof s.error === "string");
});

test("evaluateBusFactor: env override raises bar; failing case reports too_few_maintainers", () => {
  const commits = [];
  for (const name of ["alice", "bob", "carol"]) {
    for (let i = 0; i < 3; i++) {
      commits.push({
        author: { email: name + "@example.com" },
        authoredDate: daysAgo(i + 1),
        sha: name + i
      });
    }
  }
  const r = evaluateBusFactor(
    commits,
    [],
    { ORBIT_BUS_FACTOR_MIN_MAINTAINERS: "5" },
    { now: NOW }
  );
  assert.equal(r.busFactor, 3);
  assert.equal(r.minRequired, 5);
  assert.equal(r.ok, false);
  assert.equal(r.reason, "too_few_maintainers");
});
