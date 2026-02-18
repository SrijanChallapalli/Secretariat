/**
 * Generate synthetic training data by simulating oracle events against deployed contracts.
 * Calls HorseINFT.updateValuation / setInjured directly (owner-only) using the same
 * valuation logic as HorseOracle, then logs the (featuresBefore, event, valuationDelta) tuple.
 *
 * Works with current deployed contracts (no HorseOracle permission needed).
 * When HorseOracle is properly wired (after redeploy), switch to calling oracle directly.
 *
 * Usage: npx tsx scripts/generate-training-data.ts [count]
 *   count: number of events to generate (default 50)
 */
import dotenv from "dotenv";
import { resolve } from "path";
dotenv.config({ path: resolve(process.cwd(), ".env") });

import { createPublicClient, createWalletClient, http, parseAbi } from "viem";
import type { FeatureVector } from "../shared/types.js";
import fs from "fs";
import path from "path";

const RPC = process.env.RPC_0G ?? "https://evmrpc-testnet.0g.ai";
const PK = process.env.DEPLOYER_PRIVATE_KEY!;
const horseAddr = process.env.NEXT_PUBLIC_HORSE_INFT!;

const chain = {
  id: Number(process.env.CHAIN_ID_0G ?? 16602),
  name: "0G",
  nativeCurrency: { decimals: 18, name: "ETH", symbol: "ETH" },
  rpcUrls: { default: { http: [RPC] } },
} as const;

const horseAbi = parseAbi([
  "function getHorseData(uint256) view returns ((string name, uint64 birthTimestamp, uint256 sireId, uint256 damId, uint8[8] traitVector, uint16 pedigreeScore, uint256 valuationADI, bytes32 dnaHash, bool breedingAvailable, bool injured, bool retired, string encryptedURI, bytes32 metadataHash))",
  "function updateValuation(uint256 tokenId, uint256 newVal) external",
  "function setInjured(uint256 tokenId, bool injured) external",
]);

const DATA_DIR = path.resolve(process.cwd(), "server/data");
const JSONL_PATH = path.join(DATA_DIR, "training-events.jsonl");

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

interface TrainingRow {
  timestamp: number;
  blockNumber: number;
  txHash: string;
  tokenId: number;
  eventType: string;
  featuresBefore: Partial<FeatureVector>;
  valuationBefore: number;
  valuationAfter: number;
  eventData: Record<string, unknown>;
}

