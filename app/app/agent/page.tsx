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
  const { data: sAgentProfile } = useReadContract({
    address: addresses.agentINFT,
    abi: abis.BreedingAdvisorINFT,
    functionName: "profiles",
    args: [1n],
  });

  return (
    <div>
      <h1 className="text-3xl font-bold text-gold-400 mb-6">Agents</h1>
      <p className="text-stone-400 mb-8">
        iNFT agents with 0G model bundles. Get top 3 stallion recommendations for your mare with explainability.
      </p>

      <div className="rounded-xl border border-track-600 bg-track-700 p-6 mb-6">
        <h2 className="text-lg font-semibold text-stone-200 mb-3">Breeding Advisor (token 0)</h2>
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

      <div className="rounded-xl border border-track-600 bg-track-700 p-6 mb-6">
        <h2 className="text-lg font-semibold text-stone-200 mb-3">S-Agent (token 1)</h2>
        {sAgentProfile ? (
          <>
            <p><span className="text-stone-500">Name:</span> {String((sAgentProfile as readonly [string, string, string, string])[0])}</p>
            <p><span className="text-stone-500">Version:</span> {String((sAgentProfile as readonly [string, string, string, string])[1])}</p>
            <p><span className="text-stone-500">Model bundle (0G rootHash):</span> {String((sAgentProfile as readonly [string, string, string, string])[3]) || "—"}</p>
          </>
        ) : (
          <p className="text-stone-500">No S-Agent iNFT minted yet. Run seed with S-Agent mint or mint from deployer.</p>
        )}
        <p className="text-stone-400 text-sm mt-3">S-Agent emphasizes pedigree synergy and complementary traits. Source: <a href="https://github.com/Ayaan-Ameen07/S-Agent" target="_blank" rel="noopener noreferrer" className="text-gold-400 hover:underline">github.com/Ayaan-Ameen07/S-Agent</a></p>
        <Link href="/breed?agent=s-agent" className="inline-block mt-3 px-4 py-2 rounded bg-gold-500/20 text-gold-400 border border-gold-500/50 hover:bg-gold-500/30">
          Use S-Agent
        </Link>
      </div>

      <div className="rounded-xl border border-track-600 bg-track-700 p-6 mb-6">
        <h2 className="text-lg font-semibold text-stone-200 mb-3">Horse Valuation Agent</h2>
        <p className="text-stone-400 text-sm mb-3">
          Complementary to Breeding Advisor: computes USD valuation from racing value, breeding value, and modifiers (age peak 3–6, health, status, market). Triggered on oracle events: RACE_WIN, RACE_LOSS, INJURY, RETIREMENT, OFFSPRING_WIN, DEATH. Logic in <code className="text-track-400">server/bundle/valuation-agent/</code> for 0G.
        </p>
        <Link href="/horse/0" className="inline-block px-4 py-2 rounded bg-gold-500/20 text-gold-400 border border-gold-500/50 hover:bg-gold-500/30">
          View valuation on horse detail
        </Link>
      </div>

      <div className="rounded-xl border border-gold-500/30 bg-gold-500/5 p-6">
        <h2 className="text-lg font-semibold text-gold-400 mb-3">Get top 3 breeding picks</h2>
        <p className="text-stone-400 text-sm mb-4">
          Recommend-only mode: agent outputs Top 3 stallions + explainability. Execute mode: sign plan and agent contract executes within constraints.
        </p>
        <div className="flex gap-3 flex-wrap">
          <Link href="/breed?advisor=1" className="inline-block px-4 py-2 rounded bg-gold-500 text-track-800 font-medium">
            Breeding Advisor
          </Link>
          <Link href="/breed?agent=s-agent" className="inline-block px-4 py-2 rounded bg-gold-500/30 text-gold-400 border border-gold-500/50 hover:bg-gold-500/50">
            S-Agent
          </Link>
        </div>
      </div>
    </div>
  );
}
