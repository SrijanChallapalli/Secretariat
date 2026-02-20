/**
 * Canonical HorseEvent schema — shared between app/ and server/.
 *
 * Types + deterministic serialisation live here.
 * The keccak256 hash uses viem (available in both consumers).
 */

import { keccak256, toBytes } from "viem";

// ---------------------------------------------------------------------------
// Source metadata
// ---------------------------------------------------------------------------

export type SourceKind = "SIMULATION" | "OFFICIAL" | "API_VENDOR";

export interface EventSource {
  kind: SourceKind;
  provider: string;
  uri?: string;
  confidence: number; // 0-1
}

// ---------------------------------------------------------------------------
// Base
// ---------------------------------------------------------------------------

export interface HorseEventBase {
  schemaVersion: "1.0";
  eventId: string;
  eventType: "RACE_RESULT" | "INJURY" | "NEWS";
  occurredAt: string; // ISO-8601
  horse: {
    tokenId: number;
    externalId?: string;
    name?: string;
  };
  source: EventSource;
}

// ---------------------------------------------------------------------------
// RACE_RESULT payload
// ---------------------------------------------------------------------------

export interface RaceResultEvent extends HorseEventBase {
  eventType: "RACE_RESULT";
  race: {
    track?: string;
    raceName?: string;
    raceClass?: string;
    surface?: "DIRT" | "TURF" | "SYN";
    distanceFurlongs?: number;
    fieldSize?: number;
  };
  result: {
    finishPosition: number;
    marginLengths?: number;
    timeSeconds?: number;
    purseUsd?: number;
    earningsADI?: string;
    odds?: number;
  };
  connections?: {
    trainer?: string;
    jockey?: string;
  };
}

// ---------------------------------------------------------------------------
// INJURY payload
// ---------------------------------------------------------------------------

export interface InjuryEvent extends HorseEventBase {
  eventType: "INJURY";
  injury: {
    type?: string;
    severityBps: number; // 0-10000
    expectedDaysOut?: number;
    notes?: string;
  };
}

// ---------------------------------------------------------------------------
// NEWS payload
// ---------------------------------------------------------------------------

export interface NewsEvent extends HorseEventBase {
  eventType: "NEWS";
  news: {
    headline?: string;
    sentimentBps: number; // basis points, can be negative-ish (0-5000 positive)
    notes?: string;
  };
}

// ---------------------------------------------------------------------------
// Union
// ---------------------------------------------------------------------------

export type HorseEvent = RaceResultEvent | InjuryEvent | NewsEvent;

// ---------------------------------------------------------------------------
// Deterministic JSON serialisation (zero runtime deps)
// ---------------------------------------------------------------------------

export function stableStringify(obj: unknown): string {
  if (obj === null || obj === undefined) return JSON.stringify(obj);
  if (typeof obj !== "object") return JSON.stringify(obj);
  if (Array.isArray(obj)) {
    return "[" + obj.map((v) => stableStringify(v)).join(",") + "]";
  }
  const keys = Object.keys(obj as Record<string, unknown>).sort();
  const parts = keys.map(
    (k) =>
      JSON.stringify(k) +
      ":" +
      stableStringify((obj as Record<string, unknown>)[k]),
  );
  return "{" + parts.join(",") + "}";
}

// ---------------------------------------------------------------------------
// Canonicalize + hash
// ---------------------------------------------------------------------------

export function canonicalizeEvent(event: HorseEvent): {
  canonicalJson: string;
  eventHash: `0x${string}`;
} {
  const canonicalJson = stableStringify(event);
  const eventHash = keccak256(toBytes(canonicalJson));
  return { canonicalJson, eventHash };
}
