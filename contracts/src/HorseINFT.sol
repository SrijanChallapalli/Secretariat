// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./MockINFTOracle.sol";

/// @title HorseINFT - ERC-7857-style horse iNFT with encryptedURI + authorizeUsage
contract HorseINFT is ERC721, Ownable {
    MockINFTOracle public oracle;
    address public breedingMarketplace;

    struct HorseData {
        string name;
        uint64 birthTimestamp;
        uint256 sireId;
        uint256 damId;
        uint8[8] traitVector; // speed, stamina, temperament, conformation, health, agility, raceIQ, consistency
        uint16 pedigreeScore; // 0-10000
        uint256 valuationADI;
        bytes32 dnaHash;
        bool breedingAvailable;
        bool injured;
        bool retired;
        string encryptedURI; // 0G storage pointer / rootHash
        bytes32 metadataHash;
    }

    mapping(uint256 => HorseData) public horses;
    mapping(uint256 => address[]) public authorizedUsers;
    uint256 private _nextTokenId;

    event Minted(uint256 indexed tokenId, address to, string encryptedURI, bytes32 metadataHash);
    event ValuationUpdated(uint256 indexed tokenId, uint256 oldVal, uint256 newVal);
    event BreedingStatusUpdated(uint256 indexed tokenId, bool breedingAvailable);
    event Authorization(address indexed from, address indexed to, uint256 indexed tokenId);
    event AuthorizationRevoked(address indexed from, address indexed to, uint256 indexed tokenId);

    constructor(address _oracle) ERC721("Secretariat Horse", "SHORSE") Ownable(msg.sender) {
        oracle = MockINFTOracle(_oracle);
    }

    function setBreedingMarketplace(address _marketplace) external onlyOwner {
        breedingMarketplace = _marketplace;
    }

    function mint(address to, string calldata encryptedURI_, bytes32 metadataHash_, HorseData calldata data_)
        external
        returns (uint256 tokenId)
    {
        require(msg.sender == owner() || msg.sender == breedingMarketplace, "Not minter");
        tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        horses[tokenId] = HorseData({
            name: data_.name,
            birthTimestamp: data_.birthTimestamp,
            sireId: data_.sireId,
            damId: data_.damId,
            traitVector: data_.traitVector,
            pedigreeScore: data_.pedigreeScore,
            valuationADI: data_.valuationADI,
            dnaHash: data_.dnaHash,
            breedingAvailable: data_.breedingAvailable,
            injured: data_.injured,
            retired: data_.retired,
            encryptedURI: encryptedURI_,
            metadataHash: metadataHash_
        });
        emit Minted(tokenId, to, encryptedURI_, metadataHash_);
        return tokenId;
    }

    function authorizeUsage(uint256 tokenId, address executor, bytes calldata) external {
        require(ownerOf(tokenId) == msg.sender, "Not owner");
        address[] storage users = authorizedUsers[tokenId];
        for (uint256 i = 0; i < users.length; i++) {
            if (users[i] == executor) return;
        }
        users.push(executor);
        emit Authorization(msg.sender, executor, tokenId);
    }

    function revokeAuthorization(uint256 tokenId, address user) external {
        require(ownerOf(tokenId) == msg.sender, "Not owner");
        address[] storage users = authorizedUsers[tokenId];
        for (uint256 i = 0; i < users.length; i++) {
            if (users[i] == user) {
                users[i] = users[users.length - 1];
                users.pop();
                emit AuthorizationRevoked(msg.sender, user, tokenId);
                return;
            }
        }
    }

    function isAuthorized(uint256 tokenId, address user) public view returns (bool) {
        address[] storage users = authorizedUsers[tokenId];
        for (uint256 i = 0; i < users.length; i++) {
            if (users[i] == user) return true;
        }
        return false;
    }

    /// @dev Transfer with proof - calls oracle for demo (mock always passes)
    function transferWithProof(
        address from,
        address to,
        uint256 tokenId,
        bytes calldata sealedKey,
        bytes calldata proof
    ) external {
        require(_isAuthorized(ownerOf(tokenId), msg.sender, tokenId), "Not approved");
        require(from == ownerOf(tokenId), "Not owner");
        require(oracle.verifyProof(horses[tokenId].metadataHash, bytes32(0), sealedKey, proof), "Invalid proof");
        _transfer(from, to, tokenId);
    }

    function updateValuation(uint256 tokenId, uint256 newVal) external onlyOwner {
        uint256 oldVal = horses[tokenId].valuationADI;
        horses[tokenId].valuationADI = newVal;
        emit ValuationUpdated(tokenId, oldVal, newVal);
    }

    function setBreedingAvailable(uint256 tokenId, bool available) external onlyOwner {
        horses[tokenId].breedingAvailable = available;
        emit BreedingStatusUpdated(tokenId, available);
    }

    function setInjured(uint256 tokenId, bool injured) external onlyOwner {
        horses[tokenId].injured = injured;
    }

    function setRetired(uint256 tokenId, bool retired) external onlyOwner {
        horses[tokenId].retired = retired;
    }

    function getEncryptedURI(uint256 tokenId) external view returns (string memory) {
        return horses[tokenId].encryptedURI;
    }

    function getHorseData(uint256 tokenId) external view returns (HorseData memory) {
        return horses[tokenId];
    }
}
