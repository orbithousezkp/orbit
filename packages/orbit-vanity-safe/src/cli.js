'use strict';

const {
  predictSafeAddress,
  grindSync,
  grindParallel,
  SAFE_PROXY_FACTORY,
  SAFE_L2_SINGLETON,
  COMPATIBILITY_FALLBACK_HANDLER,
} = require('./index');

const USAGE = `orbit-vanity-safe — grind Safe Proxy Factory salts for a vanity address

USAGE:
  orbit-vanity-safe grind   --owners <A,B,C> --threshold <N> [--suffix <hex>] [options]
  orbit-vanity-safe predict --owners <A,B,C> --threshold <N> --salt <nonce>  [options]
  orbit-vanity-safe --help

GRIND OPTIONS:
  --owners <A,B,C>       Comma-separated owner addresses (required)
  --threshold <N>        Signature threshold (required)
  --suffix <hex>         Target hex suffix, case-insensitive (default: 7777777)
  --workers <N>          Worker threads (default: 1)
  --max-attempts <N>     Cap the search (default: unlimited)
  --start-nonce <N>      Starting saltNonce (default: 0)
  --singleton <addr>     Safe singleton address (default: Safe L2 v1.4.1)
  --factory <addr>       SafeProxyFactory address (default: v1.4.1 canonical)
  --fallback <addr>      CompatibilityFallbackHandler (default: v1.4.1 canonical)

PREDICT OPTIONS:
  --salt <nonce>         The saltNonce to predict for (required)
  (plus the same --singleton / --factory / --fallback / --threshold / --owners as grind)

SAFETY NOTE:
  Safe contract addresses are derived from CREATE2 — NO private keys are involved
  in finding a vanity address. We only search the salt space. This is fundamentally
  different from EOA vanity tools (which grind private keys and can leak entropy).

Defaults (Safe v1.4.1):
  Factory:          ${SAFE_PROXY_FACTORY}
  L2 Singleton:     ${SAFE_L2_SINGLETON}
  Fallback handler: ${COMPATIBILITY_FALLBACK_HANDLER}
`;

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') {
      args.help = true;
      continue;
    }
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) {
        args[key] = true;
      } else {
        args[key] = next;
        i++;
      }
    } else if (!args._cmd) {
      args._cmd = a;
    }
  }
  return args;
}

function parseOwners(s) {
  if (!s || typeof s !== 'string') {
    throw new Error('--owners is required (comma-separated addresses)');
  }
  return s
    .split(',')
    .map((x) => x.trim())
    .filter((x) => x.length > 0);
}

function fmtRate(rate) {
  if (rate >= 1e6) return (rate / 1e6).toFixed(2) + ' Mh/s';
  if (rate >= 1e3) return (rate / 1e3).toFixed(2) + ' kh/s';
  return rate.toFixed(0) + ' h/s';
}

// 2^53 - 1; above this Number loses integer precision.
const MAX_SAFE_BIGINT = BigInt(Number.MAX_SAFE_INTEGER);

/**
 * Format an ETA from `remaining` (BigInt attempts) at `rate` (Number h/s).
 * For very large remaining counts (>2^53) we degrade to a coarse label
 * rather than emit garbage from a precision-lost Number conversion.
 */
function fmtEta(remaining, rate) {
  if (rate <= 0) return '?';
  if (typeof remaining !== 'bigint') {
    remaining = BigInt(remaining);
  }
  if (remaining <= 0n) return '0 s';
  // If remaining exceeds Number precision, bound the answer in years.
  if (remaining > MAX_SAFE_BIGINT) {
    // Compute years roughly: years = remaining / (rate * 31536000)
    // Use BigInt to avoid the precision loss, scaling the divisor.
    const secsPerYear = 31536000n;
    const rateRounded = BigInt(Math.max(1, Math.floor(rate)));
    const years = remaining / (rateRounded * secsPerYear);
    if (years > 10n) return '>10y';
    return years.toString() + 'y';
  }
  const secs = Number(remaining) / rate;
  if (!Number.isFinite(secs)) return 'infeasible';
  if (secs >= 86400 * 365) {
    const yrs = secs / (86400 * 365);
    return yrs > 10 ? '>10y' : yrs.toFixed(1) + 'y';
  }
  if (secs >= 3600) return (secs / 3600).toFixed(1) + ' h';
  if (secs >= 60) return (secs / 60).toFixed(1) + ' min';
  return secs.toFixed(0) + ' s';
}

