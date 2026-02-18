"use client";

import { useParams } from "next/navigation";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { useState, useMemo } from "react";
import { addresses, abis } from "@/lib/contracts";
import { ogGalileo } from "@/lib/chains";
import { mapHorseINFTToValuationInput, calculateValue } from "@/lib/horse-valuation-agent";

function CreateVaultButton({ horseTokenId }: { horseTokenId: number }) {
  const [totalShares, setTotalShares] = useState("100");
  const [sharePrice, setSharePrice] = useState("10");
  const { writeContract } = useWriteContract();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input type="text" placeholder="Total shares" className="w-24 px-2 py-1 rounded bg-track-800 text-sm" value={totalShares} onChange={(e) => setTotalShares(e.target.value)} />
      <input type="text" placeholder="Price ADI" className="w-24 px-2 py-1 rounded bg-track-800 text-sm" value={sharePrice} onChange={(e) => setSharePrice(e.target.value)} />
      <button className="px-3 py-1 rounded bg-gold-500 text-track-800 text-sm" onClick={() => writeContract({ address: addresses.syndicateVaultFactory, abi: abis.HorseSyndicateVaultFactory, functionName: "createVault", args: [BigInt(horseTokenId), BigInt(totalShares), BigInt(sharePrice) * (10n ** 18n)] })}>Create vault</button>
    </div>
  );
}

import { formatEther } from "viem";
import Link from "next/link";

const TRAIT_NAMES = ["Speed", "Stamina", "Temperament", "Conformation", "Health", "Agility", "Race IQ", "Consistency"];

