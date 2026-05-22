"use strict";

const TOOLS = [
  {
    name: "behavior_status",
    description: "Read Orbit's virtual-human household behavior contract and wake-cycle plan.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false
    }
  },
  {
    name: "read_file",
    description: "Read a repository file by relative path.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string" }
      },
      required: ["path"],
      additionalProperties: false
    }
  },
  {
    name: "write_file",
    description: "Write a repository file by relative path. Refuses unsafe paths and secret-like content.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string" },
        content: { type: "string" }
      },
      required: ["path", "content"],
      additionalProperties: false
    }
  },
  {
    name: "append_task",
    description: "Add a task to persistent memory.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        priority: { type: "string", enum: ["low", "normal", "high"] },
        source: { type: "string" },
        notes: { type: "string" }
      },
      required: ["title"],
      additionalProperties: false
    }
  },
  {
    name: "complete_task",
    description: "Mark a task complete in persistent memory.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        outcome: { type: "string" }
      },
      required: ["id"],
      additionalProperties: false
    }
  },
  {
    name: "list_issues",
    description: "List public GitHub issues for this repository.",
    inputSchema: {
      type: "object",
      properties: {
        state: { type: "string", enum: ["open", "closed", "all"] },
        perPage: { type: "number" }
      },
      additionalProperties: false
    }
  },
  {
    name: "get_issue",
    description: "Read one public GitHub issue by number.",
    inputSchema: {
      type: "object",
      properties: {
        issueNumber: { type: "number" },
        includeComments: { type: "boolean" }
      },
      required: ["issueNumber"],
      additionalProperties: false
    }
  },
  {
    name: "comment_issue",
    description: "Post a public comment on a GitHub issue.",
    inputSchema: {
      type: "object",
      properties: {
        issueNumber: { type: "number" },
        body: { type: "string" }
      },
      required: ["issueNumber", "body"],
      additionalProperties: false
    }
  },
  {
    name: "create_issue",
    description: "Create a public approval issue only for wallet spending, payments, signing, token actions, payout-route changes, or major risky external movement. Routine code, frontend, docs, memory, templates, chores, bugs, and owner-review notes must use files, tasks, comments, or commits instead.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        body: { type: "string" },
        labels: {
          type: "array",
          items: { type: "string" }
        }
      },
      required: ["title", "body"],
      additionalProperties: false
    }
  },
  {
    name: "close_issue",
    description: "Close a GitHub issue after posting an optional public closing note.",
    inputSchema: {
      type: "object",
      properties: {
        issueNumber: { type: "number" },
        body: { type: "string" }
      },
      required: ["issueNumber"],
      additionalProperties: false
    }
  },
  {
    name: "label_issue",
    description: "Add labels to a GitHub issue.",
    inputSchema: {
      type: "object",
      properties: {
        issueNumber: { type: "number" },
        labels: {
          type: "array",
          items: { type: "string" }
        }
      },
      required: ["issueNumber", "labels"],
      additionalProperties: false
    }
  },
  {
    name: "append_memory",
    description: "Append durable knowledge to Orbit's public memory store.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        content: { type: "string" },
        kind: { type: "string" },
        tags: {
          type: "array",
          items: { type: "string" }
        },
        source: { type: "string" }
      },
      required: ["title", "content"],
      additionalProperties: false
    }
  },
  {
    name: "list_memory",
    description: "List recent durable memory entries, optionally filtered by kind or tag.",
    inputSchema: {
      type: "object",
      properties: {
        kind: { type: "string" },
        tag: { type: "string" },
        limit: { type: "number" }
      },
      additionalProperties: false
    }
  },
  {
    name: "search_memory",
    description: "Search Orbit memory files and durable knowledge entries.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        limit: { type: "number" }
      },
      required: ["query"],
      additionalProperties: false
    }
  },
  {
    name: "delete_memory",
    description: "Delete a durable knowledge entry by id when it is obsolete or unsafe.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" }
      },
      required: ["id"],
      additionalProperties: false
    }
  },
  {
    name: "fetch_url",
    description: "Fetch a public URL with SSRF protection, domain allowlist support, secret redaction, and risk scanning.",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string" },
        maxBytes: { type: "number" }
      },
      required: ["url"],
      additionalProperties: false
    }
  },
  {
    name: "web_search",
    description: "Search the web through a configured JSON search endpoint. Returns unavailable when no provider endpoint is configured.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" }
      },
      required: ["query"],
      additionalProperties: false
    }
  },
  {
    name: "github_search",
    description: "Search public GitHub repositories, issues, or code for project research.",
    inputSchema: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["repositories", "issues", "code"] },
        query: { type: "string" },
        perPage: { type: "number" }
      },
      required: ["type", "query"],
      additionalProperties: false
    }
  },
  {
    name: "run_command",
    description: "Run an allowlisted local command and return output.",
    inputSchema: {
      type: "object",
      properties: {
        command: { type: "string" }
      },
      required: ["command"],
      additionalProperties: false
    }
  },
  {
    name: "write_cycle_note",
    description: "Write a markdown note for this cycle under memory/cycles/.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        body: { type: "string" }
      },
      required: ["title", "body"],
      additionalProperties: false
    }
  },
  {
    name: "treasury_status",
    description: "Read Orbit's AI budget, token status, and configured revenue split.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false
    }
  },
  {
    name: "ai_food_status",
    description: "Read AI-call food budget, provider priority, OpenRouter-only purchase policy, pending top-ups, and recorded refills.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false
    }
  },
  {
    name: "request_ai_food_refill",
    description: "Request owner approval to buy AI-call food credits. Purchase target is restricted to OpenRouter even when inference uses FreeModel or OpenGateway first.",
    inputSchema: {
      type: "object",
      properties: {
        amountUsd: { type: "number" },
        provider: { type: "string", enum: ["openrouter"] },
        reason: { type: "string" }
      },
      required: ["amountUsd"],
      additionalProperties: false
    }
  },
  {
    name: "record_ai_food_refill",
    description: "Record a completed OpenRouter credit purchase after owner approval and manual purchase proof. Requires an approved approval ID and does not execute payment.",
    inputSchema: {
      type: "object",
      properties: {
        amountUsd: { type: "number" },
        provider: { type: "string", enum: ["openrouter"] },
        approvalId: { type: "string" },
        proof: { type: "string" }
      },
      required: ["amountUsd", "approvalId", "proof"],
      additionalProperties: false
    }
  },
  {
    name: "prepare_token_launch",
    description: "Prepare and validate the Clanker v4 native token launch request without sending a transaction.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false
    }
  },
  {
    name: "launch_native_token",
    description: "Launch Orbit's native token through Clanker v4. This only sends a transaction if ORBIT_ENABLE_TOKEN_LAUNCH is true and wallet/address config is complete.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false
    }
  },
  {
    name: "run_revenue_cycle",
    description: "Claim configured Clanker paired-token rewards for the configured reward recipient. This only sends a transaction if ORBIT_ENABLE_REVENUE_CLAIMS is true.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false
    }
  },
  {
    name: "income_opportunities",
    description: "Read and seed Orbit's survival opportunity ledger, including state drivers, GitHub event drivers, the regular 30-minute mandatory heartbeat, and scored ways to earn without bypassing locks.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false
    }
  },
  {
    name: "feature_catalog",
    description: "Read Orbit's 150+ capability catalog and category summary.",
    inputSchema: {
      type: "object",
      properties: {
        category: { type: "string" },
        status: { type: "string" }
      },
      additionalProperties: false
    }
  },
  {
    name: "governance_status",
    description: "Read spend policy, approval queue, and owner-approval settings.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false
    }
  },
  {
    name: "scan_risk",
    description: "Scan text or a spend intent for scams, prompt injection, drain language, and external spend risk.",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string" },
        spendIntent: {
          type: "object",
          properties: {
            category: { type: "string" },
            purpose: { type: "string" },
            asset: { type: "string" },
            amount: {},
            recipient: { type: "string" },
            url: { type: "string" },
            notes: { type: "string" }
          },
          additionalProperties: true
        }
      },
      additionalProperties: false
    }
  },
  {
    name: "propose_spend",
    description: "Classify a spend request. External or risky spend is blocked and converted into a public owner-approval issue.",
    inputSchema: {
      type: "object",
      properties: {
        category: { type: "string" },
        purpose: { type: "string" },
        asset: { type: "string" },
        amount: {},
        recipient: { type: "string" },
        url: { type: "string" },
        notes: { type: "string" }
      },
      required: ["purpose"],
      additionalProperties: false
    }
  },
  {
    name: "request_owner_approval",
    description: "Create or update an owner approval request for an external or risky spend.",
    inputSchema: {
      type: "object",
      properties: {
        category: { type: "string" },
        purpose: { type: "string" },
        asset: { type: "string" },
        amount: {},
        recipient: { type: "string" },
        url: { type: "string" },
        notes: { type: "string" }
      },
      required: ["purpose"],
      additionalProperties: false
    }
  },
  {
    name: "check_owner_approval",
    description: "Check whether a pending spend approval has been accepted or rejected by the owner.",
    inputSchema: {
      type: "object",
      properties: {
        approvalId: { type: "string" }
      },
      required: ["approvalId"],
      additionalProperties: false
    }
  }
];

module.exports = {
  TOOLS
};
