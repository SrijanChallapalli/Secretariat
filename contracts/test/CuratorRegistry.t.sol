// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/CuratorRegistry.sol";
import "../src/MockADI.sol";

contract CuratorRegistryTest is Test {
    MockADI adi;
    CuratorRegistry registry;

    address owner = address(this);
    address curator1 = address(0xC1);
    address curator2 = address(0xC2);
    address payer = address(0xDE90);

    function setUp() public {
        adi = new MockADI();
        registry = new CuratorRegistry(address(adi), 1000 ether);

        adi.mint(curator1, 10000 ether);
        adi.mint(curator2, 10000 ether);
        adi.mint(payer, 100000 ether);
    }

    function test_stake_and_become_certified() public {
        vm.startPrank(curator1);
        adi.approve(address(registry), type(uint256).max);
        registry.stake(1000 ether);
        vm.stopPrank();

        assertTrue(registry.isCertifiedCurator(curator1));
    }

    function test_stake_below_minimum_reverts() public {
        vm.startPrank(curator1);
        adi.approve(address(registry), type(uint256).max);
        vm.expectRevert("Below minimum stake");
        registry.stake(500 ether);
        vm.stopPrank();
    }

    function test_unstake_deactivates_curator() public {
        vm.startPrank(curator1);
        adi.approve(address(registry), type(uint256).max);
        registry.stake(1000 ether);
        vm.stopPrank();

        assertTrue(registry.isCertifiedCurator(curator1));

        vm.prank(curator1);
        registry.unstake();

        assertFalse(registry.isCertifiedCurator(curator1));
        assertEq(adi.balanceOf(curator1), 10000 ether);
    }

    function test_record_asset_sourced() public {
        vm.startPrank(curator1);
        adi.approve(address(registry), type(uint256).max);
        registry.stake(1000 ether);
        vm.stopPrank();

        registry.recordAssetSourced(42, curator1);

        assertEq(registry.assetCurator(42), curator1);
        assertEq(registry.assetSourcingFeeBps(42), 500); // 5%
    }

    function test_record_asset_reverts_for_inactive_curator() public {
        vm.expectRevert("Curator not active");
        registry.recordAssetSourced(42, curator1);
    }

    function test_distribute_sourcing_fee() public {
        vm.startPrank(curator1);
        adi.approve(address(registry), type(uint256).max);
        registry.stake(1000 ether);
        vm.stopPrank();

        registry.recordAssetSourced(42, curator1);

        uint256 grossRevenue = 100000 ether;
        uint256 totalFee = (grossRevenue * 500) / 10000; // 5% = 5000 ether
        uint256 platformCut = (totalFee * 1000) / 10000; // 10% of fee = 500 ether
        uint256 curatorNet = totalFee - platformCut; // 4500 ether

        uint256 curatorBefore = adi.balanceOf(curator1);
        uint256 ownerBefore = adi.balanceOf(owner);

        vm.startPrank(payer);
        adi.approve(address(registry), type(uint256).max);
        registry.distributeSourcingFee(42, grossRevenue);
        vm.stopPrank();

        assertEq(adi.balanceOf(curator1) - curatorBefore, curatorNet);
        assertEq(adi.balanceOf(owner) - ownerBefore, platformCut);
    }

    function test_double_source_reverts() public {
        vm.startPrank(curator1);
        adi.approve(address(registry), type(uint256).max);
        registry.stake(1000 ether);
        vm.stopPrank();

        registry.recordAssetSourced(42, curator1);

        vm.expectRevert("Already sourced");
        registry.recordAssetSourced(42, curator1);
    }
}
