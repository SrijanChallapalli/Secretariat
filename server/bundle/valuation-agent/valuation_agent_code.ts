/**
 * Horse Valuation Agent - 0G bundle code (verification).
 * Same formulas as app/lib/horse-valuation-agent.ts.
 * Racing value = (totalEarnings*2) + (winRate*100000) + (speed*1000)
 * Breeding value = (pedigreeScore*2000) + offspringWins*5000; male 1.2x
 * Events: RACE_WIN (+25% G1), INJURY (severity 0-10), etc.
 */

export interface HorseData {
  age?: number;
  sex?: string;
  status?: string;
  speed?: number;
  stamina?: number;
  health?: number;
  pedigreeScore?: number;
  wins?: number;
  totalRaces?: number;
  totalEarnings?: number;
  offspringWins?: number;
}

export interface MarketData {
  averageHorseValue?: number;
  bullish?: boolean;
}

function ageMod(age: number | undefined, status: string | undefined): number {
  if (age == null) return 1.0;
  if (status === "deceased") return 1.0;
  if (age < 2) return 0.6;
  if (age === 2) return 0.9;
  if (age >= 3 && age <= 6) return 1.2;
  if (age === 7) return 1.0;
  if (age === 8) return 0.8;
  if (age === 9) return 0.6;
  return 0.5;
}

function healthMod(health: number | undefined): number {
  const h = health == null ? 80 : Math.max(0, Math.min(100, health));
  return 0.5 + 0.5 * (h / 100);
}

function statusMod(status: string | undefined): number {
  if (status === "retired") return 0.9;
  if (status === "deceased") return 0.7;
  return 1.0;
}

export function calculateValue(horse: HorseData, market: MarketData = {}): number {
  const winRate =
    horse.totalRaces && horse.totalRaces > 0 ? (horse.wins ?? 0) / horse.totalRaces : 0;
  const racing =
    (horse.totalEarnings ?? 0) * 2 + winRate * 100000 + (horse.speed ?? 0) * 1000;
  let breeding = (horse.pedigreeScore ?? 0) * 2000 + (horse.offspringWins ?? 0) * 5000;
  if (horse.sex === "male") breeding *= 1.2;

  const status = horse.status ?? "active";
  let base: number;
  if (status === "active") {
    base =
      (racing + breeding) *
      ageMod(horse.age, status) *
      healthMod(horse.health) *
      statusMod(status);
  } else if (status === "retired") {
    base =
      breeding *
      ageMod(horse.age, status) *
      healthMod(horse.health) *
      statusMod(status);
  } else if (status === "deceased") {
    base = breeding * 0.2 * statusMod(status);
  } else {
    base =
      (racing + breeding) *
      ageMod(horse.age, status) *
      healthMod(horse.health);
  }

  let marketMod = 1.0;
  if (market.bullish) marketMod += 0.1;
  if (market.averageHorseValue && market.averageHorseValue > 0 && base) {
    const rel = base / market.averageHorseValue;
    if (rel > 5) marketMod *= 1.05;
    else if (rel < 0.5) marketMod *= 0.95;
  }
  return base * marketMod;
}

export function adjustForEvent(
  horse: HorseData,
  eventType: string,
  eventData: Record<string, unknown>,
  market: MarketData = {}
): number {
  const h = { ...horse };
  let mult = 1.0;
  switch (eventType) {
    case "RACE_WIN": {
      const grade = (eventData.raceGrade as string) ?? "ungraded";
      h.wins = (h.wins ?? 0) + 1;
      h.totalRaces = (h.totalRaces ?? 0) + 1;
      h.totalEarnings = (h.totalEarnings ?? 0) + ((eventData.purse as number) ?? 0);
      if (grade === "Grade 1") {
        mult = 1.25;
        h.pedigreeScore = (h.pedigreeScore ?? 0) + 2;
      } else if (grade === "Grade 2") {
        mult = 1.15;
        h.pedigreeScore = (h.pedigreeScore ?? 0) + 1;
      } else {
        mult = 1.05;
      }
      break;
    }
    case "RACE_LOSS":
      h.totalRaces = (h.totalRaces ?? 0) + 1;
      h.totalEarnings = (h.totalEarnings ?? 0) + ((eventData.purse as number) ?? 0);
      mult = eventData.placement === 2 ? 0.98 : eventData.placement === 3 ? 0.96 : 0.95;
      break;
    case "INJURY": {
      const sev = Math.max(0, Math.min(10, (eventData.severity as number) ?? 5));
      h.health = Math.max(0, (h.health ?? 100) - sev * 5);
      mult = Math.max(1 - sev * 0.05, 0.2);
      break;
    }
    case "RETIREMENT":
      h.status = "retired";
      break;
    case "OFFSPRING_WIN":
      h.offspringWins = (h.offspringWins ?? 0) + 1;
      mult = 1.1;
      break;
    case "DEATH":
      h.status = "deceased";
      h.health = 0;
      break;
    default:
      break;
  }
  return calculateValue(h, market) * mult;
}
