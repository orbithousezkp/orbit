"use strict";

// state-guard.js is Layer 3 of the four-layer "token launch fires exactly
// once" defense (S-LAUNCH-1 / D-019). The whole thesis depends on these
// pure functions never silently letting a rollback through. They had no
// tests until Patch Set L.

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  assertLaunchOnceNotRolled,
  assertStateWriteSafe,
  assertTokenLaunchedDoesNotUnflip
} = require("../src/agent/state-guard");

test("assertLaunchOnceNotRolled allows false -> true (the legitimate launch)", () => {
  assert.doesNotThrow(() => assertLaunchOnceNotRolled(
    { launchOnceFired: false },
    { launchOnceFired: true }
  ));
});

test("assertLaunchOnceNotRolled allows true -> true (idempotent re-save)", () => {
  assert.doesNotThrow(() => assertLaunchOnceNotRolled(
    { launchOnceFired: true },
    { launchOnceFired: true }
  ));
});

test("assertLaunchOnceNotRolled blocks true -> false with LAUNCH_ONCE_ROLLBACK", () => {
  assert.throws(
    () => assertLaunchOnceNotRolled({ launchOnceFired: true }, { launchOnceFired: false }),
    (err) => err.code === "LAUNCH_ONCE_ROLLBACK"
  );
});

test("assertLaunchOnceNotRolled blocks true -> missing/undefined (silent unflip)", () => {
  assert.throws(
    () => assertLaunchOnceNotRolled({ launchOnceFired: true }, {}),
    (err) => err.code === "LAUNCH_ONCE_ROLLBACK"
  );
});

test("assertLaunchOnceNotRolled accepts null/undefined prev state without throwing", () => {
  assert.doesNotThrow(() => assertLaunchOnceNotRolled(null, { launchOnceFired: true }));
  assert.doesNotThrow(() => assertLaunchOnceNotRolled(undefined, {}));
});

test("assertTokenLaunchedDoesNotUnflip (canonical: treasury snapshots) blocks launched -> pending", () => {
  assert.throws(
    () => assertTokenLaunchedDoesNotUnflip({}, {}, {
      prevTreasury: { token: { launchStatus: "launched" } },
      nextTreasury: { token: { launchStatus: "pending" } }
    }),
    (err) => err.code === "LAUNCH_STATUS_ROLLBACK"
  );
});

test("assertTokenLaunchedDoesNotUnflip (canonical) allows launched -> launched", () => {
  assert.doesNotThrow(() => assertTokenLaunchedDoesNotUnflip({}, {}, {
    prevTreasury: { token: { launchStatus: "launched" } },
    nextTreasury: { token: { launchStatus: "launched" } }
  }));
});

test("assertTokenLaunchedDoesNotUnflip (legacy state.treasury shape) still guards rollback", () => {
  assert.throws(
    () => assertTokenLaunchedDoesNotUnflip(
      { treasury: { token: { launchStatus: "launched" } } },
      { treasury: { token: { launchStatus: "rolled-back" } } }
    ),
    (err) => err.code === "LAUNCH_STATUS_ROLLBACK"
  );
});

test("assertStateWriteSafe composes both guards (both must pass for write to proceed)", () => {
  // Composition test — both guards fire on a bad write.
  assert.throws(
    () => assertStateWriteSafe({ launchOnceFired: true }, { launchOnceFired: false }),
    (err) => err.code === "LAUNCH_ONCE_ROLLBACK"
  );
  assert.throws(
    () => assertStateWriteSafe({}, {}, {
      prevTreasury: { token: { launchStatus: "launched" } },
      nextTreasury: { token: { launchStatus: "" } }
    }),
    (err) => err.code === "LAUNCH_STATUS_ROLLBACK"
  );
  // Happy path: nothing changing.
  assert.doesNotThrow(() => assertStateWriteSafe(
    { launchOnceFired: false },
    { launchOnceFired: false }
  ));
});
