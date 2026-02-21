import { calculateScarcityPremium } from "./scarcity.js";

export interface CascadeEvent {
  parentTokenId: number;
  parentSex: "male" | "female";
  eventType: "DEATH" | "INJURY" | "RACE_WIN" | "OFFSPRING_WIN";
  parentPedigreeScore: number;
  parentOffspringCount: number;
  injuryCareerThreatening?: boolean;
  raceGrade?: string;
}

export interface OffspringAdjustment {
  offspringTokenId: number;
  multiplier: number;
  reason: string;
}

export interface OffspringSexMap {
  [tokenId: number]: "male" | "female" | "gelding";
}

/// Gelding Disconnect: geldings are excluded from parent cascading effects
/// because they have $0 breeding value and the genetic pricing tie is severed.
export function calculateCascadingEffects(
  event: CascadeEvent,
  offspringTokenIds: number[],
  offspringSexMap?: OffspringSexMap,
): OffspringAdjustment[] {
  if (offspringTokenIds.length === 0) return [];

  // Filter out geldings — parent performance does NOT cascade to gelding IBV
  const eligibleIds = offspringSexMap
    ? offspringTokenIds.filter((id) => offspringSexMap[id] !== "gelding")
    : offspringTokenIds;
  if (eligibleIds.length === 0) return [];

  switch (event.eventType) {
    case "DEATH": {
      const premium = calculateScarcityPremium({
        pedigreeScore: event.parentPedigreeScore,
        sex: event.parentSex,
        offspringCount: event.parentOffspringCount,
      });
      return eligibleIds.map((id) => ({
        offspringTokenId: id,
        multiplier: premium,
        reason: "Sire/Dam deceased — scarcity premium",
      }));
    }

    case "INJURY": {
      if (!event.injuryCareerThreatening) return [];
      const premium = calculateScarcityPremium({
        pedigreeScore: event.parentPedigreeScore,
        sex: event.parentSex,
        offspringCount: event.parentOffspringCount,
      });
      const partial = 1 + (premium - 1) * 0.5;
      return eligibleIds.map((id) => ({
        offspringTokenId: id,
        multiplier: partial,
        reason: "Sire/Dam career-threatening injury — partial scarcity",
      }));
    }

    case "RACE_WIN": {
      const multiplier = event.raceGrade === "Grade 1" ? 1.05 : 1.02;
      const reason =
        event.raceGrade === "Grade 1"
          ? "Sire/Dam G1 winner — Sire Power boost"
          : "Sire/Dam race winner";
      return eligibleIds.map((id) => ({
        offspringTokenId: id,
        multiplier,
        reason,
      }));
    }

    case "OFFSPRING_WIN": {
      return eligibleIds.map((id) => ({
        offspringTokenId: id,
        multiplier: 1.01,
        reason: "Sibling won — proven cross signal",
      }));
    }

    default:
      return [];
  }
}
