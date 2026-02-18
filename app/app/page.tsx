"use client";

import { useMemo } from "react";
import { useReadContracts } from "wagmi";
import { addresses, abis } from "@/lib/contracts";
import { formatEther } from "viem";
import { AdiDisplay } from "@/components/AdiDisplay";
import { MAX_HORSE_ID_TO_FETCH, isOnChainHorse } from "@/lib/on-chain-horses";

const HORSE_IDS = Array.from({ length: MAX_HORSE_ID_TO_FETCH }, (_, i) => i);

type DashboardHorse = {
  tokenId: number;
  name: string;
  valuationADI: bigint;
  pedigreeScore: number;
  breedingAvailable: boolean;
  injured: boolean;
  retired: boolean;
};

export default function Dashboard() {
  const { data } = useReadContracts({
    contracts: HORSE_IDS.map((id) => ({
      address: addresses.horseINFT,
      abi: abis.HorseINFT,
      functionName: "getHorseData" as const,
      args: [BigInt(id)] as [bigint],
    })) as any,
  });

  const horses = useMemo<DashboardHorse[]>(() => {

    if (!data) return [];

    const loaded = data
      .map((c, idx) => {
        if (c.status !== "success" || !c.result || !isOnChainHorse(c.result)) return null;
        const r = c.result as any;
        const name = r.name ?? r[0];
        const valuationADI = (r.valuationADI ?? r[6] ?? 0n) as bigint;
        const pedigreeScore = Number(r.pedigreeScore ?? r[5] ?? 0);
        const breedingAvailable = Boolean(r.breedingAvailable ?? r[8] ?? false);
        const injured = Boolean(r.injured ?? r[9] ?? false);
        const retired = Boolean(r.retired ?? r[10] ?? false);
        const tokenId = HORSE_IDS[idx];
        return {
          tokenId,
          name: String(name || `Horse #${tokenId}`),
          valuationADI,
          pedigreeScore,
          breedingAvailable,
          injured,
          retired,
        };
      })
      .filter(Boolean) as DashboardHorse[];

    return loaded;
  }, [data]);

  const totalMarketADI = horses.reduce(
    (acc, h) => acc + h.valuationADI,
    0n,
  );
  const totalMarketFormatted = horses.length
    ? `${formatEther(totalMarketADI)} ADI`
    : "—";

  const activeBreeding = horses.filter((h) => h.breedingAvailable).length;

  const capitalLockedADI = horses
    .filter((h) => h.breedingAvailable)
    .reduce((acc, h) => acc + h.valuationADI, 0n);
  const capitalLockedFormatted = horses.length
    ? `${formatEther(capitalLockedADI)} ADI`
    : "—";

  const avgPedigree =
    horses.length > 0
      ? (horses.reduce((acc, h) => acc + h.pedigreeScore, 0) /
        horses.length /
        100
      ).toFixed(1)
      : null;

  const sortedByVal = [...horses].sort((a, b) =>
    a.valuationADI === b.valuationADI
      ? 0
      : a.valuationADI > b.valuationADI
        ? -1
        : 1,
  );
  const heatmapHorses = sortedByVal.slice(0, 12);
  const topValuations = sortedByVal.slice(0, 4);
  const lowestValuations = sortedByVal.slice(-4).reverse();

  return (
    <div className="space-y-10 max-w-7xl mx-auto">
      <header className="space-y-3 pb-6 border-b border-white/5">
        <h1 className="text-3xl font-heading font-bold tracking-wide text-brand-ivory">
          Market Overview
        </h1>
        <p className="text-base text-muted-foreground/80 font-sans max-w-2xl leading-relaxed">
          High-level view of market value, breeding activity, and oracle impact across
          the Secretariat universe.
        </p>
      </header>

      <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border border-sidebar-border/60 bg-card p-6 flex flex-col justify-between shadow-lg relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
            <div className="w-16 h-16 bg-prestige-gold rounded-full blur-2xl" />
          </div>
          <span className="text-xs font-sans font-medium text-prestige-gold-muted uppercase tracking-widest">
            Total Market Value
          </span>
          <div className="mt-2 flex items-baseline justify-between relative z-10">
            <span className="text-3xl font-heading font-bold text-brand-ivory">
              {horses.length ? <AdiDisplay value={totalMarketADI} showSuffix /> : "—"}
            </span>
          </div>
        </div>

        <div className="rounded-lg border border-sidebar-border/60 bg-card p-6 flex flex-col justify-between shadow-lg relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
            <div className="w-16 h-16 bg-brand-ivory rounded-full blur-2xl" />
          </div>
          <span className="text-xs font-sans font-medium text-prestige-gold-muted uppercase tracking-widest">
            Total Horses
          </span>
          <div className="mt-2 flex items-baseline justify-between relative z-10">
            <span className="text-3xl font-heading font-bold text-brand-ivory">
              {horses.length || "—"}
            </span>
          </div>
        </div>

        <div className="rounded-lg border border-sidebar-border/60 bg-card p-6 flex flex-col justify-between shadow-lg relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
            <div className="w-16 h-16 bg-prestige-gold rounded-full blur-2xl" />
          </div>
          <span className="text-xs font-sans font-medium text-prestige-gold-muted uppercase tracking-widest">
            Capital Locked
          </span>
          <div className="mt-2 flex items-baseline justify-between relative z-10">
            <span className="text-3xl font-heading font-bold text-brand-ivory">
              {horses.length ? <AdiDisplay value={capitalLockedADI} showSuffix /> : "—"}
            </span>
            <span className="text-[10px] uppercase text-muted-foreground font-sans tracking-wide self-end mb-1">Breeding Eligible</span>
          </div>
        </div>

        <div className="rounded-lg border border-sidebar-border/60 bg-card p-6 flex flex-col justify-between shadow-lg relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
            <div className="w-16 h-16 bg-terminal-green rounded-full blur-2xl" />
          </div>
          <span className="text-xs font-sans font-medium text-prestige-gold-muted uppercase tracking-widest">
            Active Breeding & Pedigree
          </span>
          <div className="mt-2 flex items-baseline justify-between relative z-10">
            <span className="text-3xl font-heading font-bold text-brand-ivory">
              {activeBreeding}
            </span>
            <span className="text-xs font-sans text-terminal-green bg-terminal-green/10 px-2 py-1 rounded-full border border-terminal-green/20">
              {avgPedigree != null ? `Avg ${avgPedigree}%` : "—"}
            </span>
          </div>
        </div>
      </section>

      <section className="space-y-6">
        <div className="flex items-center justify-between pb-2 border-b border-white/5">
          <h2 className="text-xl font-heading font-semibold text-brand-ivory tracking-wide">
            Market Heatmap
          </h2>
          <span className="text-xs font-sans text-muted-foreground/60 tracking-wider">
            BLOODLINE DEPTH · 24H ORACLE IMPACT
          </span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {heatmapHorses.map((horse) => (
            <div
              key={horse.name}
              className="rounded-lg border border-sidebar-border/40 bg-card/50 hover:bg-card hover:border-prestige-gold/30 p-5 flex flex-col justify-between transition-all duration-300 group"
            >
              <div className="flex items-start justify-between gap-2 mb-4">
                <div>
                  <p className="text-lg font-heading font-medium text-brand-ivory group-hover:text-prestige-gold transition-colors">
                    {horse.name}
                  </p>
                  <p className="text-[10px] text-muted-foreground font-sans tracking-widest uppercase mt-0.5">
                    Token #{horse.tokenId}
                  </p>
                </div>
                {horse.retired ? (
                  <span className="px-2 py-1 rounded text-[10px] font-medium uppercase tracking-wider bg-terminal-amber/10 text-terminal-amber border border-terminal-amber/20">
                    Retired
                  </span>
                ) : horse.injured ? (
                  <span className="px-2 py-1 rounded text-[10px] font-medium uppercase tracking-wider bg-terminal-red/10 text-terminal-red border border-terminal-red/20">
                    Injured
                  </span>
                ) : horse.breedingAvailable ? (
                  <span className="px-2 py-1 rounded text-[10px] font-medium uppercase tracking-wider bg-terminal-green/10 text-terminal-green border border-terminal-green/20">
                    Stud Ready
                  </span>
                ) : null}
              </div>
              <div className="flex items-end justify-between border-t border-white/5 pt-3">
                <span className="text-sm font-sans font-medium text-brand-ivory/90">
                  <AdiDisplay value={horse.valuationADI} showSuffix />
                </span>
                <span className="text-[10px] font-sans text-muted-foreground bg-white/5 px-2 py-0.5 rounded-full">
                  Pedigree {(horse.pedigreeScore / 100).toFixed(1)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-sidebar-border/60 bg-card p-6 space-y-5">
          <h3 className="text-lg font-heading font-semibold text-brand-ivory tracking-wide flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-prestige-gold rounded-full"></span>
            Top Valuations
          </h3>
          <div className="space-y-1">
            {topValuations.map((row) => (
              <div
                key={row.name}
                className="flex items-center justify-between text-sm py-3 px-3 rounded hover:bg-white/5 transition-colors border-b border-white/5 last:border-0"
              >
                <span className="text-brand-ivory/80 font-serif">{row.name}</span>
                <div className="flex items-baseline gap-4">
                  <span className="font-sans font-medium text-prestige-gold">
                    <AdiDisplay value={row.valuationADI} showSuffix />
                  </span>
                  <span className="font-sans text-xs text-muted-foreground w-16 text-right">
                    {(row.pedigreeScore / 100).toFixed(1)}% Purity
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-sidebar-border/60 bg-card p-6 space-y-5">
          <h3 className="text-lg font-heading font-semibold text-brand-ivory tracking-wide flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full"></span>
            Entry Opportunities
          </h3>
          <div className="space-y-1">
            {lowestValuations.map((row) => (
              <div
                key={row.name}
                className="flex items-center justify-between text-sm py-3 px-3 rounded hover:bg-white/5 transition-colors border-b border-white/5 last:border-0"
              >
                <span className="text-brand-ivory/80 font-serif">{row.name}</span>
                <div className="flex items-baseline gap-4">
                  <span className="font-sans font-medium text-brand-ivory/60">
                    <AdiDisplay value={row.valuationADI} showSuffix />
                  </span>
                  <span className="font-sans text-xs text-muted-foreground w-16 text-right">
                    {(row.pedigreeScore / 100).toFixed(1)}% Purity
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
