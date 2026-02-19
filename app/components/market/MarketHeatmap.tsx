"use client";

import { HeatmapTile } from "./HeatmapTile";
import type { HorseHeatmapItem } from "@/data/mockHorses";

interface MarketHeatmapProps {
  horses: HorseHeatmapItem[];
}

export function MarketHeatmap({ horses }: MarketHeatmapProps) {
  return (
    <section className="space-y-4">
      <h2 className="text-xs font-semibold tracking-[0.2em] text-prestige-gold uppercase">
        MARKET HEATMAP
      </h2>
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
        {horses.map((horse) => (
          <HeatmapTile key={horse.id} horse={horse} />
        ))}
      </div>
    </section>
  );
}
