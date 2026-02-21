// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import "../src/HorseINFT.sol";
import "../src/HorseOracle.sol";
import "../src/HorseSyndicateVault.sol";
import "../src/HorseSyndicateVaultFactory.sol";
import "../src/KYCRegistry.sol";
import "../src/MockINFTOracle.sol";
import "../src/MockADI.sol";

contract RiskScoreTest is Test, ERC721Holder {
    MockADI adi;
    MockINFTOracle mockOracle;
    HorseINFT horseNFT;
    KYCRegistry kyc;
    HorseSyndicateVaultFactory factory;
    HorseSyndicateVault vault;
    HorseOracle horseOracle;

    address owner = address(this);
    address treasury = address(0xFEE);

    uint256 horseTokenId;

    function setUp() public {
        vm.warp(365 days + 1);

        adi = new MockADI();
        mockOracle = new MockINFTOracle();
        horseNFT = new HorseINFT(address(mockOracle));
        kyc = new KYCRegistry();

        factory = new HorseSyndicateVaultFactory(
            address(adi), address(horseNFT), address(kyc),
            treasury, 300, 1000
        );

        horseOracle = new HorseOracle(
            address(horseNFT), address(adi), treasury, address(factory), 0
        );
        horseNFT.setHorseOracle(address(horseOracle));

        HorseINFT.HorseData memory data = HorseINFT.HorseData({
            name: "RiskHorse", birthTimestamp: uint64(block.timestamp - 365 days),
            sireId: 0, damId: 0,
            traitVector: [uint8(80), 80, 70, 75, 90, 70, 60, 65],
            pedigreeScore: 5000, valuationADI: 100 ether,
            dnaHash: bytes32(0), breedingAvailable: false,
            injured: false, retired: false, xFactorCarrier: false,
            encryptedURI: "", metadataHash: bytes32(0)
        });

        horseTokenId = horseNFT.mint(owner, "", bytes32(0), data);

        address vaultAddr = factory.createVault(horseTokenId, 1000, 1 ether, 30000, 4600, 8208);
        vault = HorseSyndicateVault(vaultAddr);
        vault.setHorseOracle(address(horseOracle));
    }

    function test_report_risk_score_1_to_5() public {
        for (uint8 i = 1; i <= 5; i++) {
            horseOracle.reportRiskScore(horseTokenId, i);
            assertEq(horseOracle.riskScores(horseTokenId), i);
            assertFalse(vault.frozen());
        }
    }

    function test_report_risk_score_6_triggers_lazarus() public {
        assertFalse(vault.frozen());

        horseOracle.reportRiskScore(horseTokenId, 6);

        assertEq(horseOracle.riskScores(horseTokenId), 6);
        assertTrue(vault.frozen());
        assertTrue(vault.insurancePivot());
    }

    function test_invalid_risk_score_reverts() public {
        vm.expectRevert("Risk score must be 1-6");
        horseOracle.reportRiskScore(horseTokenId, 0);

        vm.expectRevert("Risk score must be 1-6");
        horseOracle.reportRiskScore(horseTokenId, 7);
    }

    function test_critical_biological_emergency_sets_injured() public {
        assertFalse(horseNFT.getHorseData(horseTokenId).injured);

        horseOracle.reportCriticalBiologicalEmergency(horseTokenId);

        assertTrue(horseNFT.getHorseData(horseTokenId).injured);
        assertEq(horseOracle.riskScores(horseTokenId), 6);
    }

    function test_risk_score_6_on_already_frozen_vault_is_noop() public {
        // Freeze vault first
        vault.triggerLazarus();
        assertTrue(vault.frozen());

        // Reporting risk score 6 again should not revert
        horseOracle.reportRiskScore(horseTokenId, 6);
        assertEq(horseOracle.riskScores(horseTokenId), 6);
    }

    function test_oracle_access_fee_for_non_oracle() public {
        // Set a fee
        horseOracle.setOracleAccessFee(50 ether);

        address querier = address(0xABC);
        adi.mint(querier, 1000 ether);

        vm.startPrank(querier);
        adi.approve(address(horseOracle), type(uint256).max);
        (uint256 valuation, uint8 riskScore) = horseOracle.queryIBV(horseTokenId);
        vm.stopPrank();

        assertEq(valuation, 100 ether);
        assertGe(adi.balanceOf(treasury), 50 ether);
    }

    function test_oracle_role_queries_free() public {
        horseOracle.setOracleAccessFee(50 ether);

        // Owner has ORACLE_ROLE by default
        (uint256 valuation, uint8 riskScore) = horseOracle.queryIBV(horseTokenId);
        assertEq(valuation, 100 ether);
    }
}
