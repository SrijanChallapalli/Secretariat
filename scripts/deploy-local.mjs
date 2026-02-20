#!/usr/bin/env node
/**
 * Deploy contracts to local Anvil. Requires Anvil running on 8545.
 * Uses Anvil's default account #0 (well-known key) if DEPLOYER_PRIVATE_KEY not set.
 *
 * Usage: npm run deploy:local
 *   (start anvil in another terminal first, or use: npm run test:local)
 */
import "dotenv/config";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const RPC = "http://127.0.0.1:8545";
// Anvil default account #0 - NEVER use in production
const ANVIL_DEFAULT_PK = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

let pk = (process.env.DEPLOYER_PRIVATE_KEY || ANVIL_DEFAULT_PK).trim();
if (!pk.startsWith("0x")) pk = "0x" + pk;

console.log("Deploying to local Anvil at", RPC);
console.log("Using deployer key:", pk === ANVIL_DEFAULT_PK ? "(Anvil default #0)" : "(custom)");

try {
  execSync(
    `cd contracts && forge script script/Deploy.s.sol:DeployScript --rpc-url "${RPC}" --broadcast --non-interactive --with-gas-price 1000000000`,
    {
      stdio: "inherit",
      cwd: ROOT,
      env: { ...process.env, DEPLOYER_PRIVATE_KEY: pk },
    }
  );
} catch (e) {
  console.error("Deploy failed. Is Anvil running? Start with: anvil");
  process.exit(1);
}

// Write addresses to .env for chain 31337
const chainId = "31337";
const broadcastPath = path.join(ROOT, "contracts", "broadcast", "Deploy.s.sol", chainId, "run-latest.json");
if (!fs.existsSync(broadcastPath)) {
  console.error("Broadcast file not found:", broadcastPath);
  process.exit(1);
}

// Run env:from-broadcast for local chain
execSync(`tsx scripts/write-env-from-broadcast.ts ${chainId}`, { stdio: "inherit", cwd: ROOT });
console.log("\n✓ Local deploy complete. Run: npm run seed:local");
console.log("  Then: npm run dev");
