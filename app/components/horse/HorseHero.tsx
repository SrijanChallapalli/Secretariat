"use client";

import Link from "next/link";
import { formatMoney, formatPercent, shortenAddress, pctColorClass } from "@/lib/format";
import type { HorseDetail } from "@/data/mockHorses";
import { Zap, BookOpen } from "lucide-react";

const COLOR_MAP: Record<string, string> = {
  blue: "bg-blue-500",
  purple: "bg-purple-500",
  orange: "bg-orange-500",
  grey: "bg-gray-500",
  red: "bg-red-500",
  teal: "bg-teal-500",
  green: "bg-green-500",
  "dark-orange": "bg-amber-700",
};

interface HorseHeroProps {
  horse: HorseDetail;
  onBuyShares?: () => void;
  onPurchaseBreedingRight?: () => void;
  onOpenStudBook?: () => void;
}

export function HorseHero({
  horse,
  onBuyShares,
  onPurchaseBreedingRight,
  onOpenStudBook,
}: HorseHeroProps) {
  const dotColor = COLOR_MAP[horse.color] ?? "bg-gray-500";

  return (
    <div className="space-y-6">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-prestige-gold transition-colors"
      >
        ← Back
      </Link>

      <div className="rounded-lg border border-white/10 bg-black/20 p-6 space-y-4">
        <p className="text-[10px] font-sans tracking-[0.2em] text-muted-foreground uppercase">
          REGISTERED THOROUGHBRED
        </p>
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <h1 className="text-3xl font-heading font-bold text-foreground">
            {horse.name}
          </h1>
          <div className="text-right shrink-0">
            <p className="text-2xl font-bold text-foreground">
              {formatMoney(horse.valuation)}
            </p>
            <p className={`text-sm font-medium ${pctColorClass(horse.changePct)}`}>
              ↑ {formatPercent(horse.changePct, true)}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          <span className="font-mono">{shortenAddress(horse.ownerAddress)}</span>
          <span className="text-terminal-green">
            Soundness {horse.soundness}/{horse.soundnessMax}
          </span>
          <span className="text-prestige-gold">Pedigree {horse.pedigree}</span>
          <div className={`h-2 w-2 rounded-full ${dotColor}`} aria-hidden />
        </div>
        <div className="flex flex-wrap gap-3 pt-2">
          <button
            type="button"
            onClick={onBuyShares}
            className="px-5 py-2.5 rounded-md bg-prestige-gold text-background font-medium hover:bg-prestige-gold/90 transition-colors"
          >
            Buy Shares
          </button>
          <button
            type="button"
            onClick={onPurchaseBreedingRight}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-prestige-gold/50 text-foreground hover:bg-prestige-gold/10 transition-colors"
          >
            <Zap className="h-3.5 w-3.5" />
            Purchase Breeding Right
          </button>
          <Link
            href="/breed"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-prestige-gold/50 text-foreground hover:bg-prestige-gold/10 transition-colors"
          >
            <BookOpen className="h-3.5 w-3.5" />
            Open Stud Book
          </Link>
        </div>
      </div>
    </div>
  );
}
