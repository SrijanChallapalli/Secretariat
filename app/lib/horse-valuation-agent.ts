/**
 * Horse Valuation Agent (S-Agent spec).
 * Complementary to Breeding Advisor: computes USD valuation from racing + breeding + modifiers.
 * Inputs: horse data (age, sex, status, traits, racing record, breeding) + market data.
 * Events: RACE_WIN, RACE_LOSS, INJURY, RETIREMENT, OFFSPRING_WIN, DEATH.
 */

export { calculateScarcityPremium } from "../../shared/scarcity";
import { calculateOfficialAge } from "../../shared/age";

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
  places?: number;
  shows?: number;
  offspringCount?: number;
  offspringWins?: number;
}

export interface MarketData {
  averageHorseValue?: number;
  bullish?: boolean;
  trendingBloodlines?: string[];
}

export interface ValuationBreakdown {
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
}

export interface ValuationExplanation {
  summary: string;
  inputs: Record<string, unknown>;
  components: { racingValue: number; breedingValue: number; offspringSuccessBonus: number };
  modifiers: { ageModifier: number; healthModifier: number; statusModifier: number; marketModifier: number };
  derived: { winRate: number; baseValue: number; finalValue: number };
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

/**
 * Core valuation formula (matches S-Agent HorseValuationAgent.js).
 * Racing value = (totalEarnings * 2) + (winRate * 100000) + (speed * 1000)
 * Breeding value = (pedigreeScore * 2000) + offspringSuccessBonus; sex adjustment for male 1.2x
 * Modifiers: age (peak 3–6), health (0.5–1.0), status, market (bullish +10%).
 */
export function calculateValue(
  horse: HorseValuationInput,
  marketData: MarketData = {}
): { value: number; breakdown: ValuationBreakdown } {
  const market = {
    averageHorseValue: 50000,
    bullish: false,
    trendingBloodlines: [] as string[],
    ...marketData,
  };

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
  else if (horse.sex === "female") breedingValue *= 1.0;

  const ageModifier = getAgeModifier(horse.age, horse.status);
  const healthModifier = getHealthModifier(horse.health);
  const statusModifier = getStatusModifier(horse.status);

  let marketModifier = 1.0;
  if (market.bullish) marketModifier += 0.1;
  // Defer relative adjustment until we have baseValue

  let baseValue: number;
  const status = horse.status ?? "active";
  if (status === "active") {
    baseValue = (racingValue + breedingValue) * ageModifier * healthModifier;
  } else if (status === "retired") {
    baseValue =
      breedingValue * ageModifier * healthModifier * statusModifier;
  } else if (status === "deceased") {
    baseValue = 0;
  } else {
    baseValue = (racingValue + breedingValue) * ageModifier * healthModifier;
  }

  if (market.averageHorseValue && market.averageHorseValue > 0 && baseValue) {
    const relative = baseValue / market.averageHorseValue;
    if (relative > 5) marketModifier *= 1.05;
    else if (relative < 0.5) marketModifier *= 0.95;
  }
  const finalValue = baseValue * marketModifier;

  const breakdown: ValuationBreakdown = {
    racingValue,
    breedingValue,
    offspringSuccessBonus,
    ageModifier,
    healthModifier,
    statusModifier,
    marketModifier,
    baseValue,
    finalValue,
    winRate,
  };
  return { value: finalValue, breakdown };
}

/**
 * Adjust horse state and return new value for an event.
 * eventData: RACE_WIN { raceGrade?, purse? }, RACE_LOSS { placement?, purse? }, INJURY { severity? 0-10 }.
 * Oracle severity is in bps (0-10000); use severityBps/1000 for agent severity (0-10).
 */
export function adjustForEvent(
  horse: HorseValuationInput,
  eventType: string,
  eventData: Record<string, unknown> = {},
  marketData: MarketData = {}
): { value: number; breakdown: ValuationBreakdown } {
  const h = { ...horse };
  let eventMultiplier = 1.0;

  switch (eventType) {
    case "RACE_WIN": {
      const raceGrade = (eventData.raceGrade as string) ?? "ungraded";
      const purse = (eventData.purse as number) ?? 0;
      h.wins = (h.wins ?? 0) + 1;
      h.totalRaces = (h.totalRaces ?? 0) + 1;
      h.totalEarnings = (h.totalEarnings ?? 0) + purse;
      if (raceGrade === "Grade 1") {
        eventMultiplier = 1.25;
        h.pedigreeScore = (h.pedigreeScore ?? 0) + 2;
      } else if (raceGrade === "Grade 2") {
        eventMultiplier = 1.15;
        h.pedigreeScore = (h.pedigreeScore ?? 0) + 1;
      } else {
        eventMultiplier = 1.05;
      }
      break;
    }
    case "RACE_LOSS": {
      const placement = eventData.placement as number | null;
      const purse = (eventData.purse as number) ?? 0;
      h.totalRaces = (h.totalRaces ?? 0) + 1;
      h.totalEarnings = (h.totalEarnings ?? 0) + purse;
      if (placement === 2) {
        h.places = (h.places ?? 0) + 1;
        eventMultiplier = 0.98;
      } else if (placement === 3) {
        h.shows = (h.shows ?? 0) + 1;
        eventMultiplier = 0.96;
      } else {
        eventMultiplier = 0.95;
      }
      break;
    }
    case "INJURY": {
      const severity = (eventData.severity as number) ?? 5;
      const clampedSeverity = Math.max(0, Math.min(10, severity));
      const healthReduction = clampedSeverity * 5;
      h.health = Math.max(0, (h.health ?? 100) - healthReduction);
      eventMultiplier = Math.max(1 - clampedSeverity * 0.05, 0.2);
      break;
    }
    case "RETIREMENT":
      h.status = "retired";
      eventMultiplier = 1.0;
      break;
    case "OFFSPRING_WIN":
      h.offspringWins = (h.offspringWins ?? 0) + 1;
      h.offspringCount = (h.offspringCount ?? 0) + 1;
      eventMultiplier = 1.1;
      break;
    case "DEATH":
      h.status = "deceased";
      h.health = 0;
      eventMultiplier = 0;
      break;
    default:
      eventMultiplier = 1.0;
  }

  const { value: baseValue, breakdown } = calculateValue(h, marketData);
  const newValue = baseValue * eventMultiplier;
  const breakdownWithEvent: ValuationBreakdown = {
    ...breakdown,
    baseValue,
    finalValue: newValue,
  };
  return { value: newValue, breakdown: breakdownWithEvent };
}

/**
 * Explain latest valuation (summary + inputs + components + modifiers).
 */
export function explainValuation(
  horse: HorseValuationInput,
  marketData: MarketData = {}
): ValuationExplanation {
  const { breakdown } = calculateValue(horse, marketData);
  const status = horse.status ?? "active";
  const summary =
    status === "deceased"
      ? "Horse is deceased – value reflects historical legacy and bloodline impact."
      : status === "retired"
        ? "Horse is retired – value dominated by breeding potential and pedigree."
        : "Active racehorse – value driven by racing performance and breeding upside.";
  return {
    summary,
    inputs: {
      name: horse.name,
      age: horse.age,
      sex: horse.sex,
      status: horse.status,
      speed: horse.speed,
      stamina: horse.stamina,
      health: horse.health,
      pedigreeScore: horse.pedigreeScore,
      wins: horse.wins,
      totalRaces: horse.totalRaces,
      totalEarnings: horse.totalEarnings,
      offspringCount: horse.offspringCount,
      offspringWins: horse.offspringWins,
      marketData,
    },
    components: {
      racingValue: breakdown.racingValue,
      breedingValue: breakdown.breedingValue,
      offspringSuccessBonus: breakdown.offspringSuccessBonus,
    },
    modifiers: {
      ageModifier: breakdown.ageModifier,
      healthModifier: breakdown.healthModifier,
      statusModifier: breakdown.statusModifier,
      marketModifier: breakdown.marketModifier,
    },
    derived: {
      winRate: breakdown.winRate,
      baseValue: breakdown.baseValue,
      finalValue: breakdown.finalValue,
    },
  };
}

/**
 * Map HorseINFT (chain) data to HorseValuationInput.
 * traitVector: [speed, stamina, temperament, conformation, health, agility, raceIQ, consistency]
 * No on-chain wins/totalRaces/totalEarnings/offspring – use 0 or pass from off-chain metadata.
 */
export interface HorseINFTLike {
  name?: string;
  birthTimestamp?: bigint | number;
  traitVector: number[] | readonly number[];
  pedigreeScore: number | bigint;
  valuationADI?: bigint | number;
  injured?: boolean;
  retired?: boolean;
  /** Off-chain racing/breeding stats if available */
  wins?: number;
  totalRaces?: number;
  totalEarnings?: number;
  offspringCount?: number;
  offspringWins?: number;
  sex?: "male" | "female";
}

export function mapHorseINFTToValuationInput(
  chain: HorseINFTLike,
  options: { age?: number; sex?: "male" | "female"; wins?: number; totalRaces?: number; totalEarnings?: number; offspringCount?: number; offspringWins?: number } = {}
): HorseValuationInput {
  const traits = chain.traitVector ?? [];
  const age =
    options.age ??
    (chain.birthTimestamp != null
      ? calculateOfficialAge(Number(chain.birthTimestamp))
      : undefined);
  return {
    name: chain.name as string | undefined,
    age,
    sex: options.sex ?? chain.sex,
    status: chain.retired ? "retired" : "active",
    speed: Number(traits[0] ?? 0),
    stamina: Number(traits[1] ?? 0),
    health: chain.injured ? 50 : Number(traits[4] ?? 80),
    pedigreeScore: Number(chain.pedigreeScore ?? 0),
    wins: options.wins ?? chain.wins ?? 0,
    totalRaces: options.totalRaces ?? chain.totalRaces ?? 0,
    totalEarnings: options.totalEarnings ?? chain.totalEarnings ?? 0,
    offspringCount: options.offspringCount ?? chain.offspringCount ?? 0,
    offspringWins: options.offspringWins ?? chain.offspringWins ?? 0,
  };
}

export { createEngine } from "./valuation-engine";
