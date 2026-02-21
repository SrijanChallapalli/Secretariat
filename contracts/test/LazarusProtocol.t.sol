// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import "../src/KYCRegistry.sol";
import "../src/HorseINFT.sol";
import "../src/HorseSyndicateVault.sol";
import "../src/HorseSyndicateVaultFactory.sol";
import "../src/HorseOracle.sol";
import "../src/MockINFTOracle.sol";
import "../src/MockADI.sol";

contract LazarusProtocolTest is Test, ERC721Holder {
    MockADI adi;
    MockINFTOracle mockOracle;
    HorseINFT horseNFT;
    KYCRegistry kyc;
    HorseSyndicateVaultFactory factory;
    HorseSyndicateVault vault;
    HorseOracle horseOracle;

    address owner = address(this);
    address alice = address(0xA11CE);
    address bob = address(0xB0B);
    address treasury = address(0xFEE);
    address vetBill = address(0xDEAD);

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
            name: "TestHorse", birthTimestamp: uint64(block.timestamp - 365 days),
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

        // Setup investors
        kyc.verify(alice);
        kyc.verify(bob);
        kyc.verifyAccredited(alice);
        kyc.verifyAccredited(bob);
        adi.mint(alice, 10000 ether);
        adi.mint(bob, 10000 ether);

        vm.startPrank(alice);
        adi.approve(address(vault), type(uint256).max);
        vault.buyShares(100);
        vm.stopPrank();
    }

    function test_triggerLazarus_freezes_vault() public {
        vault.triggerLazarus();

        assertTrue(vault.frozen());
        assertTrue(vault.insurancePivot());
        assertGt(vault.creditorEscrowEnd(), block.timestamp);
    }

    function test_frozen_vault_blocks_transfers() public {
        vault.triggerLazarus();

        vm.warp(block.timestamp + 91 days);

        vm.prank(alice);
        vm.expectRevert("Vault frozen - Lazarus Protocol active");
        vault.transfer(bob, 10);
    }

    function test_frozen_vault_blocks_share_purchase() public {
        vault.triggerLazarus();

        vm.startPrank(bob);
        adi.approve(address(vault), type(uint256).max);
        vm.expectRevert("Vault frozen - Lazarus Protocol active");
        vault.buyShares(1);
        vm.stopPrank();
    }

    function test_insurance_payout_deposit_and_creditor_payment() public {
        vault.triggerLazarus();

        // Deposit insurance payout
        adi.mint(owner, 50000 ether);
        adi.approve(address(vault), type(uint256).max);
        vault.depositInsurancePayout(50000 ether);

        assertEq(vault.insurancePayout(), 50000 ether);

        // Pay creditor during escrow
        vault.payCreditor(vetBill, 5000 ether);

        assertEq(vault.insurancePayout(), 45000 ether);
        assertEq(adi.balanceOf(vetBill), 5000 ether);
    }

    function test_creditor_payment_blocked_after_escrow() public {
        vault.triggerLazarus();

        adi.mint(owner, 50000 ether);
        adi.approve(address(vault), type(uint256).max);
        vault.depositInsurancePayout(50000 ether);

        // Warp past 60-day escrow
        vm.warp(block.timestamp + 61 days);

        vm.expectRevert("Escrow period ended");
        vault.payCreditor(vetBill, 1000 ether);
    }

    function test_distribute_insurance_remainder_after_escrow() public {
        vault.triggerLazarus();

        adi.mint(owner, 50000 ether);
        adi.approve(address(vault), type(uint256).max);
        vault.depositInsurancePayout(50000 ether);

        vault.payCreditor(vetBill, 10000 ether);

        // Warp past escrow
        vm.warp(block.timestamp + 61 days);

        vault.distributeInsuranceRemainder();

        assertEq(vault.insurancePayout(), 0);
        assertEq(vault.claimableRevenue(), 40000 ether);
    }

    function test_distribute_blocked_during_escrow() public {
        vault.triggerLazarus();

        adi.mint(owner, 50000 ether);
        adi.approve(address(vault), type(uint256).max);
        vault.depositInsurancePayout(50000 ether);

        vm.expectRevert("Escrow period not ended");
        vault.distributeInsuranceRemainder();
    }

    function test_unfreeze_vault() public {
        vault.triggerLazarus();
        assertTrue(vault.frozen());

        vault.unfreezeVault();
        assertFalse(vault.frozen());
    }

    function test_oracle_risk_score_6_triggers_lazarus() public {
        // reportRiskScore(6) should trigger Lazarus via _triggerCriticalBiologicalEmergency
        horseOracle.reportRiskScore(horseTokenId, 6);

        assertTrue(vault.frozen());
        assertTrue(vault.insurancePivot());
    }

    function test_oracle_critical_emergency_triggers_lazarus() public {
        horseOracle.reportCriticalBiologicalEmergency(horseTokenId);

        assertTrue(vault.frozen());
        assertTrue(horseNFT.getHorseData(horseTokenId).injured);
    }
}
