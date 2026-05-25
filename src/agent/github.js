"use strict";

const { omitUnsafeVisitorContent, scanTextRisk } = require("./scam");
const { redactSecrets } = require("./safety");

function safePublicText(text, maxLength = 2000) {
  const redacted = redactSecrets(String(text || ""));
  return omitUnsafeVisitorContent(redacted, scanTextRisk(redacted)).slice(0, maxLength);
}

class GitHubClient {
  constructor(config) {
    this.token = config.githubToken;
    this.repository = config.githubRepository;
    this.dryRun = config.dryRun;
    this.baseUrl = "https://api.github.com";
  }

  configured() {
    const parts = String(this.repository || "").split("/");
    return Boolean(
      this.token &&
      parts.length === 2 &&
      parts.every((part) => /^[A-Za-z0-9_.-]+$/.test(part))
    );
  }

  repoParts() {
    if (!this.configured()) {
      throw new Error("GitHub repository must be owner/repo with safe path characters");
    }
    const [owner, repo] = this.repository.split("/");
    return { owner, repo };
  }

  repoPath() {
    const { owner, repo } = this.repoParts();
    return `${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  }

  issueNumber(value) {
    const raw = String(value).trim();
    if (!/^[1-9][0-9]*$/.test(raw)) {
      throw new Error("issueNumber must be a positive integer");
    }
    const number = Number(raw);
    if (!Number.isSafeInteger(number)) {
      throw new Error("issueNumber must be a positive integer");
    }
    return number;
  }

  async request(pathname, options = {}) {
    if (!this.configured()) {
      throw new Error("GitHub client is not configured");
    }

    const callerHeaders = Object.fromEntries(
      Object.entries(options.headers || {}).filter(([key]) => key.toLowerCase() !== "authorization")
    );
    const response = await fetch(`${this.baseUrl}${pathname}`, {
      ...options,
      headers: {
        ...callerHeaders,
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28"
      }
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`GitHub ${response.status}: ${body.slice(0, 500)}`);
    }

    if (response.status === 204) return null;
    return response.json();
  }

  async listIssues({ state = "open", perPage = 20 } = {}) {
    if (!this.configured()) return [];
    const repoPath = this.repoPath();
    const capped = Math.min(Number.parseInt(perPage, 10) || 20, 100);
    const issues = await this.request(
      `/repos/${repoPath}/issues?state=${encodeURIComponent(state)}&per_page=${capped}`
    );
    return issues.filter((issue) => !issue.pull_request).map((issue) => ({
      number: issue.number,
      title: issue.title,
      body: issue.body || "",
      labels: issue.labels.map((label) => label.name),
      author: issue.user ? issue.user.login : "unknown",
      state: issue.state,
      createdAt: issue.created_at,
      updatedAt: issue.updated_at,
      url: issue.html_url,
      comments: typeof issue.comments === "number" ? issue.comments : 0
    }));
  }

  async listIssueComments(issueNumber) {
    if (!this.configured()) return [];
    const repoPath = this.repoPath();
    const number = this.issueNumber(issueNumber);
    const comments = await this.request(
      `/repos/${repoPath}/issues/${number}/comments?per_page=100`
    );
    return comments.map((comment) => ({
      id: comment.id,
      author: comment.user ? comment.user.login : "unknown",
      body: comment.body || "",
      createdAt: comment.created_at,
      updatedAt: comment.updated_at,
      url: comment.html_url
    }));
  }

  async getIssue(issueNumber) {
    if (!this.configured()) return null;
    const repoPath = this.repoPath();
    const number = this.issueNumber(issueNumber);
    const issue = await this.request(`/repos/${repoPath}/issues/${number}`);
    return {
      number: issue.number,
      title: issue.title,
      body: issue.body || "",
      labels: issue.labels.map((label) => label.name),
      author: issue.user ? issue.user.login : "unknown",
      state: issue.state,
      createdAt: issue.created_at,
      updatedAt: issue.updated_at,
      url: issue.html_url,
      comments: typeof issue.comments === "number" ? issue.comments : 0
    };
  }

  async closeIssue(issueNumber, body) {
    const number = this.issueNumber(issueNumber);
    if (this.dryRun) return { dryRun: true, issueNumber: number, body, state: "closed" };
    if (body) await this.commentIssue(number, body);
    const repoPath = this.repoPath();
    return this.request(`/repos/${repoPath}/issues/${number}`, {
      method: "PATCH",
      body: JSON.stringify({ state: "closed" })
    });
  }

  async addLabels(issueNumber, labels) {
    const number = this.issueNumber(issueNumber);
    if (this.dryRun) return { dryRun: true, issueNumber: number, labels };
    const repoPath = this.repoPath();
    return this.request(`/repos/${repoPath}/issues/${number}/labels`, {
      method: "POST",
      body: JSON.stringify({ labels })
    });
  }

  async commentIssue(issueNumber, body) {
    const number = this.issueNumber(issueNumber);
    if (this.dryRun) return { dryRun: true, issueNumber: number, body };
    const repoPath = this.repoPath();
    return this.request(`/repos/${repoPath}/issues/${number}/comments`, {
      method: "POST",
      body: JSON.stringify({ body })
    });
  }

  async createIssue({ title, body, labels = [] }) {
    if (this.dryRun) return { dryRun: true, title, body, labels };
    const repoPath = this.repoPath();
    return this.request(`/repos/${repoPath}/issues`, {
      method: "POST",
      body: JSON.stringify({ title, body, labels })
    });
  }

  async listPullRequests({ state = "open", perPage = 20 } = {}) {
    if (!this.configured()) return [];
    const repoPath = this.repoPath();
    const capped = Math.min(Number.parseInt(perPage, 10) || 20, 100);
    const allowedState = ["open", "closed", "all"].includes(state) ? state : "open";
    const pulls = await this.request(
      `/repos/${repoPath}/pulls?state=${encodeURIComponent(allowedState)}&per_page=${capped}`
    );
    return pulls.map((pr) => ({
      number: pr.number,
      title: pr.title,
      body: pr.body || "",
      labels: (pr.labels || []).map((label) => label.name),
      author: pr.user ? pr.user.login : "unknown",
      state: pr.state,
      draft: Boolean(pr.draft),
      headRef: pr.head ? pr.head.ref : "",
      baseRef: pr.base ? pr.base.ref : "",
      createdAt: pr.created_at,
      updatedAt: pr.updated_at,
      url: pr.html_url,
      commentsCount: typeof pr.comments === "number" ? pr.comments : 0,
      reviewCommentsCount: typeof pr.review_comments === "number" ? pr.review_comments : 0
    }));
  }

  async getPullRequest(pullNumber) {
    if (!this.configured()) return null;
    const repoPath = this.repoPath();
    const number = this.issueNumber(pullNumber);
    const pr = await this.request(`/repos/${repoPath}/pulls/${number}`);
    return {
      number: pr.number,
      title: pr.title,
      body: pr.body || "",
      labels: (pr.labels || []).map((label) => label.name),
      author: pr.user ? pr.user.login : "unknown",
      state: pr.state,
      draft: Boolean(pr.draft),
      merged: Boolean(pr.merged),
      mergeable: pr.mergeable,
      headRef: pr.head ? pr.head.ref : "",
      headSha: pr.head ? pr.head.sha : "",
      baseRef: pr.base ? pr.base.ref : "",
      createdAt: pr.created_at,
      updatedAt: pr.updated_at,
      url: pr.html_url,
      additions: typeof pr.additions === "number" ? pr.additions : 0,
      deletions: typeof pr.deletions === "number" ? pr.deletions : 0,
      changedFiles: typeof pr.changed_files === "number" ? pr.changed_files : 0,
      commentsCount: typeof pr.comments === "number" ? pr.comments : 0,
      reviewCommentsCount: typeof pr.review_comments === "number" ? pr.review_comments : 0
    };
  }

  async getPullRequestFiles(pullNumber, { perPage = 100 } = {}) {
    if (!this.configured()) return [];
    const repoPath = this.repoPath();
    const number = this.issueNumber(pullNumber);
    const capped = Math.min(Number.parseInt(perPage, 10) || 100, 100);
    const files = await this.request(
      `/repos/${repoPath}/pulls/${number}/files?per_page=${capped}`
    );
    return files.map((file) => ({
      filename: file.filename,
      status: file.status,
      additions: typeof file.additions === "number" ? file.additions : 0,
      deletions: typeof file.deletions === "number" ? file.deletions : 0,
      changes: typeof file.changes === "number" ? file.changes : 0,
      previousFilename: file.previous_filename || null
    }));
  }

  // S-REVENUE-1: fetch open issues + their reaction counts for ANY public
  // repo (mothership OR adopter). Unlike listIssues() which targets the
  // configured repository, this takes explicit owner/repo args so the
  // market-signal collector can sweep across the adopter set. Catches
  // per-issue failures and returns whatever it could gather.
  //
  // GitHub returns total reactions on each issue as `reactions.total_count`
  // and per-emoji counts ("+1", "-1", laugh, hooray, confused, heart, rocket,
  // eyes). The "reactions" endpoint requires the squirrel-girl preview
  // header on older API versions but is part of the default schema as of
  // 2022-11-28 (already pinned via X-GitHub-Api-Version).
  async fetchIssueReactions(owner, repo, opts = {}) {
    if (!owner || !repo) return [];
    if (!this.configured()) return [];
    const safeOwner = encodeURIComponent(String(owner));
    const safeRepo = encodeURIComponent(String(repo));
    const state = opts.state === "closed" || opts.state === "all" ? opts.state : "open";
    const capped = Math.min(Number.parseInt(opts.perPage, 10) || 50, 100);
    let issues;
    try {
      issues = await this.request(
        `/repos/${safeOwner}/${safeRepo}/issues?state=${encodeURIComponent(state)}&per_page=${capped}`
      );
    } catch (err) {
      // Per-repo failure: caller treats as zero data, keep going.
      return { ok: false, error: err.message, issues: [] };
    }
    const filtered = Array.isArray(issues)
      ? issues.filter((issue) => issue && !issue.pull_request)
      : [];
    const rows = [];
    for (const issue of filtered) {
      try {
        const reactions = issue.reactions && typeof issue.reactions === "object" ? issue.reactions : {};
        const labels = Array.isArray(issue.labels)
          ? issue.labels.map((label) => (typeof label === "string" ? label : (label && label.name) || "")).filter(Boolean)
          : [];
        const byEmoji = {
          "+1": typeof reactions["+1"] === "number" ? reactions["+1"] : 0,
          "-1": typeof reactions["-1"] === "number" ? reactions["-1"] : 0,
          laugh: typeof reactions.laugh === "number" ? reactions.laugh : 0,
          hooray: typeof reactions.hooray === "number" ? reactions.hooray : 0,
          confused: typeof reactions.confused === "number" ? reactions.confused : 0,
          heart: typeof reactions.heart === "number" ? reactions.heart : 0,
          rocket: typeof reactions.rocket === "number" ? reactions.rocket : 0,
          eyes: typeof reactions.eyes === "number" ? reactions.eyes : 0
        };
        const total = typeof reactions.total_count === "number"
          ? reactions.total_count
          : Object.values(byEmoji).reduce((acc, n) => acc + n, 0);
        rows.push({
          number: issue.number,
          labels,
          reactions: { total, byEmoji }
        });
      } catch {
        // skip the malformed issue, continue
      }
    }
    return { ok: true, issues: rows };
  }

  async search({ type, query, perPage = 10 }) {
    if (!this.configured()) return { configured: false, results: [] };
    const normalizedType = ["repositories", "issues", "code"].includes(type) ? type : "repositories";
    const capped = Math.min(Number.parseInt(perPage, 10) || 10, 25);
    const response = await this.request(
      `/search/${normalizedType}?q=${encodeURIComponent(query)}&per_page=${capped}`,
      { headers: { Accept: "application/vnd.github+json" } }
    );

    return {
      type: normalizedType,
      query,
      totalCount: response.total_count || 0,
      incompleteResults: Boolean(response.incomplete_results),
      results: (response.items || []).slice(0, capped).map((item) => ({
        name: safePublicText(item.full_name || item.title || item.name || "", 300),
        path: safePublicText(item.path || "", 500),
        url: item.html_url || "",
        state: item.state || "",
        description: safePublicText(item.description || item.body || "", 2000),
        score: item.score
      }))
    };
  }
}

module.exports = {
  GitHubClient
};
