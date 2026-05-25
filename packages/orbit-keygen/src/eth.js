/**
 * Ethereum key utilities: secp256k1 public-key derivation and address
 * derivation via keccak-256.
 *
 * IMPORTANT: Keccak-256 is the original Keccak finalist, NOT the same as
 * NIST SHA3-256 (different padding byte). Node's built-in crypto exposes
 * "sha3-256" which is the NIST variant and will NOT produce the right
 * address. We use @noble/hashes/sha3 keccak_256 which is the Ethereum
 * variant.
 */

'use strict';

const { secp256k1 } = require('@noble/curves/secp256k1');
const { keccak_256 } = require('@noble/hashes/sha3');

/**
 * Derive the 65-byte uncompressed secp256k1 public key from a 32-byte
 * private key. First byte is 0x04 followed by 32-byte X and 32-byte Y.
 *
 * @param {Buffer|Uint8Array} privateKey - 32-byte private key
 * @returns {Uint8Array} 65-byte uncompressed public key
 */
function publicKeyFromPrivate(privateKey) {
  const pk = toUint8(privateKey);
  if (pk.length !== 32) {
    throw new Error('private_key_must_be_32_bytes');
  }
  // false = uncompressed (65 bytes, leading 0x04)
  return secp256k1.getPublicKey(pk, false);
}

/**
 * Compute Ethereum address (0x-prefixed, lowercase 40 hex chars) from a
 * 32-byte private key.
 *
 *   address = "0x" + keccak256(publicKey[1:65])[12:32]
 *
 * The leading 0x04 byte of the uncompressed public key is dropped before
 * hashing.
 *
 * @param {Buffer|Uint8Array} privateKey - 32-byte private key
 * @returns {string} "0x" + 40 lowercase hex chars
 */
function addressFromPrivate(privateKey) {
  const pub = publicKeyFromPrivate(privateKey);
  const hash = keccak_256(pub.slice(1));
  return '0x' + Buffer.from(hash).slice(12).toString('hex');
}

/**
 * Compute Ethereum address from an uncompressed public key (65 bytes
 * starting with 0x04) or a raw 64-byte X||Y form.
 *
 * @param {Buffer|Uint8Array} publicKey
 * @returns {string} "0x" + 40 lowercase hex chars
 */
function addressFromPublicKey(publicKey) {
  const pub = toUint8(publicKey);
  let xy;
  if (pub.length === 65 && pub[0] === 0x04) {
    xy = pub.slice(1);
  } else if (pub.length === 64) {
    xy = pub;
  } else {
    throw new Error('public_key_must_be_64_or_65_bytes_uncompressed');
  }
  const hash = keccak_256(xy);
  return '0x' + Buffer.from(hash).slice(12).toString('hex');
}

/**
 * Keccak-256 of arbitrary bytes (Ethereum variant, not NIST SHA3-256).
 *
 * @param {Buffer|Uint8Array|string} input - bytes or hex string
 * @returns {Buffer} 32-byte hash
 */
function keccak256(input) {
  let bytes;
  if (typeof input === 'string') {
    bytes = Buffer.from(input, 'hex');
  } else {
    bytes = toUint8(input);
  }
  return Buffer.from(keccak_256(bytes));
}

function toUint8(buf) {
  if (buf instanceof Uint8Array) return buf;
  if (Buffer.isBuffer(buf)) return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  throw new Error('expected_bytes');
}

module.exports = {
  publicKeyFromPrivate,
  addressFromPrivate,
  addressFromPublicKey,
  keccak256,
};
