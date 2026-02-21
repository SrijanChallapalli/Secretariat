"use client";

import Link from "next/link";
import { useAccount, useReadContract, useReadContracts } from "wagmi";
import { formatEther } from "viem";
import { addresses, abis } from "@/lib/contracts";
import type { HorseFullData } from "@/data/mockHorses";

interface OwnershipTabProps {
  horse: HorseFullData;
}

const DEFAULT_TOTAL_SHARES = 10000n;

export function OwnershipTab({ horse }: OwnershipTabProps) {
  const { address } = useAccount();

  const { data: vaultAddress } = useReadContract({
    address: addresses.syndicateVaultFactory,
    abi: abis.HorseSyndicateVaultFactory,
    functionName: "vaultForHorse",
    args: [BigInt(horse.id)],
  });

  const ZERO = "0x0000000000000000000000000000000000000000" as `0x${string}`;
  const hasVault =
    !!vaultAddress && vaultAddress !== ZERO;
  const vaultAddr = hasVault ? (vaultAddress as `0x${string}`) : undefined;

  const vaultCalls =
    hasVault && vaultAddr && address
      ? [
          { address: vaultAddr, abi: abis.HorseSyndicateVault, functionName: "totalShares" as const },
          { address: vaultAddr, abi: abis.HorseSyndicateVault, functionName: "balanceOf" as const, args: [address] },
          { address: vaultAddr, abi: abis.HorseSyndicateVault, functionName: "claimableFor" as const, args: [address] },
          { address: vaultAddr, abi: abis.HorseSyndicateVault, functionName: "sharePriceADI" as const },
          { address: vaultAddr, abi: abis.HorseSyndicateVault, functionName: "investorCount" as const },
          { address: vaultAddr, abi: abis.HorseSyndicateVault, functionName: "frozen" as const },
          { address: vaultAddr, abi: abis.HorseSyndicateVault, functionName: "lockupRemaining" as const, args: [address] },
          { address: vaultAddr, abi: abis.HorseSyndicateVault, functionName: "originationFeeBps" as const },
        ]
      : [];

  const { data: vaultResults } = useReadContracts({ contracts: vaultCalls as any });

  const totalShares = hasVault && vaultResults?.[0]?.status === "success"
    ? (vaultResults[0].result as bigint)
    : DEFAULT_TOTAL_SHARES;

  const yourShares = hasVault && vaultResults?.[1]?.status === "success"
    ? (vaultResults[1].result as bigint)
    : (address && horse.ownerAddress?.toLowerCase() === address.toLowerCase() ? DEFAULT_TOTAL_SHARES : 0n);

  const claimable = hasVault && vaultResults?.[2]?.status === "success"
    ? (vaultResults[2].result as bigint)
    : 0n;

  const sharePriceRaw = hasVault && vaultResults?.[3]?.status === "success"
    ? (vaultResults[3].result as bigint)
    : 0n;

  const investorCount = hasVault && vaultResults?.[4]?.status === "success"
    ? Number(vaultResults[4].result as bigint)
    : 0;

  const isFrozen = hasVault && vaultResults?.[5]?.status === "success"
    ? (vaultResults[5].result as boolean)
    : false;

  const lockupSeconds = hasVault && vaultResults?.[6]?.status === "success"
    ? Number(vaultResults[6].result as bigint)
    : 0;

  const originationFeeBps = hasVault && vaultResults?.[7]?.status === "success"
    ? Number(vaultResults[7].result as bigint)
    : 0;

  const lockupDays = Math.ceil(lockupSeconds / 86400);

  const fmtShares = (n: bigint) => Number(n).toLocaleString();
  const fmtADI = (n: bigint) => `${Number(formatEther(n)).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ADI`;
  const yieldPct = totalShares > 0n && sharePriceRaw > 0n
    ? ((Number(claimable) / (Number(yourShares) * Number(sharePriceRaw))) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-sidebar-border/60 bg-card p-5">
        <h3 className="text-xs font-semibold tracking-[0.2em] text-prestige-gold uppercase mb-4">
          VAULT
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-4">
          <div>
            <p className="text-[10px] font-sans tracking-wider text-muted-foreground uppercase mb-1">
              SHARES OUTSTANDING
            </p>
            <p className="text-lg font-bold text-foreground">
              {fmtShares(totalShares)}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-sans tracking-wider text-muted-foreground uppercase mb-1">
              YOUR SHARES
            </p>
            <p className="text-lg font-bold text-foreground">
              {fmtShares(yourShares)}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-sans tracking-wider text-muted-foreground uppercase mb-1">
              SHARE PRICE
            </p>
            <p className="text-lg font-bold text-foreground">
              {hasVault ? fmtADI(sharePriceRaw) : "—"}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-sans tracking-wider text-muted-foreground uppercase mb-1">
              REVENUE CLAIMABLE
            </p>
            <p className="text-lg font-bold text-foreground">
              {claimable > 0n ? fmtADI(claimable) : "—"}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-sans tracking-wider text-muted-foreground uppercase mb-1">
              EST. YIELD
            </p>
            <p className="text-lg font-bold text-foreground">
              {yieldPct > 0 ? `${yieldPct.toFixed(1)}%` : "—"}
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            className="px-4 py-2 rounded-md border border-prestige-gold/50 text-foreground hover:bg-prestige-gold/10 transition-colors text-sm"
          >
            Buy Shares
          </button>
          <button
            type="button"
            className="text-sm text-muted-foreground hover:text-prestige-gold transition-colors"
          >
            Claim Revenue
          </button>
        </div>
      </div>

      {/* SEC Compliance Status */}
      {hasVault && (
        <div className="rounded-lg border border-sidebar-border/60 bg-card p-5">
          <h3 className="text-xs font-semibold tracking-[0.2em] text-prestige-gold uppercase mb-4">
            SEC COMPLIANCE (REG D 506c)
          </h3>
          {isFrozen && (
            <div className="mb-4 px-3 py-2 rounded-md bg-red-500/10 border border-red-500/30">
              <p className="text-xs font-bold text-red-400 animate-pulse">
                LAZARUS PROTOCOL ACTIVE — TRADING FROZEN
              </p>
            </div>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-[10px] font-sans tracking-wider text-muted-foreground uppercase mb-1">
                INVESTOR CAP
              </p>
              <p className="text-lg font-bold text-foreground">
                {investorCount} <span className="text-sm text-muted-foreground">/ 99</span>
              </p>
            </div>
            <div>
              <p className="text-[10px] font-sans tracking-wider text-muted-foreground uppercase mb-1">
                LOCKUP STATUS
              </p>
              <p className={`text-sm font-bold ${lockupDays > 0 ? "text-amber-400" : "text-emerald-400"}`}>
                {lockupDays > 0 ? `${lockupDays}d remaining` : "Unlocked"}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-sans tracking-wider text-muted-foreground uppercase mb-1">
                ORIGINATION FEE
              </p>
              <p className="text-sm font-bold text-foreground">
                {originationFeeBps > 0 ? `${(originationFeeBps / 100).toFixed(1)}%` : "—"}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-sans tracking-wider text-muted-foreground uppercase mb-1">
                MARKET TYPE
              </p>
              <p className="text-sm font-bold text-foreground">
                {isFrozen ? "Frozen" : "Dark Pool"}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-sidebar-border/60 bg-card p-5">
        <h3 className="text-xs font-semibold tracking-[0.2em] text-prestige-gold uppercase mb-4">
          TRADE FLOW
        </h3>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full border-2 border-prestige-gold bg-prestige-gold/10 flex items-center justify-center text-prestige-gold text-sm font-bold">
              1
            </div>
            <span className="text-sm text-prestige-gold font-medium">
              Approve ADI
            </span>
          </div>
          <div className="h-px w-8 bg-white/20" />
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full border border-white/30 flex items-center justify-center text-muted-foreground text-sm">
              2
            </div>
            <span className="text-sm text-muted-foreground">Buy Shares</span>
          </div>
          <div className="h-px w-8 bg-white/20" />
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full border border-white/30 flex items-center justify-center text-muted-foreground text-sm">
              3
            </div>
            <span className="text-sm text-muted-foreground">
              Confirm Receipt
            </span>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-sidebar-border/60 bg-card p-5">
        <h3 className="text-xs font-semibold tracking-[0.2em] text-prestige-gold uppercase mb-4">
          TRANSACTIONS
        </h3>
        <p className="text-sm text-muted-foreground">
          No recent transactions.{" "}
          <Link href={`/vault/${horse.id}`} className="text-prestige-gold hover:underline">
            View vault
          </Link>
        </p>
      </div>
    </div>
  );
}
