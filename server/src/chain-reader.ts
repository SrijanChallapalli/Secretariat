import { createPublicClient, http, parseAbi } from "viem";
import type { FeatureVector } from "../../shared/types.js";

const RPC = process.env.RPC_URL_0G ?? process.env.RPC_0G ?? "https://evmrpc-testnet.0g.ai";
const HORSE_INFT = process.env.NEXT_PUBLIC_HORSE_INFT;

const chain = {
  id: Number(process.env.CHAIN_ID_0G ?? 16602),
  name: "0G",
  nativeCurrency: { decimals: 18, name: "ETH", symbol: "ETH" },
  rpcUrls: { default: { http: [RPC] } },
} as const;

const horseAbi = parseAbi([
  "function getHorseData(uint256) view returns ((string name, uint64 birthTimestamp, uint256 sireId, uint256 damId, uint8[8] traitVector, uint16 pedigreeScore, uint256 valuationADI, bytes32 dnaHash, bool breedingAvailable, bool injured, bool retired, bool xFactorCarrier, string encryptedURI, bytes32 metadataHash))",
]);

let publicClient: ReturnType<typeof createPublicClient> | null = null;

export function getPublicClient() {
  if (!publicClient) {
    publicClient = createPublicClient({
      chain,
      transport: http(RPC),
    });
  }
  return publicClient;
}

export async function fetchHorseFeatures(tokenId: number): Promise<{
  features: FeatureVector;
  valuationADI: number;
}> {
  if (!HORSE_INFT || HORSE_INFT === "0x0000000000000000000000000000000000000000") {
    throw new Error("HORSE_INFT address not configured");
  }

  const client = getPublicClient();
  const result = await client.readContract({
    address: HORSE_INFT as `0x${string}`,
    abi: horseAbi,
    functionName: "getHorseData",
    args: [BigInt(tokenId)],
  });

  const [
    name,
    birthTimestamp,
    sireId,
    damId,
    traitVector,
    pedigreeScore,
    valuationADI,
    dnaHash,
    breedingAvailable,
    injured,
    retired,
    xFactorCarrier,
    encryptedURI,
    metadataHash,
  ] = result;

  const features: FeatureVector = {
    speed: Number(traitVector[0] ?? 0),
    stamina: Number(traitVector[1] ?? 0),
    temperament: Number(traitVector[2] ?? 0),
    conformation: Number(traitVector[3] ?? 0),
    health: Number(traitVector[4] ?? 0),
    agility: Number(traitVector[5] ?? 0),
    raceIQ: Number(traitVector[6] ?? 0),
    consistency: Number(traitVector[7] ?? 0),
    pedigreeScore: Number(pedigreeScore ?? 0),
    injured: injured ?? false,
    retired: retired ?? false,
    birthTimestamp: Number(birthTimestamp ?? 0),
    sireId: Number(sireId ?? 0),
    damId: Number(damId ?? 0),
    xFactorCarrier: xFactorCarrier ?? false,
  };

  return {
    features,
    valuationADI: Number(valuationADI ?? 0),
  };
}
