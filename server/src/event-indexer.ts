import { createPublicClient, http, parseAbiItem, type Log } from "viem";
import type { TrainingEvent } from "../../shared/types.js";
import fs from "fs";
import path from "path";

const DATA_DIR = path.resolve(process.cwd(), "server/data");
const JSONL_PATH = path.join(DATA_DIR, "training-events.jsonl");

const RPC = process.env.RPC_0G || "https://evmrpc-testnet.0g.ai";
const HORSE_INFT = process.env.NEXT_PUBLIC_HORSE_INFT;
const HORSE_ORACLE = process.env.NEXT_PUBLIC_HORSE_ORACLE;

const chain = {
  id: Number(process.env.CHAIN_ID_0G ?? 16602),
  name: "0G",
  nativeCurrency: { decimals: 18, name: "ETH", symbol: "ETH" },
  rpcUrls: { default: { http: [RPC] } },
} as const;

const oracleEvents = [
  parseAbiItem("event RaceResultReported(uint256 indexed tokenId, uint8 placing, uint256 earningsADI)"),
  parseAbiItem("event InjuryReported(uint256 indexed tokenId, uint16 severityBps)"),
  parseAbiItem("event NewsReported(uint256 indexed tokenId, uint16 sentimentBps)"),
];

const inftEvents = [
  parseAbiItem("event ValuationUpdated(uint256 indexed tokenId, uint256 newValue)"),
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

function eventLogToTrainingEvent(
  log: Log,
  eventType: string,
  eventData: Record<string, unknown>,
): TrainingEvent {
  return {
    timestamp: Date.now(),
    blockNumber: Number(log.blockNumber ?? 0),
    txHash: log.transactionHash ?? "0x",
    tokenId: Number((eventData.tokenId as bigint) ?? 0),
    eventType,
    featuresBefore: {},
    valuationBefore: 0,
    valuationAfter: 0,
    eventData,
  };
}

export function startIndexer(): void {
  try {
    if (!HORSE_ORACLE && !HORSE_INFT) {
      console.warn("Event indexer: no contract addresses configured, skipping");
      return;
    }

    const client = createPublicClient({ chain, transport: http(RPC) });

    if (HORSE_ORACLE && HORSE_ORACLE !== "0x0000000000000000000000000000000000000000") {
      for (const event of oracleEvents) {
        client.watchEvent({
          address: HORSE_ORACLE as `0x${string}`,
          event,
          onLogs: (logs) => {
            for (const log of logs) {
              try {
                const args = (log as any).args ?? {};
                const eventType = event.name;
                const data: Record<string, unknown> = {};
                for (const [k, v] of Object.entries(args)) {
                  data[k] = typeof v === "bigint" ? Number(v) : v;
                }
                const te = eventLogToTrainingEvent(log, eventType, data);
                appendEvent(te);
                console.log(`Indexed ${eventType} for token ${te.tokenId}`);
              } catch (e) {
                console.warn("Event indexer error (oracle):", e);
              }
            }
          },
          onError: (err) => {
            console.warn("Event indexer oracle watch error:", err.message);
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
              try {
                const args = (log as any).args ?? {};
                const data: Record<string, unknown> = {};
                for (const [k, v] of Object.entries(args)) {
                  data[k] = typeof v === "bigint" ? Number(v) : v;
                }
                const te = eventLogToTrainingEvent(log, event.name, data);
                appendEvent(te);
                console.log(`Indexed ${event.name} for token ${te.tokenId}`);
              } catch (e) {
                console.warn("Event indexer error (inft):", e);
              }
            }
          },
          onError: (err) => {
            console.warn("Event indexer inft watch error:", err.message);
          },
        });
      }
    }

    console.log("Event indexer started");
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
