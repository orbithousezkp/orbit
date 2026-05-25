#!/usr/bin/env node
/**
 * orbit-keygen — local Ethereum keystore generator.
 *
 * Generates a 32-byte private key locally, encrypts it with a passphrase
 * using scrypt + AES-128-CTR, and writes a Web3 Keystore v3 file. The
 * private key never leaves the local filesystem.
 */

'use strict';

const { main } = require('./src/cli');

main(process.argv.slice(2)).then(
  (code) => {
    process.exit(code | 0);
  },
  (err) => {
    process.stderr.write(`FATAL: ${err && err.stack ? err.stack : String(err)}\n`);
    process.exit(1);
  }
);
