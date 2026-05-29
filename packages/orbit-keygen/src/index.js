/**
 * @orbithouse/keygen — programmatic API
 *
 * Top-level entrypoint exporting keystore encrypt/decrypt, address
 * derivation, hidden passphrase prompts, and CLI helpers. Designed so other
 * Orbit packages can call into the same primitives the CLI uses (e.g. an
 * automated launch-day script that loads a keystore, decrypts in-memory,
 * signs a transaction, and zeroes the key) without forking the security
 * model.
 *
 * The CLI itself is in src/cli.js (entrypoint bin.js).
 */

'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const keystore = require('./keystore');
const eth = require('./eth');
const prompts = require('./prompts');

/**
 * Generate a 32-byte private key using Node's CSPRNG.
 *
 * @returns {Buffer}
 */
function generatePrivateKey() {
  // secp256k1 group order; we reject keys >= n (vanishingly improbable but defensive)
  const N = BigInt('0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141');
  for (;;) {
    const buf = crypto.randomBytes(32);
    const asInt = BigInt('0x' + buf.toString('hex'));
    if (asInt > 0n && asInt < N) return buf;
  }
}

/**
 * Generate a fresh keypair: returns the 32-byte private key and the
 * 0x-prefixed Ethereum address.
 *
 * @returns {{ privateKey: Buffer, address: string }}
 */
function generateKeypair() {
  const privateKey = generatePrivateKey();
  const address = eth.addressFromPrivate(privateKey);
  return { privateKey, address };
}

/**
 * Resolve the directory used for keystore files. Defaults to ./keys/
 * relative to the caller's cwd.
 *
 * @param {string} [dir]
 * @returns {string}
 */
function resolveKeystoreDir(dir) {
  return path.resolve(dir || path.join(process.cwd(), 'keys'));
}

/**
 * Resolve the full path for a named slot inside the keystore dir.
 *
 * @param {string} slot
 * @param {string} [dir]
 * @returns {string}
 */
function slotPath(slot, dir) {
  if (!/^[A-Za-z0-9._-]+$/.test(slot)) {
    throw new Error('slot_must_be_alphanumeric_or_._-');
  }
  return path.join(resolveKeystoreDir(dir), `${slot}.json`);
}

/**
 * Ensure the keystore directory exists.
 *
 * @param {string} [dir]
 * @returns {string} absolute path of dir
 */
function ensureKeystoreDir(dir) {
  const target = resolveKeystoreDir(dir);
  fs.mkdirSync(target, { recursive: true });
  return target;
}

/**
 * Ensure `keys/` is listed in .gitignore. Adds a line if missing.
 *
 * Idempotent. Returns true if a write happened, false if already present.
 *
 * @param {string} [cwd=process.cwd()]
 * @returns {boolean}
 */
function ensureGitignore(cwd) {
  const base = cwd || process.cwd();
  const file = path.join(base, '.gitignore');
  let existing = '';
  if (fs.existsSync(file)) {
    existing = fs.readFileSync(file, 'utf8');
    if (/^keys\/?\s*$/m.test(existing) || /^\/keys\/?\s*$/m.test(existing)) {
      return false;
    }
  }
  const prefix = existing.length > 0 && !existing.endsWith('\n') ? '\n' : '';
  const block = `${prefix}# orbit-keygen: never commit local keystores\nkeys/\n`;
  fs.writeFileSync(file, existing + block, 'utf8');
  return true;
}

/**
 * List all keystore files in the given directory, returning slot + address
 * for each.
 *
 * @param {string} [dir]
 * @returns {Array<{ slot: string, file: string, address: string, valid: boolean, error?: string }>}
 */
function listKeystores(dir) {
  const target = resolveKeystoreDir(dir);
  if (!fs.existsSync(target)) return [];
  const out = [];
  for (const entry of fs.readdirSync(target).sort()) {
    if (!entry.endsWith('.json')) continue;
    const full = path.join(target, entry);
    const slot = entry.slice(0, -5);
    try {
      const ks = JSON.parse(fs.readFileSync(full, 'utf8'));
      keystore.validateShape(ks);
      out.push({
        slot,
        file: full,
        address: '0x' + ks.address.toLowerCase().replace(/^0x/, ''),
        valid: true,
      });
    } catch (err) {
      out.push({
        slot,
        file: full,
        address: '',
        valid: false,
        error: err.message || String(err),
      });
    }
  }
  return out;
}

