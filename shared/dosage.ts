export type DosageProfile = [number, number, number, number, number]; // [Brilliant, Intermediate, Classic, Solid, Professional]

// DI = (B + I + 0.5*C) / (0.5*C + S + P)
// If denominator is 0, return Infinity
export function calculateDosageIndex(dp: DosageProfile): number {
  const [B, I, C, S, P] = dp;
  const numerator = B + I + 0.5 * C;
  const denominator = 0.5 * C + S + P;
  if (denominator === 0) return Infinity;
  return numerator / denominator;
}

// CD = (2*B + 1*I - 1*S - 2*P) / (B + I + C + S + P)
// If sum is 0, return 0
export function calculateCD(dp: DosageProfile): number {
  const [B, I, C, S, P] = dp;
  const sum = B + I + C + S + P;
  if (sum === 0) return 0;
  return (2 * B + I - S - 2 * P) / sum;
}

// DI > 4.0 = "Sprinter", 2.5-4.0 = "Miler", 1.0-2.5 = "Classic", < 1.0 = "Stayer"
export function classifyDistance(di: number): "Sprinter" | "Miler" | "Classic" | "Stayer" {
  if (di > 4.0) return "Sprinter";
  if (di >= 2.5) return "Miler";
  if (di >= 1.0) return "Classic";
  return "Stayer";
}

// Returns false if DI > 4.0
export function isClassicContender(di: number): boolean {
  return di <= 4.0;
}

// Validation:
// Secretariat: [16, 12, 8, 4, 0] → DI = 4.00, CD = 1.20
// Stayer example: [0, 2, 8, 6, 4] → DI ≈ 0.46, CD = -0.80
