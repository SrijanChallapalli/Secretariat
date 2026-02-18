import { createPublicClient, http, parseAbi, parseAbiItem, type Log } from "viem";
import type { TrainingEvent, FeatureVector } from "../../shared/types.js";
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

const horseINFTAbi = parseAbi([
  "function getHorseData(uint256) view returns ((string name, uint64 birthTimestamp, uint256 sireId, uint256 damId, uint8[8] traitVector, uint16 pedigreeScore, uint256 valuationADI, bytes32 dnaHash, bool breedingAvailable, bool injured, bool retired, string encryptedURI, bytes32 metadataHash))",
]);

const oracleEvents = [
  parseAbiItem("event RaceResultReported(uint256 indexed tokenId, uint8 placing, uint256 earningsADI)"),
  parseAbiItem("event InjuryReported(uint256 indexed tokenId, uint16 severityBps)"),
  parseAbiItem("event NewsReported(uint256 indexed tokenId, uint16 sentimentBps)"),
];

const inftEvents = [
  parseAbiItem("event ValuationUpdated(uint256 indexed tokenId, uint256 oldVal, uint256 newVal)"),
];

let indexerClient: ReturnType<typeof createPublicClient> | null = null;

function getClient() {
  if (!indexerClient) {
    indexerClient = createPublicClient({ chain, transport: http(RPC) });
  }
  return indexerClient;
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function appendEvent(event: TrainingEvent) {
  ensureDataDir();
  fs.appendFileSync(JSONL_PATH, JSON.stringify(event) + "\n");
}

async function fetchHorseFeatures(tokenId: number): Promise<{ features: Partial<FeatureVector>; valuationADI: number }> {
  if (!HORSE_INFT || HORSE_INFT === "0x0000000000000000000000000000000000000000") {
    return { features: {}, valuationADI: 0 };
  }
  try {
    const client = getClient();
    const raw = await client.readContract({
      address: HORSE_INFT as `0x${string}`,
      abi: horseINFTAbi,
      functionName: "getHorseData",
      args: [BigInt(tokenId)],
    });

    const r = raw as any;
    const traits: number[] = (r.traitVector ?? r[4] ?? []).map(Number);

    const features: Partial<FeatureVector> = {
      speed: traits[0] ?? 0,
      stamina: traits[1] ?? 0,
      temperament: traits[2] ?? 0,
      conformation: traits[3] ?? 0,
      health: traits[4] ?? 0,
      agility: traits[5] ?? 0,
      raceIQ: traits[6] ?? 0,
      consistency: traits[7] ?? 0,
      pedigreeScore: Number(r.pedigreeScore ?? r[5] ?? 0),
      injured: Boolean(r.injured ?? r[9]),
      retired: Boolean(r.retired ?? r[10]),
      birthTimestamp: Number(r.birthTimestamp ?? r[1] ?? 0),
      sireId: Number(r.sireId ?? r[2] ?? 0),
      damId: Number(r.damId ?? r[3] ?? 0),
    };

    const valuationADI = Number(r.valuationADI ?? r[6] ?? 0);
    return { features, valuationADI };
  } catch (e) {
    console.warn(`Event indexer: failed to fetch HorseData for token ${tokenId}:`, (e as Error).message);
    return { features: {}, valuationADI: 0 };
  }
}

async function buildTrainingEvent(
  log: Log,
  eventType: string,
  eventData: Record<string, unknown>,
): Promise<TrainingEvent> {
  const tokenId = Number((eventData.tokenId as number) ?? 0);
  const { features, valuationADI } = await fetchHorseFeatures(tokenId);

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

    const client = getClient();

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
