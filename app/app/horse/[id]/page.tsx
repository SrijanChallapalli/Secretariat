"use client";

import { useParams } from "next/navigation";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { useState, useMemo } from "react";
import { addresses, abis } from "@/lib/contracts";
import { ogGalileo } from "@/lib/chains";
import { mapHorseINFTToValuationInput, calculateValue } from "@/lib/horse-valuation-agent";
import { calculateOfficialAge } from "../../../../shared/age";
import { validateHorseName } from "../../../../shared/name-validator";

function CreateVaultButton({ horseTokenId }: { horseTokenId: number }) {
  const [totalShares, setTotalShares] = useState("100");
  const [sharePrice, setSharePrice] = useState("10");
  const { writeContract } = useWriteContract();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        type="text"
        placeholder="Total shares"
        className="w-24 px-2 py-1 rounded-sm bg-secondary text-sm border border-border"
        value={totalShares}
        onChange={(e) => setTotalShares(e.target.value)}
      />
      <input
        type="text"
        placeholder="Price ADI"
        className="w-24 px-2 py-1 rounded-sm bg-secondary text-sm border border-border"
        value={sharePrice}
        onChange={(e) => setSharePrice(e.target.value)}
      />
      <button
        className="px-3 py-1 rounded-sm bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        onClick={() =>
          writeContract({
            address: addresses.syndicateVaultFactory,
            abi: abis.HorseSyndicateVaultFactory,
            functionName: "createVault",
            args: [BigInt(horseTokenId), BigInt(totalShares), BigInt(sharePrice) * 10n ** 18n],
          })
        }
      >
        Create vault
      </button>
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

  const officialAge = useMemo(() => {
    if (birthTs == null || Number(birthTs) === 0) return null;
    return calculateOfficialAge(Number(birthTs));
  }, [birthTs]);

  const nameCheck = useMemo(() => {
    if (!name) return null;
    return validateHorseName(String(name));
  }, [name]);

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
    <div className="max-w-4xl space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-wide text-foreground">
          {String(name) || `Horse #${id}`}
        </h1>
        <p className="text-sm text-muted-foreground font-mono">
          Token ID: {id}
          {officialAge != null ? ` · Age: ${officialAge} yr` : ""} · Pedigree:{" "}
          {score.toFixed(1)}% · Valuation: {val} ADI
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <section className="rounded-sm border border-border bg-card p-4 space-y-3">
          <h2 className="text-sm font-semibold text-foreground tracking-wide">
            Traits
          </h2>
          <ul className="space-y-1.5">
            {TRAIT_NAMES.map((t, i) => (
              <li key={i} className="flex justify-between text-xs">
                <span className="text-muted-foreground">{t}</span>
                <span className="font-mono text-foreground">
                  {traits[i] ?? 0}/100
                </span>
              </li>
            ))}
          </ul>
        </section>
        <section className="rounded-sm border border-border bg-card p-4 space-y-2">
          <h2 className="text-sm font-semibold text-foreground tracking-wide">
            Status
          </h2>
          {officialAge != null && (
            <p className="text-sm">
              Official age:{" "}
              <span className="text-prestige-gold font-mono">
                {officialAge}
              </span>{" "}
              (Jan 1 rule)
            </p>
          )}
          <p className="text-sm">
            Breeding available:{" "}
            <span className="font-mono">
              {breedingAvailable ? "Yes" : "No"}
            </span>
          </p>
          <p className="text-sm">
            Injured:{" "}
            {injured ? (
              <span className="text-terminal-red font-mono">Yes</span>
            ) : (
              "No"
            )}
          </p>
          <p className="text-sm">
            Retired:{" "}
            {retired ? (
              <span className="text-terminal-amber font-mono">Yes</span>
            ) : (
              "No"
            )}
          </p>
          {nameCheck && !nameCheck.valid && (
            <p className="mt-2 text-xs text-terminal-amber">
              Name issue: {nameCheck.errors.join("; ")}
            </p>
          )}
          {active && (
            <p className="mt-2 text-xs text-prestige-gold font-mono">
              Listed · Stud fee: {formatEther(studFee as bigint)} ADI · Uses:{" "}
              {String(usedCount)}/{String(maxUses)}
            </p>
          )}
        </section>
      </div>

      <section className="rounded-sm border border-border bg-secondary/60 p-4 space-y-3">
        <h2 className="text-sm font-semibold text-prestige-gold tracking-wide">
          Horse Valuation Agent
        </h2>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Racing + breeding value with age, health, and status modifiers.
          When the oracle reports race/injury/news, this agent computes
          suggested USD valuation — powered by Secretariat&apos;s XGBoost model.
        </p>
        <p className="text-sm text-foreground font-mono">
          Agent value (USD): $
          {agentValuation.value.toLocaleString(undefined, {
            maximumFractionDigits: 0,
          })}
        </p>
        <ul className="mt-1 text-xs text-muted-foreground space-y-1">
          <li>
            Racing component: $
            {agentValuation.breakdown.racingValue.toLocaleString(undefined, {
              maximumFractionDigits: 0,
            })}
          </li>
          <li>
            Breeding component: $
            {agentValuation.breakdown.breedingValue.toLocaleString(undefined, {
              maximumFractionDigits: 0,
            })}
          </li>
          <li>
            Modifiers: age {agentValuation.breakdown.ageModifier.toFixed(2)} ×
            health {agentValuation.breakdown.healthModifier.toFixed(2)} × market{" "}
            {agentValuation.breakdown.marketModifier.toFixed(2)}
          </li>
        </ul>
      </section>

      <div className="flex flex-wrap gap-3">
        {vaultAddr &&
        vaultAddr !== "0x0000000000000000000000000000000000000000" ? (
          <Link
            href={`/vault/${id}`}
            className="inline-flex items-center px-4 py-2 rounded-sm bg-primary/10 text-prestige-gold border border-border text-sm font-medium hover:bg-primary/20 transition-colors"
          >
            View vault / Buy shares
          </Link>
        ) : (
          address && <CreateVaultButton horseTokenId={id} />
        )}
        {breedingAvailable && active && address && (
          <Link
            href={`/breed?stallion=${id}`}
            className="inline-flex items-center px-4 py-2 rounded-sm bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Purchase breeding right
          </Link>
        )}
      </div>
    </div>
  );
}
