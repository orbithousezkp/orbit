'use strict';

const { keccak_256 } = require('@noble/hashes/sha3');

const {
  SAFE_PROXY_FACTORY,
  SAFE_L2_SINGLETON,
  PROXY_CREATION_CODE,
  COMPATIBILITY_FALLBACK_HANDLER,
  ZERO_ADDRESS,
  hexToBytes,
  bytesToHex,
  concat,
  pad32,
  padAddress,
  normalizeAddress,
  encodeSetup,
} = require('./safe');

function keccak(bytes) {
  return keccak_256(bytes);
}

/**
 * Compute the keccak256 hash of the proxy init code for a given singleton.
 * initCodeHash = keccak256( proxyCreationCode || uint256(uint160(singleton)) )
 *
 * Cached per-singleton because it never changes for a fixed singleton + factory version.
 */
const _initCodeHashCache = new Map();
function initCodeHashFor(singleton) {
  const key = normalizeAddress(singleton);
  let cached = _initCodeHashCache.get(key);
  if (cached) return cached;
  const code = hexToBytes(PROXY_CREATION_CODE);
  const singletonWord = padAddress(key);
  cached = keccak(concat(code, singletonWord));
  _initCodeHashCache.set(key, cached);
  return cached;
}

/**
 * Compute the CREATE2 salt used by SafeProxyFactory.createProxyWithNonce.
 *   salt = keccak256( keccak256(initializer) || uint256(saltNonce) )
 *
 * @param {Uint8Array} initializerBytes - the ABI-encoded setup() call
 * @param {bigint|number|string} saltNonce
 * @returns {Uint8Array} 32 bytes
 */
function computeSalt(initializerBytes, saltNonce) {
  const initHash = keccak(initializerBytes);
  return keccak(concat(initHash, pad32(saltNonce)));
}

/**
 * Compute the CREATE2 address.
 *   address = keccak256( 0xff || factory || salt || initCodeHash )[12:32]
 */
function computeCreate2(factory, salt, initCodeHash) {
  const buf = concat(
    new Uint8Array([0xff]),
    hexToBytes(normalizeAddress(factory)),
    salt,
    initCodeHash,
  );
  const h = keccak(buf);
  return h.slice(12); // 20-byte address
}

/**
 * Predict a Safe address for a given owners/threshold/saltNonce configuration.
 *
 * @param {object} opts
 * @param {string[]} opts.owners
 * @param {number|bigint} opts.threshold
 * @param {bigint|number|string} opts.saltNonce
 * @param {string} [opts.singleton] - default SAFE_L2_SINGLETON
 * @param {string} [opts.factory]   - default SAFE_PROXY_FACTORY
 * @param {string} [opts.fallbackHandler]
 * @param {string} [opts.to]
 * @param {string} [opts.data]
 * @param {string} [opts.paymentToken]
 * @param {bigint|number} [opts.payment]
 * @param {string} [opts.paymentReceiver]
 * @returns {string} 0x-prefixed lowercase 20-byte address
 */
function predictSafeAddress({
  owners,
  threshold,
  saltNonce,
  singleton = SAFE_L2_SINGLETON,
  factory = SAFE_PROXY_FACTORY,
  fallbackHandler = COMPATIBILITY_FALLBACK_HANDLER,
  to = ZERO_ADDRESS,
  data = '0x',
  paymentToken = ZERO_ADDRESS,
  payment = 0n,
  paymentReceiver = ZERO_ADDRESS,
}) {
  const initializer = encodeSetup({
    owners,
    threshold,
    to,
    data,
    fallbackHandler,
    paymentToken,
    payment,
    paymentReceiver,
  });
  const salt = computeSalt(initializer, saltNonce);
  const codeHash = initCodeHashFor(singleton);
  const addrBytes = computeCreate2(factory, salt, codeHash);
  return '0x' + bytesToHex(addrBytes);
}

/**
 * Lower-level prediction helper for grind loops. Avoids re-encoding the
 * initializer on every attempt by accepting a precomputed initializer hash
 * and singleton initCodeHash. The hot path inside grind workers uses this.
 *
 * @param {Uint8Array} initializerHash - keccak256 of the initializer (32 bytes)
 * @param {Uint8Array} factoryBytes - 20 bytes
 * @param {Uint8Array} initCodeHash - 32 bytes
 * @param {bigint} saltNonce
 * @returns {Uint8Array} 20-byte address
 */
function predictFast(initializerHash, factoryBytes, initCodeHash, saltNonce) {
  const salt = keccak(concat(initializerHash, pad32(saltNonce)));
  const h = keccak(
    concat(new Uint8Array([0xff]), factoryBytes, salt, initCodeHash),
  );
  return h.slice(12);
}

module.exports = {
  keccak,
  initCodeHashFor,
  computeSalt,
  computeCreate2,
  predictSafeAddress,
  predictFast,
};
