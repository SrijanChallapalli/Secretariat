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

contract RevenueArchitectureTest is Test, ERC721Holder {
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
    address depositor = address(0xDE90);

    uint256 horseTokenId;

    function setUp() public {
        vm.warp(365 days + 1);

        adi = new MockADI();
        mockOracle = new MockINFTOracle();
        horseNFT = new HorseINFT(address(mockOracle));
        kyc = new KYCRegistry();

        factory = new HorseSyndicateVaultFactory(
            address(adi), address(horseNFT), address(kyc),
            treasury, 400, 1000 // 4% origination, 10% yield skim
        );

        horseOracle = new HorseOracle(
            address(horseNFT), address(adi), treasury, address(factory), 100 ether
        );

        HorseINFT.HorseData memory data = HorseINFT.HorseData({
            name: "RevenueHorse", birthTimestamp: uint64(block.timestamp - 365 days),
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

        kyc.verify(alice);
        kyc.verifyAccredited(alice);
        adi.mint(alice, 100000 ether);
        adi.mint(depositor, 100000 ether);
    }

    function test_origination_fee_deducted() public {
        uint256 treasuryBefore = adi.balanceOf(treasury);

        vm.startPrank(alice);
        adi.approve(address(vault), type(uint256).max);
        vault.buyShares(100);
        vm.stopPrank();

        uint256 cost = 100 ether;
        uint256 expectedFee = (cost * 400) / 10000; // 4%
        assertEq(adi.balanceOf(treasury) - treasuryBefore, expectedFee);
    }

    function test_distributeYield_skims_10_percent() public {
        // First buy some shares
        vm.startPrank(alice);
        adi.approve(address(vault), type(uint256).max);
        vault.buyShares(100);
        vm.stopPrank();

        uint256 treasuryBefore = adi.balanceOf(treasury);

        // Distribute yield
        vm.startPrank(depositor);
        adi.approve(address(vault), type(uint256).max);
        vault.distributeYield(10000 ether);
        vm.stopPrank();

        uint256 protocolFee = (10000 ether * 1000) / 10000; // 10%
        assertEq(adi.balanceOf(treasury) - treasuryBefore, protocolFee);
    }

    function test_sweepDust_collects_rounding_dust() public {
        vm.startPrank(alice);
        adi.approve(address(vault), type(uint256).max);
        vault.buyShares(100);
        vm.stopPrank();

        // Send some extra ADI directly (simulating dust)
        adi.mint(address(vault), 42);

        uint256 bufferBefore = vault.operatingBuffer();
        vault.sweepDust();
        uint256 bufferAfter = vault.operatingBuffer();

        assertGt(bufferAfter, bufferBefore);
    }

    function test_oracle_access_fee() public {
        // Non-oracle caller must pay fee
        adi.mint(alice, 1000 ether);

        vm.startPrank(alice);
        adi.approve(address(horseOracle), type(uint256).max);
        (uint256 valuation, uint8 riskScore) = horseOracle.queryIBV(horseTokenId);
        vm.stopPrank();

        assertEq(valuation, 100 ether);
        assertEq(riskScore, 0);

        // Fee should have been routed to treasury
        assertGe(adi.balanceOf(treasury), 100 ether);
    }

    function test_yield_waterfall_correct_order() public {
        // Buy shares first
        vm.startPrank(alice);
        adi.approve(address(vault), type(uint256).max);
        vault.buyShares(100);
        vm.stopPrank();

        // Deplete operating buffer by setting target high
        // Current buffer may be partially filled from share sale
        uint256 bufferBefore = vault.operatingBuffer();

        uint256 treasuryBefore = adi.balanceOf(treasury);

        vm.startPrank(depositor);
        adi.approve(address(vault), type(uint256).max);
        vault.distributeYield(100000 ether);
        vm.stopPrank();

        // Verify: treasury got 10%, buffer got some replenishment, rest is claimable
        uint256 protocolFee = adi.balanceOf(treasury) - treasuryBefore;
        assertEq(protocolFee, 10000 ether); // 10% of 100000

        // claimable + buffer increase = 90000 (after protocol fee)
        uint256 afterFee = 100000 ether - protocolFee;
        uint256 bufferIncrease = vault.operatingBuffer() - bufferBefore;
        assertEq(vault.claimableRevenue() + bufferIncrease, afterFee);
    }
}
