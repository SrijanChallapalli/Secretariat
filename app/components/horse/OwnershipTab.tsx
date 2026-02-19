"use client";

import Link from "next/link";
import type { HorseFullData } from "@/data/mockHorses";

interface OwnershipTabProps {
  horse: HorseFullData;
}

export function OwnershipTab({ horse }: OwnershipTabProps) {
  // TODO: Wire to vault/ownership data when contracts ready
  const vaultData = {
    sharesOutstanding: "10,000",
    yourShares: "150",
    sharePrice: "$320",
    revenueClaimable: "$2,400",
    estYield: "8.2%",
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-white/10 bg-black/20 p-5">
        <h3 className="text-xs font-semibold tracking-[0.2em] text-prestige-gold uppercase mb-4">
          VAULT
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-4">
          <div>
            <p className="text-[10px] font-sans tracking-wider text-muted-foreground uppercase mb-1">
              SHARES OUTSTANDING
            </p>
            <p className="text-lg font-bold text-foreground">
              {vaultData.sharesOutstanding}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-sans tracking-wider text-muted-foreground uppercase mb-1">
              YOUR SHARES
            </p>
            <p className="text-lg font-bold text-foreground">
              {vaultData.yourShares}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-sans tracking-wider text-muted-foreground uppercase mb-1">
              SHARE PRICE
            </p>
            <p className="text-lg font-bold text-foreground">
              {vaultData.sharePrice}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-sans tracking-wider text-muted-foreground uppercase mb-1">
              REVENUE CLAIMABLE
            </p>
            <p className="text-lg font-bold text-foreground">
              {vaultData.revenueClaimable}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-sans tracking-wider text-muted-foreground uppercase mb-1">
              EST. YIELD
            </p>
            <p className="text-lg font-bold text-foreground">
              {vaultData.estYield}
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            className="px-4 py-2 rounded-md border border-prestige-gold/50 text-foreground hover:bg-prestige-gold/10 transition-colors text-sm"
          >
            Buy Shares
          </button>
          <button
            type="button"
            className="text-sm text-muted-foreground hover:text-prestige-gold transition-colors"
          >
            Claim Revenue
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-white/10 bg-black/20 p-5">
        <h3 className="text-xs font-semibold tracking-[0.2em] text-prestige-gold uppercase mb-4">
          TRADE FLOW
        </h3>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full border-2 border-prestige-gold bg-prestige-gold/10 flex items-center justify-center text-prestige-gold text-sm font-bold">
              1
            </div>
            <span className="text-sm text-prestige-gold font-medium">
              Approve ADI
            </span>
          </div>
          <div className="h-px w-8 bg-white/20" />
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full border border-white/30 flex items-center justify-center text-muted-foreground text-sm">
              2
            </div>
            <span className="text-sm text-muted-foreground">Buy Shares</span>
          </div>
          <div className="h-px w-8 bg-white/20" />
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full border border-white/30 flex items-center justify-center text-muted-foreground text-sm">
              3
            </div>
            <span className="text-sm text-muted-foreground">
              Confirm Receipt
            </span>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-white/10 bg-black/20 p-5">
        <h3 className="text-xs font-semibold tracking-[0.2em] text-prestige-gold uppercase mb-4">
          TRANSACTIONS
        </h3>
        <p className="text-sm text-muted-foreground">
          No recent transactions.{" "}
          <Link href={`/vault/${horse.id}`} className="text-prestige-gold hover:underline">
            View vault
          </Link>
        </p>
      </div>
    </div>
  );
}
