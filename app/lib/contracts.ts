import { parseAbi } from "viem";

const ZERO = "0x0000000000000000000000000000000000000000" as `0x${string}`;

function a(v: string | undefined): `0x${string}` {
  return (v || ZERO) as `0x${string}`;
}

export const addresses = {
  adiToken: a(process.env.NEXT_PUBLIC_ADI_TOKEN),
  horseINFT: a(process.env.NEXT_PUBLIC_HORSE_INFT),
  breedingMarketplace: a(process.env.NEXT_PUBLIC_BREEDING_MARKETPLACE),
  syndicateVaultFactory: a(process.env.NEXT_PUBLIC_SYNDICATE_VAULT_FACTORY),
  horseOracle: a(process.env.NEXT_PUBLIC_HORSE_ORACLE),
  agentINFT: a(process.env.NEXT_PUBLIC_AGENT_INFT),
  agentExecutor: a(process.env.NEXT_PUBLIC_AGENT_EXECUTOR),
};

export const abis = {
  MockADI: parseAbi([
    "function mint(address to, uint256 amount) external",
    "function balanceOf(address) view returns (uint256)",
    "function approve(address spender, uint256 amount) returns (bool)",
    "function allowance(address owner, address spender) view returns (uint256)",
  ]),
  HorseINFT: parseAbi([
    "function ownerOf(uint256) view returns (address)",
    "function getHorseData(uint256) view returns ((string name, uint64 birthTimestamp, uint256 sireId, uint256 damId, uint8[8] traitVector, uint16 pedigreeScore, uint256 valuationADI, bytes32 dnaHash, bool breedingAvailable, bool injured, bool retired, string encryptedURI, bytes32 metadataHash))",
    "function mint(address to, string encryptedURI, bytes32 metadataHash, (string name, uint64 birthTimestamp, uint256 sireId, uint256 damId, uint8[8] traitVector, uint16 pedigreeScore, uint256 valuationADI, bytes32 dnaHash, bool breedingAvailable, bool injured, bool retired, string encryptedURI, bytes32 metadataHash) data) external returns (uint256)",
    "function approve(address to, uint256 tokenId) external",
    "function setApprovalForAll(address operator, bool approved) external",
  ]),
  BreedingMarketplace: parseAbi([
    "function list(uint256 stallionId, uint256 studFeeADI, uint256 maxUses, bool useAllowlist) external",
    "function purchaseBreedingRight(uint256 stallionId, bytes32 seed) external",
    "function breed(uint256 stallionId, uint256 mareId, string offspringName, bytes32 salt) external returns (uint256)",
    "function hasBreedingRight(uint256 stallionId, address user) view returns (bool)",
    "function listings(uint256) view returns (uint256 studFeeADI, uint256 maxUses, uint256 usedCount, bool useAllowlist, bool active)",
  ]),
  HorseSyndicateVaultFactory: parseAbi([
    "function createVault(uint256 horseTokenId, uint256 totalShares, uint256 sharePriceADI) external returns (address)",
    "function vaultForHorse(uint256) view returns (address)",
  ]),
  HorseOracle: parseAbi([
    "function reportRaceResult(uint256 tokenId, uint8 placing, uint256 earningsADI) external",
    "function reportInjury(uint256 tokenId, uint16 severityBps) external",
    "function reportNews(uint256 tokenId, uint16 sentimentBps) external",
  ]),
  BreedingAdvisorINFT: parseAbi([
    "function mint(address to, (string name, string version, string specialization, string modelBundleRootHash) profile) external returns (uint256)",
    "function ownerOf(uint256) view returns (address)",
    "function getModelBundleRootHash(uint256) view returns (string)",
    "function updateModelBundle(uint256 tokenId, string rootHash) external",
    "function profiles(uint256) view returns (string name, string version, string specialization, string modelBundleRootHash)",
  ]),
  AgentExecutor: parseAbi([
    "function execute((address user, uint256 budgetADI, bytes32 allowlistedStallionsRoot, uint256 maxStudFeeADI, uint256 mareTokenId, uint256 chosenStallionTokenId, uint256 deadline, bytes32 expectedOffspringTraitFloor) plan, string offspringName, bytes32 salt, bytes32 purchaseSeed, bytes signature) external returns (uint256)",
    "function hashPlan((address user, uint256 budgetADI, bytes32 allowlistedStallionsRoot, uint256 maxStudFeeADI, uint256 mareTokenId, uint256 chosenStallionTokenId, uint256 deadline, bytes32 expectedOffspringTraitFloor) plan) view returns (bytes32)",
  ]),
};
