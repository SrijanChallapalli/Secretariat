import type {
  FeatureVector,
  BiometricScanResult,
  BiometricSubsystem,
  BiometricLabel,
  BiometricSubsystemId,
} from "../../shared/types.js";

export function labelFromScore(score: number): BiometricLabel {
  if (score >= 85) return "EXCEPTIONAL";
  if (score >= 70) return "STRONG";
  if (score >= 55) return "AVERAGE";
  return "RISK";
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function calculateHeartScore(features: FeatureVector, context?: {
  recentInjuryBps?: number;
  recentNewsSentBps?: number;
  recentRaceBoostBps?: number;
}): BiometricSubsystem {
  // Heart health based on stamina, health, xFactorCarrier (enlarged heart risk)
  let baseScore = (features.stamina * 0.4 + features.health * 0.4 + (100 - features.temperament) * 0.2);
  
  // xFactorCarrier increases risk
  if (features.xFactorCarrier) {
    baseScore *= 0.85;
  }
  
  // Injury context reduces heart score
  if (context?.recentInjuryBps) {
    baseScore *= (1 - context.recentInjuryBps / 10000);
  }
  
  const score = clamp(Math.round(baseScore), 0, 100);
  const label = labelFromScore(score);
  
  const reasons: string[] = [];
  if (features.stamina >= 80) reasons.push(`Stamina ${features.stamina}/100`);
  if (features.health >= 85) reasons.push(`Health ${features.health}/100`);
  if (features.xFactorCarrier) reasons.push("X-factor carrier (enlarged heart risk)");
  if (features.injured) reasons.push("Currently injured");
  if (context?.recentInjuryBps) reasons.push(`Recent injury impact: -${context.recentInjuryBps / 100}%`);
  if (reasons.length === 0) reasons.push(`Stamina ${features.stamina}/100, Health ${features.health}/100`);
  
  const impactBps = Math.round((score - 70) * 15); // -1050 to +450 bps
  
  return {
    id: "heart",
    score,
    label,
    confidence: 0.7 + (features.health > 0 ? 0.1 : 0),
    reasons: reasons.slice(0, 4),
    impactBps,
    highlights: ["chest"],
    flags: score < 55 ? ["low_heart_score"] : undefined,
  };
}

function calculateLungsScore(features: FeatureVector, context?: {
  recentInjuryBps?: number;
  recentNewsSentBps?: number;
  recentRaceBoostBps?: number;
}): BiometricSubsystem {
  // Lungs based on stamina, health, conformation (chest capacity)
  let baseScore = (features.stamina * 0.5 + features.health * 0.3 + features.conformation * 0.2);
  
  if (context?.recentInjuryBps) {
    baseScore *= (1 - context.recentInjuryBps / 15000);
  }
  
  const score = clamp(Math.round(baseScore), 0, 100);
  const label = labelFromScore(score);
  
  const reasons: string[] = [];
  if (features.stamina >= 75) reasons.push(`Stamina ${features.stamina}/100`);
  if (features.conformation >= 80) reasons.push(`Conformation ${features.conformation}/100`);
  if (features.injured) reasons.push("Respiratory impact from injury");
  if (context?.recentInjuryBps) reasons.push(`Injury impact: -${context.recentInjuryBps / 150}%`);
  if (reasons.length === 0) reasons.push(`Stamina ${features.stamina}/100, Conformation ${features.conformation}/100`);
  
  const impactBps = Math.round((score - 70) * 12); // -840 to +360 bps
  
  return {
    id: "lungs",
    score,
    label,
    confidence: 0.65 + (features.stamina > 50 ? 0.1 : 0),
    reasons: reasons.slice(0, 4),
    impactBps,
    highlights: ["ribcage"],
  };
}

function calculateSkeletalScore(features: FeatureVector, context?: {
  recentInjuryBps?: number;
  recentNewsSentBps?: number;
  recentRaceBoostBps?: number;
}): BiometricSubsystem {
  // Skeletal based on conformation, health, agility
  let baseScore = (features.conformation * 0.5 + features.health * 0.3 + features.agility * 0.2);
  
  if (features.injured) {
    baseScore *= 0.75; // Significant impact
  }
  
  if (context?.recentInjuryBps) {
    baseScore *= (1 - context.recentInjuryBps / 10000);
  }
  
  const score = clamp(Math.round(baseScore), 0, 100);
  const label = labelFromScore(score);
  
  const reasons: string[] = [];
  if (features.conformation >= 80) reasons.push(`Conformation ${features.conformation}/100`);
  if (features.health >= 85) reasons.push(`Health ${features.health}/100`);
  if (features.injured) reasons.push("Skeletal injury present");
  if (context?.recentInjuryBps) reasons.push(`Recent injury: -${context.recentInjuryBps / 100}%`);
  if (reasons.length === 0) reasons.push(`Conformation ${features.conformation}/100, Health ${features.health}/100`);
  
  const impactBps = Math.round((score - 70) * 20); // -1400 to +600 bps
  
  return {
    id: "skeletal",
    score,
    label,
    confidence: 0.7 + (features.conformation > 0 ? 0.1 : 0),
    reasons: reasons.slice(0, 4),
    impactBps,
    highlights: ["spine"],
    flags: score < 55 ? ["low_skeletal_score"] : undefined,
  };
}

function calculateMusculatureScore(features: FeatureVector, context?: {
  recentInjuryBps?: number;
  recentNewsSentBps?: number;
  recentRaceBoostBps?: number;
}): BiometricSubsystem {
  // Musculature based on speed, agility, stamina, health
  let baseScore = (features.speed * 0.3 + features.agility * 0.3 + features.stamina * 0.2 + features.health * 0.2);
  
  if (features.injured) {
    baseScore *= 0.8;
  }
  
  if (context?.recentRaceBoostBps) {
    baseScore *= (1 + context.recentRaceBoostBps / 20000); // Positive boost
  }
  
  const score = clamp(Math.round(baseScore), 0, 100);
  const label = labelFromScore(score);
  
  const reasons: string[] = [];
  if (features.speed >= 80) reasons.push(`Speed ${features.speed}/100`);
  if (features.agility >= 75) reasons.push(`Agility ${features.agility}/100`);
  if (features.injured) reasons.push("Muscle injury impact");
  if (context?.recentRaceBoostBps) reasons.push(`Recent race performance: +${context.recentRaceBoostBps / 200}%`);
  if (reasons.length === 0) reasons.push(`Speed ${features.speed}/100, Agility ${features.agility}/100`);
  
  const impactBps = Math.round((score - 70) * 18); // -1260 to +540 bps
  
  return {
    id: "musculature",
    score,
    label,
    confidence: 0.75 + (features.speed > 50 ? 0.05 : 0),
    reasons: reasons.slice(0, 4),
    impactBps,
    highlights: ["shoulder", "hindquarters"],
  };
}

function calculateJointsScore(features: FeatureVector, context?: {
  recentInjuryBps?: number;
  recentNewsSentBps?: number;
  recentRaceBoostBps?: number;
}): BiometricSubsystem {
  // Joints based on agility, health, consistency (wear patterns)
  let baseScore = (features.agility * 0.4 + features.health * 0.4 + features.consistency * 0.2);
  
  if (features.injured) {
    baseScore *= 0.7; // Strong impact
  }
  
  if (context?.recentInjuryBps) {
    baseScore *= (1 - context.recentInjuryBps / 8000);
  }
  
  const score = clamp(Math.round(baseScore), 0, 100);
  const label = labelFromScore(score);
  
  const reasons: string[] = [];
  if (features.agility >= 75) reasons.push(`Agility ${features.agility}/100`);
  if (features.health >= 80) reasons.push(`Health ${features.health}/100`);
  if (features.injured) reasons.push("Joint injury present");
  if (context?.recentInjuryBps) reasons.push(`Recent injury: -${context.recentInjuryBps / 80}%`);
  if (reasons.length === 0) reasons.push(`Agility ${features.agility}/100, Health ${features.health}/100`);
  
  const impactBps = Math.round((score - 70) * 25); // -1750 to +750 bps
  
  return {
    id: "joints",
    score,
    label,
    confidence: 0.68 + (features.agility > 0 ? 0.12 : 0),
    reasons: reasons.slice(0, 4),
    impactBps,
    highlights: ["fetlocks", "hocks", "knees"],
    flags: score < 55 ? ["low_joints_score"] : undefined,
  };
}

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
    calculateHeartScore(features, context),
    calculateLungsScore(features, context),
    calculateSkeletalScore(features, context),
    calculateMusculatureScore(features, context),
    calculateJointsScore(features, context),
  ];

  const overallScore = Math.round(
    subsystems.reduce((sum, s) => sum + s.score, 0) / subsystems.length
  );
  const overallLabel = labelFromScore(overallScore);
  const overallConfidence =
    subsystems.reduce((sum, s) => sum + s.confidence, 0) / subsystems.length;
  const totalImpactBps = subsystems.reduce((sum, s) => sum + s.impactBps, 0);
  const valuationMultiplierBps = clamp(totalImpactBps, -2000, 2000);

  const notes: string[] = [];
  if (features.injured) {
    notes.push("Horse currently injured - all subsystems affected");
  }
  if (features.xFactorCarrier) {
    notes.push("X-factor carrier detected - cardiac monitoring recommended");
  }
  const lowSubsystems = subsystems.filter((s) => s.score < 55);
  if (lowSubsystems.length > 0) {
    notes.push(
      `Low scores detected in: ${lowSubsystems.map((s) => s.id).join(", ")}`
    );
  }

  return {
    schemaVersion: "1.0",
    horseTokenId: tokenId,
    generatedAt: new Date().toISOString(),
    engineVersion: "biometric-v1",
    overall: {
      score: overallScore,
      label: overallLabel,
      confidence: overallConfidence,
      valuationMultiplierBps,
    },
    subsystems,
    notes: notes.length > 0 ? notes : undefined,
    source: {
      kind: context ? "ORACLE" : "SIMULATION",
      confidence: overallConfidence,
    },
  };
}
