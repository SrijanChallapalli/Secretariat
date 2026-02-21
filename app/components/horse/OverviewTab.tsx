"use client";

import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { usePublicClient } from "wagmi";
import { parseAbiItem, formatEther } from "viem";
import { formatMoney, pctColorClass } from "@/lib/format";
import { PedigreeTree } from "@/components/PedigreeTree";
import { addresses } from "@/lib/contracts";
import type { HorseFullData, OracleEvent } from "@/data/mockHorses";
import { Trophy, AlertTriangle, FileText } from "lucide-react";

const valuationCommittedEvent = parseAbiItem(
  "event ValuationCommitted(uint256 indexed tokenId, uint8 indexed eventType, bytes32 indexed eventHash, uint256 newValuationADI, bytes32 ogRootHash)"
);

const EVENT_TYPE_NAMES: Record<number, string> = {
  0: "Race revaluation committed",
  1: "Injury revaluation committed",
  2: "News revaluation committed",
  3: "Biometric revaluation committed",
};

interface OverviewTabProps {
  horse: HorseFullData;
}

function OracleEventIcon({ icon }: { icon?: OracleEvent["icon"] }) {
  if (icon === "trophy") return <Trophy className="h-3.5 w-3.5 text-prestige-gold" />;
  if (icon === "warning") return <AlertTriangle className="h-3.5 w-3.5 text-terminal-red" />;
  return <FileText className="h-3.5 w-3.5 text-terminal-cyan" />;
}

export function OverviewTab({ horse }: OverviewTabProps) {
  const client = usePublicClient();
  const [chainEvents, setChainEvents] = useState<OracleEvent[]>([]);
  const [chainValuations, setChainValuations] = useState<{ date: string; value: number }[]>([]);

  useEffect(() => {
    if (!client || !addresses.horseOracle || addresses.horseOracle === "0x0000000000000000000000000000000000000000") return;

    let cancelled = false;
    (async () => {
      try {
        const currentBlock = await client.getBlockNumber();
        const fromBlock = currentBlock > 2000n ? currentBlock - 2000n : 0n;
        const logs = await client.getLogs({
          address: addresses.horseOracle,
          event: valuationCommittedEvent,
          args: { tokenId: BigInt(horse.id) },
          fromBlock,
          toBlock: currentBlock,
        });

        if (cancelled) return;

        const valuationPoints: { date: string; value: number }[] = [];
        const mapped: OracleEvent[] = logs.map((log) => {
          const eventTypeNum = Number(log.args.eventType ?? 2);
          const newVal = log.args.newValuationADI ?? 0n;
          const valNum = Number(formatEther(newVal));
          valuationPoints.push({
            date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" }),
            value: Math.round(valNum),
          });
          return {
            id: `chain-${log.transactionHash}-${log.logIndex}`,
            description: `${EVENT_TYPE_NAMES[eventTypeNum] ?? "Revaluation"} — ${formatEther(newVal)} ADI`,
            source: "0G Oracle (on-chain)",
            changePct: 0,
            date: new Date().toISOString().slice(0, 10),
            icon: eventTypeNum === 0 ? ("trophy" as const) : eventTypeNum === 1 ? ("warning" as const) : ("document" as const),
          };
        });
        setChainEvents(mapped);
        setChainValuations(valuationPoints);
      } catch {
        // silent
      }
    })();
    return () => { cancelled = true; };
  }, [client, horse.id, horse.valuation]);

  const allOracleEvents = [...chainEvents, ...horse.oracleEvents];

  const mergedValuations = (() => {
    const base = [...horse.valuationOverTime];
    if (chainValuations.length > 0) {
      const lastOnChainVal = chainValuations[chainValuations.length - 1].value;
      if (base.length > 0 && Math.abs(base[base.length - 1].value - lastOnChainVal) > 1) {
        base[base.length - 1] = { ...base[base.length - 1], value: lastOnChainVal };
      }
    }
    return base;
  })();

  const maxVal = Math.max(...mergedValuations.map((p) => p.value), 1);
  const scale = maxVal >= 1_000_000 ? 1e6 : maxVal >= 1_000 ? 1e3 : 1;
  const suffix = scale === 1e6 ? "M" : scale === 1e3 ? "K" : "";
  const chartData = mergedValuations.map((p) => ({
    ...p,
    displayValue: p.value / scale,
  }));

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-sidebar-border/60 bg-card p-5">
        <PedigreeTree
          tokenId={horse.id}
          horseName={horse.name}
          maxDepth={4}
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        {[
          { label: "AGE", value: horse.stats.age },
          { label: "TOTAL WINS", value: String(horse.stats.totalWins) },
          { label: "GRADE WINS", value: String(horse.stats.gradeWins) },
          { label: "INJURIES", value: String(horse.stats.injuries) },
          { label: "PEDIGREE", value: String(horse.stats.pedigree) },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-lg border border-sidebar-border/60 bg-card p-4"
          >
            <p className="text-[10px] font-sans tracking-wider text-muted-foreground uppercase mb-1">
              {stat.label}
            </p>
            <p className="text-lg font-bold text-foreground">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-sidebar-border/60 bg-card p-5">
        <h3 className="text-xs font-semibold tracking-[0.2em] text-prestige-gold uppercase mb-4">
          VALUATION OVER TIME
        </h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis
                dataKey="date"
                stroke="rgba(255,255,255,0.4)"
                tick={{ fontSize: 11 }}
              />
              <YAxis
                stroke="rgba(255,255,255,0.4)"
                tick={{ fontSize: 11 }}
                tickFormatter={(v) => `$${v}${suffix}`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(0 30% 8%)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "6px",
                }}
                formatter={(value: number | undefined) =>
                  value != null ? [formatMoney(value * scale), "Value"] : ["—", "Value"]
                }
              />
              <Line
                type="monotone"
                dataKey="displayValue"
                stroke="hsl(160 60% 40%)"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {allOracleEvents.length > 0 && (
        <div className="rounded-lg border border-sidebar-border/60 bg-card p-5">
          <h3 className="text-xs font-semibold tracking-[0.2em] text-prestige-gold uppercase mb-4">
            ORACLE EVENT HISTORY
          </h3>
          <div className="space-y-2">
            {allOracleEvents.map((ev) => (
              <div
                key={ev.id}
                className="flex items-start gap-3 py-2 border-b border-white/5 last:border-0"
              >
                <OracleEventIcon icon={ev.icon} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground">{ev.description}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {ev.source} · {ev.date}
                  </p>
                </div>
                {ev.changePct !== 0 && (
                  <span className={`text-sm font-medium shrink-0 ${pctColorClass(ev.changePct)}`}>
                    {ev.changePct > 0 ? "+" : ""}{ev.changePct.toFixed(1)}%
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
