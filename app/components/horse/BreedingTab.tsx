"use client";

import Link from "next/link";
import { Trophy, Dna } from "lucide-react";
import { PedigreeTree } from "@/components/PedigreeTree";
import type { HorseFullData } from "@/data/mockHorses";

interface BreedingTabProps {
  horse: HorseFullData;
}

function isStallion(horse: HorseFullData): boolean {
  const { breedingListing } = horse;
  return (
    breedingListing.studFee !== "—" &&
    breedingListing.remainingUses > 0
  );
}

export function BreedingTab({ horse }: BreedingTabProps) {
  const { breedingListing } = horse;
  const stallion = isStallion(horse);
  const breedHref = stallion
    ? `/breed?stallion=${horse.id}&advisor=1`
    : `/breed?mare=${horse.id}&advisor=1`;

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-sidebar-border/60 bg-card p-5">
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
        {stallion && (
          <Link
            href={breedHref}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-prestige-gold/50 text-foreground hover:bg-prestige-gold/10 transition-colors text-sm"
          >
            Purchase Breeding Right
          </Link>
        )}
      </div>

      <div className="rounded-lg border border-sidebar-border/60 bg-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Trophy className="h-4 w-4 text-prestige-gold shrink-0" />
          <h3 className="text-xs font-semibold tracking-[0.2em] text-prestige-gold uppercase">
            AI BREEDING ADVISOR
          </h3>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          {stallion
            ? "Breed your mare with this stallion. Go to the Breeding Lab to select your mare and get AI pairing recommendations."
            : "Breed this mare with a stallion. Go to the Breeding Lab to get AI pairing recommendations and execute."}
        </p>
        <Link
          href={breedHref}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md border border-prestige-gold/70 bg-gradient-to-r from-prestige-gold/15 to-prestige-gold/5 text-prestige-gold font-medium hover:from-prestige-gold/25 hover:to-prestige-gold/10 transition-all text-sm"
        >
          <Dna className="h-4 w-4" />
          {stallion ? "Breed with this stallion" : "Breed this mare"}
        </Link>
      </div>

      <div className="rounded-lg border border-sidebar-border/60 bg-card p-5 overflow-hidden">
        <PedigreeTree
          tokenId={horse.id}
          horseName={horse.name}
          maxDepth={3}
        />
      </div>
    </div>
  );
}
