// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/MockADI.sol";
import "../src/MockINFTOracle.sol";
import "../src/HorseINFT.sol";
import "../src/BreedingMarketplace.sol";
import "../src/HorseOracle.sol";
import "../src/HorseSyndicateVault.sol";
import "../src/HorseSyndicateVaultFactory.sol";
import "../src/BreedingAdvisorINFT.sol";
import "../src/AgentExecutor.sol";

contract DeployScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        MockADI adi = new MockADI();
        MockINFTOracle oracle = new MockINFTOracle();
        HorseINFT horseNFT = new HorseINFT(address(oracle));
        BreedingMarketplace marketplace = new BreedingMarketplace(address(adi), address(horseNFT));
        horseNFT.setBreedingMarketplace(address(marketplace));

        HorseOracle horseOracle = new HorseOracle(address(horseNFT));
        HorseSyndicateVaultFactory vaultFactory = new HorseSyndicateVaultFactory(address(adi), address(horseNFT));

        BreedingAdvisorINFT agentINFT = new BreedingAdvisorINFT();
        AgentExecutor agentExecutor =
            new AgentExecutor(address(agentINFT), address(marketplace), address(horseNFT), address(adi));

        vm.stopBroadcast();

        console.log("MockADI", address(adi));
        console.log("MockINFTOracle", address(oracle));
        console.log("HorseINFT", address(horseNFT));
        console.log("BreedingMarketplace", address(marketplace));
        console.log("HorseOracle", address(horseOracle));
        console.log("HorseSyndicateVaultFactory", address(vaultFactory));
        console.log("BreedingAdvisorINFT", address(agentINFT));
        console.log("AgentExecutor", address(agentExecutor));
    }
}
