"use client";

import { useWriteContract } from "wagmi";
import { addresses, abis } from "@/lib/contracts";
import { useState } from "react";

export default function AdminPage() {
  const [horseId, setHorseId] = useState("0");
  const [placing, setPlacing] = useState("1");
  const [earnings, setEarnings] = useState("100");
  const [severity, setSeverity] = useState("500");
  const [sentiment, setSentiment] = useState("200");

  const { writeContract: reportRace } = useWriteContract();
  const { writeContract: reportInjury } = useWriteContract();
  const { writeContract: reportNews } = useWriteContract();

  return (
    <div className="space-y-6 max-w-md">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-wide text-foreground">
          Oracle / Admin
        </h1>
        <p className="text-sm text-muted-foreground">
          Role: ORACLE_ROLE. Simulate race result, injury, news for valuation
          updates.
        </p>
      </header>
      <div className="space-y-4">
        <div className="space-y-1">
          <label className="block text-xs text-muted-foreground">
            Horse token ID
          </label>
          <input
            type="number"
            className="w-full px-3 py-2 rounded-sm bg-secondary border border-border text-sm"
            value={horseId}
            onChange={(e) => setHorseId(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <label className="block text-xs text-muted-foreground">
            Race: placing (1-3)
          </label>
          <input
            type="number"
            min={1}
            max={3}
            className="w-full px-3 py-2 rounded-sm bg-secondary border border-border text-sm"
            value={placing}
            onChange={(e) => setPlacing(e.target.value)}
          />
          <label className="block text-xs text-muted-foreground mt-1">
            Earnings ADI (wei)
          </label>
          <input
            type="text"
            className="w-full px-3 py-2 rounded-sm bg-secondary border border-border text-sm"
            value={earnings}
            onChange={(e) => setEarnings(e.target.value)}
          />
          <button
            className="mt-2 px-4 py-2 rounded-sm bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            onClick={() =>
              reportRace({
                address: addresses.horseOracle,
                abi: abis.HorseOracle,
                functionName: "reportRaceResult",
                args: [BigInt(horseId), Number(placing), BigInt(earnings)],
              })
            }
          >
            Report race result
          </button>
        </div>
        <div className="space-y-1">
          <label className="block text-xs text-muted-foreground">
            Injury: severity (bps 0-10000)
          </label>
          <input
            type="text"
            className="w-full px-3 py-2 rounded-sm bg-secondary border border-border text-sm"
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
          />
          <button
            className="mt-2 px-4 py-2 rounded-sm bg-destructive/20 text-destructive border border-destructive/60 text-sm hover:bg-destructive/30 transition-colors"
            onClick={() =>
              reportInjury({
                address: addresses.horseOracle,
                abi: abis.HorseOracle,
                functionName: "reportInjury",
                args: [BigInt(horseId), Number(severity)],
              })
            }
          >
            Report injury
          </button>
        </div>
        <div className="space-y-1">
          <label className="block text-xs text-muted-foreground">
            News: sentiment (bps, can be negative)
          </label>
          <input
            type="text"
            className="w-full px-3 py-2 rounded-sm bg-secondary border border-border text-sm"
            value={sentiment}
            onChange={(e) => setSentiment(e.target.value)}
          />
          <button
            className="mt-2 px-4 py-2 rounded-sm bg-secondary text-foreground text-sm hover:bg-secondary/80 transition-colors"
            onClick={() =>
              reportNews({
                address: addresses.horseOracle,
                abi: abis.HorseOracle,
                functionName: "reportNews",
                args: [BigInt(horseId), Number(sentiment)],
              })
            }
          >
            Report news
          </button>
        </div>
      </div>
    </div>
  );
}
