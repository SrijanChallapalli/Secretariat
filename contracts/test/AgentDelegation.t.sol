// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import "../src/HorseINFT.sol";
import "../src/BreedingMarketplace.sol";
import "../src/AgentExecutor.sol";
import "../src/BreedingAdvisorINFT.sol";
import "../src/KYCRegistry.sol";
import "../src/MockINFTOracle.sol";
import "../src/MockADI.sol";

/// @title Delegated breeding via AgentExecutor.
/// @dev Guards the bug where AgentExecutor could never execute a plan: the
///      marketplace authorized on msg.sender only, so a third-party executor
///      reverted with "Not mare owner" and would have minted the foal to
///      itself. Authorization now comes from ERC-721 operator approval and the
///      economic principal is passed explicitly.
contract AgentDelegationTest is Test, ERC721Holder {
    MockADI adi;
    MockINFTOracle inftOracle;
    HorseINFT horseNFT;
    KYCRegistry kyc;
    BreedingMarketplace marketplace;
    BreedingAdvisorINFT agentINFT;
    AgentExecutor executor;

    uint256 userPk = 0xA11CE;
    address user;
    address stallionOwner = address(0xB0B);

    uint256 stallionId;
    uint256 mareId;

    uint256 constant STUD_FEE = 100 ether;

    function setUp() public {
        user = vm.addr(userPk);

        adi = new MockADI();
        inftOracle = new MockINFTOracle();
        horseNFT = new HorseINFT(address(inftOracle));
        kyc = new KYCRegistry();
        marketplace = new BreedingMarketplace(address(adi), address(horseNFT), address(kyc));
        horseNFT.setBreedingMarketplace(address(marketplace));

        agentINFT = new BreedingAdvisorINFT();
        executor = new AgentExecutor(
            address(agentINFT), address(marketplace), address(horseNFT), address(adi)
        );

        kyc.verify(user);
        kyc.verify(stallionOwner);

        stallionId = _mintHorse(stallionOwner, "Stallion", 9000, 0); // male
        mareId = _mintHorse(user, "Mare", 8000, 1);              // female

        vm.prank(stallionOwner);
        marketplace.list(stallionId, STUD_FEE, 10, false);

        adi.mint(user, 1000 ether);
        vm.prank(user);
        adi.approve(address(marketplace), type(uint256).max);
    }

    function _mintHorse(address to, string memory name, uint16 pedigree, uint8 sex)
        internal
        returns (uint256)
    {
        HorseINFT.HorseData memory d = HorseINFT.HorseData({
            name: name,
            birthTimestamp: uint64(block.timestamp),
            sireId: 0,
            damId: 0,
            traitVector: [uint8(80), 80, 80, 80, 80, 80, 80, 80],
            pedigreeScore: pedigree,
            valuationADI: 100 ether,
            dnaHash: bytes32(0),
            breedingAvailable: true,
            injured: false,
            retired: false,
            xFactorCarrier: false,
            encryptedURI: "",
            metadataHash: bytes32(0),
            sex: sex
        });
        return horseNFT.mint(to, "", bytes32(0), d);
    }

    function _plan() internal view returns (AgentExecutor.BreedingPlan memory) {
        return AgentExecutor.BreedingPlan({
            user: user,
            budgetADI: 500 ether,
            allowlistedStallionsRoot: bytes32(0),
            maxStudFeeADI: 200 ether,
            mareTokenId: mareId,
            chosenStallionTokenId: stallionId,
            deadline: block.timestamp + 1 hours,
            expectedOffspringTraitFloor: bytes32(0)
        });
    }

    function _sign(AgentExecutor.BreedingPlan memory p) internal view returns (bytes memory) {
        bytes32 digest = executor.hashPlan(p);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(userPk, digest);
        return abi.encodePacked(r, s, v);
    }

    // ---------------------------------------------------------------------
    // The core fix
    // ---------------------------------------------------------------------

    function test_agent_executes_plan_and_user_receives_offspring() public {
        AgentExecutor.BreedingPlan memory p = _plan();
        bytes memory sig = _sign(p);

        // The user delegates execution authority via standard ERC-721 approval.
        vm.prank(user);
        horseNFT.setApprovalForAll(address(executor), true);

        uint256 userBalBefore = adi.balanceOf(user);
        uint256 sellerBalBefore = adi.balanceOf(stallionOwner);

        vm.prank(user);
        uint256 offspringId = executor.execute(p, "Foal", bytes32(uint256(1)), bytes32(uint256(2)), sig);

        // Offspring belongs to the user, not the executor.
        assertEq(horseNFT.ownerOf(offspringId), user, "offspring must go to the user");
        assertTrue(horseNFT.ownerOf(offspringId) != address(executor));

        // The user paid the stud fee, not the executor.
        assertEq(userBalBefore - adi.balanceOf(user), STUD_FEE, "user pays the stud fee");
        assertEq(adi.balanceOf(stallionOwner) - sellerBalBefore, STUD_FEE);
        assertEq(adi.balanceOf(address(executor)), 0, "executor never holds funds");

        // The breeding right was recorded against the user.
        assertTrue(marketplace.hasBreedingRight(stallionId, user));
        assertFalse(marketplace.hasBreedingRight(stallionId, address(executor)));

        // Parentage is recorded correctly.
        HorseINFT.HorseData memory foal = horseNFT.getHorseData(offspringId);
        assertEq(foal.sireId, stallionId);
        assertEq(foal.damId, mareId);
    }

    function test_execute_reverts_without_operator_approval() public {
        AgentExecutor.BreedingPlan memory p = _plan();
        bytes memory sig = _sign(p);

        // No setApprovalForAll — the executor has no authority.
        vm.prank(user);
        vm.expectRevert("Not authorized for account");
        executor.execute(p, "Foal", bytes32(uint256(1)), bytes32(uint256(2)), sig);
    }

    // ---------------------------------------------------------------------
    // Delegation must not become an attack surface
    // ---------------------------------------------------------------------

    function test_stranger_cannot_breed_for_someone_else() public {
        vm.prank(user);
        marketplace.purchaseBreedingRight(stallionId, bytes32(uint256(7)));

        address attacker = address(0xBAD);
        vm.prank(attacker);
        vm.expectRevert("Not authorized for account");
        marketplace.breedFor(stallionId, mareId, "Stolen", bytes32(uint256(3)), user);
    }

    function test_stranger_cannot_spend_someone_elses_adi() public {
        address attacker = address(0xBAD);
        vm.prank(attacker);
        vm.expectRevert("Not authorized for account");
        marketplace.purchaseBreedingRightFor(stallionId, bytes32(uint256(9)), user);
    }

    function test_revoking_approval_removes_executor_authority() public {
        vm.startPrank(user);
        horseNFT.setApprovalForAll(address(executor), true);
        horseNFT.setApprovalForAll(address(executor), false);
        vm.stopPrank();

        AgentExecutor.BreedingPlan memory p = _plan();
        bytes memory sig = _sign(p);

        vm.prank(user);
        vm.expectRevert("Not authorized for account");
        executor.execute(p, "Foal", bytes32(uint256(1)), bytes32(uint256(2)), sig);
    }

    // ---------------------------------------------------------------------
    // The signed bounds are actually enforced on-chain now
    // ---------------------------------------------------------------------

    function test_execute_reverts_when_stud_fee_exceeds_signed_max() public {
        AgentExecutor.BreedingPlan memory p = _plan();
        p.maxStudFeeADI = 1 ether; // stud fee is 100 ether
        bytes memory sig = _sign(p);

        vm.prank(user);
        horseNFT.setApprovalForAll(address(executor), true);

        vm.prank(user);
        vm.expectRevert("Over budget");
        executor.execute(p, "Foal", bytes32(uint256(1)), bytes32(uint256(2)), sig);
    }

    function test_execute_reverts_after_deadline() public {
        AgentExecutor.BreedingPlan memory p = _plan();
        bytes memory sig = _sign(p);

        vm.prank(user);
        horseNFT.setApprovalForAll(address(executor), true);

        vm.warp(p.deadline + 1);
        vm.prank(user);
        vm.expectRevert("Expired");
        executor.execute(p, "Foal", bytes32(uint256(1)), bytes32(uint256(2)), sig);
    }

    function test_execute_reverts_on_signature_from_wrong_signer() public {
        AgentExecutor.BreedingPlan memory p = _plan();
        bytes32 digest = executor.hashPlan(p);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(0xBADBAD, digest);
        bytes memory badSig = abi.encodePacked(r, s, v);

        vm.prank(user);
        horseNFT.setApprovalForAll(address(executor), true);

        vm.prank(user);
        vm.expectRevert("Invalid signature");
        executor.execute(p, "Foal", bytes32(uint256(1)), bytes32(uint256(2)), badSig);
    }

    // ---------------------------------------------------------------------
    // Backwards compatibility: the direct path is unchanged
    // ---------------------------------------------------------------------

    function test_direct_breeding_still_works_without_delegation() public {
        vm.startPrank(user);
        marketplace.purchaseBreedingRight(stallionId, bytes32(uint256(5)));
        uint256 offspringId = marketplace.breed(stallionId, mareId, "Direct", bytes32(uint256(6)));
        vm.stopPrank();

        assertEq(horseNFT.ownerOf(offspringId), user);
    }
}
