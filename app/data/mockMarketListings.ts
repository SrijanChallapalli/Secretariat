/**
 * Market listing UI types. Data comes from on-chain only.
 */

export type SoundnessStatus = "SOUND" | "MONITOR" | "CAUTION";

export type ListingColor =
  | "blue"
  | "purple"
  | "orange"
  | "grey"
  | "red"
  | "teal"
  | "green"
  | "dark-orange";

export interface MarketListing {
  id: number;
  name: string;
  color: ListingColor;
  bloodlineA: string;
  bloodlineB: string;
  valuationUsd: number;
  change24hPct: number;
  soundness: SoundnessStatus;
  wins: number;
  grade: string;
  studFeeUsd: number;
  uses: number;
  demandScore: number;
  hasKey?: boolean;
}
