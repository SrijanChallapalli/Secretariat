#!/usr/bin/env node
/**
 * Mint one horse to Anvil account #1 (an address we don't own).
 */
import dotenv from "dotenv";
import { resolve } from "path";
dotenv.config({ path: resolve(process.cwd(), ".env") });

import { createWalletClient, http, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const RPC = process.env.RPC_URL ?? "http://127.0.0.1:8545";
const PK = process.env.DEPLOYER_PRIVATE_KEY ?? "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const horseAddr = process.env.HORSE_INFT ?? process.env.NEXT_PUBLIC_HORSE_INFT;

const chain = { id: 31337, name: "Anvil", nativeCurrency: { decimals: 18, name: "ETH", symbol: "ETH" }, rpcUrls: { default: { http: [RPC] } } };
const account = privateKeyToAccount((PK.startsWith("0x") ? PK : "0x" + PK).trim());
const wallet = createWalletClient({ account, chain, transport: http(RPC) });

const OTHER_OWNER = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";

const abi = parseAbi([
  "function mint(address to, string calldata encryptedURI, bytes32 metadataHash, (string name, uint64 birthTimestamp, uint256 sireId, uint256 damId, uint8[8] traitVector, uint16 pedigreeScore, uint256 valuationADI, bytes32 dnaHash, bool breedingAvailable, bool injured, bool retired, bool xFactorCarrier, string encryptedURI, bytes32 metadataHash) data) external returns (uint256)",
]);

const data = {
  name: "Rival Stables Colt",
  birthTimestamp: BigInt(Math.floor(Date.now() / 1000) - 86400 * 365 * 2),
  sireId: 0n,
  damId: 0n,
  traitVector: [86, 84, 79, 88, 91, 83, 87, 81],
  pedigreeScore: 8600,
  valuationADI: BigInt(5500e18),
  dnaHash: `0x${"00".repeat(32)}`,
  breedingAvailable: true,
  injured: false,
  retired: false,
  xFactorCarrier: false,
  encryptedURI: "",
  metadataHash: `0x${"00".repeat(32)}`,
};

const tx = await wallet.writeContract({
  address: horseAddr,
  abi,
  functionName: "mint",
  args: [OTHER_OWNER, "", data.metadataHash, data],
});
console.log("Minted horse 8 'Rival Stables Colt' to", OTHER_OWNER, "(Anvil account #1 – you don't own this)");
console.log("Tx:", tx);
