"use strict";

/**
 * @orbithouse/proof-viewer — entry point
 *
 * Re-exports the full API from viewer.js so that
 *   require("@orbithouse/proof-viewer")
 * works correctly.
 *
 * Zero external dependencies.
 */

const viewer = require("./viewer");

module.exports = viewer;
