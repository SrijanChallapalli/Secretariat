"use client";

import { useReadContracts } from "wagmi";
import { addresses, abis } from "@/lib/contracts";
import Link from "next/link";

const TRAIT_NAMES = ["Speed", "Stamina", "Temperament", "Conformation", "Health", "Agility", "Race IQ", "Consistency"];

function HorseCard({ tokenId, data }: { tokenId: number; data: any }) {
  if (!data) return null;
  const [name, , , , traitVector, pedigreeScore, valuationADI, , breedingAvailable] = data;
  const score = pedigreeScore != null ? Number(pedigreeScore) / 100 : 0;
  const val = valuationADI != null ? (Number(valuationADI) / 1e18).toFixed(0) : "0";
  return (
    <Link href={`/horse/${tokenId}`} className="block rounded-xl border border-track-600 bg-track-700 p-5 hover:border-gold-500/50 transition">
      <h3 className="font-semibold text-lg text-gold-400 truncate">{String(name || `Horse #${tokenId}`)}</h3>
      <p className="text-stone-400 text-sm mt-1">Pedigree score: {(score / 100).toFixed(1)}% · Valuation: {val} ADI</p>
      {breedingAvailable && <span className="inline-block mt-2 text-xs bg-gold-500/20 text-gold-400 px-2 py-0.5 rounded">Breeding</span>}
    </Link>
  );
}

export default function MarketplacePage() {
  const { data: contracts } = useReadContracts({
    contracts: [
      { address: addresses.horseINFT, abi: abis.HorseINFT, functionName: "getHorseData", args: [0n] },
      { address: addresses.horseINFT, abi: abis.HorseINFT, functionName: "getHorseData", args: [1n] },
      { address: addresses.horseINFT, abi: abis.HorseINFT, functionName: "getHorseData", args: [2n] },
      { address: addresses.horseINFT, abi: abis.HorseINFT, functionName: "getHorseData", args: [3n] },
      { address: addresses.horseINFT, abi: abis.HorseINFT, functionName: "getHorseData", args: [4n] },
    ],
  });
  const results = contracts?.map((c) => c.status === "success" ? c.result : null) ?? [];

  return (
    <div>
      <h1 className="text-3xl font-bold text-gold-400 mb-6">Marketplace</h1>
      <p className="text-stone-400 mb-8">Browse tokenized horses. Filter by pedigree and valuation.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {results.map((data, i) => (
          <HorseCard key={i} tokenId={i} data={data} />
        ))}
      </div>
      {results.every((r) => r == null) && (
        <p className="text-stone-500">No horses yet. Deploy and run seed:demo to mint demo horses.</p>
      )}
    </div>
  );
}
