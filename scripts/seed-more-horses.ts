/**
 * Mint 5 more horses for testing. Run after seed-demo or seed-minimal.
 * Uses same .env. Requires Anvil running.
 */
import dotenv from "dotenv";
import { resolve } from "path";
dotenv.config({ path: resolve(process.cwd(), ".env") });

import { createPublicClient, createWalletClient, http, parseAbi } from "viem";

const RPC = process.env.RPC_URL ?? process.env.RPC_0G ?? "https://evmrpc-testnet.0g.ai";
const PK = process.env.DEPLOYER_PRIVATE_KEY!;
const horseAddr = process.env.HORSE_INFT ?? process.env.NEXT_PUBLIC_HORSE_INFT!;

const chain = {
  id: Number(process.env.CHAIN_ID_0G ?? 16602),
  name: "0G",
  nativeCurrency: { decimals: 18, name: "ETH", symbol: "ETH" },
  rpcUrls: { default: { http: [RPC] } },
} as const;

const abi = {
  HorseINFT: parseAbi([
    "function mint(address to, string calldata encryptedURI, bytes32 metadataHash, (string name, uint64 birthTimestamp, uint256 sireId, uint256 damId, uint8[8] traitVector, uint16 pedigreeScore, uint256 valuationADI, bytes32 dnaHash, bool breedingAvailable, bool injured, bool retired, bool xFactorCarrier, string encryptedURI, bytes32 metadataHash) data) external returns (uint256)",
  ]),
};

function encodeHorse(opts: {
  name: string;
  sireId?: number;
  damId?: number;
  traits?: number[];
  pedigreeScore?: number;
  valuation?: bigint;
}) {
  const traits = opts.traits ?? [80, 75, 70, 85, 90, 72, 78, 74];
  return {
    name: opts.name,
    birthTimestamp: BigInt(Math.floor(Date.now() / 1000) - 86400 * 365 * 2),
    sireId: BigInt(opts.sireId ?? 0),
    damId: BigInt(opts.damId ?? 0),
    traitVector: traits as [number, number, number, number, number, number, number, number],
    pedigreeScore: opts.pedigreeScore ?? 8500,
    valuationADI: opts.valuation ?? BigInt(1000e18),
    dnaHash: `0x${"00".repeat(32)}` as `0x${string}`,
    breedingAvailable: true,
    injured: false,
    retired: false,
    xFactorCarrier: false,
    encryptedURI: "",
    metadataHash: `0x${"00".repeat(32)}` as `0x${string}`,
  };
}

const EXTRA_HORSES = [
  { name: "Thunder Strike", traits: [90, 88, 75, 92, 85, 88, 82, 86], pedigreeScore: 9100, valuation: BigInt(6000e18) },
  { name: "Midnight Runner", traits: [85, 90, 80, 87, 92, 85, 88, 84], pedigreeScore: 8800, valuation: BigInt(4500e18) },
  { name: "Golden Dawn", sireId: 0, damId: 1, traits: [82, 85, 78, 90, 88, 80, 85, 82], pedigreeScore: 8500, valuation: BigInt(3500e18) },
  { name: "Silver Bullet", traits: [88, 82, 72, 85, 90, 86, 80, 78], pedigreeScore: 8700, valuation: BigInt(4200e18) },
  { name: "Ocean Breeze", sireId: 0, damId: 1, traits: [80, 88, 85, 82, 90, 82, 78, 80], pedigreeScore: 8300, valuation: BigInt(2800e18) },
];

async function main() {
  if (!PK || !horseAddr) {
    console.error("Set DEPLOYER_PRIVATE_KEY, HORSE_INFT");
    process.exit(1);
  }

  const transport = http(RPC);
  const publicClient = createPublicClient({ chain, transport });
  const account = (await import("viem/accounts")).privateKeyToAccount(
    `0x${PK.replace(/^0x/, "")}` as `0x${string}`
  );
  const wallet = createWalletClient({ account, chain, transport });
  const owner = account.address;

  const isLocal = process.env.LOCAL_TESTING === "true" || RPC.includes("127.0.0.1");
  const pollMs = isLocal ? 100 : 3000;

  console.log("Minting 5 more horses to", owner);

  for (const h of EXTRA_HORSES) {
    const data = encodeHorse(h);
    const tx = await (wallet as any).writeContract({
      address: horseAddr as `0x${string}`,
      abi: abi.HorseINFT,
      functionName: "mint",
      args: [owner, "", data.metadataHash, data],
    });
    for (let i = 0; i < (isLocal ? 50 : 20); i++) {
      await new Promise((r) => setTimeout(r, pollMs));
      try {
        const r = await publicClient.getTransactionReceipt({ hash: tx });
        if (r) {
          console.log(`  Minted "${h.name}"`);
          break;
        }
      } catch {}
    }
  }

  console.log("\nDone. 5 more horses minted. Refresh the app to see them.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
