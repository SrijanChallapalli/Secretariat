/**
 * S-Agent scoring engine (Secretariat integration).
 * Integrates https://github.com/Ayaan-Ameen07/S-Agent into Secretariat.
 *
 * S-Agent emphasizes pedigree synergy and complementary traits (stallion-mare pairing).
 * Uses same HorseTraits/Recommendation shapes as Breeding Advisor for consistency.
 *
 * When S-Agent upstream provides its own model/logic, replace this implementation
 * or load it dynamically from the 0G bundle.
 */

import type { HorseTraits, Recommendation } from "./breeding-advisor";

const W_TRAITS = 0.30;
const W_PEDIGREE = 0.35;
const W_COMPLEMENT = 0.20;
const W_COST = 0.10;
const W_FORM = 0.05;

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0,
    na = 0,
    nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const den = Math.sqrt(na) * Math.sqrt(nb);
  return den === 0 ? 0 : dot / den;
}

/**
 * Complement score: how well stallion traits fill mare's weaker dimensions.
 * Higher when stallion excels where mare is weaker (0-1).
 */
function complementScore(mareTraits: number[], stallionTraits: number[]): number {
  if (mareTraits.length !== stallionTraits.length) return 0;
  let sum = 0;
  let count = 0;
  for (let i = 0; i < mareTraits.length; i++) {
    const mareVal = mareTraits[i] / 100;
    const stallionVal = stallionTraits[i] / 100;
    if (mareVal < 0.8) {
      sum += stallionVal;
      count++;
    }
  }
  return count === 0 ? 0.5 : sum / count;
}

export function scoreStallionsSAgent(
  mare: HorseTraits,
  stallions: HorseTraits[],
  maxStudFee?: bigint
): Recommendation[] {
  const results: Recommendation[] = stallions.map((stallion) => {
    const traitMatch = cosineSimilarity(mare.traitVector, stallion.traitVector);
    const pedigreeSynergy = (mare.pedigreeScore / 10000 + stallion.pedigreeScore / 10000) / 2;
    const complement = complementScore(mare.traitVector, stallion.traitVector);
    const fee = Number(stallion.studFeeADI ?? 0) / 1e18;
    const maxFee = maxStudFee ? Number(maxStudFee) / 1e18 : 10000;
    const costPenalty = maxFee > 0 ? Math.min(1, fee / maxFee) : 0;
    const formBonus = stallion.injured ? 0 : 0.05;

    const score =
      W_TRAITS * (traitMatch * 0.5 + 0.5) +
      W_PEDIGREE * pedigreeSynergy +
      W_COMPLEMENT * complement -
      W_COST * costPenalty +
      W_FORM * formBonus;

    const riskFlags: string[] = [];
    if (stallion.injured) riskFlags.push("Injury");
    if (fee > maxFee * 0.9) riskFlags.push("High fee");
    if (complement < 0.4) riskFlags.push("Low trait complement");
    if (pedigreeSynergy < 0.7) riskFlags.push("Pedigree mismatch");

    const formBonusVal = stallion.injured ? 0 : 0.05;
    return {
      stallionTokenId: stallion.tokenId,
      score: Math.max(0, Math.min(1, score)),
      explainability: {
        traitMatch: (traitMatch * 0.5 + 0.5 + complement) / 2,
        pedigreeSynergy,
        inbreedingRisk: 0,
        costPenalty,
        formBonus: formBonusVal,
      },
      riskFlags,
    };
  });

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, 3);
}
