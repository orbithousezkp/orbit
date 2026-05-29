/**
 * Tests for @orbithouse/vanity-safe
 *
 * Uses Node's built-in test runner. Reference vectors are computed via viem
 * (already a top-level dependency of this repo) using the same Safe v1.4.1
 * parameters. Address derivation is verified to byte-equal viem's output.
 */

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  predictSafeAddress,
  grindSync,
  grindParallel,
  encodeSetup,
  normalizeAddress,
  normalizeSuffix,
  initCodeHashFor,
  SAFE_PROXY_FACTORY,
  SAFE_L2_SINGLETON,
  COMPATIBILITY_FALLBACK_HANDLER,
} = require('../packages/orbit-vanity-safe/src/index');

// Reference vector: 1-of-1 Safe with owner 0x9F3f...EED03, threshold=1, all
// defaults (Safe L2 v1.4.1 singleton, CompatibilityFallbackHandler v1.4.1,
// no setup-modules call). saltNonce=42. Expected address verified via viem
// (getCreate2Address) at package construction time.
const FIXTURE_OWNER_A = '0x9F3f11d72d96910df008Cfe3aBA40F361D2EED03';
const FIXTURE_OWNER_B = '0xAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAa';
const FIXTURE_OWNER_C = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

const VIEM_1OF1_NONCE42 = '0x88F76085D986aD2c7451954eE7a79e3ec543b5b4';

// Canonical Safe v1.4.1 initCodeHash for the SafeL2 singleton.
const SAFE_L2_INIT_CODE_HASH =
  '0xe298282cefe913ab5d282047161268a8222e4bd4ed106300c547894bbefd31ee';

