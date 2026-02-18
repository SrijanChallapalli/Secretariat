export interface Horse {
  id: number;
  name: string;
  tokenId: string;
  valuation: number;
  change24h: number;
  riskScore: number;
  totalWins: number;
  gradeWins: number;
  age: number;
  studFee: number;
  remainingUses: number;
  pedigreeScore: number;
  breedingDemand: number;
  injuryCount: number;
  sire: string;
  dam: string;
  foaled: string;
  silksColor: string;
  dnaHash: string;
  majorResult: string;
  stewardNote: string;
  traits: {
    speed: number;
    stamina: number;
    temperament: number;
    injuryRisk: number;
    pedigreeStrength: number;
  };
  valuationHistory: { date: string; value: number }[];
}

export interface OracleEvent {
  id: number;
  timestamp: string;
  horseId: number;
  horseName: string;
  type: "race" | "injury" | "news";
  description: string;
  impact: number;
  sourceHash: string;
}

export interface PortfolioHolding {
  horseId: number;
  horseName: string;
  shares: number;
  totalShares: number;
  currentValue: number;
  pnl: number;
  claimable: number;
}

export interface BreedingEvent {
  id: number;
  timestamp: string;
  type: string;
  description: string;
}

export interface RevenueEvent {
  id: number;
  timestamp: string;
  type: string;
  horseName: string;
  amount: number;
  description: string;
}

function generateHistory(base: number, days = 30): { date: string; value: number }[] {
  const history: { date: string; value: number }[] = [];
  let value = base * 0.75;
  for (let i = days; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    value += (Math.random() - 0.45) * (base * 0.02);
    value = Math.max(value, base * 0.5);
    history.push({ date: d.toISOString().split("T")[0], value: Math.round(value) });
  }
  return history;
}

