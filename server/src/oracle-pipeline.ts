/**
 * Oracle pipeline: simulate events, run valuation agent, commit on-chain.
 *
 * POST /events/simulate   — build a canonical HorseEvent from params
 * POST /oracle/apply-event — run valuation, optional 0G upload, submit tx
 */

import { Request, Response } from "express";
import { createWalletClient, http, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { ethers } from "ethers";
import { Indexer, ZgFile } from "@0glabs/0g-ts-sdk";

import type {
  HorseEvent,
  RaceResultEvent,
  InjuryEvent,
  NewsEvent,
} from "../../shared/events.js";
import { canonicalizeEvent } from "../../shared/events.js";
import type { FeatureVector, ValuationResult } from "../../shared/types.js";
import { fetchHorseFeatures, og0gChain } from "./chain-reader.js";
import { createEngine } from "./valuation-engine.js";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const RPC = process.env.RPC_0G || "https://evmrpc-testnet.0g.ai";
const HORSE_ORACLE = process.env.NEXT_PUBLIC_HORSE_ORACLE as `0x${string}` | undefined;
const ORACLE_PK = process.env.ORACLE_PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY;

const INDEXER_RPC = process.env.INDEXER_RPC ?? "https://indexer-storage-testnet-turbo.0g.ai";
const RPC_URL_0G = process.env.RPC_URL_0G ?? "https://evmrpc-testnet.0g.ai";
const OG_UPLOADER_PK = process.env.OG_UPLOADER_PRIVATE_KEY;

const oracleAbi = parseAbi([
  "function commitValuation(uint256 tokenId, uint8 eventType, bytes32 eventHash, uint256 newValuationADI, bytes32 ogRootHash) external",
]);

const engine = createEngine("formula");

// ---------------------------------------------------------------------------
// Event type enum (matches Solidity)
// ---------------------------------------------------------------------------

const EVENT_TYPE_ENUM: Record<string, number> = {
  RACE_RESULT: 0,
  INJURY: 1,
  NEWS: 2,
};

// ---------------------------------------------------------------------------
// POST /events/simulate
// ---------------------------------------------------------------------------

export async function simulateEventRoute(req: Request, res: Response) {
  try {
    const { tokenId, type, params } = req.body ?? {};

    if (tokenId == null || typeof tokenId !== "number") {
      res.status(400).json({ error: "tokenId (number) required" });
      return;
    }
    if (!type || !["RACE_RESULT", "INJURY", "NEWS"].includes(type)) {
      res.status(400).json({ error: "type must be RACE_RESULT | INJURY | NEWS" });
      return;
    }

    const base = {
      schemaVersion: "1.0" as const,
      eventId: crypto.randomUUID(),
      occurredAt: new Date().toISOString(),
      horse: { tokenId },
      source: {
        kind: "SIMULATION" as const,
        provider: "demo",
        confidence: 0.7,
      },
    };

    let event: HorseEvent;

    if (type === "RACE_RESULT") {
      const p = (params ?? {}) as Record<string, unknown>;
      event = {
        ...base,
        eventType: "RACE_RESULT",
        race: {
          track: (p.track as string) ?? undefined,
          raceClass: (p.raceClass as string) ?? undefined,
          surface: (p.surface as RaceResultEvent["race"]["surface"]) ?? undefined,
          distanceFurlongs: p.distanceFurlongs != null ? Number(p.distanceFurlongs) : undefined,
          fieldSize: p.fieldSize != null ? Number(p.fieldSize) : 8,
        },
        result: {
          finishPosition: Number(p.finishPosition ?? 1),
          purseUsd: p.purseUsd != null ? Number(p.purseUsd) : undefined,
          earningsADI: p.earningsADI != null ? String(p.earningsADI) : undefined,
          odds: p.odds != null ? Number(p.odds) : undefined,
        },
        connections: p.trainer || p.jockey
          ? { trainer: p.trainer as string, jockey: p.jockey as string }
          : undefined,
      } satisfies RaceResultEvent;
    } else if (type === "INJURY") {
      const p = (params ?? {}) as Record<string, unknown>;
      event = {
        ...base,
        eventType: "INJURY",
        injury: {
          type: (p.injuryType as string) ?? undefined,
          severityBps: Number(p.severityBps ?? 500),
          expectedDaysOut: p.expectedDaysOut != null ? Number(p.expectedDaysOut) : undefined,
          notes: (p.notes as string) ?? undefined,
        },
      } satisfies InjuryEvent;
    } else {
      const p = (params ?? {}) as Record<string, unknown>;
      event = {
        ...base,
        eventType: "NEWS",
        news: {
          headline: (p.headline as string) ?? undefined,
          sentimentBps: Number(p.sentimentBps ?? 200),
          notes: (p.notes as string) ?? undefined,
        },
      } satisfies NewsEvent;
    }

    const { canonicalJson, eventHash } = canonicalizeEvent(event);
    res.json({ event, canonicalJson, eventHash });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
}

// ---------------------------------------------------------------------------
// POST /oracle/apply-event
// ---------------------------------------------------------------------------

export async function applyEventRoute(req: Request, res: Response) {
  try {
    const { event, uploadTo0g } = req.body ?? {};

    if (!event || !event.eventType || event.horse?.tokenId == null) {
      res.status(400).json({ error: "event with eventType and horse.tokenId required" });
      return;
    }
    if (!HORSE_ORACLE || HORSE_ORACLE === "0x0000000000000000000000000000000000000000") {
      res.status(500).json({ error: "NEXT_PUBLIC_HORSE_ORACLE not configured" });
      return;
    }
    if (!ORACLE_PK) {
      res.status(500).json({ error: "ORACLE_PRIVATE_KEY (or DEPLOYER_PRIVATE_KEY) not set" });
      return;
    }

    const horseEvent = event as HorseEvent;
    const tokenId = horseEvent.horse.tokenId;
    const { canonicalJson, eventHash } = canonicalizeEvent(horseEvent);

    // 1. Fetch on-chain data
    const { features, valuationADIRaw } = await fetchHorseFeatures(tokenId);
    if (!features.speed && !features.stamina) {
      res.status(404).json({ error: `No horse data found on-chain for tokenId ${tokenId}` });
      return;
    }

    // 2. Build full FeatureVector with defaults for required fields
    const fullFeatures: FeatureVector = {
      speed: features.speed ?? 0,
      stamina: features.stamina ?? 0,
      temperament: features.temperament ?? 0,
      conformation: features.conformation ?? 0,
      health: features.health ?? 80,
      agility: features.agility ?? 0,
      raceIQ: features.raceIQ ?? 0,
      consistency: features.consistency ?? 0,
      pedigreeScore: features.pedigreeScore ?? 0,
      injured: features.injured ?? false,
      retired: features.retired ?? false,
      birthTimestamp: features.birthTimestamp ?? 0,
      sireId: features.sireId ?? 0,
      damId: features.damId ?? 0,
    };

    // 3. Map canonical event -> engine event type + data
    let valuationResult: ValuationResult;
    let multiplier: number;

    const basePrediction = engine.predict(fullFeatures);

    if (horseEvent.eventType === "RACE_RESULT") {
      const pos = horseEvent.result.finishPosition;
      const engineType = pos === 1 ? "RACE_WIN" : "RACE_LOSS";
      const engineData: Record<string, unknown> = {};
      if (pos > 1) engineData.placement = pos;
      if (horseEvent.race.raceClass) engineData.raceGrade = horseEvent.race.raceClass;
      if (horseEvent.result.purseUsd) engineData.purse = horseEvent.result.purseUsd;
      valuationResult = engine.adjustForEvent(fullFeatures, engineType, engineData);
      multiplier = basePrediction.value > 0 ? valuationResult.value / basePrediction.value : 1;
    } else if (horseEvent.eventType === "INJURY") {
      const engineData = { severityBps: horseEvent.injury.severityBps };
      valuationResult = engine.adjustForEvent(fullFeatures, "INJURY", engineData);
      multiplier = basePrediction.value > 0 ? valuationResult.value / basePrediction.value : 1;
    } else {
      // NEWS: no engine event type; apply sentiment as direct multiplier
      const sentBps = (horseEvent as NewsEvent).news.sentimentBps;
      multiplier = 1 + sentBps / 10000;
      valuationResult = {
        ...basePrediction,
        value: basePrediction.value * multiplier,
        explanation: `News sentiment adjustment: ${sentBps > 0 ? "+" : ""}${sentBps} bps`,
      };
    }

    // 4. Compute new on-chain valuation
    const currentVal = valuationADIRaw;
    // Use BigInt math: newVal = currentVal * (multiplier * 10000) / 10000
    const multiplierBps = BigInt(Math.round(multiplier * 10000));
    const newValuationADI = (currentVal * multiplierBps) / 10000n;

    // 5. Optional 0G upload
    let ogRootHash: string | undefined;
    let ogTxHash: string | undefined;
    if (uploadTo0g) {
      try {
        const result = await uploadJsonTo0G({
          event: horseEvent,
          canonicalJson,
          eventHash,
          valuationResult,
          newValuationADI: newValuationADI.toString(),
        });
        ogRootHash = result.rootHash;
        ogTxHash = result.txHash;
      } catch (e) {
        console.warn("0G upload failed (continuing without):", (e as Error).message);
      }
    }

    // 6. Submit on-chain tx
    const pk = ORACLE_PK.startsWith("0x") ? ORACLE_PK : `0x${ORACLE_PK}`;
    const account = privateKeyToAccount(pk as `0x${string}`);
    const walletClient = createWalletClient({
      account,
      chain: og0gChain,
      transport: http(RPC),
    });

    const ogRootHashBytes = ogRootHash
      ? (`0x${ogRootHash.replace(/^0x/, "")}`.padEnd(66, "0") as `0x${string}`)
      : ("0x" + "00".repeat(32)) as `0x${string}`;

    const txHash = await walletClient.writeContract({
      address: HORSE_ORACLE,
      abi: oracleAbi,
      functionName: "commitValuation",
      args: [
        BigInt(tokenId),
        EVENT_TYPE_ENUM[horseEvent.eventType] ?? 0,
        eventHash as `0x${string}`,
        newValuationADI,
        ogRootHashBytes,
      ],
    });

    res.json({
      eventHash,
      newValuationADI: newValuationADI.toString(),
      previousValuationADI: currentVal.toString(),
      multiplier,
      valuationResult,
      txHash,
      ogRootHash: ogRootHash ?? null,
      ogTxHash: ogTxHash ?? null,
      canonicalJson,
      submittedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error("apply-event error:", e);
    res.status(500).json({ error: String(e) });
  }
}

// ---------------------------------------------------------------------------
// Internal 0G upload helper (writes JSON to temp file, uploads via SDK)
// ---------------------------------------------------------------------------

async function uploadJsonTo0G(data: object): Promise<{ rootHash: string; txHash: string }> {
  if (!OG_UPLOADER_PK) throw new Error("OG_UPLOADER_PRIVATE_KEY not set");

  const tmpDir = path.resolve(process.cwd(), "server/uploads");
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

  const tmpFile = path.join(tmpDir, `event-${Date.now()}.json`);
  fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2));

  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL_0G);
    const signer = new ethers.Wallet(OG_UPLOADER_PK, provider);
    const indexer = new Indexer(INDEXER_RPC);

    const zgFile = await ZgFile.fromFilePath(tmpFile);
    const [_tree, treeErr] = await zgFile.merkleTree();
    if (treeErr) {
      await zgFile.close();
      throw new Error(`Merkle tree: ${treeErr}`);
    }

    const [tx, uploadErr] = await indexer.upload(
      zgFile,
      RPC_URL_0G,
      signer as unknown as Parameters<Indexer["upload"]>[2],
    );
    await zgFile.close();

    if (uploadErr) throw new Error(`Upload: ${uploadErr}`);
    return { rootHash: tx.rootHash, txHash: tx.txHash };
  } finally {
    fs.promises.unlink(tmpFile).catch(() => {});
  }
}
