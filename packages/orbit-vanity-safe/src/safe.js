'use strict';

/**
 * Safe v1.4.1 deployment constants and ABI encoding for setup().
 *
 * Authoritative source: https://github.com/safe-global/safe-deployments
 * Cross-checked against the verified SafeProxyFactory contract at
 * 0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67 on Base mainnet (and all
 * EVM chains where Safe v1.4.1 is canonical).
 *
 * Address derivation per SafeProxyFactory.createProxyWithNonce:
 *   salt         = keccak256( keccak256(initializer) || uint256(saltNonce) )
 *   initCodeHash = keccak256( proxyCreationCode || uint256(uint160(singleton)) )
 *   address      = keccak256( 0xff || factory || salt || initCodeHash )[12:32]
 *
 * No private keys are involved. We only search the saltNonce space.
 */

// Safe v1.4.1 canonical addresses (same across most EVM chains).
const SAFE_PROXY_FACTORY = '0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67';
const SAFE_L2_SINGLETON = '0x29fcB43b46531BcA003ddC8FCB67FFE91900C762';
const SAFE_SINGLETON = '0x41675C099F32341bf84BFc5382aF534df5C7461a';
const COMPATIBILITY_FALLBACK_HANDLER =
  '0xfd0732Dc9E303f09fCEf3a7388Ad10A83459Ec99';

// SafeProxy v1.4.1 creation bytecode, returned by
// SafeProxyFactory.proxyCreationCode() — verified against the on-chain factory.
// Authoritative reference: `cast call 0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67 "proxyCreationCode()(bytes)"`
// Single 972-hex-char string (486 bytes); do not reformat with line breaks.
// eslint-disable-next-line max-len
const PROXY_CREATION_CODE = '0x608060405234801561001057600080fd5b506040516101e63803806101e68339818101604052602081101561003357600080fd5b8101908080519060200190929190505050600073ffffffffffffffffffffffffffffffffffffffff168173ffffffffffffffffffffffffffffffffffffffff1614156100ca576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004018080602001828103825260228152602001806101c46022913960400191505060405180910390fd5b806000806101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff1602179055505060ab806101196000396000f3fe608060405273ffffffffffffffffffffffffffffffffffffffff600054167fa619486e0000000000000000000000000000000000000000000000000000000060003514156050578060005260206000f35b3660008037600080366000845af43d6000803e60008114156070573d6000fd5b3d6000f3fea264697066735822122003d1488ee65e08fa41e58e888a9865554c535f2c77126a82cb4c0f917f31441364736f6c63430007060033496e76616c69642073696e676c65746f6e20616464726573732070726f7669646564';

// Function selector for setup(address[],uint256,address,bytes,address,address,uint256,address)
// keccak256("setup(address[],uint256,address,bytes,address,address,uint256,address)")[0:4]
const SETUP_SELECTOR = '0xb63e800d';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

/* ---------- Hex / byte helpers ---------- */

/**
 * Strip leading 0x and lowercase. Throws on invalid hex shape.
 */
function stripHex(s) {
  if (typeof s !== 'string') {
    throw new TypeError('hex input must be a string');
  }
  let h = s.toLowerCase();
  if (h.startsWith('0x')) h = h.slice(2);
  if (h.length % 2 !== 0) {
    throw new Error('hex input has odd length');
  }
  if (!/^[0-9a-f]*$/.test(h)) {
    throw new Error('hex input contains non-hex characters');
  }
  return h;
}

function hexToBytes(s) {
  const h = stripHex(s);
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function bytesToHex(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i++) {
    s += bytes[i].toString(16).padStart(2, '0');
  }
  return s;
}

