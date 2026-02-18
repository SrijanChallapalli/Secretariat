import type {
  FeatureVector,
  ValuationResult,
  ValuationEngine,
  MarketData,
} from "../../shared/types.js";
import { runValuation, type HorseValuationInput } from "./valuation-agent.js";
import {
  calculateDosageIndex,
  calculateCD,
  classifyDistance,
} from "../../shared/dosage.js";

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

function flattenBreakdown(bd: Record<string, unknown>): Record<string, number> {
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
    const result = runValuation(input, marketData);
    let flat = flattenBreakdown(result.breakdown);
    const dosageResult = applyDosage(features, flat, result.value);
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
    const result = runValuation(input, marketData, eventType, eventData);
    const flat = flattenBreakdown(result.breakdown);
    return {
      value: result.value,
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
