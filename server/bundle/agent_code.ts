/**
 * Breeding Advisor scorer - used by frontend; stored in 0G bundle for verification.
 */
const W_TRAITS = 0.35, W_PEDIGREE = 0.25, W_INBREEDING = 0.2, W_COST = 0.15, W_FORM = 0.05;
function cosine(a: number[], b: number[]) {
  let d = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { d += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return (Math.sqrt(na) * Math.sqrt(nb)) === 0 ? 0 : d / (Math.sqrt(na) * Math.sqrt(nb));
}
export function scoreStallions(mare: { traitVector: number[]; pedigreeScore: number }, stallions: { traitVector: number[]; pedigreeScore: number; studFeeADI?: number }[], maxStudFee?: number) {
  return stallions.map((s) => {
    const t = cosine(mare.traitVector, s.traitVector);
    const p = (mare.pedigreeScore / 10000 + s.pedigreeScore / 10000) / 2;
    const fee = (s.studFeeADI ?? 0) / 1e18;
    const cost = maxStudFee ? Math.min(1, fee / maxStudFee) : 0;
    return { score: W_TRAITS * (t * 0.5 + 0.5) + W_PEDIGREE * p - W_COST * cost + W_FORM * 0.05 };
  }).sort((a, b) => b.score - a.score).slice(0, 3);
}
