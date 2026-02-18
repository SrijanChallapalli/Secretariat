/**
 * S-Agent scorer - used by frontend; stored in 0G bundle for verification.
 * Integrates https://github.com/Ayaan-Ameen07/S-Agent
 */
const W_TRAITS = 0.30, W_PEDIGREE = 0.35, W_COMPLEMENT = 0.20, W_COST = 0.10, W_FORM = 0.05;

function cosine(a: number[], b: number[]): number {
  let d = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    d += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return (Math.sqrt(na) * Math.sqrt(nb)) === 0 ? 0 : d / (Math.sqrt(na) * Math.sqrt(nb));
}

function complement(mareTraits: number[], stallionTraits: number[]): number {
  if (mareTraits.length !== stallionTraits.length) return 0;
  let sum = 0, count = 0;
  for (let i = 0; i < mareTraits.length; i++) {
    if (mareTraits[i] / 100 < 0.8) { sum += stallionTraits[i] / 100; count++; }
  }
  return count === 0 ? 0.5 : sum / count;
}

export function scoreStallions(
  mare: { traitVector: number[]; pedigreeScore: number },
  stallions: { traitVector: number[]; pedigreeScore: number; studFeeADI?: number }[],
  maxStudFee?: number
) {
  return stallions.map((s) => {
    const t = cosine(mare.traitVector, s.traitVector);
    const p = (mare.pedigreeScore / 10000 + s.pedigreeScore / 10000) / 2;
    const c = complement(mare.traitVector, s.traitVector);
    const fee = (s.studFeeADI ?? 0) / 1e18;
    const cost = maxStudFee ? Math.min(1, fee / maxStudFee) : 0;
    return {
      score: W_TRAITS * (t * 0.5 + 0.5) + W_PEDIGREE * p + W_COMPLEMENT * c - W_COST * cost + W_FORM * 0.05,
    };
  }).sort((a, b) => b.score - a.score).slice(0, 3);
}
