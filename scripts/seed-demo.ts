/**
 * Seed demo data: mint horses, list breeding rights, mint ADI to owner/buyer.
 * Loads .env from repo root. Set DEPLOYER_PRIVATE_KEY and contract addresses (from deploy or .env).
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
const agentAddr = process.env.AGENT_INFT ?? process.env.NEXT_PUBLIC_AGENT_INFT!;

const chain = { id: Number(process.env.CHAIN_ID_0G ?? 16602), name: "0G", nativeCurrency: { decimals: 18, name: "ETH", symbol: "ETH" }, rpcUrls: { default: { http: [RPC] } } } as const;

const abi = {
  MockADI: parseAbi(["function mint(address to, uint256 amount) external", "function balanceOf(address) view returns (uint256)"]),
  HorseINFT: parseAbi([
    "function mint(address to, string calldata encryptedURI, bytes32 metadataHash, (string name, uint64 birthTimestamp, uint256 sireId, uint256 damId, uint8[8] traitVector, uint16 pedigreeScore, uint256 valuationADI, bytes32 dnaHash, bool breedingAvailable, bool injured, bool retired, string encryptedURI, bytes32 metadataHash) data) external returns (uint256)",
    "function owner() view returns (address)",
  ]),
  BreedingMarketplace: parseAbi([
    "function list(uint256 stallionId, uint256 studFeeADI, uint256 maxUses, bool useAllowlist) external",
  ]),
  BreedingAdvisorINFT: parseAbi([
    "function mint(address to, (string name, string version, string specialization, string modelBundleRootHash) profile) external returns (uint256)",
  ]),
};

function encodeHorseData(opts: {
  name: string;
  sireId?: number;
  damId?: number;
  traits?: number[];
  pedigreeScore?: number;
  valuation?: bigint;
  breedingAvailable?: boolean;
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
    breedingAvailable: opts.breedingAvailable ?? true,
    injured: false,
    retired: false,
    encryptedURI: "",
    metadataHash: `0x${"00".repeat(32)}` as `0x${string}`,
  };
}

async function main() {
  if (!PK || !adiAddr || !horseAddr || !marketAddr) {
    console.error("Set DEPLOYER_PRIVATE_KEY, ADI_TOKEN, HORSE_INFT, BREEDING_MARKETPLACE (or NEXT_PUBLIC_*)");
    process.exit(1);
  }
  const transport = http(RPC);
  const publicClient = createPublicClient({ chain, transport });
  const account = (await import("viem/accounts")).privateKeyToAccount(`0x${PK.replace(/^0x/, "")}` as `0x${string}`);
  const wallet = createWalletClient({ account, chain, transport });

  const owner = account.address;
  console.log("Owner (deployer):", owner);

  // Mint ADI to owner
  await (wallet as any).writeContract({
    address: adiAddr as `0x${string}`,
    abi: abi.MockADI,
    functionName: "mint",
    args: [owner, BigInt(1000000e18)],
  });
  console.log("Minted 1M ADI to owner");

  // Mint 3 horses: 0 stallion, 1 mare, 2 another stallion
  const h0 = encodeHorseData({ name: "Thunder Strike", traits: [90, 82, 70, 88, 95, 80, 85, 82], pedigreeScore: 9200, valuation: BigInt(5000e18), breedingAvailable: true });
  const h1 = encodeHorseData({ name: "Silver Mare", sireId: 0, traits: [78, 88, 75, 80, 85, 76, 72, 80], pedigreeScore: 8200, breedingAvailable: true });
  const h2 = encodeHorseData({ name: "Dark Legend", traits: [85, 78, 72, 90, 88, 84, 88, 76], pedigreeScore: 8800, valuation: BigInt(3500e18), breedingAvailable: true });

  const tx0 = await (wallet as any).writeContract({
    address: horseAddr as `0x${string}`,
    abi: abi.HorseINFT,
    functionName: "mint",
    args: [owner, "", h0.metadataHash, h0],
  });
  const tx1 = await (wallet as any).writeContract({
    address: horseAddr as `0x${string}`,
    abi: abi.HorseINFT,
    functionName: "mint",
    args: [owner, "", h1.metadataHash, h1],
  });
  const tx2 = await (wallet as any).writeContract({
    address: horseAddr as `0x${string}`,
    abi: abi.HorseINFT,
    functionName: "mint",
    args: [owner, "", h2.metadataHash, h2],
  });
  console.log("Minted horses 0, 1, 2. Tx:", tx0, tx1, tx2);

  // List stallions 0 and 2 for breeding
  await (wallet as any).writeContract({
    address: marketAddr as `0x${string}`,
    abi: abi.BreedingMarketplace,
    functionName: "list",
    args: [0n, BigInt(500e18), 10, false],
  });
  await (wallet as any).writeContract({
    address: marketAddr as `0x${string}`,
    abi: abi.BreedingMarketplace,
    functionName: "list",
    args: [2n, BigInt(300e18), 5, false],
  });
  console.log("Listed stallions 0 (500 ADI) and 2 (300 ADI)");

  if (agentAddr) {
    await (wallet as any).writeContract({
      address: agentAddr as `0x${string}`,
      abi: abi.BreedingAdvisorINFT,
      functionName: "mint",
      args: [owner, { name: "Secretariat Breeding Advisor", version: "1.0", specialization: "breeding", modelBundleRootHash: "" }],
    });
    console.log("Minted Breeding Advisor iNFT to owner");
  }

  console.log("Seed done. Owner can list/sell; use second wallet as Buyer to purchase breeding rights and breed.");
}

main().catch((e) => { console.error(e); process.exit(1); });
