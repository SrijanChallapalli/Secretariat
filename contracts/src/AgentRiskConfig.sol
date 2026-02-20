// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

/// @title AgentRiskConfig - Per-vault risk parameters for the DeFAI Mixing Board.
///        Defines the mathematically rigid borders within which the AI agent operates.
contract AgentRiskConfig is Ownable {

    struct RiskParams {
        uint256 minValuationADI;       // Hard floor: trigger stop-loss if valuation drops below
        uint16  maxDrawdownBps;        // Max % drop from peak before action (basis points)
        uint16  maxPositionSizeBps;    // Max % of portfolio in single asset (basis points)
        uint8   healthThreshold;       // Min health score (0-100) before forced retirement vote
        uint16  strideDeltaThresholdBps; // Biometric stride anomaly trigger (basis points deviation)
        uint256 peakValuation;         // Tracks the highest recorded valuation (auto-updated)
        bool    stopLossEnabled;
        bool    autoRetireOnHealth;
    }

    // vault address => risk parameters
    mapping(address => RiskParams) public riskParams;
    // vault address => authorized configurator (governance or owner)
    mapping(address => address) public configurator;

    event RiskParamsUpdated(
        address indexed vault,
        uint256 minValuationADI,
        uint16  maxDrawdownBps,
        uint16  maxPositionSizeBps,
        uint8   healthThreshold,
        uint16  strideDeltaThresholdBps,
        bool    stopLossEnabled,
        bool    autoRetireOnHealth
    );
    event PeakValuationUpdated(address indexed vault, uint256 newPeak);
    event ConfiguratorUpdated(address indexed vault, address configurator);

    constructor() Ownable(msg.sender) {}

    /// @notice Set the configurator for a vault (typically the governance contract or vault owner)
    function setConfigurator(address vault, address _configurator) external onlyOwner {
        configurator[vault] = _configurator;
        emit ConfiguratorUpdated(vault, _configurator);
    }

    modifier onlyConfigurator(address vault) {
        require(
            msg.sender == owner() || msg.sender == configurator[vault],
            "Not configurator"
        );
        _;
    }

    function setRiskParams(
        address vault,
        uint256 minValuationADI,
        uint16  maxDrawdownBps,
        uint16  maxPositionSizeBps,
        uint8   healthThreshold,
        uint16  strideDeltaThresholdBps,
        bool    stopLossEnabled,
        bool    autoRetireOnHealth
    ) external onlyConfigurator(vault) {
        require(maxDrawdownBps <= 10000, "Invalid drawdown bps");
        require(maxPositionSizeBps <= 10000, "Invalid position size bps");
        require(healthThreshold <= 100, "Invalid health threshold");

        RiskParams storage p = riskParams[vault];
        p.minValuationADI = minValuationADI;
        p.maxDrawdownBps = maxDrawdownBps;
        p.maxPositionSizeBps = maxPositionSizeBps;
        p.healthThreshold = healthThreshold;
        p.strideDeltaThresholdBps = strideDeltaThresholdBps;
        p.stopLossEnabled = stopLossEnabled;
        p.autoRetireOnHealth = autoRetireOnHealth;

        emit RiskParamsUpdated(
            vault, minValuationADI, maxDrawdownBps, maxPositionSizeBps,
            healthThreshold, strideDeltaThresholdBps, stopLossEnabled, autoRetireOnHealth
        );
    }

    /// @notice Called by oracle/executor after each valuation update to track peak
    function updatePeakValuation(address vault, uint256 currentValuation) external {
        RiskParams storage p = riskParams[vault];
        if (currentValuation > p.peakValuation) {
            p.peakValuation = currentValuation;
            emit PeakValuationUpdated(vault, currentValuation);
        }
    }

    /// @notice Check if the current valuation breaches the hard floor stop-loss
    function isStopLossBreached(address vault, uint256 currentValuation) external view returns (bool) {
        RiskParams storage p = riskParams[vault];
        if (!p.stopLossEnabled) return false;
        return currentValuation < p.minValuationADI;
    }

    /// @notice Check if the drawdown from peak exceeds max allowed
    function isDrawdownBreached(address vault, uint256 currentValuation) external view returns (bool) {
        RiskParams storage p = riskParams[vault];
        if (!p.stopLossEnabled || p.peakValuation == 0) return false;
        uint256 drawdownBps = ((p.peakValuation - currentValuation) * 10000) / p.peakValuation;
        return drawdownBps > p.maxDrawdownBps;
    }

    /// @notice Check if health score is below threshold
    function isHealthBreached(address vault, uint8 healthScore) external view returns (bool) {
        RiskParams storage p = riskParams[vault];
        if (!p.autoRetireOnHealth) return false;
        return healthScore < p.healthThreshold;
    }

    /// @notice Check if stride delta exceeds threshold
    function isStrideAnomalyDetected(address vault, uint16 strideDeltaBps) external view returns (bool) {
        RiskParams storage p = riskParams[vault];
        return strideDeltaBps > p.strideDeltaThresholdBps;
    }

    function getRiskParams(address vault) external view returns (RiskParams memory) {
        return riskParams[vault];
    }
}