export const horses: Horse[] = [
  {
    id: 1, name: "Thunder Reign", tokenId: "0x7a1...e3f", valuation: 3200000, change24h: 5.2,
    riskScore: 2, totalWins: 14, gradeWins: 6, age: 4, studFee: 25000, remainingUses: 6,
    pedigreeScore: 94, breedingDemand: 87, injuryCount: 1,
    sire: "Galileo", dam: "Windstorm", foaled: "2022, Kentucky", silksColor: "#1E40AF",
    dnaHash: "0x9f2a...7c1d", majorResult: "G1 Kentucky Derby — 1st", stewardNote: "Sound. Consistent performer on dirt surfaces.",
    traits: { speed: 92, stamina: 88, temperament: 75, injuryRisk: 15, pedigreeStrength: 94 },
    valuationHistory: generateHistory(3200000),
  },
  {
    id: 2, name: "Midnight Eclipse", tokenId: "0x3b2...d1a", valuation: 2800000, change24h: -2.1,
    riskScore: 3, totalWins: 11, gradeWins: 4, age: 5, studFee: 18000, remainingUses: 4,
    pedigreeScore: 89, breedingDemand: 72, injuryCount: 2,
    sire: "Dubawi", dam: "Lunar Shadow", foaled: "2021, Ireland", silksColor: "#4C1D95",
    dnaHash: "0x3e8b...a2f0", majorResult: "G2 Eclipse Stakes — 1st", stewardNote: "Under veterinary monitoring. Mild tendon concern.",
    traits: { speed: 85, stamina: 91, temperament: 82, injuryRisk: 25, pedigreeStrength: 89 },
    valuationHistory: generateHistory(2800000),
  },
  {
    id: 3, name: "Golden Sovereign", tokenId: "0x9c4...f7b", valuation: 4100000, change24h: 8.7,
    riskScore: 1, totalWins: 18, gradeWins: 9, age: 5, studFee: 35000, remainingUses: 3,
    pedigreeScore: 97, breedingDemand: 95, injuryCount: 0,
    sire: "Frankel", dam: "Gold Meridian", foaled: "2021, Newmarket", silksColor: "#B45309",
    dnaHash: "0x7d1c...e4b3", majorResult: "G1 Prix de l'Arc — 1st", stewardNote: "Exceptional specimen. No concerns on record.",
    traits: { speed: 95, stamina: 90, temperament: 88, injuryRisk: 8, pedigreeStrength: 97 },
    valuationHistory: generateHistory(4100000),
  },
  {
    id: 4, name: "Desert Storm", tokenId: "0x1d5...a2c", valuation: 1900000, change24h: -4.5,
    riskScore: 4, totalWins: 8, gradeWins: 2, age: 6, studFee: 12000, remainingUses: 7,
    pedigreeScore: 78, breedingDemand: 55, injuryCount: 3,
    sire: "War Front", dam: "Sahara Rose", foaled: "2020, Dubai", silksColor: "#92400E",
    dnaHash: "0x5a0f...b8d2", majorResult: "G2 Dubai Gold Cup — 2nd", stewardNote: "Ownership dispute pending. Legal hold on transfers.",
    traits: { speed: 80, stamina: 85, temperament: 60, injuryRisk: 40, pedigreeStrength: 78 },
    valuationHistory: generateHistory(1900000),
  },
  {
    id: 5, name: "Silver Arrow", tokenId: "0x5e6...b8d", valuation: 2500000, change24h: 1.3,
    riskScore: 2, totalWins: 12, gradeWins: 5, age: 4, studFee: 20000, remainingUses: 5,
    pedigreeScore: 91, breedingDemand: 80, injuryCount: 1,
    sire: "Tapit", dam: "Silver Lining", foaled: "2022, Lexington", silksColor: "#6B7280",
    dnaHash: "0x2c7e...f1a9", majorResult: "G1 Breeders' Cup Mile — 1st", stewardNote: "Cleared for all activity. Strong turf record.",
    traits: { speed: 90, stamina: 82, temperament: 85, injuryRisk: 18, pedigreeStrength: 91 },
    valuationHistory: generateHistory(2500000),
  },
  {
    id: 6, name: "Iron Phoenix", tokenId: "0x2f7...c9e", valuation: 1600000, change24h: -6.8,
    riskScore: 5, totalWins: 6, gradeWins: 1, age: 7, studFee: 8000, remainingUses: 10,
    pedigreeScore: 72, breedingDemand: 40, injuryCount: 4,
    sire: "Medaglia d'Oro", dam: "Phoenix Fire", foaled: "2019, Florida", silksColor: "#DC2626",
    dnaHash: "0x8b3d...c0e5", majorResult: "G3 Gulfstream Sprint — 1st", stewardNote: "Multiple injury history. Breeding-only recommendation.",
    traits: { speed: 75, stamina: 78, temperament: 55, injuryRisk: 55, pedigreeStrength: 72 },
    valuationHistory: generateHistory(1600000),
  },
  {
    id: 7, name: "Crystal Dawn", tokenId: "0x8a8...d0f", valuation: 2100000, change24h: 3.4,
    riskScore: 2, totalWins: 10, gradeWins: 3, age: 3, studFee: 15000, remainingUses: 8,
    pedigreeScore: 86, breedingDemand: 68, injuryCount: 0,
    sire: "Deep Impact", dam: "Morning Crystal", foaled: "2023, Japan", silksColor: "#0891B2",
    dnaHash: "0x4f6a...d7b8", majorResult: "G2 Tokyo Yushun Trial — 1st", stewardNote: "Rising prospect. Clean record.",
    traits: { speed: 88, stamina: 80, temperament: 90, injuryRisk: 10, pedigreeStrength: 86 },
    valuationHistory: generateHistory(2100000),
  },
  {
    id: 8, name: "Blazing Trail", tokenId: "0x4b9...e1a", valuation: 2700000, change24h: -1.2,
    riskScore: 3, totalWins: 13, gradeWins: 5, age: 5, studFee: 22000, remainingUses: 4,
    pedigreeScore: 90, breedingDemand: 76, injuryCount: 2,
    sire: "American Pharoah", dam: "Trail Blazer", foaled: "2021, California", silksColor: "#EA580C",
    dnaHash: "0x1e9c...a3f6", majorResult: "G1 Santa Anita Derby — 1st", stewardNote: "Recent trainer change. Monitor transition period.",
    traits: { speed: 93, stamina: 79, temperament: 70, injuryRisk: 30, pedigreeStrength: 90 },
    valuationHistory: generateHistory(2700000),
  },
  {
    id: 9, name: "Shadow Dancer", tokenId: "0x6c0...f2b", valuation: 1800000, change24h: 2.8,
    riskScore: 3, totalWins: 9, gradeWins: 3, age: 4, studFee: 14000, remainingUses: 6,
    pedigreeScore: 83, breedingDemand: 62, injuryCount: 1,
    sire: "Justify", dam: "Dark Waltz", foaled: "2022, Virginia", silksColor: "#374151",
    dnaHash: "0x6d2b...e8c1", majorResult: "Listed Stakes — 1st (stepping up)", stewardNote: "Steady progression. Good temperament for syndication.",
    traits: { speed: 84, stamina: 86, temperament: 78, injuryRisk: 22, pedigreeStrength: 83 },
    valuationHistory: generateHistory(1800000),
  },
  {
    id: 10, name: "Royal Fortune", tokenId: "0x0d1...a3c", valuation: 3500000, change24h: 4.1,
    riskScore: 1, totalWins: 16, gradeWins: 8, age: 4, studFee: 30000, remainingUses: 5,
    pedigreeScore: 96, breedingDemand: 92, injuryCount: 0,
    sire: "Galileo", dam: "Fortune's Crown", foaled: "2022, Coolmore", silksColor: "#7C3AED",
    dnaHash: "0x0a4f...b9d7", majorResult: "G1 Epsom Derby — 1st", stewardNote: "Elite class. Clean veterinary and ownership record.",
    traits: { speed: 91, stamina: 93, temperament: 86, injuryRisk: 8, pedigreeStrength: 96 },
    valuationHistory: generateHistory(3500000),
  },
  {
    id: 11, name: "Storm Chaser", tokenId: "0x7e2...b4d", valuation: 2200000, change24h: -3.6,
    riskScore: 4, totalWins: 7, gradeWins: 2, age: 6, studFee: 10000, remainingUses: 9,
    pedigreeScore: 76, breedingDemand: 48, injuryCount: 3,
    sire: "Into Mischief", dam: "Storm Warning", foaled: "2020, Saratoga", silksColor: "#475569",
    dnaHash: "0x3c8e...f2a4", majorResult: "G2 Saratoga Cup — 1st", stewardNote: "Recurring knee issue. Surgery scheduled for Q2.",
    traits: { speed: 82, stamina: 74, temperament: 58, injuryRisk: 45, pedigreeStrength: 76 },
    valuationHistory: generateHistory(2200000),
  },
  {
    id: 12, name: "Noble Spirit", tokenId: "0x3f3...c5e", valuation: 2000000, change24h: 0.5,
    riskScore: 2, totalWins: 11, gradeWins: 4, age: 3, studFee: 16000, remainingUses: 7,
    pedigreeScore: 88, breedingDemand: 70, injuryCount: 0,
    sire: "Curlin", dam: "Noble Grace", foaled: "2023, Bluegrass", silksColor: "#065F46",
    dnaHash: "0x7b1d...c5e0", majorResult: "G2 Blue Grass Stakes — 1st", stewardNote: "Young prospect with strong upside. Clean throughout.",
    traits: { speed: 86, stamina: 84, temperament: 92, injuryRisk: 12, pedigreeStrength: 88 },
    valuationHistory: generateHistory(2000000),
  },
];

