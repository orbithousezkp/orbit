/**
 * Web3 Keystore v3 encode/decode.
 *
 * Reference: https://ethereum.org/en/developers/docs/data-structures-and-encoding/web3-secret-storage/
 *
 * Format:
 *   {
 *     "address":  "<40-hex no 0x>",
 *     "crypto": {
 *       "cipher":       "aes-128-ctr",
 *       "cipherparams": { "iv": "<32-hex>" },
 *       "ciphertext":   "<hex>",
 *       "kdf":          "scrypt",
 *       "kdfparams":    { "dklen": 32, "n": 131072, "p": 1, "r": 8, "salt": "<64-hex>" },
 *       "mac":          "<64-hex>"
 *     },
 *     "id":      "<uuid>",
 *     "version": 3
 *   }
 *
 * Encryption flow:
 *   derivedKey = scrypt(passphrase, salt, dklen=32, N, r, p)
 *   ciphertext = AES-128-CTR(derivedKey[0:16], iv, privateKey)
 *   mac        = keccak256(derivedKey[16:32] || ciphertext)
 */

'use strict';

const crypto = require('crypto');
const { promisify } = require('util');
const { addressFromPrivate, keccak256 } = require('./eth');

const scryptAsync = promisify(crypto.scrypt);

const DEFAULTS = {
  kdfN: 131072,
  kdfR: 8,
  kdfP: 1,
  dklen: 32,
};

/**
 * Encrypt a 32-byte private key into a Web3 Keystore v3 object.
 *
 * @param {Buffer} privateKey - 32-byte private key
 * @param {string} passphrase - user passphrase
 * @param {object} [opts]
 * @param {number} [opts.kdfN=131072] - scrypt N parameter (must be power of 2)
 * @param {number} [opts.kdfR=8]      - scrypt r
 * @param {number} [opts.kdfP=1]      - scrypt p
 * @param {Buffer} [opts.salt]        - 32-byte salt (auto-generated if absent)
 * @param {Buffer} [opts.iv]          - 16-byte IV (auto-generated if absent)
 * @param {string} [opts.id]          - keystore UUID (auto-generated if absent)
 * @returns {Promise<object>} v3 keystore object
 */
async function encrypt(privateKey, passphrase, opts = {}) {
  if (!Buffer.isBuffer(privateKey) || privateKey.length !== 32) {
    throw new Error('private_key_must_be_32_byte_buffer');
  }
  if (typeof passphrase !== 'string' || passphrase.length === 0) {
    throw new Error('passphrase_required');
  }

  const kdfN = opts.kdfN || DEFAULTS.kdfN;
  const kdfR = opts.kdfR || DEFAULTS.kdfR;
  const kdfP = opts.kdfP || DEFAULTS.kdfP;
  const dklen = DEFAULTS.dklen;

  if ((kdfN & (kdfN - 1)) !== 0 || kdfN < 2) {
    throw new Error('kdf_n_must_be_power_of_two');
  }

  const salt = opts.salt || crypto.randomBytes(32);
  const iv = opts.iv || crypto.randomBytes(16);
  const id = opts.id || crypto.randomUUID();

  // Node's scrypt enforces a memory cost ceiling; bump for production-grade N.
  const maxmem = 256 * kdfN * kdfR; // a comfortable upper bound
  const derivedKey = await scryptAsync(
    Buffer.from(passphrase, 'utf8'),
    salt,
    dklen,
    { N: kdfN, r: kdfR, p: kdfP, maxmem }
  );

  const encryptKey = derivedKey.slice(0, 16);
  const macKey = derivedKey.slice(16, 32);

  const cipher = crypto.createCipheriv('aes-128-ctr', encryptKey, iv);
  const ciphertext = Buffer.concat([cipher.update(privateKey), cipher.final()]);

  const mac = keccak256(Buffer.concat([macKey, ciphertext]));

  const address = addressFromPrivate(privateKey).replace(/^0x/, '');

  return {
    address,
    crypto: {
      cipher: 'aes-128-ctr',
      cipherparams: { iv: iv.toString('hex') },
      ciphertext: ciphertext.toString('hex'),
      kdf: 'scrypt',
      kdfparams: {
        dklen,
        n: kdfN,
        p: kdfP,
        r: kdfR,
        salt: salt.toString('hex'),
      },
      mac: mac.toString('hex'),
    },
    id,
    version: 3,
  };
}

