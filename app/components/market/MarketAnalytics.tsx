"use client";

import { BarChart3, TrendingUp, Shield, Dna, Zap, FileText, Search } from "lucide-react";
import { formatMoneyCompact } from "@/lib/format";
import { Input } from "@/components/ui/input";
import type { MarketAnalytics } from "@/lib/market-analytics";

interface MarketAnalyticsProps {
  analytics: MarketAnalytics | null;
  isLoading?: boolean;
  count?: number;
  search?: string;
  onSearchChange?: (value: string) => void;
}

export function MarketAnalyticsSection({ analytics, isLoading, count = 0, search = "", onSearchChange }: MarketAnalyticsProps) {
  const toolbar = (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
      <div className="flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-prestige-gold" />
        <span className="text-[10px] font-sans tracking-[0.2em] text-muted-foreground uppercase">
          Market Analytics
        </span>
      </div>
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <span className="text-[10px] font-sans tracking-[0.2em] text-muted-foreground uppercase">
          {count} HORSES LISTED
        </span>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
          <Input
            placeholder="Search by name..."
            value={search}
            onChange={(e) => onSearchChange?.(e.target.value)}
            className="h-9 pl-10 bg-white/5 border-white/10 text-sm font-sans text-brand-ivory placeholder:text-muted-foreground/40 rounded-md focus:bg-white/10 focus:border-white/20 transition-all"
          />
        </div>
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div className="rounded-lg border border-sidebar-border/60 bg-card p-6 animate-pulse">
        {toolbar}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-20 bg-white/5 rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="rounded-lg border border-sidebar-border/60 bg-card p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.03)]">
        {toolbar}
      </div>
    );
  }

  const { marketBreadth, valuationDistribution, pedigreeDistribution, riskBreakdown, breedingActivity, oracleEventSummary } = analytics;

  return (
    <div className="rounded-lg border border-sidebar-border/60 bg-card p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.03)]">
      {toolbar}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <div className="rounded border border-white/5 bg-white/5 p-3">
          <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
            <TrendingUp className="h-3 w-3" />
            <span className="text-[10px] uppercase tracking-wider">Market Breadth</span>
          </div>
          <p className="text-sm">
            <span className="text-terminal-green">{marketBreadth.up} up</span>
            <span className="text-muted-foreground mx-1">·</span>
            <span className="text-terminal-red">{marketBreadth.down} down</span>
            <span className="text-muted-foreground mx-1">·</span>
            <span className="text-muted-foreground">{marketBreadth.unchanged} flat</span>
          </p>
        </div>
        <div className="rounded border border-white/5 bg-white/5 p-3">
          <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
            <BarChart3 className="h-3 w-3" />
            <span className="text-[10px] uppercase tracking-wider">Valuation Range</span>
          </div>
          <p className="text-sm text-foreground">
            {formatMoneyCompact(valuationDistribution.min)} – {formatMoneyCompact(valuationDistribution.max)}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Median {formatMoneyCompact(valuationDistribution.median)}</p>
        </div>
        <div className="rounded border border-white/5 bg-white/5 p-3">
          <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
            <Dna className="h-3 w-3" />
            <span className="text-[10px] uppercase tracking-wider">Pedigree</span>
          </div>
          <p className="text-sm text-foreground">
            Avg {pedigreeDistribution.avg.toFixed(1)}% · {pedigreeDistribution.above90} ≥90 · {pedigreeDistribution.above85} ≥85
          </p>
        </div>
        <div className="rounded border border-white/5 bg-white/5 p-3">
          <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
            <Shield className="h-3 w-3" />
            <span className="text-[10px] uppercase tracking-wider">Risk</span>
          </div>
          <p className="text-sm">
            <span className="text-terminal-green">{riskBreakdown.sound} sound</span>
            <span className="text-muted-foreground mx-1">·</span>
            <span className="text-terminal-amber">{riskBreakdown.monitor} monitor</span>
            <span className="text-muted-foreground mx-1">·</span>
            <span className="text-terminal-red">{riskBreakdown.caution} caution</span>
          </p>
        </div>
        <div className="rounded border border-white/5 bg-white/5 p-3">
          <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
            <Zap className="h-3 w-3" />
            <span className="text-[10px] uppercase tracking-wider">Breeding</span>
          </div>
          <p className="text-sm text-foreground">
            {breedingActivity.listed} listed · {formatMoneyCompact(breedingActivity.totalStudFee)} total stud fee
          </p>
        </div>
        <div className="rounded border border-white/5 bg-white/5 p-3">
          <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
            <FileText className="h-3 w-3" />
            <span className="text-[10px] uppercase tracking-wider">Oracle (24h/7d)</span>
          </div>
          <p className="text-sm text-foreground">
            {oracleEventSummary.raceResults} races · {oracleEventSummary.injuries} injuries · {oracleEventSummary.news} news
          </p>
        </div>
      </div>
    </div>
  );
}
