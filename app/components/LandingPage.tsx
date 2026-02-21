"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";

export function LandingPage() {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-background text-foreground selection:bg-prestige-gold/30 overflow-hidden">
      {/* Radial glow behind the title */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-prestige-gold/[0.04] blur-[120px] pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center gap-8 landing-entrance">
        {/* Gold accent bar */}
        <div className="h-12 w-[2px] bg-gradient-to-b from-transparent via-prestige-gold to-transparent opacity-60" />

        {/* Title block */}
        <div className="flex flex-col items-center gap-3">
          <h1 className="font-heading text-6xl sm:text-7xl md:text-8xl font-bold tracking-[0.12em] text-brand-ivory glow-gold">
            SECRETARIAT
          </h1>
          <div className="h-px w-48 bg-gradient-to-r from-transparent via-prestige-gold/50 to-transparent" />
          <p className="font-serif text-lg sm:text-xl text-muted-foreground tracking-wide">
            Thoroughbred RWA Marketplace
          </p>
        </div>

        {/* Connect wallet */}
        <div className="mt-4">
          <ConnectButton label="Connect Wallet" />
        </div>

        {/* Establishment tag */}
        <p className="text-[10px] font-sans tracking-[0.25em] text-prestige-gold-muted uppercase mt-2">
          Est. 2026 &middot; Decentralized Equine Assets
        </p>
      </div>

      {/* Bottom gold shimmer line */}
      <div className="absolute bottom-0 left-0 right-0 h-px gold-shimmer" />
    </div>
  );
}
