export type InjuryLocation = "fetlock" | "stifle" | "knee" | "tendon" | "hoof" | "back" | "respiratory" | "other";

export interface InjuryClassification {
  location: InjuryLocation;
  name: string;
  baseSeverity: number;
  valuationImpactPct: number;
  recoveryDays: number;
  careerThreatening: boolean;
  breedingImpact: boolean;
}

export const INJURY_CATALOG: Record<string, InjuryClassification> = {
  "fetlock_chip": { location: "fetlock", name: "Fetlock Bone Chip (OCD)", baseSeverity: 3, valuationImpactPct: 15, recoveryDays: 90, careerThreatening: false, breedingImpact: false },
  "stifle_lucency": { location: "stifle", name: "Stifle Condylar Lucency", baseSeverity: 8, valuationImpactPct: 50, recoveryDays: 365, careerThreatening: true, breedingImpact: false },
  "knee_chip": { location: "knee", name: "Knee Bone Chip", baseSeverity: 5, valuationImpactPct: 25, recoveryDays: 120, careerThreatening: false, breedingImpact: false },
  "bowed_tendon": { location: "tendon", name: "Bowed Tendon (SDFT)", baseSeverity: 7, valuationImpactPct: 40, recoveryDays: 270, careerThreatening: true, breedingImpact: false },
  "quarter_crack": { location: "hoof", name: "Quarter Crack", baseSeverity: 4, valuationImpactPct: 10, recoveryDays: 60, careerThreatening: false, breedingImpact: false },
  "roarer_grade3": { location: "respiratory", name: "Laryngeal Hemiplegia (Grade 3)", baseSeverity: 7, valuationImpactPct: 55, recoveryDays: 180, careerThreatening: true, breedingImpact: true },
  "fracture_cannon": { location: "other", name: "Cannon Bone Fracture", baseSeverity: 10, valuationImpactPct: 90, recoveryDays: 365, careerThreatening: true, breedingImpact: true },
  "soft_tissue": { location: "tendon", name: "Suspensory Ligament Injury", baseSeverity: 6, valuationImpactPct: 35, recoveryDays: 210, careerThreatening: false, breedingImpact: false },
};

export function getInjuryClassification(key: string): InjuryClassification | null {
  return INJURY_CATALOG[key] ?? null;
}

export function calculateInjuryValuationDrop(
  currentValue: number,
  injuryKey: string,
): { newValue: number; classification: InjuryClassification } | null {
  const classification = INJURY_CATALOG[injuryKey];
  if (!classification) return null;
  const newValue = currentValue * (1 - classification.valuationImpactPct / 100);
  return { newValue, classification };
}
