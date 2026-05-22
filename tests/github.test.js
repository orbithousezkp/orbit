"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { GitHubClient } = require("../src/agent/github");

function response(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

function client() {
  return new GitHubClient({
    githubToken: "token",
    githubRepository: "owner/orbit",
    dryRun: false
  });
}

test("lists repository issues and filters pull requests", async () => {
  const originalFetch = global.fetch;
  const urls = [];
  global.fetch = async (url) => {
    urls.push(url);
    return response([
      {
        number: 1,
        title: "Open task",
        body: "ship a small fix",
        labels: [{ name: "orbit" }],
        user: { login: "owner" },
        state: "open",
        created_at: "2026-05-21T00:00:00Z",
        updated_at: "2026-05-21T00:00:00Z",
        html_url: "https://github.com/owner/orbit/issues/1",
        comments: 2
      },
      {
        number: 2,
        title: "PR",
        pull_request: {},
        labels: [],
        user: { login: "owner" }
      }
    ]);
  };

  try {
    const issues = await client().listIssues({ state: "all", perPage: 200 });
    assert.equal(urls[0], "https://api.github.com/repos/owner/orbit/issues?state=all&per_page=100");
    assert.equal(issues.length, 1);
    assert.equal(issues[0].number, 1);
    assert.equal(issues[0].comments, 2);
  } finally {
    global.fetch = originalFetch;
  }
});

test("reads a repository issue by number", async () => {
  const originalFetch = global.fetch;
  const urls = [];
  global.fetch = async (url) => {
    urls.push(url);
    return response({
      number: 7,
      title: "Inspect me",
      body: "details",
      labels: [{ name: "triage" }],
      user: { login: "contributor" },
      state: "open",
      created_at: "2026-05-21T00:00:00Z",
      updated_at: "2026-05-21T00:00:00Z",
      html_url: "https://github.com/owner/orbit/issues/7",
      comments: 1
    });
  };

  try {
    const issue = await client().getIssue(7);
    assert.equal(urls[0], "https://api.github.com/repos/owner/orbit/issues/7");
    assert.equal(issue.title, "Inspect me");
    assert.deepEqual(issue.labels, ["triage"]);
    assert.equal(issue.comments, 1);
  } finally {
    global.fetch = originalFetch;
  }
});

test("rejects issue number path injection", async () => {
  await assert.rejects(
    () => client().commentIssue("7/labels", "body"),
    /positive integer/
  );
  await assert.rejects(
    () => client().getIssue("7.5"),
    /positive integer/
  );
});

test("rejects malformed repository names", () => {
  const badClient = new GitHubClient({
    githubToken: "token",
    githubRepository: "owner/orbit/issues",
    dryRun: false
  });

  assert.equal(badClient.configured(), false);
  assert.throws(() => badClient.repoParts(), /owner\/repo/);
});

test("request headers cannot override GitHub Authorization", async () => {
  const originalFetch = global.fetch;
  let authorization = "";
  let lowerAuthorization = "";

  global.fetch = async (_url, options) => {
    authorization = options.headers.Authorization;
    lowerAuthorization = options.headers.authorization;
    return response({});
  };

  try {
    await client().request("/repos/owner/orbit", {
      headers: {
        Authorization: "Bearer attacker",
        authorization: "Bearer lower-attacker"
      }
    });
    assert.equal(authorization, "Bearer token");
    assert.equal(lowerAuthorization, undefined);
  } finally {
    global.fetch = originalFetch;
  }
});