/**
 * Decrypt a Web3 Keystore v3 object back to a 32-byte private key.
 * Verifies the MAC before returning.
 *
 * Throws Error with code "mac_mismatch" on wrong passphrase (or corrupted file).
 *
 * @param {object} keystore - v3 keystore object
 * @param {string} passphrase - user passphrase
 * @returns {Promise<Buffer>} 32-byte private key
 */
async function decrypt(keystore, passphrase) {
  validateShape(keystore);

  const { kdf, kdfparams, ciphertext, cipher, cipherparams, mac } = keystore.crypto;
  if (kdf !== 'scrypt') {
    throw new Error(`unsupported_kdf:${kdf}`);
  }
  if (cipher !== 'aes-128-ctr') {
    throw new Error(`unsupported_cipher:${cipher}`);
  }

  const salt = Buffer.from(kdfparams.salt, 'hex');
  const iv = Buffer.from(cipherparams.iv, 'hex');
  const ct = Buffer.from(ciphertext, 'hex');
  const expectedMac = mac.toLowerCase();

  const kdfN = kdfparams.n;
  const kdfR = kdfparams.r;
  const kdfP = kdfparams.p;
  const dklen = kdfparams.dklen || 32;

  const maxmem = 256 * kdfN * kdfR;
  const derivedKey = await scryptAsync(
    Buffer.from(passphrase, 'utf8'),
    salt,
    dklen,
    { N: kdfN, r: kdfR, p: kdfP, maxmem }
  );

  const macKey = derivedKey.slice(16, 32);
  const actualMac = keccak256(Buffer.concat([macKey, ct])).toString('hex');

  // Timing-safe comparison: hex string !== is byte-by-byte short-circuit,
  // which leaks how many leading MAC bytes an attacker has guessed.
  // crypto.timingSafeEqual requires equal-length inputs; the length check
  // is itself constant-time enough because the attacker doesn't control
  // the expected MAC length (always 32 bytes for keccak256).
  const actualBuf = Buffer.from(actualMac, 'hex');
  const expectedBuf = Buffer.from(expectedMac, 'hex');
  if (
    actualBuf.length !== expectedBuf.length ||
    !crypto.timingSafeEqual(actualBuf, expectedBuf)
  ) {
    const err = new Error('mac_mismatch');
    err.code = 'mac_mismatch';
    throw err;
  }

  const decipher = crypto.createDecipheriv('aes-128-ctr', derivedKey.slice(0, 16), iv);
  const privateKey = Buffer.concat([decipher.update(ct), decipher.final()]);
  if (privateKey.length !== 32) {
    throw new Error('decrypted_key_wrong_length');
  }
  return privateKey;
}

/**
 * Confirm a keystore object is structurally valid v3. Throws if not.
 *
 * @param {*} keystore
 */
function validateShape(keystore) {
  if (!keystore || typeof keystore !== 'object') {
    throw new Error('keystore_not_object');
  }
  if (keystore.version !== 3) {
    throw new Error(`unsupported_keystore_version:${keystore.version}`);
  }
  if (typeof keystore.id !== 'string') throw new Error('missing_id');
  if (typeof keystore.address !== 'string') throw new Error('missing_address');
  const c = keystore.crypto;
  if (!c || typeof c !== 'object') throw new Error('missing_crypto');
  for (const k of ['cipher', 'cipherparams', 'ciphertext', 'kdf', 'kdfparams', 'mac']) {
    if (!(k in c)) throw new Error(`missing_crypto_${k}`);
  }
  if (typeof c.cipherparams.iv !== 'string') throw new Error('missing_cipherparams_iv');
  const p = c.kdfparams;
  for (const k of ['dklen', 'n', 'p', 'r', 'salt']) {
    if (!(k in p)) throw new Error(`missing_kdfparams_${k}`);
  }
}

module.exports = {
  encrypt,
  decrypt,
  validateShape,
  DEFAULTS,
};
