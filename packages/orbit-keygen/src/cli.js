/**
 * orbit-keygen CLI dispatcher.
 *
 * Commands:
 *   new <slot>      Generate + encrypt + write ./keys/<slot>.json
 *   address <slot>  Print address from keystore metadata (no decrypt)
 *   list            List all keystores in ./keys/
 *   verify <slot>   Decrypt with passphrase, verify address matches
 *   --help          Usage
 *
 * Options:
 *   --out <dir>    Output directory (default ./keys/)
 *   --force        Overwrite existing keystore
 *   --show-key     After `new`, print the private key (LOUD WARNING)
 *   --kdf-n <N>    scrypt N parameter (default 131072; 1024 for tests)
 */

'use strict';

const fs = require('fs');
const path = require('path');

const lib = require('./index');
const {
  generateKeypair,
  ensureGitignore,
  ensureKeystoreDir,
  listKeystores,
  loadKeystore,
  writeKeystore,
  wipe,
  keystore: keystoreLib,
  eth,
  prompts: promptsLib,
} = lib;

const USAGE = `orbit-keygen — local Ethereum keystore generator

Commands:
  new <slot>         Generate a new keypair, encrypt with passphrase,
                     write to ./keys/<slot>.json. Prints only the address.
  address <slot>     Print the Ethereum address from ./keys/<slot>.json
                     (no passphrase required).
  list               List all keystores in ./keys/ with addresses.
  verify <slot>      Prompt for passphrase, decrypt, and confirm the
                     derived address matches the keystore metadata.
  help               Show this message.

Options:
  --out <dir>        Output directory (default: ./keys/)
  --force            Overwrite existing keystore on \`new\`
  --show-key         After \`new\`, print private key to stdout (DANGEROUS;
                     prints a loud warning, default OFF).
  --kdf-n <N>        scrypt N parameter (default 131072; 1024 for tests).

Security:
  Private keys never leave the local filesystem. Keystores are encrypted
  with scrypt + AES-128-CTR (Web3 Keystore v3, the format MetaMask, Frame,
  and geth import). Back up ./keys/<slot>.json AND your passphrase
  separately. The \`keys/\` directory is auto-added to .gitignore.
`;

function parseArgs(argv) {
  const args = {
    command: null,
    slot: null,
    out: null,
    force: false,
    showKey: false,
    kdfN: null,
    help: false,
  };
  let i = 0;
  while (i < argv.length) {
    const a = argv[i];
    if (a === '--help' || a === '-h' || a === 'help') {
      args.help = true;
    } else if (a === '--out') {
      args.out = argv[++i];
    } else if (a === '--force') {
      args.force = true;
    } else if (a === '--show-key') {
      args.showKey = true;
    } else if (a === '--kdf-n') {
      args.kdfN = parseInt(argv[++i], 10);
    } else if (!args.command) {
      args.command = a;
    } else if (!args.slot) {
      args.slot = a;
    } else {
      // ignore extra positional
    }
    i++;
  }
  return args;
}

async function cmdNew(args, env) {
  if (!args.slot) throw usageError('slot_required: orbit-keygen new <slot>');
  const dir = ensureKeystoreDir(args.out);
  const file = path.join(dir, `${args.slot}.json`);
  if (!args.force && fs.existsSync(file)) {
    env.err(`ERROR: keystore already exists at ${file}`);
    env.err('       Use --force to overwrite (this destroys the existing key!).');
    return 1;
  }

  // Auto-add keys/ to .gitignore (idempotent).
  const wroteGitignore = ensureGitignore(process.cwd());

  env.err(`Generating keypair for slot "${args.slot}"...`);
  env.err('You will be prompted for a passphrase (entered twice).');
  env.err('The passphrase encrypts the key on disk. It cannot be recovered if lost.');

  const passphrase = await promptsLib.readPassphraseConfirmed({
    label: 'Passphrase',
    minLength: 8,
    input: env.stdin,
    output: env.stderr,
  });

  const kp = generateKeypair();
  try {
    const result = await writeKeystore({
      slot: args.slot,
      privateKey: kp.privateKey,
      passphrase,
      dir: args.out,
      force: args.force,
      kdf: args.kdfN ? { N: args.kdfN } : {},
    });

    // Primary output (stdout): just the address. Scriptable.
    env.out(result.address);

    // Reminders + side-effect notices on stderr so stdout stays clean.
    env.err('');
    env.err(`Private key is encrypted in ${result.file}.`);
    env.err('Back up this file AND your passphrase separately. Never commit ./keys/ to git.');
    if (wroteGitignore) {
      env.err('Added "keys/" to .gitignore.');
    }

    if (args.showKey) {
      env.err('');
      env.err('================================================================');
      env.err('WARNING: --show-key was passed. Printing PRIVATE KEY to stdout.');
      env.err('         Anyone seeing your screen, terminal scrollback, shell');
      env.err('         history, or session log can steal this key. Do NOT use');
      env.err('         this flag outside a freshly-booted air-gapped machine.');
      env.err('================================================================');
      env.out('0x' + kp.privateKey.toString('hex'));
    }

    return 0;
  } finally {
    // Best-effort wipe of the in-memory private key buffer.
    wipe(kp.privateKey);
  }
}

