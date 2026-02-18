"use client";

import { useReadContracts } from "wagmi";
import { addresses, abis } from "@/lib/contracts";
import { calculateOfficialAge } from "../../../shared/age";
import { AdiDisplay } from "@/components/AdiDisplay";
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
import { MAX_HORSE_ID_TO_FETCH, isOnChainHorse } from "@/lib/on-chain-horses";

const ZERO = "0x0000000000000000000000000000000000000000";

const HORSE_IDS = Array.from({ length: MAX_HORSE_ID_TO_FETCH }, (_, i) => i);

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
    contracts: HORSE_IDS.map((id) => ({
      address: addresses.horseINFT,
      abi: abis.HorseINFT,
      functionName: "getHorseData" as const,
      args: [BigInt(id)] as [bigint],
    })) as any,
  });

  const results = (contracts ?? []).map((c) => {
    if (c.status !== "success" || !c.result) return null;
    const r = c.result as any;
    if (!isOnChainHorse(r)) return null;
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
    return (results ?? [])
      .map((data: any, index: number) => {
        if (!data) return null;
        const tokenId = HORSE_IDS[index];
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
        // best-effort: ignore errors
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
      className="cursor-pointer hover:text-brand-ivory transition-colors text-[10px] font-sans uppercase tracking-widest text-muted-foreground/80 py-4"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1.5">
        {label}
        <ArrowUpDown className="h-3 w-3 opacity-50" />
      </div>
    </TableHead>
  );

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto p-2">
      <div className="flex items-center justify-between border-b border-white/5 pb-6">
        <div>
          <h1 className="text-3xl font-heading font-bold tracking-wide text-brand-ivory">
            Marketplace
          </h1>
          <p className="text-sm text-muted-foreground mt-1 font-sans">
            Listed thoroughbreds available for private treaty or auction.
          </p>
        </div>
        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
          <Input
            placeholder="Search thoroughbreds..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 pl-10 bg-white/5 border-white/5 text-sm font-sans text-brand-ivory placeholder:text-muted-foreground/40 rounded-full focus:bg-white/10 focus:border-white/10 transition-all"
          />
        </div>
      </div>

      <div className="rounded-lg border border-white/10 overflow-hidden bg-card/60 backdrop-blur-sm shadow-xl">
        <details className="text-xs text-muted-foreground border-b border-white/5 p-3 bg-black/20">
          <summary className="cursor-pointer text-muted-foreground hover:text-brand-ivory transition-colors">
            Debug: contract read diagnostics
          </summary>
          <pre className="mt-2 overflow-auto max-h-48 p-2 bg-black/40 rounded">
            {JSON.stringify({
              horseINFT: addresses.horseINFT,
              isLoading,
              isError,
              error: error?.message ?? null,
              contractCount: contracts?.length ?? 0,
              statuses: contracts?.map((c) => c.status) ?? [],
            }, null, 2)}
          </pre>
        </details>

        <Table>
          <TableHeader className="bg-white/5 border-b border-white/5">
            <TableRow className="hover:bg-transparent border-white/5">
              <SortHeader label="Horse" field="name" />
              <SortHeader label="Valuation (ADI)" field="valuationADI" />
              <TableHead className="text-[10px] font-sans uppercase tracking-widest text-muted-foreground/80 py-4">
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
                className="hover:bg-white/5 border-white/5 transition-colors cursor-pointer group"
                onClick={() => router.push(`/horse/${horse.tokenId}`)}
              >
                <TableCell className="font-medium">
                  <span className="text-brand-ivory group-hover:text-prestige-gold transition-colors font-sans text-base">
                    {horse.name}
                  </span>
                  {horse.breedingAvailable && (
                    <span className="ml-2 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-sm bg-prestige-gold/10 text-prestige-gold border border-prestige-gold/20">
                      Stud Ready
                    </span>
                  )}
                </TableCell>
                <TableCell className="font-heading font-medium text-brand-ivory tracking-wide">
                  <AdiDisplay value={horse.valuationADI} />
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {changes[horse.tokenId] ? (
                    <span
                      className={`inline-flex items-center gap-1 font-bold ${changes[horse.tokenId].direction === "up"
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
                <TableCell className="font-mono text-muted-foreground">
                  <span className="text-brand-ivory/80">{(horse.pedigreeScore / 100).toFixed(1)}</span>
                  <span className="text-muted-foreground/60">%</span>
                </TableCell>
                <TableCell className="font-sans text-muted-foreground text-xs">
                  {horse.age != null ? `${horse.age} yr` : "—"}
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  No thoroughbreds found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {!noAddress && !isLoading && results.every((r) => r == null) && (
        <p className="text-stone-500 text-sm mt-4 text-center">
          No on-chain horses yet. Deploy contracts and run the seed script to mint horses.
        </p>
      )}
    </div>
  );
}
