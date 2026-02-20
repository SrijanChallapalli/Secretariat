#!/usr/bin/env node
/**
 * Full local testing: start Anvil, deploy, seed, then run dev server + app.
 * No testnet credentials needed. Uses Anvil's default account.
 *
 * Usage: npm run test:local
 */
import { spawn } from "child_process";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const ANVIL_PK = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

function log(msg) {
  console.log(`\x1b[36m[test:local]\x1b[0m ${msg}`);
}

function ensureEnv() {
  const envPath = path.join(ROOT, ".env");
  let content = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf-8") : "";

  const required = {
    DEPLOYER_PRIVATE_KEY: ANVIL_PK,
    RPC_URL: "http://127.0.0.1:8545",
    RPC_0G: "http://127.0.0.1:8545",
    CHAIN_ID_0G: "31337",
    LOCAL_TESTING: "true",
    NEXT_PUBLIC_CHAIN_ID: "31337",
  };

  for (const [key, val] of Object.entries(required)) {
    const regex = new RegExp(`^${key}=.*`, "m");
    if (regex.test(content)) {
      content = content.replace(regex, `${key}=${val}`);
    } else {
      content = content.trimEnd() + (content.endsWith("\n") ? "" : "\n") + `${key}=${val}\n`;
    }
  }

  fs.writeFileSync(envPath, content);
  fs.copyFileSync(envPath, path.join(ROOT, "app", ".env"));
  log("Updated .env for local testing");
}

async function main() {
  log("Starting local test stack (Anvil + deploy + seed + dev)...");

  // 1. Start Anvil
  log("Starting Anvil on 8545...");
  const anvil = spawn("anvil", ["--port", "8545"], {
    cwd: ROOT,
    stdio: ["ignore", "pipe", "pipe"],
  });

  anvil.stdout?.on("data", (d) => process.stdout.write(d));
  anvil.stderr?.on("data", (d) => process.stderr.write(d));

  await new Promise((r) => setTimeout(r, 2000));

  try {
    ensureEnv();

    // 2. Deploy
    log("Deploying contracts...");
    execSync("node scripts/deploy-local.mjs", { stdio: "inherit", cwd: ROOT });

    // 3. Seed (minimal: 2 horses, 1 list, ADI)
    log("Seeding minimal data (2 horses, 1 breeding list)...");
    execSync("tsx scripts/seed-minimal.ts", { stdio: "inherit", cwd: ROOT, env: { ...process.env, RPC_URL: "http://127.0.0.1:8545", CHAIN_ID_0G: "31337", LOCAL_TESTING: "true" } });

    // 4. Start dev (server + app)
    log("Starting dev server + app...");
    log("  App: http://localhost:3000");
    log("  Server: http://localhost:4000");
    log("  Connect wallet → Add Anvil Local (127.0.0.1:8545, chain 31337)");
    log("  Press Ctrl+C to stop");
    const dev = spawn("npm", ["run", "dev"], { cwd: ROOT, stdio: "inherit", env: { ...process.env, LOCAL_TESTING: "true", NEXT_PUBLIC_CHAIN_ID: "31337" } });

    dev.on("exit", (code) => {
      anvil.kill();
      process.exit(code ?? 0);
    });

    process.on("SIGINT", () => {
      anvil.kill();
      dev.kill();
      process.exit(0);
    });
  } catch (e) {
    anvil.kill();
    throw e;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
