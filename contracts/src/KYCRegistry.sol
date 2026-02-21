// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";

/// @title KYCRegistry - On-chain KYC + Accreditation gate for SEC Reg D 506(c) compliance.
///        All investors must be both KYC-verified AND accredited. Accreditation expires
///        annually per SEC guidance and must be re-verified.
contract KYCRegistry is AccessControl {
    bytes32 public constant KYC_ADMIN_ROLE = keccak256("KYC_ADMIN_ROLE");
    bytes32 public constant ACCREDITATION_ADMIN_ROLE = keccak256("ACCREDITATION_ADMIN_ROLE");

    uint256 public constant ACCREDITATION_VALIDITY = 365 days;

    // --- KYC state ---
    mapping(address => bool) public isVerified;
    mapping(address => uint256) public verifiedAt;

    // --- Accreditation state (Reg D 506c) ---
    mapping(address => bool) public isAccredited;
    mapping(address => uint256) public accreditedAt;
    mapping(address => uint256) public accreditationExpiry;

    // --- Events ---
    event AddressVerified(address indexed account, address indexed verifier);
    event AddressRevoked(address indexed account, address indexed revoker);
    event AccreditationVerified(address indexed account, address indexed verifier, uint256 expiry);
    event AccreditationRevoked(address indexed account, address indexed revoker);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(KYC_ADMIN_ROLE, msg.sender);
        _grantRole(ACCREDITATION_ADMIN_ROLE, msg.sender);
    }

    // -----------------------------------------------------------------------
    // KYC
    // -----------------------------------------------------------------------

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

    // -----------------------------------------------------------------------
    // Accreditation (SEC Reg D 506c — annual re-verification required)
    // -----------------------------------------------------------------------

    function verifyAccredited(address account) external onlyRole(ACCREDITATION_ADMIN_ROLE) {
        require(account != address(0), "Zero address");
        uint256 expiry = block.timestamp + ACCREDITATION_VALIDITY;
        isAccredited[account] = true;
        accreditedAt[account] = block.timestamp;
        accreditationExpiry[account] = expiry;
        emit AccreditationVerified(account, msg.sender, expiry);
    }

    function verifyAccreditedBatch(address[] calldata accounts) external onlyRole(ACCREDITATION_ADMIN_ROLE) {
        uint256 expiry = block.timestamp + ACCREDITATION_VALIDITY;
        for (uint256 i = 0; i < accounts.length; i++) {
            address account = accounts[i];
            if (account != address(0)) {
                isAccredited[account] = true;
                accreditedAt[account] = block.timestamp;
                accreditationExpiry[account] = expiry;
                emit AccreditationVerified(account, msg.sender, expiry);
            }
        }
    }

    function revokeAccreditation(address account) external onlyRole(ACCREDITATION_ADMIN_ROLE) {
        require(isAccredited[account], "Not accredited");
        isAccredited[account] = false;
        accreditedAt[account] = 0;
        accreditationExpiry[account] = 0;
        emit AccreditationRevoked(account, msg.sender);
    }

    /// @notice Returns true only if the account has a non-expired accreditation.
    function isCurrentlyAccredited(address account) external view returns (bool) {
        return isAccredited[account] && block.timestamp <= accreditationExpiry[account];
    }

    /// @notice Combined gate: KYC-verified AND currently accredited.
    function isFullyCompliant(address account) external view returns (bool) {
        return isVerified[account]
            && isAccredited[account]
            && block.timestamp <= accreditationExpiry[account];
    }
}