export default function HorseDetailPage() {
  const params = useParams();
  const id = Number(params.id);
  const { address } = useAccount();

  const { data: horseData, isLoading: horseLoading, isError: horseError } = useReadContract({
    address: addresses.horseINFT,
    abi: abis.HorseINFT,
    functionName: "getHorseData",
    args: [BigInt(id)],
    chainId: ogGalileo.id,
  });

  const { data: listing } = useReadContract({
    address: addresses.breedingMarketplace,
    abi: abis.BreedingMarketplace,
    functionName: "listings",
    args: [BigInt(id)],
    chainId: ogGalileo.id,
  });

  const { data: vaultAddr } = useReadContract({
    address: addresses.syndicateVaultFactory,
    abi: abis.HorseSyndicateVaultFactory,
    functionName: "vaultForHorse",
    args: [BigInt(id)],
    chainId: ogGalileo.id,
  });

  // getHorseData returns a struct: viem can give object or tuple
  const raw = horseData as any;
  const name = raw?.name ?? raw?.[0];
  const birthTs = raw?.birthTimestamp ?? raw?.[1];
  const sireId = raw?.sireId ?? raw?.[2];
  const damId = raw?.damId ?? raw?.[3];
  const traitVector = raw?.traitVector ?? raw?.[4];
  const pedigreeScore = raw?.pedigreeScore ?? raw?.[5] ?? 0;
  const valuationADI = raw?.valuationADI ?? raw?.[6] ?? 0n;
  const breedingAvailable = raw?.breedingAvailable ?? raw?.[8] ?? false;
  const injured = raw?.injured ?? raw?.[9] ?? false;
  const retired = raw?.retired ?? raw?.[10] ?? false;
  const h = { name, birthTimestamp: birthTs, sireId, damId, traitVector, pedigreeScore, valuationADI, breedingAvailable, injured, retired };
  const traits = useMemo(() => (traitVector ?? []) as number[], [traitVector]);
  const listArr = listing as [bigint, bigint, bigint, boolean, boolean] | undefined;
  const [studFee, maxUses, usedCount, useAllowlist, active] = listArr ?? [BigInt(0), BigInt(0), BigInt(0), false, false];

  const chainHorse = useMemo(
    () => ({
      name,
      birthTimestamp: birthTs,
      traitVector: traits,
      pedigreeScore: Number(pedigreeScore),
      valuationADI,
      injured,
      retired,
    }),
    [name, birthTs, traits, pedigreeScore, valuationADI, injured, retired]
  );
  const valuationInput = useMemo(() => mapHorseINFTToValuationInput(chainHorse), [chainHorse]);
  const agentValuation = useMemo(
    () => calculateValue(valuationInput, { averageHorseValue: 50000, bullish: false }),
    [valuationInput]
  );

  if (horseLoading) {
    return <p className="text-stone-500">Loading horse…</p>;
  }
  if (horseError || !horseData) {
    return <p className="text-stone-500">Invalid horse id or failed to load. Check the token exists on OG Galileo.</p>;
  }
  if (!name && !String(raw?.[0])) {
    return <p className="text-stone-500">Invalid horse id.</p>;
  }

  const score = Number(pedigreeScore) / 100;
  const val = formatEther(valuationADI as bigint);

  return (
    <div className="max-w-4xl">
      <h1 className="text-3xl font-bold text-gold-400 mb-2">{String(name) || `Horse #${id}`}</h1>
      <p className="text-stone-400 mb-6">Token ID: {id} · Pedigree: {score.toFixed(1)}% · Valuation: {val} ADI</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="rounded-xl border border-track-600 bg-track-700 p-5">
          <h2 className="text-lg font-semibold text-stone-200 mb-3">Traits</h2>
          <ul className="space-y-1">
            {TRAIT_NAMES.map((t, i) => (
              <li key={i} className="flex justify-between text-sm">
                <span className="text-stone-400">{t}</span>
                <span>{traits[i] ?? 0}/100</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-track-600 bg-track-700 p-5">
          <h2 className="text-lg font-semibold text-stone-200 mb-3">Status</h2>
          <p>Breeding available: {breedingAvailable ? "Yes" : "No"}</p>
          <p>Injured: {injured ? "Yes" : "No"}</p>
          <p>Retired: {retired ? "Yes" : "No"}</p>
          {active && (
            <p className="mt-2 text-gold-400">Listed · Stud fee: {formatEther(studFee as bigint)} ADI · Uses: {String(usedCount)}/{String(maxUses)}</p>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-gold-500/30 bg-gold-500/5 p-5 mb-8">
        <h2 className="text-lg font-semibold text-gold-400 mb-3">Horse Valuation Agent</h2>
        <p className="text-stone-400 text-sm mb-3">
          Complementary agent (S-Agent spec): racing + breeding value with age, health, and status modifiers. When the oracle reports race/injury/news, this agent can compute suggested USD valuation.
        </p>
        <p className="text-stone-200 font-medium">Agent value (USD): ${agentValuation.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
        <ul className="mt-2 text-sm text-stone-400 space-y-1">
          <li>Racing component: ${agentValuation.breakdown.racingValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</li>
          <li>Breeding component: ${agentValuation.breakdown.breedingValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</li>
          <li>Modifiers: age {agentValuation.breakdown.ageModifier.toFixed(2)} × health {agentValuation.breakdown.healthModifier.toFixed(2)} × market {agentValuation.breakdown.marketModifier.toFixed(2)}</li>
        </ul>
      </div>

      <div className="flex flex-wrap gap-4">
        {vaultAddr && vaultAddr !== "0x0000000000000000000000000000000000000000" ? (
          <Link href={`/vault/${id}`} className="px-4 py-2 rounded-lg bg-gold-500/20 text-gold-400 border border-gold-500/50">
            View vault / Buy shares
          </Link>
        ) : address && (
          <CreateVaultButton horseTokenId={id} />
        )}
        {breedingAvailable && active && address && (
          <Link href={`/breed?stallion=${id}`} className="px-4 py-2 rounded-lg bg-gold-500 text-track-800 font-medium">
            Purchase breeding right
          </Link>
        )}
      </div>
    </div>
  );
}
