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
  kycRegistry: a(process.env.NEXT_PUBLIC_KYC_REGISTRY),
  agentRiskConfig: a(process.env.NEXT_PUBLIC_AGENT_RISK_CONFIG),
  stopLossExecutor: a(process.env.NEXT_PUBLIC_STOP_LOSS_EXECUTOR),
  agentWallet: a(process.env.NEXT_PUBLIC_AGENT_WALLET),
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
    "function getHorseData(uint256) view returns ((string name, uint64 birthTimestamp, uint256 sireId, uint256 damId, uint8[8] traitVector, uint16 pedigreeScore, uint256 valuationADI, bytes32 dnaHash, bool breedingAvailable, bool injured, bool retired, bool xFactorCarrier, string encryptedURI, bytes32 metadataHash))",
    "function mint(address to, string encryptedURI, bytes32 metadataHash, (string name, uint64 birthTimestamp, uint256 sireId, uint256 damId, uint8[8] traitVector, uint16 pedigreeScore, uint256 valuationADI, bytes32 dnaHash, bool breedingAvailable, bool injured, bool retired, bool xFactorCarrier, string encryptedURI, bytes32 metadataHash) data) external returns (uint256)",
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
    "function createVault(uint256 horseTokenId, uint256 totalShares, uint256 sharePriceADI, uint256 bufferTarget) external returns (address)",
    "function vaultForHorse(uint256) view returns (address)",
  ]),
  HorseOracle: parseAbi([
    "function reportRaceResult(uint256 tokenId, uint8 placing, uint256 earningsADI) external",
    "function reportInjury(uint256 tokenId, uint16 severityBps) external",
    "function reportNews(uint256 tokenId, uint16 sentimentBps) external",
    "function reportBiometric(uint256 tokenId, uint8 biometricType, uint256 value, uint256 baseline, uint16 anomalyThresholdBps) external",
    "function commitValuation(uint256 tokenId, uint8 eventType, bytes32 eventHash, uint256 newValuationADI, bytes32 ogRootHash) external",
    "function getLatestBiometric(uint256 tokenId, uint8 biometricType) view returns ((uint8 biometricType, uint256 value, uint256 baseline, uint16 deviationBps, uint256 timestamp))",
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
  KYCRegistry: parseAbi([
    "function isVerified(address) view returns (bool)",
    "function verifiedAt(address) view returns (uint256)",
    "function verify(address account) external",
    "function verifyBatch(address[] accounts) external",
    "function revoke(address account) external",
  ]),
  AgentRiskConfig: parseAbi([
    "function getRiskParams(address vault) view returns ((uint256 minValuationADI, uint16 maxDrawdownBps, uint16 maxPositionSizeBps, uint8 healthThreshold, uint16 strideDeltaThresholdBps, uint256 peakValuation, bool stopLossEnabled, bool autoRetireOnHealth))",
    "function setRiskParams(address vault, uint256 minValuationADI, uint16 maxDrawdownBps, uint16 maxPositionSizeBps, uint8 healthThreshold, uint16 strideDeltaThresholdBps, bool stopLossEnabled, bool autoRetireOnHealth) external",
    "function isStopLossBreached(address vault, uint256 currentValuation) view returns (bool)",
    "function isDrawdownBreached(address vault, uint256 currentValuation) view returns (bool)",
  ]),
  StopLossExecutor: parseAbi([
    "function executeStopLoss(uint256 horseTokenId) external",
    "function executeDrawdownStop(uint256 horseTokenId) external",
    "function executeHealthRetire(uint256 horseTokenId, uint8 healthScore) external",
    "function lastTriggerTime(address vault) view returns (uint256)",
  ]),
  HorseSyndicateVault: parseAbi([
    "function buyShares(uint256 numShares) external",
    "function redeemShares(uint256 numShares) external",
    "function claim() external",
    "function claimableFor(address) view returns (uint256)",
    "function totalSupply() view returns (uint256)",
    "function balanceOf(address) view returns (uint256)",
    "function tvl() view returns (uint256)",
    "function totalShares() view returns (uint256)",
    "function sharePriceADI() view returns (uint256)",
    "function operatingBuffer() view returns (uint256)",
    "function bufferTarget() view returns (uint256)",
    "function navPerShare() view returns (uint256)",
    "function invoiceCount() view returns (uint256)",
    "function dividendReceiptCount() view returns (uint256)",
    "function agentOperator() view returns (address)",
    "function delegate(address delegatee) external",
    "function delegates(address account) view returns (address)",
  ]),
};
