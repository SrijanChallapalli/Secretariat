"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useAccount, useReadContracts } from "wagmi";
import { formatEther } from "viem";
import { Crown, BarChart3, FolderOpen, Eye, ChevronRight, TrendingUp } from "lucide-react";
import { AdiDisplay } from "@/components/AdiDisplay";
import { mapToHorseHeatmapItem } from "@/lib/on-chain-mapping";
import { MarketHeatmap } from "@/components/market/MarketHeatmap";
import { useHorsesWithListings } from "@/lib/hooks/useHorsesWithListings";
import type { UseHorsesResult, HorseWithListing } from "@/lib/hooks/useHorsesWithListings";
import { addresses, abis } from "@/lib/contracts";
import { formatMoney } from "@/lib/format";

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

/** Demo P&L when no oracle feed */
function demoPnlPct(tokenId: number, pedigree: number): number {
  const seed = (tokenId * 7 + pedigree * 11) % 25;
  return seed - 12;
}

export default function Dashboard() {
  const { address } = useAccount();
  const { horses: horsesWithListings, isLoading, isError } = useHorsesWithListings({ withStatus: true }) as UseHorsesResult;

  const ownerOfCalls =
    address && horsesWithListings.length > 0
      ? horsesWithListings.map(({ tokenId }) => ({
          address: addresses.horseINFT,
          abi: abis.HorseINFT,
          functionName: "ownerOf" as const,
          args: [BigInt(tokenId)] as [bigint],
        }))
      : [];
  const { data: ownershipData } = useReadContracts({ contracts: ownerOfCalls as any });

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

  const dailyStandout = useMemo(() => {
    if (horsesWithListings.length === 0) return null;
    const today = new Date();
    const daySeed = today.getDate() + today.getMonth() * 31;
    const idx = daySeed % horsesWithListings.length;
    return horsesWithListings[idx];
  }, [horsesWithListings]);

  const marketPulse = useMemo(() => {
    if (horses.length === 0) return null;
    const top = topValuations[0];
    const entry = lowestValuations[0];
    const avgPed = avgPedigree ? Number(avgPedigree) : 0;
    const fmt = (v: bigint) => Number(formatEther(v)).toLocaleString(undefined, { maximumFractionDigits: 0 });
    const totalFmt = Number(formatEther(totalMarketADI)).toLocaleString(undefined, { maximumFractionDigits: 0 });
    const lockedFmt = Number(formatEther(capitalLockedADI)).toLocaleString(undefined, { maximumFractionDigits: 0 });
    const summary =
      top && entry
        ? `${top.name} leads at ${fmt(top.valuationADI)} ADI; ${entry.name} offers entry at ${fmt(entry.valuationADI)} ADI.`
        : horses.length
          ? `${horses.length} horses on market · ${totalFmt} ADI total.`
          : null;
    const sentiment =
      avgPed >= 88 && activeBreeding >= 2 ? "bullish" :
      avgPed >= 82 || activeBreeding >= 1 ? "cautiously bullish" :
      horses.length >= 3 ? "neutral" : "consolidating";
    const sentimentReason =
      sentiment === "bullish"
        ? `Strong pedigree (${avgPedigree ?? "—"}% avg) and ${activeBreeding} breeding-eligible horses support demand.`
        : sentiment === "cautiously bullish"
          ? `${activeBreeding} breeding-eligible · ${avgPedigree ?? "—"}% avg pedigree. Entry spread remains attractive.`
          : sentiment === "neutral"
            ? `${horses.length} horses on market. Monitor breeding activity for momentum.`
            : `Thin market. ${totalFmt} ADI total · ${lockedFmt} ADI in breeding.`;
    return { summary, sentiment, sentimentReason, totalFmt, lockedFmt, activeBreeding, avgPedigree };
  }, [horses.length, topValuations, lowestValuations, activeBreeding, avgPedigree, totalMarketADI, capitalLockedADI]);

  const userHoldings = useMemo(() => {
    if (!address || !ownershipData || ownershipData.length !== horsesWithListings.length) return [];
    const myHorseIds = horsesWithListings
      .filter((_, i) => {
        const res = ownershipData[i];
        return res?.status === "success" && res.result && String(res.result).toLowerCase() === address.toLowerCase();
      })
      .map((h) => h.tokenId);
    return horses
      .filter((h) => myHorseIds.includes(h.tokenId))
      .map((h) => ({
        ...h,
        pnlPct: demoPnlPct(h.tokenId, h.pedigreeScore),
      }));
  }, [address, ownershipData, horsesWithListings, horses]);

  const holdingsValue = userHoldings.reduce((acc, h) => acc + h.valuationADI, 0n);
  const avgPnl =
    userHoldings.length > 0
      ? userHoldings.reduce((acc, h) => acc + h.pnlPct, 0) / userHoldings.length
      : 0;

  const agentWatchlist = useMemo(() => {
    const items: { horse: DashboardHorse; action: "BUY" | "SELL" | "WATCH"; reason: string }[] = [];
    const top = topValuations[0];
    const injured = horses.find((h) => h.injured);
    const breeding = horses.filter((h) => h.breedingAvailable && h.pedigreeScore >= 8500);
    if (top && !top.injured) {
      items.push({
        horse: top,
        action: "BUY",
        reason: "Market leader — momentum intact",
      });
    }
    if (injured) {
      const pnl = demoPnlPct(injured.tokenId, injured.pedigreeScore);
      items.push({
        horse: injured,
        action: "SELL",
        reason: "Injury flag — monitor recovery timeline",
      });
    }
    const watchPick = breeding.find((h) => h.tokenId !== top?.tokenId && h.tokenId !== injured?.tokenId) ?? breeding[0];
    if (watchPick && !items.some((x) => x.horse.tokenId === watchPick.tokenId)) {
      items.push({
        horse: watchPick,
        action: "WATCH",
        reason: "Breeding eligible — pedigree catalyst",
      });
    }
    return items.slice(0, 3);
  }, [horses, topValuations]);

  if (isLoading) {
    return (
      <div className="space-y-10 max-w-7xl mx-auto">
        <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          <SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard />
        </section>
        <div className="rounded-lg border border-sidebar-border/60 bg-card p-12 animate-pulse">
          <div className="h-40 bg-white/5 rounded" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-10 max-w-7xl mx-auto">
        <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-8 text-center">
          <p className="text-sm text-red-400">Failed to load on-chain data. Please check your network connection and try again.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10 max-w-7xl mx-auto">
      {dailyStandout && (
        <DailyStandout item={dailyStandout} />
      )}

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

      <section className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        <YourHoldings
          holdings={userHoldings}
          totalValue={holdingsValue}
          avgPnl={avgPnl}
          address={address}
        />
        <AgentWatchlist items={agentWatchlist} />
      </section>

      {marketPulse && (
        <MarketPulse
          summary={marketPulse.summary}
          sentiment={marketPulse.sentiment}
          sentimentReason={marketPulse.sentimentReason}
          totalFmt={marketPulse.totalFmt}
          lockedFmt={marketPulse.lockedFmt}
          activeBreeding={marketPulse.activeBreeding}
          avgPedigree={marketPulse.avgPedigree}
        />
      )}

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

const SENTIMENT_STYLES: Record<string, string> = {
  bullish: "text-terminal-green bg-terminal-green/15 border-terminal-green/30",
  "cautiously bullish": "text-amber-400 bg-amber-500/15 border-amber-500/30",
  neutral: "text-muted-foreground bg-white/10 border-white/20",
  consolidating: "text-muted-foreground bg-white/5 border-white/10",
};

function MarketPulse({
  summary,
  sentiment,
  sentimentReason,
  totalFmt,
  lockedFmt,
  activeBreeding,
  avgPedigree,
}: {
  summary: string;
  sentiment: string;
  sentimentReason: string;
  totalFmt: string;
  lockedFmt: string;
  activeBreeding: number;
  avgPedigree: string | null;
}) {
  return (
    <div className="rounded-lg border border-sidebar-border/60 bg-card p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white/5 border border-white/10">
            <BarChart3 className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="min-w-0">
            <p className="text-sm text-foreground leading-relaxed mb-1">
              {summary}
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {sentimentReason}
            </p>
          </div>
        </div>
        <div className="shrink-0">
          <span
            className={`inline-block text-[10px] font-medium uppercase tracking-widest px-3 py-1.5 rounded-full border ${SENTIMENT_STYLES[sentiment] ?? SENTIMENT_STYLES.neutral}`}
          >
            {sentiment.replace(/([a-z])/, (m) => m.toUpperCase())}
          </span>
        </div>
      </div>
      <div className="flex flex-wrap gap-4 pt-2 border-t border-white/5 text-[11px] text-muted-foreground">
        <span>{totalFmt} ADI total market</span>
        <span>{lockedFmt} ADI in breeding</span>
        <span>{activeBreeding} breeding-eligible</span>
        {avgPedigree != null && <span>Avg {avgPedigree}% pedigree</span>}
      </div>
    </div>
  );
}

type HoldingWithPnl = DashboardHorse & { pnlPct: number };

function YourHoldings({
  holdings,
  totalValue,
  avgPnl,
  address,
}: {
  holdings: HoldingWithPnl[];
  totalValue: bigint;
  avgPnl: number;
  address: string | undefined;
}) {
  const totalNum = Number(formatEther(totalValue));
  const totalFmt = formatMoney(totalNum);
  return (
    <div className="rounded-lg border border-sidebar-border/60 bg-card p-6 space-y-5">
      <div className="flex items-center gap-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/5 border border-white/10">
          <FolderOpen className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-brand-ivory tracking-wide">
            Your Holdings
          </h3>
        </div>
      </div>
      {!address ? (
        <p className="text-sm text-muted-foreground">
          Connect your wallet to see your holdings.
        </p>
      ) : holdings.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No horses owned. Browse the marketplace or breed to acquire.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-[10px] font-sans tracking-wider text-muted-foreground uppercase mb-0.5">Value</p>
              <p className="text-lg font-bold text-foreground">{totalFmt}</p>
            </div>
            <div>
              <p className="text-[10px] font-sans tracking-wider text-muted-foreground uppercase mb-0.5">Avg P&L</p>
              <p className={`text-lg font-bold ${avgPnl >= 0 ? "text-terminal-green" : "text-terminal-red"}`}>
                {avgPnl >= 0 ? "+" : ""}{avgPnl.toFixed(1)}%
              </p>
            </div>
            <div>
              <p className="text-[10px] font-sans tracking-wider text-muted-foreground uppercase mb-0.5">Claimable</p>
              <p className="text-lg font-bold text-foreground">—</p>
            </div>
          </div>
          <div className="space-y-1">
            {holdings.map((h) => {
              const pct = totalNum > 0 ? (Number(formatEther(h.valuationADI)) / totalNum) * 100 : 0;
              return (
                <Link
                  key={h.tokenId}
                  href={`/horse/${h.tokenId}`}
                  className="flex items-center justify-between py-2 px-3 rounded hover:bg-white/5 transition-colors border-b border-white/5 last:border-0"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-prestige-gold/80" />
                    <span className="text-sm text-brand-ivory/90">{h.name}</span>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-muted-foreground">{pct.toFixed(1)}%</span>
                    <span className={h.pnlPct >= 0 ? "text-terminal-green" : "text-terminal-red"}>
                      {h.pnlPct >= 0 ? "+" : ""}{h.pnlPct.toFixed(1)}%
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function AgentWatchlist({
  items,
}: {
  items: { horse: DashboardHorse; action: "BUY" | "SELL" | "WATCH"; reason: string }[];
}) {
  const actionStyles = {
    BUY: "bg-terminal-green/20 text-terminal-green border-terminal-green/40",
    SELL: "bg-terminal-red/20 text-terminal-red border-terminal-red/40",
    WATCH: "bg-amber-500/20 text-amber-400 border-amber-500/40",
  };
  const dotColors = ["bg-prestige-gold", "bg-terminal-red", "bg-sky-500/80"];
  return (
    <div className="rounded-lg border border-sidebar-border/60 bg-card p-6 space-y-5">
      <div className="flex items-center gap-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/5 border border-white/10">
          <Eye className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-brand-ivory tracking-wide">
            Agent Watchlist
          </h3>
        </div>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No watchlist items. Market data loading.
        </p>
      ) : (
        <div className="space-y-3">
          {items.map((item, i) => (
            <Link
              key={item.horse.tokenId}
              href={`/horse/${item.horse.tokenId}`}
              className="flex items-center gap-4 p-3 rounded-lg border border-white/5 hover:bg-white/5 hover:border-prestige-gold/30 transition-all group"
            >
              <div className={`w-2 h-2 rounded-full shrink-0 ${dotColors[i % dotColors.length]}`} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-brand-ivory">{item.horse.name}</span>
                  <span
                    className={`text-[10px] font-medium px-2 py-0.5 rounded border ${actionStyles[item.action]}`}
                  >
                    {item.action}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">{item.reason}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-medium text-foreground">
                  <AdiDisplay value={item.horse.valuationADI} showSuffix />
                </p>
                <p
                  className={`text-xs font-medium ${
                    demoPnlPct(item.horse.tokenId, item.horse.pedigreeScore) >= 0
                      ? "text-terminal-green"
                      : "text-terminal-red"
                  }`}
                >
                  {demoPnlPct(item.horse.tokenId, item.horse.pedigreeScore) >= 0 ? "+" : ""}
                  {demoPnlPct(item.horse.tokenId, item.horse.pedigreeScore).toFixed(1)}%
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-prestige-gold transition-colors shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function parentLabel(id: bigint): string {
  return id > 0n ? `Horse #${id}` : "Founder";
}

function foaledYear(birthTimestamp: bigint): string {
  if (birthTimestamp <= 0n) return "—";
  const year = new Date(Number(birthTimestamp) * 1000).getFullYear();
  return String(year);
}

function DailyStandout({ item }: { item: HorseWithListing }) {
  const { tokenId, raw, listing } = item;
  const name = raw.name?.trim() || `Horse #${tokenId}`;
  const pedigree = raw.pedigreeScore / 100;
  const valuationNum = Number(formatEther(raw.valuationADI));
  const valuationFmt = formatMoney(valuationNum);
  const changePct = demoPnlPct(tokenId, raw.pedigreeScore);
  const sire = parentLabel(raw.sireId);
  const dam = parentLabel(raw.damId);
  const year = foaledYear(raw.birthTimestamp);
  const lineage = `${sire} × ${dam} · ${year}`;
  const desc = raw.injured
    ? "Injury on record — monitor recovery."
    : raw.breedingAvailable
      ? "Breeding eligible · No concerns on record."
      : "View profile for details.";
  const studFee = listing && listing.studFeeADI > 0n
    ? formatMoney(Number(formatEther(listing.studFeeADI)))
    : "—";
  const demand = Math.min(100, 70 + Math.floor(pedigree / 3));
  const risk = raw.injured ? 4 : pedigree >= 90 ? 1 : pedigree >= 80 ? 2 : 3;

  return (
    <Link
      href={`/horse/${tokenId}`}
      className="block rounded-lg border-t-2 border-t-prestige-gold/50 border border-sidebar-border/60 bg-card p-6 shadow-lg relative overflow-hidden group hover:border-prestige-gold/60 transition-all duration-300"
    >
      <div className="flex items-start gap-4 mb-4">
        <Crown className="h-5 w-5 text-prestige-gold shrink-0 mt-0.5" />
        <div>
          <p className="text-[10px] font-mono tracking-[0.2em] text-muted-foreground uppercase mb-1">
            Daily Standout
          </p>
          <h3 className="text-2xl font-heading font-bold text-foreground group-hover:text-prestige-gold transition-colors">
            {name}
          </h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            {lineage}
          </p>
          <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
            {desc}
          </p>
        </div>
        <div className="ml-auto text-right shrink-0">
          <p className="text-2xl font-heading font-bold text-foreground">
            {valuationFmt}
          </p>
          <p className={`text-sm font-medium flex items-center justify-end gap-1 ${changePct >= 0 ? "text-terminal-green" : "text-terminal-red"}`}>
            <TrendingUp className={`h-4 w-4 ${changePct < 0 ? "rotate-180" : ""}`} />
            {changePct >= 0 ? "+" : ""}{changePct.toFixed(1)}%
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-white/5">
        <div className="flex flex-wrap gap-6 text-[11px] font-mono">
          <span className="text-muted-foreground">
            RECORD <span className="font-semibold text-foreground">—</span>
          </span>
          <span className="text-muted-foreground">
            PEDIGREE <span className="font-semibold text-foreground">{pedigree.toFixed(0)}/100</span>
          </span>
          <span className="text-muted-foreground">
            STUD <span className="font-semibold text-foreground">{studFee}</span>
          </span>
        </div>
        <div className="text-[11px] font-mono text-muted-foreground">
          Demand {demand}/100 · Risk {risk}/5
        </div>
      </div>
    </Link>
  );
}

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
      <div className="mt-2 flex flex-col gap-1 relative z-10">
        <span className="text-3xl font-heading font-bold text-brand-ivory">{value}</span>
        {sublabel && (
          <span className="text-[10px] uppercase text-muted-foreground font-sans tracking-wide">
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
