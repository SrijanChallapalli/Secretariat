// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import "../src/KYCRegistry.sol";
import "../src/HorseINFT.sol";
import "../src/HorseSyndicateVault.sol";
import "../src/HorseSyndicateVaultFactory.sol";
import "../src/MockINFTOracle.sol";
import "../src/MockADI.sol";

contract SecComplianceTest is Test, ERC721Holder {
    MockADI adi;
    MockINFTOracle oracle;
    HorseINFT horseNFT;
    KYCRegistry kyc;
    HorseSyndicateVaultFactory factory;
    HorseSyndicateVault vault;

    address owner = address(this);
    address alice = address(0xA11CE);
    address bob = address(0xB0B);
    address charlie = address(0xC);
    address treasury = address(0xFEE);

    uint256 horseTokenId;

    function setUp() public {
        vm.warp(365 days + 1);

        adi = new MockADI();
        oracle = new MockINFTOracle();
        horseNFT = new HorseINFT(address(oracle));
        kyc = new KYCRegistry();

        factory = new HorseSyndicateVaultFactory(
            address(adi),
            address(horseNFT),
            address(kyc),
            treasury,
            300, // 3% origination
            1000 // 10% yield skim
        );

        // Mint a horse
        HorseINFT.HorseData memory data = HorseINFT.HorseData({
            name: "TestHorse",
            birthTimestamp: uint64(block.timestamp - 365 days),
            sireId: 0,
            damId: 0,
            traitVector: [uint8(80), 80, 70, 75, 90, 70, 60, 65],
            pedigreeScore: 5000,
            valuationADI: 100 ether,
            dnaHash: bytes32(0),
            breedingAvailable: false,
            injured: false,
            retired: false,
            xFactorCarrier: false,
            encryptedURI: "",
            metadataHash: bytes32(0)
        });

        horseTokenId = horseNFT.mint(owner, "", bytes32(0), data);

        // Create vault
        address vaultAddr = factory.createVault(horseTokenId, 1000, 1 ether, 30000, 4600, 8208);
        vault = HorseSyndicateVault(vaultAddr);

        // Setup KYC + accreditation for alice and bob
        kyc.verify(alice);
        kyc.verify(bob);
        kyc.verifyAccredited(alice);
        kyc.verifyAccredited(bob);

        // Fund alice and bob
        adi.mint(alice, 10000 ether);
        adi.mint(bob, 10000 ether);
    }

    // -----------------------------------------------------------------------
    // 90-Day Lockup Tests
    // -----------------------------------------------------------------------

    function test_lockup_prevents_transfer_before_90_days() public {
        vm.startPrank(alice);
        adi.approve(address(vault), type(uint256).max);
        vault.buyShares(10);
        vm.stopPrank();

        // Try to transfer before 90 days
        vm.prank(alice);
        vm.expectRevert("90-day lockup active");
        vault.transfer(bob, 5);
    }

    function test_lockup_allows_transfer_after_90_days() public {
        vm.startPrank(alice);
        adi.approve(address(vault), type(uint256).max);
        vault.buyShares(10);
        vm.stopPrank();

        // Warp past lockup
        vm.warp(block.timestamp + 91 days);

        vm.prank(alice);
        vault.transfer(bob, 5);

        assertEq(vault.balanceOf(bob), 5);
        assertEq(vault.balanceOf(alice), 5);
    }

    function test_lockup_allows_redemption_during_lockup() public {
        vm.startPrank(alice);
        adi.approve(address(vault), type(uint256).max);
        vault.buyShares(10);
        vault.redeemShares(5);
        vm.stopPrank();

        assertEq(vault.balanceOf(alice), 5);
    }

    // -----------------------------------------------------------------------
    // 99-Investor Cap Tests
    // -----------------------------------------------------------------------

    function test_investor_cap_at_99() public {
        // KYC + accredit 99 investors
        for (uint256 i = 1; i <= 99; i++) {
            address investor = address(uint160(0x1000 + i));
            kyc.verify(investor);
            kyc.verifyAccredited(investor);
            adi.mint(investor, 100 ether);

            vm.startPrank(investor);
            adi.approve(address(vault), type(uint256).max);
            vault.buyShares(1);
            vm.stopPrank();
        }

        assertEq(vault.investorCount(), 99);

        // 100th investor should fail
        address investor100 = address(uint160(0x2000));
        kyc.verify(investor100);
        kyc.verifyAccredited(investor100);
        adi.mint(investor100, 100 ether);

        vm.startPrank(investor100);
        adi.approve(address(vault), type(uint256).max);
        vm.expectRevert("99-investor cap reached");
        vault.buyShares(1);
        vm.stopPrank();
    }

    function test_investor_exit_frees_slot() public {
        vm.startPrank(alice);
        adi.approve(address(vault), type(uint256).max);
        vault.buyShares(10);
        vm.stopPrank();

        assertEq(vault.investorCount(), 1);

        vm.prank(alice);
        vault.redeemShares(10);

        assertEq(vault.investorCount(), 0);
        assertFalse(vault.isInvestor(alice));
    }

    // -----------------------------------------------------------------------
    // Accreditation Gate (Dark Pool) Tests
    // -----------------------------------------------------------------------

    function test_non_accredited_cannot_buy_shares() public {
        address nonAccredited = address(0xDEAD);
        kyc.verify(nonAccredited);
        // NOT accredited
        adi.mint(nonAccredited, 100 ether);

        vm.startPrank(nonAccredited);
        adi.approve(address(vault), type(uint256).max);
        vm.expectRevert("Accreditation required");
        vault.buyShares(1);
        vm.stopPrank();
    }

    function test_transfer_requires_recipient_accreditation() public {
        vm.startPrank(alice);
        adi.approve(address(vault), type(uint256).max);
        vault.buyShares(10);
        vm.stopPrank();

        vm.warp(block.timestamp + 91 days);

        // Revoke bob's accreditation
        kyc.revokeAccreditation(bob);

        vm.prank(alice);
        vm.expectRevert("Accreditation required for recipient");
        vault.transfer(bob, 5);
    }

    function test_expired_accreditation_blocks_transfer() public {
        vm.startPrank(alice);
        adi.approve(address(vault), type(uint256).max);
        vault.buyShares(10);
        vm.stopPrank();

        // Warp past lockup AND accreditation expiry (365 days > 90 days)
        vm.warp(block.timestamp + 366 days);

        vm.prank(alice);
        vm.expectRevert("Accreditation required for recipient");
        vault.transfer(bob, 5);
    }

    // -----------------------------------------------------------------------
    // Origination Fee Tests
    // -----------------------------------------------------------------------

    function test_origination_fee_routed_to_treasury() public {
        uint256 treasuryBefore = adi.balanceOf(treasury);

        vm.startPrank(alice);
        adi.approve(address(vault), type(uint256).max);
        vault.buyShares(10);
        vm.stopPrank();

        uint256 cost = 10 * 1 ether;
        uint256 expectedFee = (cost * 300) / 10000; // 3%

        assertEq(adi.balanceOf(treasury) - treasuryBefore, expectedFee);
    }
}
