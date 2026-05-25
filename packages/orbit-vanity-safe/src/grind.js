'use strict';

const { Worker } = require('node:worker_threads');
const path = require('node:path');

const { keccak_256 } = require('@noble/hashes/sha3');

const {
  SAFE_PROXY_FACTORY,
  SAFE_L2_SINGLETON,
  COMPATIBILITY_FALLBACK_HANDLER,
  ZERO_ADDRESS,
  hexToBytes,
  bytesToHex,
  normalizeAddress,
  encodeSetup,
} = require('./safe');
const { initCodeHashFor, predictFast } = require('./predict');

/**
 * Normalize a suffix to lowercase hex without 0x prefix.
 * Accepts "7777777", "0x7777777", "AbCdEf".
 */
function normalizeSuffix(suffix) {
  if (typeof suffix !== 'string') {
    throw new TypeError('suffix must be a string');
  }
  let s = suffix.toLowerCase();
  if (s.startsWith('0x')) s = s.slice(2);
  if (s.length === 0) throw new Error('suffix cannot be empty');
  if (!/^[0-9a-f]+$/.test(s)) {
    throw new Error('suffix must be hex characters only');
  }
  if (s.length > 40) {
    throw new Error('suffix cannot be longer than 40 hex chars (20 bytes)');
  }
  return s;
}

/**
 * Single-threaded grind loop. Returns { saltNonce, address, attempts } when a match is found,
 * or { saltNonce: null, address: null, attempts, best } if max-attempts exhausted.
 *
 * @param {object} opts
 * @param {string[]} opts.owners
 * @param {number|bigint} opts.threshold
 * @param {string} opts.suffix          - target hex suffix (case-insensitive)
 * @param {bigint} [opts.startNonce]    - starting saltNonce (default 0n)
 * @param {bigint} [opts.maxAttempts]   - cap on attempts (default unlimited)
 * @param {string} [opts.singleton]     - default SAFE_L2_SINGLETON
 * @param {string} [opts.factory]       - default SAFE_PROXY_FACTORY
 * @param {string} [opts.fallbackHandler]
 * @param {(stats: {attempts: bigint, rate: number, best: string|null, suffix: string}) => void} [opts.onProgress]
 *        - called periodically (every batchSize attempts)
 * @param {number} [opts.batchSize]     - progress callback frequency (default 10000)
 * @param {() => boolean} [opts.shouldStop] - polled each batch; truthy => abort
 * @returns {{ saltNonce: string|null, address: string|null, attempts: string, best: {nonce: string, address: string, matchLen: number}|null }}
 */
function grindSync({
  owners,
  threshold,
  suffix,
  startNonce = 0n,
  maxAttempts = null,
  singleton = SAFE_L2_SINGLETON,
  factory = SAFE_PROXY_FACTORY,
  fallbackHandler = COMPATIBILITY_FALLBACK_HANDLER,
  to = ZERO_ADDRESS,
  data = '0x',
  paymentToken = ZERO_ADDRESS,
  payment = 0n,
  paymentReceiver = ZERO_ADDRESS,
  onProgress,
  batchSize = 10000,
  shouldStop,
}) {
  const targetSuffix = normalizeSuffix(suffix);

  // Precompute everything that doesn't depend on saltNonce.
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
  const initHash = keccak_256(initializer); // 32 bytes
  const factoryBytes = hexToBytes(normalizeAddress(factory));
  const codeHash = initCodeHashFor(singleton);

  const max =
    maxAttempts == null
      ? null
      : typeof maxAttempts === 'bigint'
        ? maxAttempts
        : BigInt(maxAttempts);

  let nonce = typeof startNonce === 'bigint' ? startNonce : BigInt(startNonce);
  let attempts = 0n;
  let best = null; // { nonce, address, matchLen }
  const startTime = Date.now();

  while (true) {
    const batchEnd =
      max != null && attempts + BigInt(batchSize) > max
        ? max - attempts
        : BigInt(batchSize);
    if (batchEnd <= 0n) break;

    for (let i = 0n; i < batchEnd; i++) {
      const addr = predictFast(initHash, factoryBytes, codeHash, nonce);
      const addrHex = bytesToHex(addr);

      if (addrHex.endsWith(targetSuffix)) {
        return {
          saltNonce: nonce.toString(),
          address: '0x' + addrHex,
          attempts: (attempts + i + 1n).toString(),
          best: best,
        };
      }

      // Track best partial match (longest matching suffix).
      let matchLen = 0;
      for (
        let j = 1;
        j <= targetSuffix.length && j <= addrHex.length;
        j++
      ) {
        if (addrHex.slice(-j) === targetSuffix.slice(-j)) {
          matchLen = j;
        } else {
          break;
        }
      }
      if (!best || matchLen > best.matchLen) {
        best = {
          nonce: nonce.toString(),
          address: '0x' + addrHex,
          matchLen,
        };
      }

      nonce++;
    }

    attempts += batchEnd;

    if (onProgress) {
      const elapsedSec = Math.max(0.001, (Date.now() - startTime) / 1000);
      const rate = Number(attempts) / elapsedSec;
      onProgress({
        attempts,
        rate,
        best,
        suffix: targetSuffix,
      });
    }

    if (shouldStop && shouldStop()) break;
    if (max != null && attempts >= max) break;
  }

  return {
    saltNonce: null,
    address: null,
    attempts: attempts.toString(),
    best,
  };
}

