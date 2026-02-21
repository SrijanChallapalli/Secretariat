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
} from "../../shared/events.js";

const HORSE_INFT = process.env.NEXT_PUBLIC_HORSE_INFT;
const INTERVAL_MS = Number(process.env.AUTO_SIM_INTERVAL_MS ?? 45_000);
const ENABLED =
  process.env.AUTO_SIM_ENABLED !== "false" &&
  process.env.NODE_ENV !== "test";

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
  return {
    ...buildBase(tokenId),
    eventType: "INJURY",
    injury: {
      type: pick(INJURY_TYPES),
      severityBps: randInt(200, 2000),
      expectedDaysOut: randInt(7, 90),
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
  if (r < 0.70) return generateInjury(tokenId);
  return generateNews(tokenId);
}

async function discoverHorses(): Promise<number[]> {
  if (!HORSE_INFT || HORSE_INFT === "0x0000000000000000000000000000000000000000") {
    return [];
  }
  const client = getPublicClient();
  const total = Number(
    await client.readContract({
      address: HORSE_INFT as `0x${string}`,
      abi: horseINFTAbi,
      functionName: "nextTokenId",
    }),
  );
  if (total === 0) return [];

  const ids: number[] = [];
  for (let id = 0; id < total; id++) {
    try {
      const { features } = await fetchHorseFeatures(id);
      if (features.retired || features.injured) continue;
      if ((features.speed ?? 0) === 0 && (features.stamina ?? 0) === 0) continue;
      ids.push(id);
    } catch {
      // skip non-existent tokens
    }
  }
  return ids;
}

let timer: ReturnType<typeof setInterval> | null = null;
let running = false;

async function tick() {
  if (running) return;
  running = true;
  try {
    const horses = await discoverHorses();
    if (horses.length === 0) {
      console.log("[auto-sim] No eligible horses found, skipping tick");
      return;
    }

    const tokenId = pick(horses);
    const event = generateRandomEvent(tokenId);
    const eventLabel =
      event.eventType === "RACE_RESULT"
        ? `RACE P${(event as RaceResultEvent).result.finishPosition} at ${(event as RaceResultEvent).race.track}`
        : event.eventType === "INJURY"
          ? `INJURY (${(event as InjuryEvent).injury.type})`
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

  console.log(`[auto-sim] Starting auto-simulator (interval: ${INTERVAL_MS / 1000}s)`);

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
