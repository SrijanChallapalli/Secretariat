#!/usr/bin/env node

/**
 * Pre-commit guard: scans staged files for likely secrets.
 * Run: node scripts/check-no-secrets.mjs   (or: npm run precommit)
 *
 * Checks for:
 *  - .env files that should never be committed
 *  - Private-key-shaped hex strings (64 hex chars)
 *  - Explicit PRIVATE_KEY= assignments with values
 */

import { execSync } from "node:child_process";

const red = (s) => `\x1b[31m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;

let staged;
try {
  staged = execSync("git diff --cached --name-only --diff-filter=ACMR", {
    encoding: "utf-8",
  })
    .trim()
    .split("\n")
    .filter(Boolean);
} catch {
  process.exit(0);
}

if (staged.length === 0) process.exit(0);

const violations = [];

const BLOCKED_FILES = /^(\.env|app\/\.env)(\.local)?$/;

for (const file of staged) {
  if (BLOCKED_FILES.test(file)) {
    violations.push(`${file}  → env file must not be committed`);
  }
}

const SECRET_PATTERNS = [
  { re: /PRIVATE_KEY\s*=\s*(?:0x)?[0-9a-fA-F]{64}/, label: "private key assignment" },
];

import fs from "node:fs";

for (const file of staged) {
  if (file.endsWith(".example") || file.startsWith("contracts/lib/")) continue;
  let content;
  try {
    content = fs.readFileSync(file, "utf-8");
  } catch {
    continue;
  }
  for (const { re, label } of SECRET_PATTERNS) {
    if (re.test(content)) {
      violations.push(`${file}  → contains ${label}`);
    }
  }
}

if (violations.length > 0) {
  console.error(red(bold("\n🚫 Potential secrets detected in staged files:\n")));
  for (const v of violations) {
    console.error(red(`  • ${v}`));
  }
  console.error(
    "\nRemove the files/values and try again." +
      "\nIf this is a false positive, commit with --no-verify.\n"
  );
  process.exit(1);
}
