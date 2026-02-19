"use client";

import { useAccount, useReadContract, useReadContracts } from "wagmi";
import { addresses, abis } from "@/lib/contracts";
import { formatEther } from "viem";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { formatMoneyFull } from "@/lib/format";
import type {
  PortfolioHolding,
  PortfolioKPIs,
  TopPerformer,
  RevenueBreakdownItem,
} from "@/data/mockPortfolio";

const vaultAbi = [
  "function claimableFor(address) view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
] as const;

export default function PortfolioPage() {
  const { address } = useAccount();

  const { data: balances } = useReadContract({
    address: addresses.adiToken,
    abi: abis.MockADI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
  });

  const horseCalls = address
    ? [0, 1, 2, 3, 4, 5].map((i) => ({
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

  const claimableCalls =
    address && vaults.length > 0
      ? vaults.flatMap((v) => [
          {
            address: v.address,
            abi: vaultAbi,
            functionName: "claimableFor" as const,
            args: [address],
          },
          {
            address: v.address,
            abi: vaultAbi,
            functionName: "balanceOf" as const,
            args: [address],
          },
        ])
      : [];

  const { data: vaultPositions } = useReadContracts({
    contracts: claimableCalls as any,
  });

  const revenueRows =
    vaults.length && vaultPositions?.length === vaults.length * 2
      ? vaults.map((v, idx) => {
          const claimableRes = vaultPositions[idx * 2];
          const balanceRes = vaultPositions[idx * 2 + 1];
          const claimable =
            claimableRes?.status === "success"
              ? (claimableRes.result as bigint)
              : 0n;
          const balance =
            balanceRes?.status === "success"
              ? (balanceRes.result as bigint)
              : 0n;
          return {
            horseId: v.horseId,
            claimable,
            balance,
          };
        })
      : [];

  const holdings: PortfolioHolding[] = revenueRows.map((r) => ({
    asset: `Horse #${r.horseId}`,
    horseId: r.horseId,
    shares: Number(r.balance),
    totalShares: 10000,
    value: Number(r.claimable) / 1e18 * 2,
    pnlPct: 0,
    claimable: Number(r.claimable) / 1e18,
  }));

  const totalClaimable = revenueRows.reduce(
    (acc, r) => acc + r.claimable,
    0n,
  );

  const kpis: PortfolioKPIs = {
    totalValue: holdings.reduce((a, h) => a + h.value, 0),
    totalValueDeltaPct: 0,
    claimableRevenue: Number(totalClaimable) / 1e18,
    activeRights: vaults.length,
    avgReturn: 0,
    avgReturnDeltaPct: 0,
  };

  const topPerformer: TopPerformer | null =
    holdings.length > 0
      ? holdings.reduce((best, h) =>
          h.pnlPct > (best?.pnlPct ?? -Infinity) ? h : best,
        ) as TopPerformer
      : null;

  const revenueBreakdown: RevenueBreakdownItem[] = holdings.map((h) => ({
    asset: h.asset,
    horseId: h.horseId,
    claimable: h.claimable,
  }));

  const maxRevenue = Math.max(
    ...revenueBreakdown.map((r) => r.claimable),
    1,
  );

  const handleClaim = (horseId: number) => {
    console.log("Claim", horseId);
    if (typeof window !== "undefined" && (window as any).toast) {
      (window as any).toast(`Claim initiated for Horse #${horseId}`);
    }
  };

  return (
    <div className="space-y-8 max-w-6xl">
      <header className="space-y-1">
        <h1 className="text-3xl font-heading font-bold text-prestige-gold tracking-wide">
          Stable
        </h1>
        <p className="text-xs font-sans tracking-[0.2em] text-muted-foreground uppercase">
          PORTFOLIO OVERVIEW
        </p>
      </header>

      {!address ? (
        <p className="text-sm text-muted-foreground">
          Connect your wallet to see your portfolio.
        </p>
      ) : (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-lg border border-white/10 bg-black/20 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.03)]">
              <p className="text-[10px] font-sans tracking-wider text-muted-foreground uppercase mb-2">
                TOTAL VALUE
              </p>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-2xl font-bold text-foreground">
                  {formatMoneyFull(kpis.totalValue)}
                </span>
                {kpis.totalValueDeltaPct > 0 && (
                  <span className="text-xs text-terminal-green flex items-center gap-0.5 shrink-0">
                    <ArrowUpRight className="h-3.5 w-3.5" />
                    +{kpis.totalValueDeltaPct.toFixed(1)}%
                  </span>
                )}
              </div>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/20 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.03)]">
              <p className="text-[10px] font-sans tracking-wider text-muted-foreground uppercase mb-2">
                CLAIMABLE REVENUE
              </p>
              <span className="text-2xl font-bold text-foreground">
                {formatMoneyFull(kpis.claimableRevenue)}
              </span>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/20 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.03)]">
              <p className="text-[10px] font-sans tracking-wider text-muted-foreground uppercase mb-2">
                ACTIVE RIGHTS
              </p>
              <span className="text-2xl font-bold text-foreground">
                {kpis.activeRights}
              </span>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/20 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.03)]">
              <p className="text-[10px] font-sans tracking-wider text-muted-foreground uppercase mb-2">
                AVG. RETURN
              </p>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-2xl font-bold text-foreground">
                  {kpis.avgReturn.toFixed(1)}%
                </span>
                {kpis.avgReturnDeltaPct > 0 && (
                  <span className="text-xs text-terminal-green flex items-center gap-0.5 shrink-0">
                    <ArrowUpRight className="h-3.5 w-3.5" />
                    +{kpis.avgReturnDeltaPct.toFixed(1)}%
                  </span>
                )}
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-[10px] font-sans tracking-[0.2em] text-muted-foreground uppercase">
              HOLDINGS
            </h2>
            <div className="rounded-lg border border-white/10 bg-black/20 overflow-hidden shadow-[0_0_0_1px_rgba(255,255,255,0.03)]">
              {holdings.length === 0 ? (
                <div className="p-12 text-center">
                  <p className="text-sm text-muted-foreground">
                    No holdings yet. Buy shares from{" "}
                    <Link
                      href="/marketplace"
                      className="text-prestige-gold hover:underline"
                    >
                      Market
                    </Link>{" "}
                    or mint via{" "}
                    <Link
                      href="/breed"
                      className="text-prestige-gold hover:underline"
                    >
                      Breeding Lab
                    </Link>
                    .
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="py-4 px-4 text-left text-[10px] font-sans tracking-wider text-muted-foreground uppercase">
                          ASSET
                        </th>
                        <th className="py-4 px-4 text-left text-[10px] font-sans tracking-wider text-muted-foreground uppercase">
                          SHARES
                        </th>
                        <th className="py-4 px-4 text-left text-[10px] font-sans tracking-wider text-muted-foreground uppercase">
                          VALUE
                        </th>
                        <th className="py-4 px-4 text-left text-[10px] font-sans tracking-wider text-muted-foreground uppercase">
                          PNL
                        </th>
                        <th className="py-4 px-4 text-left text-[10px] font-sans tracking-wider text-muted-foreground uppercase">
                          CLAIMABLE
                        </th>
                        <th className="py-4 px-4 text-right text-[10px] font-sans tracking-wider text-muted-foreground uppercase">
                          ACTION
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {holdings.map((row) => (
                        <tr
                          key={row.horseId}
                          className="border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors"
                        >
                          <td className="py-4 px-4">
                            <Link
                              href={`/horse/${row.horseId}`}
                              className="font-semibold text-foreground hover:text-prestige-gold transition-colors"
                            >
                              {row.asset}
                            </Link>
                          </td>
                          <td className="py-4 px-4 text-muted-foreground">
                            {row.shares}/{row.totalShares.toLocaleString()}
                          </td>
                          <td className="py-4 px-4 text-foreground">
                            {formatMoneyFull(row.value)}
                          </td>
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-2">
                              <span
                                className={`text-terminal-green flex items-center gap-0.5 ${
                                  row.pnlPct < 0 ? "text-terminal-red" : ""
                                }`}
                              >
                                <ArrowUpRight
                                  className={`h-3.5 w-3.5 ${
                                    row.pnlPct < 0 ? "rotate-180" : ""
                                  }`}
                                />
                                {row.pnlPct >= 0 ? "+" : ""}
                                {row.pnlPct.toFixed(1)}%
                              </span>
                              <div className="w-16 h-1 rounded-full bg-white/10 overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-terminal-green"
                                  style={{
                                    width: `${Math.min(
                                      Math.abs(row.pnlPct) / 30,
                                      1,
                                    ) * 100}%`,
                                  }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-4 font-semibold text-prestige-gold">
                            {formatMoneyFull(row.claimable)}
                          </td>
                          <td className="py-4 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => handleClaim(row.horseId)}
                              className="px-3 py-1.5 rounded border border-white/20 text-foreground text-xs hover:bg-white/10 transition-colors"
                            >
                              Claim
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>

          {holdings.length > 0 && (
            <section className="grid gap-6 lg:grid-cols-2">
              {topPerformer && (
                <div className="rounded-lg border border-white/10 bg-black/20 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.03)]">
                  <h3 className="text-[10px] font-sans tracking-[0.2em] text-prestige-gold uppercase mb-4">
                    TOP PERFORMER
                  </h3>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Link
                        href={`/horse/${topPerformer.horseId}`}
                        className="font-semibold text-foreground hover:text-prestige-gold transition-colors"
                      >
                        {topPerformer.asset}
                      </Link>
                      <span className="text-terminal-green text-sm font-medium flex items-center gap-0.5">
                        <ArrowUpRight className="h-3.5 w-3.5" />
                        +{topPerformer.pnlPct.toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full h-1 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-terminal-green"
                        style={{
                          width: `${Math.min(
                            topPerformer.pnlPct / 30,
                            1,
                          ) * 100}%`,
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground pt-1">
                      <span>{topPerformer.shares} shares</span>
                      <span>{formatMoneyFull(topPerformer.value)}</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="rounded-lg border border-white/10 bg-black/20 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.03)]">
                <h3 className="text-[10px] font-sans tracking-[0.2em] text-prestige-gold uppercase mb-4">
                  REVENUE BREAKDOWN
                </h3>
                <div className="space-y-3">
                  {revenueBreakdown.length > 0 ? (
                    revenueBreakdown.map((item) => (
                      <div
                        key={item.horseId}
                        className="flex items-center gap-3"
                      >
                        <Link
                          href={`/horse/${item.horseId}`}
                          className="w-32 shrink-0 text-sm text-foreground hover:text-prestige-gold transition-colors"
                        >
                          {item.asset}
                        </Link>
                        <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden min-w-[60px]">
                          <div
                            className="h-full rounded-full bg-prestige-gold"
                            style={{
                              width: `${Math.max(
                                (item.claimable / maxRevenue) * 100,
                                8,
                              )}%`,
                            }}
                          />
                        </div>
                        <span className="w-20 text-right font-semibold text-prestige-gold shrink-0">
                          {formatMoneyFull(item.claimable)}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No revenue yet.
                    </p>
                  )}
                </div>
              </div>
            </section>
          )}

          <section className="rounded-lg border border-white/10 bg-black/20 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.03)]">
            <h2 className="text-xs font-semibold text-foreground tracking-wide mb-2">
              Agents and advisors
            </h2>
            <p className="text-[11px] text-muted-foreground mb-3">
              Use the breeding agents to optimize new offspring, then
              fractionalize via vaults to turn race and breeding revenue into
              portfolio flows.
            </p>
            <Link
              href="/agent"
              className="inline-flex px-4 py-2 rounded-md bg-prestige-gold text-background font-medium hover:bg-prestige-gold/90 transition-colors text-sm"
            >
              Open agents console
            </Link>
          </section>
        </>
      )}
    </div>
  );
}
