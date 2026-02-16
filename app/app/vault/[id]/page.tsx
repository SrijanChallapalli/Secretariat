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

  if (!vault) return <p className="text-stone-500">No vault for horse #{id}. Create one from the horse page.</p>;

  return (
    <div>
      <h1 className="text-3xl font-bold text-gold-400 mb-6">Vault — Horse #{id}</h1>
      <div className="rounded-xl border border-track-600 bg-track-700 p-5 mb-6 space-y-2">
        <p>TVL: {tvl != null ? formatEther(tvl as bigint) : "—"} ADI</p>
        <p>Total shares: {totalShares != null ? String(totalShares) : "—"}</p>
        <p>Share price: {sharePrice != null ? formatEther(sharePrice as bigint) : "—"} ADI</p>
        {address && <p>My shares: {myBalance != null ? String(myBalance) : "—"} · Claimable: {claimable != null ? formatEther(claimable as bigint) : "—"} ADI</p>}
      </div>
      {address && (
        <div className="flex flex-wrap gap-4">
          <input type="number" min={1} className="w-24 px-3 py-2 rounded bg-track-800 border border-track-600" value={shares} onChange={(e) => setShares(e.target.value)} />
          <button className="px-4 py-2 rounded bg-gold-500 text-track-800" onClick={() => writeContract({ address: vault as `0x${string}`, abi: vaultAbi, functionName: "buyShares", args: [BigInt(shares)] })}>Buy shares</button>
          <button className="px-4 py-2 rounded border border-gold-500/50 text-gold-400" onClick={() => writeContract({ address: vault as `0x${string}`, abi: vaultAbi, functionName: "claim" })}>Claim</button>
        </div>
      )}
    </div>
  );
}
