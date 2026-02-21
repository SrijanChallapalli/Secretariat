// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./HorseINFT.sol";
import "./HorseSyndicateVault.sol";
import "./HorseSyndicateVaultFactory.sol";

/// @title HorseOracle - Role-based race result, injury, news, biometric, and risk score updates.
///        Includes oracle access fees for third-party IBV queries and Critical Biological
///        Emergency reporting that triggers the Lazarus Protocol on associated vaults.
contract HorseOracle is AccessControl {
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");
    HorseINFT public horseNFT;

    // --- Oracle access fees ---
    IERC20 public adi;
    address public protocolTreasury;
    uint256 public oracleAccessFee;

    // --- Vault factory for Lazarus Protocol integration ---
    HorseSyndicateVaultFactory public vaultFactory;

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
        uint16  deviationBps;
        uint256 timestamp;
    }

    mapping(uint256 => mapping(uint8 => BiometricReading)) public latestBiometrics;

    // --- Risk Score (1-6 scale) ---
    mapping(uint256 => uint8) public riskScores;

    // --- Events ---
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
    event RiskScoreUpdated(uint256 indexed tokenId, uint8 oldScore, uint8 newScore);
    event CriticalBiologicalEmergency(uint256 indexed tokenId, uint256 timestamp);
    event OracleAccessFeeUpdated(uint256 newFee);
    event OracleQueried(uint256 indexed tokenId, address indexed caller, uint256 feePaid);

    constructor(
        address _horseNFT,
        address _adi,
        address _protocolTreasury,
        address _vaultFactory,
        uint256 _oracleAccessFee
    ) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ORACLE_ROLE, msg.sender);
        horseNFT = HorseINFT(_horseNFT);
        adi = IERC20(_adi);
        protocolTreasury = _protocolTreasury;
        if (_vaultFactory != address(0)) {
            vaultFactory = HorseSyndicateVaultFactory(_vaultFactory);
        }
        oracleAccessFee = _oracleAccessFee;
    }

    // -----------------------------------------------------------------------
    // Oracle Access Fee — third parties pay to query IBV + Risk Score
    // -----------------------------------------------------------------------

    /// @notice Query a horse's current valuation and risk score. Free for ORACLE_ROLE;
    ///         external callers pay oracleAccessFee in ADI routed to protocolTreasury.
    function queryIBV(uint256 tokenId) external returns (uint256 valuation, uint8 riskScore) {
        if (!hasRole(ORACLE_ROLE, msg.sender)) {
            require(oracleAccessFee > 0, "Fee not set");
            require(protocolTreasury != address(0), "Treasury not set");
            adi.transferFrom(msg.sender, protocolTreasury, oracleAccessFee);
            emit OracleQueried(tokenId, msg.sender, oracleAccessFee);
        }
        HorseINFT.HorseData memory h = horseNFT.getHorseData(tokenId);
        return (h.valuationADI, riskScores[tokenId]);
    }

    function setOracleAccessFee(uint256 _fee) external onlyRole(DEFAULT_ADMIN_ROLE) {
        oracleAccessFee = _fee;
        emit OracleAccessFeeUpdated(_fee);
    }

    function setProtocolTreasury(address _treasury) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_treasury != address(0), "Zero address");
        protocolTreasury = _treasury;
    }

    function setVaultFactory(address _factory) external onlyRole(DEFAULT_ADMIN_ROLE) {
        vaultFactory = HorseSyndicateVaultFactory(_factory);
    }

    // -----------------------------------------------------------------------
    // Race, Injury, News reporting (existing functionality)
    // -----------------------------------------------------------------------

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

    // -----------------------------------------------------------------------
    // Biometric reporting
    // -----------------------------------------------------------------------

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

    // -----------------------------------------------------------------------
    // Risk Score (1-6) + Critical Biological Emergency
    // -----------------------------------------------------------------------

    /// @notice Report the AI-computed risk score (1-6). Level 6 auto-triggers
    ///         the Lazarus Protocol on the associated vault.
    function reportRiskScore(uint256 tokenId, uint8 riskScore) external onlyRole(ORACLE_ROLE) {
        require(riskScore >= 1 && riskScore <= 6, "Risk score must be 1-6");
        uint8 oldScore = riskScores[tokenId];
        riskScores[tokenId] = riskScore;
        emit RiskScoreUpdated(tokenId, oldScore, riskScore);

        if (riskScore == 6) {
            _triggerCriticalBiologicalEmergency(tokenId);
        }
    }

    /// @notice Directly report a Critical Biological Emergency (Vets' List, catastrophic failure).
    function reportCriticalBiologicalEmergency(uint256 tokenId) external onlyRole(ORACLE_ROLE) {
        riskScores[tokenId] = 6;
        _triggerCriticalBiologicalEmergency(tokenId);
    }

    function _triggerCriticalBiologicalEmergency(uint256 tokenId) internal {
        emit CriticalBiologicalEmergency(tokenId, block.timestamp);

        horseNFT.setInjured(tokenId, true);

        // Trigger Lazarus Protocol on the associated vault if one exists
        if (address(vaultFactory) != address(0)) {
            address vaultAddr = vaultFactory.vaultForHorse(tokenId);
            if (vaultAddr != address(0)) {
                HorseSyndicateVault vault = HorseSyndicateVault(vaultAddr);
                if (!vault.frozen()) {
                    vault.triggerLazarus();
                }
            }
        }
    }

    // -----------------------------------------------------------------------
    // Valuation commit (agent-computed, tied to canonical event hash)
    // -----------------------------------------------------------------------

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
