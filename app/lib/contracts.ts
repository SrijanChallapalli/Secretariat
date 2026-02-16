const chainId = typeof window !== "undefined" ? Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 16602) : 16602;

function addr(name: string): `0x${string}` {
  const v = process.env[`NEXT_PUBLIC_${name}`] ?? (process.env as Record<string, string>)[name];
  if (!v) return "0x0000000000000000000000000000000000000000" as `0x${string}`;
  return v as `0x${string}`;
}

export const addresses = {
  adiToken: addr("ADI_TOKEN"),
  horseINFT: addr("HORSE_INFT"),
  breedingMarketplace: addr("BREEDING_MARKETPLACE"),
  syndicateVaultFactory: addr("SYNDICATE_VAULT_FACTORY"),
  horseOracle: addr("HORSE_ORACLE"),
  agentINFT: addr("AGENT_INFT"),
  agentExecutor: addr("AGENT_EXECUTOR"),
};

export const abis = {
  MockADI: [
    "function mint(address to, uint256 amount) external",
    "function balanceOf(address) view returns (uint256)",
    "function approve(address spender, uint256 amount) returns (bool)",
    "function allowance(address owner, address spender) view returns (uint256)",
  ] as const,
  HorseINFT: [
    "function ownerOf(uint256) view returns (address)",
    "function getHorseData(uint256) view returns (string name, uint64 birthTimestamp, uint256 sireId, uint256 damId, uint8[8] traitVector, uint16 pedigreeScore, uint256 valuationADI, bytes32 dnaHash, bool breedingAvailable, bool injured, bool retired, string encryptedURI, bytes32 metadataHash)",
    "function mint(address to, string encryptedURI, bytes32 metadataHash, (string name, uint64 birthTimestamp, uint256 sireId, uint256 damId, uint8[8] traitVector, uint16 pedigreeScore, uint256 valuationADI, bytes32 dnaHash, bool breedingAvailable, bool injured, bool retired, string encryptedURI, bytes32 metadataHash) data) external returns (uint256)",
    "function approve(address to, uint256 tokenId) external",
    "function setApprovalForAll(address operator, bool approved) external",
  ] as const,
  BreedingMarketplace: [
    "function list(uint256 stallionId, uint256 studFeeADI, uint256 maxUses, bool useAllowlist) external",
    "function purchaseBreedingRight(uint256 stallionId, bytes32 seed) external",
    "function breed(uint256 stallionId, uint256 mareId, string offspringName, bytes32 salt) external returns (uint256)",
    "function hasBreedingRight(uint256 stallionId, address user) view returns (bool)",
    "function listings(uint256) view returns (uint256 studFeeADI, uint256 maxUses, uint256 usedCount, bool useAllowlist, bool active)",
  ] as const,
  HorseSyndicateVaultFactory: [
    "function createVault(uint256 horseTokenId, uint256 totalShares, uint256 sharePriceADI) external returns (address)",
    "function vaultForHorse(uint256) view returns (address)",
  ] as const,
  HorseOracle: [
    "function reportRaceResult(uint256 tokenId, uint8 placing, uint256 earningsADI) external",
    "function reportInjury(uint256 tokenId, uint16 severityBps) external",
    "function reportNews(uint256 tokenId, uint16 sentimentBps) external",
  ] as const,
  BreedingAdvisorINFT: [
    "function mint(address to, (string name, string version, string specialization, string modelBundleRootHash) profile) external returns (uint256)",
    "function ownerOf(uint256) view returns (address)",
    "function getModelBundleRootHash(uint256) view returns (string)",
    "function updateModelBundle(uint256 tokenId, string rootHash) external",
    "function profiles(uint256) view returns (string name, string version, string specialization, string modelBundleRootHash)",
  ] as const,
  AgentExecutor: [
    "function execute((address user, uint256 budgetADI, bytes32 allowlistedStallionsRoot, uint256 maxStudFeeADI, uint256 mareTokenId, uint256 chosenStallionTokenId, uint256 deadline, bytes32 expectedOffspringTraitFloor) plan, string offspringName, bytes32 salt, bytes32 purchaseSeed, bytes signature) external returns (uint256)",
    "function hashPlan((address user, uint256 budgetADI, bytes32 allowlistedStallionsRoot, uint256 maxStudFeeADI, uint256 mareTokenId, uint256 chosenStallionTokenId, uint256 deadline, bytes32 expectedOffspringTraitFloor) plan) view returns (bytes32)",
  ] as const,
};