async function fetchHorse(client: ReturnType<typeof createPublicClient>, tokenId: number) {
  const raw = (await client.readContract({
    address: horseAddr as `0x${string}`,
    abi: horseAbi,
    functionName: "getHorseData",
    args: [BigInt(tokenId)],
  })) as any;

  const traits = (raw.traitVector ?? raw[4] ?? []).map(Number);
  const features: Partial<FeatureVector> = {
    speed: traits[0] ?? 0,
    stamina: traits[1] ?? 0,
    temperament: traits[2] ?? 0,
    conformation: traits[3] ?? 0,
    health: traits[4] ?? 0,
    agility: traits[5] ?? 0,
    raceIQ: traits[6] ?? 0,
    consistency: traits[7] ?? 0,
    pedigreeScore: Number(raw.pedigreeScore ?? raw[5] ?? 0),
    injured: Boolean(raw.injured ?? raw[9]),
    retired: Boolean(raw.retired ?? raw[10]),
    birthTimestamp: Number(raw.birthTimestamp ?? raw[1] ?? 0),
    sireId: Number(raw.sireId ?? raw[2] ?? 0),
    damId: Number(raw.damId ?? raw[3] ?? 0),
  };
  const valuationADI = BigInt(raw.valuationADI ?? raw[6] ?? 0);
  const name = raw.name ?? raw[0] ?? "Unknown";
  return { features, valuationADI, name };
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Mirrors HorseOracle valuation logic:
 *  - Race 1st: +earnings + 10% of current val
 *  - Race 2nd: +earnings + 5%
 *  - Race 3rd: +earnings + 2%
 *  - Race 4th+: +earnings only
 *  - Injury: -(severityBps / 10000) of current val
 *  - News positive: +(sentimentBps / 10000) of current val
 */
function computeNewValuation(
  oldVal: bigint,
  eventType: string,
  data: Record<string, unknown>,
): bigint {
  switch (eventType) {
    case "RaceResultReported": {
      const placing = Number(data.placing ?? 99);
      const earningsWei = BigInt(data.earningsWei?.toString() ?? "0");
      let boost = earningsWei;
      if (placing === 1) boost += oldVal / 10n;
      else if (placing === 2) boost += oldVal / 20n;
      else if (placing === 3) boost += oldVal / 50n;
      return oldVal + boost;
    }
    case "InjuryReported": {
      const sev = BigInt(data.severityBps?.toString() ?? "0");
      return (oldVal * (10000n - sev)) / 10000n;
    }
    case "NewsReported": {
      const sent = BigInt(data.sentimentBps?.toString() ?? "0");
      const positive = Boolean(data.positive ?? true);
      if (positive) return (oldVal * (10000n + sent)) / 10000n;
      const newVal = (oldVal * (10000n - sent)) / 10000n;
      return newVal > 0n ? newVal : 0n;
    }
    default:
      return oldVal;
  }
}

async function waitForTx(
  client: ReturnType<typeof createPublicClient>,
  hash: `0x${string}`,
) {
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    try {
      const receipt = await client.getTransactionReceipt({ hash });
      if (receipt) return receipt;
    } catch {
      /* not mined yet */
    }
  }
  throw new Error(`Tx ${hash} not confirmed after 40s`);
}

