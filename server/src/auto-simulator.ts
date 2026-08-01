/**
 * Auto-simulator: background loop that generates random horse events and
 * applies them through the oracle pipeline so on-chain valuations change
 * dynamically during demo / dev sessions.
 *
 * Starts via `startAutoSimulator()` from the server entry point.
 */

import crypto from "crypto";
import { getPublicClient, horseINFTAbi, fetchHorseFeatures } from "./chain-reader.js";
import { applyEventCore } from "./oracle-pipeline.js";
import type {
  HorseEvent,
  RaceResultEvent,
  InjuryEvent,
  NewsEvent,
  RecoveryEvent,
} from "../../shared/events.js";
import { INJURY_CATALOG } from "../../shared/injuries.js";

const HORSE_INFT = process.env.NEXT_PUBLIC_HORSE_INFT;
const INTERVAL_MS = Number(process.env.AUTO_SIM_INTERVAL_MS ?? 45_000);
const ENABLED =
  process.env.AUTO_SIM_ENABLED !== "false" &&
  process.env.NODE_ENV !== "test";

/** Share of ticks that produce an injury. Set to 0 to disable injuries. */
const INJURY_RATE = Number(process.env.AUTO_SIM_INJURY_RATE ?? 0.15);
/**
 * Demo time compression: how many simulated days pass per tick. Real recovery
 * windows run 60-365 days, so at 45s/tick and 30 days/tick a quarter crack
 * heals in ~90s and a cannon fracture in ~9min — visible within a demo.
 */
const DAYS_PER_TICK = Number(process.env.AUTO_SIM_DAYS_PER_TICK ?? 30);
/** Layoff assumed for horses already injured when the server started. */
const UNKNOWN_INJURY_DAYS = 90;

/** tokenId → tick at which the horse becomes eligible to recover. */
const recoveryDue = new Map<number, { tick: number; injuryType: string; daysOut: number }>();
let tickCount = 0;

