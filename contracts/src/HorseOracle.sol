// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./HorseINFT.sol";

/// @title HorseOracle - Role-based race result, injury, news updates; updates valuation
contract HorseOracle is AccessControl {
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");
    HorseINFT public horseNFT;

    event RaceResultReported(uint256 indexed tokenId, uint8 placing, uint256 earningsADI);
    event InjuryReported(uint256 indexed tokenId, uint16 severityBps);
    event NewsReported(uint256 indexed tokenId, uint16 sentimentBps);

    constructor(address _horseNFT) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ORACLE_ROLE, msg.sender);
        horseNFT = HorseINFT(_horseNFT);
    }

    function reportRaceResult(uint256 tokenId, uint8 placing, uint256 earningsADI) external onlyRole(ORACLE_ROLE) {
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
        HorseINFT.HorseData memory h = horseNFT.getHorseData(tokenId);
        uint256 newVal = (h.valuationADI * (10000 - severityBps)) / 10000;
        horseNFT.updateValuation(tokenId, newVal);
        horseNFT.setInjured(tokenId, true);
        emit InjuryReported(tokenId, severityBps);
    }

    function reportNews(uint256 tokenId, uint16 sentimentBps) external onlyRole(ORACLE_ROLE) {
        HorseINFT.HorseData memory h = horseNFT.getHorseData(tokenId);
        uint256 newVal = (h.valuationADI * (10000 + sentimentBps)) / 10000;
        if (newVal > type(uint256).max / 2) newVal = h.valuationADI;
        horseNFT.updateValuation(tokenId, newVal);
        emit NewsReported(tokenId, sentimentBps);
    }
}
