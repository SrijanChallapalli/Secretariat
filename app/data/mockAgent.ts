/**
 * Agent model metadata for the Breeding Advisor console.
 * TODO: Replace with real agent metadata from BreedingAdvisorINFT or API when available.
 */

export interface AgentModelInfo {
  name: string;
  version: string;
  subtitle: string;
  bundleSizeMb: number;
  filesCount: number;
  rootHash: string;
  lastUpdated: string; // ISO date string
  whatItDoes: string;
  inputs: string;
  outputs: string;
  limitations: string;
  guardrails: string;
}

export const breedingAdvisorModel: AgentModelInfo = {
  name: "Breeding Advisor",
  version: "2.1.0",
  subtitle: "THOROUGHBRED BREEDING OPTIMIZATION",
  bundleSizeMb: 142,
  filesCount: 12,
  rootHash: "0xabcdef1234567890abcdef1234567890abcdef123",
  lastUpdated: "2026-02-15",
  whatItDoes:
    "Analyzes mare-stallion compatibility using trait vectors, pedigree depth, and historical offspring performance data to recommend optimal breeding pairs.",
  inputs:
    "Mare trait vector, stallion trait vector, pedigree data, historical race performance, breeding history, market conditions.",
  outputs:
    "Top 3 stallion recommendations with compatibility score, projected offspring value uplift, risk delta, and confidence interval.",
  limitations:
    "Model trained on historical data only. Does not account for real-time environmental factors. Confidence degrades for horses with < 5 recorded races.",
  guardrails:
    "Maximum 3 recommendations per query. Budget constraints enforced. Trait floor validation. Mandatory EIP-712 signing for execution.",
};
