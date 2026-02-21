/**
 * Map on-chain horse + listing data to UI types.
 * No mock data — on-chain demo only.
 */

import type { HorseHeatmapItem, HeatmapColor, RiskLevel } from "@/data/mockHorses";
import type { MarketListing, ListingColor, SoundnessStatus } from "@/data/mockMarketListings";
import type { HorseFullData } from "@/data/mockHorses";
import { formatEther } from "viem";
import { isDemoMode, getDemoEnrichment } from "@/lib/demo-enrichment";

export type RawHorseData = {
  name: string;
  birthTimestamp: bigint;
  sireId: bigint;
  damId: bigint;
  traitVector: readonly number[];
  pedigreeScore: number;
  valuationADI: bigint;
  dnaHash: string;
  breedingAvailable: boolean;
  injured: boolean;
  retired: boolean;
};

export type RawListing = {
  studFeeADI: bigint;
  maxUses: bigint;
  usedCount: bigint;
  useAllowlist: boolean;
  active: boolean;
};

const HEATMAP_COLORS: HeatmapColor[] = [
  "blue",
  "purple",
  "orange",
  "grey",
  "teal",
  "green",
  "red",
  "dark-orange",
];

function colorForId(id: number): HeatmapColor {
  return HEATMAP_COLORS[id % HEATMAP_COLORS.length];
}

function riskFromPedigree(pedigree: number): RiskLevel {
  if (pedigree >= 90) return "Low";
  if (pedigree >= 80) return "Med";
  return "High";
}

function computeAge(birthTimestamp: bigint): string {
  if (birthTimestamp <= 0n) return "—";
  const birthMs = Number(birthTimestamp) * 1000;
  const ageMs = Date.now() - birthMs;
  const years = Math.floor(ageMs / (365.25 * 24 * 60 * 60 * 1000));
  if (years < 1) {
    const months = Math.floor(ageMs / (30.44 * 24 * 60 * 60 * 1000));
    return months <= 0 ? "< 1 mo" : `${months} mo`;
  }
  return `${years} yr`;
}

function bloodlineLabel(parentId: bigint): string {
  return parentId > 0n ? `Horse #${parentId}` : "Founder";
}

function sireOrDamLabel(parentId: bigint): string {
  return parentId > 0n ? `Horse #${parentId}` : "Founder";
}

/** Demo: inject fake changePct for heatmap when no valuation feed exists. */
function demoChangePct(tokenId: number, pedigree: number): number {
  const demo =
    process.env.NEXT_PUBLIC_DEMO_HEATMAP === "true" ||
    process.env.NEXT_PUBLIC_CHAIN_ID === "31337";
  if (!demo) return 0;
  // Deterministic spread: -12% to +12% based on tokenId + pedigree
  const seed = (tokenId * 7 + pedigree * 11) % 25;
  return seed - 12;
}

export function mapToHorseHeatmapItem(
  tokenId: number,
  raw: RawHorseData,
  listing?: RawListing | null,
): HorseHeatmapItem {
  const valuation = Number(formatEther(raw.valuationADI));
  const pedigree = raw.pedigreeScore / 100;
  const color = colorForId(tokenId);
  const demo = isDemoMode();
  const enrichment = demo ? getDemoEnrichment(tokenId, raw.name, valuation) : null;
  const changePct = enrichment?.changePct ?? demoChangePct(tokenId, pedigree);
  return {
    id: tokenId,
    name: raw.name || `Horse #${tokenId}`,
    bloodline1: enrichment?.sireLabel ?? bloodlineLabel(raw.sireId),
    bloodline2: enrichment?.damLabel ?? bloodlineLabel(raw.damId),
    valuation,
    changePct,
    risk: riskFromPedigree(pedigree),
    color,
  };
}

export function mapToMarketListing(
  tokenId: number,
  raw: RawHorseData,
  listing: RawListing | null,
  ownerAddress?: string,
): MarketListing {
  const valuationUsd = Number(formatEther(raw.valuationADI));
  const studFeeUsd = listing ? Number(formatEther(listing.studFeeADI)) : 0;
  const uses = listing ? Number(listing.usedCount) : 0;
  const maxUses = listing ? Number(listing.maxUses) : 0;
  const color = colorForId(tokenId) as ListingColor;
  const demo = isDemoMode();
  const enrichment = demo ? getDemoEnrichment(tokenId, raw.name, valuationUsd) : null;
  const soundness: SoundnessStatus = raw.injured
    ? "CAUTION"
    : enrichment && enrichment.soundness >= 5
      ? "SOUND"
      : "MONITOR";

  return {
    id: tokenId,
    name: raw.name || `Horse #${tokenId}`,
    color,
    bloodlineA: enrichment?.sireLabel ?? bloodlineLabel(raw.sireId),
    bloodlineB: enrichment?.damLabel ?? bloodlineLabel(raw.damId),
    valuationUsd,
    change24hPct: enrichment?.changePct ?? 0,
    soundness,
    wins: enrichment?.totalWins ?? 0,
    grade: enrichment?.grade ?? "—",
    studFeeUsd,
    uses,
    demandScore: raw.pedigreeScore,
  };
}

