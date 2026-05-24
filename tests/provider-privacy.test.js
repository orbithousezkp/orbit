"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  privateAiRoute,
  privateAiRouteId,
  privateAiRoutes,
  privateProviderErrors
} = require("../src/agent/provider-privacy");

test("privateAiRoute returns redacted route shape for a configured provider", () => {
  const route = privateAiRoute({ priority: 3, toolResultMode: "text" }, 0);

  assert.deepEqual(route, {
    route: "private-ai-route-3",
    priority: 3,
    configured: true,
    toolResultMode: "text"
  });
});

test("privateAiRoute falls back to index-based priority and native tool mode", () => {
  const route = privateAiRoute({}, 4);

  assert.equal(route.route, "private-ai-route-5");
  assert.equal(route.priority, 5);
  assert.equal(route.configured, true);
  assert.equal(route.toolResultMode, "native");
});

test("privateAiRoute ignores non-numeric priority and uses index instead", () => {
  const route = privateAiRoute({ priority: "not-a-number" }, 1);

  assert.equal(route.priority, 2);
  assert.equal(route.route, "private-ai-route-2");
});

test("privateAiRoutes maps a provider list to redacted routes preserving order", () => {
  const routes = privateAiRoutes([
    { priority: 1 },
    { priority: 2, toolResultMode: "text" }
  ]);

  assert.equal(routes.length, 2);
  assert.equal(routes[0].route, "private-ai-route-1");
  assert.equal(routes[0].toolResultMode, "native");
  assert.equal(routes[1].route, "private-ai-route-2");
  assert.equal(routes[1].toolResultMode, "text");
});

test("privateAiRoutes returns an empty array for non-array input", () => {
  assert.deepEqual(privateAiRoutes(), []);
  assert.deepEqual(privateAiRoutes(null), []);
  assert.deepEqual(privateAiRoutes("nope"), []);
});

test("privateAiRouteId returns the route string for a provider", () => {
  assert.equal(privateAiRouteId({ priority: 7 }, 0), "private-ai-route-7");
});

test("privateAiRouteId falls back to index when provider is missing", () => {
  assert.equal(privateAiRouteId(undefined, 2), "private-ai-route-3");
});

test("privateProviderErrors maps errors to redacted route entries", () => {
  const errors = privateProviderErrors([
    { route: "private-ai-route-1", priority: 1, error: "boom" },
    { priority: 2, error: "kapow" }
  ]);

  assert.equal(errors.length, 2);
  assert.deepEqual(errors[0], {
    route: "private-ai-route-1",
    priority: 1,
    error: "boom"
  });
  assert.equal(errors[1].route, "private-ai-route-2");
  assert.equal(errors[1].priority, 2);
  assert.equal(errors[1].error, "kapow");
});

test("privateProviderErrors substitutes generic error text and indexed route when fields are missing", () => {
  const errors = privateProviderErrors([{}, null]);

  assert.equal(errors.length, 2);
  assert.equal(errors[0].route, "private-ai-route-1");
  assert.equal(errors[0].priority, 1);
  assert.equal(errors[0].error, "AI route failed");
  assert.equal(errors[1].route, "private-ai-route-2");
  assert.equal(errors[1].priority, 2);
  assert.equal(errors[1].error, "AI route failed");
});

test("privateProviderErrors returns an empty array for non-array input", () => {
  assert.deepEqual(privateProviderErrors(), []);
  assert.deepEqual(privateProviderErrors(null), []);
  assert.deepEqual(privateProviderErrors("oops"), []);
});
