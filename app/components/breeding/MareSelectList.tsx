"use client";

import { Shield, Crown, Check, Bandage } from "lucide-react";

export interface MareItem {
  id: number;
  name: string;
  pedigree: number;
  valuation: number;
  isTopMare?: boolean;
  /** Injured horses cannot breed — the contract reverts with "Not breedable". */
  injured?: boolean;
}

interface MareSelectListProps {
  mares: MareItem[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  emptyMessage?: string;
}

function formatValuation(val: number): string {
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `$${(val / 1_000).toFixed(1)}K`;
  return `$${val.toFixed(0)}`;
}

export function MareSelectList({
  mares,
  selectedId,
  onSelect,
  emptyMessage = "No on-chain horses found. Deploy contracts and run seed script to mint horses.",
}: MareSelectListProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Shield className="h-3.5 w-3.5 text-prestige-gold shrink-0" />
        <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
          SELECT MARE
        </span>
      </div>
      <div className="space-y-1.5">
        {mares.length === 0 ? (
          <div className="rounded-md border border-dashed border-border bg-card/60 p-6 text-center">
            <p className="text-xs text-muted-foreground">{emptyMessage}</p>
          </div>
        ) : (
          mares.map((mare) => {
            const selected = selectedId !== null && mare.id === selectedId;
            const disabled = !!mare.injured;
            return (
              <button
                key={mare.id}
                type="button"
                disabled={disabled}
                title={disabled ? "Recovering from injury — cannot breed until cleared" : undefined}
                onClick={() => { if (!disabled) onSelect(mare.id); }}
                className={`w-full text-left px-4 py-3 rounded-md border transition-all ${
                  disabled
                    ? "border-border/50 bg-card/20 opacity-60 cursor-not-allowed"
                    : selected
                      ? "border-prestige-gold/60 bg-card shadow-[0_0_0_1px_hsl(var(--prestige-gold)/0.3)]"
                      : "border-border bg-card/40 hover:bg-card/70 hover:border-border/80"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p
                        className={`font-medium truncate ${
                          selected ? "text-foreground" : "text-foreground/90"
                        }`}
                      >
                        {mare.name || `Horse #${mare.id}`}
                      </p>
                      {mare.isTopMare && !disabled && (
                        <Crown className="h-3.5 w-3.5 text-prestige-gold shrink-0" />
                      )}
                      {disabled && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-500 shrink-0">
                          <Bandage className="h-3 w-3" />
                          Recovering
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Pedigree {mare.pedigree} ·{" "}
                      <span className="text-prestige-gold">
                        Val {formatValuation(mare.valuation)}
                      </span>
                    </p>
                  </div>
                  <div
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                      selected
                        ? "border-prestige-gold bg-prestige-gold/10"
                        : "border-muted-foreground/40"
                    }`}
                  >
                    {selected ? (
                      <Check className="h-3 w-3 text-prestige-gold" />
                    ) : null}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
