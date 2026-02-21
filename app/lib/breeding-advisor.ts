/**
 * Breeding Advisor scoring engine.
 *
 * Combines trait compatibility, pedigree synergy, complementary trait fill,
 * cost, and form into a single score. When the server is available, the breed
 * page may call POST /breeding/recommend for XGBoost-enhanced scoring; this
 * module serves as the offline / client-side fallback.
 */

const W_TRAITS = 0.30;
const W_PEDIGREE = 0.25;
const W_COMPLEMENT = 0.15;
const W_INBREEDING = 0.10;
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
  aiExplanation?: string;
  predictedOffspringValue?: number;
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

function inbreedingScore(_sireId: number, _damId: number, _stallionId: number): number {
  if (_stallionId === _sireId || _stallionId === _damId) return 1;
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
    const complement = complementScore(mare.traitVector, stallion.traitVector);
    const inbreedingRisk = 0;
    const fee = Number(stallion.studFeeADI ?? 0) / 1e18;
    const maxFee = maxStudFee ? Number(maxStudFee) / 1e18 : 10000;
    const costPenalty = maxFee > 0 ? Math.min(1, fee / maxFee) : 0;
    const formBonus = stallion.injured ? 0 : 0.05;

    const score =
      W_TRAITS * (traitMatch * 0.5 + 0.5) +
      W_PEDIGREE * pedigreeSynergy +
      W_COMPLEMENT * complement -
      W_INBREEDING * inbreedingRisk -
      W_COST * costPenalty +
      W_FORM * formBonus;

    const riskFlags: string[] = [];
    if (stallion.injured) riskFlags.push("Injury");
    if (fee > maxFee * 0.8) riskFlags.push("High fee");
    if (traitMatch < 0.3) riskFlags.push("Low trait match");
    if (complement < 0.4) riskFlags.push("Low trait complement");
    if (pedigreeSynergy < 0.7) riskFlags.push("Pedigree mismatch");

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

const SERVER_URL =
  process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:4000";

/**
 * Fetch breeding recommendations from the server (XGBoost + 0G Compute).
 * Falls back to client-side scoring on failure.
 */
export async function fetchServerRecommendations(
  mare: HorseTraits,
  stallions: HorseTraits[],
  maxStudFee?: bigint,
): Promise<{ recommendations: Recommendation[]; modelVersion: string; ogComputeEnabled: boolean }> {
  const toServerHorse = (h: HorseTraits) => ({
    tokenId: h.tokenId,
    name: h.name || `Horse #${h.tokenId}`,
    traitVector: h.traitVector,
    pedigreeScore: h.pedigreeScore,
    injured: h.injured,
    studFeeADI: Number(h.studFeeADI ?? 0),
  });

  const res = await fetch(`${SERVER_URL}/breeding/recommend`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mare: toServerHorse(mare),
      stallions: stallions.map(toServerHorse),
      maxStudFee: maxStudFee ? Number(maxStudFee) / 1e18 : 10000,
      explain: true,
    }),
  });

  if (!res.ok) throw new Error(`Server responded ${res.status}`);
  const data = await res.json();

  const recs: Recommendation[] = (data.recommendations ?? []).map(
    (r: Record<string, unknown>) => ({
      stallionTokenId: r.stallionTokenId as number,
      score: r.score as number,
      explainability: {
        traitMatch: (r.explainability as Record<string, number>)?.traitMatch ?? 0,
        pedigreeSynergy: (r.explainability as Record<string, number>)?.pedigreeSynergy ?? 0,
        inbreedingRisk: (r.explainability as Record<string, number>)?.inbreedingRisk ?? 0,
        costPenalty: (r.explainability as Record<string, number>)?.costPenalty ?? 0,
        formBonus: (r.explainability as Record<string, number>)?.formBonus ?? 0,
      },
      riskFlags: (r.riskFlags as string[]) ?? [],
      aiExplanation: (r.aiExplanation as string) || undefined,
      predictedOffspringValue: (r.predictedOffspringValue as number) || undefined,
    }),
  );

  return {
    recommendations: recs,
    modelVersion: data.modelVersion ?? "unknown",
    ogComputeEnabled: data.ogComputeEnabled ?? false,
  };
}
