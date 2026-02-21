"use client";

import { Crown } from "lucide-react";
import { formatMoneyCompact, formatPct, pctColorClass } from "@/lib/format";

interface MarketHeroProps {
  totalMarketCap: number;
  avg24hPct: number;
  topMoverName: string;
}

export function MarketHero({
  totalMarketCap,
  avg24hPct,
  topMoverName,
}: MarketHeroProps) {
  return (
    <div className="rounded-lg border border-sidebar-border/60 bg-card p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.03)] relative overflow-hidden">
      <div className="absolute right-0 top-0 w-48 h-48 opacity-5 pointer-events-none">
        <svg viewBox="0 0 100 100" className="w-full h-full text-prestige-gold">
          <path d="M50 10 Q70 30 60 50 Q50 70 30 60 Q10 50 20 30 Q30 10 50 10" fill="currentColor" />
        </svg>
      </div>
      <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Crown className="h-4 w-4 text-prestige-gold shrink-0" />
            <span className="text-[10px] font-sans tracking-[0.2em] text-muted-foreground uppercase">
              LIVE MARKETPLACE
            </span>
          </div>
          <h1 className="text-3xl font-heading font-bold text-foreground tracking-wide">
            The Ring
          </h1>
          <p className="text-sm text-muted-foreground max-w-md">
            Browse, compare, and acquire fractional ownership in thoroughbred
            assets.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-6 lg:gap-10">
          <div>
            <p className="text-[10px] font-sans tracking-wider text-muted-foreground uppercase mb-1">
              TOTAL MARKET CAP
            </p>
            <p className="text-2xl font-bold text-foreground">
              {formatMoneyCompact(totalMarketCap)}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-sans tracking-wider text-muted-foreground uppercase mb-1">
              AVG 24H
            </p>
            <p className={`text-2xl font-bold flex items-center gap-1 ${pctColorClass(avg24hPct)}`}>
              {avg24hPct >= 0 ? "↗" : "↘"} {formatPct(avg24hPct)}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-sans tracking-wider text-muted-foreground uppercase mb-1">
              TOP MOVER
            </p>
            <p className="text-xl font-semibold text-terminal-green">
              {topMoverName}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
