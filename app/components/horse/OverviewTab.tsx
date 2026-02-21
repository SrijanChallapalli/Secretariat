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
import { formatMoney } from "@/lib/format";
import { PedigreeTree } from "@/components/PedigreeTree";
import type { HorseFullData } from "@/data/mockHorses";

interface OverviewTabProps {
  horse: HorseFullData;
}

export function OverviewTab({ horse }: OverviewTabProps) {
  const maxVal = Math.max(...horse.valuationOverTime.map((p) => p.value), 1);
  const scale = maxVal >= 1_000_000 ? 1e6 : maxVal >= 1_000 ? 1e3 : 1;
  const suffix = scale === 1e6 ? "M" : scale === 1e3 ? "K" : "";
  const chartData = horse.valuationOverTime.map((p) => ({
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
    </div>
  );
}