export function mapToHorseFullData(
  tokenId: number,
  raw: RawHorseData,
  listing: RawListing | null,
  ownerAddress: string,
): HorseFullData {
  const valuation = Number(formatEther(raw.valuationADI));
  const pedigree = raw.pedigreeScore / 100;
  const color = colorForId(tokenId);
  const foaled =
    raw.birthTimestamp > 0n
      ? new Date(Number(raw.birthTimestamp) * 1000).toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
        })
      : "—";

  const demo = isDemoMode();
  const enrichment = demo ? getDemoEnrichment(tokenId, raw.name, valuation) : null;
  const dnaHashRaw = raw.dnaHash && raw.dnaHash !== "0x" ? raw.dnaHash : null;
  const dnaHash = enrichment?.dnaHash ?? dnaHashRaw ?? "0x0";

  return {
    id: tokenId,
    name: raw.name || `Horse #${tokenId}`,
    valuation,
    changePct: enrichment?.changePct ?? 0,
    ownerAddress,
    soundness: enrichment?.soundness ?? (raw.injured ? 1 : 3),
    soundnessMax: 5,
    pedigree,
    color,
    foaled,
    sire: enrichment?.sireLabel ?? sireOrDamLabel(raw.sireId),
    dam: enrichment?.damLabel ?? sireOrDamLabel(raw.damId),
    majorResult: enrichment?.majorResult ?? "No results yet",
    stewardNote: enrichment?.stewardNote ?? "Pending review",
    dnaHash,
    metadataPointer: dnaHash !== "0x0" ? dnaHash.slice(0, 18) : "N/A",
    lastResult: enrichment?.lastResult ?? "Awaiting oracle",
    oracleSource: "0G Oracle",
    valuationOverTime: enrichment?.valuationOverTime ?? [],
    oracleEvents: enrichment?.oracleEvents ?? [],
    stats: {
      age: computeAge(raw.birthTimestamp),
      totalWins: enrichment?.totalWins ?? 0,
      gradeWins: enrichment?.gradeWins ?? 0,
      injuries: enrichment?.injuries ?? (raw.injured ? 1 : 0),
      pedigree,
    },
    breedingListing: listing
      ? {
          studFee: `${formatEther(listing.studFeeADI)} ADI`,
          remainingUses: Number(listing.maxUses) - Number(listing.usedCount),
          allowlist: listing.useAllowlist ? "Restricted" : "Open",
        }
      : {
          studFee: "—",
          remainingUses: 0,
          allowlist: "—",
        },
    breedingPicks: enrichment?.breedingPicks ?? [],
    traitVector: {
      speed: raw.traitVector[0] ?? 0,
      stamina: raw.traitVector[1] ?? 0,
      temperament: raw.traitVector[2] ?? 0,
      durability: raw.traitVector[3] ?? 0,
      pedigree,
    } as HorseFullData["traitVector"],
    valuationDrivers: enrichment?.valuationDrivers ?? [],
  };
}

function toBigInt(v: unknown): bigint {
  if (typeof v === "bigint") return v;
  if (typeof v === "number" && !Number.isNaN(v)) return BigInt(Math.floor(v));
  if (typeof v === "string") return BigInt(v || "0");
  return 0n;
}

export function parseRawHorseData(result: unknown): RawHorseData | null {
  if (!result || typeof result !== "object") return null;
  const r = result as Record<string, unknown>;
  const name = (r.name ?? r[0]) as string;
  const birthTimestamp = toBigInt(r.birthTimestamp ?? r[1]);
  const sireId = toBigInt(r.sireId ?? r[2]);
  const damId = toBigInt(r.damId ?? r[3]);
  const traitVector = (r.traitVector ?? r[4] ?? []) as number[];
  const pedigreeScore = Number(r.pedigreeScore ?? r[5] ?? 0);
  const valuationADI = toBigInt(r.valuationADI ?? r[6]);
  const dnaHash = String(r.dnaHash ?? r[7] ?? "0x");
  const breedingAvailable = Boolean(r.breedingAvailable ?? r[8] ?? false);
  const injured = Boolean(r.injured ?? r[9] ?? false);
  const retired = Boolean(r.retired ?? r[10] ?? false);

  const hasName = typeof name === "string" && name.trim().length > 0;
  const hasBirth = birthTimestamp > 0n;
  if (!hasName && !hasBirth) return null;

  return {
    name: name || "",
    birthTimestamp,
    sireId,
    damId,
    traitVector: Array.isArray(traitVector) ? traitVector : [],
    pedigreeScore,
    valuationADI,
    dnaHash,
    breedingAvailable,
    injured,
    retired,
  };
}

export function parseRawListing(result: unknown): RawListing | null {
  if (!result || typeof result !== "object") return null;
  const r = result as Record<string, unknown>;
  return {
    studFeeADI: toBigInt(r.studFeeADI ?? r[0]),
    maxUses: toBigInt(r.maxUses ?? r[1]),
    usedCount: toBigInt(r.usedCount ?? r[2]),
    useAllowlist: Boolean(r.useAllowlist ?? r[3] ?? false),
    active: Boolean(r.active ?? r[4] ?? false),
  };
}
