// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./HorseINFT.sol";

/// @title HorseOracle - Role-based race result, injury, news, and biometric updates
contract HorseOracle is AccessControl {
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");
    HorseINFT public horseNFT;

    // Biometric types
    uint8 public constant BIOMETRIC_STRIDE_LENGTH = 0;
    uint8 public constant BIOMETRIC_HEART_RATE    = 1;
    uint8 public constant BIOMETRIC_GAIT_SYMMETRY = 2;
    uint8 public constant BIOMETRIC_RESPIRATION   = 3;
    uint8 public constant BIOMETRIC_TEMPERATURE   = 4;

    struct BiometricReading {
        uint8   biometricType;
        uint256 value;
        uint256 baseline;
        uint16  deviationBps; // how far from baseline in basis points
        uint256 timestamp;
    }

    // tokenId => latest reading per biometric type
    mapping(uint256 => mapping(uint8 => BiometricReading)) public latestBiometrics;

    event RaceResultReported(uint256 indexed tokenId, uint8 placing, uint256 earningsADI);
    event InjuryReported(uint256 indexed tokenId, uint16 severityBps);
    event NewsReported(uint256 indexed tokenId, uint16 sentimentBps);
    event BiometricReported(
        uint256 indexed tokenId,
        uint8   indexed biometricType,
        uint256 value,
        uint256 baseline,
        uint16  deviationBps
    );
    event BiometricAnomalyDetected(
        uint256 indexed tokenId,
        uint8   indexed biometricType,
        uint256 value,
        uint16  deviationBps
    );

    event ValuationCommitted(
        uint256 indexed tokenId,
        uint8   indexed eventType,
        bytes32 indexed eventHash,
        uint256 newValuationADI,
        bytes32 ogRootHash
    );

    constructor(address _horseNFT) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ORACLE_ROLE, msg.sender);
        horseNFT = HorseINFT(_horseNFT);
    }

    function reportRaceResult(uint256 tokenId, uint8 placing, uint256 earningsADI) external onlyRole(ORACLE_ROLE) {
        require(placing >= 1 && placing <= 20, "Invalid placing");
        HorseINFT.HorseData memory h = horseNFT.getHorseData(tokenId);
        uint256 oldVal = h.valuationADI;
        uint256 boost = earningsADI;
        if (placing == 1) boost += oldVal / 10;
        else if (placing == 2) boost += oldVal / 20;
        else if (placing == 3) boost += oldVal / 50;
        uint256 newVal = oldVal + boost;
        horseNFT.updateValuation(tokenId, newVal);
        emit RaceResultReported(tokenId, placing, earningsADI);
    }

    function reportInjury(uint256 tokenId, uint16 severityBps) external onlyRole(ORACLE_ROLE) {
        require(severityBps > 0 && severityBps <= 5000, "Severity out of range");
        HorseINFT.HorseData memory h = horseNFT.getHorseData(tokenId);
        uint256 newVal = (h.valuationADI * (10000 - severityBps)) / 10000;
        horseNFT.updateValuation(tokenId, newVal);
        horseNFT.setInjured(tokenId, true);
        emit InjuryReported(tokenId, severityBps);
    }

    function reportNews(uint256 tokenId, uint16 sentimentBps) external onlyRole(ORACLE_ROLE) {
        require(sentimentBps <= 5000, "Sentiment out of range");
        HorseINFT.HorseData memory h = horseNFT.getHorseData(tokenId);
        uint256 newVal = (h.valuationADI * (10000 + sentimentBps)) / 10000;
        if (newVal > type(uint256).max / 2) newVal = h.valuationADI;
        horseNFT.updateValuation(tokenId, newVal);
        emit NewsReported(tokenId, sentimentBps);
    }

    /// @notice Report a biometric reading for a horse (stride length, heart rate, gait, etc.)
    /// @param tokenId Horse token ID
    /// @param biometricType One of the BIOMETRIC_* constants
    /// @param value The measured value
    /// @param baseline The expected baseline value for this metric
    /// @param anomalyThresholdBps If deviationBps exceeds this, emit anomaly event
    function reportBiometric(
        uint256 tokenId,
        uint8   biometricType,
        uint256 value,
        uint256 baseline,
        uint16  anomalyThresholdBps
    ) external onlyRole(ORACLE_ROLE) {
        require(biometricType <= BIOMETRIC_TEMPERATURE, "Invalid biometric type");
        require(baseline > 0, "Zero baseline");

        uint16 deviationBps;
        if (value >= baseline) {
            deviationBps = uint16(((value - baseline) * 10000) / baseline);
        } else {
            deviationBps = uint16(((baseline - value) * 10000) / baseline);
        }

        latestBiometrics[tokenId][biometricType] = BiometricReading({
            biometricType: biometricType,
            value: value,
            baseline: baseline,
            deviationBps: deviationBps,
            timestamp: block.timestamp
        });

        emit BiometricReported(tokenId, biometricType, value, baseline, deviationBps);

        if (deviationBps > anomalyThresholdBps) {
            emit BiometricAnomalyDetected(tokenId, biometricType, value, deviationBps);
        }
    }

    function getLatestBiometric(uint256 tokenId, uint8 biometricType)
        external view returns (BiometricReading memory)
    {
        return latestBiometrics[tokenId][biometricType];
    }

    /// @notice Commit an agent-computed valuation tied to a canonical event hash.
    /// @param eventType 0=RACE_RESULT, 1=INJURY, 2=NEWS, 3=BIOMETRIC
    function commitValuation(
        uint256 tokenId,
        uint8   eventType,
        bytes32 eventHash,
        uint256 newValuationADI,
        bytes32 ogRootHash
    ) external onlyRole(ORACLE_ROLE) {
        horseNFT.updateValuation(tokenId, newValuationADI);
        if (eventType == 1) {
            horseNFT.setInjured(tokenId, true);
        }
        emit ValuationCommitted(tokenId, eventType, eventHash, newValuationADI, ogRootHash);
    }
}
