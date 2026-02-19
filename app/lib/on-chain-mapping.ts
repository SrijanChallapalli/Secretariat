/**
 * Map on-chain horse + listing data to UI types.
 * No mock data — on-chain demo only.
 */

import type { HorseHeatmapItem, HeatmapColor, RiskLevel } from "@/data/mockHorses";
import type { MarketListing, ListingColor, SoundnessStatus } from "@/data/mockMarketListings";
import type { HorseFullData } from "@/data/mockHorses";
import { formatEther } from "viem";

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

export function mapToHorseHeatmapItem(
  tokenId: number,
  raw: RawHorseData,
  listing?: RawListing | null,
): HorseHeatmapItem {
  const valuation = Number(formatEther(raw.valuationADI));
  const pedigree = raw.pedigreeScore / 100;
  const color = colorForId(tokenId);
  return {
    id: tokenId,
    name: raw.name || `Horse #${tokenId}`,
    bloodline1: raw.sireId > 0n ? `Horse #${raw.sireId}` : "—",
    bloodline2: raw.damId > 0n ? `Horse #${raw.damId}` : "—",
    valuation,
    changePct: 0,
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
  const soundness: SoundnessStatus = raw.injured ? "CAUTION" : "MONITOR";

  return {
    id: tokenId,
    name: raw.name || `Horse #${tokenId}`,
    color,
    bloodlineA: raw.sireId > 0n ? `Horse #${raw.sireId}` : "—",
    bloodlineB: raw.damId > 0n ? `Horse #${raw.damId}` : "—",
    valuationUsd,
    change24hPct: 0,
    soundness,
    wins: 0,
    grade: "—",
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

  return {
    id: tokenId,
    name: raw.name || `Horse #${tokenId}`,
    valuation,
    changePct: 0,
    ownerAddress,
    soundness: raw.injured ? 1 : 3,
    soundnessMax: 5,
    pedigree,
    color,
    foaled,
    sire: raw.sireId > 0n ? `Horse #${raw.sireId}` : "Unknown",
    dam: raw.damId > 0n ? `Horse #${raw.damId}` : "Unknown",
    majorResult: "—",
    stewardNote: "—",
    dnaHash: raw.dnaHash && raw.dnaHash !== "0x" ? raw.dnaHash : "0x0",
    metadataPointer: "—",
    lastResult: "—",
    oracleSource: "—",
    valuationOverTime: [],
    oracleEvents: [],
    stats: {
      age: raw.birthTimestamp > 0n ? "—" : "—",
      totalWins: 0,
      gradeWins: 0,
      injuries: raw.injured ? 1 : 0,
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
    breedingPicks: [],
    traitVector: {
      speed: raw.traitVector[0] ?? 0,
      stamina: raw.traitVector[1] ?? 0,
      temperament: raw.traitVector[2] ?? 0,
      durability: raw.traitVector[3] ?? 0,
      pedigree,
    } as HorseFullData["traitVector"],
    valuationDrivers: [],
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
