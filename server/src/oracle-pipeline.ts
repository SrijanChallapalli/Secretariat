/**
 * Oracle pipeline: simulate events, run valuation agent, commit on-chain.
 *
 * POST /events/simulate   — build a canonical HorseEvent from params
 * POST /oracle/apply-event — run valuation, optional 0G upload, submit tx
 */

import { Request, Response } from "express";
import { createPublicClient, createWalletClient, http, parseAbi, formatEther } from "viem";
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
import { fetchHorseFeatures, findOffspring, og0gChain } from "./chain-reader.js";
import { createEngine } from "./valuation-engine.js";
import { createBiometricScan } from "./biometric-engine.js";
import { calculateCascadingEffects } from "../../shared/cascading-events.js";
import { NEWBORN_THRESHOLD_MS, NEWBORN_THRESHOLD_S } from "../../shared/constants.js";

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
  "function reportRiskScore(uint256 tokenId, uint8 riskScore) external",
  "function reportCriticalBiologicalEmergency(uint256 tokenId) external",
]);

const engine = createEngine("formula");

// ---------------------------------------------------------------------------
// Event type enum (matches Solidity)
// ---------------------------------------------------------------------------

const EVENT_TYPE_ENUM: Record<string, number> = {
  RACE_RESULT: 0,
  INJURY: 1,
  NEWS: 2,
  BIOMETRIC: 3,
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
    if (!type || !["RACE_RESULT", "INJURY", "NEWS", "BIOMETRIC"].includes(type)) {
      res.status(400).json({ error: "type must be RACE_RESULT | INJURY | NEWS | BIOMETRIC" });
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
    } else if (type === "NEWS") {
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
    } else {
      // BIOMETRIC
      const p = (params ?? {}) as Record<string, unknown>;
      event = {
        ...base,
        eventType: "BIOMETRIC" as any,
        biometric: {
          type: Number(p.biometricType ?? 0),
          value: Number(p.value ?? 0),
          baseline: Number(p.baseline ?? 0),
          anomalyThresholdBps: Number(p.anomalyThresholdBps ?? 500),
        },
      } as any;
    }

    const { canonicalJson, eventHash } = canonicalizeEvent(event);
    res.json({ event, canonicalJson, eventHash });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
}

// ---------------------------------------------------------------------------
// Core apply-event logic (callable directly or via HTTP route)
// ---------------------------------------------------------------------------

export interface ApplyEventResult {
  eventHash: string;
  newValuationADI: string;
  previousValuationADI: string;
  verifiedValuationADI: string | null;
  ibv: number | null;
  txStatus: "success" | "reverted" | "pending";
  multiplier: number;
  valuationResult: ValuationResult;
  txHash: string;
  ogRootHash: string | null;
  ogTxHash: string | null;
  canonicalJson: string;
  submittedAt: string;
  riskScore?: { riskScore: number; minerDamage?: number };
  cascadingOffspring?: Array<{
    offspringTokenId: number;
    multiplier: number;
    reason: string;
    previousValuationADI: string;
    newValuationADI: string;
    txHash: string;
  }>;
}

