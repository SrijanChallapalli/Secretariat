#!/usr/bin/env node

/**
 * Cross-platform setup script for the Secretariat monorepo.
 * Run: node scripts/setup.mjs   (or: npm run setup)
 *
 * - Copies .env.example -> .env if missing
 * - Syncs .env -> app/.env
 * - Checks required tooling (node, npm, optional forge)
 * - Installs npm dependencies
 * - Prints which env vars still need values
 */

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const green = (s) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;

let exitCode = 0;

// ── 1. Check tooling ──────────────────────────────────────────────────────

console.log(bold("\n▸ Checking prerequisites\n"));

function checkCmd(name, versionFlag = "--version") {
  try {
    const out = execSync(`${name} ${versionFlag}`, { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }).trim().split("\n")[0];
    console.log(`  ${green("✓")} ${name}  ${dim(out)}`);
    return out;
  } catch {
    return null;
  }
}

const nodeVersion = checkCmd("node");
if (nodeVersion) {
  const major = parseInt(nodeVersion.replace(/^v/, ""), 10);
  if (major < 18) {
    console.log(`  ${red("✗")} Node.js >= 18 required (found ${nodeVersion})`);
    exitCode = 1;
  }
} else {
  console.log(`  ${red("✗")} node not found — install from https://nodejs.org`);
  exitCode = 1;
}

if (!checkCmd("npm")) {
  console.log(`  ${red("✗")} npm not found — comes with Node.js`);
  exitCode = 1;
}

const forgeFound = checkCmd("forge");
if (!forgeFound) {
  console.log(`  ${yellow("!")} forge not found — needed only for contract development`);
  console.log(`    ${dim("Install: curl -L https://foundry.paradigm.xyz | bash && foundryup")}`);
}

if (exitCode) {
  console.log(red("\nFix the errors above and re-run: npm run setup\n"));
  process.exit(exitCode);
}

// ── 2. Copy .env.example -> .env ──────────────────────────────────────────

console.log(bold("\n▸ Environment file\n"));

const envExample = path.join(ROOT, ".env.example");
const envFile = path.join(ROOT, ".env");

if (!fs.existsSync(envFile)) {
  fs.copyFileSync(envExample, envFile);
  console.log(`  ${green("✓")} Created .env from .env.example`);
} else {
  console.log(`  ${green("✓")} .env already exists — keeping it`);
}

// Sync to app/.env (same as npm run sync-env)
const appEnv = path.join(ROOT, "app", ".env");
fs.copyFileSync(envFile, appEnv);
console.log(`  ${green("✓")} Synced .env → app/.env`);

// ── 3. Install dependencies ───────────────────────────────────────────────

console.log(bold("\n▸ Installing dependencies\n"));
try {
  execSync("npm install", { cwd: ROOT, stdio: "inherit" });
} catch {
  console.log(red("\nnpm install failed — check output above.\n"));
  process.exit(1);
}

// ── 4. Report vars that need filling ──────────────────────────────────────

console.log(bold("\n▸ Environment variables that need values\n"));

const MUST_FILL = [
  { key: "DEPLOYER_PRIVATE_KEY", why: "Testnet wallet private key (needs gas)" },
  { key: "NEXT_PUBLIC_WALLETCONNECT_ID", why: "32-char project ID from cloud.walletconnect.com" },
];

const NICE_TO_FILL = [
  { key: "OG_UPLOADER_PRIVATE_KEY", why: "Only if uploading model bundles to 0G" },
  { key: "ORACLE_PRIVATE_KEY", why: "Falls back to DEPLOYER_PRIVATE_KEY" },
];

const envContent = fs.readFileSync(envFile, "utf-8");

function envVal(key) {
  const m = envContent.match(new RegExp(`^${key}=(.*)$`, "m"));
  return m?.[1]?.trim() ?? "";
}

let missing = false;
for (const { key, why } of MUST_FILL) {
  if (!envVal(key)) {
    console.log(`  ${yellow("→")} ${bold(key)}  ${dim(why)}`);
    missing = true;
  }
}
for (const { key, why } of NICE_TO_FILL) {
  if (!envVal(key)) {
    console.log(`  ${dim("  (optional)")} ${key}  ${dim(why)}`);
  }
}

if (!missing) {
  console.log(`  ${green("✓")} All required vars are set`);
}

// ── 5. Contract addresses hint ────────────────────────────────────────────

const hasContracts = envVal("NEXT_PUBLIC_HORSE_INFT");
if (!hasContracts) {
  console.log(
    `\n  ${dim("Tip: contract addresses are empty. After deploying:")}\n` +
    `  ${dim("  npm run env:from-broadcast")}\n`
  );
}

// ── Done ──────────────────────────────────────────────────────────────────

console.log(bold(`\n${green("✓")} Setup complete!\n`));
console.log(`  Start developing:\n`);
console.log(`    ${bold("npm run dev")}        ${dim("# server (4000) + app (3000)")}`);
console.log(`    ${bold("npm run dev:app")}    ${dim("# Next.js only")}`);
console.log(`    ${bold("npm run dev:server")} ${dim("# Express only")}`);
console.log();