/**
 * Read a keystore file and return the parsed object.
 *
 * @param {string} slot
 * @param {string} [dir]
 * @returns {object}
 */
function loadKeystore(slot, dir) {
  const file = slotPath(slot, dir);
  if (!fs.existsSync(file)) {
    const err = new Error(`keystore_not_found:${file}`);
    err.code = 'keystore_not_found';
    err.file = file;
    throw err;
  }
  const ks = JSON.parse(fs.readFileSync(file, 'utf8'));
  keystore.validateShape(ks);
  return ks;
}

/**
 * Encrypt a private key and write it to ./keys/<slot>.json.
 *
 * @param {object} args
 * @param {string} args.slot
 * @param {Buffer} args.privateKey
 * @param {string} args.passphrase
 * @param {string} [args.dir]
 * @param {boolean} [args.force=false]
 * @param {object} [args.kdf] - { N, r, p } overrides
 * @returns {Promise<{ file: string, address: string, keystore: object }>}
 */
async function writeKeystore(args) {
  const { slot, privateKey, passphrase, dir, force = false, kdf = {} } = args;
  ensureKeystoreDir(dir);
  const file = slotPath(slot, dir);
  if (!force && fs.existsSync(file)) {
    const err = new Error(`keystore_exists:${file}`);
    err.code = 'keystore_exists';
    err.file = file;
    throw err;
  }
  const ks = await keystore.encrypt(privateKey, passphrase, {
    kdfN: kdf.N,
    kdfR: kdf.r,
    kdfP: kdf.p,
  });
  // Atomic write: a crash mid-write would otherwise leave a truncated
  // keystore at `file`, and for a freshly-generated key the plaintext
  // has already been wiped from memory — i.e. permanent key loss.
  // Write to a tmp file (create-or-fail, owner-only), fsync, then rename
  // (POSIX rename is atomic and allows overwrite, so `force` semantics
  // still hold via the existsSync gate above).
  const payload = JSON.stringify(ks, null, 2) + '\n';
  const tmpPath = `${file}.tmp.${process.pid}.${Date.now()}`;
  const fd = fs.openSync(tmpPath, 'wx', 0o600);
  try {
    fs.writeSync(fd, payload);
    fs.fsyncSync(fd);
  } catch (err) {
    try { fs.closeSync(fd); } catch {}
    try { fs.unlinkSync(tmpPath); } catch {}
    throw err;
  }
  fs.closeSync(fd);
  try {
    fs.renameSync(tmpPath, file);
  } catch (err) {
    try { fs.unlinkSync(tmpPath); } catch {}
    throw err;
  }
  // Defensive chmod: some filesystems (e.g. fuse, certain NFS mounts) do
  // not preserve mode bits through rename. openSync's mode is also
  // umask-masked on some platforms.
  try { fs.chmodSync(file, 0o600); } catch {}
  return {
    file,
    address: '0x' + ks.address,
    keystore: ks,
  };
}

/**
 * Best-effort wipe of a Buffer in-place. Node Buffers reside on the V8
 * heap so this isn't a hard guarantee against memory inspection but
 * prevents accidental retention/printing.
 *
 * @param {Buffer} buf
 */
function wipe(buf) {
  if (Buffer.isBuffer(buf)) {
    try { buf.fill(0); } catch {}
  }
}

module.exports = {
  // primitives
  generatePrivateKey,
  generateKeypair,
  // filesystem helpers
  resolveKeystoreDir,
  slotPath,
  ensureKeystoreDir,
  ensureGitignore,
  listKeystores,
  loadKeystore,
  writeKeystore,
  wipe,
  // re-exports
  keystore,
  eth,
  prompts,
};
