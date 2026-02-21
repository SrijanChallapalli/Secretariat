"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useAccount, useChainId, useReadContract, useReadContracts, useWriteContract, useBlockNumber } from "wagmi";
import { parseAbi } from "viem";
import { addresses, abis } from "@/lib/contracts";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { formatMoneyFull } from "@/lib/format";
import type {
  PortfolioHolding,
  PortfolioKPIs,
  TopPerformer,
  RevenueBreakdownItem,
} from "@/data/mockPortfolio";
import { MAX_HORSE_ID_TO_FETCH, isOnChainHorse } from "@/lib/on-chain-horses";
import { parseRawHorseData, trackChangePct, demoChangePct } from "@/lib/on-chain-mapping";
import { formatEther } from "viem";
import { isDemoMode, getDemoEnrichment } from "@/lib/demo-enrichment";

const vaultAbi = parseAbi([
  "function claimableFor(address) view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function totalShares() view returns (uint256)",
  "function claim() external",
]);

const MINTED_HORSE_KEY = "secretariat_minted_horse";
const MINT_CORRELATION_KEY = "secretariat_mint_correlation_id";
const DEBUG_MINT_TRACE = typeof window !== "undefined" && process.env.NEXT_PUBLIC_DEBUG_MINT_TRACE === "true";

