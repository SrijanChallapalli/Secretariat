"use client";

import { useParams } from "next/navigation";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { addresses, abis } from "@/lib/contracts";
import { formatEther } from "viem";
import { useState } from "react";
import Link from "next/link";

export default function VaultPage() {
  const params = useParams();
  const id = Number(params.id);
  const { address } = useAccount();
  const [shares, setShares] = useState("1");

  const { data: vaultAddr } = useReadContract({
    address: addresses.syndicateVaultFactory,
    abi: abis.HorseSyndicateVaultFactory,
    functionName: "vaultForHorse",
    args: [BigInt(id)],
  });

  const vault =
    vaultAddr && vaultAddr !== "0x0000000000000000000000000000000000000000"
      ? vaultAddr
      : null;

  const vaultAddress = vault as `0x${string}`;

  const { data: tvl } = useReadContract({
    address: vaultAddress,
    abi: abis.HorseSyndicateVault,
    functionName: "tvl",
  });
  const { data: totalShares } = useReadContract({
    address: vaultAddress,
    abi: abis.HorseSyndicateVault,
    functionName: "totalShares",
  });
  const { data: sharePrice } = useReadContract({
    address: vaultAddress,
    abi: abis.HorseSyndicateVault,
    functionName: "sharePriceADI",
  });
  const { data: myBalance } = useReadContract({
    address: vaultAddress,
    abi: abis.HorseSyndicateVault,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
  });
  const { data: claimable } = useReadContract({
    address: vaultAddress,
    abi: abis.HorseSyndicateVault,
    functionName: "claimableFor",
    args: address ? [address] : undefined,
  });
  const { data: operatingBuffer } = useReadContract({
    address: vaultAddress,
    abi: abis.HorseSyndicateVault,
    functionName: "operatingBuffer",
  });
  const { data: bufferTarget } = useReadContract({
    address: vaultAddress,
    abi: abis.HorseSyndicateVault,
    functionName: "bufferTarget",
  });
  const { data: navPerShare } = useReadContract({
    address: vaultAddress,
    abi: abis.HorseSyndicateVault,
    functionName: "navPerShare",
  });
  const { data: invoiceCount } = useReadContract({
    address: vaultAddress,
    abi: abis.HorseSyndicateVault,
    functionName: "invoiceCount",
  });
  const { data: receiptCount } = useReadContract({
    address: vaultAddress,
    abi: abis.HorseSyndicateVault,
    functionName: "dividendReceiptCount",
  });

  const { writeContract } = useWriteContract();

  if (!vault)
    return (
      <p className="text-sm text-muted-foreground">
        No vault for horse #{id}. Create one from the horse page.
      </p>
    );

  const bufferPct =
    operatingBuffer != null && bufferTarget != null && (bufferTarget as bigint) > 0n
      ? Number(((operatingBuffer as bigint) * 100n) / (bufferTarget as bigint))
      : 0;

  return (
    <div className="space-y-6 max-w-3xl">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-wide text-foreground">
          Vault — Horse #{id}
        </h1>
        <p className="text-sm text-muted-foreground">
          Fractional ownership vault backed by this horse&apos;s ADI flows.
        </p>
      </header>

      {/* Core metrics */}
      <section className="rounded-sm border border-border bg-card p-4 space-y-2 text-sm">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div>
            <p className="text-xs text-muted-foreground">TVL</p>
            <p className="font-mono">
              {tvl != null ? formatEther(tvl as bigint) : "—"} ADI
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total Shares</p>
            <p className="font-mono">
              {totalShares != null ? String(totalShares) : "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Share Price</p>
            <p className="font-mono">
              {sharePrice != null ? formatEther(sharePrice as bigint) : "—"} ADI
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">NAV / Share</p>
            <p className="font-mono text-prestige-gold">
              {navPerShare != null
                ? formatEther(navPerShare as bigint)
                : "—"}{" "}
              ADI
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Invoices</p>
            <p className="font-mono">
              {invoiceCount != null ? String(invoiceCount) : "0"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Dividend Receipts</p>
            <p className="font-mono">
              {receiptCount != null ? String(receiptCount) : "0"}
            </p>
          </div>
        </div>

        {address && (
          <div className="pt-2 border-t border-border mt-2">
            <p className="text-xs text-muted-foreground">My Position</p>
            <p className="font-mono">
              {myBalance != null ? String(myBalance) : "—"} shares · Claimable:{" "}
              {claimable != null ? formatEther(claimable as bigint) : "—"} ADI
            </p>
          </div>
        )}
      </section>

      {/* Operating buffer */}
      <section className="rounded-sm border border-border bg-card p-4 space-y-2">
        <h2 className="text-xs uppercase tracking-wider text-muted-foreground">
          Operating Buffer (Automated OpEx)
        </h2>
        <div className="flex items-center gap-3">
          <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full bg-prestige-gold rounded-full transition-all"
              style={{ width: `${Math.min(100, bufferPct)}%` }}
            />
          </div>
          <span className="text-xs font-mono text-muted-foreground">
            {bufferPct}%
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          {operatingBuffer != null
            ? formatEther(operatingBuffer as bigint)
            : "0"}{" "}
          /{" "}
          {bufferTarget != null ? formatEther(bufferTarget as bigint) : "0"} ADI
        </p>
      </section>

      {/* Actions */}
      {address && (
        <section className="flex flex-wrap gap-3 items-center">
          <input
            type="number"
            min={1}
            className="w-24 px-3 py-2 rounded-sm bg-secondary border border-border text-sm"
            value={shares}
            onChange={(e) => setShares(e.target.value)}
          />
          <button
            className="px-4 py-2 rounded-sm bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            onClick={() =>
              writeContract({
                address: vaultAddress,
                abi: abis.HorseSyndicateVault,
                functionName: "buyShares",
                args: [BigInt(shares)],
              })
            }
          >
            Buy Shares
          </button>
          <button
            className="px-4 py-2 rounded-sm border border-red-500/50 text-red-400 text-sm hover:bg-red-950/20 transition-colors"
            onClick={() =>
              writeContract({
                address: vaultAddress,
                abi: abis.HorseSyndicateVault,
                functionName: "redeemShares",
                args: [BigInt(shares)],
              })
            }
          >
            Redeem Shares
          </button>
          <button
            className="px-4 py-2 rounded-sm border border-border text-prestige-gold text-sm hover:bg-secondary/60 transition-colors"
            onClick={() =>
              writeContract({
                address: vaultAddress,
                abi: abis.HorseSyndicateVault,
                functionName: "claim",
              })
            }
          >
            Claim Revenue
          </button>
        </section>
      )}

      {/* Link to risk board */}
      <Link
        href="/risk"
        className="inline-block text-xs text-prestige-gold hover:underline"
      >
        Configure risk parameters on the DeFAI Risk Board →
      </Link>
    </div>
  );
}
