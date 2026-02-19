"use client";

import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from "recharts";
import { pctColorClass } from "@/lib/format";
import type { HorseFullData } from "@/data/mockHorses";

interface AnalyticsTabProps {
  horse: HorseFullData;
}

const TRAIT_ORDER = [
  "speed",
  "stamina",
  "temperament",
  "durability",
  "pedigree",
] as const;

const TRAIT_LABELS: Record<(typeof TRAIT_ORDER)[number], string> = {
  speed: "Speed",
  stamina: "Stamina",
  temperament: "Temperament",
  durability: "Durability",
  pedigree: "Pedigree",
};

export function AnalyticsTab({ horse }: AnalyticsTabProps) {
  const radarData = TRAIT_ORDER.map((key) => ({
    trait: TRAIT_LABELS[key],
    value: horse.traitVector[key],
    fullMark: 100,
  }));

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-white/10 bg-black/20 p-5">
        <h3 className="text-xs font-semibold tracking-[0.2em] text-prestige-gold uppercase mb-4">
          TRAIT VECTOR
        </h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={radarData}>
              <PolarGrid stroke="rgba(255,255,255,0.2)" />
              <PolarAngleAxis
                dataKey="trait"
                tick={{ fill: "rgba(255,255,255,0.7)", fontSize: 11 }}
              />
              <PolarRadiusAxis
                angle={90}
                domain={[0, 100]}
                tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 10 }}
              />
              <Radar
                name="Traits"
                dataKey="value"
                stroke="hsl(160 60% 45%)"
                fill="hsl(160 60% 45% / 0.3)"
                strokeWidth={2}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-lg border border-white/10 bg-black/20 p-5">
        <h3 className="text-xs font-semibold tracking-[0.2em] text-prestige-gold uppercase mb-4">
          VALUATION DRIVERS
        </h3>
        <div className="space-y-3">
          {horse.valuationDrivers.map((driver) => (
            <div
              key={driver.name}
              className="flex items-center justify-between py-2 border-b border-white/5 last:border-0"
            >
              <span className="text-sm text-foreground">{driver.name}</span>
              <span
                className={`text-sm font-medium ${pctColorClass(driver.impactPct)}`}
              >
                {driver.impactPct >= 0 ? "+" : ""}
                {driver.impactPct.toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
