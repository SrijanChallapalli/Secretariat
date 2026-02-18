/**
 * Verify on-chain reads: horse 0, listing 0, ADI balance, agent profile.
 * Run from repo root: tsx scripts/verify-reads.ts
 */
import dotenv from "dotenv";
import { resolve } from "path";
dotenv.config({ path: resolve(process.cwd(), ".env") });

import { createPublicClient, http, parseAbi } from "viem";

const RPC = process.env.RPC_0G ?? "https://evmrpc-testnet.0g.ai";
const horseAddr = process.env.NEXT_PUBLIC_HORSE_INFT!;
const marketAddr = process.env.NEXT_PUBLIC_BREEDING_MARKETPLACE!;
const adiAddr = process.env.NEXT_PUBLIC_ADI_TOKEN!;
const agentAddr = process.env.NEXT_PUBLIC_AGENT_INFT!;
const deployerAddr = "0x9bebf5B8418C9D49b30A1F8D4F35B56C346fa092" as `0x${string}`;

const chain = { id: 16602, name: "0G", nativeCurrency: { decimals: 18, name: "ETH", symbol: "ETH" }, rpcUrls: { default: { http: [RPC] } } } as const;
const client = createPublicClient({ chain, transport: http(RPC) });

const horseAbi = parseAbi(["function getHorseData(uint256) view returns ((string name, uint64 birthTimestamp, uint256 sireId, uint256 damId, uint8[8] traitVector, uint16 pedigreeScore, uint256 valuationADI, bytes32 dnaHash, bool breedingAvailable, bool injured, bool retired, string encryptedURI, bytes32 metadataHash))"]);
const marketAbi = parseAbi(["function listings(uint256) view returns (uint256 studFeeADI, uint256 maxUses, uint256 usedCount, bool useAllowlist, bool active)"]);
const adiAbi = parseAbi(["function balanceOf(address) view returns (uint256)"]);
const agentAbi = parseAbi(["function profiles(uint256) view returns (string name, string version, string specialization, string modelBundleRootHash)"]);

async function main() {
  let ok = true;

  const horse0 = await client.readContract({
    address: horseAddr as `0x${string}`,
    abi: horseAbi,
    functionName: "getHorseData",
    args: [0n],
  }).catch((e) => { console.error("getHorseData(0):", e.message); ok = false; return null; });
  if (horse0) {
    const name = (horse0 as any).name ?? (horse0 as any)[0];
    if (String(name) !== "Thunder Strike") {
      console.error("getHorseData(0) name expected Thunder Strike, got", name);
      ok = false;
    } else {
      console.log("HorseINFT.getHorseData(0) -> Thunder Strike OK");
    }
  }

  const listing0 = await client.readContract({
    address: marketAddr as `0x${string}`,
    abi: marketAbi,
    functionName: "listings",
    args: [0n],
  }).catch((e) => { console.error("listings(0):", e.message); ok = false; return null; });
  if (listing0) {
    const [studFee, , , , active] = listing0;
    const fee500 = studFee === BigInt(500e18);
    if (!active || !fee500) {
      console.error("listings(0) expected active and 500 ADI, got active=", active, "fee=", studFee?.toString());
      ok = false;
    } else {
      console.log("BreedingMarketplace.listings(0) -> active, 500 ADI OK");
    }
  }

  const balance = await client.readContract({
    address: adiAddr as `0x${string}`,
    abi: adiAbi,
    functionName: "balanceOf",
    args: [deployerAddr],
  }).catch((e) => { console.error("balanceOf(deployer):", e.message); ok = false; return null; });
  if (balance !== null) {
    if (balance === 0n) {
      console.error("MockADI.balanceOf(deployer) expected non-zero, got 0");
      ok = false;
    } else {
      console.log("MockADI.balanceOf(deployer) ->", balance.toString(), "OK");
    }
  }

  const profile0 = await client.readContract({
    address: agentAddr as `0x${string}`,
    abi: agentAbi,
    functionName: "profiles",
    args: [0n],
  }).catch((e) => { console.error("profiles(0):", e.message); ok = false; return null; });
  if (profile0) {
    const name = profile0[0];
    if (!String(name).includes("Breeding Advisor") && String(name) !== "Secretariat Breeding Advisor") {
      console.error("BreedingAdvisorINFT.profiles(0) expected Breeding Advisor, got", name);
      ok = false;
    } else {
      console.log("BreedingAdvisorINFT.profiles(0) ->", name, "OK");
    }
  }

  if (!ok) process.exit(1);
  console.log("All contract reads verified.");
}

main();
