"use client";

import { useParams } from "next/navigation";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { addresses, abis } from "@/lib/contracts";
import { formatEther } from "viem";
import { useState } from "react";

const vaultAbi = [
  "function buyShares(uint256 numShares) external",
  "function claim() external",
  "function claimableFor(address) view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function tvl() view returns (uint256)",
  "function totalShares() view returns (uint256)",
  "function sharePriceADI() view returns (uint256)",
] as const;

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

  const vault = vaultAddr && vaultAddr !== "0x0000000000000000000000000000000000000000" ? vaultAddr : null;

  const { data: tvl } = useReadContract({ address: vault as `0x${string}`, abi: vaultAbi, functionName: "tvl", args: [] });
  const { data: totalShares } = useReadContract({ address: vault as `0x${string}`, abi: vaultAbi, functionName: "totalShares", args: [] });
  const { data: sharePrice } = useReadContract({ address: vault as `0x${string}`, abi: vaultAbi, functionName: "sharePriceADI", args: [] });
  const { data: myBalance } = useReadContract({ address: vault as `0x${string}`, abi: vaultAbi, functionName: "balanceOf", args: address ? [address] : undefined });
  const { data: claimable } = useReadContract({ address: vault as `0x${string}`, abi: vaultAbi, functionName: "claimableFor", args: address ? [address] : undefined });

  const { writeContract } = useWriteContract();

  if (!vault)
    return (
      <p className="text-sm text-muted-foreground">
        No vault for horse #{id}. Create one from the horse page.
      </p>
    );

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
      <section className="rounded-sm border border-border bg-card p-4 space-y-2 text-sm">
        <p>
          TVL:{" "}
          <span className="font-mono">
            {tvl != null ? formatEther(tvl as bigint) : "—"} ADI
          </span>
        </p>
        <p>
          Total shares:{" "}
          <span className="font-mono">
            {totalShares != null ? String(totalShares) : "—"}
          </span>
        </p>
        <p>
          Share price:{" "}
          <span className="font-mono">
            {sharePrice != null ? formatEther(sharePrice as bigint) : "—"} ADI
          </span>
        </p>
        {address && (
          <p>
            My shares:{" "}
            <span className="font-mono">
              {myBalance != null ? String(myBalance) : "—"}
            </span>{" "}
            · Claimable:{" "}
            <span className="font-mono">
              {claimable != null
                ? formatEther(claimable as bigint)
                : "—"}{" "}
              ADI
            </span>
          </p>
        )}
      </section>
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
                address: vault as `0x${string}`,
                abi: vaultAbi,
                functionName: "buyShares",
                args: [BigInt(shares)],
              })
            }
          >
            Buy shares
          </button>
          <button
            className="px-4 py-2 rounded-sm border border-border text-prestige-gold text-sm hover:bg-secondary/60 transition-colors"
            onClick={() =>
              writeContract({
                address: vault as `0x${string}`,
                abi: vaultAbi,
                functionName: "claim",
              })
            }
          >
            Claim
          </button>
        </section>
      )}
    </div>
  );
}
