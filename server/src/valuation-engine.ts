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
import { detectXFactor, type PedigreeNode } from "../../shared/x-factor.js";
import { XGBoostPredictor, type HorseInput } from "./xgboost-predictor.js";

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
// X-Factor premium
// ---------------------------------------------------------------------------

function applyXFactor(
  features: FeatureVector,
  breakdown: Record<string, number>,
  value: number,
  pedigreeMap?: Map<number, PedigreeNode>,
): { value: number; breakdown: Record<string, number> } {
  if (!features.xFactorCarrier && !pedigreeMap) return { value, breakdown };

  let multiplier = 1.0;
  if (features.xFactorCarrier) {
    multiplier = 1.15;
  } else if (pedigreeMap && features.sireId != null && features.damId != null) {
    const targetId = features.sireId * 1000 + features.damId; // synthetic id
    const result = detectXFactor(targetId, pedigreeMap);
    multiplier = result.breedingPremiumMultiplier;
  }

  if (multiplier === 1.0) return { value, breakdown };

  return {
    value: value * multiplier,
    breakdown: {
      ...breakdown,
      xFactorMultiplier: multiplier,
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
    const xFactorResult = applyXFactor(features, flat, dosageResult.value);
    flat = xFactorResult.breakdown;

    return {
      value: xFactorResult.value,
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
// ModelEngine — XGBoost-backed valuation
// ---------------------------------------------------------------------------

function featuresToXGBInput(f: FeatureVector): HorseInput {
  const races = f.totalRaces ?? 0;
  const wins = f.wins ?? 0;
  const age =
    f.age ??
    (f.birthTimestamp > 0
      ? Math.floor((Date.now() / 1000 - f.birthTimestamp) / (365.25 * 24 * 3600))
      : 3);

  const sexMap: Record<string, string> = { male: "C", female: "F" };
  const sex = f.sex ? (sexMap[f.sex] ?? "G") : "G";

  return {
    raceCount: races,
    winCount: wins,
    placeCount: Math.round(wins * 1.8),
    avgPosition: races > 0 ? (wins > 0 ? Math.max(1, 5 - (wins / races) * 4) : 6) : 0,
    stdPosition: 2.5,
    bestPosition: wins > 0 ? 1 : 3,
    worstPosition: races > 0 ? Math.min(races, 12) : 0,
    avgNormPosition: races > 0 ? 0.4 : 0,
    avgFieldSize: 8,
    avgSp: 10,
    minSp: 3,
    avgWeight: 128,
    avgDistance: 8,
    stdDistance: 2,
    avgOfficialRating: f.speedFigures?.length
      ? f.speedFigures.reduce((a, b) => a + b, 0) / f.speedFigures.length
      : (f.speed ?? 0) * 1.2,
    maxOfficialRating: f.speedFigures?.length
      ? Math.max(...f.speedFigures)
      : (f.speed ?? 0) * 1.3,
    age,
    avgClass: Math.max(1, 6 - (f.pedigreeScore ?? 0) / 2000),
    bestClass: Math.max(1, 5 - (f.pedigreeScore ?? 0) / 2500),
    surfacePctTurf: 1,
    sex,
  };
}

export class ModelEngine implements ValuationEngine {
  private formula = new FormulaEngine();
  private predictor: XGBoostPredictor | null = null;
  private bundlePath?: string;

  constructor(bundlePath?: string) {
    this.bundlePath = bundlePath;
    try {
      this.predictor = new XGBoostPredictor();
    } catch {
      console.warn("ModelEngine: XGBoost model not found, will fall back to formula.");
    }
  }

  predict(features: FeatureVector, marketData?: MarketData): ValuationResult {
    if (!this.predictor) {
      const result = this.formula.predict(features, marketData);
      return { ...result, engineVersion: "model-v1-fallback" };
    }

    const input = featuresToXGBInput(features);
    const mlValueGBP = this.predictor.predict(input);

    const formulaResult = this.formula.predict(features, marketData);

    // ML model predicts GBP prize earnings; formula produces ADI-scale values.
    // Use the ML prediction as a relative signal: compute a multiplier from the
    // ML-predicted earning power (median training set is ~£2,500) and apply it
    // to the formula base, clamped to a reasonable range.
    const mlMedian = 2500;
    const mlRatio = Math.max(0.1, Math.min(10, mlValueGBP / mlMedian));
    const adjustedValue = formulaResult.value * (0.4 + 0.6 * mlRatio);

    return {
      value: adjustedValue,
      confidence: 0.85,
      breakdown: {
        ...formulaResult.breakdown,
        mlPredictionGBP: mlValueGBP,
        mlRatio,
        formulaPrediction: formulaResult.value,
      },
      engineVersion: `model-v1-xgb-${this.predictor.treeCount()}t`,
    };
  }

  adjustForEvent(
    features: FeatureVector,
    eventType: string,
    eventData: Record<string, unknown>,
    marketData?: MarketData,
  ): ValuationResult {
    const basePrediction = this.predict(features, marketData);
    const formulaAdj = this.formula.adjustForEvent(features, eventType, eventData, marketData);
    const formulaBase = this.formula.predict(features, marketData);

    const eventMultiplier =
      formulaBase.value > 0 ? formulaAdj.value / formulaBase.value : 1.0;

    return {
      value: basePrediction.value * eventMultiplier,
      confidence: 0.8,
      breakdown: {
        ...basePrediction.breakdown,
        eventMultiplier,
      },
      engineVersion: basePrediction.engineVersion,
    };
  }

  async loadModel(bundlePath: string): Promise<void> {
    this.bundlePath = bundlePath;
  }

  version(): string {
    return this.predictor
      ? `model-v1-xgb-${this.predictor.treeCount()}t`
      : "model-v1-fallback";
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createEngine(type: "formula" | "model" = "formula"): ValuationEngine {
  if (type === "model") return new ModelEngine();
  return new FormulaEngine();
}
