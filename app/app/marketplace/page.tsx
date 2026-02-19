"use client";

/**
 * Marketplace (The Ring) - On-chain listings only.
 */
import { useMemo, useState } from "react";
import { useReadContracts } from "wagmi";
import { addresses, abis } from "@/lib/contracts";
import { MAX_HORSE_ID_TO_FETCH, isOnChainHorse } from "@/lib/on-chain-horses";
import {
  mapToMarketListing,
  parseRawHorseData,
  parseRawListing,
} from "@/lib/on-chain-mapping";
import { MarketHero } from "@/components/market/MarketHero";
import { MarketToolbar } from "@/components/market/MarketToolbar";
import { MarketTable, type SortKey } from "@/components/market/MarketTable";
import type { MarketListing } from "@/data/mockMarketListings";

const HORSE_IDS = Array.from({ length: MAX_HORSE_ID_TO_FETCH }, (_, i) => i);

export default function MarketplacePage() {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("valuationUsd");
  const [sortAsc, setSortAsc] = useState(false);

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

  const { data: horsesData } = useReadContracts({ contracts: horseCalls as any });
  const { data: listingsData } = useReadContracts({
    contracts: listingCalls as any,
  });

  const listings = useMemo<MarketListing[]>(() => {
    if (!horsesData || !listingsData) return [];
    const result: MarketListing[] = [];
    for (let i = 0; i < HORSE_IDS.length; i++) {
      const horseRes = horsesData[i];
      const listingRes = listingsData[i];
      if (horseRes?.status !== "success" || !horseRes.result || !isOnChainHorse(horseRes.result))
        continue;
      const raw = parseRawHorseData(horseRes.result);
      if (!raw) continue;
      const listing = listingRes?.status === "success" && listingRes.result
        ? parseRawListing(listingRes.result)
        : null;
      result.push(mapToMarketListing(HORSE_IDS[i], raw, listing));
    }
    return result;
  }, [horsesData, listingsData]);

  const filtered = useMemo(() => {
    let list = listings.filter((h) =>
      h.name.toLowerCase().includes(search.toLowerCase()),
    );
    list = [...list].sort((a, b) => {
      let av: number | string;
      let bv: number | string;
      switch (sortKey) {
        case "name":
          av = a.name;
          bv = b.name;
          return sortAsc
            ? String(av).localeCompare(String(bv))
            : String(bv).localeCompare(String(av));
        case "valuationUsd":
          av = a.valuationUsd;
          bv = b.valuationUsd;
          break;
        case "change24hPct":
          av = a.change24hPct;
          bv = b.change24hPct;
          break;
        case "soundness":
          av = a.soundness === "SOUND" ? 3 : a.soundness === "MONITOR" ? 2 : 1;
          bv = b.soundness === "SOUND" ? 3 : b.soundness === "MONITOR" ? 2 : 1;
          break;
        case "wins":
          av = a.wins;
          bv = b.wins;
          break;
        case "studFeeUsd":
          av = a.studFeeUsd;
          bv = b.studFeeUsd;
          break;
        case "uses":
          av = a.uses;
          bv = b.uses;
          break;
        case "demandScore":
          av = a.demandScore;
          bv = b.demandScore;
          break;
        default:
          return 0;
      }
      const diff = Number(av) - Number(bv);
      return sortAsc ? diff : -diff;
    });
    return list;
  }, [listings, search, sortKey, sortAsc]);

  const stats = useMemo(() => {
    const total = listings.reduce((a, h) => a + h.valuationUsd, 0);
    const avg24h =
      listings.length > 0
        ? listings.reduce((a, h) => a + h.change24hPct, 0) / listings.length
        : 0;
    const topMover = [...listings].sort(
      (a, b) => b.change24hPct - a.change24hPct,
    )[0];
    return {
      totalMarketCap: total,
      avg24hPct: avg24h,
      topMoverName: topMover?.name ?? "—",
    };
  }, [listings]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else {
      setSortKey(key);
      setSortAsc(key === "name");
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <MarketHero
        totalMarketCap={stats.totalMarketCap}
        avg24hPct={stats.avg24hPct}
        topMoverName={stats.topMoverName}
      />

      <MarketToolbar
        count={filtered.length}
        search={search}
        onSearchChange={setSearch}
      />

      <MarketTable
        listings={filtered}
        sortKey={sortKey}
        sortAsc={sortAsc}
        onSort={handleSort}
      />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-[10px] font-sans tracking-wider text-muted-foreground uppercase">
        <span>
          ON-CHAIN DATA · ALL VALUATIONS IN ADI
        </span>
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-1.5 rounded-full bg-terminal-green shadow-[0_0_6px_rgba(16,185,129,0.5)]" />
          <span className="text-terminal-green font-medium">MARKET OPEN</span>
        </div>
      </div>
    </div>
  );
}