function concat(...parts) {
  let len = 0;
  for (const p of parts) len += p.length;
  const out = new Uint8Array(len);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

/**
 * Pack a non-negative integer (bigint, number, or numeric string) into a 32-byte big-endian word.
 */
function pad32(value) {
  let v;
  if (typeof value === 'bigint') v = value;
  else if (typeof value === 'number') {
    if (!Number.isInteger(value) || value < 0) {
      throw new Error('pad32 needs a non-negative integer');
    }
    v = BigInt(value);
  } else if (typeof value === 'string') {
    if (value.startsWith('0x') || value.startsWith('0X')) {
      v = BigInt(value);
    } else {
      v = BigInt(value);
    }
  } else {
    throw new TypeError('pad32 expects bigint, number, or string');
  }
  if (v < 0n) throw new Error('pad32 received negative value');
  if (v >= 1n << 256n) throw new Error('pad32 value does not fit in 256 bits');
  const out = new Uint8Array(32);
  for (let i = 31; i >= 0; i--) {
    out[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return out;
}

/**
 * Pack an address into 32 bytes (left-padded with zeros).
 */
function padAddress(addr) {
  const raw = hexToBytes(addr);
  if (raw.length !== 20) {
    throw new Error(`address must be 20 bytes, got ${raw.length}`);
  }
  const out = new Uint8Array(32);
  out.set(raw, 12);
  return out;
}

/* ---------- Address validation ---------- */

/**
 * Validates an address shape (0x + 40 hex chars). Returns the normalized lowercase form.
 * Does NOT check EIP-55 checksum — Safe accepts any valid 20-byte address.
 */
function normalizeAddress(addr) {
  if (typeof addr !== 'string') {
    throw new TypeError(`address must be a string, got ${typeof addr}`);
  }
  if (!/^0x[0-9a-fA-F]{40}$/.test(addr)) {
    throw new Error(`invalid address: ${addr}`);
  }
  return '0x' + addr.slice(2).toLowerCase();
}

/* ---------- setup() initializer encoding ---------- */

/**
 * Encode the Safe setup() call as ABI calldata.
 *
 * setup(
 *   address[] _owners,        // dynamic
 *   uint256   _threshold,
 *   address   to,
 *   bytes     data,           // dynamic
 *   address   fallbackHandler,
 *   address   paymentToken,
 *   uint256   payment,
 *   address   paymentReceiver,
 * )
 *
 * Layout (after the 4-byte selector):
 *   word 0  : offset of _owners (head length = 8 * 32 = 256 = 0x100)
 *   word 1  : _threshold
 *   word 2  : to
 *   word 3  : offset of data
 *   word 4  : fallbackHandler
 *   word 5  : paymentToken
 *   word 6  : payment
 *   word 7  : paymentReceiver
 *   tail    : owners length, owners..., data length, data padded to 32
 */
function encodeSetup({
  owners,
  threshold,
  to = ZERO_ADDRESS,
  data = '0x',
  fallbackHandler = COMPATIBILITY_FALLBACK_HANDLER,
  paymentToken = ZERO_ADDRESS,
  payment = 0n,
  paymentReceiver = ZERO_ADDRESS,
}) {
  if (!Array.isArray(owners) || owners.length === 0) {
    throw new Error('owners must be a non-empty array');
  }
  const normOwners = owners.map((o, i) => {
    try {
      return normalizeAddress(o);
    } catch (e) {
      throw new Error(`owners[${i}]: ${e.message}`);
    }
  });
  // Reject duplicates (Safe's setupOwners reverts on this; surface early).
  const seen = new Set();
  for (const o of normOwners) {
    if (seen.has(o)) throw new Error(`duplicate owner: ${o}`);
    if (o === ZERO_ADDRESS) throw new Error('owner cannot be zero address');
    seen.add(o);
  }
  const thr =
    typeof threshold === 'bigint' ? threshold : BigInt(threshold);
  if (thr <= 0n) throw new Error('threshold must be >= 1');
  if (thr > BigInt(normOwners.length)) {
    throw new Error(
      `threshold ${thr} exceeds owners.length ${normOwners.length}`,
    );
  }
  const normTo = normalizeAddress(to);
  const normFbh = normalizeAddress(fallbackHandler);
  const normPt = normalizeAddress(paymentToken);
  const normPr = normalizeAddress(paymentReceiver);
  const pay =
    typeof payment === 'bigint' ? payment : BigInt(payment);

  const dataBytes = hexToBytes(data);

  // Head: 8 words = 256 bytes = 0x100
  const HEAD_LEN = 8 * 32;
  // Owners tail: 32 (length) + 32 * N
  const ownersTailLen = 32 + 32 * normOwners.length;
  // Data tail: 32 (length) + ceil(dataBytes.length / 32) * 32
  const dataPaddedLen = Math.ceil(dataBytes.length / 32) * 32;
  // (Owners offset = HEAD_LEN, Data offset = HEAD_LEN + ownersTailLen)

  const headParts = [
    pad32(HEAD_LEN),                  // offset of _owners
    pad32(thr),                       // _threshold
    padAddress(normTo),               // to
    pad32(HEAD_LEN + ownersTailLen),  // offset of data
    padAddress(normFbh),              // fallbackHandler
    padAddress(normPt),               // paymentToken
    pad32(pay),                       // payment
    padAddress(normPr),               // paymentReceiver
  ];

  const ownersTailParts = [pad32(normOwners.length)];
  for (const o of normOwners) ownersTailParts.push(padAddress(o));

  const dataPadded = new Uint8Array(dataPaddedLen);
  dataPadded.set(dataBytes, 0);
  const dataTailParts = [pad32(dataBytes.length), dataPadded];

  const selector = hexToBytes(SETUP_SELECTOR);
  const body = concat(
    ...headParts,
    ...ownersTailParts,
    ...dataTailParts,
  );
  return concat(selector, body);
}

module.exports = {
  SAFE_PROXY_FACTORY,
  SAFE_L2_SINGLETON,
  SAFE_SINGLETON,
  COMPATIBILITY_FALLBACK_HANDLER,
  PROXY_CREATION_CODE,
  SETUP_SELECTOR,
  ZERO_ADDRESS,
  // helpers
  hexToBytes,
  bytesToHex,
  concat,
  pad32,
  padAddress,
  normalizeAddress,
  stripHex,
  encodeSetup,
};
