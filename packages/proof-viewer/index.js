"use strict";

/**
 * @orbit-house/proof-viewer — entry point
 *
 * Re-exports the full API from viewer.js so that
 *   require("@orbit-house/proof-viewer")
 * works correctly.
 *
 * Zero external dependencies.
 */

const viewer = require("./viewer");

module.exports = viewer;
