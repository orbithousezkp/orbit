"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { GitHubClient } = require("../src/agent/github");
const { executeTool } = require("../src/agent/actions");
const { TOOLS } = require("../src/agent/tools");

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

function client({ dryRun = false } = {}) {
  return new GitHubClient({
    githubToken: "token",
    githubRepository: "owner/orbit",
    dryRun
  });
}

test("tool descriptors expose the three PR tools", () => {
  const names = TOOLS.map((tool) => tool.name);
  assert.ok(names.includes("list_pull_requests"));
  assert.ok(names.includes("get_pull_request"));
  assert.ok(names.includes("review_pull_request"));

  const review = TOOLS.find((tool) => tool.name === "review_pull_request");
  assert.deepEqual([...review.inputSchema.required].sort(), [
    "pullNumber",
    "recommendation",
    "scope",
    "security",
    "summary",
    "tests"
  ]);
  assert.equal(review.inputSchema.additionalProperties, false);
});

test("listPullRequests parses GitHub pulls payload", async () => {
  const originalFetch = global.fetch;
  const urls = [];
  global.fetch = async (url) => {
    urls.push(url);
    return jsonResponse([
      {
        number: 42,
        title: "Add feature",
        body: "describe it",
        labels: [{ name: "enhancement" }],
        user: { login: "contributor" },
        state: "open",
        draft: false,
        head: { ref: "feat/x" },
        base: { ref: "main" },
        created_at: "2026-05-22T00:00:00Z",
        updated_at: "2026-05-22T00:00:00Z",
        html_url: "https://github.com/owner/orbit/pull/42",
        comments: 1,
        review_comments: 0
      }
    ]);
  };

  try {
    const pulls = await client().listPullRequests({ state: "open", perPage: 5 });
    assert.equal(urls[0], "https://api.github.com/repos/owner/orbit/pulls?state=open&per_page=5");
    assert.equal(pulls.length, 1);
    assert.equal(pulls[0].number, 42);
    assert.equal(pulls[0].headRef, "feat/x");
    assert.equal(pulls[0].baseRef, "main");
    assert.deepEqual(pulls[0].labels, ["enhancement"]);
  } finally {
    global.fetch = originalFetch;
  }
});

test("getPullRequest + getPullRequestFiles parse line counts", async () => {
  const originalFetch = global.fetch;
  const calls = [];
  global.fetch = async (url) => {
    calls.push(url);
    if (url.endsWith("/pulls/7")) {
      return jsonResponse({
        number: 7,
        title: "Fix bug",
        body: "details",
        labels: [],
        user: { login: "contributor" },
        state: "open",
        draft: false,
        merged: false,
        mergeable: true,
        head: { ref: "fix/bug", sha: "abc" },
        base: { ref: "main" },
        created_at: "2026-05-22T00:00:00Z",
        updated_at: "2026-05-22T00:00:00Z",
        html_url: "https://github.com/owner/orbit/pull/7",
        additions: 12,
        deletions: 4,
        changed_files: 2,
        comments: 0,
        review_comments: 0
      });
    }
    return jsonResponse([
      { filename: "src/a.js", status: "modified", additions: 8, deletions: 2, changes: 10 },
      { filename: "tests/a.test.js", status: "added", additions: 4, deletions: 0, changes: 4 }
    ]);
  };

  try {
    const pr = await client().getPullRequest(7);
    assert.equal(pr.additions, 12);
    assert.equal(pr.changedFiles, 2);
    assert.equal(pr.headSha, "abc");

    const files = await client().getPullRequestFiles(7);
    assert.equal(files.length, 2);
    assert.equal(files[0].filename, "src/a.js");
    assert.equal(files[1].status, "added");
    assert.ok(calls[1].endsWith("/pulls/7/files?per_page=100"));
  } finally {
    global.fetch = originalFetch;
  }
});

