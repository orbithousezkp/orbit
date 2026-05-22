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
