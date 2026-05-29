# @orbithouse/anchor — MerkleAnchor.sol

_Part of [Orbit](https://github.com/orbithousezkp/orbit) — the control plane for agent memory and infrastructure inside any GitHub repo._

The `MerkleAnchor` contract is the on-chain half of [D-012](../../PLAN/DECISIONS.md).
It stores one Merkle root per cycle-proof window on Base. The off-chain half
lives in [`src/agent/merkle-anchor.js`](../../src/agent/merkle-anchor.js) and is
specced in [`PLAN/SPECS/MERKLE_ANCHOR.md`](../../PLAN/SPECS/MERKLE_ANCHOR.md).

## What it does

- Stores one `Anchor { bytes32 root; uint32 leafCount; address anchorer; uint64 anchoredAt; }` per `uint64 windowEnd` (unix seconds, UTC).
- Emits `RootAnchored(windowEnd, root, leafCount, anchorer)` once per write.
- Refuses re-anchoring the same `windowEnd` (any subsequent `anchorRoot` for the same window reverts with `AlreadyAnchored`).
- Refuses anchoring the zero root (`ZeroRoot`).
- Restricts `anchorRoot` and `transferOwnership` to the current `owner` (`NotOwner`).
- Allows the owner to hand custody to the Treasury Safe via `transferOwnership`.

## What it does NOT do

- No token logic, no fees, no payments.
- No upgradeability, no proxy, no admin escape hatches.
- No re-anchoring or override of a previously written window (intentional; any historical override would defeat the tamper-evident guarantee).
- No verification of the Merkle root — the chain only stores the value the owner submits. Verification is the off-chain verifier's job (`@orbithouse/verifier`).

## Constructor

None. The deployer becomes the initial `owner`. Transfer to the Treasury Safe
immediately after deploy.

## Deploy

We recommend Foundry for reproducible verification on Basescan. Either of:

### Foundry (recommended)

```
forge create \
  --rpc-url $BASE_RPC_URL \
  --private-key $DEPLOYER_PRIVATE_KEY \
  packages/orbit-anchor/contracts/MerkleAnchor.sol:MerkleAnchor
```

Verify on Basescan:

```
forge verify-contract \
  --chain base \
  <DEPLOYED_ADDRESS> \
  packages/orbit-anchor/contracts/MerkleAnchor.sol:MerkleAnchor \
  --etherscan-api-key $BASESCAN_API_KEY
```

### Remix (alternative)

1. Open [Remix](https://remix.ethereum.org).
2. Copy `MerkleAnchor.sol` into a new workspace file.
3. Compiler: `0.8.20+`, optimizer enabled (200 runs is fine).
4. Environment: `Injected Provider` on the Base mainnet network.
5. Deploy `MerkleAnchor` with no constructor args.
6. Use the contract's "Verify & Publish" link on Basescan with the same compiler settings.

## Immediately after deploy

1. Call `transferOwnership(<TREASURY_SAFE_ADDRESS>)` from the deployer key. Confirm via Basescan that `owner()` now returns the Safe address.
2. Set `ORBIT_MERKLE_ANCHOR_CONTRACT=<DEPLOYED_ADDRESS>` in repo variables.
3. Leave `ORBIT_ENABLE_MERKLE_ANCHOR=false` until the pre-launch gate is signed off (D-018).
4. Leave `ORBIT_ANCHOR_DRY_RUN=true` until the first owner-approved live anchor.

## Function reference

- `anchorRoot(uint64 windowEnd, bytes32 root, uint32 leafCount)` — owner-only; one-shot per `windowEnd`.
- `rootForWindow(uint64 windowEnd) -> (bytes32 root, uint32 leafCount, address anchorer, uint64 anchoredAt)` — view; returns all zeros if not anchored.
- `transferOwnership(address newOwner)` — owner-only; rejects the zero address.
- `owner() -> address` — public state variable getter.

## Events

- `RootAnchored(uint64 indexed windowEnd, bytes32 root, uint32 leafCount, address indexed anchorer)`
- `OwnershipTransferred(address indexed previousOwner, address indexed newOwner)`

## Errors

- `NotOwner()` — caller is not the current owner.
- `AlreadyAnchored()` — `windowEnd` already has a non-zero root.
- `ZeroRoot()` — caller passed `bytes32(0)` as the root.
- `ZeroOwner()` — caller passed the zero address to `transferOwnership`.

## Why a minimal hand-rolled Ownable

OpenZeppelin's `Ownable` is fine, but the surface here is so small (one role,
two transitions, four custom errors) that adding a dependency is more cost than
benefit. The contract is intentionally short and re-readable in one screen.

## Source of truth

Behaviour, leaf-hash algorithm, sorted-pair node hashing, window semantics, and
approval flow all live in [`PLAN/SPECS/MERKLE_ANCHOR.md`](../../PLAN/SPECS/MERKLE_ANCHOR.md).
This contract only stores the result.
