/**
 * Client-side mirror of the breeding rules enforced by BreedingMarketplace.
 *
 * These exist so the UI never offers a pairing the contract will reject. The
 * contract remains the source of truth — every rule here is also a `require`
 * on-chain — but duplicating them client-side turns a failed transaction into
 * a disabled button with an explanation.
 *
 * Shared deliberately: the same logic is needed by the breeding lab and the
 * agent's proposal engine, and keeping one copy avoids the drift that bit us
 * when a magic constant was duplicated across two ML call sites.
 */

export const SEX_MALE = 0;
export const SEX_FEMALE = 1;
export const SEX_GELDING = 2;

/** Minimal shape needed to evaluate eligibility. */
export interface BreedingCandidate {
  tokenId: number;
  name?: string;
  sex?: number;
  sireId?: number;
  damId?: number;
  injured?: boolean;
  breedingAvailable?: boolean;
}

export function sexLabel(sex?: number): string {
  if (sex === SEX_FEMALE) return "Mare";
  if (sex === SEX_GELDING) return "Gelding";
  return "Stallion";
}

/**
 * A horse with no recorded parents is a founder. Token 0 is a real id, so
 * "no parent" is only unambiguous when BOTH ids are zero — the same guard the
 * contract uses.
 */
export function isFounder(h?: BreedingCandidate): boolean {
  return !h || ((h.sireId ?? 0) === 0 && (h.damId ?? 0) === 0);
}

/**
 * Mirrors BreedingMarketplace._requireNotCloselyRelated: blocks parent,
 * grandparent, and full/half siblings. Deliberately permits more distant
 * shared ancestry — thoroughbred practice encourages linebreeding, and
 * rejecting every common ancestor would be wrong for the domain.
 */
export function closelyRelated(
  a: BreedingCandidate | undefined,
  b: BreedingCandidate | undefined,
  all: BreedingCandidate[],
): boolean {
  if (!a || !b) return false;
  if (a.tokenId === b.tokenId) return true;

  const byId = (id?: number) => all.find((h) => h.tokenId === id);

  const isAncestorWithin = (
    ancestorId: number,
    descendant: BreedingCandidate | undefined,
    depth: number,
  ): boolean => {
    if (!descendant || depth === 0 || isFounder(descendant)) return false;
    const s = descendant.sireId ?? 0;
    const d = descendant.damId ?? 0;
    if (s === ancestorId || d === ancestorId) return true;
    return (
      isAncestorWithin(ancestorId, byId(s), depth - 1) ||
      isAncestorWithin(ancestorId, byId(d), depth - 1)
    );
  };

  if (isAncestorWithin(a.tokenId, b, 2)) return true;
  if (isAncestorWithin(b.tokenId, a, 2)) return true;

  if (!isFounder(a) && !isFounder(b)) {
    if ((a.sireId ?? 0) === (b.sireId ?? 0)) return true;
    if ((a.damId ?? 0) === (b.damId ?? 0)) return true;
  }
  return false;
}

/** Why a specific pairing is not permitted, or null when it is. */
export function pairingBlockReason(
  sire: BreedingCandidate | undefined,
  dam: BreedingCandidate | undefined,
  all: BreedingCandidate[],
): string | null {
  if (!sire || !dam) return "Missing horse";
  if (sire.tokenId === dam.tokenId) return "A horse cannot breed with itself";
  if (sire.sex !== SEX_MALE) return `${sire.name ?? "Sire"} is not male`;
  if (dam.sex !== SEX_FEMALE) return `${dam.name ?? "Dam"} is not female`;
  if (sire.injured) return `${sire.name ?? "Sire"} is recovering from injury`;
  if (dam.injured) return `${dam.name ?? "Dam"} is recovering from injury`;
  if (sire.breedingAvailable === false) return `${sire.name ?? "Sire"} is not registered for breeding`;
  if (dam.breedingAvailable === false) return `${dam.name ?? "Dam"} is not registered for breeding`;
  if (closelyRelated(sire, dam, all)) {
    const sireIsParent =
      (dam.sireId ?? -1) === sire.tokenId || (dam.damId ?? -1) === sire.tokenId;
    const damIsParent =
      (sire.sireId ?? -1) === dam.tokenId || (sire.damId ?? -1) === dam.tokenId;
    if (sireIsParent) return `${sire.name ?? "Sire"} is a parent of ${dam.name ?? "this mare"}`;
    if (damIsParent) return `${dam.name ?? "Dam"} is a parent of ${sire.name ?? "this stallion"}`;
    if (!isFounder(sire) && !isFounder(dam)) {
      if ((sire.sireId ?? 0) === (dam.sireId ?? 0) || (sire.damId ?? 0) === (dam.damId ?? 0)) {
        return "They are siblings";
      }
    }
    return "Too closely related (within two generations)";
  }
  return null;
}

/** Mares the connected account may breed from. */
export function eligibleMares<T extends BreedingCandidate>(
  horses: T[],
  ownedTokenIds: Set<number>,
): T[] {
  return horses.filter(
    (h) =>
      ownedTokenIds.has(h.tokenId) &&
      h.sex === SEX_FEMALE &&
      !h.injured &&
      h.breedingAvailable !== false,
  );
}

/** Stallions available to cover a given mare. */
export function eligibleStallionsFor<T extends BreedingCandidate & { studFeeADI?: bigint | number }>(
  mare: BreedingCandidate,
  horses: T[],
): T[] {
  return horses.filter(
    (h) =>
      h.tokenId !== mare.tokenId &&
      h.sex === SEX_MALE &&
      !h.injured &&
      h.breedingAvailable !== false &&
      BigInt(h.studFeeADI ?? 0) > 0n &&
      !closelyRelated(h, mare, horses),
  );
}
