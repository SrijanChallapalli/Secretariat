"use client";

import { formatEther } from "viem";
import {
  Sparkles,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
  Ban,
  Loader2,
  Cpu,
} from "lucide-react";
import type { AgentProposal, ProposedPairing } from "@/lib/agent-proposal";

const TRAIT_NAMES = [
  "Speed",
  "Stamina",
  "Temperament",
  "Conformation",
  "Health",
  "Agility",
  "Race IQ",
  "Consistency",
];

interface Props {
  proposal: AgentProposal | null;
  loading: boolean;
  executing: boolean;
  onPropose: () => void;
  onExecute: (pairing: ProposedPairing) => void;
  connected: boolean;
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div className="flex items-center gap-2">
      <span className="w-28 shrink-0 text-[11px] text-muted-foreground">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-prestige-gold" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-8 shrink-0 text-right text-[11px] tabular-nums text-foreground/80">
        {pct}
      </span>
    </div>
  );
}

function PairingRow({
  pairing,
  rank,
  onExecute,
  executing,
}: {
  pairing: ProposedPairing;
  rank: number;
  onExecute: (p: ProposedPairing) => void;
  executing: boolean;
}) {
  const isTop = rank === 0;
  return (
    <div
      className={`rounded-lg border p-4 ${
        isTop ? "border-prestige-gold/50 bg-prestige-gold/[0.04]" : "border-border bg-card/40"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {isTop && (
              <span className="rounded-full border border-prestige-gold/50 bg-prestige-gold/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-prestige-gold">
                Top proposal
              </span>
            )}
            <span className="text-[11px] text-muted-foreground">
              Match {Math.round(pairing.score * 100)}%
            </span>
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-2 font-medium">
            <span className="text-foreground">{pairing.stallion.name}</span>
            <span className="text-muted-foreground">×</span>
            <span className="text-foreground">{pairing.mare.name}</span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-[11px] text-muted-foreground">Stud fee</p>
          <p className="text-sm font-medium tabular-nums text-prestige-gold">
            {Number(formatEther(pairing.studFeeADI)).toLocaleString()} ADI
          </p>
        </div>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        {pairing.aiExplanation || pairing.explanation}
      </p>

      {pairing.predictedOffspringValue != null && pairing.predictedOffspringValue > 0 && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          Model projects{" "}
          <span className="font-medium text-foreground tabular-nums">
            £{Math.round(pairing.predictedOffspringValue).toLocaleString()}
          </span>{" "}
          career earnings for the foal
        </p>
      )}

      <div className="mt-3 grid gap-1.5">
        <ScoreBar label="Trait match" value={pairing.explainability.traitMatch} />
        <ScoreBar label="Pedigree" value={pairing.explainability.pedigreeSynergy} />
      </div>

      {pairing.offspringTraits && (
        <div className="mt-3">
          <p className="mb-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
            Projected foal
          </p>
          <div className="flex flex-wrap gap-1.5">
            {pairing.offspringTraits.map((t, i) => (
              <span
                key={TRAIT_NAMES[i]}
                className="rounded border border-border bg-background/60 px-1.5 py-0.5 text-[10px] tabular-nums text-foreground/80"
                title={TRAIT_NAMES[i]}
              >
                {TRAIT_NAMES[i].slice(0, 4)} {t}
              </span>
            ))}
          </div>
        </div>
      )}

      {pairing.riskFlags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {pairing.riskFlags.map((f) => (
            <span
              key={f}
              className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-500"
            >
              <AlertTriangle className="h-3 w-3" />
              {f}
            </span>
          ))}
        </div>
      )}

      {isTop && (
        <button
          type="button"
          onClick={() => onExecute(pairing)}
          disabled={executing}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md border border-prestige-gold/50 bg-prestige-gold/10 px-4 py-2 text-sm font-medium text-prestige-gold transition-colors hover:bg-prestige-gold/20 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {executing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Executing…
            </>
          ) : (
            <>
              <ShieldCheck className="h-4 w-4" />
              Approve &amp; execute plan
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      )}
    </div>
  );
}

export function AgentProposalCard({
  proposal,
  loading,
  executing,
  onPropose,
  onExecute,
  connected,
}: Props) {
  return (
    <section className="rounded-lg border border-border bg-card/60 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-heading text-lg text-foreground">
            <Sparkles className="h-4 w-4 text-prestige-gold" />
            Breeding proposal
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            The advisor evaluates every mare you own against every stallion legally able to
            cover her, then ranks the field.
          </p>
        </div>
        <button
          type="button"
          onClick={onPropose}
          disabled={loading || !connected}
          className="inline-flex items-center gap-2 rounded-md border border-prestige-gold/50 bg-prestige-gold/10 px-4 py-2 text-sm font-medium text-prestige-gold transition-colors hover:bg-prestige-gold/20 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Analysing…
            </>
          ) : (
            <>
              <Cpu className="h-4 w-4" />
              Propose breeding
            </>
          )}
        </button>
      </div>

      {!connected && (
        <p className="mt-4 rounded-md border border-dashed border-border bg-background/40 p-4 text-center text-xs text-muted-foreground">
          Connect a wallet so the advisor can see which mares you own.
        </p>
      )}

      {proposal && (
        <div className="mt-4 space-y-3">
          <p className="text-[11px] text-muted-foreground">
            Considered {proposal.maresConsidered} mare
            {proposal.maresConsidered === 1 ? "" : "s"} ·{" "}
            {proposal.stallionsConsidered} eligible pairing
            {proposal.stallionsConsidered === 1 ? "" : "s"} ·{" "}
            <span className={proposal.usedModel ? "text-terminal-green" : "text-amber-500"}>
              {proposal.usedModel ? `scored by ${proposal.modelVersion}` : "scored locally (server unavailable)"}
            </span>
          </p>

          {proposal.ranked.length === 0 ? (
            <p className="rounded-md border border-dashed border-border bg-background/40 p-4 text-center text-xs text-muted-foreground">
              No legal pairing available. You need a mare that is registered for breeding and
              healthy, plus an unrelated stallion listed at stud.
            </p>
          ) : (
            proposal.ranked.map((p, i) => (
              <PairingRow
                key={`${p.mare.tokenId}-${p.stallion.tokenId}`}
                pairing={p}
                rank={i}
                onExecute={onExecute}
                executing={executing}
              />
            ))
          )}

          {proposal.excluded.length > 0 && (
            <details className="rounded-md border border-border bg-background/40 p-3">
              <summary className="cursor-pointer text-[11px] text-muted-foreground">
                {proposal.excluded.length} pairing
                {proposal.excluded.length === 1 ? "" : "s"} ruled out
              </summary>
              <ul className="mt-2 space-y-1">
                {proposal.excluded.map((e, i) => (
                  <li
                    key={`${e.mareName}-${e.stallionName}-${i}`}
                    className="flex items-start gap-2 text-[11px] text-muted-foreground"
                  >
                    <Ban className="mt-0.5 h-3 w-3 shrink-0 text-red-400/70" />
                    <span>
                      <span className="text-foreground/80">
                        {e.stallionName} × {e.mareName}
                      </span>{" "}
                      — {e.reason}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </section>
  );
}
