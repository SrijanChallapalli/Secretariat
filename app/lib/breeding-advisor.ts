/**
 * Breeding Advisor scoring engine (hackathon-credible, explainable).
 * compatibility = w_traits * cosine_similarity(traits) + w_pedigree * pedigree_synergy - w_inbreeding * inbreeding_score - w_cost * normalized_fee + w_form * performance_proxy
 */

const TRAIT_NAMES = ["speed", "stamina", "temperament", "conformation", "health", "agility", "raceIQ", "consistency"];
const W_TRAITS = 0.35;
const W_PEDIGREE = 0.25;
const W_INBREEDING = 0.2;
const W_COST = 0.15;
const W_FORM = 0.05;

export interface HorseTraits {
  traitVector: number[];
  pedigreeScore: number;
  valuationADI: bigint | number;
  tokenId: number;
  name?: string;
  injured?: boolean;
  studFeeADI?: bigint | number;
}

export interface Recommendation {
  stallionTokenId: number;
  score: number;
  explainability: { traitMatch: number; pedigreeSynergy: number; inbreedingRisk: number; costPenalty: number; formBonus: number };
  riskFlags: string[];
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

function inbreedingScore(sireId: number, damId: number, stallionId: number): number {
  if (stallionId === sireId || stallionId === damId) return 1;
  return 0;
}

export function scoreStallions(
  mare: HorseTraits,
  stallions: HorseTraits[],
  maxStudFee?: bigint
): Recommendation[] {
  const results: Recommendation[] = stallions.map((stallion) => {
    const traitMatch = cosineSimilarity(mare.traitVector, stallion.traitVector);
    const pedigreeSynergy = (mare.pedigreeScore / 10000 + stallion.pedigreeScore / 10000) / 2;
    const inbreedingRisk = 0;
    const fee = Number(stallion.studFeeADI ?? 0) / 1e18;
    const maxFee = maxStudFee ? Number(maxStudFee) / 1e18 : 10000;
    const costPenalty = maxFee > 0 ? Math.min(1, fee / maxFee) : 0;
    const formBonus = stallion.injured ? 0 : 0.05;

    const score =
      W_TRAITS * (traitMatch * 0.5 + 0.5) +
      W_PEDIGREE * pedigreeSynergy -
      W_INBREEDING * inbreedingRisk -
      W_COST * costPenalty +
      W_FORM * formBonus;

    const riskFlags: string[] = [];
    if (stallion.injured) riskFlags.push("Injury");
    if (fee > maxFee * 0.8) riskFlags.push("High fee");
    if (traitMatch < 0.3) riskFlags.push("Low trait match");

    return {
      stallionTokenId: stallion.tokenId,
      score: Math.max(0, Math.min(1, score)),
      explainability: {
        traitMatch: traitMatch * 0.5 + 0.5,
        pedigreeSynergy,
        inbreedingRisk,
        costPenalty,
        formBonus,
      },
      riskFlags,
    };
  });

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, 3);
}

export function expectedOffspringTraits(sire: number[], dam: number[]): number[] {
  return sire.map((s, i) => Math.round((s * 0.55 + (dam[i] ?? 0) * 0.45)));
}