test("review_pull_request posts a structured review comment via dispatcher", async () => {
  const posted = [];
  const fakeGithub = {
    commentIssue: async (issueNumber, body) => {
      posted.push({ issueNumber, body });
      return { issueNumber, body, dryRun: false };
    }
  };

  const result = await executeTool({ repoRoot: "." }, fakeGithub, 1, "review_pull_request", {
    pullNumber: 42,
    summary: "Adds a small helper plus a test.",
    scope: "Touches src/helper.js and tests/helper.test.js only.",
    security: "No new network or wallet surface introduced.",
    tests: "One new unit test covers the helper.",
    recommendation: "approve"
  });

  assert.equal(posted.length, 1);
  assert.equal(posted[0].issueNumber, 42);
  assert.match(posted[0].body, /## Orbit review/);
  assert.match(posted[0].body, /\*\*Recommendation:\*\* Approve/);
  assert.match(posted[0].body, /### Summary/);
  assert.match(posted[0].body, /### Security/);
  assert.match(posted[0].body, /### Tests/);
  assert.ok(result);
});

test("review_pull_request honors dry-run via GitHubClient", async () => {
  const dryClient = client({ dryRun: true });
  const result = await executeTool({ repoRoot: "." }, dryClient, 1, "review_pull_request", {
    pullNumber: 3,
    summary: "small change",
    scope: "one file",
    security: "no impact",
    tests: "added coverage",
    recommendation: "comment"
  });

  assert.equal(result.dryRun, true);
  assert.equal(result.issueNumber, 3);
  assert.match(result.body, /Comment only/);
});

test("review_pull_request refuses empty review sections", async () => {
  await assert.rejects(
    () => executeTool({ repoRoot: "." }, client({ dryRun: true }), 1, "review_pull_request", {
      pullNumber: 1,
      summary: "ok",
      scope: "ok",
      security: "",
      tests: "ok",
      recommendation: "approve"
    }),
    /non-empty security/
  );
});

test("review_pull_request refuses secret-like content via assertSafePublicReply", async () => {
  await assert.rejects(
    () => executeTool({ repoRoot: "." }, client({ dryRun: true }), 1, "review_pull_request", {
      pullNumber: 1,
      summary: "ok",
      scope: "ok",
      security: "leaked AKIAIOSFODNN7EXAMPLE in code",
      tests: "ok",
      recommendation: "request_changes"
    }),
    /secret/
  );
});

test("review_pull_request rejects invalid recommendation values", async () => {
  await assert.rejects(
    () => executeTool({ repoRoot: "." }, client({ dryRun: true }), 1, "review_pull_request", {
      pullNumber: 1,
      summary: "ok",
      scope: "ok",
      security: "ok",
      tests: "ok",
      recommendation: "merge"
    }),
    /recommendation must be/
  );
});

test("get_pull_request dispatcher includes files when requested", async () => {
  const seen = [];
  const fakeGithub = {
    getPullRequest: async (n) => {
      seen.push(["get", n]);
      return {
        number: n,
        title: "T",
        body: "B",
        labels: [],
        author: "a",
        state: "open",
        draft: false,
        merged: false,
        mergeable: null,
        headRef: "h",
        headSha: "s",
        baseRef: "main",
        createdAt: "",
        updatedAt: "",
        url: "",
        additions: 0,
        deletions: 0,
        changedFiles: 0,
        commentsCount: 0,
        reviewCommentsCount: 0
      };
    },
    getPullRequestFiles: async (n) => {
      seen.push(["files", n]);
      return [{ filename: "src/x.js", status: "modified", additions: 1, deletions: 0, changes: 1 }];
    }
  };

  const result = await executeTool({ repoRoot: "." }, fakeGithub, 1, "get_pull_request", {
    pullNumber: 5,
    includeFiles: true
  });

  assert.equal(result.files.length, 1);
  assert.deepEqual(seen, [["get", 5], ["files", 5]]);
});
