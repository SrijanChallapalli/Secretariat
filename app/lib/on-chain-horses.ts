/**
 * On-chain horses only: we fetch a range of token IDs and treat as "minted"
 * only when getHorseData returns valid data (birthTimestamp > 0 or non-empty name).
 * No static/mock demo horses.
 */

export const MAX_HORSE_ID_TO_FETCH = 100;

export function isOnChainHorse(result: unknown): boolean {
  if (!result || typeof result !== "object") return false;
  const r = result as Record<string, unknown>;
  const name = (r.name ?? r[0]) as string | undefined;
  const birthTimestamp = Number(r.birthTimestamp ?? r[1] ?? 0);
  const hasName = typeof name === "string" && name.trim().length > 0;
  const hasBirth = birthTimestamp > 0;
  return hasName || hasBirth;
}
