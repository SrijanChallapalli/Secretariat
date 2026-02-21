// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./HorseSyndicateVault.sol";

/// @title VaultDeployer - Deploys HorseSyndicateVault instances on behalf of the factory.
///        Separated from the factory to keep both contracts under the EIP-170 bytecode limit.
contract VaultDeployer {
    address public factory;

    modifier onlyFactory() {
        require(msg.sender == factory, "Only factory");
        _;
    }

    constructor() {
        factory = msg.sender;
    }

    function setFactory(address _factory) external {
        require(factory == msg.sender, "Only current factory");
        factory = _factory;
    }

    function deploy(
        address adi,
        address horseNFT,
        uint256 horseTokenId,
        uint256 totalShares,
        uint256 sharePriceADI,
        address kycRegistry,
        uint256 bufferTarget,
        address protocolTreasury,
        uint16 originationFeeBps,
        uint16 protocolYieldSkimBps,
        uint256 monthlyBurnFloor,
        uint256 monthlyBurnCeiling
    ) external onlyFactory returns (address) {
        HorseSyndicateVault v = new HorseSyndicateVault(
            adi,
            horseNFT,
            horseTokenId,
            totalShares,
            sharePriceADI,
            kycRegistry,
            bufferTarget,
            protocolTreasury,
            originationFeeBps,
            protocolYieldSkimBps,
            monthlyBurnFloor,
            monthlyBurnCeiling
        );
        v.transferOwnership(tx.origin);
        return address(v);
    }
}
