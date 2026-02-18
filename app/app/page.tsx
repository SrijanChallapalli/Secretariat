"use client";

import { useMemo } from "react";
import { useReadContracts } from "wagmi";
import { addresses, abis } from "@/lib/contracts";
import { formatEther } from "viem";

const HORSE_IDS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

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
    return (
      data
        .map((c, idx) => {
          if (c.status !== "success" || !c.result) return null;
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
        .filter(Boolean) as DashboardHorse[]
    );
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
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-wide text-foreground">
          Market overview
        </h1>
        <p className="text-sm text-muted-foreground">
          High-level view of market value, breeding activity, and oracle impact across
          the Secretariat universe.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-sm border border-border bg-card px-4 py-3 flex flex-col justify-between">
          <span className="text-[11px] font-mono text-muted-foreground uppercase tracking-wide">
            Total market value
          </span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-xl font-semibold text-foreground">
              {totalMarketFormatted}
            </span>
          </div>
        </div>
        <div className="rounded-sm border border-border bg-card px-4 py-3 flex flex-col justify-between">
          <span className="text-[11px] font-mono text-muted-foreground uppercase tracking-wide">
            Total horses
          </span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-xl font-semibold text-foreground">
              {horses.length || "—"}
            </span>
          </div>
        </div>
        <div className="rounded-sm border border-border bg-card px-4 py-3 flex flex-col justify-between">
          <span className="text-[11px] font-mono text-muted-foreground uppercase tracking-wide">
            Capital locked (breeding-eligible)
          </span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-xl font-semibold text-foreground">
              {capitalLockedFormatted}
            </span>
          </div>
        </div>
        <div className="rounded-sm border border-border bg-card px-4 py-3 flex flex-col justify-between">
          <span className="text-[11px] font-mono text-muted-foreground uppercase tracking-wide">
            Active breeding &amp; pedigree
          </span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-xl font-semibold text-foreground">
              {activeBreeding}
            </span>
            <span className="text-xs font-mono text-muted-foreground">
              {avgPedigree != null ? `Avg pedigree ${avgPedigree}%` : "—"}
            </span>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground tracking-wide">
            Market heatmap
          </h2>
          <span className="text-[11px] font-mono text-muted-foreground">
            BD: bloodline depth · %: 24h oracle impact
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {heatmapHorses.map((horse) => (
            <div
              key={horse.name}
              className="rounded-sm border border-border bg-card px-4 py-3 flex flex-col justify-between"
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {horse.name}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Token #{horse.tokenId}
                  </p>
                </div>
                {horse.retired ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-terminal-amber/10 text-terminal-amber">
                    Retired
                  </span>
                ) : horse.injured ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-terminal-red/10 text-terminal-red">
                    Injured
                  </span>
                ) : horse.breedingAvailable ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-terminal-green/10 text-terminal-green">
                    Breeding
                  </span>
                ) : null}
              </div>
              <div className="mt-3 flex items-baseline justify-between">
                <span className="text-sm font-mono text-foreground">
                  {formatEther(horse.valuationADI)} ADI
                </span>
                <span className="text-xs font-mono text-muted-foreground">
                  Pedigree {(horse.pedigreeScore / 100).toFixed(1)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-sm border border-border bg-card p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground tracking-wide">
            Top valuations
          </h3>
          <div className="space-y-2">
            {topValuations.map((row) => (
              <div
                key={row.name}
                className="flex items-center justify-between text-sm"
              >
                <span className="text-muted-foreground">{row.name}</span>
                <div className="flex items-baseline gap-4">
                  <span className="font-mono text-foreground">
                    {formatEther(row.valuationADI)} ADI
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">
                    Pedigree {(row.pedigreeScore / 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-sm border border-border bg-card p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground tracking-wide">
            Lowest valuations
          </h3>
          <div className="space-y-2">
            {lowestValuations.map((row) => (
              <div
                key={row.name}
                className="flex items-center justify-between text-sm"
              >
                <span className="text-muted-foreground">{row.name}</span>
                <div className="flex items-baseline gap-4">
                  <span className="font-mono text-foreground">
                    {formatEther(row.valuationADI)} ADI
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">
                    Pedigree {(row.pedigreeScore / 100).toFixed(1)}%
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
