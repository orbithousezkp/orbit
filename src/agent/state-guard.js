"use strict";

// State write guards (S-LAUNCH-1 / D-019 once-only launch guarantee).
//
// These guards run inside the state-write path in src/agent/run.js. They are
// the third independent layer of the "token launch fires exactly once"
// guarantee:
//
//   Layer 0 - treasury.token.launchStatus = "launched" (existing, in treasury.json)
//   Layer 1 - state.launchOnceFired = true              (append-only flag in state.json)
//   Layer 2 - actions.js tool-layer refusal             (early return in dispatch)
//   Layer 3 - assertLaunchOnceNotRolled (this module)   (state-write veto)
//
// Any one of these is sufficient to block a re-launch. Three layers means
// even with one corrupted/rolled-back state we cannot accidentally fire twice.

function assertLaunchOnceNotRolled(prevState, nextState) {
  const prevFired = prevState && prevState.launchOnceFired === true;
  const nextFired = nextState && nextState.launchOnceFired === true;
  if (prevFired && !nextFired) {
    const err = new Error(
      "state-guard: refusing to write state — state.launchOnceFired was true and would be cleared. " +
      "This flag is append-only per S-LAUNCH-1 (token launch fires exactly once)."
    );
    err.code = "LAUNCH_ONCE_ROLLBACK";
    throw err;
  }
}

// Bug B: launchStatus lives in memory/treasury.json, NOT in state.json. The
// caller is responsible for loading treasury.json (both prev and next
// snapshots) and passing them as the third arg. When no treasury arg is
// provided, the guard falls back to checking prev/next.treasury.token (the
// legacy synthesized shape) so existing call sites keep working until they
// migrate. The third-arg path is the canonical, non-dead version.
function assertTokenLaunchedDoesNotUnflip(prevState, nextState, treasurySnapshots) {
  let prevStatus = null;
  let nextStatus = null;

  if (treasurySnapshots && (treasurySnapshots.prevTreasury || treasurySnapshots.nextTreasury)) {
    const prevTreasury = treasurySnapshots.prevTreasury;
    const nextTreasury = treasurySnapshots.nextTreasury;
    prevStatus = prevTreasury && prevTreasury.token
      ? prevTreasury.token.launchStatus
      : null;
    nextStatus = nextTreasury && nextTreasury.token
      ? nextTreasury.token.launchStatus
      : null;
  } else {
    // Legacy shape: prev/next.treasury.token.launchStatus synthesized inside
    // the state object. Kept for backward compatibility with older call sites
    // and existing test fixtures.
    prevStatus = prevState && prevState.treasury && prevState.treasury.token
      ? prevState.treasury.token.launchStatus
      : null;
    nextStatus = nextState && nextState.treasury && nextState.treasury.token
      ? nextState.treasury.token.launchStatus
      : null;
  }

  if (prevStatus === "launched" && nextStatus !== "launched") {
    const err = new Error(
      "state-guard: refusing to write state — treasury.token.launchStatus was 'launched' and " +
      "would be changed. Launch status is terminal per D-019."
    );
    err.code = "LAUNCH_STATUS_ROLLBACK";
    throw err;
  }
}

// Bug B: third arg `treasurySnapshots` is optional ({ prevTreasury,
// nextTreasury }). Callers that have separate treasury.json snapshots should
// pass them so the launchStatus rollback guard actually sees the on-disk
// data — not the empty `prev.treasury` field that state.json never had.
function assertStateWriteSafe(prevState, nextState, treasurySnapshots) {
  assertLaunchOnceNotRolled(prevState, nextState);
  assertTokenLaunchedDoesNotUnflip(prevState, nextState, treasurySnapshots);
}

module.exports = {
  assertLaunchOnceNotRolled,
  assertStateWriteSafe,
  assertTokenLaunchedDoesNotUnflip
};
