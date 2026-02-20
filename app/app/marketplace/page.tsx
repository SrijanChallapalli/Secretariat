"use client";

import { useMemo, useState } from "react";
import { mapToMarketListing } from "@/lib/on-chain-mapping";
import { MarketHero } from "@/components/market/MarketHero";
import { MarketToolbar } from "@/components/market/MarketToolbar";
import { MarketTable, type SortKey } from "@/components/market/MarketTable";
import type { MarketListing } from "@/data/mockMarketListings";
import { useHorsesWithListings } from "@/lib/hooks/useHorsesWithListings";
import type { UseHorsesResult } from "@/lib/hooks/useHorsesWithListings";

const PAGE_SIZE = 15;

export default function MarketplacePage() {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("valuationUsd");
  const [sortAsc, setSortAsc] = useState(false);
  const [page, setPage] = useState(0);

  const { horses: horsesWithListings, isLoading, isError } = useHorsesWithListings({ withStatus: true }) as UseHorsesResult;

  const listings = useMemo<MarketListing[]>(
    () =>
      horsesWithListings.map(({ tokenId, raw, listing }) =>
        mapToMarketListing(tokenId, raw, listing)
      ),
    [horsesWithListings]
  );

  const filtered = useMemo(() => {
    let list = listings.filter((h) =>
      h.name.toLowerCase().includes(search.toLowerCase())
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
          av = a.valuationUsd ?? 0;
          bv = b.valuationUsd ?? 0;
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
        default: {
          const _exhaustiveCheck: never = sortKey;
          return 0;
        }
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
      (a, b) => b.change24hPct - a.change24hPct
    )[0];
    return {
      totalMarketCap: total,
      avg24hPct: avg24h,
      topMoverName: topMover?.name ?? "—",
    };
  }, [listings]);

  const handleSort = (key: SortKey) => {
    setPage(0);
    if (sortKey === key) setSortAsc(!sortAsc);
    else {
      setSortKey(key);
      setSortAsc(key === "name");
    }
  };

  const handleSearchChange = (v: string) => {
    setSearch(v);
    setPage(0);
  };

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto">
        <div className="rounded-lg border border-white/10 bg-black/20 p-8 animate-pulse">
          <div className="h-6 w-48 bg-white/10 rounded mb-4" />
          <div className="h-4 w-64 bg-white/10 rounded" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="rounded-lg border border-white/10 bg-black/20 p-4 animate-pulse">
              <div className="h-4 w-full bg-white/5 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto">
        <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-8 text-center">
          <p className="text-sm text-red-400">Failed to load marketplace data. Please check your network connection and try again.</p>
        </div>
      </div>
    );
  }

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
        onSearchChange={handleSearchChange}
      />

      <MarketTable
        listings={filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)}
        sortKey={sortKey}
        sortAsc={sortAsc}
        onSort={handleSort}
      />

      {filtered.length > PAGE_SIZE && (
        <div className="flex items-center justify-between gap-4">
          <span className="text-xs text-muted-foreground">
            Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="px-3 py-1.5 text-xs rounded border border-white/20 text-foreground hover:bg-white/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              ← Prev
            </button>
            <span className="text-xs text-muted-foreground">
              Page {page + 1} of {Math.ceil(filtered.length / PAGE_SIZE)}
            </span>
            <button
              type="button"
              disabled={(page + 1) * PAGE_SIZE >= filtered.length}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1.5 text-xs rounded border border-white/20 text-foreground hover:bg-white/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Next →
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-[10px] font-sans tracking-wider text-muted-foreground uppercase">
        <span>ON-CHAIN DATA · ALL VALUATIONS IN ADI</span>
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-1.5 rounded-full bg-terminal-green shadow-[0_0_6px_rgba(16,185,129,0.5)]" />
          <span className="text-terminal-green font-medium">MARKET OPEN</span>
        </div>
      </div>
    </div>
  );
}