async function cmdGrind(args) {
  const owners = parseOwners(args.owners);
  const threshold = parseInt(args.threshold, 10);
  if (!Number.isInteger(threshold) || threshold < 1) {
    throw new Error('--threshold must be a positive integer');
  }
  const suffix = (args.suffix && typeof args.suffix === 'string') ? args.suffix : '7777777';
  const workers = args.workers ? parseInt(args.workers, 10) : 1;
  const maxAttempts =
    args['max-attempts'] != null && args['max-attempts'] !== true
      ? BigInt(args['max-attempts'])
      : null;
  const startNonce =
    args['start-nonce'] != null && args['start-nonce'] !== true
      ? BigInt(args['start-nonce'])
      : 0n;

  const cleanSuffix = suffix.toLowerCase().replace(/^0x/, '');
  // BigInt arithmetic: 16^len can exceed Number.MAX_SAFE_INTEGER (>= len 14).
  const expectedAttempts = 16n ** BigInt(cleanSuffix.length);

  console.log('orbit-vanity-safe grind');
  console.log(`  owners:    ${owners.length} (${owners.join(', ')})`);
  console.log(`  threshold: ${threshold}`);
  console.log(`  suffix:    ${cleanSuffix}  (~${expectedAttempts.toLocaleString()} attempts avg)`);
  console.log(`  workers:   ${workers}`);
  if (maxAttempts != null) console.log(`  max:       ${maxAttempts}`);
  console.log('  Safety:    salt search only; no private keys are involved.');
  console.log('');

  let lastReport = Date.now();
  const onProgress = (stats) => {
    // Throttle to once per ~2s.
    const now = Date.now();
    if (now - lastReport < 2000) return;
    lastReport = now;
    const rate = stats.rate || 0;
    const attemptsBig =
      typeof stats.attempts === 'bigint'
        ? stats.attempts
        : BigInt(stats.attempts || 0);
    let remaining = expectedAttempts - attemptsBig;
    if (remaining < 0n) remaining = 0n;
    const bestStr = stats.best
      ? `best=${stats.best.matchLen}/${cleanSuffix.length} @ nonce ${stats.best.nonce}`
      : 'best=none';
    console.log(
      `  ... ${attemptsBig.toLocaleString()} tried, ${fmtRate(rate)}, ETA ${fmtEta(remaining, rate)}, ${bestStr}`,
    );
  };

  let finalResult = null;
  const onSig = () => {
    if (finalResult) return;
    console.log('\n[interrupted]');
    if (lastBest) {
      console.log(
        `Best partial match before exit: ${lastBest.matchLen}/${cleanSuffix.length} chars`,
      );
      console.log(`  nonce:   ${lastBest.nonce}`);
      console.log(`  address: ${lastBest.address}`);
    }
    process.exit(130);
  };
  let lastBest = null;
  const onProgressTracking = (stats) => {
    if (stats.best) lastBest = stats.best;
    onProgress(stats);
  };
  process.on('SIGINT', onSig);
  process.on('SIGTERM', onSig);

  const opts = {
    owners,
    threshold,
    suffix,
    startNonce,
    maxAttempts,
    onProgress: onProgressTracking,
  };
  if (args.singleton) opts.singleton = args.singleton;
  if (args.factory) opts.factory = args.factory;
  if (args.fallback) opts.fallbackHandler = args.fallback;

  let result;
  if (workers > 1) {
    result = await grindParallel({ ...opts, workers });
  } else {
    result = grindSync(opts);
  }
  finalResult = result;

  console.log('');
  if (result.saltNonce != null) {
    console.log('Match found!');
    console.log(`  saltNonce (decimal): ${result.saltNonce}`);
    console.log(`  predicted address:   ${result.address}`);
    console.log(`  attempts:            ${BigInt(result.attempts).toLocaleString()}`);
    console.log('');
    console.log('At app.safe.global, when deploying with these owners/threshold,');
    console.log(`use salt nonce: ${result.saltNonce} — this produces address ${result.address}`);
    return 0;
  } else {
    console.log('No match within max-attempts limit.');
    if (result.best) {
      console.log(
        `Best partial match: ${result.best.matchLen}/${cleanSuffix.length} chars`,
      );
      console.log(`  nonce:   ${result.best.nonce}`);
      console.log(`  address: ${result.best.address}`);
    }
    return 1;
  }
}

function cmdPredict(args) {
  const owners = parseOwners(args.owners);
  const threshold = parseInt(args.threshold, 10);
  if (!Number.isInteger(threshold) || threshold < 1) {
    throw new Error('--threshold must be a positive integer');
  }
  if (args.salt == null || args.salt === true) {
    throw new Error('--salt is required (the saltNonce)');
  }
  const saltNonce = BigInt(args.salt);
  const opts = { owners, threshold, saltNonce };
  if (args.singleton) opts.singleton = args.singleton;
  if (args.factory) opts.factory = args.factory;
  if (args.fallback) opts.fallbackHandler = args.fallback;
  const addr = predictSafeAddress(opts);
  console.log(addr);
  return 0;
}

async function main(argv) {
  const args = parseArgs(argv);
  if (args.help || !args._cmd) {
    process.stdout.write(USAGE);
    return args.help ? 0 : 1;
  }
  switch (args._cmd) {
    case 'grind':
      return cmdGrind(args);
    case 'predict':
      return cmdPredict(args);
    default:
      console.error(`Unknown command: ${args._cmd}`);
      process.stdout.write(USAGE);
      return 1;
  }
}

/**
 * Compute the average attempt count for a hex suffix of length `len`.
 * Returns a BigInt so callers don't overflow at len >= 14
 * (16^14 = 7.2e16 > Number.MAX_SAFE_INTEGER).
 */
function expectedAttemptsForSuffixLen(len) {
  if (!Number.isInteger(len) || len < 0) {
    throw new TypeError('len must be a non-negative integer');
  }
  return 16n ** BigInt(len);
}

module.exports = {
  main,
  parseArgs,
  fmtRate,
  fmtEta,
  expectedAttemptsForSuffixLen,
};
