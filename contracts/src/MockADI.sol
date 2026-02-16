// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title MockADI - Demo ERC20 for Secretariat on both 0G and ADI
contract MockADI is ERC20, Ownable {
    constructor() ERC20("ADI Token (Demo)", "ADI") Ownable(msg.sender) {}

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}
