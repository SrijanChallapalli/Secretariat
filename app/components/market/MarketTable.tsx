"use client";

import { useRouter } from "next/navigation";
import { ArrowUpDown, ArrowUp, ArrowDown, Key } from "lucide-react";
import { formatMoneyCompact, formatPct, pctColorClass } from "@/lib/format";
import { DemandBar } from "./DemandBar";
import type { MarketListing } from "@/data/mockMarketListings";

const SOUNDNESS_STYLES = {
  SOUND: "text-terminal-green",
  MONITOR: "text-terminal-amber",
  CAUTION: "text-terminal-red",
} as const;

export type SortKey =
  | "name"
  | "valuationUsd"
  | "change24hPct"
  | "soundness"
  | "wins"
  | "studFeeUsd"
  | "uses"
  | "demandScore";

interface MarketTableProps {
  listings: MarketListing[];
  sortKey: SortKey;
  sortAsc: boolean;
  onSort: (key: SortKey) => void;
}

export function MarketTable({
  listings,
  sortKey,
  sortAsc,
  onSort,
}: MarketTableProps) {
  const router = useRouter();

  const SortHeader = ({
    label,
    field,
    sticky,
  }: {
    label: string;
    field: SortKey;
    sticky?: boolean;
  }) => (
    <th
      className={`cursor-pointer hover:text-brand-ivory transition-colors text-[10px] font-sans uppercase tracking-wider text-muted-foreground/80 py-4 px-4 text-left ${sticky ? "sticky left-0 bg-white/5 z-20 min-w-[180px]" : ""}`}
      onClick={() => onSort(field)}
    >
      <div className="flex items-center gap-1.5">
        {label}
        {sortKey === field ? (
          sortAsc ? (
            <ArrowUp className="h-3 w-3 opacity-70" />
          ) : (
            <ArrowDown className="h-3 w-3 opacity-70" />
          )
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-50" />
        )}
      </div>
    </th>
  );

  return (
    <div className="rounded-lg border border-white/10 bg-black/20 overflow-hidden shadow-[0_0_0_1px_rgba(255,255,255,0.03)]">
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="border-b border-white/10 bg-white/5">
              <SortHeader label="HORSE" field="name" sticky />
              <SortHeader label="VALUATION" field="valuationUsd" />
              <SortHeader label="24H" field="change24hPct" />
              <SortHeader label="SOUNDNESS" field="soundness" />
              <SortHeader label="WINS" field="wins" />
              <SortHeader label="STUD FEE" field="studFeeUsd" />
              <SortHeader label="USES" field="uses" />
              <SortHeader label="DEMAND" field="demandScore" />
            </tr>
          </thead>
          <tbody>
            {listings.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="py-12 text-center text-muted-foreground"
                >
                  No thoroughbreds found.
                </td>
              </tr>
            ) : (
              <>
                {listings.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-white/5 last:border-0 hover:bg-white/[0.03] transition-colors cursor-pointer group"
                    onClick={() => router.push(`/horse/${row.id}`)}
                  >
                  <td className="py-4 px-4 sticky left-0 bg-black/20 backdrop-blur-sm z-10 min-w-[180px]">
                    <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-foreground group-hover:text-prestige-gold transition-colors truncate">
                            {row.name}
                          </span>
                          {row.hasKey && (
                            <Key className="h-3 w-3 text-prestige-gold shrink-0" />
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground uppercase tracking-wider truncate">
                          {row.bloodlineA}
                        </p>
                    </div>
                  </td>
                  <td className="py-4 px-4 font-semibold text-foreground">
                    {formatMoneyCompact(row.valuationUsd)}
                  </td>
                  <td className="py-4 px-4">
                    <span
                      className={`font-medium flex items-center gap-0.5 ${pctColorClass(row.change24hPct)}`}
                    >
                      {row.change24hPct >= 0 ? "↗" : "↘"}{" "}
                      {formatPct(row.change24hPct)}
                    </span>
                  </td>
                  <td className="py-4 px-4">
                    <span
                      className={`text-[11px] font-medium uppercase tracking-wider ${SOUNDNESS_STYLES[row.soundness]}`}
                    >
                      {row.soundness}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-muted-foreground">
                    {row.wins} {row.grade}
                  </td>
                  <td className="py-4 px-4 font-mono text-foreground">
                    {formatMoneyCompact(row.studFeeUsd)}
                  </td>
                  <td className="py-4 px-4 text-foreground">{row.uses}</td>
                  <td className="py-4 px-4">
                    <DemandBar score={row.demandScore} />
                  </td>
                  </tr>
                ))}
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
