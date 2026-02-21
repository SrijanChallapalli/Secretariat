// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./HorseINFT.sol";
import "./HorseSyndicateVault.sol";
import "./HorseSyndicateVaultFactory.sol";
import "./AgentRiskConfig.sol";

/// @title StopLossExecutor - Autonomous stop-loss and Lazarus Protocol execution.
///        The AI agent calls this after a biometric/oracle event triggers a valuation drop.
///        Includes executeLazarusProtocol() for Level 6 biometric emergencies.
contract StopLossExecutor is AccessControl {
    bytes32 public constant EXECUTOR_ROLE = keccak256("EXECUTOR_ROLE");

    HorseINFT public horseNFT;
    HorseSyndicateVaultFactory public vaultFactory;
    AgentRiskConfig public riskConfig;

    mapping(address => uint256) public lastTriggerTime;
    uint256 public cooldownPeriod = 1 hours;

    event StopLossTriggered(
        address indexed vault,
        uint256 indexed horseTokenId,
        uint256 valuationAtTrigger,
        string  reason
    );
    event EmergencyRetireTriggered(address indexed vault, uint256 indexed horseTokenId, uint8 healthScore);
    event LazarusProtocolExecuted(address indexed vault, uint256 indexed horseTokenId);
    event CooldownUpdated(uint256 newCooldown);

    constructor(address _horseNFT, address _vaultFactory, address _riskConfig) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(EXECUTOR_ROLE, msg.sender);
        horseNFT = HorseINFT(_horseNFT);
        vaultFactory = HorseSyndicateVaultFactory(_vaultFactory);
        riskConfig = AgentRiskConfig(_riskConfig);
    }

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

    function executeHealthRetire(uint256 horseTokenId, uint8 healthScore) external onlyRole(EXECUTOR_ROLE) {
        address vaultAddr = vaultFactory.vaultForHorse(horseTokenId);
        require(vaultAddr != address(0), "No vault for horse");

        bool breached = riskConfig.isHealthBreached(vaultAddr, healthScore);
        require(breached, "Health threshold not breached");

        emit EmergencyRetireTriggered(vaultAddr, horseTokenId, healthScore);
    }

    /// @notice Trigger Lazarus Protocol on a vault when stride anomaly / Level 6 risk detected.
    ///         Freezes all secondary trading to prevent information asymmetry dumping.
    /// @param strideDeltaBps Stride deviation in basis points from the biometric oracle
    function executeLazarusProtocol(uint256 horseTokenId, uint16 strideDeltaBps) external onlyRole(EXECUTOR_ROLE) {
        address vaultAddr = vaultFactory.vaultForHorse(horseTokenId);
        require(vaultAddr != address(0), "No vault for horse");

        bool anomaly = riskConfig.isStrideAnomalyDetected(vaultAddr, strideDeltaBps);
        require(anomaly, "No stride anomaly detected");

        HorseSyndicateVault vault = HorseSyndicateVault(vaultAddr);
        require(!vault.frozen(), "Already frozen");

        vault.triggerLazarus();
        horseNFT.setRetired(horseTokenId, true);

        emit LazarusProtocolExecuted(vaultAddr, horseTokenId);
    }

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
