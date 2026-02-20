/**
 * Minimal seed: 2 horses (1 stallion, 1 mare), 1 list, ADI mint.
 * ~4 txs total to save testnet credits.
 */
import dotenv from "dotenv";
import { resolve } from "path";
dotenv.config({ path: resolve(process.cwd(), ".env") });

import { createPublicClient, createWalletClient, http, parseAbi } from "viem";

const RPC = process.env.RPC_URL ?? process.env.RPC_0G ?? "https://evmrpc-testnet.0g.ai";
const PK = process.env.DEPLOYER_PRIVATE_KEY!;
const adiAddr = process.env.ADI_TOKEN ?? process.env.NEXT_PUBLIC_ADI_TOKEN!;
const horseAddr = process.env.HORSE_INFT ?? process.env.NEXT_PUBLIC_HORSE_INFT!;
const marketAddr = process.env.BREEDING_MARKETPLACE ?? process.env.NEXT_PUBLIC_BREEDING_MARKETPLACE!;
const kycAddr = process.env.KYC_REGISTRY ?? process.env.NEXT_PUBLIC_KYC_REGISTRY;

const chain = {
  id: Number(process.env.CHAIN_ID_0G ?? 16602),
  name: "0G",
  nativeCurrency: { decimals: 18, name: "ETH", symbol: "ETH" },
  rpcUrls: { default: { http: [RPC] } },
} as const;

const abi = {
  MockADI: parseAbi([
    "function mint(address to, uint256 amount) external",
    "function balanceOf(address) view returns (uint256)",
  ]),
  HorseINFT: parseAbi([
    "function mint(address to, string calldata encryptedURI, bytes32 metadataHash, (string name, uint64 birthTimestamp, uint256 sireId, uint256 damId, uint8[8] traitVector, uint16 pedigreeScore, uint256 valuationADI, bytes32 dnaHash, bool breedingAvailable, bool injured, bool retired, bool xFactorCarrier, string encryptedURI, bytes32 metadataHash) data) external returns (uint256)",
  ]),
  BreedingMarketplace: parseAbi([
    "function list(uint256 stallionId, uint256 studFeeADI, uint256 maxUses, bool useAllowlist) external",
  ]),
  KYCRegistry: parseAbi(["function verify(address account) external"]),
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

async function main() {
  if (!PK || !adiAddr || !horseAddr || !marketAddr) {
    console.error("Set DEPLOYER_PRIVATE_KEY, ADI_TOKEN, HORSE_INFT, BREEDING_MARKETPLACE");
    process.exit(1);
  }

  const transport = http(RPC);
  const publicClient = createPublicClient({ chain, transport });
  const account = (await import("viem/accounts")).privateKeyToAccount(
    `0x${PK.replace(/^0x/, "")}` as `0x${string}`
  );
  const wallet = createWalletClient({ account, chain, transport });
  const owner = account.address;

  console.log("Minimal seed (4 txs). Owner:", owner);

  // 1. Mint ADI (smaller amount)
  const adiTx = await (wallet as any).writeContract({
    address: adiAddr as `0x${string}`,
    abi: abi.MockADI,
    functionName: "mint",
    args: [owner, BigInt(100000e18)],
  });
  console.log("Tx1 ADI mint:", adiTx);

  // 2. Mint stallion (token 0)
  const h0 = encodeHorse({
    name: "Galileos Edge",
    traits: [85, 92, 78, 88, 95, 80, 90, 85],
    pedigreeScore: 9400,
    valuation: BigInt(5000e18),
  });
  const tx0 = await (wallet as any).writeContract({
    address: horseAddr as `0x${string}`,
    abi: abi.HorseINFT,
    functionName: "mint",
    args: [owner, "", h0.metadataHash, h0],
  });
  console.log("Tx2 Horse 0 (stallion):", tx0);

  // 3. Mint mare (token 1)
  const h1 = encodeHorse({
    name: "Storm Cat Lady",
    sireId: 0,
    traits: [88, 80, 82, 85, 90, 84, 78, 82],
    pedigreeScore: 8600,
    valuation: BigInt(3000e18),
  });
  const tx1 = await (wallet as any).writeContract({
    address: horseAddr as `0x${string}`,
    abi: abi.HorseINFT,
    functionName: "mint",
    args: [owner, "", h1.metadataHash, h1],
  });
  console.log("Tx3 Horse 1 (mare):", tx1);

  const isLocal = process.env.LOCAL_TESTING === "true" || RPC.includes("127.0.0.1");
  const pollMs = isLocal ? 100 : 3000;
  async function wait(hash: `0x${string}`): Promise<void> {
    for (let i = 0; i < (isLocal ? 50 : 20); i++) {
      await new Promise((r) => setTimeout(r, pollMs));
      try {
        const r = await publicClient.getTransactionReceipt({ hash });
        if (r) return;
      } catch {}
    }
  }
  await wait(adiTx);
  await wait(tx0);
  await wait(tx1);

  // 3b. KYC verify owner (required for purchaseBreedingRight)
  if (kycAddr) {
    const kycTx = await (wallet as any).writeContract({
      address: kycAddr as `0x${string}`,
      abi: abi.KYCRegistry,
      functionName: "verify",
      args: [owner],
    });
    console.log("Tx3b KYC verify owner:", kycTx);
    await wait(kycTx);
  } else {
    console.warn("KYC_REGISTRY not set; breeding may fail with 'KYC required'");
  }

  // 4. List stallion 0
  const listTx = await (wallet as any).writeContract({
    address: marketAddr as `0x${string}`,
    abi: abi.BreedingMarketplace,
    functionName: "list",
    args: [0n, BigInt(400e18), 5, false],
  });
  console.log("Tx4 List stallion 0 (400 ADI):", listTx);

  console.log("\nDone. 2 horses (0=stallion, 1=mare), stallion listed. Visit /breed to use.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