async function main() {
  const count = Number(process.argv[2] ?? 50);
  if (!PK || !horseAddr) {
    console.error("Set DEPLOYER_PRIVATE_KEY and NEXT_PUBLIC_HORSE_INFT in .env");
    process.exit(1);
  }

  const transport = http(RPC);
  const publicClient = createPublicClient({ chain, transport });
  const { privateKeyToAccount } = await import("viem/accounts");
  const account = privateKeyToAccount(`0x${PK.replace(/^0x/, "")}` as `0x${string}`);
  const wallet = createWalletClient({ account, chain, transport });

  const tokenIds = [0, 1, 2];

  // Distribution weights — more realistic race results than injuries
  const eventWeights: [string, number][] = [
    ["race_1st", 15],
    ["race_2nd", 15],
    ["race_3rd", 15],
    ["race_4th_plus", 15],
    ["injury_minor", 10],
    ["injury_major", 5],
    ["news_positive", 15],
    ["news_negative", 10],
  ];
  const totalWeight = eventWeights.reduce((s, [, w]) => s + w, 0);
  function pickWeighted(): string {
    let r = Math.random() * totalWeight;
    for (const [ev, w] of eventWeights) {
      r -= w;
      if (r <= 0) return ev;
    }
    return eventWeights[0][0];
  }

  ensureDataDir();
  let generated = 0;
  let errors = 0;

  console.log(`Generating ${count} training events for tokens [${tokenIds}] on ${RPC}`);
  console.log(`Output: ${JSONL_PATH}\n`);

  for (let i = 0; i < count; i++) {
    const tokenId = pick(tokenIds);
    const evType = pickWeighted();

    try {
      const { features: featuresBefore, valuationADI: valBefore, name: horseName } =
        await fetchHorse(publicClient, tokenId);

      let eventType: string;
      let eventData: Record<string, unknown>;
      let newVal: bigint;

      switch (evType) {
        case "race_1st":
        case "race_2nd":
        case "race_3rd":
        case "race_4th_plus": {
          const placingMap: Record<string, number> = {
            race_1st: 1, race_2nd: 2, race_3rd: 3, race_4th_plus: 0,
          };
          const placing = placingMap[evType] || pick([4, 5, 6, 7, 8]);
          const earningsADI = randInt(20, 500);
          const earningsWei = BigInt(earningsADI) * BigInt(1e18);
          eventType = "RaceResultReported";
          eventData = { tokenId, placing, earningsADI, earningsWei: earningsWei.toString() };
          newVal = computeNewValuation(valBefore, eventType, eventData);
          break;
        }
        case "injury_minor": {
          const severity = randInt(200, 1000); // 2-10%
          eventType = "InjuryReported";
          eventData = { tokenId, severityBps: severity };
          newVal = computeNewValuation(valBefore, eventType, eventData);
          break;
        }
        case "injury_major": {
          const severity = randInt(1500, 4000); // 15-40%
          eventType = "InjuryReported";
          eventData = { tokenId, severityBps: severity };
          newVal = computeNewValuation(valBefore, eventType, eventData);
          break;
        }
        case "news_positive": {
          const sentiment = randInt(100, 800); // 1-8%
          eventType = "NewsReported";
          eventData = { tokenId, sentimentBps: sentiment, positive: true };
          newVal = computeNewValuation(valBefore, eventType, eventData);
          break;
        }
        case "news_negative": {
          const sentiment = randInt(100, 500); // 1-5%
          eventType = "NewsReported";
          eventData = { tokenId, sentimentBps: sentiment, positive: false };
          newVal = computeNewValuation(valBefore, eventType, { ...eventData, positive: false });
          break;
        }
        default:
          continue;
      }

      // Write valuation change on-chain
      const txHash = await (wallet as any).writeContract({
        address: horseAddr as `0x${string}`,
        abi: horseAbi,
        functionName: "updateValuation",
        args: [BigInt(tokenId), newVal],
      });

      await waitForTx(publicClient, txHash);

      // If injury, also set injured flag on-chain
      if (eventType === "InjuryReported") {
        const injTx = await (wallet as any).writeContract({
          address: horseAddr as `0x${string}`,
          abi: horseAbi,
          functionName: "setInjured",
          args: [BigInt(tokenId), true],
        });
        await waitForTx(publicClient, injTx).catch(() => {});
      }

      const row: TrainingRow = {
        timestamp: Date.now(),
        blockNumber: 0,
        txHash,
        tokenId,
        eventType,
        featuresBefore,
        valuationBefore: Number(valBefore),
        valuationAfter: Number(newVal),
        eventData: Object.fromEntries(
          Object.entries(eventData).map(([k, v]) => [k, typeof v === "bigint" ? Number(v) : v]),
        ),
      };

      fs.appendFileSync(JSONL_PATH, JSON.stringify(row) + "\n");
      generated++;

      const bef = (Number(valBefore) / 1e18).toFixed(0);
      const aft = (Number(newVal) / 1e18).toFixed(0);
      const delta = Number(newVal) > Number(valBefore) ? "+" : "";
      const pct = Number(valBefore) > 0
        ? `${delta}${(((Number(newVal) - Number(valBefore)) / Number(valBefore)) * 100).toFixed(1)}%`
        : "N/A";
      console.log(
        `[${generated}/${count}] ${eventType.padEnd(20)} #${tokenId} ${horseName.padEnd(14)} ${bef} → ${aft} ADI (${pct})`,
      );
    } catch (e) {
      errors++;
      const msg = (e as Error).message?.slice(0, 100) ?? String(e);
      console.warn(`[${i + 1}/${count}] ERROR (${evType} #${tokenId}): ${msg}`);
      if (msg.includes("insufficient funds")) {
        console.error("\nOut of testnet ETH. Fund deployer and re-run.");
        break;
      }
    }
  }

  console.log(`\nDone. Generated: ${generated}, Errors: ${errors}`);
  const totalRows = fs.existsSync(JSONL_PATH)
    ? fs.readFileSync(JSONL_PATH, "utf-8").trim().split("\n").filter(Boolean).length
    : 0;
  console.log(`Total training rows: ${totalRows}`);
  console.log(`File: ${JSONL_PATH}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
