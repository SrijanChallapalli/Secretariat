// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";

/// @title KYCRegistry - On-chain KYC identity gate for institutional compliance
contract KYCRegistry is AccessControl {
    bytes32 public constant KYC_ADMIN_ROLE = keccak256("KYC_ADMIN_ROLE");

    mapping(address => bool) public isVerified;
    mapping(address => uint256) public verifiedAt;

    event AddressVerified(address indexed account, address indexed verifier);
    event AddressRevoked(address indexed account, address indexed revoker);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(KYC_ADMIN_ROLE, msg.sender);
    }

    function verify(address account) external onlyRole(KYC_ADMIN_ROLE) {
        require(account != address(0), "Zero address");
        require(!isVerified[account], "Already verified");
        isVerified[account] = true;
        verifiedAt[account] = block.timestamp;
        emit AddressVerified(account, msg.sender);
    }

    function verifyBatch(address[] calldata accounts) external onlyRole(KYC_ADMIN_ROLE) {
        for (uint256 i = 0; i < accounts.length; i++) {
            address account = accounts[i];
            if (account != address(0) && !isVerified[account]) {
                isVerified[account] = true;
                verifiedAt[account] = block.timestamp;
                emit AddressVerified(account, msg.sender);
            }
        }
    }

    function revoke(address account) external onlyRole(KYC_ADMIN_ROLE) {
        require(isVerified[account], "Not verified");
        isVerified[account] = false;
        verifiedAt[account] = 0;
        emit AddressRevoked(account, msg.sender);
    }
}
