"use client";

import { useAccount, useReadContract } from "wagmi";
import { addresses, abis } from "@/lib/contracts";
import { useState } from "react";
import Link from "next/link";

export default function AgentPage() {
  const { address } = useAccount();
  const [rootHash, setRootHash] = useState("");
  const { data: profile } = useReadContract({
    address: addresses.agentINFT,
    abi: abis.BreedingAdvisorINFT,
    functionName: "profiles",
    args: [0n],
  });

  return (
    <div>
      <h1 className="text-3xl font-bold text-gold-400 mb-6">Breeding Advisor Agent</h1>
      <p className="text-stone-400 mb-8">
        iNFT agent with 0G model bundle. Get top 3 stallion recommendations for your mare with explainability.
      </p>

      <div className="rounded-xl border border-track-600 bg-track-700 p-6 mb-6">
        <h2 className="text-lg font-semibold text-stone-200 mb-3">Agent identity</h2>
        {profile ? (
          <>
            <p><span className="text-stone-500">Name:</span> {String((profile as readonly [string, string, string, string])[0])}</p>
            <p><span className="text-stone-500">Version:</span> {String((profile as readonly [string, string, string, string])[1])}</p>
            <p><span className="text-stone-500">Model bundle (0G rootHash):</span> {String((profile as readonly [string, string, string, string])[3]) || "—"}</p>
          </>
        ) : (
          <p className="text-stone-500">No agent minted yet. Run seed or mint from deployer.</p>
        )}
      </div>

      <div className="rounded-xl border border-track-600 bg-track-700 p-6 mb-6">
        <h2 className="text-lg font-semibold text-stone-200 mb-3">Refresh from 0G</h2>
        <p className="text-stone-400 text-sm mb-3">Download bundle by rootHash to verify agent model version.</p>
        <input
          type="text"
          placeholder="Root hash"
          className="w-full max-w-md px-3 py-2 rounded bg-track-800 border border-track-600 text-stone-100"
          value={rootHash}
          onChange={(e) => setRootHash(e.target.value)}
        />
        <a
          href={process.env.NEXT_PUBLIC_SERVER_URL ? `${process.env.NEXT_PUBLIC_SERVER_URL}/og/download/${rootHash}` : "#"}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block mt-2 px-4 py-2 rounded bg-gold-500/20 text-gold-400 border border-gold-500/50 hover:bg-gold-500/30"
        >
          Download bundle
        </a>
      </div>

      <div className="rounded-xl border border-gold-500/30 bg-gold-500/5 p-6">
        <h2 className="text-lg font-semibold text-gold-400 mb-3">Get top 3 breeding picks</h2>
        <p className="text-stone-400 text-sm mb-4">
          Recommend-only mode: agent outputs Top 3 stallions + explainability. Execute mode: sign plan and agent contract executes within constraints.
        </p>
        <Link href="/breed?advisor=1" className="inline-block px-4 py-2 rounded bg-gold-500 text-track-800 font-medium">
          Open breeding advisor
        </Link>
      </div>
    </div>
  );
}
