// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Orbit Merkle Anchor Registry
/// @notice Stores one Merkle root per UTC day for Orbit cycle proofs.
/// @dev Deliberately minimal: no upgradeability, no token logic, no fees, no
///      re-anchoring. Owner is set to msg.sender at deploy time and should be
///      transferred to the Treasury Safe immediately after deploy.
///
///      The Merkle root is computed off-chain by the Orbit cycle engine over
///      sha256 leaf hashes of canonical cycle proof bodies, with sorted-pair
///      sha256 node hashing. See PLAN/SPECS/MERKLE_ANCHOR.md for the canonical
///      definition. This contract is only the storage and emission layer.
///
///      Decisions: D-012 (daily anchor in Phase 2), D-014 (no on-chain action
///      without approval), D-018 (no live on-chain action before pre-launch
///      gate is verified).
contract MerkleAnchor {
    /// @notice Anchor record stored per windowEnd.
    struct Anchor {
        bytes32 root;
        uint32 leafCount;
        address anchorer;
        uint64 anchoredAt;
    }

    /// @notice Owner authorized to anchor roots and transfer ownership.
    address public owner;

    /// @notice windowEnd (unix seconds, UTC) -> Anchor record.
    mapping(uint64 => Anchor) private _anchors;

    /// @notice Emitted exactly once per successful anchor.
    event RootAnchored(
        uint64 indexed windowEnd,
        bytes32 root,
        uint32 leafCount,
        address indexed anchorer
    );

    /// @notice Emitted when ownership is transferred.
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    /// @dev Reverts when the caller is not the owner.
    error NotOwner();
    /// @dev Reverts when a non-zero root already exists for the given windowEnd.
    error AlreadyAnchored();
    /// @dev Reverts when caller passes the zero root.
    error ZeroRoot();
    /// @dev Reverts when caller passes the zero address as new owner.
    error ZeroOwner();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor() {
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    /// @notice Anchor a Merkle root for a given window end.
    /// @param windowEnd Unix seconds (UTC) marking the end of the proof window.
    /// @param root Off-chain Merkle root over sha256 leaf hashes.
    /// @param leafCount Number of leaves in the tree.
    function anchorRoot(uint64 windowEnd, bytes32 root, uint32 leafCount) external onlyOwner {
        if (root == bytes32(0)) revert ZeroRoot();
        Anchor storage existing = _anchors[windowEnd];
        if (existing.root != bytes32(0)) revert AlreadyAnchored();

        _anchors[windowEnd] = Anchor({
            root: root,
            leafCount: leafCount,
            anchorer: msg.sender,
            anchoredAt: uint64(block.timestamp)
        });

        emit RootAnchored(windowEnd, root, leafCount, msg.sender);
    }

    /// @notice Read an anchored root.
    function rootForWindow(uint64 windowEnd)
        external
        view
        returns (bytes32 root, uint32 leafCount, address anchorer, uint64 anchoredAt)
    {
        Anchor storage a = _anchors[windowEnd];
        return (a.root, a.leafCount, a.anchorer, a.anchoredAt);
    }

    /// @notice Transfer ownership. Owner is expected to transfer to the
    ///         Treasury Safe immediately after deploy.
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroOwner();
        address previous = owner;
        owner = newOwner;
        emit OwnershipTransferred(previous, newOwner);
    }
}
