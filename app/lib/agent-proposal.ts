/**
 * Agent proposal engine.
 *
 * The breeding lab is reactive: the user picks a mare, it scores stallions for
 * her. The agent inverts that — it evaluates every eligible mare the user owns
 * against every stallion that may legally cover her, then ranks the whole
 * cross-product and proposes the single best match.
 *
 * Scoring itself is delegated to the server (XGBoost-backed) with the
 * client-side heuristic as a fallback, so a proposal is always produced.
 */

import {
  fetchServerRecommendations,
  scoreStallions,
  expectedOffspringTraits,
  type HorseTraits,
  type Recommendation,
} from "./breeding-advisor";
import {
  eligibleMares,
  eligibleStallionsFor,
  pairingBlockReason,
  type BreedingCandidate,
} from "./breeding-rules";

export interface ProposedPairing {
  mare: HorseTraits;
  stallion: HorseTraits;
  /** 0-1 blended score from the recommendation engine. */
  score: number;
  /** XGBoost-predicted career prize money for the hypothetical foal, GBP. */
  predictedOffspringValue?: number;
  offspringTraits?: number[];
  explanation: string;
  aiExplanation?: string;
  riskFlags: string[];
  studFeeADI: bigint;
  explainability: Recommendation["explainability"];
}

export interface ExcludedPairing {
  mareName: string;
  stallionName: string;
  reason: string;
}

export interface AgentProposal {
  /** Best pairing plus runners-up, highest score first. */
  ranked: ProposedPairing[];
  /** Pairings the rules removed, so the user can see the agent's reasoning. */
  excluded: ExcludedPairing[];
  /** True when scores came from the server model rather than the fallback. */
  usedModel: boolean;
  modelVersion: string;
  ogComputeEnabled: boolean;
  maresConsidered: number;
  stallionsConsidered: number;
}

function describe(rec: Recommendation, mare: HorseTraits, stallion: HorseTraits): string {
  const bits: string[] = [];
  const { traitMatch, pedigreeSynergy } = rec.explainability;
  if (pedigreeSynergy >= 0.85) bits.push("exceptional combined pedigree");
  else if (pedigreeSynergy >= 0.7) bits.push("strong pedigree synergy");
  if (traitMatch >= 0.75) bits.push("closely matched trait profiles");
  else if (traitMatch >= 0.6) bits.push("compatible traits");
  if (rec.predictedOffspringValue && rec.predictedOffspringValue > 20000) {
    bits.push("high projected offspring earnings");
  }
  if (bits.length === 0) bits.push("the strongest available pairing");
  return `${stallion.name} over ${mare.name}: ${bits.join(", ")}.`;
}

/**
 * Build a proposal across every legal pairing. `owned` limits mares to horses
 * the connected account controls; stallions may belong to anyone as long as
 * they are listed at stud.
 */
export async function buildAgentProposal(
  horses: HorseTraits[],
  ownedTokenIds: Set<number>,
  maxStudFeeADI: bigint,
): Promise<AgentProposal> {
  const candidates = horses as BreedingCandidate[];
  const mares = eligibleMares(horses, ownedTokenIds);

  const ranked: ProposedPairing[] = [];
  const excluded: ExcludedPairing[] = [];
  let usedModel = false;
  let modelVersion = "client-fallback";
  let ogComputeEnabled = false;
  let stallionsConsidered = 0;

  for (const mare of mares) {
    const stallions = eligibleStallionsFor(mare, horses);
    stallionsConsidered += stallions.length;

    // Record why other stallions were dropped, so the UI can explain itself.
    for (const s of horses) {
      if (s.tokenId === mare.tokenId) continue;
      if (stallions.some((e) => e.tokenId === s.tokenId)) continue;
      if (BigInt(s.studFeeADI ?? 0) === 0n) continue; // simply not at stud
      const reason = pairingBlockReason(s, mare, candidates);
      if (reason) {
        excluded.push({
          mareName: mare.name ?? `Horse #${mare.tokenId}`,
          stallionName: s.name ?? `Horse #${s.tokenId}`,
          reason,
        });
      }
    }

    if (stallions.length === 0) continue;

    let recs: Recommendation[];
    try {
      const res = await fetchServerRecommendations(mare, stallions, maxStudFeeADI);
      recs = res.recommendations;
      if (recs.length > 0) {
        usedModel = true;
        modelVersion = res.modelVersion;
        ogComputeEnabled = res.ogComputeEnabled;
      }
    } catch {
      recs = scoreStallions(mare, stallions, maxStudFeeADI);
    }

    for (const rec of recs) {
      const stallion = stallions.find((s) => s.tokenId === rec.stallionTokenId);
      if (!stallion) continue;
      ranked.push({
        mare,
        stallion,
        score: rec.score,
        predictedOffspringValue: rec.predictedOffspringValue,
        offspringTraits:
          stallion.traitVector.length && mare.traitVector.length
            ? expectedOffspringTraits(stallion.traitVector, mare.traitVector)
            : undefined,
        explanation: describe(rec, mare, stallion),
        aiExplanation: rec.aiExplanation,
        riskFlags: rec.riskFlags,
        studFeeADI: BigInt(stallion.studFeeADI ?? 0),
        explainability: rec.explainability,
      });
    }
  }

  ranked.sort((a, b) => b.score - a.score);

  return {
    ranked: ranked.slice(0, 3),
    excluded,
    usedModel,
    modelVersion,
    ogComputeEnabled,
    maresConsidered: mares.length,
    stallionsConsidered,
  };
}
