"use client";

import { useState } from "react";
import { HeatmapTile } from "./HeatmapTile";
import type { HorseHeatmapItem } from "@/data/mockHorses";

const PAGE_SIZE = 12;

interface MarketHeatmapProps {
  horses: HorseHeatmapItem[];
}

export function MarketHeatmap({ horses }: MarketHeatmapProps) {
  const [page, setPage] = useState(0);
  const totalPages = Math.ceil(horses.length / PAGE_SIZE);
  const visible = horses.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold tracking-[0.2em] text-prestige-gold uppercase">
          MARKET HEATMAP
        </h2>
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
              className="px-2 py-1 text-[10px] rounded border border-white/20 text-muted-foreground hover:bg-white/10 transition-colors disabled:opacity-30"
            >
              ←
            </button>
            <span className="text-[10px] text-muted-foreground">
              {page + 1}/{totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
              className="px-2 py-1 text-[10px] rounded border border-white/20 text-muted-foreground hover:bg-white/10 transition-colors disabled:opacity-30"
            >
              →
            </button>
          </div>
        )}
      </div>
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
        {visible.map((horse) => (
          <HeatmapTile key={horse.id} horse={horse} />
        ))}
      </div>
    </section>
  );
}
