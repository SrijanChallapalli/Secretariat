// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./HorseINFT.sol";

/// @title HorseSyndicateVault - Fractional ownership; revenue from breeding/races is claimable
contract HorseSyndicateVault is ERC20, Ownable, ReentrancyGuard {
    IERC20 public immutable adi;
    HorseINFT public horseNFT;

    uint256 public immutable horseTokenId;
    uint256 public totalShares;
    uint256 public sharePriceADI;
    uint256 public claimableRevenue; // ADI in this contract to be claimed pro-rata

    event VaultCreated(uint256 indexed horseTokenId, uint256 totalShares, uint256 sharePriceADI);
    event SharesPurchased(address buyer, uint256 shares, uint256 adiSpent);
    event RevenueDeposited(uint256 amount);
    event RevenueClaimed(address holder, uint256 amount);

    constructor(address _adi, address _horseNFT, uint256 _horseTokenId, uint256 _totalShares, uint256 _sharePriceADI)
        ERC20(string(abi.encodePacked("HorseShare_", _horseTokenId)), string(abi.encodePacked("SHARE", _horseTokenId)))
        Ownable(msg.sender)
    {
        adi = IERC20(_adi);
        horseNFT = HorseINFT(_horseNFT);
        horseTokenId = _horseTokenId;
        totalShares = _totalShares;
        sharePriceADI = _sharePriceADI;
        emit VaultCreated(_horseTokenId, _totalShares, _sharePriceADI);
    }

    function buyShares(uint256 numShares) external nonReentrant {
        require(totalSupply() + numShares <= totalShares, "Exceeds total shares");
        uint256 cost = numShares * sharePriceADI;
        adi.transferFrom(msg.sender, address(this), cost);
        _mint(msg.sender, numShares);
        emit SharesPurchased(msg.sender, numShares, cost);
    }

    function depositRevenue(uint256 amount) external {
        adi.transferFrom(msg.sender, address(this), amount);
        claimableRevenue += amount;
        emit RevenueDeposited(amount);
    }

    function claim() external nonReentrant {
        uint256 shares = balanceOf(msg.sender);
        require(shares > 0 && totalSupply() > 0, "No shares");
        uint256 amount = (claimableRevenue * shares) / totalSupply();
        require(amount > 0, "Nothing to claim");
        claimableRevenue -= amount;
        adi.transfer(msg.sender, amount);
        emit RevenueClaimed(msg.sender, amount);
    }

    function claimableFor(address account) external view returns (uint256) {
        uint256 shares = balanceOf(account);
        if (totalSupply() == 0 || shares == 0) return 0;
        return (claimableRevenue * shares) / totalSupply();
    }

    function tvl() external view returns (uint256) {
        return adi.balanceOf(address(this));
    }
}