export async function applyEventCore(
  horseEvent: HorseEvent,
  uploadTo0g = false,
): Promise<ApplyEventResult> {
  if (!HORSE_ORACLE || HORSE_ORACLE === "0x0000000000000000000000000000000000000000") {
    throw new Error("NEXT_PUBLIC_HORSE_ORACLE not configured");
  }
  if (!ORACLE_PK) {
    throw new Error("ORACLE_PRIVATE_KEY (or DEPLOYER_PRIVATE_KEY) not set");
  }

  const tokenId = horseEvent.horse.tokenId;
  const { canonicalJson, eventHash } = canonicalizeEvent(horseEvent);

  const { features, valuationADIRaw } = await fetchHorseFeatures(tokenId);
  if (!features.speed && !features.stamina) {
    throw new Error(`No horse data found on-chain for tokenId ${tokenId}`);
  }

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

  if ((horseEvent as any).eventType === "BIOMETRIC") {
    const birthTs = fullFeatures.birthTimestamp ?? 0;
    if (birthTs > 0) {
      const ageS = Date.now() / 1000 - birthTs;
      if (ageS < NEWBORN_THRESHOLD_S) {
        throw new Error("Biometric data is not available for horses under 6 months old");
      }
    }
  }

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
    const sentBps = (horseEvent as NewsEvent).news.sentimentBps;
    multiplier = 1 + sentBps / 10000;
    valuationResult = {
      ...basePrediction,
      value: basePrediction.value * multiplier,
      explanation: `News sentiment adjustment: ${sentBps > 0 ? "+" : ""}${sentBps} bps`,
    };
  }

  console.log(`[oracle] tokenId=${tokenId} base=${basePrediction.value.toFixed(2)} adjusted=${valuationResult.value.toFixed(2)} multiplier=${multiplier.toFixed(6)} currentOnChain=${valuationADIRaw}`);

  if (multiplier === 1 && horseEvent.eventType === "RACE_RESULT") {
    const pos = (horseEvent as RaceResultEvent).result.finishPosition;
    multiplier = pos === 1 ? 1.05 : 0.98;
    console.log(`[oracle] multiplier was 1.0 — applying floor: ${multiplier}`);
  }

  const currentVal = valuationADIRaw;
  const multiplierBps = BigInt(Math.round(multiplier * 10000));
  let newValuationADI = (currentVal * multiplierBps) / 10000n;

  if (newValuationADI === 0n && valuationResult.value > 0) {
    const ethScale = 10n ** 18n;
    newValuationADI = BigInt(Math.round(valuationResult.value)) * ethScale;
    console.log(`[oracle] on-chain val was 0 — bootstrapping to ${newValuationADI}`);
  }

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

  const pk = ORACLE_PK.startsWith("0x") ? ORACLE_PK : `0x${ORACLE_PK}`;
  const account = privateKeyToAccount(pk as `0x${string}`);
  const publicClient = createPublicClient({
    chain: og0gChain,
    transport: http(RPC),
  });
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

  let txStatus: "success" | "reverted" | "pending" = "pending";
  try {
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 15_000 });
    txStatus = receipt.status;
    if (receipt.status === "reverted") {
      console.error(`[oracle] commitValuation tx REVERTED: ${txHash}`);
      throw new Error(`Transaction reverted on-chain: ${txHash}`);
    }
    console.log(`[oracle] commitValuation tx confirmed (block ${receipt.blockNumber})`);
  } catch (receiptErr) {
    if ((receiptErr as Error).message?.includes("reverted")) throw receiptErr;
    console.warn(`[oracle] Could not get receipt for ${txHash}: ${(receiptErr as Error).message}`);
  }

  let verifiedValuationADI: string | null = null;
  try {
    const reRead = await fetchHorseFeatures(tokenId);
    verifiedValuationADI = reRead.valuationADIRaw.toString();
    if (reRead.valuationADIRaw !== newValuationADI) {
      console.warn(`[oracle] MISMATCH: expected ${newValuationADI}, on-chain reads ${reRead.valuationADIRaw}`);
    } else {
      console.log(`[oracle] Verified on-chain: ${formatEther(reRead.valuationADIRaw)} ADI`);
    }
  } catch (readErr) {
    console.warn(`[oracle] Re-read failed: ${(readErr as Error).message}`);
  }

  let cascadingResults: ApplyEventResult["cascadingOffspring"] = [];

  const isRaceWin =
    horseEvent.eventType === "RACE_RESULT" &&
    horseEvent.result.finishPosition === 1;

  if (isRaceWin) {
    try {
      const allOffspring = await findOffspring(tokenId);
      console.log(`[oracle] cascade: found ${allOffspring.length} offspring for tokenId=${tokenId}:`, allOffspring.map(o => o.tokenId));

      if (allOffspring.length > 0) {
        const now = Date.now();
        const youngOffspring = allOffspring.filter(
          (o) => o.birthTimestamp > 0 && now - o.birthTimestamp * 1000 < NEWBORN_THRESHOLD_MS,
        );
        const matureOffspring = allOffspring.filter(
          (o) => !youngOffspring.some((y) => y.tokenId === o.tokenId),
        );

        const youngAdjustments = calculateCascadingEffects(
          {
            parentTokenId: tokenId,
            parentSex: (fullFeatures.sex as "male" | "female") ?? "male",
            eventType: "RACE_WIN",
            parentPedigreeScore: fullFeatures.pedigreeScore,
            parentOffspringCount: allOffspring.length,
            raceGrade: (horseEvent as RaceResultEvent).race.raceClass,
          },
          youngOffspring.map((o) => o.tokenId),
        );

        const matureMultiplier = (horseEvent as RaceResultEvent).race.raceClass === "Grade 1" ? 1.03 : 1.01;
        const matureAdjustments = matureOffspring.map((o) => ({
          offspringTokenId: o.tokenId,
          multiplier: matureMultiplier,
          reason:
            (horseEvent as RaceResultEvent).race.raceClass === "Grade 1"
              ? "Sire/Dam G1 winner — lineage boost"
              : "Sire/Dam race winner — lineage boost",
        }));

        const allAdjustments = [...youngAdjustments, ...matureAdjustments];

        for (const adj of allAdjustments) {
          const child = allOffspring.find((o) => o.tokenId === adj.offspringTokenId)!;
          const adjBps = BigInt(Math.round(adj.multiplier * 10000));
          const childNewVal = (child.valuationADIRaw * adjBps) / 10000n;

          const childTx = await walletClient.writeContract({
            address: HORSE_ORACLE,
            abi: oracleAbi,
            functionName: "commitValuation",
            args: [
              BigInt(adj.offspringTokenId),
              EVENT_TYPE_ENUM[horseEvent.eventType] ?? 0,
              eventHash as `0x${string}`,
              childNewVal,
              ogRootHashBytes,
            ],
          });

          cascadingResults!.push({
            offspringTokenId: adj.offspringTokenId,
            multiplier: adj.multiplier,
            reason: adj.reason,
            previousValuationADI: child.valuationADIRaw.toString(),
            newValuationADI: childNewVal.toString(),
            txHash: childTx,
          });
        }
      }
    } catch (e) {
      console.warn("Cascading offspring valuation failed (non-fatal):", (e as Error).message);
    }
  }

  let riskScoreResult: { riskScore: number; minerDamage?: number } | undefined;
  if ((horseEvent as any).eventType === "BIOMETRIC") {
    try {
      const scan = createBiometricScan(tokenId, fullFeatures);
      riskScoreResult = { riskScore: scan.riskScore, minerDamage: scan.minerDamage };

      const riskTxHash = await walletClient.writeContract({
        address: HORSE_ORACLE,
        abi: oracleAbi,
        functionName: "reportRiskScore",
        args: [BigInt(tokenId), scan.riskScore],
      });
      console.log(`[oracle] reportRiskScore(${tokenId}, ${scan.riskScore}) tx: ${riskTxHash}`);

      if (scan.riskScore === 6) {
        console.warn(`[oracle] RISK SCORE 6 for tokenId=${tokenId} — Lazarus Protocol will trigger on-chain`);
      }
    } catch (riskErr) {
      console.warn(`[oracle] Risk score reporting failed (non-fatal):`, (riskErr as Error).message);
    }
  }

  const ibv = valuationResult.breakdown?.ibv ?? null;

  return {
    eventHash,
    newValuationADI: newValuationADI.toString(),
    previousValuationADI: currentVal.toString(),
    verifiedValuationADI,
    ibv,
    txStatus,
    multiplier,
    valuationResult,
    txHash,
    ogRootHash: ogRootHash ?? null,
    ogTxHash: ogTxHash ?? null,
    canonicalJson,
    submittedAt: new Date().toISOString(),
    riskScore: riskScoreResult,
    cascadingOffspring: cascadingResults && cascadingResults.length > 0 ? cascadingResults : undefined,
  };
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

    const result = await applyEventCore(event as HorseEvent, uploadTo0g);
    res.json(result);
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
