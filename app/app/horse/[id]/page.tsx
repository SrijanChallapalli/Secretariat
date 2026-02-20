"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { useReadContracts, useWriteContract, useAccount, useWaitForTransactionReceipt } from "wagmi";
import { parseEther } from "viem";
import { addresses, abis } from "@/lib/contracts";
import { isOnChainHorse } from "@/lib/on-chain-horses";
import {
  mapToHorseFullData,
  parseRawHorseData,
  parseRawListing,
} from "@/lib/on-chain-mapping";
import { HorseHero } from "@/components/horse/HorseHero";
import { HorseTabs, type HorseTabId } from "@/components/horse/HorseTabs";
import { OverviewTab } from "@/components/horse/OverviewTab";
import { OwnershipTab } from "@/components/horse/OwnershipTab";
import { BreedingTab } from "@/components/horse/BreedingTab";
import { AnalyticsTab } from "@/components/horse/AnalyticsTab";
import { Home, FileText, Clock } from "lucide-react";
import Link from "next/link";

export default function HorseDetailPage() {
  const params = useParams();
  const id = Number(params.id);
  const [activeTab, setActiveTab] = useState<HorseTabId>("overview");
  const [txStatus, setTxStatus] = useState<string | null>(null);
  const { address } = useAccount();
  const { writeContract, data: txHash, isPending: isTxPending } = useWriteContract();

  const horseCall = {
    address: addresses.horseINFT,
    abi: abis.HorseINFT,
    functionName: "getHorseData" as const,
    args: [BigInt(id)] as [bigint],
  };
  const listingCall = {
    address: addresses.breedingMarketplace,
    abi: abis.BreedingMarketplace,
    functionName: "listings" as const,
    args: [BigInt(id)] as [bigint],
  };
  const ownerCall = {
    address: addresses.horseINFT,
    abi: abis.HorseINFT,
    functionName: "ownerOf" as const,
    args: [BigInt(id)] as [bigint],
  };

  const { data: horseResult } = useReadContracts({
    contracts: [horseCall, listingCall, ownerCall] as any,
  });

  const horse = (() => {
    if (!horseResult || horseResult.length < 3) return null;
    const [hRes, lRes, oRes] = horseResult;
    if (hRes?.status !== "success" || !hRes.result || !isOnChainHorse(hRes.result))
      return null;
    const raw = parseRawHorseData(hRes.result);
    if (!raw) return null;
    const listing =
      lRes?.status === "success" && lRes.result
        ? parseRawListing(lRes.result)
        : null;
    const owner = (oRes?.status === "success" ? oRes.result : null) as string | null;
    return mapToHorseFullData(id, raw, listing, owner ?? "0x0");
  })();

  const handleBuyShares = () => {
    if (!address) { setTxStatus("Connect wallet first"); return; }
    setTxStatus("Creating vault…");
    writeContract({
      address: addresses.syndicateVaultFactory,
      abi: abis.HorseSyndicateVaultFactory,
      functionName: "createVault",
      args: [BigInt(id), BigInt(10000), parseEther("1"), parseEther("500")],
    }, {
      onSuccess: () => setTxStatus("Vault creation tx submitted!"),
      onError: (err) => setTxStatus(`Error: ${err.message.slice(0, 80)}`),
    });
  };

  const handlePurchaseBreedingRight = () => {
    if (!address) { setTxStatus("Connect wallet first"); return; }
    setTxStatus("Purchasing breeding right…");
    const seed = `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("")}` as `0x${string}`;
    writeContract({
      address: addresses.breedingMarketplace,
      abi: abis.BreedingMarketplace,
      functionName: "purchaseBreedingRight",
      args: [BigInt(id), seed],
    }, {
      onSuccess: () => setTxStatus("Breeding right purchased!"),
      onError: (err) => setTxStatus(`Error: ${err.message.slice(0, 80)}`),
    });
  };

  if (!horseResult) {
    return (
      <div className="max-w-4xl space-y-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-prestige-gold transition-colors"
        >
          ← Back
        </Link>
        <div className="rounded-lg border border-white/10 bg-black/20 p-12 text-center animate-pulse">
          <div className="h-8 w-48 bg-white/10 rounded mx-auto mb-4" />
          <div className="h-4 w-64 bg-white/10 rounded mx-auto mb-2" />
          <div className="h-4 w-40 bg-white/10 rounded mx-auto" />
          <p className="text-sm text-muted-foreground mt-4">Loading horse data from chain…</p>
        </div>
      </div>
    );
  }

  if (!horse) {
    return (
      <div className="max-w-4xl space-y-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-prestige-gold transition-colors"
        >
          ← Back
        </Link>
        <div className="rounded-lg border border-white/10 bg-black/20 p-12 text-center">
          <p className="text-lg text-muted-foreground">
            Horse not found. Token ID {id} does not exist on chain.
          </p>
          <Link
            href="/"
            className="mt-4 inline-block text-prestige-gold hover:underline"
          >
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl space-y-8">
      {txStatus && (
        <div className={`rounded-lg border p-3 text-sm ${txStatus.startsWith("Error") ? "border-red-500/30 bg-red-500/5 text-red-400" : "border-terminal-green/30 bg-terminal-green/5 text-terminal-green"}`}>
          {txStatus}
          <button type="button" onClick={() => setTxStatus(null)} className="ml-2 text-xs underline opacity-70">dismiss</button>
        </div>
      )}

      <HorseHero
        horse={horse}
        onBuyShares={handleBuyShares}
        onPurchaseBreedingRight={handlePurchaseBreedingRight}
        breedHref={
          horse.breedingListing.studFee !== "—" && horse.breedingListing.remainingUses > 0
            ? `/breed?stallion=${horse.id}&advisor=1`
            : `/breed?mare=${horse.id}&advisor=1`
        }
      />

      <div className="rounded-lg border border-white/10 bg-black/20 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Home className="h-4 w-4 text-prestige-gold shrink-0" />
          <h2 className="text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase">
            STABLE RECORD
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <p className="text-[10px] font-sans tracking-wider text-muted-foreground uppercase mb-1">
              FOALED
            </p>
            <p className="text-sm text-foreground">{horse.foaled}</p>
          </div>
          <div>
            <p className="text-[10px] font-sans tracking-wider text-muted-foreground uppercase mb-1">
              SIRE
            </p>
            <p className="text-sm text-foreground">{horse.sire}</p>
          </div>
          <div>
            <p className="text-[10px] font-sans tracking-wider text-muted-foreground uppercase mb-1">
              DAM
            </p>
            <p className="text-sm text-foreground">{horse.dam}</p>
          </div>
          <div>
            <p className="text-[10px] font-sans tracking-wider text-muted-foreground uppercase mb-1">
              MAJOR RESULT
            </p>
            <p className="text-sm text-foreground">
              <span className="text-prestige-gold">★</span>{" "}
              {horse.majorResult.replace("★ ", "")}
            </p>
          </div>
          <div className="md:col-span-1">
            <p className="text-[10px] font-sans tracking-wider text-muted-foreground uppercase mb-1">
              STEWARD NOTE
            </p>
            <p className="text-sm text-foreground">{horse.stewardNote}</p>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-white/10 bg-black/20 p-5">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="h-4 w-4 text-prestige-gold shrink-0" />
          <h2 className="text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase">
            PROVENANCE RECORD
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <p className="text-[10px] font-sans tracking-wider text-muted-foreground uppercase mb-1">
              DNA HASH
            </p>
            <p className="text-sm font-mono text-terminal-cyan cursor-pointer hover:underline">
              {horse.dnaHash.slice(0, 10)}...{horse.dnaHash.slice(-4)}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-sans tracking-wider text-muted-foreground uppercase mb-1">
              METADATA POINTER
            </p>
            <p className="text-sm text-muted-foreground font-mono">
              {horse.metadataPointer}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-sans tracking-wider text-muted-foreground uppercase mb-1">
              LAST RESULT
            </p>
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {horse.lastResult}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-sans tracking-wider text-muted-foreground uppercase mb-1">
              ORACLE SOURCE
            </p>
            <p className="text-sm text-muted-foreground font-mono">
              {horse.oracleSource}
            </p>
          </div>
        </div>
      </div>

      <HorseTabs activeTab={activeTab} onTabChange={setActiveTab}>
        {activeTab === "overview" && <OverviewTab horse={horse} />}
        {activeTab === "ownership" && <OwnershipTab horse={horse} />}
        {activeTab === "breeding" && <BreedingTab horse={horse} />}
        {activeTab === "analytics" && <AnalyticsTab horse={horse} />}
      </HorseTabs>
    </div>
  );
}
