// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title MockINFTOracle - DEMO ONLY
/// @notice For MVP we always verify. Production must use TEE/ZKP verifier per ERC-7857.
contract MockINFTOracle {
    function verifyProof(bytes32, bytes32, bytes calldata, bytes calldata) external pure returns (bool) {
        return true;
    }
}
