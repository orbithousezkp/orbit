'use strict';

/**
 * @orbit-house/vanity-safe — main exports
 *
 * Public API:
 *   predictSafeAddress({ owners, threshold, saltNonce, ... }) -> "0x..."
 *   grindSync({ owners, threshold, suffix, ... })             -> { saltNonce, address, ... }
 *   grindParallel({ ..., workers: N })                        -> Promise<{ saltNonce, address, ... }>
 *
 * Constants:
 *   SAFE_PROXY_FACTORY, SAFE_L2_SINGLETON, SAFE_SINGLETON,
 *   COMPATIBILITY_FALLBACK_HANDLER, PROXY_CREATION_CODE
 *
 * Low-level helpers:
 *   encodeSetup, normalizeAddress, normalizeSuffix
 */

const safe = require('./safe');
const predict = require('./predict');
const grind = require('./grind');

module.exports = {
  // Constants
  SAFE_PROXY_FACTORY: safe.SAFE_PROXY_FACTORY,
  SAFE_L2_SINGLETON: safe.SAFE_L2_SINGLETON,
  SAFE_SINGLETON: safe.SAFE_SINGLETON,
  COMPATIBILITY_FALLBACK_HANDLER: safe.COMPATIBILITY_FALLBACK_HANDLER,
  PROXY_CREATION_CODE: safe.PROXY_CREATION_CODE,

  // Encoding / helpers
  encodeSetup: safe.encodeSetup,
  normalizeAddress: safe.normalizeAddress,
  normalizeSuffix: grind.normalizeSuffix,

  // Core
  predictSafeAddress: predict.predictSafeAddress,
  initCodeHashFor: predict.initCodeHashFor,
  computeSalt: predict.computeSalt,
  computeCreate2: predict.computeCreate2,

  // Grind
  grindSync: grind.grindSync,
  grindParallel: grind.grindParallel,
};
