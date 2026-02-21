import { Request, Response } from "express";
import { XGBoostPredictor, type HorseInput } from "./xgboost-predictor.js";
import { generateBreedingExplanation, isOgComputeConfigured } from "./og-compute.js";

interface HorseData {
  tokenId: number;
  name?: string;
  traitVector: number[];
  pedigreeScore: number;
  injured?: boolean;
  studFeeADI?: number;
  sire?: string;
  damsire?: string;
  age?: number;
  sex?: string;
  wins?: number;
  totalRaces?: number;
}

interface BreedingRecommendation {
  stallionTokenId: number;
  stallionName?: string;
  score: number;
  predictedOffspringValue: number;
  explainability: {
    traitMatch: number;
    pedigreeSynergy: number;
    inbreedingRisk: number;
    costPenalty: number;
    formBonus: number;
    mlOffspringValue: number;
  };
  riskFlags: string[];
  aiExplanation?: string;
}

let predictor: XGBoostPredictor | null = null;
function getPredictor(): XGBoostPredictor | null {
  if (predictor) return predictor;
  try {
    predictor = new XGBoostPredictor();
    return predictor;
  } catch {
    return null;
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const den = Math.sqrt(na) * Math.sqrt(nb);
  return den === 0 ? 0 : dot / den;
}

function complementScore(mareTraits: number[], stallionTraits: number[]): number {
  if (mareTraits.length !== stallionTraits.length) return 0;
  let sum = 0, count = 0;
  for (let i = 0; i < mareTraits.length; i++) {
    if (mareTraits[i] / 100 < 0.8) {
      sum += stallionTraits[i] / 100;
      count++;
    }
  }
  return count === 0 ? 0.5 : sum / count;
}

function expectedOffspringTraits(sire: number[], dam: number[]): number[] {
  return sire.map((s, i) => Math.round(s * 0.55 + (dam[i] ?? 0) * 0.45));
}

function horseDataToInput(h: HorseData): HorseInput {
  const traits = h.traitVector ?? [];
  const races = h.totalRaces ?? 0;
  const wins = h.wins ?? 0;
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
    avgOfficialRating: (traits[0] ?? 0) * 1.2,
    maxOfficialRating: (traits[0] ?? 0) * 1.3,
    age: h.age ?? 3,
    avgClass: Math.max(1, 6 - (h.pedigreeScore ?? 0) / 2000),
    bestClass: Math.max(1, 5 - (h.pedigreeScore ?? 0) / 2500),
    surfacePctTurf: 1,
    sex: h.sex ?? "G",
    sire: h.sire,
    damsire: h.damsire,
  };
}

/**
 * Score stallions for a given mare, combining heuristic trait/pedigree scoring
 * with XGBoost-predicted offspring value.
 */
function scoreStallions(
  mare: HorseData,
  stallions: HorseData[],
  maxStudFee: number,
  xgb: XGBoostPredictor | null,
): BreedingRecommendation[] {
  const W_TRAITS = 0.25;
  const W_PEDIGREE = 0.20;
  const W_COMPLEMENT = 0.15;
  const W_COST = 0.10;
  const W_FORM = 0.05;
  const W_ML = 0.25;

  const results = stallions.map((stallion) => {
    const traitMatch = cosineSimilarity(mare.traitVector, stallion.traitVector);
    const pedigreeSynergy = (mare.pedigreeScore / 10000 + stallion.pedigreeScore / 10000) / 2;
    const complement = complementScore(mare.traitVector, stallion.traitVector);
    const fee = (stallion.studFeeADI ?? 0) / 1e18;
    const costPenalty = maxStudFee > 0 ? Math.min(1, fee / maxStudFee) : 0;
    const formBonus = stallion.injured ? 0 : 0.05;

    let mlScore = 0.5;
    let predictedOffspringValue = 0;
    if (xgb) {
      const offspringTraits = expectedOffspringTraits(stallion.traitVector, mare.traitVector);
      const offspringInput: HorseInput = {
        ...horseDataToInput({
          ...mare,
          traitVector: offspringTraits,
          pedigreeScore: Math.round((mare.pedigreeScore + stallion.pedigreeScore) / 2),
        }),
        age: 3,
        sex: "C",
        sire: stallion.sire,
        damsire: mare.damsire,
      };
      predictedOffspringValue = xgb.predict(offspringInput);
      const median = 2500;
      mlScore = Math.min(1, Math.max(0, predictedOffspringValue / (median * 5)));
    }

    const score =
      W_TRAITS * (traitMatch * 0.5 + 0.5) +
      W_PEDIGREE * pedigreeSynergy +
      W_COMPLEMENT * complement -
      W_COST * costPenalty +
      W_FORM * formBonus +
      W_ML * mlScore;

    const riskFlags: string[] = [];
    if (stallion.injured) riskFlags.push("Injury");
    if (fee > maxStudFee * 0.8) riskFlags.push("High fee");
    if (traitMatch < 0.3) riskFlags.push("Low trait match");
    if (complement < 0.4) riskFlags.push("Low trait complement");

    return {
      stallionTokenId: stallion.tokenId,
      stallionName: stallion.name || `Stallion #${stallion.tokenId}`,
      score: Math.max(0, Math.min(1, score)),
      predictedOffspringValue,
      explainability: {
        traitMatch: traitMatch * 0.5 + 0.5,
        pedigreeSynergy,
        inbreedingRisk: 0,
        costPenalty,
        formBonus,
        mlOffspringValue: predictedOffspringValue,
      },
      riskFlags,
    };
  });

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, 3);
}

/**
 * POST /breeding/recommend
 * Body: { mare, stallions, maxStudFee?, explain?: boolean }
 *
 * When `explain` is true (or 0G Compute is configured), the top 3 picks are
 * enriched with natural-language AI explanations generated via 0G Compute
 * Network (qwen-2.5-7b-instruct on testnet).
 */
export async function breedingRoute(req: Request, res: Response) {
  try {
    const { mare, stallions, maxStudFee, explain } = req.body ?? {};
    if (!mare || !Array.isArray(stallions)) {
      res.status(400).json({ error: "mare (object) and stallions (array) required" });
      return;
    }

    const xgb = getPredictor();
    const maxFee = typeof maxStudFee === "number" ? maxStudFee : 10000;
    const picks = scoreStallions(mare, stallions, maxFee, xgb);

    const shouldExplain = explain !== false && isOgComputeConfigured();

    if (shouldExplain && picks.length > 0) {
      const mareName = mare.name || `Mare #${mare.tokenId}`;
      const breakdowns = picks.map((p) => ({
        stallionName: p.stallionName ?? `Stallion #${p.stallionTokenId}`,
        traitMatch: p.explainability.traitMatch,
        pedigreeSynergy: p.explainability.pedigreeSynergy,
        costPenalty: p.explainability.costPenalty,
        formBonus: p.explainability.formBonus,
        mlOffspringValue: p.explainability.mlOffspringValue,
        riskFlags: p.riskFlags,
        overallScore: p.score,
      }));

      const explanations = await generateBreedingExplanation(mareName, breakdowns);
      for (let i = 0; i < picks.length; i++) {
        picks[i].aiExplanation = explanations[i] || undefined;
      }
    }

    res.json({
      recommendations: picks,
      modelVersion: xgb ? `xgboost-${xgb.treeCount()}t` : "heuristic-only",
      ogComputeEnabled: shouldExplain,
    });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
}
