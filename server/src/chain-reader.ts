/**
 * Shared helpers for reading on-chain horse data via viem public client.
 * Used by both event-indexer and oracle-pipeline.
 */

import { createPublicClient, http, parseAbi } from "viem";
import type { FeatureVector } from "../../shared/types.js";

const RPC = process.env.RPC_0G || "https://evmrpc-testnet.0g.ai";
const HORSE_INFT = process.env.NEXT_PUBLIC_HORSE_INFT;

export const og0gChain = {
  id: Number(process.env.CHAIN_ID_0G ?? 16602),
  name: "0G",
  nativeCurrency: { decimals: 18, name: "ETH", symbol: "ETH" },
  rpcUrls: { default: { http: [RPC] } },
} as const;

export const horseINFTAbi = parseAbi([
  "function getHorseData(uint256) view returns ((string name, uint64 birthTimestamp, uint256 sireId, uint256 damId, uint8[8] traitVector, uint16 pedigreeScore, uint256 valuationADI, bytes32 dnaHash, bool breedingAvailable, bool injured, bool retired, string encryptedURI, bytes32 metadataHash))",
]);

let _publicClient: ReturnType<typeof createPublicClient> | null = null;

export function getPublicClient() {
  if (!_publicClient) {
    _publicClient = createPublicClient({ chain: og0gChain, transport: http(RPC) });
  }
  return _publicClient;
}

export interface HorseFeaturesResult {
  features: Partial<FeatureVector>;
  valuationADI: number;
  valuationADIRaw: bigint;
  name: string;
}

export async function fetchHorseFeatures(
  tokenId: number,
): Promise<HorseFeaturesResult> {
  if (!HORSE_INFT || HORSE_INFT === "0x0000000000000000000000000000000000000000") {
    return { features: {}, valuationADI: 0, valuationADIRaw: 0n, name: "" };
  }

  const client = getPublicClient();
  const raw = await client.readContract({
    address: HORSE_INFT as `0x${string}`,
    abi: horseINFTAbi,
    functionName: "getHorseData",
    args: [BigInt(tokenId)],
  });

  const r = raw as any;
  const traits: number[] = (r.traitVector ?? r[4] ?? []).map(Number);

  const features: Partial<FeatureVector> = {
    speed: traits[0] ?? 0,
    stamina: traits[1] ?? 0,
    temperament: traits[2] ?? 0,
    conformation: traits[3] ?? 0,
    health: traits[4] ?? 0,
    agility: traits[5] ?? 0,
    raceIQ: traits[6] ?? 0,
    consistency: traits[7] ?? 0,
    pedigreeScore: Number(r.pedigreeScore ?? r[5] ?? 0),
    injured: Boolean(r.injured ?? r[9]),
    retired: Boolean(r.retired ?? r[10]),
    birthTimestamp: Number(r.birthTimestamp ?? r[1] ?? 0),
    sireId: Number(r.sireId ?? r[2] ?? 0),
    damId: Number(r.damId ?? r[3] ?? 0),
  };

  const valuationADIRaw = BigInt(r.valuationADI ?? r[6] ?? 0);
  const valuationADI = Number(valuationADIRaw);
  const name = String(r.name ?? r[0] ?? "");

  return { features, valuationADI, valuationADIRaw, name };
}