/**
 * Parallel grind using worker_threads. Each worker walks a disjoint stride
 * of the nonce space (worker `w` of `N` checks nonces `start + w + k*N`).
 *
 * Resolves as soon as ANY worker finds a match (other workers are terminated).
 *
 * @param {object} opts - same as grindSync, plus:
 * @param {number} [opts.workers] - number of worker threads (default 1; uses grindSync if 1)
 * @returns {Promise<object>}
 */
async function grindParallel(opts) {
  const workerCount = Math.max(1, Math.floor(opts.workers || 1));

  if (workerCount === 1) {
    return grindSync(opts);
  }

  const workerPath = path.join(__dirname, 'worker.js');

  // Workers receive serializable params only.
  const sharedParams = {
    owners: opts.owners,
    threshold:
      typeof opts.threshold === 'bigint'
        ? opts.threshold.toString()
        : String(opts.threshold),
    suffix: opts.suffix,
    singleton: opts.singleton || SAFE_L2_SINGLETON,
    factory: opts.factory || SAFE_PROXY_FACTORY,
    fallbackHandler: opts.fallbackHandler || COMPATIBILITY_FALLBACK_HANDLER,
    to: opts.to || ZERO_ADDRESS,
    data: opts.data || '0x',
    paymentToken: opts.paymentToken || ZERO_ADDRESS,
    payment:
      typeof opts.payment === 'bigint'
        ? opts.payment.toString()
        : String(opts.payment || 0),
    paymentReceiver: opts.paymentReceiver || ZERO_ADDRESS,
    batchSize: opts.batchSize || 10000,
  };

  const startNonceBase =
    opts.startNonce != null
      ? typeof opts.startNonce === 'bigint'
        ? opts.startNonce
        : BigInt(opts.startNonce)
      : 0n;
  const maxAttempts =
    opts.maxAttempts != null
      ? typeof opts.maxAttempts === 'bigint'
        ? opts.maxAttempts
        : BigInt(opts.maxAttempts)
      : null;
  // Each worker gets a fair share of max attempts (rounded up to avoid early exit).
  const perWorkerMax =
    maxAttempts == null
      ? null
      : (maxAttempts + BigInt(workerCount) - 1n) / BigInt(workerCount);

  const workers = [];
  let resolved = false;
  let aggregateAttempts = 0n;
  let aggregateBest = null;
  let firstError = null;

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      for (const w of workers) {
        try {
          w.terminate();
        } catch (_) {
          /* ignore */
        }
      }
    };

    for (let w = 0; w < workerCount; w++) {
      const worker = new Worker(workerPath, {
        workerData: {
          ...sharedParams,
          workerId: w,
          workerCount,
          startNonce: (startNonceBase + BigInt(w)).toString(),
          stride: workerCount,
          maxAttempts: perWorkerMax == null ? null : perWorkerMax.toString(),
        },
      });
      workers.push(worker);

      worker.on('message', (msg) => {
        if (resolved) return;
        if (msg.type === 'progress') {
          aggregateAttempts += BigInt(msg.attemptsDelta || '0');
          if (msg.best) {
            if (
              !aggregateBest ||
              msg.best.matchLen > aggregateBest.matchLen
            ) {
              aggregateBest = msg.best;
            }
          }
          if (opts.onProgress) {
            opts.onProgress({
              attempts: aggregateAttempts,
              rate: msg.rate || 0,
              best: aggregateBest,
              suffix: normalizeSuffix(opts.suffix),
              workerId: msg.workerId,
            });
          }
        } else if (msg.type === 'found') {
          resolved = true;
          cleanup();
          resolve({
            saltNonce: msg.saltNonce,
            address: msg.address,
            attempts: (aggregateAttempts + BigInt(msg.attemptsDelta || '0')).toString(),
            best: aggregateBest,
            workerId: msg.workerId,
          });
        } else if (msg.type === 'exhausted') {
          aggregateAttempts += BigInt(msg.attemptsDelta || '0');
          if (msg.best && (!aggregateBest || msg.best.matchLen > aggregateBest.matchLen)) {
            aggregateBest = msg.best;
          }
        } else if (msg.type === 'error') {
          // Fatal: any worker error tears down the whole grind.
          // Store only the FIRST error (subsequent errors from terminated
          // siblings would clobber the original cause).
          if (firstError == null) {
            firstError = new Error(
              'vanity-safe worker error' +
                (msg.workerId != null ? ' (worker ' + msg.workerId + ')' : '') +
                ': ' +
                (msg.message || 'unknown'),
            );
          }
          if (!resolved) {
            resolved = true;
            cleanup();
            reject(firstError);
          }
        }
      });

      worker.on('error', (err) => {
        if (resolved) return;
        resolved = true;
        cleanup();
        reject(err);
      });
    }

    // Track exits explicitly with a counter. Only resolve as exhausted once
    // every worker has exited (or one of them has already produced a
    // 'found'/'error' result that flipped `resolved`).
    let exited = 0;
    for (const w of workers) {
      w.on('exit', () => {
        exited++;
        if (!resolved && exited === workers.length) {
          resolved = true;
          resolve({
            saltNonce: null,
            address: null,
            attempts: aggregateAttempts.toString(),
            best: aggregateBest,
          });
        }
      });
    }
  });
}

module.exports = {
  normalizeSuffix,
  grindSync,
  grindParallel,
};
