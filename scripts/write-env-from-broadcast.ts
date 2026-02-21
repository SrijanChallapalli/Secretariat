/**
 * After deploy, run: npm run env:from-broadcast [chainId]
 * Reads contracts/broadcast/Deploy.s.sol/<chainId>/run-latest.json and updates .env with NEXT_PUBLIC_* addresses.
 * Default chainId: 16602 (0G Galileo).
 */
import fs from "fs";
import path from "path";

const CONTRACT_KEYS = [
  "NEXT_PUBLIC_ADI_TOKEN",           // MockADI
  "NEXT_PUBLIC_KYC_REGISTRY",       // KYCRegistry
  "NEXT_PUBLIC_HORSE_INFT",          // HorseINFT (skip MockINFTOracle - not needed in app)
  "NEXT_PUBLIC_BREEDING_MARKETPLACE",
  "NEXT_PUBLIC_HORSE_ORACLE",
  "NEXT_PUBLIC_SYNDICATE_VAULT_FACTORY",
  "NEXT_PUBLIC_AGENT_INFT",
  "NEXT_PUBLIC_AGENT_EXECUTOR",
  "NEXT_PUBLIC_AGENT_RISK_CONFIG",
  "NEXT_PUBLIC_STOP_LOSS_EXECUTOR",
  "NEXT_PUBLIC_AGENT_WALLET",
];
// Broadcast order: MockADI(0), MockINFTOracle(1), KYCRegistry(2), HorseINFT(3),
// BreedingMarketplace(4), CALL(5), HorseOracle(6), CALL(7), VaultFactory(8),
// AgentINFT(9), AgentExecutor(10), AgentRiskConfig(11), StopLossExecutor(12), AgentWallet(13)
const TX_INDEX_MAP = [0, 2, 3, 4, 6, 8, 9, 10, 11, 12, 13]; // skip MockINFTOracle, CALLs

const chainId = process.argv[2] ?? "16602";
const repoRoot = path.resolve(process.cwd());
const broadcastPath = path.join(repoRoot, "contracts", "broadcast", "Deploy.s.sol", chainId, "run-latest.json");
const envPath = path.join(repoRoot, ".env");

if (!fs.existsSync(broadcastPath)) {
  console.error("Broadcast file not found:", broadcastPath);
  console.error("Deploy first: RPC_0G=... DEPLOYER_PRIVATE_KEY=0x... npm run deploy:og");
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(broadcastPath, "utf-8"));
const transactions = data.transactions ?? [];
let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf-8") : "";

for (let i = 0; i < CONTRACT_KEYS.length; i++) {
  const key = CONTRACT_KEYS[i];
  const idx = TX_INDEX_MAP[i];
  const tx = transactions[idx];
  const addr = tx?.contractAddress ?? tx?.address ?? tx?.result?.contractAddress;
  if (!addr) continue;
  const value = typeof addr === "string" ? addr : (addr?.toString?.() ?? String(addr)).toLowerCase();
  if (!value.startsWith("0x")) continue;
  const regex = new RegExp(`^(${key}=).*`, "m");
  if (regex.test(envContent)) {
    envContent = envContent.replace(regex, `$1${value}`);
  } else {
    envContent = envContent.trimEnd() + (envContent.endsWith("\n") ? "" : "\n") + `${key}=${value}\n`;
  }
}

fs.writeFileSync(envPath, envContent);
console.log("Updated .env with contract addresses from broadcast (chainId %s). Copy to app/.env if you run the app from app/.", chainId);
// Copy to app/.env so Next.js picks them up
const appEnvPath = path.join(repoRoot, "app", ".env");
if (fs.existsSync(path.join(repoRoot, "app"))) {
  fs.copyFileSync(envPath, appEnvPath);
  console.log("Copied .env to app/.env");
}
