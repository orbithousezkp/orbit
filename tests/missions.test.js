"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  parseMissionFromIssue,
  scanMissions,
  buildMissionsRecord,
  projectMissionsForDashboard,
  hasMissionLabel,
  MISSION_LABEL,
  MISSION_SCHEMA
} = require("../src/agent/missions");

function issue(overrides = {}) {
  return {
    number: 1,
    title: "Sample mission",
    body: "Some rationale.\n\n## Acceptance Criteria\n- [ ] pr-merged\n- [ ] tests-pass\n",
    labels: ["orbit:mission"],
    author: "alice",
    state: "open",
    createdAt: "2026-05-01T00:00:00Z",
    updatedAt: "2026-05-02T00:00:00Z",
    url: "https://github.com/example/repo/issues/1",
    ...overrides
  };
}

test("hasMissionLabel matches string and object label forms", () => {
  assert.equal(hasMissionLabel({ labels: ["orbit:mission"] }), true);
  assert.equal(hasMissionLabel({ labels: [{ name: "orbit:mission" }] }), true);
  assert.equal(hasMissionLabel({ labels: ["other"] }), false);
  assert.equal(hasMissionLabel({}), false);
  assert.equal(hasMissionLabel(null), false);
});

test("hasMissionLabel is case-insensitive", () => {
  assert.equal(hasMissionLabel({ labels: ["Orbit:Mission"] }), true);
  assert.equal(hasMissionLabel({ labels: [{ name: "ORBIT:MISSION" }] }), true);
});

test("parseMissionFromIssue returns null without the mission label", () => {
  const m = parseMissionFromIssue(issue({ labels: ["service-request"] }));
  assert.equal(m, null);
});

test("parseMissionFromIssue extracts core fields", () => {
  const m = parseMissionFromIssue(issue({ number: 42 }));
  assert.equal(m.id, "mission-42");
  assert.equal(m.issueNumber, 42);
  assert.equal(m.title, "Sample mission");
  assert.equal(m.proposer, "alice");
  assert.equal(m.status, "open");
  assert.deepEqual(m.acceptanceCriteria, ["pr-merged", "tests-pass"]);
});

test("parseMissionFromIssue parses Deadline: line from body", () => {
  const m = parseMissionFromIssue(issue({
    body: "Rationale.\nDeadline: 2026-06-15\n\n## Acceptance Criteria\n- [ ] pr-merged\n"
  }));
  assert.equal(m.deadline, "2026-06-15");
});

test("parseMissionFromIssue handles missing body fields without throwing", () => {
  const m = parseMissionFromIssue(issue({ body: "" }));
  assert.deepEqual(m.acceptanceCriteria, []);
  assert.equal(m.deadline, null);
  assert.equal(m.rationale, "");
});

test("parseMissionFromIssue clamps title and rationale lengths", () => {
  const longTitle = "x".repeat(500);
  const longBody = "y".repeat(2000) + "\n## Acceptance Criteria\n- [ ] ok\n";
  const m = parseMissionFromIssue(issue({ title: longTitle, body: longBody }));
  assert.ok(m.title.length <= 160);
  assert.ok(m.rationale.length <= 600);
});

test("parseMissionFromIssue stops criteria block at next heading", () => {
  const m = parseMissionFromIssue(issue({
    body: "## Acceptance Criteria\n- [ ] one\n- [ ] two\n## Notes\n- [ ] not-a-criterion\n"
  }));
  assert.deepEqual(m.acceptanceCriteria, ["one", "two"]);
});

test("parseMissionFromIssue caps criteria at 10 items", () => {
  const items = Array.from({ length: 25 }, (_, i) => `- [ ] item-${i}`).join("\n");
  const m = parseMissionFromIssue(issue({ body: `## Acceptance Criteria\n${items}` }));
  assert.equal(m.acceptanceCriteria.length, 10);
});

test("scanMissions filters non-mission issues", () => {
  const issues = [
    issue({ number: 1 }),
    issue({ number: 2, labels: ["service-request"] }),
    issue({ number: 3 })
  ];
  const out = scanMissions(issues);
  assert.equal(out.length, 2);
  assert.deepEqual(out.map((m) => m.issueNumber).sort(), [1, 3]);
});

test("scanMissions sorts by updatedAt desc", () => {
  const issues = [
    issue({ number: 1, updatedAt: "2026-05-01T00:00:00Z" }),
    issue({ number: 2, updatedAt: "2026-05-10T00:00:00Z" }),
    issue({ number: 3, updatedAt: "2026-05-05T00:00:00Z" })
  ];
  const out = scanMissions(issues);
  assert.deepEqual(out.map((m) => m.issueNumber), [2, 3, 1]);
});

test("scanMissions handles empty / non-array input", () => {
  assert.deepEqual(scanMissions([]), []);
  assert.deepEqual(scanMissions(null), []);
  assert.deepEqual(scanMissions(undefined), []);
});

test("buildMissionsRecord produces schema-tagged record", () => {
  const record = buildMissionsRecord([], { cycle: 42, at: "2026-05-25T00:00:00Z" });
  assert.equal(record.schema, MISSION_SCHEMA);
  assert.equal(record.lastScannedCycle, 42);
  assert.equal(record.lastScannedAt, "2026-05-25T00:00:00Z");
  assert.deepEqual(record.missions, []);
});

test("projectMissionsForDashboard surfaces only open missions and caps the list", () => {
  const missions = scanMissions([
    issue({ number: 1, state: "open" }),
    issue({ number: 2, state: "closed" }),
    issue({ number: 3, state: "open" })
  ]);
  const record = buildMissionsRecord(missions, { cycle: 1 });
  const slim = projectMissionsForDashboard(record, { limit: 5 });
  assert.equal(slim.active, 2);
  assert.equal(slim.total, 3);
  assert.equal(slim.list.length, 2);
  for (const item of slim.list) {
    assert.equal(typeof item.issueNumber, "number");
    assert.equal(typeof item.title, "string");
    assert.equal(typeof item.proposer, "string");
  }
});

test("projectMissionsForDashboard tolerates empty/missing input", () => {
  const slim = projectMissionsForDashboard(null);
  assert.equal(slim.active, 0);
  assert.equal(slim.total, 0);
  assert.deepEqual(slim.list, []);
});

test("MISSION_LABEL constant is canonical lowercase", () => {
  assert.equal(MISSION_LABEL, "orbit:mission");
});
