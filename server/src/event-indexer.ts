import { parseAbiItem, type Log } from "viem";
import type { TrainingEvent } from "../../shared/types.js";
import { getPublicClient, fetchHorseFeatures } from "./chain-reader.js";
import fs from "fs";
import path from "path";

const DATA_DIR = path.resolve(process.cwd(), "server/data");
const JSONL_PATH = path.join(DATA_DIR, "training-events.jsonl");

const HORSE_INFT = process.env.NEXT_PUBLIC_HORSE_INFT;
const HORSE_ORACLE = process.env.NEXT_PUBLIC_HORSE_ORACLE;

const oracleEvents = [
  parseAbiItem("event RaceResultReported(uint256 indexed tokenId, uint8 placing, uint256 earningsADI)"),
  parseAbiItem("event InjuryReported(uint256 indexed tokenId, uint16 severityBps)"),
  parseAbiItem("event NewsReported(uint256 indexed tokenId, uint16 sentimentBps)"),
];

const pipelineEvents = [
  parseAbiItem("event ValuationCommitted(uint256 indexed tokenId, uint8 indexed eventType, bytes32 indexed eventHash, uint256 newValuationADI, bytes32 ogRootHash)"),
];

const inftEvents = [
  parseAbiItem("event ValuationUpdated(uint256 indexed tokenId, uint256 oldVal, uint256 newVal)"),
];

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function appendEvent(event: TrainingEvent) {
  ensureDataDir();
  fs.appendFileSync(JSONL_PATH, JSON.stringify(event) + "\n");
}

async function buildTrainingEvent(
  log: Log,
  eventType: string,
  eventData: Record<string, unknown>,
): Promise<TrainingEvent> {
  const tokenId = Number((eventData.tokenId as number) ?? 0);
  let features = {};
  let valuationADI = 0;
  try {
    const result = await fetchHorseFeatures(tokenId);
    features = result.features;
    valuationADI = result.valuationADI;
  } catch (e) {
    console.warn(`Event indexer: failed to fetch HorseData for token ${tokenId}:`, (e as Error).message);
  }

  let valuationBefore = valuationADI;
  let valuationAfter = valuationADI;

  if (eventType === "ValuationUpdated") {
    valuationBefore = Number(eventData.oldVal ?? 0);
    valuationAfter = Number(eventData.newVal ?? 0);
  }

  return {
    timestamp: Date.now(),
    blockNumber: Number(log.blockNumber ?? 0),
    txHash: log.transactionHash ?? "0x",
    tokenId,
    eventType,
    featuresBefore: features,
    valuationBefore,
    valuationAfter,
    eventData,
  };
}

export function startIndexer(): void {
  try {
    if (!HORSE_ORACLE && !HORSE_INFT) {
      console.warn("Event indexer: no contract addresses configured, skipping");
      return;
    }

    const client = getPublicClient();

    if (HORSE_ORACLE && HORSE_ORACLE !== "0x0000000000000000000000000000000000000000") {
      for (const event of oracleEvents) {
        client.watchEvent({
          address: HORSE_ORACLE as `0x${string}`,
          event,
          onLogs: (logs) => {
            for (const log of logs) {
              (async () => {
                try {
                  const args = (log as any).args ?? {};
                  const data: Record<string, unknown> = {};
                  for (const [k, v] of Object.entries(args)) {
                    data[k] = typeof v === "bigint" ? Number(v) : v;
                  }
                  const te = await buildTrainingEvent(log, event.name, data);
                  appendEvent(te);
                  console.log(`Indexed ${event.name} for token ${te.tokenId} (val: ${te.valuationBefore})`);
                } catch (e) {
                  console.warn("Event indexer error (oracle):", e);
                }
              })();
            }
          },
          onError: (err) => {
            console.warn("Event indexer oracle watch error:", err.message);
          },
        });
      }

      // Pipeline-committed valuations
      for (const event of pipelineEvents) {
        client.watchEvent({
          address: HORSE_ORACLE as `0x${string}`,
          event,
          onLogs: (logs) => {
            for (const log of logs) {
              (async () => {
                try {
                  const args = (log as any).args ?? {};
                  const data: Record<string, unknown> = {};
                  for (const [k, v] of Object.entries(args)) {
                    data[k] = typeof v === "bigint" ? Number(v) : v;
                  }
                  const te = await buildTrainingEvent(log, event.name, data);
                  appendEvent(te);
                  console.log(`Indexed ${event.name} for token ${te.tokenId} (newVal: ${data.newValuationADI})`);
                } catch (e) {
                  console.warn("Event indexer error (pipeline):", e);
                }
              })();
            }
          },
          onError: (err) => {
            console.warn("Event indexer pipeline watch error:", err.message);
          },
        });
      }
    }

    if (HORSE_INFT && HORSE_INFT !== "0x0000000000000000000000000000000000000000") {
      for (const event of inftEvents) {
        client.watchEvent({
          address: HORSE_INFT as `0x${string}`,
          event,
          onLogs: (logs) => {
            for (const log of logs) {
              (async () => {
                try {
                  const args = (log as any).args ?? {};
                  const data: Record<string, unknown> = {};
                  for (const [k, v] of Object.entries(args)) {
                    data[k] = typeof v === "bigint" ? Number(v) : v;
                  }
                  const te = await buildTrainingEvent(log, event.name, data);
                  appendEvent(te);
                  console.log(`Indexed ${event.name} for token ${te.tokenId} (${te.valuationBefore} → ${te.valuationAfter})`);
                } catch (e) {
                  console.warn("Event indexer error (inft):", e);
                }
              })();
            }
          },
          onError: (err) => {
            console.warn("Event indexer inft watch error:", err.message);
          },
        });
      }
    }

    console.log("Event indexer started (fetches full HorseData per event)");
  } catch (e) {
    console.warn("Event indexer failed to start:", e);
  }
}

export function getTrainingData(): TrainingEvent[] {
  ensureDataDir();
  if (!fs.existsSync(JSONL_PATH)) return [];
  const lines = fs.readFileSync(JSONL_PATH, "utf-8").trim().split("\n").filter(Boolean);
  return lines.map((line) => JSON.parse(line) as TrainingEvent);
}
