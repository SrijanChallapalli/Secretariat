#!/usr/bin/env node
import "dotenv/config";
import { execSync } from "child_process";

const rpc = process.env.RPC_0G || "https://evmrpc-testnet.0g.ai";
let pk = (process.env.DEPLOYER_PRIVATE_KEY || "").trim();
if (!pk) {
  console.error("DEPLOYER_PRIVATE_KEY is not set in .env");
  process.exit(1);
}
if (!pk.startsWith("0x")) pk = "0x" + pk;

if (pk.length < 64) {
  console.error("DEPLOYER_PRIVATE_KEY looks too short — make sure it's a 64-char hex private key, not your wallet address.");
  process.exit(1);
}

// Pass via env object to avoid leaking the key in shell command / error messages
execSync(
  `cd contracts && forge script script/Deploy.s.sol:DeployScript --rpc-url "${rpc}" --broadcast --with-gas-price 3000000000 --priority-gas-price 2000000000`,
  { stdio: "inherit", cwd: process.cwd(), env: { ...process.env, DEPLOYER_PRIVATE_KEY: pk } }
);
