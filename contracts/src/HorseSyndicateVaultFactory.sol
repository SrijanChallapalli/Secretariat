// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./HorseINFT.sol";
import "./VaultDeployer.sol";

/// @title HorseSyndicateVaultFactory - Deploy SEC-compliant SPV vaults per horse.
///        Delegates actual vault deployment to VaultDeployer to stay under EIP-170 size limit.
contract HorseSyndicateVaultFactory {
    address public adi;
    address public horseNFT;
    address public kycRegistry;
    address public protocolTreasury;
    uint16  public defaultOriginationFeeBps;    // 300-500 (3%-5%)
    uint16  public defaultProtocolYieldSkimBps; // 1000 (10%)

    VaultDeployer public vaultDeployer;
    mapping(uint256 => address) public vaultForHorse;

    event VaultCreated(uint256 indexed horseTokenId, address vault);
    event DefaultFeesUpdated(uint16 originationBps, uint16 yieldSkimBps);
    event TreasuryUpdated(address newTreasury);

    address public admin;

    modifier onlyAdmin() {
        require(msg.sender == admin, "Not admin");
        _;
    }

    constructor(
        address _adi,
        address _horseNFT,
        address _kycRegistry,
        address _protocolTreasury,
        uint16  _defaultOriginationFeeBps,
        uint16  _defaultProtocolYieldSkimBps
    ) {
        require(_adi != address(0), "Zero ADI address");
        require(_horseNFT != address(0), "Zero HorseNFT address");
        adi = _adi;
        horseNFT = _horseNFT;
        kycRegistry = _kycRegistry;
        protocolTreasury = _protocolTreasury;
        defaultOriginationFeeBps = _defaultOriginationFeeBps;
        defaultProtocolYieldSkimBps = _defaultProtocolYieldSkimBps;
        admin = msg.sender;
    }

    function setVaultDeployer(address _deployer) external onlyAdmin {
        vaultDeployer = VaultDeployer(_deployer);
    }

    function createVault(
        uint256 horseTokenId,
        uint256 totalShares,
        uint256 sharePriceADI,
        uint256 bufferTarget,
        uint256 monthlyBurnFloor,
        uint256 monthlyBurnCeiling
    ) external returns (address) {
        require(HorseINFT(horseNFT).ownerOf(horseTokenId) == msg.sender, "Not owner");
        require(vaultForHorse[horseTokenId] == address(0), "Vault exists");
        require(totalShares > 0, "Zero shares");
        require(sharePriceADI > 0, "Zero price");
        require(address(vaultDeployer) != address(0), "Deployer not set");

        address v = vaultDeployer.deploy(
            adi,
            horseNFT,
            horseTokenId,
            totalShares,
            sharePriceADI,
            kycRegistry,
            bufferTarget,
            protocolTreasury,
            defaultOriginationFeeBps,
            defaultProtocolYieldSkimBps,
            monthlyBurnFloor,
            monthlyBurnCeiling
        );
        vaultForHorse[horseTokenId] = v;
        emit VaultCreated(horseTokenId, v);
        return v;
    }

    function setDefaultFees(uint16 _originationBps, uint16 _yieldSkimBps) external onlyAdmin {
        require(_originationBps <= 500, "Max 5%");
        require(_yieldSkimBps <= 2000, "Max 20%");
        defaultOriginationFeeBps = _originationBps;
        defaultProtocolYieldSkimBps = _yieldSkimBps;
        emit DefaultFeesUpdated(_originationBps, _yieldSkimBps);
    }

    function setProtocolTreasury(address _treasury) external onlyAdmin {
        require(_treasury != address(0), "Zero address");
        protocolTreasury = _treasury;
        emit TreasuryUpdated(_treasury);
    }
}
