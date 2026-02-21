import { addresses, abis } from "./contracts";
import { createPublicClient, http, type PublicClient } from "viem";
import { anvilLocal, ogGalileo } from "./chains";

export interface PedigreeNode {
  tokenId: number;
  name: string;
  sireId: number;
  damId: number;
  pedigreeScore: number;
  generation: number;
  sire?: PedigreeNode | null;
  dam?: PedigreeNode | null;
}

/**
 * Fetches horse data from the contract
 */
async function fetchHorseData(
  client: PublicClient,
  tokenId: number
): Promise<PedigreeNode | null> {
  try {
    const data = await client.readContract({
      address: addresses.horseINFT,
      abi: abis.HorseINFT,
      functionName: "getHorseData",
      args: [BigInt(tokenId)],
    });

    const raw = data as any;
    const name = raw?.name ?? raw?.[0] ?? "";
    const sireId = Number(raw?.sireId ?? raw?.[2] ?? 0);
    const damId = Number(raw?.damId ?? raw?.[3] ?? 0);
    const pedigreeScore = Number(raw?.pedigreeScore ?? raw?.[5] ?? 0);

    // If both sire and dam are 0, this is a founder horse
    if (sireId === 0 && damId === 0) {
      return {
        tokenId,
        name: name || `Horse #${tokenId}`,
        sireId: 0,
        damId: 0,
        pedigreeScore,
        generation: 0,
        sire: null,
        dam: null,
      };
    }

    return {
      tokenId,
      name: name || `Horse #${tokenId}`,
      sireId,
      damId,
      pedigreeScore,
      generation: 0, // Will be set during tree building
    };
  } catch (error) {
    console.error(`Failed to fetch horse ${tokenId}:`, error);
    return null;
  }
}

/**
 * Recursively builds the pedigree tree by fetching ancestors
 */
export async function buildPedigreeTree(
  tokenId: number,
  maxDepth: number = 5,
  currentDepth: number = 0
): Promise<PedigreeNode | null> {
  if (currentDepth >= maxDepth) {
    return null;
  }

  const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID || 16602);
  const chain = chainId === 31337 ? anvilLocal : ogGalileo;
  const client = createPublicClient({
    chain,
    transport: http(),
  });

  const horse = await fetchHorseData(client, tokenId);
  if (!horse) return null;

  horse.generation = currentDepth;

  // Fetch sire: token 0 is valid (e.g. Galileos Edge); only skip when both parents are 0 (founder)
  const hasSire = horse.sireId > 0 || (horse.sireId === 0 && horse.damId > 0);
  if (hasSire) {
    horse.sire = await buildPedigreeTree(
      horse.sireId,
      maxDepth,
      currentDepth + 1
    );
  } else {
    horse.sire = null;
  }

  // Fetch dam: token 0 is valid; only skip when both parents are 0 (founder)
  const hasDam = horse.damId > 0 || (horse.damId === 0 && horse.sireId > 0);
  if (hasDam) {
    horse.dam = await buildPedigreeTree(
      horse.damId,
      maxDepth,
      currentDepth + 1
    );
  } else {
    horse.dam = null;
  }

  return horse;
}

/**
 * Flattens the pedigree tree into a list for easier rendering
 */
export function flattenPedigreeTree(
  node: PedigreeNode | null,
  result: PedigreeNode[] = []
): PedigreeNode[] {
  if (!node) return result;

  result.push(node);
  if (node.sire) flattenPedigreeTree(node.sire, result);
  if (node.dam) flattenPedigreeTree(node.dam, result);

  return result;
}