export const oracleEvents: OracleEvent[] = [
  { id: 1, timestamp: "2026-02-18T14:32:00Z", horseId: 3, horseName: "Golden Sovereign", type: "race", description: "Won G1 Stakes at Santa Anita — 1st place", impact: 8.7, sourceHash: "0xabc...123" },
  { id: 2, timestamp: "2026-02-18T13:15:00Z", horseId: 6, horseName: "Iron Phoenix", type: "injury", description: "Minor tendon strain — 3 week recovery", impact: -6.8, sourceHash: "0xdef...456" },
  { id: 3, timestamp: "2026-02-18T11:45:00Z", horseId: 1, horseName: "Thunder Reign", type: "race", description: "2nd place finish at G2 Handicap", impact: 2.1, sourceHash: "0xghi...789" },
  { id: 4, timestamp: "2026-02-18T10:20:00Z", horseId: 4, horseName: "Desert Storm", type: "news", description: "Ownership dispute — legal proceedings", impact: -4.5, sourceHash: "0xjkl...012" },
  { id: 5, timestamp: "2026-02-18T09:00:00Z", horseId: 10, horseName: "Royal Fortune", type: "race", description: "Won G1 Derby Trial — impressive time", impact: 4.1, sourceHash: "0xmno...345" },
  { id: 6, timestamp: "2026-02-17T16:30:00Z", horseId: 7, horseName: "Crystal Dawn", type: "news", description: "Featured in Bloodhorse as rising star", impact: 3.4, sourceHash: "0xpqr...678" },
  { id: 7, timestamp: "2026-02-17T14:00:00Z", horseId: 11, horseName: "Storm Chaser", type: "injury", description: "Recurring knee issue — surgery scheduled", impact: -3.6, sourceHash: "0xstu...901" },
  { id: 8, timestamp: "2026-02-17T11:30:00Z", horseId: 5, horseName: "Silver Arrow", type: "race", description: "3rd at G2 Mile — consistent performer", impact: 1.3, sourceHash: "0xvwx...234" },
  { id: 9, timestamp: "2026-02-17T09:15:00Z", horseId: 8, horseName: "Blazing Trail", type: "news", description: "Trainer change announced — market uncertainty", impact: -1.2, sourceHash: "0xyza...567" },
  { id: 10, timestamp: "2026-02-16T15:45:00Z", horseId: 9, horseName: "Shadow Dancer", type: "race", description: "Won Listed Stakes — step up in class", impact: 2.8, sourceHash: "0xbcd...890" },
];

