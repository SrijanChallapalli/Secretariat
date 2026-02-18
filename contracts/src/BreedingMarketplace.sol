// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./HorseINFT.sol";

/// @title BreedingMarketplace - List stallions, buy breeding rights, breed
contract BreedingMarketplace is Ownable {
    IERC20 public adi;
    HorseINFT public horseNFT;

    struct Listing {
        uint256 studFeeADI;
        uint256 maxUses;
        uint256 usedCount;
        bool useAllowlist;
        bool active;
    }
    mapping(uint256 => Listing) public listings;

    /// allowlist: stallionId => allowed buyer => true
    mapping(uint256 => mapping(address => bool)) public allowlist;

    /// breeding right: (stallionId, buyer) => expiry timestamp; 0 = no right
    mapping(uint256 => mapping(address => uint256)) public breedingRightExpiry;

    /// seed committed at purchase for deterministic offspring (stallionId => buyer => seed)
    mapping(uint256 => mapping(address => bytes32)) public purchaseSeed;

    event Listed(uint256 indexed stallionId, uint256 studFeeADI, uint256 maxUses, bool useAllowlist);
    event Unlisted(uint256 indexed stallionId);
    event BreedingRightPurchased(uint256 indexed stallionId, address buyer, uint256 expiry, bytes32 seed);
    event Bred(uint256 indexed stallionId, uint256 indexed mareId, uint256 indexed offspringId);

    constructor(address _adi, address _horseNFT) Ownable(msg.sender) {
        adi = IERC20(_adi);
        horseNFT = HorseINFT(_horseNFT);
    }

    function list(uint256 stallionId, uint256 studFeeADI, uint256 maxUses, bool useAllowlist_) external {
        require(horseNFT.ownerOf(stallionId) == msg.sender, "Not owner");
        HorseINFT.HorseData memory h = horseNFT.getHorseData(stallionId);
        require(h.breedingAvailable && !h.injured && !h.retired, "Not available");
        listings[stallionId] = Listing({
            studFeeADI: studFeeADI, maxUses: maxUses, usedCount: 0, useAllowlist: useAllowlist_, active: true
        });
        emit Listed(stallionId, studFeeADI, maxUses, useAllowlist_);
    }

    function setAllowlist(uint256 stallionId, address[] calldata allowed, bool add) external {
        require(horseNFT.ownerOf(stallionId) == msg.sender, "Not owner");
        for (uint256 i = 0; i < allowed.length; i++) {
            allowlist[stallionId][allowed[i]] = add;
        }
    }

    function unlist(uint256 stallionId) external {
        require(horseNFT.ownerOf(stallionId) == msg.sender, "Not owner");
        listings[stallionId].active = false;
        emit Unlisted(stallionId);
    }

    function purchaseBreedingRight(uint256 stallionId, bytes32 seed) external {
        Listing storage list_ = listings[stallionId];
        require(list_.active, "Not listed");
        require(list_.usedCount < list_.maxUses, "Max uses");
        if (list_.useAllowlist) require(allowlist[stallionId][msg.sender], "Not allowlisted");
        require(breedingRightExpiry[stallionId][msg.sender] == 0, "Already have right");

        address seller = horseNFT.ownerOf(stallionId);
        adi.transferFrom(msg.sender, seller, list_.studFeeADI);

        uint256 expiry = block.timestamp + 365 days;
        breedingRightExpiry[stallionId][msg.sender] = expiry;
        purchaseSeed[stallionId][msg.sender] = seed;
        emit BreedingRightPurchased(stallionId, msg.sender, expiry, seed);
    }

    function hasBreedingRight(uint256 stallionId, address user) public view returns (bool) {
        return breedingRightExpiry[stallionId][user] > block.timestamp;
    }

    function breed(uint256 stallionId, uint256 mareId, string calldata offspringName, bytes32 salt)
        external
        returns (uint256 offspringId)
    {
        require(horseNFT.ownerOf(mareId) == msg.sender, "Not mare owner");
        require(hasBreedingRight(stallionId, msg.sender), "No breeding right");

        HorseINFT.HorseData memory sire = horseNFT.getHorseData(stallionId);
        HorseINFT.HorseData memory dam = horseNFT.getHorseData(mareId);
        require(sire.breedingAvailable && dam.breedingAvailable && !sire.injured && !dam.injured, "Not breedable");

        bytes32 seed = purchaseSeed[stallionId][msg.sender];
        (uint8[8] memory traits, uint16 pedigreeScore, bytes32 dnaHash) = _computeOffspring(sire, dam, seed, salt);

        listings[stallionId].usedCount += 1;
        if (listings[stallionId].usedCount >= listings[stallionId].maxUses) {
            listings[stallionId].active = false;
        }

        uint256 initialValuation = (sire.valuationADI + dam.valuationADI) / 2;
        HorseINFT.HorseData memory offspringData = HorseINFT.HorseData({
            name: offspringName,
            birthTimestamp: uint64(block.timestamp),
            sireId: stallionId,
            damId: mareId,
            traitVector: traits,
            pedigreeScore: pedigreeScore,
            valuationADI: initialValuation,
            dnaHash: dnaHash,
            breedingAvailable: false,
            injured: false,
            retired: false,
            encryptedURI: "",
            metadataHash: keccak256(abi.encodePacked(stallionId, mareId, seed, salt, block.chainid))
        });

        offspringId = horseNFT.mint(msg.sender, "", offspringData.metadataHash, offspringData);
        emit Bred(stallionId, mareId, offspringId);
        return offspringId;
    }

    /// Heritability: weighted average + small mutation. Deterministic from seed + salt.
    function _computeOffspring(
        HorseINFT.HorseData memory sire,
        HorseINFT.HorseData memory dam,
        bytes32 seed,
        bytes32 salt
    ) internal pure returns (uint8[8] memory traits, uint16 pedigreeScore, bytes32 dnaHash) {
        bytes32 h = keccak256(abi.encodePacked(seed, salt));
        for (uint256 i = 0; i < 8; i++) {
            uint256 s = uint8(sire.traitVector[i]);
            uint256 d = uint8(dam.traitVector[i]);
            uint256 avg = (s * 55 + d * 45) / 100;
            uint256 mutation = (uint256(h) >> (i * 8)) % 5;
            if (mutation == 0 && avg > 0) avg--;
            else if (mutation == 4 && avg < 255) avg++;
            traits[i] = uint8(avg > 255 ? 255 : avg);
        }
        uint32 pS = (uint32(sire.pedigreeScore) * 55 + uint32(dam.pedigreeScore) * 45) / 100;
        uint256 decay = 950; // 5% decay per generation
        pedigreeScore = uint16((pS * decay) / 1000);
        if (pedigreeScore > 10000) pedigreeScore = 10000;
        dnaHash = keccak256(abi.encodePacked(sire.dnaHash, dam.dnaHash, traits, salt));
    }
}
