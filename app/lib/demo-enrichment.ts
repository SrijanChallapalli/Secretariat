/**
 * Curated demo data for seeded horses. Applied in on-chain-mapping when
 * NEXT_PUBLIC_DEMO_HEATMAP=true or chain is local (31337).
 */

import type {
  ValuationPoint,
  OracleEvent,
  BreedingPick,
  ValuationDriver,
} from "@/data/mockHorses";
import { NEWBORN_THRESHOLD_MS } from "../../shared/constants";

export interface DemoProfile {
  changePct: number;
  totalWins: number;
  gradeWins: number;
  injuries: number;
  soundness: number;
  grade: string;
  majorResult: string;
  stewardNote: string;
  lastResult: string;
  sireLabel: string;
  damLabel: string;
  dnaHash: string;
  valuationDrivers: ValuationDriver[];
  oracleEvents: OracleEvent[];
  breedingPicks: BreedingPick[];
}

export function isDemoMode(): boolean {
  return (
    process.env.NEXT_PUBLIC_DEMO_HEATMAP === "true" ||
    process.env.NEXT_PUBLIC_CHAIN_ID === "31337"
  );
}

function generateValuationHistory(
  currentValue: number,
  changePctAnnual: number,
  months = 12,
): ValuationPoint[] {
  const startValue = currentValue / (1 + changePctAnnual / 100);
  const points: ValuationPoint[] = [];

  for (let i = 0; i < months; i++) {
    const d = new Date(2026, 1 - (months - 1 - i), 1);
    const t = months > 1 ? i / (months - 1) : 1;
    const base = startValue + (currentValue - startValue) * t;
    const noise = base * 0.03 * Math.sin(i * 2.3 + currentValue * 0.001);
    points.push({
      date: d.toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
      value: Math.round(base + noise),
    });
  }
  return points;
}

