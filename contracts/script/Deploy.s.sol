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
import "../src/VaultDeployer.sol";
import "../src/BreedingAdvisorINFT.sol";
import "../src/AgentExecutor.sol";
import "../src/KYCRegistry.sol";
import "../src/AgentRiskConfig.sol";
import "../src/StopLossExecutor.sol";
import "../src/AgentWallet.sol";
import "../src/SyndicateGovernor.sol";

contract DeployScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        // Core tokens & oracle
        MockADI adi = new MockADI();
        MockINFTOracle oracle = new MockINFTOracle();

        // KYC Registry (compliance gate)
        KYCRegistry kycRegistry = new KYCRegistry();

        // Horse iNFT
        HorseINFT horseNFT = new HorseINFT(address(oracle));

        // Breeding marketplace (with KYC)
        BreedingMarketplace marketplace = new BreedingMarketplace(
            address(adi), address(horseNFT), address(kycRegistry)
        );
        horseNFT.setBreedingMarketplace(address(marketplace));

        // Vault deployer + factory (split to stay under EIP-170 bytecode limit)
        address deployer = vm.addr(deployerPrivateKey);
        VaultDeployer vDeployer = new VaultDeployer();
        HorseSyndicateVaultFactory vaultFactory = new HorseSyndicateVaultFactory(
            address(adi), address(horseNFT), address(kycRegistry),
            deployer, // protocolTreasury (deployer for now)
            300,      // 3% origination fee
            1000      // 10% yield skim
        );
        vDeployer.setFactory(address(vaultFactory));
        vaultFactory.setVaultDeployer(address(vDeployer));

        // Horse Oracle (biometric-capable, with access fees and vault factory)
        HorseOracle horseOracle = new HorseOracle(
            address(horseNFT), address(adi), deployer,
            address(vaultFactory), 0
        );
        horseNFT.setHorseOracle(address(horseOracle));

        // Agent iNFT & executor
        BreedingAdvisorINFT agentINFT = new BreedingAdvisorINFT();
        AgentExecutor agentExecutor = new AgentExecutor(
            address(agentINFT), address(marketplace), address(horseNFT), address(adi)
        );

        // Risk config (DeFAI Mixing Board)
        AgentRiskConfig riskConfig = new AgentRiskConfig();

        // Stop-loss executor
        StopLossExecutor stopLoss = new StopLossExecutor(
            address(horseNFT), address(vaultFactory), address(riskConfig)
        );

        // Agent wallet (ERC-4337 AA) — uses deployer as initial signer and a placeholder entrypoint
        AgentWallet agentWallet = new AgentWallet(
            address(0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789), // canonical ERC-4337 EntryPoint v0.6
            deployer
        );

        vm.stopBroadcast();

        console.log("MockADI", address(adi));
        console.log("MockINFTOracle", address(oracle));
        console.log("KYCRegistry", address(kycRegistry));
        console.log("HorseINFT", address(horseNFT));
        console.log("BreedingMarketplace", address(marketplace));
        console.log("HorseOracle", address(horseOracle));
        console.log("VaultDeployer", address(vDeployer));
        console.log("HorseSyndicateVaultFactory", address(vaultFactory));
        console.log("BreedingAdvisorINFT", address(agentINFT));
        console.log("AgentExecutor", address(agentExecutor));
        console.log("AgentRiskConfig", address(riskConfig));
        console.log("StopLossExecutor", address(stopLoss));
        console.log("AgentWallet", address(agentWallet));
    }
}
