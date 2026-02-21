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
const kycAddr = process.env.KYC_REGISTRY ?? process.env.NEXT_PUBLIC_KYC_REGISTRY;

const chain = { id: Number(process.env.CHAIN_ID_0G ?? 16602), name: "0G", nativeCurrency: { decimals: 18, name: "ETH", symbol: "ETH" }, rpcUrls: { default: { http: [RPC] } } } as const;

const abi = {
  MockADI: parseAbi(["function mint(address to, uint256 amount) external", "function balanceOf(address) view returns (uint256)"]),
  HorseINFT: parseAbi([
    "function mint(address to, string calldata encryptedURI, bytes32 metadataHash, (string name, uint64 birthTimestamp, uint256 sireId, uint256 damId, uint8[8] traitVector, uint16 pedigreeScore, uint256 valuationADI, bytes32 dnaHash, bool breedingAvailable, bool injured, bool retired, bool xFactorCarrier, string encryptedURI, bytes32 metadataHash) data) external returns (uint256)",
    "function owner() view returns (address)",
  ]),
  BreedingMarketplace: parseAbi([
    "function list(uint256 stallionId, uint256 studFeeADI, uint256 maxUses, bool useAllowlist) external",
  ]),
  BreedingAdvisorINFT: parseAbi([
    "function mint(address to, (string name, string version, string specialization, string modelBundleRootHash) profile) external returns (uint256)",
  ]),
  KYCRegistry: parseAbi(["function verify(address account) external"]),
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
    xFactorCarrier: false,
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
  const OTHER_OWNER = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8" as `0x${string}`;
  console.log("Owner (deployer):", owner);
  console.log("Other owner (Anvil #1):", OTHER_OWNER);

  // Mint ADI to owner
  await (wallet as any).writeContract({
    address: adiAddr as `0x${string}`,
    abi: abi.MockADI,
    functionName: "mint",
    args: [owner, BigInt(1000000e18)],
  });
  console.log("Minted 1M ADI to owner");

  // 8 horses total: 4 owned by deployer (IDs 0-3), 4 owned by Anvil #1 (IDs 4-7)
  // Stallions: 0, 2, 4, 6 — Mares: 1, 3, 5, 7
  // Names validated with validateHorseName(): ≤18 chars, no digits, not protected
  const horses = [
    { data: encodeHorseData({ name: "Galileos Edge", traits: [85, 92, 78, 88, 95, 80, 90, 85], pedigreeScore: 9400, valuation: BigInt(8000e18), breedingAvailable: true }), to: owner },
    { data: encodeHorseData({ name: "Storm Cat Lady", sireId: 0, traits: [88, 80, 82, 85, 90, 84, 78, 82], pedigreeScore: 8600, valuation: BigInt(4000e18), breedingAvailable: true }), to: owner },
    { data: encodeHorseData({ name: "First Mission Colt", traits: [82, 85, 75, 90, 88, 82, 85, 78], pedigreeScore: 8200, valuation: BigInt(2500e18), breedingAvailable: true }), to: owner },
    { data: encodeHorseData({ name: "Thunder Strike", traits: [90, 88, 75, 92, 85, 88, 82, 86], pedigreeScore: 9100, valuation: BigInt(6000e18), breedingAvailable: true }), to: owner },
    { data: encodeHorseData({ name: "Midnight Runner", traits: [85, 90, 80, 87, 92, 85, 88, 84], pedigreeScore: 8800, valuation: BigInt(4500e18), breedingAvailable: true }), to: OTHER_OWNER },
    { data: encodeHorseData({ name: "Golden Dawn", sireId: 0, damId: 1, traits: [82, 85, 78, 90, 88, 80, 85, 82], pedigreeScore: 8500, valuation: BigInt(3500e18), breedingAvailable: true }), to: OTHER_OWNER },
    { data: encodeHorseData({ name: "Silver Bullet", traits: [88, 82, 72, 85, 90, 86, 80, 78], pedigreeScore: 8700, valuation: BigInt(4200e18), breedingAvailable: true }), to: OTHER_OWNER },
    { data: encodeHorseData({ name: "Ocean Breeze", sireId: 0, damId: 1, traits: [80, 88, 85, 82, 90, 82, 78, 80], pedigreeScore: 8300, valuation: BigInt(2800e18), breedingAvailable: true }), to: OTHER_OWNER },
  ];

  const txHashes: `0x${string}`[] = [];
  for (let i = 0; i < horses.length; i++) {
    const h = horses[i];
    const tx = await (wallet as any).writeContract({
      address: horseAddr as `0x${string}`,
      abi: abi.HorseINFT,
      functionName: "mint",
      args: [h.to, "", h.data.metadataHash, h.data],
    });
    txHashes.push(tx);
  }
  console.log("Minted 8 horses (4 to owner, 4 to other). Tx:", ...txHashes);
  const isLocal = process.env.LOCAL_TESTING === "true" || process.env.RPC_URL?.includes("127.0.0.1");
  const pollMs = isLocal ? 100 : 4000;
  async function waitReceipt(hash: `0x${string}`, label: string) {
    for (let i = 0; i < (isLocal ? 50 : 30); i++) {
      await new Promise((r) => setTimeout(r, pollMs));
      try {
        const r = await publicClient.getTransactionReceipt({ hash });
        if (r) { console.log(`${label} confirmed (block ${r.blockNumber})`); return r; }
      } catch { /* not mined yet */ }
    }
    console.warn(`${label}: gave up waiting, continuing anyway`);
  }
  for (let i = 0; i < txHashes.length; i++) {
    await waitReceipt(txHashes[i], `Horse ${i}`);
  }

  // KYC verify owner (required for purchaseBreedingRight)
  if (kycAddr) {
    const kycTx = await (wallet as any).writeContract({
      address: kycAddr as `0x${string}`,
      abi: abi.KYCRegistry,
      functionName: "verify",
      args: [owner],
    });
    await waitReceipt(kycTx, "KYC verify owner");
  } else {
    console.warn("KYC_REGISTRY not set; breeding may fail with 'KYC required'");
  }

  // List stallions we own (0, 2) for breeding; stallions 4, 6 belong to other wallet
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
  console.log("Listed stallions 0 (500 ADI), 2 (300 ADI)");

  if (agentAddr) {
    try {
      await (wallet as any).writeContract({
        address: agentAddr as `0x${string}`,
        abi: abi.BreedingAdvisorINFT,
        functionName: "mint",
        args: [owner, { name: "Secretariat Breeding Advisor", version: "1.0", specialization: "breeding", modelBundleRootHash: "" }],
      });
      console.log("Minted Breeding Advisor iNFT (token 0) to owner");
    } catch (e) {
      console.warn("Agent iNFT mint skipped:", (e as Error).message);
    }
  }

  console.log("Seed done. 8 horses total: 4 owned by deployer, 4 by Anvil #1.");
}

main().catch((e) => { console.error(e); process.exit(1); });
