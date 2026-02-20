"use client";

import { useAccount, useReadContracts } from "wagmi";
import { addresses, abis } from "@/lib/contracts";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { MAX_HORSE_ID_TO_FETCH } from "@/lib/on-chain-horses";
import { parseRawHorseData } from "@/lib/on-chain-mapping";

export default function VaultIndexPage() {
  const { address } = useAccount();

  const horseCalls = address
    ? Array.from({ length: MAX_HORSE_ID_TO_FETCH }, (_, i) => ({
        address: addresses.horseINFT,
        abi: abis.HorseINFT,
        functionName: "ownerOf" as const,
        args: [BigInt(i)] as [bigint],
      }))
    : [];

  const { data: horseOwnership } = useReadContracts({
    contracts: horseCalls as any,
  });

  const myHorses =
    horseOwnership
      ?.map((c, i) =>
        c.status === "success" && c.result === address ? i : -1,
      )
      .filter((i) => i >= 0) ?? [];

  const vaultForHorseCalls =
    address && myHorses.length > 0
      ? myHorses.map((id) => ({
          address: addresses.syndicateVaultFactory,
          abi: abis.HorseSyndicateVaultFactory,
          functionName: "vaultForHorse" as const,
          args: [BigInt(id)] as [bigint],
        }))
      : [];

  const { data: vaultAddresses } = useReadContracts({
    contracts: vaultForHorseCalls as any,
  });

  const vaults =
    (vaultAddresses
      ?.map((c, i) => {
        if (!c || c.status !== "success") return null;
        const addr = c.result as string;
        if (!addr || addr === "0x0000000000000000000000000000000000000000") {
          return null;
        }
        return { horseId: myHorses[i], address: addr as `0x${string}` };
      })
      .filter(Boolean) as { horseId: number; address: `0x${string}` }[]) ?? [];

  const horseDataCalls =
    vaults.length > 0
      ? vaults.map((v) => ({
          address: addresses.horseINFT,
          abi: abis.HorseINFT,
          functionName: "getHorseData" as const,
          args: [BigInt(v.horseId)] as [bigint],
        }))
      : [];

  const { data: horseDataResults } = useReadContracts({
    contracts: horseDataCalls as any,
  });

  const horseNames: Record<number, string> = {};
  horseDataResults?.forEach((res, i) => {
    const horseId = vaults[i]?.horseId;
    if (horseId != null && res?.status === "success") {
      const raw = parseRawHorseData(res.result);
      horseNames[horseId] = raw?.name?.trim() || `Horse #${horseId}`;
    }
  });

  return (
    <div className="space-y-8 max-w-6xl">
      <header className="space-y-1">
        <h1 className="text-3xl font-heading font-bold text-prestige-gold tracking-wide">
          Vaults
        </h1>
        <p className="text-xs font-sans tracking-[0.2em] text-muted-foreground uppercase">
          FRACTIONAL OWNERSHIP VAULTS
        </p>
      </header>

      {!address ? (
        <p className="text-sm text-muted-foreground">
          Connect your wallet to see your vaults.
        </p>
      ) : vaults.length === 0 ? (
        <div className="rounded-lg border border-white/10 bg-black/20 p-12 text-center">
          <p className="text-sm text-muted-foreground mb-4">
            No vaults yet. Create a vault from a horse you own, or view your
            portfolio for vault positions.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              href="/marketplace"
              className="inline-flex items-center gap-1 px-4 py-2 rounded-md bg-prestige-gold text-background font-medium hover:bg-prestige-gold/90 text-sm"
            >
              Market
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
            <Link
              href="/portfolio"
              className="inline-flex items-center gap-1 px-4 py-2 rounded-md border border-white/20 text-foreground font-medium hover:bg-white/10 text-sm"
            >
              Portfolio
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-white/10 bg-black/20 overflow-hidden shadow-[0_0_0_1px_rgba(255,255,255,0.03)]">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="py-4 px-4 text-left text-[10px] font-sans tracking-wider text-muted-foreground uppercase">
                    HORSE
                  </th>
                  <th className="py-4 px-4 text-left text-[10px] font-sans tracking-wider text-muted-foreground uppercase">
                    VAULT ADDRESS
                  </th>
                  <th className="py-4 px-4 text-right text-[10px] font-sans tracking-wider text-muted-foreground uppercase">
                    ACTION
                  </th>
                </tr>
              </thead>
              <tbody>
                {vaults.map((v) => (
                  <tr
                    key={v.horseId}
                    className="border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="py-4 px-4">
                      <Link
                        href={`/horse/${v.horseId}`}
                        className="font-semibold text-foreground hover:text-prestige-gold transition-colors"
                      >
                        {horseNames[v.horseId] ?? `Horse #${v.horseId}`}
                      </Link>
                    </td>
                    <td className="py-4 px-4 font-mono text-muted-foreground text-xs">
                      {v.address.slice(0, 10)}...{v.address.slice(-8)}
                    </td>
                    <td className="py-4 px-4 text-right">
                      <Link
                        href={`/vault/${v.horseId}`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded border border-white/20 text-foreground text-xs hover:bg-white/10 transition-colors"
                      >
                        View vault
                        <ArrowUpRight className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
