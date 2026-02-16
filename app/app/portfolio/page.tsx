"use client";

import { useAccount, useReadContract, useReadContracts } from "wagmi";
import { addresses, abis } from "@/lib/contracts";
import { formatEther } from "viem";
import Link from "next/link";

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
  const { data: horseOwnership } = useReadContracts({ contracts: horseCalls as any });

  const myHorses = horseOwnership
    ?.map((c, i) => (c.status === "success" && c.result === address ? i : -1))
    .filter((i) => i >= 0) ?? [];

  return (
    <div>
      <h1 className="text-3xl font-bold text-gold-400 mb-6">Portfolio</h1>
      {!address ? (
        <p className="text-stone-500">Connect wallet to see your portfolio.</p>
      ) : (
        <>
          <div className="rounded-xl border border-track-600 bg-track-700 p-5 mb-6">
            <h2 className="text-lg font-semibold text-stone-200 mb-2">ADI Balance</h2>
            <p className="text-2xl text-gold-400">{balances != null ? formatEther(balances as bigint) : "—"} ADI</p>
          </div>
          <div className="rounded-xl border border-track-600 bg-track-700 p-5">
            <h2 className="text-lg font-semibold text-stone-200 mb-3">My horses</h2>
            {myHorses.length === 0 ? (
              <p className="text-stone-500">You own no horses. Buy or breed from the marketplace.</p>
            ) : (
              <ul className="space-y-2">
                {myHorses.map((id) => (
                  <li key={id}>
                    <Link href={`/horse/${id}`} className="text-gold-400 hover:underline">
                      Horse #{id}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="mt-6">
            <Link href="/agent" className="text-gold-400 hover:underline">
              → Get top 3 breeding picks (Agent)
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
