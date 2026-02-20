import { z } from "zod";

const hex40 = z
  .string()
  .refine(
    (v) => v === "" || /^0x[0-9a-fA-F]{40}$/.test(v),
    "Must be empty or a 0x-prefixed 40-hex-char address",
  )
  .optional()
  .default("");

const clientSchema = z.object({
  NEXT_PUBLIC_WALLETCONNECT_ID: z.string().optional().default(""),
  NEXT_PUBLIC_APP_URL: z.string().url().optional().default("http://localhost:3000"),
  NEXT_PUBLIC_SERVER_URL: z.string().url().optional().default("http://localhost:4000"),

  NEXT_PUBLIC_ADI_TOKEN: hex40,
  NEXT_PUBLIC_HORSE_INFT: hex40,
  NEXT_PUBLIC_BREEDING_MARKETPLACE: hex40,
  NEXT_PUBLIC_SYNDICATE_VAULT: hex40,
  NEXT_PUBLIC_HORSE_ORACLE: hex40,
  NEXT_PUBLIC_SYNDICATE_VAULT_FACTORY: hex40,
  NEXT_PUBLIC_AGENT_INFT: hex40,
  NEXT_PUBLIC_AGENT_EXECUTOR: hex40,
});

function validateEnv() {
  const result = clientSchema.safeParse({
    NEXT_PUBLIC_WALLETCONNECT_ID: process.env.NEXT_PUBLIC_WALLETCONNECT_ID,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_SERVER_URL: process.env.NEXT_PUBLIC_SERVER_URL,
    NEXT_PUBLIC_ADI_TOKEN: process.env.NEXT_PUBLIC_ADI_TOKEN || undefined,
    NEXT_PUBLIC_HORSE_INFT: process.env.NEXT_PUBLIC_HORSE_INFT || undefined,
    NEXT_PUBLIC_BREEDING_MARKETPLACE: process.env.NEXT_PUBLIC_BREEDING_MARKETPLACE || undefined,
    NEXT_PUBLIC_SYNDICATE_VAULT: process.env.NEXT_PUBLIC_SYNDICATE_VAULT || undefined,
    NEXT_PUBLIC_HORSE_ORACLE: process.env.NEXT_PUBLIC_HORSE_ORACLE || undefined,
    NEXT_PUBLIC_SYNDICATE_VAULT_FACTORY: process.env.NEXT_PUBLIC_SYNDICATE_VAULT_FACTORY || undefined,
    NEXT_PUBLIC_AGENT_INFT: process.env.NEXT_PUBLIC_AGENT_INFT || undefined,
    NEXT_PUBLIC_AGENT_EXECUTOR: process.env.NEXT_PUBLIC_AGENT_EXECUTOR || undefined,
  });

  if (!result.success) {
    const formatted = result.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    console.error(`\n❌ Invalid environment variables:\n${formatted}\n`);
    throw new Error("Environment validation failed — see errors above.");
  }

  return result.data;
}

export const env = validateEnv();
