/**
 * Biometric scan engine — evaluates five physiological subsystems from a
 * horse's FeatureVector with Palmgren-Miner cumulative bone fatigue tracking
 * and a 1-6 Risk Score scale.
 *
 * Risk Score 6 = 44.6x more likely to suffer a fatal breakdown.
 */

import type {
  FeatureVector,
  BiometricLabel,
  BiometricSubsystem,
  BiometricSubsystemId,
  BiometricScanResult,
  FatigueHistory,
} from "../../shared/types.js";

const ENGINE_VERSION = "biometric-v2";

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
// Palmgren-Miner's Rule — cumulative bone damage
// D = Σ(ni / Ni)  where ni = cycles at stress level, Ni = cycles to failure
// When D approaches 1.0, failure is mathematically guaranteed.
// ---------------------------------------------------------------------------

export function calculateMinerDamage(history: FatigueHistory[]): number {
  if (!history || history.length === 0) return 0;
  return history.reduce((D, h) => {
    if (h.cyclesToFailure <= 0) return D;
    return D + h.stressLevel / h.cyclesToFailure;
  }, 0);
}

// ---------------------------------------------------------------------------
// Risk Score mapping (1-6) from overall biometric score + Miner's damage
// ---------------------------------------------------------------------------

export function computeRiskScore(
  overallScore: number,
  minerDamage: number,
): 1 | 2 | 3 | 4 | 5 | 6 {
  // Level 6 = catastrophic (44.6x breakdown likelihood)
  if (overallScore < 25 || minerDamage >= 0.9) return 6;
  if (overallScore < 40 || minerDamage >= 0.8) return 5;
  if (overallScore < 55 || minerDamage >= 0.6) return 4;
  if (overallScore < 70 || minerDamage >= 0.4) return 3;
  if (overallScore < 85 || minerDamage >= 0.2) return 2;
  return 1;
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

function scoreSkeletal(f: FeatureVector, minerDamage: number): BiometricSubsystem {
  let score = (f.conformation * 0.5 + f.health * 0.3 + f.consistency * 0.2);
  const reasons: string[] = [];
  const flags: string[] = [];

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

  // Palmgren-Miner fatigue impact on skeletal score
  if (minerDamage >= 0.8) {
    score = clamp(score - 25);
    reasons.push(`Miner's damage D=${minerDamage.toFixed(2)} — failure mathematically approaching`);
    flags.push("MINER_CRITICAL");
  } else if (minerDamage >= 0.5) {
    score = clamp(score - 15);
    reasons.push(`Miner's damage D=${minerDamage.toFixed(2)} — significant cumulative fatigue`);
    flags.push("MINER_ELEVATED");
  } else if (minerDamage > 0.2) {
    score = clamp(score - 5);
    reasons.push(`Miner's damage D=${minerDamage.toFixed(2)} — moderate cumulative fatigue`);
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
    flags: flags.length ? flags : undefined,
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

function scoreJoints(f: FeatureVector, minerDamage: number): BiometricSubsystem {
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
  if (minerDamage >= 0.6) {
    score = clamp(score - 10);
    reasons.push("High cumulative bone fatigue increases joint failure risk");
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
    fatigueHistory?: FatigueHistory[];
  },
): BiometricScanResult {
  const minerDamage = calculateMinerDamage(context?.fatigueHistory ?? []);

  const subsystems: BiometricSubsystem[] = [
    scoreHeart(features),
    scoreLungs(features),
    scoreSkeletal(features, minerDamage),
    scoreMusculature(features),
    scoreJoints(features, minerDamage),
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

  const riskScore = computeRiskScore(overallScore, minerDamage);

  const notes: string[] = [];
  if (features.xFactorCarrier) notes.push("X-factor carrier detected");
  if (features.injured) notes.push("Horse currently listed as injured");
  if (features.retired) notes.push("Horse is retired");
  if (minerDamage >= 0.8) notes.push(`CRITICAL: Palmgren-Miner D=${minerDamage.toFixed(3)} — bone failure imminent`);
  else if (minerDamage >= 0.5) notes.push(`WARNING: Palmgren-Miner D=${minerDamage.toFixed(3)} — elevated fatigue`);
  if (riskScore === 6) notes.push("RISK SCORE 6: 44.6x breakdown likelihood — Lazarus Protocol eligible");

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
    riskScore,
    minerDamage: minerDamage > 0 ? minerDamage : undefined,
    subsystems,
    notes: notes.length ? notes : undefined,
    source: { kind: "SIMULATION", confidence: 0.8 },
  };
}
