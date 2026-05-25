# @orbit-house/vanity-safe

Local CLI that grinds Safe Proxy Factory salts until the predicted Safe
contract address ends in a target hex suffix.

```
$ orbit-vanity-safe grind --owners 0xA,0xB,0xC --threshold 2 --suffix 7777777 --workers 8
...
Match found!
  saltNonce (decimal): 134217984
  predicted address:   0x...7777777
```

## Why this is safe

Safe contract addresses are derived from `CREATE2`:

```
address = keccak256(0xff || factory || salt || initCodeHash)[12:32]
salt    = keccak256(keccak256(initializer) || uint256(saltNonce))
```

The `saltNonce` is just an arbitrary 256-bit integer chosen at deploy time.
**No private keys are involved** in searching for a vanity Safe address — we
only iterate the saltNonce space and recompute the CREATE2 prediction.

Compare this to EOA vanity tools (e.g. the original `profanity`, which grinds
private keys). Those tools were exploited because they derived keys with
weak entropy, and attackers could re-compute the private key from the
public address. That class of vulnerability **does not exist** here: the
output of this tool is a salt nonce. The Safe is then deployed normally
through the canonical SafeProxyFactory, and the resulting Safe is owned by
exactly the EOAs you specified — no part of the workflow involves a key
this tool generates.

## Install

This package is part of the `orbit` monorepo. From the repo root:

```
node packages/orbit-vanity-safe/bin.js --help
```

To install it globally for development:

```
cd packages/orbit-vanity-safe
npm link
orbit-vanity-safe --help
```

Requires Node.js >= 18 (for `worker_threads`).

## Generate a vanity Safe address

```
orbit-vanity-safe grind \
    --owners 0xAAAA...,0xBBBB...,0xCCCC... \
    --threshold 2 \
    --suffix 7777777 \
    --workers 8
```

Workflow:

1. Run `grind` until a match is found. The tool prints `(saltNonce, address)`.
2. Open https://app.safe.global and start a new Safe deployment using **the
   exact same owners and threshold** you passed to the grinder.
3. In the deployment flow, set the salt nonce field to the `saltNonce` value
   the tool printed (it is the integer the Safe app calls "salt nonce" or
   "deployment nonce").
4. Submit the deployment. The deployed Safe address will equal the
   `predicted address` reported by the tool.

## Verify a deployed Safe matches a grind result

```
orbit-vanity-safe predict \
    --owners 0xAAAA...,0xBBBB...,0xCCCC... \
    --threshold 2 \
    --salt 134217984
```

Prints the address that would be deployed at that salt. Use this to confirm
a Safe shown in `app.safe.global` matches the grind result before you fund it.

## Defaults (Safe v1.4.1)

| Parameter                       | Default                                          |
|---------------------------------|--------------------------------------------------|
| Factory                         | `0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67`     |
| L2 Singleton                    | `0x29fcB43b46531BcA003ddC8FCB67FFE91900C762`     |
| CompatibilityFallbackHandler    | `0xfd0732Dc9E303f09fCEf3a7388Ad10A83459Ec99`     |

These are the canonical Safe v1.4.1 deployment addresses on Base, Ethereum,
Arbitrum, Optimism, and most other EVM chains. Source of truth:
[safe-global/safe-deployments](https://github.com/safe-global/safe-deployments/tree/main/src/assets/v1.4.1).

If you need a non-L2 singleton or a different fallback handler, pass
`--singleton <addr>` / `--fallback <addr>`.

## Throughput tuning

This is a CPU-only workload (pure keccak256 + small concatenations). RAM
usage is under 100 MB per worker.

- `--workers N` spawns `N` worker threads, each walking a disjoint stride
  of the nonce space. Set to the number of physical CPU cores for best
  throughput. Default: `1`.
- Expected throughput is roughly 50,000 – 200,000 attempts/sec per core,
  depending on Node/CPU.

Search-space expectations (single suffix character is 1 in 16):

| Suffix length | Average attempts | 1 core    | 8 cores      |
|---------------|------------------|-----------|--------------|
| 4 chars       | 65,536           | < 1 sec   | < 1 sec      |
| 5 chars       | 1,048,576        | ~10 sec   | ~1 sec       |
| 6 chars       | 16,777,216       | ~3 min    | ~25 sec      |
| 7 chars       | 268,435,456      | 30–90 min | 4–12 min     |

The tool prints throughput, elapsed attempts, and ETA every ~2 seconds.
The best partial match found so far is tracked and printed on Ctrl-C.

## CLI reference

```
orbit-vanity-safe grind   --owners <A,B,C> --threshold <N> [--suffix <hex>] [options]
orbit-vanity-safe predict --owners <A,B,C> --threshold <N> --salt <nonce>  [options]
orbit-vanity-safe --help
```

### `grind` options

| Flag                | Default        | Meaning                                              |
|---------------------|----------------|------------------------------------------------------|
| `--owners <A,B,C>`  | (required)     | Comma-separated owner addresses                      |
| `--threshold <N>`   | (required)     | Signature threshold                                  |
| `--suffix <hex>`    | `7777777`      | Target hex suffix (case-insensitive, accepts `0x`)   |
| `--workers <N>`     | `1`            | Number of worker threads                             |
| `--max-attempts <N>`| unlimited      | Cap the search; exit with code 1 if not found        |
| `--start-nonce <N>` | `0`            | Starting saltNonce                                   |
| `--singleton <addr>`| Safe L2 v1.4.1 | Safe singleton                                       |
| `--factory <addr>`  | v1.4.1 factory | SafeProxyFactory                                     |
| `--fallback <addr>` | v1.4.1 handler | CompatibilityFallbackHandler                         |

### `predict` options

`--salt <nonce>` plus the same `--owners`, `--threshold`, `--singleton`,
`--factory`, `--fallback` flags as `grind`.

## Programmatic API

```js
const {
  predictSafeAddress,
  grindSync,
  grindParallel,
} = require('@orbit-house/vanity-safe');

const addr = predictSafeAddress({
  owners: ['0xA...', '0xB...', '0xC...'],
  threshold: 2,
  saltNonce: 12345n,
});

const result = await grindParallel({
  owners: ['0xA...', '0xB...', '0xC...'],
  threshold: 2,
  suffix: '7777777',
  workers: 8,
  maxAttempts: 500_000_000n, // optional
  onProgress: ({ attempts, rate, best }) => {
    console.log(attempts, rate, best);
  },
});
// result: { saltNonce, address, attempts, best }
```

## License

MIT. See `LICENSE`.
