"use client";

interface HorseHeroProps {
  horse: any;
  onBuyShares?: () => void;
  onPurchaseBreedingRight?: () => void;
}

export function HorseHero({ horse, onBuyShares, onPurchaseBreedingRight }: HorseHeroProps) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-5">
      <h2 className="text-lg font-semibold">{horse?.name || `Horse #${horse?.id}`}</h2>
    </div>
  );
}
