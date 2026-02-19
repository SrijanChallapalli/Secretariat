"use client";

import Link from "next/link";
import { formatMoney, formatPercent, pctColorClass } from "@/lib/format";
import type { HorseHeatmapItem } from "@/data/mockHorses";

const RISK_STYLES = {
  Low: "text-terminal-green",
  Med: "text-terminal-amber",
  High: "text-terminal-red",
} as const;

interface HeatmapTileProps {
  horse: HorseHeatmapItem;
}

export function HeatmapTile({ horse }: HeatmapTileProps) {
  const riskClass = RISK_STYLES[horse.risk];
  const absPct = Math.abs(horse.changePct);
  // Scale opacity with magnitude: ~5% at 1%, ~15% at 5%, ~30% at 15%+, cap at 35%
  const tintOpacity = Math.min(0.35, 0.02 + absPct * 0.018);
  const tintStyle =
    horse.changePct > 0
      ? { backgroundColor: `hsl(160 60% 40% / ${tintOpacity})` }
      : horse.changePct < 0
        ? { backgroundColor: `hsl(0 70% 50% / ${tintOpacity})` }
        : undefined;

  return (
    <Link
      href={`/horse/${horse.id}`}
      className="group relative block overflow-hidden rounded-lg border border-white/10 bg-black/20 p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-prestige-gold/30 hover:shadow-[0_0_20px_rgba(212,175,55,0.15)]"
    >
      {/* Tint overlay: intensity scales with magnitude of change */}
      {tintStyle && (
        <div
          className="absolute inset-0 pointer-events-none rounded-lg"
          style={tintStyle}
          aria-hidden
        />
      )}
      <div className="relative z-10">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-foreground group-hover:text-prestige-gold transition-colors">
            {horse.name}
          </p>
        </div>
        <span
          className={`shrink-0 text-[10px] font-medium uppercase tracking-wider ${riskClass}`}
        >
          {horse.risk}
        </span>
      </div>
      <div className="space-y-1.5 mb-4">
        <p className="text-[11px] text-muted-foreground uppercase tracking-wider">
          {horse.bloodline1}
        </p>
        <p className="text-[11px] text-muted-foreground/80">{horse.bloodline2}</p>
      </div>
      <div className="flex items-end justify-between border-t border-white/5 pt-3">
        <span className="text-base font-bold text-foreground">
          {formatMoney(horse.valuation)}
        </span>
        <span className={`text-sm font-medium ${pctColorClass(horse.changePct)}`}>
          {formatPercent(horse.changePct, true)}
        </span>
      </div>
      </div>
    </Link>
  );
}
