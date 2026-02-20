/**
 * Shared types for the Secretariat valuation engine.
 *
 * Canonical source of truth — imported by both app/ (Next.js) and server/ (Express).
 * Keep this file dependency-free (no runtime imports) — except re-exports from siblings.
 */

export type {
  HorseEvent,
  RaceResultEvent,
  InjuryEvent,
  NewsEvent,
  HorseEventBase,
  EventSource,
  SourceKind,
} from "./events.js";
export { stableStringify, canonicalizeEvent } from "./events.js";

// ---------------------------------------------------------------------------
// Feature vector
// ---------------------------------------------------------------------------

export interface FeatureVector {
  // On-chain fields (from HorseData struct)
  speed: number;
  stamina: number;
  temperament: number;
  conformation: number;
  health: number;
  agility: number;
  raceIQ: number;
  consistency: number;
  pedigreeScore: number;
  injured: boolean;
  retired: boolean;
  birthTimestamp: number;
  sireId: number;
  damId: number;

  // Off-chain enrichment
  age?: number;
  sex?: "male" | "female";
  status?: "active" | "retired" | "deceased";
  wins?: number;
  totalRaces?: number;
  totalEarnings?: number;
  offspringCount?: number;
  offspringWins?: number;

  // Future ML features (nullable — filled when oracle/data available)
  dosageProfile?: [number, number, number, number, number]; // [B, I, C, S, P]
  dosageIndex?: number;
  centerOfDistribution?: number;
  mstnGenotype?: "CC" | "CT" | "TT" | null;
  blackTypeLevel?: number; // 0=none, 1=stakes placed, 2=listed, 3=graded
  scopeGrade?: number; // 1-4
  speedFigures?: number[]; // recent Beyer-style figures
  classLevel?: string;
  injuryHistory?: { type: string; severity: number; timestamp: number }[];
}

// ---------------------------------------------------------------------------
// Market data
// ---------------------------------------------------------------------------

export interface MarketData {
  averageHorseValue?: number;
  bullish?: boolean;
  trendingBloodlines?: string[];
}

// ---------------------------------------------------------------------------
// Valuation result
// ---------------------------------------------------------------------------

export interface ValuationResult {
  value: number;
  confidence: number; // 0-1, formula engine always returns 1.0
  breakdown?: Record<string, number>;
  explanation?: string;
  engineVersion: string; // "formula-v1" or "model-v1-0g-<rootHash>"
}

// ---------------------------------------------------------------------------
// Valuation engine interface
// ---------------------------------------------------------------------------

export interface ValuationEngine {
  predict(
    features: FeatureVector,
    marketData?: MarketData,
  ): ValuationResult;

  adjustForEvent(
    features: FeatureVector,
    eventType: string,
    eventData: Record<string, unknown>,
    marketData?: MarketData,
  ): ValuationResult;

  version(): string;
}

// ---------------------------------------------------------------------------
// Training event (accumulated from on-chain events for future model training)
// ---------------------------------------------------------------------------

export interface TrainingEvent {
  timestamp: number;
  blockNumber: number;
  txHash: string;
  tokenId: number;
  eventType: string;
  featuresBefore: Partial<FeatureVector>;
  valuationBefore: number;
  valuationAfter: number;
  eventData: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Prediction log entry (for accuracy tracking)
// ---------------------------------------------------------------------------

export interface PredictionEntry {
  id: string;
  timestamp: number;
  agentId: string;
  predictionType: string;
  input: Partial<FeatureVector>;
  predictedValue: number;
  actualValue?: number | null;
  resolved: boolean;
}
