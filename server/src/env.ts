import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), "../.env") });
dotenv.config();

import { z } from "zod";

const hex40 = z
  .string()
  .regex(/^0x[0-9a-fA-F]{40}$/)
  .optional()
  .default("");

const schema = z
  .object({
    PORT: z.coerce.number().int().positive().default(4000),

    RPC_0G: z.string().url().default("https://evmrpc-testnet.0g.ai"),
    RPC_URL_0G: z.string().url().default("https://evmrpc-testnet.0g.ai"),
    CHAIN_ID_0G: z.coerce.number().int().default(16602),

    INDEXER_RPC: z.string().url().default("https://indexer-storage-testnet-turbo.0g.ai"),

    DEPLOYER_PRIVATE_KEY: z.string().optional().default(""),
    ORACLE_PRIVATE_KEY: z.string().optional().default(""),
    OG_UPLOADER_PRIVATE_KEY: z.string().optional().default(""),

    NEXT_PUBLIC_HORSE_INFT: hex40,
    NEXT_PUBLIC_HORSE_ORACLE: hex40,
    NEXT_PUBLIC_SERVER_URL: z.string().url().optional().default("http://localhost:4000"),
  })
  .transform((v) => ({
    ...v,
    ORACLE_PRIVATE_KEY: v.ORACLE_PRIVATE_KEY || v.DEPLOYER_PRIVATE_KEY,
  }));

function validate() {
  const result = schema.safeParse(process.env);

  if (!result.success) {
    const formatted = result.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    console.error(`\n❌ Invalid environment variables:\n${formatted}\n`);
    console.error("Hint: copy .env.example to .env and fill in required values.\n");
    process.exit(1);
  }

  return result.data;
}

export const env = validate();
