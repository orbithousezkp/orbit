"use strict";

const MANDATORY_INTERVAL_MINUTES = 30;

function normalizeTrigger(config = {}) {
  const eventName = config.cycleTrigger || "local";
  const eventAction = config.cycleTriggerAction || "";

  if (eventName === "schedule") {
    return {
      type: "mandatory",
      id: "regular_heartbeat",
      label: `${MANDATORY_INTERVAL_MINUTES}-minute heartbeat`,
      intervalMinutes: MANDATORY_INTERVAL_MINUTES,
      source: eventName,
      action: eventAction,
      reason: "Wake on the fixed repository control-plane rhythm even when no event fires."
    };
  }

  if (["issues", "issue_comment", "pull_request", "pull_request_review"].includes(eventName)) {
    return {
      type: "event",
      id: `github_${eventName}`,
      label: eventAction ? `${eventName}.${eventAction}` : eventName,
      source: eventName,
      action: eventAction,
      reason: "Wake because something happened on GitHub."
    };
  }

  if (eventName === "workflow_dispatch") {
    return {
      type: "event",
      id: "owner_manual_wake",
      label: "owner manual wake",
      source: eventName,
      action: eventAction,
      reason: "Wake because the owner asked for a cycle now."
    };
  }

  return {
    type: "event",
    id: "local_wake",
    label: "local wake",
    source: eventName,
    action: eventAction,
    reason: "Wake from a local command or unclassified trigger."
  };
}

function triggerPolicy() {
  return {
    mode: "state_event_mandatory",
    mandatoryIntervalMinutes: MANDATORY_INTERVAL_MINUTES,
    definitions: {
      state: "Internal control-plane condition: AI budget low, no income, pending approvals, open tasks, or stale memory.",
      event: "External GitHub activity: issues, comments, manual owner wake, labels, or repository changes.",
      mandatory: `Regular heartbeat every ${MANDATORY_INTERVAL_MINUTES} minutes to check survival, gates, proofs, and next work.`
    }
  };
}

module.exports = {
  MANDATORY_INTERVAL_MINUTES,
  normalizeTrigger,
  triggerPolicy
};
