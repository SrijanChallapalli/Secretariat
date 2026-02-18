// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "./BreedingAdvisorINFT.sol";
import "./BreedingMarketplace.sol";
import "./HorseINFT.sol";

/// @title AgentExecutor - EIP-712 signed BreedingPlan execution with guardrails
contract AgentExecutor is EIP712 {
    using ECDSA for bytes32;

    bytes32 public constant BREEDING_PLAN_TYPEHASH = keccak256(
        "BreedingPlan(address user,uint256 budgetADI,bytes32 allowlistedStallionsRoot,uint256 maxStudFeeADI,uint256 mareTokenId,uint256 chosenStallionTokenId,uint256 deadline,bytes32 expectedOffspringTraitFloor)"
    );

    BreedingAdvisorINFT public agentINFT;
    BreedingMarketplace public marketplace;
    HorseINFT public horseNFT;
    IERC20 public adi;

    mapping(address => uint256) public nonces;

    event PlanExecuted(address user, uint256 mareTokenId, uint256 stallionId, uint256 offspringId);

    constructor(address _agentINFT, address _marketplace, address _horseNFT, address _adi)
        EIP712("SecretariatBreeding", "1")
    {
        agentINFT = BreedingAdvisorINFT(_agentINFT);
        marketplace = BreedingMarketplace(_marketplace);
        horseNFT = HorseINFT(_horseNFT);
        adi = IERC20(_adi);
    }

    struct BreedingPlan {
        address user;
        uint256 budgetADI;
        bytes32 allowlistedStallionsRoot; // merkle root or 0 for any
        uint256 maxStudFeeADI;
        uint256 mareTokenId;
        uint256 chosenStallionTokenId;
        uint256 deadline;
        bytes32 expectedOffspringTraitFloor; // hash of min traits for verification
    }

    function execute(
        BreedingPlan calldata plan,
        string calldata offspringName,
        bytes32 salt,
        bytes32 purchaseSeed,
        bytes calldata signature
    ) external returns (uint256 offspringId) {
        require(msg.sender == plan.user, "Caller must be plan.user");
        require(block.timestamp <= plan.deadline, "Expired");
        require(plan.user != address(0), "Zero user");
        bytes32 structHash = keccak256(
            abi.encode(
                BREEDING_PLAN_TYPEHASH,
                plan.user,
                plan.budgetADI,
                plan.allowlistedStallionsRoot,
                plan.maxStudFeeADI,
                plan.mareTokenId,
                plan.chosenStallionTokenId,
                plan.deadline,
                plan.expectedOffspringTraitFloor
            )
        );
        bytes32 digest = _hashTypedDataV4(structHash);
        address signer = digest.recover(signature);
        require(signer == plan.user, "Invalid signature");

        require(horseNFT.ownerOf(plan.mareTokenId) == plan.user, "Not mare owner");
        (uint256 studFee,,,,) = marketplace.listings(plan.chosenStallionTokenId);
        require(studFee <= plan.maxStudFeeADI && studFee <= plan.budgetADI, "Over budget");

        if (!marketplace.hasBreedingRight(plan.chosenStallionTokenId, plan.user)) {
            marketplace.purchaseBreedingRight(plan.chosenStallionTokenId, purchaseSeed);
        }
        offspringId = marketplace.breed(plan.chosenStallionTokenId, plan.mareTokenId, offspringName, salt);
        emit PlanExecuted(plan.user, plan.mareTokenId, plan.chosenStallionTokenId, offspringId);
        return offspringId;
    }

    function hashPlan(BreedingPlan calldata plan) public view returns (bytes32) {
        return _hashTypedDataV4(
            keccak256(
                abi.encode(
                    BREEDING_PLAN_TYPEHASH,
                    plan.user,
                    plan.budgetADI,
                    plan.allowlistedStallionsRoot,
                    plan.maxStudFeeADI,
                    plan.mareTokenId,
                    plan.chosenStallionTokenId,
                    plan.deadline,
                    plan.expectedOffspringTraitFloor
                )
            )
        );
    }
}