const TRACKS = [
  "Meydan",
  "Churchill Downs",
  "Ascot",
  "Santa Anita",
  "Flemington",
  "Longchamp",
  "Sha Tin",
  "King Abdulaziz",
];
const RACE_CLASSES = ["Grade 1", "Grade 2", "Grade 3", "Listed", "Allowance"];
const SURFACES: RaceResultEvent["race"]["surface"][] = ["DIRT", "TURF", "SYN"];
const INJURY_TYPES = [
  "shin splint",
  "soft tissue strain",
  "hoof bruise",
  "tendon inflammation",
  "minor colic",
];
const NEWS_HEADLINES_POSITIVE = [
  "Strong training gallop recorded",
  "Impressive breeze time at dawn workout",
  "Jockey praises horse's temperament",
  "Breeding demand surges after recent form",
  "Named top prospect by racing analyst",
  "Wins morning trial in style",
];
const NEWS_HEADLINES_NEGATIVE = [
  "Disappointing barrier trial performance",
  "Trainer flags concern over fitness",
  "Ownership dispute reported",
  "Minor setback delays race return",
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function buildBase(tokenId: number) {
  return {
    schemaVersion: "1.0" as const,
    eventId: crypto.randomUUID(),
    occurredAt: new Date().toISOString(),
    horse: { tokenId },
    source: {
      kind: "SIMULATION" as const,
      provider: "auto-simulator",
      confidence: 0.7,
    },
  };
}

function generateRaceResult(tokenId: number): RaceResultEvent {
  const finishPosition = weightedPosition();
  const raceClass = pick(RACE_CLASSES);
  const purseMultiplier =
    raceClass === "Grade 1" ? 5 : raceClass === "Grade 2" ? 3 : raceClass === "Grade 3" ? 2 : 1;
  const purseUsd = randInt(50, 500) * 1000 * purseMultiplier;
  const earningsShare = finishPosition === 1 ? 0.6 : finishPosition === 2 ? 0.2 : finishPosition === 3 ? 0.1 : 0.05;

  return {
    ...buildBase(tokenId),
    eventType: "RACE_RESULT",
    race: {
      track: pick(TRACKS),
      raceClass,
      surface: pick(SURFACES),
      distanceFurlongs: pick([5, 6, 7, 8, 9, 10, 12]),
      fieldSize: randInt(6, 14),
    },
    result: {
      finishPosition,
      purseUsd,
      earningsADI: String(Math.round(purseUsd * earningsShare)),
      odds: finishPosition === 1 ? randInt(15, 80) / 10 : randInt(30, 200) / 10,
    },
  };
}

/** Weighted finish position: ~30% win, ~20% 2nd, ~15% 3rd, rest lower */
function weightedPosition(): number {
  const r = Math.random();
  if (r < 0.30) return 1;
  if (r < 0.50) return 2;
  if (r < 0.65) return 3;
  if (r < 0.80) return 4;
  return randInt(5, 10);
}

function generateInjury(tokenId: number): InjuryEvent {
  // Draw from the real veterinary catalog so the layoff length (and therefore
  // the recovery schedule) matches the injury actually reported.
  const key = pick(Object.keys(INJURY_CATALOG));
  const c = INJURY_CATALOG[key];
  return {
    ...buildBase(tokenId),
    eventType: "INJURY",
    injury: {
      type: c.name,
      // Contract caps severity at 5000 bps.
      severityBps: Math.min(5000, Math.max(200, c.valuationImpactPct * 100)),
      expectedDaysOut: c.recoveryDays,
      notes: key,
    },
  };
}

function generateRecovery(
  tokenId: number,
  injuryType: string,
  daysOut: number,
): RecoveryEvent {
  return {
    ...buildBase(tokenId),
    eventType: "RECOVERY",
    recovery: {
      injuryType,
      daysOut,
      notes: `Cleared to return to training after ${daysOut}-day layoff`,
    },
  };
}

function generateNews(tokenId: number): NewsEvent {
  const positive = Math.random() < 0.7;
  return {
    ...buildBase(tokenId),
    eventType: "NEWS",
    news: {
      headline: positive ? pick(NEWS_HEADLINES_POSITIVE) : pick(NEWS_HEADLINES_NEGATIVE),
      sentimentBps: positive ? randInt(100, 500) : randInt(-400, -50),
    },
  };
}

/** Weighted event type: 55% race, 15% injury, 30% news */
function generateRandomEvent(tokenId: number): HorseEvent {
  const r = Math.random();
  if (r < 0.55) return generateRaceResult(tokenId);
  if (r < 0.55 + INJURY_RATE) return generateInjury(tokenId);
  return generateNews(tokenId);
}

async function discoverHorses(): Promise<{ healthy: number[]; injured: number[] }> {
  const empty = { healthy: [], injured: [] };
  if (!HORSE_INFT || HORSE_INFT === "0x0000000000000000000000000000000000000000") {
    return empty;
  }
  const client = getPublicClient();
  const total = Number(
    await client.readContract({
      address: HORSE_INFT as `0x${string}`,
      abi: horseINFTAbi,
      functionName: "nextTokenId",
    }),
  );
  if (total === 0) return empty;

  const healthy: number[] = [];
  const injured: number[] = [];
  for (let id = 0; id < total; id++) {
    try {
      const { features } = await fetchHorseFeatures(id);
      if (features.retired) continue;
      if ((features.speed ?? 0) === 0 && (features.stamina ?? 0) === 0) continue;
      if (features.injured) injured.push(id);
      else healthy.push(id);
    } catch {
      // skip non-existent tokens
    }
  }
  return { healthy, injured };
}

/**
 * Injured horses whose layoff has elapsed. Horses found injured with no
 * recorded schedule (injured before this process started) are registered on
 * first sight so they still recover rather than being stuck forever.
 */
function dueForRecovery(injured: number[]): number[] {
  const due: number[] = [];
  for (const id of injured) {
    let entry = recoveryDue.get(id);
    if (!entry) {
      entry = {
        tick: tickCount + Math.ceil(UNKNOWN_INJURY_DAYS / DAYS_PER_TICK),
        injuryType: "unknown",
        daysOut: UNKNOWN_INJURY_DAYS,
      };
      recoveryDue.set(id, entry);
      console.log(
        `[auto-sim] tokenId=${id} was already injured — scheduling recovery in ` +
          `${entry.tick - tickCount} tick(s)`,
      );
    }
    if (tickCount >= entry.tick) due.push(id);
  }
  return due;
}

let timer: ReturnType<typeof setInterval> | null = null;
let running = false;

async function tick() {
  if (running) return;
  running = true;
  try {
    tickCount++;
    const { healthy, injured } = await discoverHorses();

    // Recoveries take priority: they refill the eligible pool, so without this
    // a run that injures everything can never resume racing.
    const due = dueForRecovery(injured);

    let tokenId: number;
    let event: HorseEvent;
    if (due.length > 0) {
      tokenId = pick(due);
      const entry = recoveryDue.get(tokenId)!;
      event = generateRecovery(tokenId, entry.injuryType, entry.daysOut);
      recoveryDue.delete(tokenId);
    } else if (healthy.length > 0) {
      tokenId = pick(healthy);
      event = generateRandomEvent(tokenId);
    } else {
      console.log(
        `[auto-sim] No eligible horses (${injured.length} injured, awaiting recovery), skipping tick`,
      );
      return;
    }

    // Schedule the recovery for any injury we are about to apply.
    if (event.eventType === "INJURY") {
      const daysOut = event.injury.expectedDaysOut ?? UNKNOWN_INJURY_DAYS;
      recoveryDue.set(tokenId, {
        tick: tickCount + Math.ceil(daysOut / DAYS_PER_TICK),
        injuryType: event.injury.notes ?? event.injury.type ?? "unknown",
        daysOut,
      });
    }
    const eventLabel =
      event.eventType === "RACE_RESULT"
        ? `RACE P${(event as RaceResultEvent).result.finishPosition} at ${(event as RaceResultEvent).race.track}`
        : event.eventType === "INJURY"
          ? `INJURY (${(event as InjuryEvent).injury.type})`
          : event.eventType === "RECOVERY"
            ? `RECOVERY (${(event as RecoveryEvent).recovery.daysOut}-day layoff)`
            : `NEWS ("${(event as NewsEvent).news.headline}")`;

    console.log(`[auto-sim] Generating ${eventLabel} for tokenId=${tokenId}`);

    const result = await applyEventCore(event);
    console.log(
      `[auto-sim] Applied! tokenId=${tokenId} ` +
        `multiplier=${result.multiplier.toFixed(4)} ` +
        `prev=${result.previousValuationADI} → new=${result.newValuationADI} ` +
        `tx=${result.txHash}`,
    );
  } catch (e) {
    console.warn("[auto-sim] tick error:", (e as Error).message);
  } finally {
    running = false;
  }
}

export function startAutoSimulator(): void {
  if (!ENABLED) {
    console.log("[auto-sim] Disabled (AUTO_SIM_ENABLED=false or test env)");
    return;
  }
  if (!HORSE_INFT || HORSE_INFT === "0x0000000000000000000000000000000000000000") {
    console.warn("[auto-sim] No HORSE_INFT contract — skipping");
    return;
  }
  if (
    !process.env.ORACLE_PRIVATE_KEY &&
    !process.env.DEPLOYER_PRIVATE_KEY
  ) {
    console.warn("[auto-sim] No oracle/deployer key — skipping");
    return;
  }

  console.log(
    `[auto-sim] Starting auto-simulator (interval: ${INTERVAL_MS / 1000}s, ` +
      `injury rate: ${(INJURY_RATE * 100).toFixed(0)}%, ${DAYS_PER_TICK} sim-days/tick)`,
  );

  // First tick after a short delay to let the server finish startup
  setTimeout(() => {
    tick();
    timer = setInterval(tick, INTERVAL_MS);
  }, 5_000);
}

export function stopAutoSimulator(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
    console.log("[auto-sim] Stopped");
  }
}
