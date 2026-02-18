export interface PurseBreakdown {
  grossPurse: number;
  placing: number;
  placingSharePct: number;
  placingShare: number;
  jockeyFee: number;
  trainerFee: number;
  groomTip: number;
  totalDeductions: number;
  netToOwner: number;
  netYieldPct: number;
}

const PLACING_SHARES: Record<number, number> = {
  1: 0.60,
  2: 0.20,
  3: 0.10,
  4: 0.05,
  5: 0.03,
};

export function calculatePurseDistribution(grossPurse: number, placing: number): PurseBreakdown {
  const placingSharePct = PLACING_SHARES[placing] ?? 0.02;
  const placingShare = grossPurse * placingSharePct;

  // Jockey: 10% of placingShare if win (placing === 1), else flat $100
  const jockeyFee = placing === 1 ? placingShare * 0.10 : 100;

  // Trainer: 10% of placingShare always
  const trainerFee = placingShare * 0.10;

  // Groom: 1% of placingShare always
  const groomTip = placingShare * 0.01;

  const totalDeductions = jockeyFee + trainerFee + groomTip;
  const netToOwner = placingShare - totalDeductions;
  const netYieldPct = grossPurse > 0 ? (netToOwner / grossPurse) * 100 : 0;

  return {
    grossPurse,
    placing,
    placingSharePct,
    placingShare,
    jockeyFee,
    trainerFee,
    groomTip,
    totalDeductions,
    netToOwner,
    netYieldPct,
  };
}
