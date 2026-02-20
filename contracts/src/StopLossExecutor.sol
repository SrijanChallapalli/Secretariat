// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./HorseINFT.sol";
import "./HorseSyndicateVault.sol";
import "./HorseSyndicateVaultFactory.sol";
import "./AgentRiskConfig.sol";

/// @title StopLossExecutor - Autonomous stop-loss execution when risk parameters are breached.
///        The AI agent calls this after a biometric/oracle event triggers a valuation drop.
contract StopLossExecutor is AccessControl {
    bytes32 public constant EXECUTOR_ROLE = keccak256("EXECUTOR_ROLE");

    HorseINFT public horseNFT;
    HorseSyndicateVaultFactory public vaultFactory;
    AgentRiskConfig public riskConfig;

    // Cooldown to prevent repeated triggers
    mapping(address => uint256) public lastTriggerTime;
    uint256 public cooldownPeriod = 1 hours;

    event StopLossTriggered(
        address indexed vault,
        uint256 indexed horseTokenId,
        uint256 valuationAtTrigger,
        string  reason
    );
    event EmergencyRetireTriggered(address indexed vault, uint256 indexed horseTokenId, uint8 healthScore);
    event CooldownUpdated(uint256 newCooldown);

    constructor(address _horseNFT, address _vaultFactory, address _riskConfig) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(EXECUTOR_ROLE, msg.sender);
        horseNFT = HorseINFT(_horseNFT);
        vaultFactory = HorseSyndicateVaultFactory(_vaultFactory);
        riskConfig = AgentRiskConfig(_riskConfig);
    }

    /// @notice Check and execute stop-loss if valuation floor is breached.
    ///         Called by the AI agent after a valuation update.
    function executeStopLoss(uint256 horseTokenId) external onlyRole(EXECUTOR_ROLE) {
        address vaultAddr = vaultFactory.vaultForHorse(horseTokenId);
        require(vaultAddr != address(0), "No vault for horse");
        require(block.timestamp >= lastTriggerTime[vaultAddr] + cooldownPeriod, "Cooldown active");

        HorseINFT.HorseData memory h = horseNFT.getHorseData(horseTokenId);
        uint256 currentVal = h.valuationADI;

        bool breached = riskConfig.isStopLossBreached(vaultAddr, currentVal);
        require(breached, "Stop-loss not breached");

        lastTriggerTime[vaultAddr] = block.timestamp;
        riskConfig.updatePeakValuation(vaultAddr, currentVal);

        emit StopLossTriggered(vaultAddr, horseTokenId, currentVal, "VALUATION_FLOOR");
    }

    /// @notice Check and execute stop-loss if drawdown from peak is breached
    function executeDrawdownStop(uint256 horseTokenId) external onlyRole(EXECUTOR_ROLE) {
        address vaultAddr = vaultFactory.vaultForHorse(horseTokenId);
        require(vaultAddr != address(0), "No vault for horse");
        require(block.timestamp >= lastTriggerTime[vaultAddr] + cooldownPeriod, "Cooldown active");

        HorseINFT.HorseData memory h = horseNFT.getHorseData(horseTokenId);
        uint256 currentVal = h.valuationADI;

        bool breached = riskConfig.isDrawdownBreached(vaultAddr, currentVal);
        require(breached, "Drawdown not breached");

        lastTriggerTime[vaultAddr] = block.timestamp;

        emit StopLossTriggered(vaultAddr, horseTokenId, currentVal, "MAX_DRAWDOWN");
    }

    /// @notice Trigger forced retirement if health score falls below threshold
    function executeHealthRetire(uint256 horseTokenId, uint8 healthScore) external onlyRole(EXECUTOR_ROLE) {
        address vaultAddr = vaultFactory.vaultForHorse(horseTokenId);
        require(vaultAddr != address(0), "No vault for horse");

        bool breached = riskConfig.isHealthBreached(vaultAddr, healthScore);
        require(breached, "Health threshold not breached");

        emit EmergencyRetireTriggered(vaultAddr, horseTokenId, healthScore);
    }

    /// @notice Update peak valuation tracking (should be called after positive valuation updates)
    function recordPeakValuation(uint256 horseTokenId) external onlyRole(EXECUTOR_ROLE) {
        address vaultAddr = vaultFactory.vaultForHorse(horseTokenId);
        require(vaultAddr != address(0), "No vault for horse");

        HorseINFT.HorseData memory h = horseNFT.getHorseData(horseTokenId);
        riskConfig.updatePeakValuation(vaultAddr, h.valuationADI);
    }

    function setCooldownPeriod(uint256 _cooldown) external onlyRole(DEFAULT_ADMIN_ROLE) {
        cooldownPeriod = _cooldown;
        emit CooldownUpdated(_cooldown);
    }
}
