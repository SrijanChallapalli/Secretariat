import { useMemo, useEffect } from "react";
import { useReadContracts, useBlockNumber } from "wagmi";
import { addresses, abis } from "@/lib/contracts";
import { MAX_HORSE_ID_TO_FETCH, isOnChainHorse } from "@/lib/on-chain-horses";
import {
  parseRawHorseData,
  parseRawListing,
  type RawHorseData,
  type RawListing,
} from "@/lib/on-chain-mapping";

const HORSE_IDS = Array.from({ length: MAX_HORSE_ID_TO_FETCH }, (_, i) => i);

export type HorseWithListing = {
  tokenId: number;
  raw: RawHorseData;
  listing: RawListing | null;
};

export type UseHorsesResult = {
  horses: HorseWithListing[];
  isLoading: boolean;
  isError: boolean;
};

export function useHorsesWithListings(): HorseWithListing[];
export function useHorsesWithListings(opts: { withStatus: true }): UseHorsesResult;
export function useHorsesWithListings(opts?: { withStatus?: boolean }): HorseWithListing[] | UseHorsesResult {
  const horseCalls = HORSE_IDS.map((id) => ({
    address: addresses.horseINFT,
    abi: abis.HorseINFT,
    functionName: "getHorseData" as const,
    args: [BigInt(id)] as [bigint],
  }));
  const listingCalls = HORSE_IDS.map((id) => ({
    address: addresses.breedingMarketplace,
    abi: abis.BreedingMarketplace,
    functionName: "listings" as const,
    args: [BigInt(id)] as [bigint],
  }));

  const { data: latestBlock } = useBlockNumber({ watch: true });
  const { data: horsesData, isLoading: hLoading, isError: hError, refetch: refetchHorses } = useReadContracts({
    contracts: horseCalls,
    query: { refetchInterval: 10_000, structuralSharing: false },
  });
  const { data: listingsData, isLoading: lLoading, isError: lError, refetch: refetchListings } = useReadContracts({
    contracts: listingCalls,
    query: { refetchInterval: 10_000, structuralSharing: false },
  });

  useEffect(() => {
    if (latestBlock) {
      refetchHorses();
      refetchListings();
    }
  }, [latestBlock, refetchHorses, refetchListings]);

  const horses = useMemo(() => {
    if (!horsesData || !listingsData) return [];
    const result: HorseWithListing[] = [];
    for (let i = 0; i < HORSE_IDS.length; i++) {
      const hRes = horsesData[i];
      const lRes = listingsData[i];
      if (hRes?.status !== "success" || !hRes.result || !isOnChainHorse(hRes.result))
        continue;
      const raw = parseRawHorseData(hRes.result);
      if (!raw) continue;
      const listing =
        lRes?.status === "success" && lRes.result
          ? parseRawListing(lRes.result)
          : null;
      result.push({ tokenId: HORSE_IDS[i], raw, listing });
    }
    return result;
  }, [horsesData, listingsData]);

  if (opts?.withStatus) {
    return { horses, isLoading: hLoading || lLoading, isError: hError || lError };
  }
  return horses;
}