const PROFILES: Record<string, DemoProfile> = {
  "Galileos Edge": {
    changePct: 8.4,
    totalWins: 12,
    gradeWins: 7,
    injuries: 1,
    soundness: 4,
    grade: "G1",
    majorResult: "1st — G1 Dubai World Cup 2025",
    stewardNote: "Clean record. Elite pedigree confirmed via 0G oracle.",
    lastResult: "1st — G2 Jebel Hatta (Feb 2026)",
    sireLabel: "Galileo (IRE)",
    damLabel: "Midnight Queen",
    dnaHash: "0x7a3f9b2c1d4e8f0a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f",
    valuationDrivers: [
      { name: "Race Record (12W / 18R)", impactPct: 14.2 },
      { name: "Pedigree Score (94)", impactPct: 8.6 },
      { name: "Breeding Demand", impactPct: 5.1 },
      { name: "Soundness Rating", impactPct: -2.3 },
      { name: "Age Factor", impactPct: -1.8 },
    ],
    oracleEvents: [
      { id: "ge-1", description: "Won G1 Dubai World Cup — $12M purse", source: "0G Racing Oracle", changePct: 12.4, date: "2025-03-29", icon: "trophy" },
      { id: "ge-2", description: "Won G2 Jebel Hatta — dominant 4L margin", source: "0G Racing Oracle", changePct: 5.2, date: "2026-02-07", icon: "trophy" },
      { id: "ge-3", description: "Annual soundness review passed", source: "0G Vet Oracle", changePct: 1.1, date: "2025-12-15", icon: "document" },
      { id: "ge-4", description: "Breeding rights listed — 500 ADI stud fee", source: "Marketplace", changePct: 3.8, date: "2025-11-01", icon: "document" },
      { id: "ge-5", description: "Minor shin splint — 3 week recovery", source: "0G Vet Oracle", changePct: -4.5, date: "2025-06-20", icon: "warning" },
    ],
    breedingPicks: [
      { rank: 1, name: "Storm Cat Lady", match: 94, edge: 8.2, delta: 12, confidence: "High" },
      { rank: 2, name: "Golden Dawn", match: 88, edge: 6.1, delta: 9, confidence: "High" },
      { rank: 3, name: "Ocean Breeze", match: 82, edge: 4.5, delta: 7, confidence: "Medium" },
    ],
  },

  "Storm Cat Lady": {
    changePct: 3.2,
    totalWins: 8,
    gradeWins: 4,
    injuries: 0,
    soundness: 5,
    grade: "G1",
    majorResult: "2nd — G1 Breeders' Cup Filly & Mare Turf",
    stewardNote: "No incidents. Dam of 3 winners.",
    lastResult: "3rd — G2 Cape Verdi (Jan 2026)",
    sireLabel: "Storm Cat (USA)",
    damLabel: "Royal Duchess",
    dnaHash: "0x4c8e2f1a9d3b7c6e5f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d",
    valuationDrivers: [
      { name: "Race Record (8W / 14R)", impactPct: 9.4 },
      { name: "Broodmare Value", impactPct: 7.2 },
      { name: "Pedigree Score (86)", impactPct: 5.8 },
      { name: "Offspring Performance", impactPct: 4.1 },
      { name: "Age (Peak Broodmare)", impactPct: 2.3 },
    ],
    oracleEvents: [
      { id: "sc-1", description: "2nd at G1 BC Filly & Mare Turf", source: "0G Racing Oracle", changePct: 6.8, date: "2025-11-01", icon: "trophy" },
      { id: "sc-2", description: "3rd at G2 Cape Verdi — solid return", source: "0G Racing Oracle", changePct: 2.1, date: "2026-01-16", icon: "trophy" },
      { id: "sc-3", description: "Foal by Galileos Edge — strong prospect", source: "0G Breeding Oracle", changePct: 4.5, date: "2025-09-10", icon: "document" },
      { id: "sc-4", description: "Clean vet clearance — no issues", source: "0G Vet Oracle", changePct: 0.8, date: "2025-12-20", icon: "document" },
    ],
    breedingPicks: [
      { rank: 1, name: "Galileos Edge", match: 94, edge: 8.2, delta: 12, confidence: "High" },
      { rank: 2, name: "Thunder Strike", match: 91, edge: 7.0, delta: 10, confidence: "High" },
      { rank: 3, name: "Silver Bullet", match: 85, edge: 5.3, delta: 8, confidence: "Medium" },
    ],
  },

  "First Mission Colt": {
    changePct: -1.5,
    totalWins: 4,
    gradeWins: 1,
    injuries: 2,
    soundness: 3,
    grade: "G3",
    majorResult: "1st — G3 UAE 2000 Guineas",
    stewardNote: "Knee scope 2025. Cleared for full training.",
    lastResult: "5th — G2 Al Maktoum Challenge R2 (Jan 2026)",
    sireLabel: "First Mission (USA)",
    damLabel: "Celtic Dawn",
    dnaHash: "0x2b9a8c7d6e5f4a3b2c1d0e9f8a7b6c5d4e3f2a1b0c9d8e7f6a5b4c3d2e1f0a",
    valuationDrivers: [
      { name: "Race Record (4W / 12R)", impactPct: 3.2 },
      { name: "Pedigree Score (82)", impactPct: 4.1 },
      { name: "Injury History", impactPct: -8.4 },
      { name: "Recovery Trajectory", impactPct: 2.6 },
      { name: "Value Play Upside", impactPct: 5.5 },
    ],
    oracleEvents: [
      { id: "fm-1", description: "Won G3 UAE 2000 Guineas — career best", source: "0G Racing Oracle", changePct: 8.2, date: "2025-02-15", icon: "trophy" },
      { id: "fm-2", description: "5th at G2 Al Maktoum Challenge R2", source: "0G Racing Oracle", changePct: -3.1, date: "2026-01-25", icon: "trophy" },
      { id: "fm-3", description: "Knee arthroscopy — successful", source: "0G Vet Oracle", changePct: -6.8, date: "2025-07-12", icon: "warning" },
      { id: "fm-4", description: "Cleared for full training post-surgery", source: "0G Vet Oracle", changePct: 3.2, date: "2025-10-01", icon: "document" },
      { id: "fm-5", description: "Listed for breeding at 300 ADI", source: "Marketplace", changePct: 1.5, date: "2025-11-15", icon: "document" },
    ],
    breedingPicks: [
      { rank: 1, name: "Golden Dawn", match: 86, edge: 5.8, delta: 8, confidence: "High" },
      { rank: 2, name: "Ocean Breeze", match: 80, edge: 4.2, delta: 6, confidence: "Medium" },
    ],
  },

  "Thunder Strike": {
    changePct: 11.2,
    totalWins: 10,
    gradeWins: 6,
    injuries: 0,
    soundness: 5,
    grade: "G1",
    majorResult: "1st — G1 Saudi Cup 2025",
    stewardNote: "Exceptional acceleration. Under observation for X-Factor.",
    lastResult: "2nd — G1 Pegasus World Cup (Jan 2026)",
    sireLabel: "Frankel (GB)",
    damLabel: "Stormy Skies",
    dnaHash: "0x9e1f0a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e",
    valuationDrivers: [
      { name: "Race Record (10W / 15R)", impactPct: 16.8 },
      { name: "G1 Saudi Cup Winner", impactPct: 9.4 },
      { name: "Pedigree Score (91)", impactPct: 7.2 },
      { name: "Clean Soundness", impactPct: 3.5 },
      { name: "Rising Demand", impactPct: 4.1 },
    ],
    oracleEvents: [
      { id: "ts-1", description: "Won G1 Saudi Cup — $20M purse", source: "0G Racing Oracle", changePct: 18.6, date: "2025-02-22", icon: "trophy" },
      { id: "ts-2", description: "2nd at G1 Pegasus World Cup — narrow loss", source: "0G Racing Oracle", changePct: 3.4, date: "2026-01-25", icon: "trophy" },
      { id: "ts-3", description: "Won G2 Maktoum Challenge R3", source: "0G Racing Oracle", changePct: 5.1, date: "2025-12-06", icon: "trophy" },
      { id: "ts-4", description: "Soundness 5/5 — perfect vet clearance", source: "0G Vet Oracle", changePct: 1.2, date: "2025-11-20", icon: "document" },
      { id: "ts-5", description: "X-Factor carrier flag — pending DNA confirmation", source: "0G Genomics Oracle", changePct: 6.2, date: "2025-08-15", icon: "document" },
    ],
    breedingPicks: [
      { rank: 1, name: "Storm Cat Lady", match: 91, edge: 7.0, delta: 10, confidence: "High" },
      { rank: 2, name: "Golden Dawn", match: 87, edge: 5.9, delta: 8, confidence: "High" },
      { rank: 3, name: "Ocean Breeze", match: 83, edge: 4.8, delta: 7, confidence: "Medium" },
    ],
  },

  "Midnight Runner": {
    changePct: 5.7,
    totalWins: 14,
    gradeWins: 5,
    injuries: 1,
    soundness: 4,
    grade: "G1",
    majorResult: "1st — G1 Meydan Gold Cup",
    stewardNote: "Minor hock soreness 2024, fully resolved.",
    lastResult: "1st — G3 Firebreak Stakes (Jan 2026)",
    sireLabel: "Dubawi (IRE)",
    damLabel: "Moonlight Sonata",
    dnaHash: "0x5d4e3f2a1b0c9d8e7f6a5b4c3d2e1f0a9b8c7d6e5f4a3b2c1d0e9f8a7b6c5d",
    valuationDrivers: [
      { name: "Race Record (14W / 22R)", impactPct: 12.1 },
      { name: "Consistency (64% ITM)", impactPct: 6.8 },
      { name: "Pedigree Score (88)", impactPct: 5.4 },
      { name: "Stamina Rating (90)", impactPct: 3.9 },
      { name: "Prior Injury", impactPct: -2.8 },
    ],
    oracleEvents: [
      { id: "mr-1", description: "Won G1 Meydan Gold Cup — career highlight", source: "0G Racing Oracle", changePct: 10.2, date: "2025-03-08", icon: "trophy" },
      { id: "mr-2", description: "Won G3 Firebreak Stakes — strong return", source: "0G Racing Oracle", changePct: 4.6, date: "2026-01-09", icon: "trophy" },
      { id: "mr-3", description: "Hock soreness detected — 6 week layoff", source: "0G Vet Oracle", changePct: -5.4, date: "2024-11-15", icon: "warning" },
      { id: "mr-4", description: "Full clearance post-recovery", source: "0G Vet Oracle", changePct: 2.8, date: "2025-01-10", icon: "document" },
      { id: "mr-5", description: "Stud book entry updated — 3 registered foals", source: "0G Breeding Oracle", changePct: 3.1, date: "2025-10-05", icon: "document" },
    ],
    breedingPicks: [
      { rank: 1, name: "Storm Cat Lady", match: 89, edge: 6.4, delta: 9, confidence: "High" },
      { rank: 2, name: "Ocean Breeze", match: 84, edge: 5.1, delta: 7, confidence: "High" },
      { rank: 3, name: "Golden Dawn", match: 79, edge: 3.8, delta: 5, confidence: "Medium" },
    ],
  },

  "Golden Dawn": {
    changePct: 2.1,
    totalWins: 6,
    gradeWins: 2,
    injuries: 0,
    soundness: 5,
    grade: "G2",
    majorResult: "1st — G2 Balanchine Stakes",
    stewardNote: "Clean bill of health. Strong broodmare prospect.",
    lastResult: "2nd — G3 UAE Oaks (Feb 2026)",
    sireLabel: "Medaglia d'Oro (USA)",
    damLabel: "Autumn Gold",
    dnaHash: "0x8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b7c6d5e4f3a2b1c0d9e8f",
    valuationDrivers: [
      { name: "Race Record (6W / 10R)", impactPct: 6.5 },
      { name: "Broodmare Potential", impactPct: 8.8 },
      { name: "Pedigree Score (85)", impactPct: 5.2 },
      { name: "Clean Soundness", impactPct: 3.4 },
      { name: "Age (Ideal Breeding)", impactPct: 2.9 },
    ],
    oracleEvents: [
      { id: "gd-1", description: "Won G2 Balanchine Stakes — first Graded win", source: "0G Racing Oracle", changePct: 7.8, date: "2025-03-01", icon: "trophy" },
      { id: "gd-2", description: "2nd at G3 UAE Oaks — strong effort", source: "0G Racing Oracle", changePct: 2.4, date: "2026-02-13", icon: "trophy" },
      { id: "gd-3", description: "Broodmare evaluation — scored 92/100", source: "0G Breeding Oracle", changePct: 4.1, date: "2025-10-20", icon: "document" },
      { id: "gd-4", description: "Soundness review — perfect 5/5", source: "0G Vet Oracle", changePct: 0.9, date: "2025-12-05", icon: "document" },
    ],
    breedingPicks: [
      { rank: 1, name: "Galileos Edge", match: 88, edge: 6.1, delta: 9, confidence: "High" },
      { rank: 2, name: "Thunder Strike", match: 87, edge: 5.9, delta: 8, confidence: "High" },
      { rank: 3, name: "Midnight Runner", match: 79, edge: 3.8, delta: 5, confidence: "Medium" },
    ],
  },

  "Silver Bullet": {
    changePct: 6.3,
    totalWins: 9,
    gradeWins: 4,
    injuries: 1,
    soundness: 4,
    grade: "G1",
    majorResult: "1st — G1 Al Quoz Sprint",
    stewardNote: "Soft tissue repair 2024. Fully cleared.",
    lastResult: "1st — G2 Meydan Sprint (Feb 2026)",
    sireLabel: "Speightstown (USA)",
    damLabel: "Silver Lining",
    dnaHash: "0x3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b7c6d5e4f3a",
    valuationDrivers: [
      { name: "Race Record (9W / 16R)", impactPct: 10.8 },
      { name: "Sprint Specialist", impactPct: 7.4 },
      { name: "Pedigree Score (87)", impactPct: 5.6 },
      { name: "Recovery From Injury", impactPct: -3.2 },
      { name: "Breeding Upside", impactPct: 4.5 },
    ],
    oracleEvents: [
      { id: "sb-1", description: "Won G1 Al Quoz Sprint — 1200m specialist", source: "0G Racing Oracle", changePct: 11.5, date: "2025-03-29", icon: "trophy" },
      { id: "sb-2", description: "Won G2 Meydan Sprint — back to best", source: "0G Racing Oracle", changePct: 5.8, date: "2026-02-06", icon: "trophy" },
      { id: "sb-3", description: "Soft tissue repair — successful surgery", source: "0G Vet Oracle", changePct: -7.2, date: "2024-08-20", icon: "warning" },
      { id: "sb-4", description: "Returned to training — full clearance", source: "0G Vet Oracle", changePct: 4.1, date: "2025-02-15", icon: "document" },
      { id: "sb-5", description: "Speed gene confirmed via 0G Genomics", source: "0G Genomics Oracle", changePct: 3.6, date: "2025-09-10", icon: "document" },
    ],
    breedingPicks: [
      { rank: 1, name: "Storm Cat Lady", match: 85, edge: 5.3, delta: 8, confidence: "High" },
      { rank: 2, name: "Golden Dawn", match: 81, edge: 4.6, delta: 6, confidence: "Medium" },
      { rank: 3, name: "Ocean Breeze", match: 78, edge: 3.9, delta: 5, confidence: "Medium" },
    ],
  },

  "Ocean Breeze": {
    changePct: -0.8,
    totalWins: 3,
    gradeWins: 1,
    injuries: 0,
    soundness: 5,
    grade: "G3",
    majorResult: "1st — G3 UAE 1000 Guineas",
    stewardNote: "Maiden season. High potential flagged by AI advisor.",
    lastResult: "4th — Listed Meydan Classic (Feb 2026)",
    sireLabel: "Sea The Stars (IRE)",
    damLabel: "Coral Reef",
    dnaHash: "0x6e5f4a3b2c1d0e9f8a7b6c5d4e3f2a1b0c9d8e7f6a5b4c3d2e1f0a9b8c7d6e",
    valuationDrivers: [
      { name: "Race Record (3W / 7R)", impactPct: 2.8 },
      { name: "Pedigree Score (83)", impactPct: 4.6 },
      { name: "Clean Soundness", impactPct: 3.8 },
      { name: "Young Prospect Premium", impactPct: 6.2 },
      { name: "Unproven at G1 Level", impactPct: -5.4 },
    ],
    oracleEvents: [
      { id: "ob-1", description: "Won G3 UAE 1000 Guineas — impressive debut stakes win", source: "0G Racing Oracle", changePct: 9.4, date: "2025-02-08", icon: "trophy" },
      { id: "ob-2", description: "4th at Listed Meydan Classic — gaining experience", source: "0G Racing Oracle", changePct: -1.2, date: "2026-02-14", icon: "trophy" },
      { id: "ob-3", description: "AI Advisor flags high breeding potential", source: "Secretariat AI", changePct: 3.5, date: "2025-11-08", icon: "document" },
      { id: "ob-4", description: "Soundness review — perfect clearance", source: "0G Vet Oracle", changePct: 0.6, date: "2025-12-18", icon: "document" },
    ],
    breedingPicks: [
      { rank: 1, name: "Galileos Edge", match: 82, edge: 4.5, delta: 7, confidence: "High" },
      { rank: 2, name: "Thunder Strike", match: 83, edge: 4.8, delta: 7, confidence: "Medium" },
      { rank: 3, name: "First Mission Colt", match: 80, edge: 4.2, delta: 6, confidence: "Medium" },
    ],
  },
};

