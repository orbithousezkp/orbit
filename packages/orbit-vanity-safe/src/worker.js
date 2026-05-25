'use strict';

const { parentPort, workerData } = require('node:worker_threads');
const { keccak_256 } = require('@noble/hashes/sha3');

const {
  hexToBytes,
  bytesToHex,
  normalizeAddress,
  encodeSetup,
} = require('./safe');
const { initCodeHashFor, predictFast } = require('./predict');
const { normalizeSuffix } = require('./grind');

function run() {
  const {
    owners,
    threshold,
    suffix,
    singleton,
    factory,
    fallbackHandler,
    to,
    data,
    paymentToken,
    payment,
    paymentReceiver,
    batchSize,
    workerId,
    startNonce,
    stride,
    maxAttempts,
  } = workerData;

  const targetSuffix = normalizeSuffix(suffix);

  const initializer = encodeSetup({
    owners,
    threshold: BigInt(threshold),
    to,
    data,
    fallbackHandler,
    paymentToken,
    payment: BigInt(payment),
    paymentReceiver,
  });
  const initHash = keccak_256(initializer);
  const factoryBytes = hexToBytes(normalizeAddress(factory));
  const codeHash = initCodeHashFor(singleton);

  let nonce = BigInt(startNonce);
  const strideBig = BigInt(stride);
  const max = maxAttempts == null ? null : BigInt(maxAttempts);

  let attemptsThisReport = 0n;
  let attemptsTotal = 0n;
  let best = null;
  const startTime = Date.now();

  const reportProgress = (last) => {
    const elapsedSec = Math.max(0.001, (Date.now() - startTime) / 1000);
    const rate = Number(attemptsTotal) / elapsedSec;
    parentPort.postMessage({
      type: last ? 'exhausted' : 'progress',
      workerId,
      attemptsDelta: attemptsThisReport.toString(),
      attemptsTotal: attemptsTotal.toString(),
      rate,
      best,
    });
    attemptsThisReport = 0n;
  };

  const reportBatch = BigInt(batchSize);

  while (max == null || attemptsTotal < max) {
    const addr = predictFast(initHash, factoryBytes, codeHash, nonce);
    const addrHex = bytesToHex(addr);

    if (addrHex.endsWith(targetSuffix)) {
      attemptsTotal++;
      attemptsThisReport++;
      parentPort.postMessage({
        type: 'found',
        workerId,
        saltNonce: nonce.toString(),
        address: '0x' + addrHex,
        attemptsDelta: attemptsThisReport.toString(),
        attemptsTotal: attemptsTotal.toString(),
      });
      return;
    }

    // Track best partial match.
    let matchLen = 0;
    for (let j = 1; j <= targetSuffix.length && j <= addrHex.length; j++) {
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

    attemptsTotal++;
    attemptsThisReport++;
    nonce += strideBig;

    if (attemptsThisReport >= reportBatch) {
      reportProgress(false);
    }
  }

  // Exhausted.
  reportProgress(true);
}

try {
  run();
} catch (err) {
  // Surface the error to the master via a message BEFORE exiting.
  // The master treats 'error' messages as fatal and rejects the
  // outer Promise — without this branch a bad input (e.g. BigInt()
  // throwing on a fractional threshold) would silently resolve null.
  try {
    parentPort.postMessage({
      type: 'error',
      workerId: workerData && workerData.workerId,
      message: err && err.message ? err.message : String(err),
    });
  } catch (_) {
    /* ignore: parentPort may already be closed */
  }
  // Exit non-zero so the master also observes the failure if the
  // message somehow doesn't arrive.
  process.exitCode = 1;
}
