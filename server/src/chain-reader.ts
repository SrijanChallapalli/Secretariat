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
  "function getHorseData(uint256) view returns ((string name, uint64 birthTimestamp, uint256 sireId, uint256 damId, uint8[8] traitVector, uint16 pedigreeScore, uint256 valuationADI, bytes32 dnaHash, bool breedingAvailable, bool injured, bool retired, bool xFactorCarrier, string encryptedURI, bytes32 metadataHash))",
  "function nextTokenId() view returns (uint256)",
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
    xFactorCarrier: Boolean(r.xFactorCarrier ?? r[11]),
  };

  const valuationADIRaw = BigInt(r.valuationADI ?? r[6] ?? 0);
  const valuationADI = Number(valuationADIRaw);
  const name = String(r.name ?? r[0] ?? "");

  return { features, valuationADI, valuationADIRaw, name };
}

export interface OffspringRecord {
  tokenId: number;
  birthTimestamp: number;
  valuationADIRaw: bigint;
}

/**
 * Iterate all minted horses and return those whose sireId or damId
 * matches the given parentTokenId.
 *
 * When parentTokenId is 0, we must distinguish real offspring (bred from
 * token 0) from founder horses that have sireId=0 / damId=0 meaning
 * "no parent." A founder has BOTH sireId=0 AND damId=0; a real offspring
 * of token 0 has exactly one of them set to 0 and the other > 0.
 */
export async function findOffspring(
  parentTokenId: number,
): Promise<OffspringRecord[]> {
  if (!HORSE_INFT || HORSE_INFT === "0x0000000000000000000000000000000000000000") {
    return [];
  }

  const client = getPublicClient();
  const total = Number(
    await client.readContract({
      address: HORSE_INFT as `0x${string}`,
      abi: horseINFTAbi,
      functionName: "nextTokenId",
    }),
  );

  const offspring: OffspringRecord[] = [];

  for (let id = 0; id < total; id++) {
    if (id === parentTokenId) continue;
    try {
      const raw = await client.readContract({
        address: HORSE_INFT as `0x${string}`,
        abi: horseINFTAbi,
        functionName: "getHorseData",
        args: [BigInt(id)],
      });
      const r = raw as any;
      const sireId = Number(r.sireId ?? r[2] ?? 0);
      const damId = Number(r.damId ?? r[3] ?? 0);

      const sireMatch = sireId === parentTokenId;
      const damMatch = damId === parentTokenId;
      if (!sireMatch && !damMatch) continue;

      // If parentTokenId is 0, sireId=0 AND damId=0 means "founder" (no
      // real parents), not "offspring of token 0." Only count it as a real
      // offspring if the OTHER parent field is non-zero.
      if (parentTokenId === 0 && sireId === 0 && damId === 0) continue;

      offspring.push({
        tokenId: id,
        birthTimestamp: Number(r.birthTimestamp ?? r[1] ?? 0),
        valuationADIRaw: BigInt(r.valuationADI ?? r[6] ?? 0),
      });
    } catch {
      // Token may not exist (burned or gap) — skip
    }
  }

  return offspring;
}
