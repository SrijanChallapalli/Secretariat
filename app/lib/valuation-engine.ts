import type {
  FeatureVector,
  ValuationResult,
  ValuationEngine,
  MarketData,
} from "../../shared/types";
import {
  calculateValue,
  adjustForEvent as agentAdjustForEvent,
  type HorseValuationInput,
  type MarketData as AgentMarketData,
} from "./horse-valuation-agent";
import {
  calculateDosageIndex,
  calculateCD,
  classifyDistance,
} from "../../shared/dosage";

export type { FeatureVector, ValuationResult, ValuationEngine, MarketData };

// ---------------------------------------------------------------------------
// Map FeatureVector → HorseValuationInput
// ---------------------------------------------------------------------------

function toInput(f: FeatureVector): HorseValuationInput {
  const status = f.status ?? (f.retired ? "retired" : "active");
  const health = f.injured ? 50 : f.health;
  const age =
    f.age ??
    (f.birthTimestamp > 0
      ? Math.floor((Date.now() / 1000 - f.birthTimestamp) / (365.25 * 24 * 3600))
      : undefined);

  return {
    age,
    sex: f.sex,
    status,
    speed: f.speed,
    stamina: f.stamina,
    health,
    pedigreeScore: f.pedigreeScore,
    wins: f.wins ?? 0,
    totalRaces: f.totalRaces ?? 0,
    totalEarnings: f.totalEarnings ?? 0,
    offspringCount: f.offspringCount ?? 0,
    offspringWins: f.offspringWins ?? 0,
  };
}

function flattenBreakdown(bd: object): Record<string, number> {
  const flat: Record<string, number> = {};
  for (const [k, v] of Object.entries(bd)) {
    if (typeof v === "number") flat[k] = v;
  }
  return flat;
}

function applyDosage(
  features: FeatureVector,
  breakdown: Record<string, number>,
  value: number,
): { value: number; breakdown: Record<string, number> } {
  if (!features.dosageProfile) return { value, breakdown };

  const di = calculateDosageIndex(features.dosageProfile);
  const cd = calculateCD(features.dosageProfile);
  const classification = classifyDistance(di);

  const breedingValue = breakdown.breedingValue ?? 0;
  const racingValue = breakdown.racingValue ?? 0;
  const total = racingValue + breedingValue;

  let dosageMultiplier = 1.0;
  if (di < 2.5) dosageMultiplier = 1.10;
  else if (di > 4.0) dosageMultiplier = 0.95;

  if (total > 0 && dosageMultiplier !== 1.0) {
    const breedingFraction = breedingValue / total;
    const boost = breedingFraction * (dosageMultiplier - 1);
    value = value * (1 + boost);
  }

  return {
    value,
    breakdown: {
      ...breakdown,
      dosageIndex: di,
      centerOfDistribution: cd,
      finalValue: value,
    },
  };
}

// ---------------------------------------------------------------------------
// FormulaEngine
// ---------------------------------------------------------------------------

export class FormulaEngine implements ValuationEngine {
  predict(features: FeatureVector, marketData: MarketData = {}): ValuationResult {
    const input = toInput(features);
    const { value, breakdown } = calculateValue(input, marketData as AgentMarketData);
    let flat = flattenBreakdown(breakdown);
    const dosageResult = applyDosage(features, flat, value);
    flat = dosageResult.breakdown;

    return {
      value: dosageResult.value,
      confidence: 1.0,
      breakdown: flat,
      engineVersion: "formula-v1",
    };
  }

  adjustForEvent(
    features: FeatureVector,
    eventType: string,
    eventData: Record<string, unknown> = {},
    marketData: MarketData = {},
  ): ValuationResult {
    const input = toInput(features);
    const { value, breakdown } = agentAdjustForEvent(input, eventType, eventData, marketData as AgentMarketData);
    const flat = flattenBreakdown(breakdown);
    return {
      value,
      confidence: 1.0,
      breakdown: flat,
      engineVersion: "formula-v1",
    };
  }

  version(): string {
    return "formula-v1";
  }
}

