"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Trophy } from "lucide-react";
import { formatMoney, pctColorClass } from "@/lib/format";
import { PedigreeTree } from "@/components/PedigreeTree";
import type { HorseFullData } from "@/data/mockHorses";

interface OverviewTabProps {
  horse: HorseFullData;
}

export function OverviewTab({ horse }: OverviewTabProps) {
  const chartData = horse.valuationOverTime.map((p) => ({
    ...p,
    displayValue: p.value / 1e6,
  }));

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-white/10 bg-black/20 p-5">
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
                tickFormatter={(v) => `$${v}M`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(0 30% 8%)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "6px",
                }}
                formatter={(value: number | undefined) =>
                  value != null ? [formatMoney(value * 1e6), "Value"] : ["—", "Value"]
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

      <div className="rounded-lg border border-white/10 bg-black/20 p-5">
        <h3 className="text-xs font-semibold tracking-[0.2em] text-prestige-gold uppercase mb-4">
          ORACLE EVENTS
        </h3>
        <div className="space-y-3">
          {horse.oracleEvents.map((evt) => (
            <div
              key={evt.id}
              className="flex items-center justify-between py-2 border-b border-white/5 last:border-0"
            >
              <div className="flex items-center gap-3">
                {evt.icon === "trophy" && (
                  <Trophy className="h-4 w-4 text-prestige-gold shrink-0" />
                )}
                <div>
                  <p className="text-sm text-foreground">{evt.description}</p>
                  <p className="text-[11px] text-muted-foreground font-mono">
                    {evt.source}
                  </p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <span
                  className={`text-sm font-medium ${pctColorClass(evt.changePct)}`}
                >
                  {evt.changePct > 0 ? "+" : ""}
                  {evt.changePct.toFixed(1)}%
                </span>
                <p className="text-[11px] text-muted-foreground">{evt.date}</p>
              </div>
            </div>
          ))}
        </div>
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
            className="rounded-lg border border-white/10 bg-black/20 p-4"
          >
            <p className="text-[10px] font-sans tracking-wider text-muted-foreground uppercase mb-1">
              {stat.label}
            </p>
            <p className="text-lg font-bold text-foreground">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-white/10 bg-black/20 p-5">
        <PedigreeTree
          tokenId={horse.id}
          horseName={horse.name}
          maxDepth={4}
        />
      </div>
    </div>
  );
}