function cmdAddress(args, env) {
  if (!args.slot) throw usageError('slot_required: orbit-keygen address <slot>');
  try {
    const ks = loadKeystore(args.slot, args.out);
    env.out('0x' + ks.address.toLowerCase().replace(/^0x/, ''));
    return 0;
  } catch (err) {
    if (err.code === 'keystore_not_found') {
      env.err(`ERROR: no keystore at ${err.file}`);
      return 1;
    }
    throw err;
  }
}

function cmdList(args, env) {
  const items = listKeystores(args.out);
  if (items.length === 0) {
    const dir = lib.resolveKeystoreDir(args.out);
    env.err(`No keystores found in ${dir}`);
    return 0;
  }
  // Column-aligned plain text: <slot>\t<address>\t<file>
  const maxSlot = Math.max(...items.map((i) => i.slot.length), 4);
  for (const it of items) {
    if (it.valid) {
      env.out(`${pad(it.slot, maxSlot)}  ${it.address}  ${it.file}`);
    } else {
      env.out(`${pad(it.slot, maxSlot)}  [invalid: ${it.error}]  ${it.file}`);
    }
  }
  return 0;
}

async function cmdVerify(args, env) {
  if (!args.slot) throw usageError('slot_required: orbit-keygen verify <slot>');
  let ks;
  try {
    ks = loadKeystore(args.slot, args.out);
  } catch (err) {
    if (err.code === 'keystore_not_found') {
      env.err(`ERROR: no keystore at ${err.file}`);
      return 1;
    }
    throw err;
  }

  const passphrase = await promptsLib.readPassphrase({
    label: 'Passphrase',
    input: env.stdin,
    output: env.stderr,
  });

  let privateKey;
  try {
    privateKey = await keystoreLib.decrypt(ks, passphrase);
  } catch (err) {
    if (err.code === 'mac_mismatch') {
      env.err('FAIL: wrong passphrase (mac_mismatch).');
      return 2;
    }
    throw err;
  }

  try {
    const derived = eth.addressFromPrivate(privateKey);
    const expected = '0x' + ks.address.toLowerCase().replace(/^0x/, '');
    if (derived === expected) {
      env.out(`OK ${derived}`);
      return 0;
    }
    env.err(`FAIL: derived ${derived} does not match keystore ${expected}`);
    return 3;
  } finally {
    wipe(privateKey);
  }
}

function pad(s, n) {
  if (s.length >= n) return s;
  return s + ' '.repeat(n - s.length);
}

function usageError(msg) {
  const err = new Error(msg);
  err.code = 'usage';
  return err;
}

/**
 * Main entry. Returns a Promise<number> exit code. The bin wrapper passes
 * process.argv.slice(2) and an env containing stdin/out/err streams.
 *
 * @param {string[]} argv - arguments without node + script
 * @param {object} [env]
 * @param {NodeJS.WriteStream} [env.stdout=process.stdout]
 * @param {NodeJS.WriteStream} [env.stderr=process.stderr]
 * @param {NodeJS.ReadStream}  [env.stdin=process.stdin]
 */
async function main(argv, env = {}) {
  const stdout = env.stdout || process.stdout;
  const stderr = env.stderr || process.stderr;
  const stdin = env.stdin || process.stdin;
  const ctx = {
    stdout,
    stderr,
    stdin,
    out: (line) => stdout.write(String(line) + '\n'),
    err: (line) => stderr.write(String(line) + '\n'),
  };

  let args;
  try {
    args = parseArgs(argv);
  } catch (err) {
    ctx.err(`ERROR: ${err.message}`);
    ctx.err('');
    ctx.err(USAGE);
    return 64;
  }

  if (args.help || !args.command || args.command === 'help') {
    ctx.err(USAGE);
    return args.help ? 0 : (args.command ? 0 : 64);
  }

  try {
    switch (args.command) {
      case 'new':
        return await cmdNew(args, ctx);
      case 'address':
        return cmdAddress(args, ctx);
      case 'list':
        return cmdList(args, ctx);
      case 'verify':
        return await cmdVerify(args, ctx);
      default:
        ctx.err(`ERROR: unknown command "${args.command}"`);
        ctx.err('');
        ctx.err(USAGE);
        return 64;
    }
  } catch (err) {
    if (err && err.code === 'usage') {
      ctx.err(`ERROR: ${err.message}`);
      ctx.err('');
      ctx.err(USAGE);
      return 64;
    }
    ctx.err(`ERROR: ${err && err.message ? err.message : String(err)}`);
    return 1;
  }
}

module.exports = {
  main,
  parseArgs,
  USAGE,
};
