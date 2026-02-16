"use client";

import { useReadContract, useWriteContract } from "wagmi";
import { addresses, abis } from "@/lib/contracts";
import { useState } from "react";

export default function AdminPage() {
  const [horseId, setHorseId] = useState("0");
  const [placing, setPlacing] = useState("1");
  const [earnings, setEarnings] = useState("100");
  const [severity, setSeverity] = useState("500");
  const [sentiment, setSentiment] = useState("200");

  const { writeContract: reportRace } = useWriteContract();
  const { writeContract: reportInjury } = useWriteContract();
  const { writeContract: reportNews } = useWriteContract();

  return (
    <div>
      <h1 className="text-3xl font-bold text-gold-400 mb-6">Oracle / Admin</h1>
      <p className="text-stone-400 mb-6">Role: ORACLE_ROLE. Simulate race result, injury, news for valuation updates.</p>
      <div className="space-y-4 max-w-md">
        <div>
          <label className="block text-stone-400 text-sm">Horse token ID</label>
          <input type="number" className="w-full px-3 py-2 rounded bg-track-800 border border-track-600" value={horseId} onChange={(e) => setHorseId(e.target.value)} />
        </div>
        <div>
          <label className="block text-stone-400 text-sm">Race: placing (1-3)</label>
          <input type="number" min={1} max={3} className="w-full px-3 py-2 rounded bg-track-800 border border-track-600" value={placing} onChange={(e) => setPlacing(e.target.value)} />
          <label className="block text-stone-400 text-sm mt-1">Earnings ADI (wei)</label>
          <input type="text" className="w-full px-3 py-2 rounded bg-track-800 border border-track-600" value={earnings} onChange={(e) => setEarnings(e.target.value)} />
          <button className="mt-2 px-4 py-2 rounded bg-gold-500/80 text-track-800" onClick={() => reportRace({ address: addresses.horseOracle, abi: abis.HorseOracle, functionName: "reportRaceResult", args: [BigInt(horseId), Number(placing), BigInt(earnings)] })}>Report race result</button>
        </div>
        <div>
          <label className="block text-stone-400 text-sm">Injury: severity (bps 0-10000)</label>
          <input type="text" className="w-full px-3 py-2 rounded bg-track-800 border border-track-600" value={severity} onChange={(e) => setSeverity(e.target.value)} />
          <button className="mt-2 px-4 py-2 rounded bg-red-500/20 text-red-300 border border-red-500/50" onClick={() => reportInjury({ address: addresses.horseOracle, abi: abis.HorseOracle, functionName: "reportInjury", args: [BigInt(horseId), Number(severity)] })}>Report injury</button>
        </div>
        <div>
          <label className="block text-stone-400 text-sm">News: sentiment (bps, can be negative)</label>
          <input type="text" className="w-full px-3 py-2 rounded bg-track-800 border border-track-600" value={sentiment} onChange={(e) => setSentiment(e.target.value)} />
          <button className="mt-2 px-4 py-2 rounded bg-track-600 text-stone-200" onClick={() => reportNews({ address: addresses.horseOracle, abi: abis.HorseOracle, functionName: "reportNews", args: [BigInt(horseId), Number(sentiment)] })}>Report news</button>
        </div>
      </div>
    </div>
  );
}
