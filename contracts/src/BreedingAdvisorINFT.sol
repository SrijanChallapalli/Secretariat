// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title BreedingAdvisorINFT - ERC-7857-style agent iNFT with 0G model bundle pointer
contract BreedingAdvisorINFT is ERC721, Ownable {
    struct AgentProfile {
        string name;
        string version;
        string specialization;
        string modelBundleRootHash; // 0G storage rootHash/URI
    }
    mapping(uint256 => AgentProfile) public profiles;
    uint256 private _nextTokenId;

    event Minted(uint256 indexed tokenId, address to, string modelBundleRootHash);
    event ModelBundleUpdated(uint256 indexed tokenId, string modelBundleRootHash);

    constructor() ERC721("Breeding Advisor iNFT", "BAGENT") Ownable(msg.sender) {}

    function mint(address to, AgentProfile calldata profile) external onlyOwner returns (uint256 tokenId) {
        tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        profiles[tokenId] = profile;
        emit Minted(tokenId, to, profile.modelBundleRootHash);
        return tokenId;
    }

    function updateModelBundle(uint256 tokenId, string calldata rootHash) external {
        require(ownerOf(tokenId) == msg.sender, "Not owner");
        profiles[tokenId].modelBundleRootHash = rootHash;
        emit ModelBundleUpdated(tokenId, rootHash);
    }

    function getModelBundleRootHash(uint256 tokenId) external view returns (string memory) {
        return profiles[tokenId].modelBundleRootHash;
    }
}