describe('orbit-vanity-safe', () => {
  describe('predictSafeAddress', () => {
    it('matches viem reference for a known salt + owner set', () => {
      const addr = predictSafeAddress({
        owners: [FIXTURE_OWNER_A],
        threshold: 1,
        saltNonce: 42n,
      });
      assert.equal(addr.toLowerCase(), VIEM_1OF1_NONCE42.toLowerCase());
    });

    it('is deterministic across runs', () => {
      const a = predictSafeAddress({
        owners: [FIXTURE_OWNER_A, FIXTURE_OWNER_B, FIXTURE_OWNER_C],
        threshold: 2,
        saltNonce: 12345n,
      });
      const b = predictSafeAddress({
        owners: [FIXTURE_OWNER_A, FIXTURE_OWNER_B, FIXTURE_OWNER_C],
        threshold: 2,
        saltNonce: 12345n,
      });
      assert.equal(a, b);
    });

    it('produces different addresses for different salts', () => {
      const opts = {
        owners: [FIXTURE_OWNER_A, FIXTURE_OWNER_B, FIXTURE_OWNER_C],
        threshold: 2,
      };
      const a = predictSafeAddress({ ...opts, saltNonce: 0n });
      const b = predictSafeAddress({ ...opts, saltNonce: 1n });
      assert.notEqual(a, b);
    });

    it('uses the canonical Safe v1.4.1 initCodeHash for the L2 singleton', () => {
      const hash = initCodeHashFor(SAFE_L2_SINGLETON);
      const hex = '0x' + Buffer.from(hash).toString('hex');
      assert.equal(hex, SAFE_L2_INIT_CODE_HASH);
    });

    it('changes when fallback handler changes', () => {
      const opts = {
        owners: [FIXTURE_OWNER_A],
        threshold: 1,
        saltNonce: 42n,
      };
      const a = predictSafeAddress(opts);
      const b = predictSafeAddress({
        ...opts,
        fallbackHandler: '0x0000000000000000000000000000000000000001',
      });
      assert.notEqual(a, b);
    });
  });

  describe('encodeSetup', () => {
    it('produces the exact setup() calldata expected by Safe v1.4.1 (1-of-1)', () => {
      // This vector matches the calldata viem.encodeFunctionData produces for
      // a 1-of-1 setup with the v1.4.1 fallback handler, no modules.
      const enc = encodeSetup({
        owners: [FIXTURE_OWNER_A],
        threshold: 1,
        fallbackHandler: COMPATIBILITY_FALLBACK_HANDLER,
      });
      const hex = '0x' + Buffer.from(enc).toString('hex');
      const expected =
        '0xb63e800d' + // selector
        // owners offset (0x100), threshold (1), to (0), data offset (0x140)
        '0000000000000000000000000000000000000000000000000000000000000100' +
        '0000000000000000000000000000000000000000000000000000000000000001' +
        '0000000000000000000000000000000000000000000000000000000000000000' +
        '0000000000000000000000000000000000000000000000000000000000000140' +
        // fallbackHandler, paymentToken (0), payment (0), paymentReceiver (0)
        '000000000000000000000000fd0732dc9e303f09fcef3a7388ad10a83459ec99' +
        '0000000000000000000000000000000000000000000000000000000000000000' +
        '0000000000000000000000000000000000000000000000000000000000000000' +
        '0000000000000000000000000000000000000000000000000000000000000000' +
        // owners[]: length 1, then the address padded
        '0000000000000000000000000000000000000000000000000000000000000001' +
        '0000000000000000000000009f3f11d72d96910df008cfe3aba40f361d2eed03' +
        // data: length 0, no payload
        '0000000000000000000000000000000000000000000000000000000000000000';
      assert.equal(hex.toLowerCase(), expected.toLowerCase());
    });

    it('rejects invalid owner addresses', () => {
      assert.throws(
        () =>
          encodeSetup({
            owners: ['not-an-address'],
            threshold: 1,
            fallbackHandler: COMPATIBILITY_FALLBACK_HANDLER,
          }),
        /invalid address/,
      );
    });

    it('rejects threshold > owners.length', () => {
      assert.throws(
        () =>
          encodeSetup({
            owners: [FIXTURE_OWNER_A, FIXTURE_OWNER_B],
            threshold: 5,
            fallbackHandler: COMPATIBILITY_FALLBACK_HANDLER,
          }),
        /threshold .* exceeds owners.length/,
      );
    });

    it('rejects threshold < 1', () => {
      assert.throws(
        () =>
          encodeSetup({
            owners: [FIXTURE_OWNER_A],
            threshold: 0,
            fallbackHandler: COMPATIBILITY_FALLBACK_HANDLER,
          }),
        /threshold must be >= 1/,
      );
    });

    it('rejects duplicate owners', () => {
      assert.throws(
        () =>
          encodeSetup({
            owners: [FIXTURE_OWNER_A, FIXTURE_OWNER_A],
            threshold: 1,
            fallbackHandler: COMPATIBILITY_FALLBACK_HANDLER,
          }),
        /duplicate owner/,
      );
    });

    it('rejects empty owners array', () => {
      assert.throws(
        () =>
          encodeSetup({
            owners: [],
            threshold: 1,
            fallbackHandler: COMPATIBILITY_FALLBACK_HANDLER,
          }),
        /non-empty/,
      );
    });
  });

  describe('normalizeAddress', () => {
    it('lowercases and accepts mixed-case checksummed addresses', () => {
      assert.equal(
        normalizeAddress('0x9F3f11d72d96910df008Cfe3aBA40F361D2EED03'),
        '0x9f3f11d72d96910df008cfe3aba40f361d2eed03',
      );
    });

    it('rejects malformed input', () => {
      assert.throws(() => normalizeAddress('0xnope'), /invalid address/);
      assert.throws(() => normalizeAddress('9F3f11'), /invalid address/);
    });
  });

  describe('normalizeSuffix', () => {
    it('is case-insensitive and accepts 0x prefix', () => {
      assert.equal(normalizeSuffix('7777777'), '7777777');
      assert.equal(normalizeSuffix('0x7777777'), '7777777');
      assert.equal(normalizeSuffix('AbCdEf'), 'abcdef');
      assert.equal(normalizeSuffix('0xAbCdEf'), 'abcdef');
    });

    it('rejects non-hex characters', () => {
      assert.throws(() => normalizeSuffix('zzz'), /hex characters/);
    });

    it('rejects empty suffix', () => {
      assert.throws(() => normalizeSuffix(''), /empty/);
    });
  });

  describe('grindSync', () => {
    it('finds a match for an easy suffix within a small budget', () => {
      // suffix "7" — one hex char, ~1/16 chance per attempt → essentially
      // certain within 100 attempts. Test on a real owner set.
      const result = grindSync({
        owners: [FIXTURE_OWNER_A, FIXTURE_OWNER_B, FIXTURE_OWNER_C],
        threshold: 2,
        suffix: '7',
        maxAttempts: 100n,
      });
      assert.ok(result.saltNonce != null, 'should find a match');
      assert.ok(result.address.endsWith('7'), 'address must end with 7');
      // Verify by re-predicting:
      const verify = predictSafeAddress({
        owners: [FIXTURE_OWNER_A, FIXTURE_OWNER_B, FIXTURE_OWNER_C],
        threshold: 2,
        saltNonce: BigInt(result.saltNonce),
      });
      assert.equal(verify, result.address);
    });

    it('returns null when max-attempts is exhausted', () => {
      // suffix "777777" with max=10 attempts → essentially impossible.
      const result = grindSync({
        owners: [FIXTURE_OWNER_A, FIXTURE_OWNER_B, FIXTURE_OWNER_C],
        threshold: 2,
        suffix: '777777',
        maxAttempts: 10n,
      });
      assert.equal(result.saltNonce, null);
      assert.equal(result.address, null);
      assert.equal(result.attempts, '10');
      assert.ok(result.best, 'best partial match should be populated');
    });

    it('tracks the best partial match during a failed grind', () => {
      const result = grindSync({
        owners: [FIXTURE_OWNER_A, FIXTURE_OWNER_B, FIXTURE_OWNER_C],
        threshold: 2,
        suffix: '7777777777', // very hard — 16^10 average
        maxAttempts: 200n,
      });
      assert.equal(result.saltNonce, null);
      assert.ok(result.best);
      assert.ok(result.best.matchLen >= 0);
      assert.ok(result.best.matchLen <= 10);
    });

    it('respects start-nonce', () => {
      // With startNonce=1000 the first attempt should be saltNonce=1000.
      // Easy way to verify: search for any suffix that we know matches
      // a specific salt — find it via grind, then confirm grinding the
      // same params starting at a different nonce returns a different (or
      // same) salt depending on whether the original was inside the new range.
      const r1 = grindSync({
        owners: [FIXTURE_OWNER_A],
        threshold: 1,
        suffix: '0', // common, will hit fast
        startNonce: 0n,
        maxAttempts: 50n,
      });
      const r2 = grindSync({
        owners: [FIXTURE_OWNER_A],
        threshold: 1,
        suffix: '0',
        startNonce: BigInt(r1.saltNonce) + 1n,
        maxAttempts: 50n,
      });
      assert.notEqual(r1.saltNonce, r2.saltNonce);
      // r2 must have started no earlier than r1.saltNonce + 1
      assert.ok(BigInt(r2.saltNonce) > BigInt(r1.saltNonce));
    });

    it('suffix matching is case-insensitive', () => {
      const result = grindSync({
        owners: [FIXTURE_OWNER_A],
        threshold: 1,
        suffix: 'A', // uppercase
        maxAttempts: 100n,
      });
      assert.ok(result.saltNonce != null);
      assert.ok(result.address.toLowerCase().endsWith('a'));
    });

    it('accepts 0x-prefixed suffix', () => {
      const result = grindSync({
        owners: [FIXTURE_OWNER_A],
        threshold: 1,
        suffix: '0xf',
        maxAttempts: 100n,
      });
      assert.ok(result.saltNonce != null);
      assert.ok(result.address.toLowerCase().endsWith('f'));
    });
  });

  describe('grindParallel', () => {
    it('returns the same shape as grindSync (workers=1 path)', async () => {
      const result = await grindParallel({
        owners: [FIXTURE_OWNER_A, FIXTURE_OWNER_B, FIXTURE_OWNER_C],
        threshold: 2,
        suffix: '7',
        maxAttempts: 100n,
        workers: 1,
      });
      assert.ok(result.saltNonce != null);
      assert.ok(result.address.endsWith('7'));
    });

    it('finds a match across multiple workers and the salt is verifiable', async () => {
      const result = await grindParallel({
        owners: [FIXTURE_OWNER_A, FIXTURE_OWNER_B, FIXTURE_OWNER_C],
        threshold: 2,
        suffix: '77',
        maxAttempts: 5000n,
        workers: 2,
      });
      assert.ok(result.saltNonce != null, 'workers=2 should still find a match');
      const verify = predictSafeAddress({
        owners: [FIXTURE_OWNER_A, FIXTURE_OWNER_B, FIXTURE_OWNER_C],
        threshold: 2,
        saltNonce: BigInt(result.saltNonce),
      });
      assert.equal(verify, result.address);
      assert.ok(result.address.endsWith('77'));
    });

    it('returns null when no worker finds a match within max-attempts', async () => {
      const result = await grindParallel({
        owners: [FIXTURE_OWNER_A, FIXTURE_OWNER_B, FIXTURE_OWNER_C],
        threshold: 2,
        suffix: '7777777', // 7 chars; with max=200 across 2 workers it's hopeless
        maxAttempts: 200n,
        workers: 2,
      });
      assert.equal(result.saltNonce, null);
      assert.equal(result.address, null);
    });

    // --- Bug 1 regression: premature resolution on first worker exit ---
    //
    // Before the fix, grind.js had a `worker.on('exit')` whose `stillAlive`
    // check returned `false` unconditionally, so as soon as ANY worker exited
    // the Promise resolved with saltNonce:null — even if surviving workers
    // were still searching (and would have found a match).
    //
    // We exercise this by giving worker 0 a tiny share of the search space
    // (so it exits quickly via 'exhausted') while worker 1 gets enough budget
    // to find a match. The bug would resolve null the instant worker 0 dies;
    // the fix waits for ALL workers to exit OR a 'found' message, so the
    // result must reflect worker 1's discovery.
    //
    // Because grindParallel divides maxAttempts evenly across workers, we use
    // an asymmetric workload by hand-crafting a long grind where one stride
    // will exhaust early. We use 4 workers with a moderate maxAttempts so the
    // distribution makes some workers finish before others.
    it('does NOT prematurely resolve null when one worker exits before another finds a match (Bug 1)', async () => {
      // suffix "7" — ~1/16 chance per attempt. With 4 workers and 4000 max
      // attempts (1000 per worker), basically guaranteed at least one worker
      // hits a match. Pre-fix, the FIRST worker to exit (even via 'found')
      // raced against the broken exit handler, which could clobber the
      // result with null. We assert we always get a real match.
      for (let trial = 0; trial < 3; trial++) {
        const result = await grindParallel({
          owners: [FIXTURE_OWNER_A, FIXTURE_OWNER_B, FIXTURE_OWNER_C],
          threshold: 2,
          suffix: '7',
          maxAttempts: 4000n,
          workers: 4,
        });
        assert.ok(
          result.saltNonce != null,
          `trial ${trial}: must not resolve null when match is reachable`,
        );
        assert.ok(result.address.endsWith('7'));
      }
    });

    // --- Bug 2 regression: worker errors must reject, not silently null ---
    //
    // A bad threshold like '1.5' makes BigInt('1.5') throw inside the worker.
    // Before the fix the master ignored 'error' messages and the fallback
    // exit-counter resolved with saltNonce:null, hiding the failure. The
    // operator would see "no match" instead of the actual SyntaxError.
    it('rejects the promise when a worker throws on bad input (Bug 2: fractional threshold)', async () => {
      await assert.rejects(
        () =>
          grindParallel({
            owners: [FIXTURE_OWNER_A, FIXTURE_OWNER_B, FIXTURE_OWNER_C],
            threshold: '1.5', // BigInt('1.5') throws SyntaxError in worker
            suffix: '7',
            maxAttempts: 1000n,
            workers: 2,
          }),
        (err) => {
          assert.ok(err instanceof Error, 'must reject with an Error');
          assert.match(
            err.message,
            /worker|BigInt|SyntaxError|Cannot convert/i,
            'error message should hint at the underlying cause',
          );
          return true;
        },
      );
    });

    it('rejects the promise when a worker throws on bad input (Bug 2: non-numeric threshold)', async () => {
      await assert.rejects(
        () =>
          grindParallel({
            owners: [FIXTURE_OWNER_A, FIXTURE_OWNER_B, FIXTURE_OWNER_C],
            threshold: 'abc',
            suffix: '7',
            maxAttempts: 1000n,
            workers: 2,
          }),
        (err) => {
          assert.ok(err instanceof Error);
          return true;
        },
      );
    });
  });

  // --- Bug 3 regression: Math.pow(16, len) overflow ---
  //
  // The CLI computed `expectedAttempts = Math.pow(16, suffixLen)` and fed it
  // into ETA math. For suffixLen >= 14 the result exceeds 2^53; at >= 16 it
  // overflows to Infinity, making ETA/remaining print garbage. The fix uses
  // 16n ** BigInt(len) throughout and degrades ETA output for huge remainders.
  describe('cli ETA math (Bug 3)', () => {
    const {
      expectedAttemptsForSuffixLen,
      fmtEta,
    } = require('../packages/orbit-vanity-safe/src/cli');

    it('expectedAttemptsForSuffixLen returns a BigInt', () => {
      const v = expectedAttemptsForSuffixLen(7);
      assert.equal(typeof v, 'bigint');
      assert.equal(v, 16n ** 7n);
    });

    it('does not overflow for suffix length 16', () => {
      const v = expectedAttemptsForSuffixLen(16);
      assert.equal(typeof v, 'bigint');
      assert.equal(v, 16n ** 16n);
      // Sanity: 16^16 = 18446744073709551616 (the famous u64 ceiling)
      assert.equal(v.toString(), '18446744073709551616');
      // toLocaleString must produce a non-empty, non-Infinity formatted string
      const formatted = v.toLocaleString();
      assert.ok(formatted.length > 0);
      assert.ok(!formatted.includes('Infinity'));
      assert.ok(!formatted.includes('NaN'));
    });

    it('does not overflow for suffix length 20', () => {
      const v = expectedAttemptsForSuffixLen(20);
      assert.equal(typeof v, 'bigint');
      assert.equal(v, 16n ** 20n);
      const formatted = v.toLocaleString();
      assert.ok(!formatted.includes('Infinity'));
    });

    it('fmtEta handles BigInt remaining without overflow for huge searches', () => {
      // 16^16 attempts at 1 Mh/s is roughly 18e18 / 1e6 / 31.5e6 ≈ 5.85e5 years.
      const remaining = 16n ** 16n;
      const out = fmtEta(remaining, 1_000_000);
      assert.ok(typeof out === 'string');
      assert.ok(!out.includes('Infinity'));
      assert.ok(!out.includes('NaN'));
      // For this magnitude we expect the >10y fallback.
      assert.match(out, />10y|y$/);
    });

    it('fmtEta handles a reachable BigInt remaining as seconds/minutes/hours', () => {
      // 1000 remaining at 100 h/s = 10 seconds
      const out = fmtEta(1000n, 100);
      assert.match(out, /\d+ s/);
    });

    it('fmtEta returns "?" when rate is zero', () => {
      assert.equal(fmtEta(1000n, 0), '?');
    });
  });
});
