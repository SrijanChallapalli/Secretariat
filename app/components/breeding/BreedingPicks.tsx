"use client";

import { Trophy, Crown } from "lucide-react";
import { validateHorseName } from "../../../shared/name-validator";
import { useState } from "react";

export interface BreedingPickDisplay {
  stallionTokenId: number;
  stallionName: string;
  rank: 1 | 2 | 3;
  badge: "RECOMMENDED" | "STRONG" | "VIABLE";
  match: number;
  projEdge: number;
  soundnessDelta: number;
  confidence: number;
  explanation: string;
}

interface BreedingPicksProps {
  picks: BreedingPickDisplay[];
  onExecuteWithApproval?: (stallionId: number, offspringName: string) => void;
  onReviewAndApprove?: (stallionId: number) => void;
  onGetPicks?: () => void;
  hasMareSelected?: boolean;
  hasStallions?: boolean;
}

export function BreedingPicks({
  picks,
  onExecuteWithApproval,
  onReviewAndApprove,
  onGetPicks,
  hasMareSelected = false,
  hasStallions = true,
}: BreedingPicksProps) {
  const [offspringName, setOffspringName] = useState("");
  const [focusedStallion, setFocusedStallion] = useState<number | null>(null);

  if (picks.length === 0) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Trophy className="h-3.5 w-3.5 text-prestige-gold shrink-0" />
          <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            TOP 3 BREEDING PICKS
          </span>
        </div>
        <div className="rounded-md border border-dashed border-border bg-card/60 p-8 text-center">
          <p className="text-xs text-muted-foreground mb-4">
            {!hasMareSelected
              ? "Select a mare on the left, then fetch top 3 picks to see match scores and recommendations."
              : !hasStallions
                ? "No stallions available for breeding. List stallions on the marketplace to enable picks."
                : "Select a mare on the left, then fetch top 3 picks to see match scores and recommendations."}
          </p>
          {onGetPicks && hasMareSelected && hasStallions && (
            <button
              type="button"
              onClick={onGetPicks}
              className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
            >
              Get top 3 picks
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="h-3.5 w-3.5 text-prestige-gold shrink-0" />
          <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            TOP 3 BREEDING PICKS
          </span>
        </div>
        {onGetPicks && hasMareSelected && (
          <button
            type="button"
            onClick={onGetPicks}
            className="text-[11px] text-prestige-gold hover:text-prestige-gold/80 transition-colors"
          >
            Refresh picks
          </button>
        )}
      </div>
      <div className="space-y-3">
        {picks.map((pick) => {
          const isFirst = pick.rank === 1;
          const nameValid =
            offspringName && validateHorseName(offspringName).valid;
          const nameInvalid =
            offspringName && !validateHorseName(offspringName).valid;
          const showExecuteForm =
            isFirst &&
            onExecuteWithApproval &&
            focusedStallion === pick.stallionTokenId;

          return (
            <div
              key={pick.stallionTokenId}
              className="rounded-md border border-border bg-card/60 p-4 space-y-3 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-foreground">
                    #{pick.rank} {pick.stallionName}
                  </span>
                  {isFirst && (
                    <Crown className="h-3.5 w-3.5 text-prestige-gold shrink-0" />
                  )}
                </div>
                <span className="px-2 py-0.5 rounded border border-prestige-gold/40 text-[10px] font-medium text-foreground uppercase tracking-wider">
                  {pick.badge}
                </span>
              </div>

              <div className="grid grid-cols-4 gap-4 text-center">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">
                    MATCH
                  </p>
                  <p
                    className={`text-sm font-medium ${
                      pick.match >= 90 ? "text-terminal-green" : "text-foreground"
                    }`}
                  >
                    {pick.match}%
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">
                    PROJ. EDGE
                  </p>
                  <p
                    className={`text-sm font-medium ${
                      pick.projEdge >= 0 ? "text-terminal-green" : "text-terminal-red"
                    }`}
                  >
                    {pick.projEdge >= 0 ? "+" : ""}
                    {pick.projEdge.toFixed(1)}%
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">
                    SOUNDNESS Δ
                  </p>
                  <p className="text-sm font-medium text-foreground">
                    {pick.soundnessDelta >= 0 ? "+" : ""}
                    {pick.soundnessDelta}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">
                    CONFIDENCE
                  </p>
                  <p
                    className={`text-sm font-medium ${
                      pick.confidence >= 90
                        ? "text-terminal-green"
                        : pick.confidence >= 80
                          ? "text-prestige-gold"
                          : "text-foreground"
                    }`}
                  >
                    {pick.confidence}%
                  </p>
                </div>
              </div>

              {pick.explanation && (
                <div className="rounded-md border border-prestige-gold/20 bg-prestige-gold/5 px-3 py-2">
                  <p className="text-[10px] font-semibold text-prestige-gold uppercase tracking-wider mb-0.5">
                    Why this pick
                  </p>
                  <p className="text-xs text-foreground/90 leading-relaxed">
                    {pick.explanation}
                  </p>
                </div>
              )}

              <div className="pt-1">
                {isFirst && onExecuteWithApproval ? (
                  <div className="space-y-2">
                    {!showExecuteForm ? (
                      <button
                        type="button"
                        onClick={() => setFocusedStallion(pick.stallionTokenId)}
                        className="w-full px-4 py-2.5 rounded-md border border-prestige-gold/50 text-foreground text-sm font-medium hover:bg-prestige-gold/10 transition-colors"
                      >
                        Execute With Approval
                      </button>
                    ) : (
                      <>
                        <input
                          placeholder="Offspring name"
                          className={`w-full px-3 py-2 rounded-md bg-secondary/60 text-sm border ${
                            nameInvalid
                              ? "border-destructive/60"
                              : "border-border"
                          }`}
                          value={offspringName}
                          onChange={(e) => setOffspringName(e.target.value)}
                        />
                        {nameInvalid && (
                          <p className="text-[10px] text-destructive">
                            {validateHorseName(offspringName).errors.join("; ")}
                          </p>
                        )}
                        {nameValid && (
                          <p className="text-[10px] text-terminal-green">
                            Name valid (Jockey Club rules)
                          </p>
                        )}
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              if (nameValid) {
                                onExecuteWithApproval(
                                  pick.stallionTokenId,
                                  offspringName
                                );
                              }
                            }}
                            disabled={!nameValid}
                            className="flex-1 px-4 py-2 rounded-md border border-prestige-gold/50 text-foreground text-sm font-medium hover:bg-prestige-gold/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            Execute With Approval
                          </button>
                          <button
                            type="button"
                            onClick={() => setFocusedStallion(null)}
                            className="px-3 py-2 rounded-md text-muted-foreground text-xs hover:bg-secondary/60 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  onReviewAndApprove && (
                    <button
                      type="button"
                      onClick={() => onReviewAndApprove(pick.stallionTokenId)}
                      className="text-sm text-foreground/90 hover:text-prestige-gold transition-colors"
                    >
                      Review & Approve
                    </button>
                  )
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
