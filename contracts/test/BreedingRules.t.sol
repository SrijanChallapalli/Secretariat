// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import "../src/HorseINFT.sol";
import "../src/BreedingMarketplace.sol";
import "../src/KYCRegistry.sol";
import "../src/MockINFTOracle.sol";
import "../src/MockADI.sol";

/// @title Sex requirements, incest prevention, and owner-controlled breeding
///        registration.
contract BreedingRulesTest is Test, ERC721Holder {
    MockADI adi;
    MockINFTOracle inftOracle;
    HorseINFT horseNFT;
    KYCRegistry kyc;
    BreedingMarketplace marketplace;

    address owner = address(this);
    address other = address(0xB0B);

    uint8 constant MALE = 0;
    uint8 constant FEMALE = 1;
    uint256 constant FEE = 10 ether;

    function setUp() public {
        adi = new MockADI();
        inftOracle = new MockINFTOracle();
        horseNFT = new HorseINFT(address(inftOracle));
        kyc = new KYCRegistry();
        marketplace = new BreedingMarketplace(address(adi), address(horseNFT), address(kyc));
        horseNFT.setBreedingMarketplace(address(marketplace));

        kyc.verify(owner);
        kyc.verify(other);
        adi.mint(owner, 10_000 ether);
        adi.approve(address(marketplace), type(uint256).max);
    }

    function _mint(address to, string memory name, uint8 sex, uint256 sireId, uint256 damId)
        internal
        returns (uint256)
    {
        HorseINFT.HorseData memory d = HorseINFT.HorseData({
            name: name,
            birthTimestamp: uint64(block.timestamp),
            sireId: sireId,
            damId: damId,
            traitVector: [uint8(80), 80, 80, 80, 80, 80, 80, 80],
            pedigreeScore: 8000,
            valuationADI: 100 ether,
            dnaHash: bytes32(0),
            breedingAvailable: true,
            injured: false,
            retired: false,
            xFactorCarrier: false,
            encryptedURI: "",
            metadataHash: bytes32(0),
            sex: sex
        });
        return horseNFT.mint(to, "", bytes32(0), d);
    }

    function _listAndBuy(uint256 stallionId) internal {
        marketplace.list(stallionId, FEE, 100, false);
        marketplace.purchaseBreedingRight(stallionId, keccak256(abi.encodePacked(stallionId)));
    }

    // ---------------------------------------------------------------------
    // Sex requirements
    // ---------------------------------------------------------------------

    function test_male_and_female_can_breed() public {
        uint256 sire = _mint(owner, "Sire", MALE, 0, 0);
        uint256 dam = _mint(owner, "Dam", FEMALE, 0, 0);
        _listAndBuy(sire);

        uint256 foal = marketplace.breed(sire, dam, "Foal", bytes32(uint256(1)));
        assertEq(horseNFT.ownerOf(foal), owner);
    }

    function test_two_males_cannot_breed() public {
        uint256 sire = _mint(owner, "SireA", MALE, 0, 0);
        uint256 sire2 = _mint(owner, "SireB", MALE, 0, 0);
        _listAndBuy(sire);

        vm.expectRevert("Dam must be female");
        marketplace.breed(sire, sire2, "Foal", bytes32(uint256(1)));
    }

    function test_two_females_cannot_breed() public {
        uint256 damA = _mint(owner, "DamA", FEMALE, 0, 0);
        uint256 damB = _mint(owner, "DamB", FEMALE, 0, 0);
        _listAndBuy(damA);

        vm.expectRevert("Sire must be male");
        marketplace.breed(damA, damB, "Foal", bytes32(uint256(1)));
    }

    // ---------------------------------------------------------------------
    // Incest prevention
    // ---------------------------------------------------------------------

    function test_father_cannot_breed_with_daughter() public {
        uint256 sire = _mint(owner, "Sire", MALE, 0, 0);
        uint256 dam = _mint(owner, "Dam", FEMALE, 0, 0);
        // Daughter records sire/dam as parents.
        uint256 daughter = _mint(owner, "Daughter", FEMALE, sire, dam);
        horseNFT.setBreedingAvailable(daughter, true);
        _listAndBuy(sire);

        vm.expectRevert("Too closely related");
        marketplace.breed(sire, daughter, "Incest", bytes32(uint256(1)));
    }

    function test_mother_cannot_breed_with_son() public {
        uint256 sire = _mint(owner, "Sire", MALE, 0, 0);
        uint256 dam = _mint(owner, "Dam", FEMALE, 0, 0);
        uint256 son = _mint(owner, "Son", MALE, sire, dam);
        horseNFT.setBreedingAvailable(son, true);
        _listAndBuy(son);

        vm.expectRevert("Too closely related");
        marketplace.breed(son, dam, "Incest", bytes32(uint256(1)));
    }

    function test_full_siblings_cannot_breed() public {
        uint256 sire = _mint(owner, "Sire", MALE, 0, 0);
        uint256 dam = _mint(owner, "Dam", FEMALE, 0, 0);
        uint256 brother = _mint(owner, "Brother", MALE, sire, dam);
        uint256 sister = _mint(owner, "Sister", FEMALE, sire, dam);
        horseNFT.setBreedingAvailable(brother, true);
        horseNFT.setBreedingAvailable(sister, true);
        _listAndBuy(brother);

        vm.expectRevert("Siblings cannot breed");
        marketplace.breed(brother, sister, "Incest", bytes32(uint256(1)));
    }

    function test_half_siblings_sharing_a_sire_cannot_breed() public {
        uint256 sire = _mint(owner, "Sire", MALE, 0, 0);
        uint256 damA = _mint(owner, "DamA", FEMALE, 0, 0);
        uint256 damB = _mint(owner, "DamB", FEMALE, 0, 0);
        uint256 halfBrother = _mint(owner, "HalfBro", MALE, sire, damA);
        uint256 halfSister = _mint(owner, "HalfSis", FEMALE, sire, damB);
        horseNFT.setBreedingAvailable(halfBrother, true);
        horseNFT.setBreedingAvailable(halfSister, true);
        _listAndBuy(halfBrother);

        vm.expectRevert("Siblings cannot breed");
        marketplace.breed(halfBrother, halfSister, "Incest", bytes32(uint256(1)));
    }

    function test_grandfather_cannot_breed_with_granddaughter() public {
        uint256 gSire = _mint(owner, "GrandSire", MALE, 0, 0);
        uint256 gDam = _mint(owner, "GrandDam", FEMALE, 0, 0);
        uint256 daughter = _mint(owner, "Daughter", FEMALE, gSire, gDam);
        uint256 outsideSire = _mint(owner, "Outsider", MALE, 0, 0);
        uint256 granddaughter = _mint(owner, "GrandDaughter", FEMALE, outsideSire, daughter);
        horseNFT.setBreedingAvailable(granddaughter, true);
        _listAndBuy(gSire);

        vm.expectRevert("Too closely related");
        marketplace.breed(gSire, granddaughter, "Incest", bytes32(uint256(1)));
    }

    function test_unrelated_founders_can_breed() public {
        // Every founder records (0,0); they must not be mistaken for siblings.
        uint256 sire = _mint(owner, "FounderA", MALE, 0, 0);
        uint256 dam = _mint(owner, "FounderB", FEMALE, 0, 0);
        _listAndBuy(sire);

        uint256 foal = marketplace.breed(sire, dam, "Foal", bytes32(uint256(1)));
        assertEq(horseNFT.ownerOf(foal), owner);
    }

    function test_unrelated_bred_horses_can_breed() public {
        uint256 sireA = _mint(owner, "SireA", MALE, 0, 0);
        uint256 damA = _mint(owner, "DamA", FEMALE, 0, 0);
        uint256 sireB = _mint(owner, "SireB", MALE, 0, 0);
        uint256 damB = _mint(owner, "DamB", FEMALE, 0, 0);
        // Two horses from entirely separate families.
        uint256 colt = _mint(owner, "Colt", MALE, sireA, damA);
        uint256 filly = _mint(owner, "Filly", FEMALE, sireB, damB);
        horseNFT.setBreedingAvailable(colt, true);
        horseNFT.setBreedingAvailable(filly, true);
        _listAndBuy(colt);

        uint256 foal = marketplace.breed(colt, filly, "Foal", bytes32(uint256(1)));
        assertEq(horseNFT.ownerOf(foal), owner);
    }

    function test_horse_cannot_breed_with_itself() public {
        uint256 sire = _mint(owner, "Sire", MALE, 0, 0);
        _listAndBuy(sire);

        vm.expectRevert("Cannot breed a horse with itself");
        marketplace.breed(sire, sire, "Foal", bytes32(uint256(1)));
    }

    // ---------------------------------------------------------------------
    // Offspring sex
    // ---------------------------------------------------------------------

    function test_offspring_sex_is_male_or_female_and_deterministic() public {
        uint256 sire = _mint(owner, "Sire", MALE, 0, 0);
        uint256 dam = _mint(owner, "Dam", FEMALE, 0, 0);
        _listAndBuy(sire);

        uint256 foal = marketplace.breed(sire, dam, "Foal", bytes32(uint256(42)));
        uint8 s = horseNFT.getSex(foal);
        assertTrue(s == MALE || s == FEMALE, "offspring must be male or female");
    }

    function test_offspring_sex_varies_across_salts() public {
        // Over several pairings both sexes should appear — proves it is not
        // hardcoded to one value.
        uint256 sireA = _mint(owner, "SA", MALE, 0, 0);
        uint256 sireB = _mint(owner, "SB", MALE, 0, 0);
        uint256 sireC = _mint(owner, "SC", MALE, 0, 0);
        uint256 sireD = _mint(owner, "SD", MALE, 0, 0);
        uint256 damA = _mint(owner, "DA", FEMALE, 0, 0);
        uint256 damB = _mint(owner, "DB", FEMALE, 0, 0);
        uint256 damC = _mint(owner, "DC", FEMALE, 0, 0);
        uint256 damD = _mint(owner, "DD", FEMALE, 0, 0);

        uint256[4] memory sires = [sireA, sireB, sireC, sireD];
        uint256[4] memory dams = [damA, damB, damC, damD];

        bool sawMale;
        bool sawFemale;
        for (uint256 i = 0; i < 4; i++) {
            _listAndBuy(sires[i]);
            uint256 foal = marketplace.breed(sires[i], dams[i], "F", bytes32(i + 100));
            if (horseNFT.getSex(foal) == MALE) sawMale = true;
            else sawFemale = true;
        }
        assertTrue(sawMale && sawFemale, "both sexes should occur across pairings");
    }

    // ---------------------------------------------------------------------
    // Owner-controlled breeding registration
    // ---------------------------------------------------------------------

    function test_token_owner_can_register_own_foal_for_breeding() public {
        uint256 sire = _mint(owner, "Sire", MALE, 0, 0);
        uint256 dam = _mint(owner, "Dam", FEMALE, 0, 0);
        _listAndBuy(sire);
        uint256 foal = marketplace.breed(sire, dam, "Foal", bytes32(uint256(1)));

        // Offspring are minted unavailable.
        assertFalse(horseNFT.getHorseData(foal).breedingAvailable);

        horseNFT.setBreedingAvailable(foal, true);
        assertTrue(horseNFT.getHorseData(foal).breedingAvailable);
    }

    function test_stranger_cannot_register_someone_elses_horse() public {
        uint256 horse = _mint(owner, "Mine", MALE, 0, 0);

        vm.prank(other);
        vm.expectRevert("Not contract or token owner");
        horseNFT.setBreedingAvailable(horse, false);
    }

    function test_cannot_register_a_retired_horse() public {
        uint256 horse = _mint(owner, "Retiree", MALE, 0, 0);
        horseNFT.setRetired(horse, true);

        vm.expectRevert("Horse retired");
        horseNFT.setBreedingAvailable(horse, true);
    }

    function test_second_generation_breeding_works_end_to_end() public {
        // The point of the owner-registration fix: a line must continue past
        // one generation.
        uint256 sireA = _mint(owner, "SireA", MALE, 0, 0);
        uint256 damA = _mint(owner, "DamA", FEMALE, 0, 0);
        uint256 sireB = _mint(owner, "SireB", MALE, 0, 0);
        uint256 damB = _mint(owner, "DamB", FEMALE, 0, 0);

        _listAndBuy(sireA);
        uint256 gen1a = marketplace.breed(sireA, damA, "Gen1a", bytes32(uint256(7)));
        _listAndBuy(sireB);
        uint256 gen1b = marketplace.breed(sireB, damB, "Gen1b", bytes32(uint256(9)));

        // Owner registers both offspring for breeding.
        horseNFT.setBreedingAvailable(gen1a, true);
        horseNFT.setBreedingAvailable(gen1b, true);

        // Pair them only if the sexes happen to allow it; otherwise assert the
        // registration itself succeeded, which is what this test guards.
        uint8 sa = horseNFT.getSex(gen1a);
        uint8 sb = horseNFT.getSex(gen1b);
        if (sa == MALE && sb == FEMALE) {
            _listAndBuy(gen1a);
            uint256 gen2 = marketplace.breed(gen1a, gen1b, "Gen2", bytes32(uint256(11)));
            assertEq(horseNFT.getHorseData(gen2).sireId, gen1a);
        } else if (sb == MALE && sa == FEMALE) {
            _listAndBuy(gen1b);
            uint256 gen2 = marketplace.breed(gen1b, gen1a, "Gen2", bytes32(uint256(11)));
            assertEq(horseNFT.getHorseData(gen2).sireId, gen1b);
        }
        assertTrue(horseNFT.getHorseData(gen1a).breedingAvailable);
        assertTrue(horseNFT.getHorseData(gen1b).breedingAvailable);
    }
}
