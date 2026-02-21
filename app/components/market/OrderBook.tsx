"use client";

import { useReadContracts } from "wagmi";
import { addresses, abis } from "@/lib/contracts";
import { formatEther } from "viem";
import { useMemo } from "react";
import { BookOpen } from "lucide-react";
import { formatMoneyCompact } from "@/lib/format";

export type OrderBookRow = {
  horseId: number;
  horseName: string;
  askPriceADI: number;
  availableShares: number;
  lastTradeADI: number;
  volume24hADI: number;
  spreadPct: number;
};

interface OrderBookProps {
  horseIds: number[];
  horseNames: Record<number, string>;
  isLoading?: boolean;
}

export function OrderBook({ horseIds, horseNames, isLoading }: OrderBookProps) {
  const vaultCalls = useMemo(
    () =>
      horseIds.map((id) => ({
        address: addresses.syndicateVaultFactory,
        abi: abis.HorseSyndicateVaultFactory,
        functionName: "vaultForHorse" as const,
        args: [BigInt(id)] as const,
      })),
    [horseIds]
  );

  const { data: vaultResults } = useReadContracts({ contracts: vaultCalls });

  const vaultAddresses = useMemo(() => {
    if (!vaultResults) return [];
    return vaultResults.map((r, i) => {
      const addr = r.result as `0x${string}` | undefined;
      if (!addr || addr === "0x0000000000000000000000000000000000000000") return null;
      return { horseId: horseIds[i]!, addr };
    }).filter((x): x is { horseId: number; addr: `0x${string}` } => x != null);
  }, [vaultResults, horseIds]);

  const vaultDataCalls = useMemo(() => {
    const calls: { address: `0x${string}`; abi: typeof abis.HorseSyndicateVault; functionName: string; args?: unknown[] }[] = [];
    for (const { addr } of vaultAddresses) {
      calls.push({ address: addr, abi: abis.HorseSyndicateVault, functionName: "sharePriceADI" });
      calls.push({ address: addr, abi: abis.HorseSyndicateVault, functionName: "totalShares" });
      calls.push({ address: addr, abi: abis.HorseSyndicateVault, functionName: "totalSupply" });
      calls.push({ address: addr, abi: abis.HorseSyndicateVault, functionName: "navPerShare" });
    }
    return calls;
  }, [vaultAddresses]);

  const { data: vaultDataResults } = useReadContracts({
    contracts: vaultDataCalls.length > 0 ? vaultDataCalls : [],
  });

  const rows = useMemo((): OrderBookRow[] => {
    if (!vaultDataResults || vaultAddresses.length === 0) return [];
    const out: OrderBookRow[] = [];
    const stride = 4;
    for (let i = 0; i < vaultAddresses.length; i++) {
      const { horseId } = vaultAddresses[i]!;
      const base = i * stride;
      const sharePrice = vaultDataResults[base]?.result as bigint | undefined;
      const totalShares = vaultDataResults[base + 1]?.result as bigint | undefined;
      const totalSupply = vaultDataResults[base + 2]?.result as bigint | undefined;
      const navPerShare = vaultDataResults[base + 3]?.result as bigint | undefined;

      const askPriceADI = sharePrice != null ? Number(formatEther(sharePrice)) : 0;
      const totalSharesNum = totalShares != null ? Number(totalShares) : 0;
      const circulating = totalSupply != null ? Number(totalSupply) : 0;
      const availableShares = Math.max(0, totalSharesNum - circulating);
      const nav = navPerShare != null ? Number(formatEther(navPerShare)) : askPriceADI;
      const spreadPct = nav > 0 ? ((askPriceADI - nav) / nav) * 100 : 0;

      out.push({
        horseId,
        horseName: horseNames[horseId] ?? `Horse #${horseId}`,
        askPriceADI,
        availableShares,
        lastTradeADI: askPriceADI,
        volume24hADI: 0,
        spreadPct,
      });
    }
    return out;
  }, [vaultDataResults, vaultAddresses, horseNames]);

  if (isLoading) {
    return (
      <div className="rounded-lg border border-sidebar-border/60 bg-card p-6 animate-pulse">
        <div className="h-6 w-32 bg-white/10 rounded mb-4" />
        <div className="h-32 bg-white/5 rounded" />
      </div>
    );
  }

  if (rows.length === 0) return null;

  return (
    <div className="rounded-lg border border-sidebar-border/60 bg-card overflow-hidden shadow-[0_0_0_1px_rgba(255,255,255,0.03)]">
      <div className="flex items-center gap-2 p-4 border-b border-white/10">
        <BookOpen className="h-4 w-4 text-prestige-gold" />
        <span className="text-[10px] font-sans tracking-[0.2em] text-muted-foreground uppercase">
          Order Book (Vaults)
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[600px]">
          <thead>
            <tr className="border-b border-white/5">
              <th className="text-[10px] font-sans uppercase tracking-wider text-muted-foreground/80 py-3 px-4 text-left">HORSE</th>
              <th className="text-[10px] font-sans uppercase tracking-wider text-muted-foreground/80 py-3 px-4 text-right">ASK (ADI)</th>
              <th className="text-[10px] font-sans uppercase tracking-wider text-muted-foreground/80 py-3 px-4 text-right">AVAIL</th>
              <th className="text-[10px] font-sans uppercase tracking-wider text-muted-foreground/80 py-3 px-4 text-right">LAST</th>
              <th className="text-[10px] font-sans uppercase tracking-wider text-muted-foreground/80 py-3 px-4 text-right">24H VOL</th>
              <th className="text-[10px] font-sans uppercase tracking-wider text-muted-foreground/80 py-3 px-4 text-right">SPREAD</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.horseId} className="border-b border-white/5 last:border-0 hover:bg-white/[0.03]">
                <td className="py-3 px-4 font-medium text-foreground">{r.horseName}</td>
                <td className="py-3 px-4 text-right font-mono">{formatMoneyCompact(r.askPriceADI)}</td>
                <td className="py-3 px-4 text-right text-muted-foreground">{r.availableShares.toLocaleString()}</td>
                <td className="py-3 px-4 text-right font-mono">{formatMoneyCompact(r.lastTradeADI)}</td>
                <td className="py-3 px-4 text-right text-muted-foreground">{r.volume24hADI > 0 ? formatMoneyCompact(r.volume24hADI) : "—"}</td>
                <td className={`py-3 px-4 text-right font-medium ${r.spreadPct >= 0 ? "text-terminal-amber" : "text-terminal-green"}`}>
                  {r.spreadPct >= 0 ? "+" : ""}{r.spreadPct.toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