// ---------------------------------------------------------------------------
// ModelEngine (stub)
// ---------------------------------------------------------------------------

export class ModelEngine implements ValuationEngine {
  private formula = new FormulaEngine();
  private bundlePath?: string;

  constructor(bundlePath?: string) {
    this.bundlePath = bundlePath;
  }

  predict(features: FeatureVector, marketData?: MarketData): ValuationResult {
    console.log("ModelEngine: falling back to formula (model not loaded)");
    const result = this.formula.predict(features, marketData);
    return { ...result, engineVersion: "model-v1-stub" };
  }

  adjustForEvent(
    features: FeatureVector,
    eventType: string,
    eventData: Record<string, unknown>,
    marketData?: MarketData,
  ): ValuationResult {
    console.log("ModelEngine: falling back to formula (model not loaded)");
    const result = this.formula.adjustForEvent(features, eventType, eventData, marketData);
    return { ...result, engineVersion: "model-v1-stub" };
  }

  async loadModel(bundlePath: string): Promise<void> {
    this.bundlePath = bundlePath;
  }

  version(): string {
    return "model-v1-stub";
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createEngine(type: "formula" | "model" = "formula"): ValuationEngine {
  if (type === "model") return new ModelEngine();
  return new FormulaEngine();
}

// ---------------------------------------------------------------------------
// Bridge helpers: HorseINFT on-chain data → FeatureVector
// ---------------------------------------------------------------------------

export interface HorseINFTLike {
  name?: string;
  birthTimestamp?: bigint | number;
  sireId?: bigint | number;
  damId?: bigint | number;
  traitVector: number[] | readonly number[];
  pedigreeScore: number | bigint;
  valuationADI?: bigint | number;
  injured?: boolean;
  retired?: boolean;
  wins?: number;
  totalRaces?: number;
  totalEarnings?: number;
  offspringCount?: number;
  offspringWins?: number;
  sex?: "male" | "female";
}

export function toFeatureVector(
  chain: HorseINFTLike,
  offChain: {
    age?: number;
    sex?: "male" | "female";
    status?: "active" | "retired" | "deceased";
    wins?: number;
    totalRaces?: number;
    totalEarnings?: number;
    offspringCount?: number;
    offspringWins?: number;
  } = {},
): FeatureVector {
  const t = chain.traitVector ?? [];
  const birth = chain.birthTimestamp != null ? Number(chain.birthTimestamp) : 0;
  const age =
    offChain.age ??
    (birth > 0
      ? Math.floor((Date.now() / 1000 - birth) / (365.25 * 24 * 3600))
      : undefined);

  return {
    speed: Number(t[0] ?? 0),
    stamina: Number(t[1] ?? 0),
    temperament: Number(t[2] ?? 0),
    conformation: Number(t[3] ?? 0),
    health: chain.injured ? 50 : Number(t[4] ?? 80),
    agility: Number(t[5] ?? 0),
    raceIQ: Number(t[6] ?? 0),
    consistency: Number(t[7] ?? 0),
    pedigreeScore: Number(chain.pedigreeScore ?? 0),
    injured: chain.injured ?? false,
    retired: chain.retired ?? false,
    birthTimestamp: birth,
    sireId: Number(chain.sireId ?? 0),
    damId: Number(chain.damId ?? 0),
    age,
    sex: offChain.sex ?? chain.sex,
    status: offChain.status ?? (chain.retired ? "retired" : "active"),
    wins: offChain.wins ?? chain.wins ?? 0,
    totalRaces: offChain.totalRaces ?? chain.totalRaces ?? 0,
    totalEarnings: offChain.totalEarnings ?? chain.totalEarnings ?? 0,
    offspringCount: offChain.offspringCount ?? chain.offspringCount ?? 0,
    offspringWins: offChain.offspringWins ?? chain.offspringWins ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Default singleton
// ---------------------------------------------------------------------------

let _engine: ValuationEngine = new FormulaEngine();

export function getEngine(): ValuationEngine {
  return _engine;
}

export function setEngine(engine: ValuationEngine): ValuationEngine {
  const prev = _engine;
  _engine = engine;
  return prev;
}
