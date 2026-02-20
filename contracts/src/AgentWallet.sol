// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/interfaces/draft-IERC4337.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title AgentWallet - ERC-4337 compatible smart account for autonomous AI agent operations.
///        Holds ADI for paying veterinary API data, executing stop-losses, and approving invoices.
///        Spending is bounded by configurable daily/weekly limits to prevent rogue behavior.
contract AgentWallet is IAccount, Ownable {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    address public immutable entryPoint;
    address public agentSigner; // EOA controlled by the AI agent's key

    struct SpendingLimit {
        uint256 dailyLimit;
        uint256 weeklyLimit;
        uint256 spentToday;
        uint256 spentThisWeek;
        uint256 dayStart;
        uint256 weekStart;
    }

    // token address => spending limit (address(0) for native ETH)
    mapping(address => SpendingLimit) public spendingLimits;

    // Approved target contracts the agent can call
    mapping(address => bool) public approvedTargets;

    event AgentSignerUpdated(address indexed oldSigner, address indexed newSigner);
    event SpendingLimitSet(address indexed token, uint256 dailyLimit, uint256 weeklyLimit);
    event TargetApproved(address indexed target, bool approved);
    event Executed(address indexed target, uint256 value, bytes data);

    modifier onlyEntryPoint() {
        require(msg.sender == entryPoint, "Not entry point");
        _;
    }

    modifier onlyOwnerOrEntryPoint() {
        require(msg.sender == owner() || msg.sender == entryPoint, "Not authorized");
        _;
    }

    constructor(address _entryPoint, address _agentSigner) Ownable(msg.sender) {
        require(_entryPoint != address(0), "Zero entry point");
        require(_agentSigner != address(0), "Zero agent signer");
        entryPoint = _entryPoint;
        agentSigner = _agentSigner;
    }

    // -----------------------------------------------------------------------
    // ERC-4337 IAccount implementation
    // -----------------------------------------------------------------------

    function validateUserOp(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 missingAccountFunds
    ) external onlyEntryPoint returns (uint256 validationData) {
        bytes32 ethSignedHash = userOpHash.toEthSignedMessageHash();
        address recovered = ethSignedHash.recover(userOp.signature);

        if (recovered != agentSigner) {
            return 1; // SIG_VALIDATION_FAILED
        }

        if (missingAccountFunds > 0) {
            (bool success,) = payable(entryPoint).call{value: missingAccountFunds}("");
            require(success, "Fund transfer failed");
        }

        return 0;
    }

    // -----------------------------------------------------------------------
    // Execution (can be called by entryPoint via UserOp or directly by owner)
    // -----------------------------------------------------------------------

    function execute(address target, uint256 value, bytes calldata data)
        external
        onlyOwnerOrEntryPoint
        returns (bytes memory)
    {
        require(approvedTargets[target] || msg.sender == owner(), "Target not approved");

        (bool success, bytes memory result) = target.call{value: value}(data);
        require(success, "Execution failed");
        emit Executed(target, value, data);
        return result;
    }

    /// @notice Transfer ERC-20 tokens with spending limit enforcement
    function transferToken(address token, address to, uint256 amount) external onlyOwnerOrEntryPoint {
        _checkAndUpdateSpending(token, amount);
        IERC20(token).transfer(to, amount);
    }

    // -----------------------------------------------------------------------
    // Spending limits
    // -----------------------------------------------------------------------

    function setSpendingLimit(address token, uint256 dailyLimit, uint256 weeklyLimit) external onlyOwner {
        SpendingLimit storage limit = spendingLimits[token];
        limit.dailyLimit = dailyLimit;
        limit.weeklyLimit = weeklyLimit;
        emit SpendingLimitSet(token, dailyLimit, weeklyLimit);
    }

    function _checkAndUpdateSpending(address token, uint256 amount) internal {
        SpendingLimit storage limit = spendingLimits[token];
        if (limit.dailyLimit == 0 && limit.weeklyLimit == 0) return; // no limits set

        // Reset daily counter if a new day
        if (block.timestamp >= limit.dayStart + 1 days) {
            limit.spentToday = 0;
            limit.dayStart = block.timestamp;
        }

        // Reset weekly counter if a new week
        if (block.timestamp >= limit.weekStart + 7 days) {
            limit.spentThisWeek = 0;
            limit.weekStart = block.timestamp;
        }

        if (limit.dailyLimit > 0) {
            require(limit.spentToday + amount <= limit.dailyLimit, "Daily limit exceeded");
        }
        if (limit.weeklyLimit > 0) {
            require(limit.spentThisWeek + amount <= limit.weeklyLimit, "Weekly limit exceeded");
        }

        limit.spentToday += amount;
        limit.spentThisWeek += amount;
    }

    // -----------------------------------------------------------------------
    // Configuration
    // -----------------------------------------------------------------------

    function setAgentSigner(address _signer) external onlyOwner {
        require(_signer != address(0), "Zero signer");
        address old = agentSigner;
        agentSigner = _signer;
        emit AgentSignerUpdated(old, _signer);
    }

    function setApprovedTarget(address target, bool approved) external onlyOwner {
        approvedTargets[target] = approved;
        emit TargetApproved(target, approved);
    }

    // -----------------------------------------------------------------------
    // Receive ETH (for gas refunds from EntryPoint)
    // -----------------------------------------------------------------------

    receive() external payable {}
}