export default function PortfolioPage() {
  const searchParams = useSearchParams();
  const { address } = useAccount();
  const chainId = useChainId();
  const [claimStatus, setClaimStatus] = useState<string | null>(null);
  const [mintedId, setMintedId] = useState<number | null>(null);
  const [syncingRetries, setSyncingRetries] = useState(0);

  useEffect(() => {
    const fromUrl = searchParams.get("minted");
    if (fromUrl) {
      const n = parseInt(fromUrl, 10);
      if (!Number.isNaN(n)) {
        setMintedId(n);
        return;
      }
    }
    if (typeof window !== "undefined") {
      const fromStorage = sessionStorage.getItem(MINTED_HORSE_KEY);
      if (fromStorage) {
        const n = parseInt(fromStorage, 10);
        if (!Number.isNaN(n)) setMintedId(n);
      }
    }
  }, [searchParams]);
  const { writeContract } = useWriteContract();
  const { data: latestBlock } = useBlockNumber({ watch: true });

  const { data: balances, isLoading: balLoading } = useReadContract({
    address: addresses.adiToken,
    abi: abis.MockADI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
  });

  const horseDataCalls = Array.from({ length: MAX_HORSE_ID_TO_FETCH }, (_, i) => ({
    address: addresses.horseINFT,
    abi: abis.HorseINFT,
    functionName: "getHorseData" as const,
    args: [BigInt(i)] as [bigint],
  }));
  const { data: allHorseData, refetch: refetchHorses } = useReadContracts({
    contracts: horseDataCalls as any,
    query: { structuralSharing: false },
  });

  const existingHorseIds =
    allHorseData
      ?.map((c, i) =>
        c.status === "success" && c.result && isOnChainHorse(c.result) ? i : -1,
      )
      .filter((i) => i >= 0) ?? [];

  // Only call ownerOf for horses that exist (avoids reverts)
  const ownerOfCalls =
    address && existingHorseIds.length > 0
      ? existingHorseIds.map((id) => ({
          address: addresses.horseINFT,
          abi: abis.HorseINFT,
          functionName: "ownerOf" as const,
          args: [BigInt(id)] as [bigint],
        }))
      : [];
  const { data: horseOwnership, refetch: refetchOwnership } = useReadContracts({
    contracts: ownerOfCalls as any,
    query: { structuralSharing: false },
  });

  useEffect(() => {
    if (latestBlock) {
      refetchHorses();
      refetchOwnership();
    }
  }, [latestBlock, refetchHorses, refetchOwnership]);

  const myHorses =
    horseOwnership
      ?.map((c, i) => {
        if (c.status !== "success" || !c.result || !address) return -1;
        const owner = String(c.result).toLowerCase();
        const me = String(address).toLowerCase();
        if (DEBUG_MINT_TRACE && existingHorseIds[i] !== undefined) {
          console.debug("[MintTrace] owner match", { owner, me, match: owner === me, tokenId: existingHorseIds[i] });
        }
        return owner === me ? existingHorseIds[i] : -1;
      })
      .filter((i) => i >= 0) ?? [];

  const needsFallbackRead =
    mintedId != null &&
    address &&
    (mintedId >= MAX_HORSE_ID_TO_FETCH || !existingHorseIds.includes(mintedId));
  const fallbackCalls = needsFallbackRead
    ? [
        {
          address: addresses.horseINFT,
          abi: abis.HorseINFT,
          functionName: "getHorseData" as const,
          args: [BigInt(mintedId!)] as [bigint],
        },
        {
          address: addresses.horseINFT,
          abi: abis.HorseINFT,
          functionName: "ownerOf" as const,
          args: [BigInt(mintedId!)] as [bigint],
        },
      ]
    : [];
  const { data: fallbackData } = useReadContracts({
    contracts: fallbackCalls as any,
  });

  const fallbackOwnedMintedId =
    needsFallbackRead &&
    fallbackData &&
    fallbackData.length >= 2 &&
    fallbackData[0]?.status === "success" &&
    fallbackData[0]?.result &&
    isOnChainHorse(fallbackData[0].result) &&
    fallbackData[1]?.status === "success" &&
    fallbackData[1]?.result &&
    String(fallbackData[1].result).toLowerCase() === String(address).toLowerCase()
      ? mintedId
      : null;

  const myHorsesWithFallback =
    fallbackOwnedMintedId != null && !myHorses.includes(fallbackOwnedMintedId)
      ? [...myHorses, fallbackOwnedMintedId]
      : myHorses;

  const isMintedHorseSynced = mintedId != null && myHorsesWithFallback.includes(mintedId);

  useEffect(() => {
    if (DEBUG_MINT_TRACE && address && chainId) {
      const correlationId = typeof window !== "undefined" ? sessionStorage.getItem(MINT_CORRELATION_KEY) : null;
      console.debug("[MintTrace] portfolio fetch", { correlationId, address, chainId, existingHorseIds, myHorses: myHorsesWithFallback });
    }
  }, [address, chainId, existingHorseIds, myHorsesWithFallback]);

  useEffect(() => {
    if (mintedId == null || isMintedHorseSynced || syncingRetries >= 5) {
      if (isMintedHorseSynced && typeof window !== "undefined") {
        sessionStorage.removeItem(MINTED_HORSE_KEY);
        sessionStorage.removeItem(MINT_CORRELATION_KEY);
        setMintedId(null);
        setSyncingRetries(0);
      }
      return;
    }
    const t = setTimeout(async () => {
      await refetchHorses();
      refetchOwnership();
      setSyncingRetries((r) => r + 1);
    }, 2000);
    return () => clearTimeout(t);
  }, [mintedId, isMintedHorseSynced, syncingRetries, refetchHorses, refetchOwnership]);

  const vaultForHorseCalls =
    address && myHorsesWithFallback.length > 0
      ? myHorsesWithFallback.map((id) => ({
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
        return { horseId: myHorsesWithFallback[i], address: addr as `0x${string}` };
      })
      .filter(Boolean) as { horseId: number; address: `0x${string}` }[]) ?? [];

  const horseNames: Record<number, string> = {};
  const horseValuations: Record<number, bigint> = {};
  const horsePnl: Record<number, number> = {};
  const demo = isDemoMode();
  allHorseData?.forEach((res, i) => {
    if (res?.status === "success" && res.result) {
      const raw = parseRawHorseData(res.result);
      const name = raw?.name?.trim() || `Horse #${i}`;
      horseNames[i] = name;
      if (raw) {
        horseValuations[i] = raw.valuationADI;
        const valNum = Number(formatEther(raw.valuationADI));
        const livePct = trackChangePct(i, valNum);
        const enrichment = demo ? getDemoEnrichment(i, name, valNum, raw.birthTimestamp) : null;
        horsePnl[i] = livePct !== 0 ? livePct : (enrichment?.changePct ?? 0);
      }
    }
  });
  if (fallbackOwnedMintedId != null && fallbackData?.[0]?.status === "success" && fallbackData[0].result) {
    const raw = parseRawHorseData(fallbackData[0].result);
    const name = raw?.name?.trim() || `Horse #${fallbackOwnedMintedId}`;
    horseNames[fallbackOwnedMintedId] = name;
    if (raw) {
      horseValuations[fallbackOwnedMintedId] = raw.valuationADI;
      const valNum = Number(formatEther(raw.valuationADI));
      const livePct = trackChangePct(fallbackOwnedMintedId, valNum);
      const enrichment = demo ? getDemoEnrichment(fallbackOwnedMintedId, name, valNum, raw.birthTimestamp) : null;
      horsePnl[fallbackOwnedMintedId] = livePct !== 0 ? livePct : (enrichment?.changePct ?? 0);
    }
  }

  const VAULT_CALLS_PER = 3;
  const vaultDetailCalls =
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
          {
            address: v.address,
            abi: vaultAbi,
            functionName: "totalShares" as const,
          },
        ])
      : [];

  const { data: vaultPositions } = useReadContracts({
    contracts: vaultDetailCalls as any,
  });

  const revenueRows =
    vaults.length && vaultPositions?.length === vaults.length * VAULT_CALLS_PER
      ? vaults.map((v, idx) => {
          const claimableRes = vaultPositions[idx * VAULT_CALLS_PER];
          const balanceRes = vaultPositions[idx * VAULT_CALLS_PER + 1];
          const totalSharesRes = vaultPositions[idx * VAULT_CALLS_PER + 2];
          const claimable =
            claimableRes?.status === "success"
              ? (claimableRes.result as bigint)
              : 0n;
          const balance =
            balanceRes?.status === "success"
              ? (balanceRes.result as bigint)
              : 0n;
          const totalShares =
            totalSharesRes?.status === "success"
              ? (totalSharesRes.result as bigint)
              : 10000n;
          return {
            horseId: v.horseId,
            claimable,
            balance,
            totalShares,
          };
        })
      : [];

  const vaultHoldings: PortfolioHolding[] = revenueRows.map((r) => {
    const valuation = horseValuations[r.horseId] ?? 0n;
    const proportionalValue = r.totalShares > 0n
      ? (valuation * r.balance) / r.totalShares
      : 0n;
    return {
      asset: horseNames[r.horseId] ?? `Horse #${r.horseId}`,
      horseId: r.horseId,
      shares: r.balance,
      totalShares: r.totalShares,
      value: proportionalValue,
      pnlPct: horsePnl[r.horseId] ?? 0,
      claimable: r.claimable,
      isOwnerOnly: false,
    };
  });

  const DEFAULT_TOTAL_SHARES = 10000n;
  const vaultHorseIds = new Set(vaultHoldings.map((h) => h.horseId));
  const ownedOnlyHoldings: PortfolioHolding[] = myHorsesWithFallback
    .filter((id) => !vaultHorseIds.has(id))
    .map((id) => ({
      asset: horseNames[id] ?? `Horse #${id}`,
      horseId: id,
      shares: DEFAULT_TOTAL_SHARES,
      totalShares: DEFAULT_TOTAL_SHARES,
      value: horseValuations[id] ?? 0n,
      pnlPct: horsePnl[id] ?? 0,
      claimable: 0n,
      isOwnerOnly: true,
    }));

  const holdings: PortfolioHolding[] = [...ownedOnlyHoldings, ...vaultHoldings];

  const totalClaimable = revenueRows.reduce(
    (acc, r) => acc + r.claimable,
    0n,
  );

  const totalPortfolioValue = holdings.reduce((acc, h) => acc + h.value, 0n);

  const avgPnl = holdings.length > 0
    ? holdings.reduce((sum, h) => sum + h.pnlPct, 0) / holdings.length
    : 0;
  const kpis: PortfolioKPIs = {
    totalValue: Number(totalPortfolioValue) / 1e18,
    totalValueDeltaPct: avgPnl,
    claimableRevenue: Number(totalClaimable) / 1e18,
    activeRights: vaults.length,
    avgReturn: avgPnl,
    avgReturnDeltaPct: 0,
  };

  const topPerformer: TopPerformer | null =
    holdings.length > 0
      ? holdings.reduce((best, h) =>
          h.pnlPct > (best?.pnlPct ?? -Infinity) ? h : best,
        ) as TopPerformer
      : null;

  const revenueBreakdown: RevenueBreakdownItem[] = revenueRows.map((r) => ({
    asset: horseNames[r.horseId] ?? `Horse #${r.horseId}`,
    horseId: r.horseId,
    claimable: r.claimable,
  }));

  const maxRevenue = Math.max(
    ...revenueBreakdown.map((r) => Number(r.claimable)),
    1,
  );

  const handleClaim = (horseId: number) => {
    const vault = vaults.find((v) => v.horseId === horseId);
    if (!vault) return;
    const displayName = horseNames[horseId] ?? `Horse #${horseId}`;
    setClaimStatus(`Claiming revenue for ${displayName}…`);
    writeContract({
      address: vault.address,
      abi: vaultAbi,
      functionName: "claim",
    }, {
      onSuccess: () => setClaimStatus(`Claim submitted for ${displayName}!`),
      onError: (err) => setClaimStatus(`Claim error: ${err.message.slice(0, 80)}`),
    });
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

      {claimStatus && (
        <div className={`rounded-lg border p-3 text-sm ${claimStatus.includes("error") ? "border-red-500/30 bg-red-500/5 text-red-400" : "border-terminal-green/30 bg-terminal-green/5 text-terminal-green"}`}>
          {claimStatus}
          <button type="button" onClick={() => setClaimStatus(null)} className="ml-2 text-xs underline opacity-70">dismiss</button>
        </div>
      )}

      {mintedId != null && !isMintedHorseSynced && (
        <div className="rounded-lg border border-prestige-gold/40 bg-prestige-gold/5 p-3 text-sm text-prestige-gold">
          Minted, syncing… Horse #{mintedId} will appear shortly. {syncingRetries < 5 ? `Refreshing (${syncingRetries}/5)…` : "Click Refresh above if it doesn&apos;t appear."}
        </div>
      )}

      {!address ? (
        <p className="text-sm text-muted-foreground">
          Connect your wallet to see your portfolio.
        </p>
      ) : balLoading ? (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-lg border border-sidebar-border/60 bg-card p-5 animate-pulse">
                <div className="h-3 w-20 bg-white/10 rounded mb-3" />
                <div className="h-7 w-28 bg-white/10 rounded" />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-lg border border-sidebar-border/60 bg-card p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.03)]">
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
            <div className="rounded-lg border border-sidebar-border/60 bg-card p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.03)]">
              <p className="text-[10px] font-sans tracking-wider text-muted-foreground uppercase mb-2">
                CLAIMABLE REVENUE
              </p>
              <span className="text-2xl font-bold text-foreground">
                {formatMoneyFull(kpis.claimableRevenue)}
              </span>
            </div>
            <div className="rounded-lg border border-sidebar-border/60 bg-card p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.03)]">
              <p className="text-[10px] font-sans tracking-wider text-muted-foreground uppercase mb-2">
                ACTIVE RIGHTS
              </p>
              <span className="text-2xl font-bold text-foreground">
                {kpis.activeRights}
              </span>
            </div>
            <div className="rounded-lg border border-sidebar-border/60 bg-card p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.03)]">
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
            <div className="flex items-center justify-between">
              <h2 className="text-[10px] font-sans tracking-[0.2em] text-muted-foreground uppercase">
                HOLDINGS
              </h2>
              <button
                type="button"
                onClick={async () => { await refetchHorses(); refetchOwnership(); }}
                className="text-[10px] text-prestige-gold hover:text-prestige-gold/80 transition-colors uppercase tracking-wider"
              >
                Refresh
              </button>
            </div>

            <div className="rounded-lg border border-sidebar-border/60 bg-card overflow-hidden shadow-[0_0_0_1px_rgba(255,255,255,0.03)]">
              {holdings.length === 0 ? (
                <div className="p-12 text-center">
                  <p className="text-sm text-muted-foreground">
                    No holdings yet. Mint via{" "}
                    <Link
                      href="/breed"
                      className="text-prestige-gold hover:underline"
                    >
                      Breeding Lab
                    </Link>{" "}
                    or buy from{" "}
                    <Link
                      href="/marketplace"
                      className="text-prestige-gold hover:underline"
                    >
                      Market
                    </Link>
                    .
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/5">
                        <th className="py-4 px-4 text-left text-[10px] font-sans tracking-wider text-muted-foreground uppercase">
                          ASSET
                        </th>
                        <th className="py-4 px-4 text-left text-[10px] font-sans tracking-wider text-muted-foreground uppercase">
                          TYPE
                        </th>
                        <th className="py-4 px-4 text-left text-[10px] font-sans tracking-wider text-muted-foreground uppercase">
                          SHARES
                        </th>
                        <th className="py-4 px-4 text-left text-[10px] font-sans tracking-wider text-muted-foreground uppercase">
                          VALUE
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
                            <td className="py-4 px-4">
                              <span className={`text-xs px-2 py-0.5 rounded-full border ${
                                row.isOwnerOnly
                                  ? "border-prestige-gold/30 text-prestige-gold bg-prestige-gold/10"
                                  : "border-white/20 text-muted-foreground bg-white/5"
                              }`}>
                                {row.isOwnerOnly ? "Owner" : "Shares"}
                              </span>
                            </td>
                            <td className="py-4 px-4 text-muted-foreground">
                              {`${row.shares}/${row.totalShares.toLocaleString()}`}
                            </td>
                            <td className="py-4 px-4 text-foreground">
                              {formatMoneyFull(Number(row.value) / 1e18)}
                            </td>
                            <td className="py-4 px-4 font-semibold text-prestige-gold">
                              {row.claimable > 0n ? formatMoneyFull(Number(row.claimable) / 1e18) : "—"}
                            </td>
                            <td className="py-4 px-4 text-right">
                              {row.isOwnerOnly ? (
                                <Link
                                  href={`/horse/${row.horseId}`}
                                  className="px-3 py-1.5 rounded border border-white/20 text-foreground text-xs hover:bg-white/10 transition-colors inline-block"
                                >
                                  View
                                </Link>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleClaim(row.horseId)}
                                  className="px-3 py-1.5 rounded border border-white/20 text-foreground text-xs hover:bg-white/10 transition-colors"
                                >
                                  Claim
                                </button>
                              )}
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
                <div className="rounded-lg border border-sidebar-border/60 bg-card p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.03)]">
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
                      <span>{String(topPerformer.shares)} shares</span>
                      <span>{formatMoneyFull(Number(topPerformer.value) / 1e18)}</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="rounded-lg border border-sidebar-border/60 bg-card p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.03)]">
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
                                (Number(item.claimable) / maxRevenue) * 100,
                                8,
                              )}%`,
                            }}
                          />
                        </div>
                        <span className="w-20 text-right font-semibold text-prestige-gold shrink-0">
                          {formatMoneyFull(Number(item.claimable) / 1e18)}
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

          <section className="rounded-lg border border-sidebar-border/60 bg-card p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.03)]">
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
              className="inline-flex px-4 py-2 rounded-md border border-prestige-gold/50 bg-gradient-to-r from-prestige-gold/15 to-prestige-gold/5 text-prestige-gold font-medium hover:from-prestige-gold/25 hover:to-prestige-gold/10 hover:border-prestige-gold/70 transition-colors text-sm"
            >
              Open agents console
            </Link>
          </section>
        </>
      )}
    </div>
  );
}
