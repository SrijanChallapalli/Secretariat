export function calculateScarcityPremium(
  deadParent: { pedigreeScore: number; sex: "male" | "female"; offspringCount: number },
): number {
  const sexFactor = deadParent.sex === "male" ? 0.5 : 0.3;
  const scarcity = 1 / Math.max(deadParent.offspringCount, 1);
  const premium = 1 + (deadParent.pedigreeScore / 10000) * scarcity * sexFactor;
  return Math.min(premium, 2.0);
}
