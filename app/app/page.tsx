"use client";

import { useMemo } from "react";
import { formatEther } from "viem";
import { AdiDisplay } from "@/components/AdiDisplay";
import { mapToHorseHeatmapItem } from "@/lib/on-chain-mapping";
import { MarketHeatmap } from "@/components/market/MarketHeatmap";
import { useHorsesWithListings } from "@/lib/hooks/useHorsesWithListings";
import type { UseHorsesResult } from "@/lib/hooks/useHorsesWithListings";

type DashboardHorse = {
  tokenId: number;
  name: string;
  valuationADI: bigint;
  pedigreeScore: number;
  breedingAvailable: boolean;
  injured: boolean;
  retired: boolean;
};

function SkeletonCard() {
  return (
    <div className="rounded-lg border border-sidebar-border/60 bg-card p-6 animate-pulse">
      <div className="h-3 w-24 bg-white/10 rounded mb-4" />
      <div className="h-8 w-32 bg-white/10 rounded" />
    </div>
  );
}

export default function Dashboard() {
  const { horses: horsesWithListings, isLoading, isError } = useHorsesWithListings({ withStatus: true }) as UseHorsesResult;

  const horses = useMemo<DashboardHorse[]>(() => {
    return horsesWithListings.map(({ tokenId, raw }) => ({
      tokenId,
      name: raw.name || `Horse #${tokenId}`,
      valuationADI: raw.valuationADI,
      pedigreeScore: raw.pedigreeScore,
      breedingAvailable: raw.breedingAvailable,
      injured: raw.injured,
      retired: raw.retired,
    }));
  }, [horsesWithListings]);

  const totalMarketADI = horses.reduce((acc, h) => acc + h.valuationADI, 0n);
  const totalMarketFormatted = horses.length ? `${formatEther(totalMarketADI)} ADI` : "—";

  const activeBreeding = horses.filter((h) => h.breedingAvailable).length;
  const capitalLockedADI = horses
    .filter((h) => h.breedingAvailable)
    .reduce((acc, h) => acc + h.valuationADI, 0n);
  const capitalLockedFormatted = horses.length ? `${formatEther(capitalLockedADI)} ADI` : "—";

  const avgPedigree =
    horses.length > 0
      ? (horses.reduce((acc, h) => acc + h.pedigreeScore, 0) / horses.length / 100).toFixed(1)
      : null;

  const sortedByVal = [...horses].sort((a, b) =>
    a.valuationADI === b.valuationADI ? 0 : a.valuationADI > b.valuationADI ? -1 : 1
  );
  const heatmapHorses = useMemo(
    () =>
      horsesWithListings.map(({ tokenId, raw, listing }) =>
        mapToHorseHeatmapItem(tokenId, raw, listing)
      ),
    [horsesWithListings]
  );
  const topValuations = sortedByVal.slice(0, 4);
  const lowestValuations = sortedByVal.slice(-4).reverse();

  if (isLoading) {
    return (
      <div className="space-y-10 max-w-7xl mx-auto">
        <header className="space-y-3 pb-6 border-b border-white/5">
          <h1 className="text-3xl font-heading font-bold tracking-wide text-brand-ivory">
            Market Overview
          </h1>
          <p className="text-base text-muted-foreground/80 font-sans max-w-2xl leading-relaxed">
            Loading on-chain data…
          </p>
        </header>
        <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          <SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard />
        </section>
        <div className="rounded-lg border border-white/10 bg-black/20 p-12 animate-pulse">
          <div className="h-40 bg-white/5 rounded" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-10 max-w-7xl mx-auto">
        <header className="space-y-3 pb-6 border-b border-white/5">
          <h1 className="text-3xl font-heading font-bold tracking-wide text-brand-ivory">
            Market Overview
          </h1>
        </header>
        <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-8 text-center">
          <p className="text-sm text-red-400">Failed to load on-chain data. Please check your network connection and try again.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10 max-w-7xl mx-auto">
      <header className="space-y-3 pb-6 border-b border-white/5">
        <h1 className="text-3xl font-heading font-bold tracking-wide text-brand-ivory">
          Market Overview
        </h1>
        <p className="text-base text-muted-foreground/80 font-sans max-w-2xl leading-relaxed">
          High-level view of market value, breeding activity, and oracle impact across the
          Secretariat universe.
        </p>
      </header>

      <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total Market Value"
          value={horses.length ? <AdiDisplay value={totalMarketADI} showSuffix /> : "—"}
          accent="prestige-gold"
        />
        <StatCard
          label="Total Horses"
          value={horses.length || "—"}
          accent="brand-ivory"
        />
        <StatCard
          label="Capital Locked"
          value={horses.length ? <AdiDisplay value={capitalLockedADI} showSuffix /> : "—"}
          accent="prestige-gold"
          sublabel="Breeding Eligible"
        />
        <StatCard
          label="Active Breeding & Pedigree"
          value={
            <>
              {activeBreeding}
              <span className="text-xs font-sans text-terminal-green bg-terminal-green/10 px-2 py-1 rounded-full border border-terminal-green/20 ml-2">
                {avgPedigree != null ? `Avg ${avgPedigree}%` : "—"}
              </span>
            </>
          }
          accent="terminal-green"
        />
      </section>

      <section className="space-y-6">
        <MarketHeatmap horses={heatmapHorses} />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <ValuationList title="Top Valuations" items={topValuations} highlight />
        <ValuationList title="Entry Opportunities" items={lowestValuations} />
      </section>
    </div>
  );
}

const ACCENT_CLASSES: Record<string, string> = {
  "prestige-gold": "bg-prestige-gold",
  "brand-ivory": "bg-brand-ivory",
  "terminal-green": "bg-terminal-green",
};

function StatCard({
  label,
  value,
  accent,
  sublabel,
}: {
  label: string;
  value: React.ReactNode;
  accent: keyof typeof ACCENT_CLASSES;
  sublabel?: string;
}) {
  return (
    <div className="rounded-lg border border-sidebar-border/60 bg-card p-6 flex flex-col justify-between shadow-lg relative overflow-hidden group">
      <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
        <div className={`w-16 h-16 ${ACCENT_CLASSES[accent]} rounded-full blur-2xl`} />
      </div>
      <span className="text-xs font-sans font-medium text-prestige-gold-muted uppercase tracking-widest">
        {label}
      </span>
      <div className="mt-2 flex items-baseline justify-between relative z-10">
        <span className="text-3xl font-heading font-bold text-brand-ivory">{value}</span>
        {sublabel && (
          <span className="text-[10px] uppercase text-muted-foreground font-sans tracking-wide self-end mb-1">
            {sublabel}
          </span>
        )}
      </div>
    </div>
  );
}

function ValuationList({
  title,
  items,
  highlight,
}: {
  title: string;
  items: DashboardHorse[];
  highlight?: boolean;
}) {
  return (
    <div className="rounded-lg border border-sidebar-border/60 bg-card p-6 space-y-5">
      <h3 className="text-lg font-heading font-semibold text-brand-ivory tracking-wide flex items-center gap-2">
        <span
          className={`w-1.5 h-1.5 rounded-full ${highlight ? "bg-prestige-gold" : "bg-muted-foreground"}`}
        />
        {title}
      </h3>
      <div className="space-y-1">
        {items.map((row) => (
          <div
            key={row.name}
            className="flex items-center justify-between text-sm py-3 px-3 rounded hover:bg-white/5 transition-colors border-b border-white/5 last:border-0"
          >
            <span className="text-brand-ivory/80 font-serif">{row.name}</span>
            <div className="flex items-baseline gap-4">
              <span
                className={`font-sans font-medium ${highlight ? "text-prestige-gold" : "text-brand-ivory/60"}`}
              >
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
  );
}
