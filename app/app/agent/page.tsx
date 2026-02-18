"use client";

import { useAccount } from "wagmi";
import Link from "next/link";

export default function AgentPage() {
  const { address } = useAccount();

  return (
    <div className="space-y-6 max-w-4xl">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-wide text-foreground">
          Agents
        </h1>
        <p className="text-sm text-muted-foreground">
          Secretariat&apos;s XGBoost model powers both breeding recommendations
          and horse valuations. Get top 3 stallion recommendations for your mare
          with full explainability.
        </p>
      </header>

      <section className="rounded-sm border border-border bg-card p-4 space-y-3">
        <h2 className="text-sm font-semibold text-foreground">
          Breeding Advisor
        </h2>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Scores stallion–mare compatibility using trait vectors, pedigree
          synergy, complementary traits, cost, and form. Returns the top 3
          stallion picks with per-factor explainability and risk flags.
        </p>
        <p className="text-xs text-muted-foreground">
          Powered by Secretariat&apos;s XGBoost model trained on real
          thoroughbred racing data.
        </p>
      </section>

      <section className="rounded-sm border border-border bg-card p-4 space-y-3">
        <h2 className="text-sm font-semibold text-foreground">
          Horse Valuation Agent
        </h2>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Computes USD valuation from racing value, breeding value, and
          modifiers (age peak 3–6, health, status, market). Triggered on oracle
          events: RACE_WIN, RACE_LOSS, INJURY, RETIREMENT, OFFSPRING_WIN,
          DEATH.
        </p>
        <p className="text-xs text-muted-foreground">
          Powered by Secretariat&apos;s XGBoost model with formula-based
          fallback.
        </p>
        <Link
          href="/horse/0"
          className="inline-flex px-4 py-2 rounded-sm bg-primary/10 text-prestige-gold border border-border text-sm hover:bg-primary/20 transition-colors"
        >
          View valuation on horse detail
        </Link>
      </section>

      <section className="rounded-sm border border-border bg-secondary/60 p-4 space-y-3">
        <h2 className="text-sm font-semibold text-prestige-gold">
          Get top 3 breeding picks
        </h2>
        <p className="text-xs text-muted-foreground">
          Recommend-only mode: outputs Top 3 stallions + explainability.
          Execute mode: sign plan and the agent contract executes within
          constraints.
        </p>
        <Link
          href="/breed?advisor=1"
          className="inline-flex px-4 py-2 rounded-sm bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          Breeding Advisor
        </Link>
      </section>
    </div>
  );
}