function ageInMs(birthTimestamp: bigint): number {
  if (birthTimestamp <= 0n) return Infinity;
  return Date.now() - Number(birthTimestamp) * 1000;
}

function newbornProfile(tokenId: number, name: string): DemoProfile {
  const seed = tokenId * 7 + name.length * 13;
  return {
    changePct: 0,
    totalWins: 0,
    gradeWins: 0,
    injuries: 0,
    soundness: 3,
    grade: "—",
    majorResult: "N/A — foal",
    stewardNote: "Newborn. Awaiting first evaluation.",
    lastResult: "Awaiting debut",
    sireLabel: "Founder",
    damLabel: "Founder",
    dnaHash: `0x${Array.from({ length: 64 }, (_, i) => ((seed * 3 + i * 7) % 16).toString(16)).join("")}`,
    valuationDrivers: [
      { name: "Pedigree Potential", impactPct: 5 + (seed % 4) },
      { name: "Trait Outlook", impactPct: 3 + (seed % 3) },
      { name: "Unraced Discount", impactPct: -(2 + (seed % 3)) },
    ],
    oracleEvents: [],
    breedingPicks: [],
  };
}

function fallbackProfile(tokenId: number, name: string): DemoProfile {
  const seed = tokenId * 7 + name.length * 13;
  const wins = 2 + (seed % 10);
  const gWins = Math.min(wins, 1 + (seed % 4));
  const inj = seed % 5 === 0 ? 1 : 0;
  return {
    changePct: ((seed % 21) - 10) * 0.8,
    totalWins: wins,
    gradeWins: gWins,
    injuries: inj,
    soundness: inj > 0 ? 3 : 4,
    grade: gWins >= 3 ? "G1" : gWins >= 1 ? "G2" : "—",
    majorResult: gWins >= 1 ? `1st — G${4 - Math.min(gWins, 3)} Allowance Stakes` : "Maiden winner",
    stewardNote: inj > 0 ? "Prior injury noted. Under monitoring." : "No incidents on record.",
    lastResult: `${1 + (seed % 5)}th — Meydan Handicap (Jan 2026)`,
    sireLabel: "Founder",
    damLabel: "Founder",
    dnaHash: `0x${Array.from({ length: 64 }, (_, i) => ((seed * 3 + i * 7) % 16).toString(16)).join("")}`,
    valuationDrivers: [
      { name: `Race Record (${wins}W)`, impactPct: 2 + (seed % 8) },
      { name: "Pedigree", impactPct: 3 + (seed % 5) },
      { name: "Soundness", impactPct: inj > 0 ? -4 : 2 },
    ],
    oracleEvents: [
      { id: `fb-${tokenId}-1`, description: "Maiden win recorded", source: "0G Racing Oracle", changePct: 4.2, date: "2025-06-15", icon: "trophy" as const },
      { id: `fb-${tokenId}-2`, description: "Vet clearance", source: "0G Vet Oracle", changePct: 0.8, date: "2025-12-01", icon: "document" as const },
    ],
    breedingPicks: [],
  };
}

export interface DemoEnrichment {
  changePct: number;
  soundness: number;
  majorResult: string;
  stewardNote: string;
  lastResult: string;
  sireLabel: string;
  damLabel: string;
  dnaHash: string;
  totalWins: number;
  gradeWins: number;
  injuries: number;
  grade: string;
  valuationOverTime: ValuationPoint[];
  oracleEvents: OracleEvent[];
  valuationDrivers: ValuationDriver[];
  breedingPicks: BreedingPick[];
}

export function getDemoEnrichment(
  tokenId: number,
  name: string,
  currentValuation: number,
  birthTimestamp: bigint = 0n,
): DemoEnrichment {
  const isNewborn =
    !(name in PROFILES) && ageInMs(birthTimestamp) < NEWBORN_THRESHOLD_MS;

  const profile = isNewborn
    ? newbornProfile(tokenId, name)
    : (PROFILES[name] ?? fallbackProfile(tokenId, name));

  const months = isNewborn
    ? Math.max(1, Math.ceil(ageInMs(birthTimestamp) / (30.44 * 24 * 60 * 60 * 1000)))
    : 12;

  return {
    ...profile,
    valuationOverTime: generateValuationHistory(
      currentValuation,
      profile.changePct * 3,
      months,
    ),
  };
}
