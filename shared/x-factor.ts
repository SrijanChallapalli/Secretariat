/**
 * X-Factor Detection Module
 *
 * The "X-Factor" refers to an enlarged heart trait passed through the X chromosome,
 * traced from the Eclipse → Pocahontas dam-line. Horses carrying this trait
 * (e.g., Secretariat, Phar Lap) have significantly larger hearts (up to 22 lbs vs
 * the normal 8.5 lbs), providing exceptional cardiovascular capacity and stamina.
 *
 * Inheritance rules:
 * - Dam passes X chromosome to all offspring
 * - Sire passes X chromosome only to daughters
 * - A colt (male) inherits X-Factor exclusively from his dam
 * - A filly (female) can inherit from either parent
 *
 * For valuation purposes, X-Factor carriers receive a breeding premium since the
 * trait is rare and correlates with elite racing performance.
 */

export interface PedigreeNode {
  id: number;
  name: string;
  sex: "male" | "female";
  sireId: number | null;
  damId: number | null;
  xFactorConfirmed?: boolean;
}

export interface XFactorResult {
  isCarrier: boolean;
  confidence: number; // 0-1, based on how many generations we can trace
  inheritancePath: string[];
  breedingPremiumMultiplier: number;
}

const KNOWN_XFACTOR_CARRIERS = new Set([
  "Eclipse",
  "Pocahontas",
  "Stockwell",
  "Doncaster",
  "Bend Or",
  "Bona Vista",
  "Cyllene",
  "Polymelus",
  "Phalaris",
  "Pharos",
  "Nearco",
  "Nasrullah",
  "Bold Ruler",
  "Secretariat",
  "Phar Lap",
  "Somethingroyal", // Secretariat's dam
]);

/**
 * Trace X-chromosome inheritance through a pedigree tree.
 * Returns whether the target horse is a potential X-Factor carrier.
 */
export function detectXFactor(
  targetId: number,
  pedigreeMap: Map<number, PedigreeNode>,
  maxDepth: number = 8,
): XFactorResult {
  const target = pedigreeMap.get(targetId);
  if (!target) {
    return { isCarrier: false, confidence: 0, inheritancePath: [], breedingPremiumMultiplier: 1.0 };
  }

  if (target.xFactorConfirmed) {
    return {
      isCarrier: true,
      confidence: 1.0,
      inheritancePath: [target.name],
      breedingPremiumMultiplier: calculatePremium(1.0),
    };
  }

  const path: string[] = [target.name];
  const result = traceXChromosome(target, pedigreeMap, path, 0, maxDepth);

  return {
    isCarrier: result.found,
    confidence: result.confidence,
    inheritancePath: result.path,
    breedingPremiumMultiplier: calculatePremium(result.found ? result.confidence : 0),
  };
}

interface TraceResult {
  found: boolean;
  confidence: number;
  path: string[];
}

function traceXChromosome(
  node: PedigreeNode,
  pedigreeMap: Map<number, PedigreeNode>,
  currentPath: string[],
  depth: number,
  maxDepth: number,
): TraceResult {
  if (depth >= maxDepth) {
    return { found: false, confidence: 0, path: currentPath };
  }

  if (KNOWN_XFACTOR_CARRIERS.has(node.name) || node.xFactorConfirmed) {
    return {
      found: true,
      confidence: Math.max(0.5, 1.0 - depth * 0.1),
      path: [...currentPath],
    };
  }

  // X-chromosome inheritance: males get X from dam only; females get X from both
  const xSources: PedigreeNode[] = [];

  if (node.damId != null) {
    const dam = pedigreeMap.get(node.damId);
    if (dam) xSources.push(dam);
  }

  // Females also inherit an X from sire
  if (node.sex === "female" && node.sireId != null) {
    const sire = pedigreeMap.get(node.sireId);
    if (sire) xSources.push(sire);
  }

  for (const source of xSources) {
    const newPath = [...currentPath, source.name];
    const result = traceXChromosome(source, pedigreeMap, newPath, depth + 1, maxDepth);
    if (result.found) return result;
  }

  return { found: false, confidence: 0, path: currentPath };
}

function calculatePremium(confidence: number): number {
  if (confidence <= 0) return 1.0;
  // Up to 15% premium for confirmed X-Factor carriers, scaled by confidence
  return 1.0 + 0.15 * confidence;
}

/**
 * Convenience: check if a horse name is in the known X-Factor carrier list.
 */
export function isKnownXFactorCarrier(name: string): boolean {
  return KNOWN_XFACTOR_CARRIERS.has(name);
}
