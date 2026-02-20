"use client";

import Link from "next/link";
import { Trophy } from "lucide-react";
import { PedigreeTree } from "@/components/PedigreeTree";
import type { HorseFullData } from "@/data/mockHorses";

interface BreedingTabProps {
  horse: HorseFullData;
}

export function BreedingTab({ horse }: BreedingTabProps) {
  const { breedingListing, breedingPicks } = horse;

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-white/10 bg-black/20 p-5">
        <h3 className="text-xs font-semibold tracking-[0.2em] text-prestige-gold uppercase mb-4">
          BREEDING LISTING
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <div>
            <p className="text-[10px] font-sans tracking-wider text-muted-foreground uppercase mb-1">
              STUD FEE
            </p>
            <p className="text-lg font-bold">
              <span className="text-prestige-gold">
                {breedingListing.studFee.split(" ")[0]}
              </span>{" "}
              <span className="text-muted-foreground text-sm">
                {breedingListing.studFee.split(" ").slice(1).join(" ")}
              </span>
            </p>
          </div>
          <div>
            <p className="text-[10px] font-sans tracking-wider text-muted-foreground uppercase mb-1">
              REMAINING USES
            </p>
            <p className="text-lg font-bold text-foreground">
              {breedingListing.remainingUses}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-sans tracking-wider text-muted-foreground uppercase mb-1">
              ALLOWLIST
            </p>
            <p className="text-lg font-bold text-terminal-green">
              {breedingListing.allowlist}
            </p>
          </div>
        </div>
        <button
          type="button"
          className="px-4 py-2 rounded-md border border-prestige-gold/50 text-foreground hover:bg-prestige-gold/10 transition-colors text-sm"
        >
          Purchase Breeding Right
        </button>
      </div>

      <div className="rounded-lg border border-white/10 bg-black/20 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Trophy className="h-4 w-4 text-prestige-gold shrink-0" />
          <h3 className="text-xs font-semibold tracking-[0.2em] text-prestige-gold uppercase">
            AI BREEDING ADVISOR
          </h3>
        </div>
        <div className="space-y-3 mb-4">
          {breedingPicks.map((pick) => (
            <div
              key={pick.rank}
              className={`flex items-center justify-between py-3 px-4 rounded-md ${
                pick.rank === 1 ? "bg-white/5 border border-white/10" : ""
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={
                    pick.rank === 1
                      ? "text-prestige-gold font-bold"
                      : "text-muted-foreground"
                  }
                >
                  #{pick.rank}
                </span>
                <span className="text-foreground">{pick.name}</span>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span>
                  Match:{" "}
                  <span className="text-terminal-green font-medium">
                    {pick.match}
                  </span>
                </span>
                <span>
                  Edge:{" "}
                  <span className="text-terminal-green font-medium">
                    +{pick.edge}%
                  </span>
                </span>
                <span>
                  Δ:{" "}
                  <span
                    className={
                      pick.delta >= 0
                        ? "text-terminal-green"
                        : "text-terminal-red"
                    }
                  >
                    {pick.delta >= 0 ? "+" : ""}
                    {pick.delta}
                  </span>
                </span>
                <span
                  className={
                    pick.confidence === "High"
                      ? "text-prestige-gold"
                      : "text-terminal-amber"
                  }
                >
                  {pick.confidence}
                </span>
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-3">
          <Link
            href="/breed"
            className="text-sm text-muted-foreground hover:text-prestige-gold transition-colors"
          >
            Open Stud Book
          </Link>
          <button
            type="button"
            className="px-4 py-2 rounded-md border border-prestige-gold/50 bg-prestige-gold/5 text-foreground hover:bg-prestige-gold/10 transition-colors text-sm font-medium"
          >
            Execute With Approval
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-white/10 bg-black/20 p-5">
        <PedigreeTree
          tokenId={horse.id}
          horseName={horse.name}
          maxDepth={4}
        />
      </div>
    </div>
  );
}
