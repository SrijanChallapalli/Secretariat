/**
 * Horse UI types. Data comes from on-chain only (getHorseData + listings).
 */

export type RiskLevel = "Low" | "Med" | "High";

export type HeatmapColor =
  | "blue"
  | "purple"
  | "orange"
  | "grey"
  | "red"
  | "teal"
  | "green"
  | "dark-orange";

export interface HorseHeatmapItem {
  id: number;
  name: string;
  bloodline1: string;
  bloodline2: string;
  valuation: number;
  changePct: number;
  risk: RiskLevel;
  color: HeatmapColor;
}

export interface HorseDetail {
  id: number;
  name: string;
  valuation: number;
  changePct: number;
  ownerAddress: string;
  soundness: number;
  soundnessMax: number;
  pedigree: number;
  color: HeatmapColor;
  foaled: string;
  sire: string;
  dam: string;
  majorResult: string;
  stewardNote: string;
  dnaHash: string;
  metadataPointer: string;
  lastResult: string;
  oracleSource: string;
}

export interface ValuationPoint {
  date: string;
  value: number;
}

export interface OracleEvent {
  id: string;
  description: string;
  source: string;
  changePct: number;
  date: string;
  icon?: "trophy" | "warning" | "document";
}

export interface HorseStats {
  age: string;
  totalWins: number;
  gradeWins: number;
  injuries: number;
  pedigree: number;
}

export interface BreedingListing {
  studFee: string;
  remainingUses: number;
  allowlist: string;
}

export interface BreedingPick {
  rank: number;
  name: string;
  match: number;
  edge: number;
  delta: number;
  confidence: "High" | "Medium";
}

export interface TraitVector {
  speed: number;
  stamina: number;
  temperament: number;
  durability: number;
  pedigree: number;
}

export interface ValuationDriver {
  name: string;
  impactPct: number;
}

export interface HorseFullData extends HorseDetail {
  valuationOverTime: ValuationPoint[];
  oracleEvents: OracleEvent[];
  stats: HorseStats;
  breedingListing: BreedingListing;
  breedingPicks: BreedingPick[];
  traitVector: TraitVector;
  valuationDrivers: ValuationDriver[];
}