export const portfolioHoldings: PortfolioHolding[] = [
  { horseId: 1, horseName: "Thunder Reign", shares: 150, totalShares: 10000, currentValue: 48000, pnl: 12.5, claimable: 2400 },
  { horseId: 3, horseName: "Golden Sovereign", shares: 200, totalShares: 10000, currentValue: 82000, pnl: 28.3, claimable: 5100 },
  { horseId: 5, horseName: "Silver Arrow", shares: 100, totalShares: 10000, currentValue: 25000, pnl: 5.8, claimable: 800 },
  { horseId: 10, horseName: "Royal Fortune", shares: 75, totalShares: 10000, currentValue: 26250, pnl: 15.2, claimable: 1800 },
];

export const breedingActivity: BreedingEvent[] = [
  { id: 1, timestamp: "2026-02-18T13:00:00Z", type: "right_purchased", description: "Breeding right purchased for Thunder Reign" },
  { id: 2, timestamp: "2026-02-18T10:30:00Z", type: "offspring_minted", description: "Offspring minted: Sovereign's Pride" },
  { id: 3, timestamp: "2026-02-17T15:00:00Z", type: "right_purchased", description: "Breeding right purchased for Royal Fortune" },
];

export const revenueEvents: RevenueEvent[] = [
  { id: 1, timestamp: "2026-02-18T12:00:00Z", type: "deposit", horseName: "Golden Sovereign", amount: 15000, description: "Race purse deposited" },
  { id: 2, timestamp: "2026-02-17T16:00:00Z", type: "claim", horseName: "Thunder Reign", amount: 2400, description: "Revenue claimed by 0x1a2...3b4" },
];
