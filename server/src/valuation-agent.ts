/**
 * Horse Valuation Agent - server-side (used by /valuation/calculate).
 * Matches app/lib/horse-valuation-agent.ts and server/bundle/valuation-agent/valuation_agent_code.ts.
 */

export interface HorseValuationInput {
  name?: string;
  age?: number;
  sex?: "male" | "female";
  status?: "active" | "retired" | "deceased";
  speed?: number;
  stamina?: number;
  health?: number;
  pedigreeScore?: number;
  wins?: number;
  totalRaces?: number;
  totalEarnings?: number;
  offspringCount?: number;
  offspringWins?: number;
}

export interface MarketData {
  averageHorseValue?: number;
  bullish?: boolean;
}

export interface ValuationResult {
  value: number;
  breakdown: {
    racingValue: number;
    breedingValue: number;
    offspringSuccessBonus: number;
    ageModifier: number;
    healthModifier: number;
    statusModifier: number;
    marketModifier: number;
    baseValue: number;
    finalValue: number;
    winRate: number;
  };
  explanation?: { summary: string };
}

function getAgeModifier(age: number | undefined, status: string | undefined): number {
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

function getHealthModifier(health: number | undefined): number {
  const h = health == null ? 80 : Math.max(0, Math.min(100, health));
  return 0.5 + 0.5 * (h / 100);
}

function getStatusModifier(status: string | undefined): number {
  if (status === "retired") return 0.9;
  if (status === "deceased") return 0.7;
  return 1.0;
}

function calculate(
  horse: HorseValuationInput,
  marketData: MarketData
): { value: number; breakdown: ValuationResult["breakdown"] } {
  const market = { averageHorseValue: 50000, bullish: false, ...marketData };
  const winRate =
    horse.totalRaces && horse.totalRaces > 0
      ? (horse.wins ?? 0) / horse.totalRaces
      : 0;
  const racingValue =
    (horse.totalEarnings ?? 0) * 2 +
    winRate * 100000 +
    (horse.speed ?? 0) * 1000;
  const offspringSuccessBonus = (horse.offspringWins ?? 0) * 5000;
  let breedingValue =
    (horse.pedigreeScore ?? 0) * 2000 + offspringSuccessBonus;
  if (horse.sex === "male") breedingValue *= 1.2;

  const status = horse.status ?? "active";
  const ageMod = getAgeModifier(horse.age, status);
  const healthMod = getHealthModifier(horse.health);
  const statusMod = getStatusModifier(status);

  let baseValue: number;
  if (status === "active") {
    baseValue = (racingValue + breedingValue) * ageMod * healthMod;
  } else if (status === "retired") {
    baseValue = breedingValue * ageMod * healthMod * statusMod;
  } else if (status === "deceased") {
    baseValue = breedingValue * 0.2 * statusMod;
  } else {
    baseValue = (racingValue + breedingValue) * ageMod * healthMod;
  }

  let marketModifier = 1.0;
  if (market.bullish) marketModifier += 0.1;
  if (market.averageHorseValue && market.averageHorseValue > 0 && baseValue) {
    const relative = baseValue / market.averageHorseValue;
    if (relative > 5) marketModifier *= 1.05;
    else if (relative < 0.5) marketModifier *= 0.95;
  }
  const finalValue = baseValue * marketModifier;

  return {
    value: finalValue,
    breakdown: {
      racingValue,
      breedingValue,
      offspringSuccessBonus,
      ageModifier: ageMod,
      healthModifier: healthMod,
      statusModifier: statusMod,
      marketModifier,
      baseValue,
      finalValue,
      winRate,
    },
  };
}

/**
 * Run valuation; optionally apply event and return new value.
 * eventData: RACE_WIN { raceGrade?, purse? }, INJURY { severity? 0-10 } (or severityBps 0-10000 → severity = severityBps/1000).
 */
export function runValuation(
  horseData: HorseValuationInput,
  marketData: MarketData = {},
  eventType?: string,
  eventData?: Record<string, unknown>
): ValuationResult {
  const horse = { ...horseData };
  if (!eventType || !eventData) {
    const { value, breakdown } = calculate(horse, marketData);
    const status = horse.status ?? "active";
    const summary =
      status === "deceased"
        ? "Horse is deceased – value reflects historical legacy and bloodline impact."
        : status === "retired"
          ? "Horse is retired – value dominated by breeding potential and pedigree."
          : "Active racehorse – value driven by racing performance and breeding upside.";
    return { value, breakdown, explanation: { summary } };
  }

  let eventMultiplier = 1.0;
  switch (eventType) {
    case "RACE_WIN": {
      const raceGrade = (eventData.raceGrade as string) ?? "ungraded";
      const purse = (eventData.purse as number) ?? 0;
      horse.wins = (horse.wins ?? 0) + 1;
      horse.totalRaces = (horse.totalRaces ?? 0) + 1;
      horse.totalEarnings = (horse.totalEarnings ?? 0) + purse;
      if (raceGrade === "Grade 1") {
        eventMultiplier = 1.25;
        horse.pedigreeScore = (horse.pedigreeScore ?? 0) + 2;
      } else if (raceGrade === "Grade 2") {
        eventMultiplier = 1.15;
        horse.pedigreeScore = (horse.pedigreeScore ?? 0) + 1;
      } else {
        eventMultiplier = 1.05;
      }
      break;
    }
    case "RACE_LOSS": {
      const placement = eventData.placement as number | null;
      const purse = (eventData.purse as number) ?? 0;
      horse.totalRaces = (horse.totalRaces ?? 0) + 1;
      horse.totalEarnings = (horse.totalEarnings ?? 0) + purse;
      eventMultiplier = placement === 2 ? 0.98 : placement === 3 ? 0.96 : 0.95;
      break;
    }
    case "INJURY": {
      let severity = (eventData.severity as number) ?? (eventData.severityBps != null ? Number(eventData.severityBps) / 1000 : 5);
      severity = Math.max(0, Math.min(10, severity));
      horse.health = Math.max(0, (horse.health ?? 100) - severity * 5);
      eventMultiplier = Math.max(1 - severity * 0.05, 0.2);
      break;
    }
    case "RETIREMENT":
      horse.status = "retired";
      break;
    case "OFFSPRING_WIN":
      horse.offspringWins = (horse.offspringWins ?? 0) + 1;
      horse.offspringCount = (horse.offspringCount ?? 0) + 1;
      eventMultiplier = 1.1;
      break;
    case "DEATH":
      horse.status = "deceased";
      horse.health = 0;
      break;
    default:
      break;
  }

  const { value: baseValue, breakdown } = calculate(horse, marketData);
  const newValue = baseValue * eventMultiplier;
  const summary =
    (horse.status ?? "active") === "deceased"
      ? "Horse is deceased – value reflects historical legacy and bloodline impact."
      : (horse.status ?? "active") === "retired"
        ? "Horse is retired – value dominated by breeding potential and pedigree."
        : "Active racehorse – value driven by racing performance and breeding upside.";
  return {
    value: newValue,
    breakdown: {
      ...breakdown,
      baseValue,
      finalValue: newValue,
    },
    explanation: { summary },
  };
}
