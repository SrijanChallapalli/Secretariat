import OpenAI from "openai";

const OG_COMPUTE_PROVIDER_URL = process.env.OG_COMPUTE_PROVIDER_URL || "";
const OG_COMPUTE_SECRET = process.env.OG_COMPUTE_SECRET || "";
const OG_COMPUTE_MODEL = process.env.OG_COMPUTE_MODEL || "qwen-2.5-7b-instruct";

let client: OpenAI | null = null;

function getClient(): OpenAI | null {
  if (client) return client;
  if (!OG_COMPUTE_PROVIDER_URL || !OG_COMPUTE_SECRET) return null;
  client = new OpenAI({
    baseURL: `${OG_COMPUTE_PROVIDER_URL.replace(/\/+$/, "")}/v1/proxy`,
    apiKey: OG_COMPUTE_SECRET,
  });
  return client;
}

export function isOgComputeConfigured(): boolean {
  return !!(OG_COMPUTE_PROVIDER_URL && OG_COMPUTE_SECRET);
}

interface ScoreBreakdown {
  stallionName: string;
  traitMatch: number;
  pedigreeSynergy: number;
  costPenalty: number;
  formBonus: number;
  mlOffspringValue: number;
  riskFlags: string[];
  overallScore: number;
}

export async function generateBreedingExplanation(
  mareName: string,
  picks: ScoreBreakdown[],
): Promise<string[]> {
  const ai = getClient();
  if (!ai) return picks.map(() => "");

  const systemPrompt = `You are Secretariat's Breeding Advisor AI, running on 0G Compute Network. You analyze thoroughbred mare-stallion compatibility using trait vectors, pedigree data, and ML-predicted offspring value. Give concise, data-driven explanations for each breeding recommendation. Each explanation should be 2-3 sentences. Reference specific numbers from the score breakdown. Do NOT use markdown formatting.`;

  const pickDescriptions = picks
    .map(
      (p, i) =>
        `#${i + 1} ${p.stallionName}: score=${(p.overallScore * 100).toFixed(0)}%, traitMatch=${(p.traitMatch * 100).toFixed(0)}%, pedigreeSynergy=${(p.pedigreeSynergy * 100).toFixed(0)}%, costPenalty=${(p.costPenalty * 100).toFixed(0)}%, formBonus=${(p.formBonus * 100).toFixed(0)}%, mlOffspringValue=$${p.mlOffspringValue.toFixed(0)}, riskFlags=[${p.riskFlags.join(", ") || "none"}]`,
    )
    .join("\n");

  const userPrompt = `Explain each of these ${picks.length} breeding recommendations for mare "${mareName}":\n${pickDescriptions}\n\nRespond with exactly ${picks.length} explanations, separated by "---". No numbering, no markdown.`;

  try {
    const completion = await ai.chat.completions.create({
      model: OG_COMPUTE_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 600,
      temperature: 0.4,
    });

    const text = completion.choices?.[0]?.message?.content ?? "";
    const parts = text.split("---").map((s) => s.trim()).filter(Boolean);

    return picks.map((_, i) => parts[i] ?? "");
  } catch (err) {
    console.warn("[0G Compute] inference failed, falling back:", err);
    return picks.map(() => "");
  }
}
