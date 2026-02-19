"use client";

import { shortenHash } from "@/lib/format";

interface ModelBundleCardProps {
  bundleSizeMb: number;
  filesCount: number;
  rootHash: string;
  lastUpdated: string;
}

export function ModelBundleCard({
  bundleSizeMb,
  filesCount,
  rootHash,
  lastUpdated,
}: ModelBundleCardProps) {
  return (
    <div className="rounded-sm border border-white/10 bg-black/20 backdrop-blur-sm p-6 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]">
      <p className="text-[10px] font-sans tracking-[0.25em] text-prestige-gold-muted uppercase mb-5">
        Model Bundle
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
        <div className="space-y-1">
          <p className="text-[10px] font-sans tracking-wider text-muted-foreground uppercase">
            Bundle Size
          </p>
          <p className="text-sm font-semibold text-foreground">
            {bundleSizeMb} MB
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-[10px] font-sans tracking-wider text-muted-foreground uppercase">
            Files
          </p>
          <p className="text-sm font-semibold text-foreground">{filesCount}</p>
        </div>
        <div className="space-y-1">
          <p className="text-[10px] font-sans tracking-wider text-muted-foreground uppercase">
            Root Hash
          </p>
          <p className="text-sm font-mono text-foreground">
            {shortenHash(rootHash, 3, 6)}
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-[10px] font-sans tracking-wider text-muted-foreground uppercase">
            Last Updated
          </p>
          <p className="text-sm font-semibold text-foreground">{lastUpdated}</p>
        </div>
      </div>
    </div>
  );
}
