// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/MultisigExecution.sol";

contract MultisigTarget {
    uint256 public value;
    function setValue(uint256 _value) external {
        value = _value;
    }
}

contract MultisigExecutionTest is Test {
    MultisigExecution multisig;
    MultisigTarget target;

    address signer1 = address(0x1);
    address signer2 = address(0x2);
    address signer3 = address(0x3);
    address nonSigner = address(0xBAD);

    function setUp() public {
        address[] memory signers = new address[](3);
        signers[0] = signer1;
        signers[1] = signer2;
        signers[2] = signer3;

        multisig = new MultisigExecution(signers, 2); // 2-of-3
        target = new MultisigTarget();
    }

    function test_initial_state() public view {
        assertEq(multisig.signerCount(), 3);
        assertEq(multisig.threshold(), 2);
        assertTrue(multisig.isSigner(signer1));
        assertTrue(multisig.isSigner(signer2));
        assertTrue(multisig.isSigner(signer3));
        assertFalse(multisig.isSigner(nonSigner));
    }

    function test_submit_proposal() public {
        bytes memory data = abi.encodeCall(MultisigTarget.setValue, (42));

        vm.prank(signer1);
        uint256 id = multisig.submitProposal(address(target), 0, data);

        assertEq(id, 0);
        assertEq(multisig.proposalCount(), 1);
    }

    function test_non_signer_cannot_submit() public {
        vm.prank(nonSigner);
        vm.expectRevert("Not a signer");
        multisig.submitProposal(address(target), 0, "");
    }

    function test_confirm_and_execute() public {
        bytes memory data = abi.encodeCall(MultisigTarget.setValue, (42));

        vm.prank(signer1);
        uint256 id = multisig.submitProposal(address(target), 0, data);

        vm.prank(signer1);
        multisig.confirmProposal(id);

        vm.prank(signer2);
        multisig.confirmProposal(id);

        // 2 confirmations = threshold reached
        vm.prank(signer1);
        multisig.executeProposal(id);

        assertEq(target.value(), 42);
    }

    function test_execute_without_threshold_reverts() public {
        bytes memory data = abi.encodeCall(MultisigTarget.setValue, (42));

        vm.prank(signer1);
        uint256 id = multisig.submitProposal(address(target), 0, data);

        vm.prank(signer1);
        multisig.confirmProposal(id);

        // Only 1 confirmation, need 2
        vm.prank(signer1);
        vm.expectRevert("Insufficient confirmations");
        multisig.executeProposal(id);
    }

    function test_revoke_confirmation() public {
        bytes memory data = abi.encodeCall(MultisigTarget.setValue, (42));

        vm.prank(signer1);
        uint256 id = multisig.submitProposal(address(target), 0, data);

        vm.prank(signer1);
        multisig.confirmProposal(id);

        vm.prank(signer2);
        multisig.confirmProposal(id);

        // Revoke signer2's confirmation
        vm.prank(signer2);
        multisig.revokeConfirmation(id);

        // Now only 1 confirmation
        vm.prank(signer1);
        vm.expectRevert("Insufficient confirmations");
        multisig.executeProposal(id);
    }

    function test_double_confirm_reverts() public {
        bytes memory data = abi.encodeCall(MultisigTarget.setValue, (42));

        vm.prank(signer1);
        uint256 id = multisig.submitProposal(address(target), 0, data);

        vm.prank(signer1);
        multisig.confirmProposal(id);

        vm.prank(signer1);
        vm.expectRevert("Already confirmed");
        multisig.confirmProposal(id);
    }

    function test_double_execute_reverts() public {
        bytes memory data = abi.encodeCall(MultisigTarget.setValue, (42));

        vm.prank(signer1);
        uint256 id = multisig.submitProposal(address(target), 0, data);

        vm.prank(signer1);
        multisig.confirmProposal(id);
        vm.prank(signer2);
        multisig.confirmProposal(id);

        vm.prank(signer1);
        multisig.executeProposal(id);

        vm.prank(signer1);
        vm.expectRevert("Already executed");
        multisig.executeProposal(id);
    }

    function test_add_signer_via_self_execution() public {
        address newSigner = address(0x4);

        bytes memory addCall = abi.encodeCall(MultisigExecution.addSigner, (newSigner));
        bytes memory data = abi.encodeCall(MultisigExecution.addSigner, (newSigner));

        vm.prank(signer1);
        uint256 id = multisig.submitProposal(address(multisig), 0, data);

        vm.prank(signer1);
        multisig.confirmProposal(id);
        vm.prank(signer2);
        multisig.confirmProposal(id);

        vm.prank(signer1);
        multisig.executeProposal(id);

        assertTrue(multisig.isSigner(newSigner));
        assertEq(multisig.signerCount(), 4);
    }

    function test_direct_add_signer_reverts() public {
        vm.expectRevert("Only via execution");
        multisig.addSigner(address(0x4));
    }
}
