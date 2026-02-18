"use client";

import { useReadContracts } from "wagmi";
import { addresses, abis } from "@/lib/contracts";
import { calculateOfficialAge } from "../../../shared/age";
import { useEffect, useMemo, useState } from "react";
import { Search, ArrowUpDown, ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useRouter } from "next/navigation";

const ZERO = "0x0000000000000000000000000000000000000000";

type SortKey = "name" | "valuationADI" | "pedigreeScore" | "age";

type ValuationChange = {
  deltaPct: number;
  direction: "up" | "down" | "flat";
};

type TrainingEvent = {
  tokenId: number;
  eventType: string;
  valuationBefore: number;
  valuationAfter: number;
  timestamp: number;
};

export default function MarketplacePage() {
  const router = useRouter();
  const { data: contracts, isLoading, isError, error } = useReadContracts({
    contracts: [
      { address: addresses.horseINFT, abi: abis.HorseINFT, functionName: "getHorseData", args: [0n] },
      { address: addresses.horseINFT, abi: abis.HorseINFT, functionName: "getHorseData", args: [1n] },
      { address: addresses.horseINFT, abi: abis.HorseINFT, functionName: "getHorseData", args: [2n] },
      { address: addresses.horseINFT, abi: abis.HorseINFT, functionName: "getHorseData", args: [3n] },
      { address: addresses.horseINFT, abi: abis.HorseINFT, functionName: "getHorseData", args: [4n] },
    ],
  });

  const results = (contracts ?? []).map((c) => {
    if (c.status !== "success") return null;
    const r = c.result as any;
    if (!r) return null;
    return {
      name: r.name ?? r[0],
      birthTimestamp: r.birthTimestamp ?? r[1],
      pedigreeScore: r.pedigreeScore ?? r[5],
      valuationADI: r.valuationADI ?? r[6],
      breedingAvailable: r.breedingAvailable ?? r[8],
    };
  });
  const noAddress = addresses.horseINFT.toLowerCase() === ZERO;

  const horses = useMemo(() => {
    return results
      .map((data, tokenId) => {
        if (!data) return null;
        const score = data.pedigreeScore != null ? Number(data.pedigreeScore) : 0;
        const valuationADI = data.valuationADI != null ? BigInt(data.valuationADI) : 0n;
        const birthTs = data.birthTimestamp != null ? Number(data.birthTimestamp) : 0;
        const age = birthTs > 0 ? calculateOfficialAge(birthTs) : null;
        return {
          tokenId,
          name: String(data.name || `Horse #${tokenId}`),
          pedigreeScore: score,
          valuationADI,
          age,
          breedingAvailable: !!data.breedingAvailable,
        };
      })
      .filter(Boolean) as {
      tokenId: number;
      name: string;
      pedigreeScore: number;
      valuationADI: bigint;
      age: number | null;
      breedingAvailable: boolean;
    }[];
  }, [results]);

  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("valuationADI");
  const [sortAsc, setSortAsc] = useState(false);
  const [changes, setChanges] = useState<Record<number, ValuationChange>>({});

  const filtered = useMemo(() => {
    let list = horses.filter((h) =>
      h.name.toLowerCase().includes(search.toLowerCase()),
    );
    list.sort((a, b) => {
      if (sortKey === "name") {
        return sortAsc
          ? a.name.localeCompare(b.name)
          : b.name.localeCompare(a.name);
      }
      const av =
        sortKey === "valuationADI"
          ? Number(a.valuationADI)
          : sortKey === "pedigreeScore"
          ? a.pedigreeScore
          : a.age ?? 0;
      const bv =
        sortKey === "valuationADI"
          ? Number(b.valuationADI)
          : sortKey === "pedigreeScore"
          ? b.pedigreeScore
          : b.age ?? 0;
      return sortAsc ? av - bv : bv - av;
    });
    return list;
  }, [horses, search, sortKey, sortAsc]);

  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_SERVER_URL;
    if (!base) return;

    const load = async () => {
      try {
        const res = await fetch(`${base}/training/events`);
        if (!res.ok) return;
        const events = (await res.json()) as TrainingEvent[];
        const latest: Record<number, TrainingEvent> = {};
        for (const ev of events) {
          if (ev.eventType !== "ValuationUpdated") continue;
          if (typeof ev.tokenId !== "number") continue;
          const existing = latest[ev.tokenId];
          if (!existing || ev.timestamp > existing.timestamp) {
            latest[ev.tokenId] = ev;
          }
        }
        const map: Record<number, ValuationChange> = {};
        for (const [tokenIdStr, ev] of Object.entries(latest)) {
          const tokenId = Number(tokenIdStr);
          if (!ev.valuationBefore || ev.valuationBefore === 0) continue;
          const rawDelta =
            ((ev.valuationAfter - ev.valuationBefore) / ev.valuationBefore) *
            100;
          let direction: ValuationChange["direction"] = "flat";
          if (rawDelta > 0.05) direction = "up";
          else if (rawDelta < -0.05) direction = "down";
          map[tokenId] = { deltaPct: rawDelta, direction };
        }
        setChanges(map);
      } catch {
        // best-effort: ignore errors, leave changes empty
      }
    };

    load();
  }, []);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  const SortHeader = ({ label, field }: { label: string; field: SortKey }) => (
    <TableHead
      className="cursor-pointer hover:text-foreground transition-colors text-[10px] font-mono uppercase tracking-wider"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {label}
        <ArrowUpDown className="h-3 w-3" />
      </div>
    </TableHead>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold tracking-wide text-foreground">
          Market
        </h1>
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Filter horses..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-8 bg-secondary border-border text-sm font-mono"
          />
        </div>
      </div>

      {noAddress && (
        <p className="text-xs text-terminal-amber mb-4 font-mono">
          Contract not configured. Run{" "}
          <code className="px-1 rounded bg-card border border-border">
            npm run env:from-broadcast
          </code>{" "}
          in repo root, then restart the app.
        </p>
      )}

      <details className="mb-6 text-xs text-muted-foreground border border-border rounded-sm bg-secondary/40 p-3">
        <summary className="cursor-pointer text-muted-foreground">
          Debug: contract read diagnostics
        </summary>
        <pre className="mt-2 overflow-auto max-h-48">
          {JSON.stringify({
            horseINFT: addresses.horseINFT,
            isLoading,
            isError,
            error: error?.message ?? null,
            contractCount: contracts?.length ?? 0,
            statuses: contracts?.map((c) => c.status) ?? [],
            errors: contracts?.map((c) => (c as any).error?.message ?? null) ?? [],
            firstResult: contracts?.[0] ? JSON.stringify(contracts[0], (_k, v) => typeof v === "bigint" ? v.toString() : v) : null,
          }, null, 2)}
        </pre>
      </details>

      <div className="border border-border rounded-sm overflow-hidden bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-muted/40 border-border">
              <SortHeader label="Horse" field="name" />
              <SortHeader label="Valuation (ADI)" field="valuationADI" />
              <TableHead className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                Δ valuation
              </TableHead>
              <SortHeader label="Pedigree" field="pedigreeScore" />
              <SortHeader label="Age" field="age" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((horse) => (
              <TableRow
                key={horse.tokenId}
                className="hover:bg-muted/60 border-border transition-colors cursor-pointer"
                onClick={() => router.push(`/horse/${horse.tokenId}`)}
              >
                <TableCell className="font-medium">
                  {horse.name}
                  {horse.breedingAvailable && (
                    <span className="ml-2 text-[10px] font-mono px-1.5 py-0.5 rounded-sm bg-terminal-green/10 text-terminal-green">
                      Breeding
                    </span>
                  )}
                </TableCell>
                <TableCell className="font-mono">
                  {Number(horse.valuationADI) / 1e18}
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {changes[horse.tokenId] ? (
                    <span
                      className={`inline-flex items-center gap-1 ${
                        changes[horse.tokenId].direction === "up"
                          ? "text-terminal-green"
                          : changes[horse.tokenId].direction === "down"
                          ? "text-terminal-red"
                          : "text-muted-foreground"
                      }`}
                    >
                      {changes[horse.tokenId].direction === "up" && (
                        <ArrowUpRight className="h-3 w-3" />
                      )}
                      {changes[horse.tokenId].direction === "down" && (
                        <ArrowDownRight className="h-3 w-3" />
                      )}
                      {changes[horse.tokenId].direction === "flat" && (
                        <Minus className="h-3 w-3" />
                      )}
                      {`${changes[horse.tokenId].deltaPct > 0 ? "+" : ""}${changes[
                        horse.tokenId
                      ].deltaPct.toFixed(1)}%`}
                    </span>
                  ) : (
                    <span className="text-[11px] text-muted-foreground/70">
                      —
                    </span>
                  )}
                </TableCell>
                <TableCell className="font-mono">
                  {(horse.pedigreeScore / 100).toFixed(1)}%
                </TableCell>
                <TableCell className="font-mono">
                  {horse.age != null ? `${horse.age} yr` : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {!noAddress && !isLoading && results.every((r) => r == null) && (
        <p className="text-stone-500 text-sm">
          No horses yet. Deploy and run seed:demo to mint demo horses.
        </p>
      )}
    </div>
  );
}
