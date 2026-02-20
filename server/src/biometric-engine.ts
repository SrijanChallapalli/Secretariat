/**
 * Biometric scan engine — evaluates five physiological subsystems from a
 * horse's FeatureVector and optional recent-context modifiers.
 */

import type {
  FeatureVector,
  BiometricLabel,
  BiometricSubsystem,
  BiometricSubsystemId,
  BiometricScanResult,
} from "../../shared/types.js";

const ENGINE_VERSION = "biometric-v1";

function label(score: number): BiometricLabel {
  if (score >= 85) return "EXCEPTIONAL";
  if (score >= 70) return "STRONG";
  if (score >= 55) return "AVERAGE";
  return "RISK";
}

function clamp(v: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, v));
}

// ---------------------------------------------------------------------------
// Per-subsystem scoring
// ---------------------------------------------------------------------------

function scoreHeart(f: FeatureVector): BiometricSubsystem {
  let score = (f.stamina + f.health) / 2;
  const reasons: string[] = [];
  const highlights: string[] = ["chest"];
  const flags: string[] = [];

  if (f.xFactorCarrier) {
    score = clamp(score + 12);
    reasons.push("X-factor carrier: enlarged heart gene boosts cardiac output");
    flags.push("X_FACTOR");
  }
  if (f.stamina >= 85) reasons.push("Elite stamina supports sustained cardiac performance");
  if (f.health < 50) {
    score = clamp(score - 10);
    reasons.push("Low health baseline reduces cardiac resilience");
  }
  if (reasons.length === 0) reasons.push("Cardiac metrics within normal range");

  return {
    id: "heart",
    score: Math.round(score),
    label: label(score),
    confidence: 0.85,
    reasons,
    impactBps: Math.round((score / 100) * 2500),
    highlights,
    flags: flags.length ? flags : undefined,
  };
}

function scoreLungs(f: FeatureVector): BiometricSubsystem {
  let score = (f.stamina * 0.6 + f.speed * 0.4);
  const reasons: string[] = [];

  if (f.stamina >= 80 && f.speed >= 80) {
    score = clamp(score + 5);
    reasons.push("High stamina + speed indicate strong VO2 max");
  }
  if (f.injured) {
    score = clamp(score - 8);
    reasons.push("Active injury may impair respiratory efficiency");
  }
  if (reasons.length === 0) reasons.push("Respiratory function within expected range");

  return {
    id: "lungs",
    score: Math.round(score),
    label: label(score),
    confidence: 0.8,
    reasons,
    impactBps: Math.round((score / 100) * 2000),
    highlights: ["ribcage"],
  };
}

function scoreSkeletal(f: FeatureVector): BiometricSubsystem {
  let score = (f.conformation * 0.5 + f.health * 0.3 + f.consistency * 0.2);
  const reasons: string[] = [];

  if (f.conformation >= 85) reasons.push("Superior conformation: excellent skeletal alignment");
  if (f.injuryHistory?.length) {
    const severe = f.injuryHistory.filter((h) => h.severity > 5000);
    if (severe.length) {
      score = clamp(score - severe.length * 6);
      reasons.push(`${severe.length} severe injury event(s) in history`);
    }
  }
  if (f.injured) {
    score = clamp(score - 12);
    reasons.push("Currently injured — skeletal stress elevated");
  }
  if (reasons.length === 0) reasons.push("Skeletal integrity within normal parameters");

  return {
    id: "skeletal",
    score: Math.round(score),
    label: label(score),
    confidence: 0.75,
    reasons,
    impactBps: Math.round((score / 100) * 2000),
    highlights: ["spine"],
  };
}

function scoreMusculature(f: FeatureVector): BiometricSubsystem {
  let score = (f.speed * 0.35 + f.agility * 0.35 + f.conformation * 0.3);
  const reasons: string[] = [];

  if (f.speed >= 85 && f.agility >= 80) {
    score = clamp(score + 5);
    reasons.push("Elite speed + agility: exceptional muscular power");
  }
  if (f.retired) {
    score = clamp(score - 5);
    reasons.push("Retired status — muscular conditioning may decline");
  }
  if (f.mstnGenotype === "CC") {
    score = clamp(score + 4);
    reasons.push("MSTN CC genotype favors sprint musculature");
  }
  if (reasons.length === 0) reasons.push("Muscular development within normal range");

  return {
    id: "musculature",
    score: Math.round(score),
    label: label(score),
    confidence: 0.8,
    reasons,
    impactBps: Math.round((score / 100) * 2000),
    highlights: ["shoulder", "hindquarters"],
  };
}

function scoreJoints(f: FeatureVector): BiometricSubsystem {
  let score = (f.health * 0.4 + f.agility * 0.3 + f.conformation * 0.3);
  const reasons: string[] = [];

  const age = f.age ?? 0;
  if (age > 8) {
    score = clamp(score - (age - 8) * 2);
    reasons.push(`Age ${age}: natural joint wear increases risk`);
  }
  if (f.injuryHistory?.some((h) => h.type.toLowerCase().includes("joint"))) {
    score = clamp(score - 8);
    reasons.push("Prior joint injury in history");
  }
  if (f.injured) {
    score = clamp(score - 10);
    reasons.push("Active injury increases joint stress");
  }
  if (reasons.length === 0) reasons.push("Joint health within acceptable range");

  return {
    id: "joints",
    score: Math.round(score),
    label: label(score),
    confidence: 0.75,
    reasons,
    impactBps: Math.round((score / 100) * 1500),
    highlights: ["fetlocks", "hocks", "knees"],
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function createBiometricScan(
  tokenId: number,
  features: FeatureVector,
  context?: {
    recentInjuryBps?: number;
    recentNewsSentBps?: number;
    recentRaceBoostBps?: number;
  },
): BiometricScanResult {
  const subsystems: BiometricSubsystem[] = [
    scoreHeart(features),
    scoreLungs(features),
    scoreSkeletal(features),
    scoreMusculature(features),
    scoreJoints(features),
  ];

  const totalWeight = subsystems.reduce((s, sub) => s + sub.impactBps, 0) || 1;
  let overallScore =
    subsystems.reduce((s, sub) => s + sub.score * sub.impactBps, 0) / totalWeight;

  if (context?.recentInjuryBps) {
    overallScore = clamp(overallScore - context.recentInjuryBps / 100);
  }
  if (context?.recentRaceBoostBps) {
    overallScore = clamp(overallScore + context.recentRaceBoostBps / 200);
  }
  if (context?.recentNewsSentBps) {
    overallScore = clamp(overallScore + context.recentNewsSentBps / 300);
  }

  overallScore = Math.round(overallScore);

  const valuationMultiplierBps =
    overallScore >= 85
      ? 1500
      : overallScore >= 70
        ? 1000
        : overallScore >= 55
          ? 500
          : -500;

  const notes: string[] = [];
  if (features.xFactorCarrier) notes.push("X-factor carrier detected");
  if (features.injured) notes.push("Horse currently listed as injured");
  if (features.retired) notes.push("Horse is retired");

  return {
    schemaVersion: "1.0",
    horseTokenId: tokenId,
    generatedAt: new Date().toISOString(),
    engineVersion: ENGINE_VERSION,
    overall: {
      score: overallScore,
      label: label(overallScore),
      confidence: 0.8,
      valuationMultiplierBps,
    },
    subsystems,
    notes: notes.length ? notes : undefined,
    source: { kind: "SIMULATION", confidence: 0.8 },
  };
}
