// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./HorseSyndicateVault.sol";
import "./HorseINFT.sol";

/// @title HorseSyndicateVaultFactory - Deploy vault per horse
contract HorseSyndicateVaultFactory {
    address public adi;
    address public horseNFT;
    mapping(uint256 => address) public vaultForHorse;

    event VaultCreated(uint256 indexed horseTokenId, address vault);

    constructor(address _adi, address _horseNFT) {
        require(_adi != address(0), "Zero ADI address");
        require(_horseNFT != address(0), "Zero HorseNFT address");
        adi = _adi;
        horseNFT = _horseNFT;
    }

    function createVault(uint256 horseTokenId, uint256 totalShares, uint256 sharePriceADI) external returns (address) {
        require(HorseINFT(horseNFT).ownerOf(horseTokenId) == msg.sender, "Not owner");
        require(vaultForHorse[horseTokenId] == address(0), "Vault exists");
        require(totalShares > 0, "Zero shares");
        require(sharePriceADI > 0, "Zero price");
        HorseSyndicateVault v = new HorseSyndicateVault(adi, horseNFT, horseTokenId, totalShares, sharePriceADI);
        v.transferOwnership(msg.sender);
        vaultForHorse[horseTokenId] = address(v);
        emit VaultCreated(horseTokenId, address(v));
        return address(v);
    }
}
