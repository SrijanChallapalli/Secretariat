import { Request, Response } from "express";
import { createEngine } from "./valuation-engine.js";
import type { FeatureVector, ValuationEngine } from "../../shared/types.js";

const engines: Record<string, ValuationEngine> = {
  formula: createEngine("formula"),
  model: createEngine("model"),
};

/**
 * POST /valuation/calculate
 * Body: { horseData, marketData?, eventType?, eventData? }
 * Query: ?engine=formula|model (default: formula)
 *
 * Backward-compatible: existing request shape still works.
 */
export async function valuationRoute(req: Request, res: Response) {
  try {
    const { horseData, marketData = {}, eventType, eventData } = req.body ?? {};
    if (!horseData || typeof horseData !== "object") {
      res.status(400).json({ error: "horseData (object) required" });
      return;
    }

    const engineType = (req.query.engine as string) || "formula";
    const engine = engines[engineType] ?? engines.formula;

    const features: FeatureVector = {
      speed: horseData.speed ?? 0,
      stamina: horseData.stamina ?? 0,
      temperament: horseData.temperament ?? 0,
      conformation: horseData.conformation ?? 0,
      health: horseData.health ?? 80,
      agility: horseData.agility ?? 0,
      raceIQ: horseData.raceIQ ?? 0,
      consistency: horseData.consistency ?? 0,
      pedigreeScore: horseData.pedigreeScore ?? 0,
      injured: horseData.injured ?? false,
      retired: horseData.status === "retired",
      birthTimestamp: horseData.birthTimestamp ?? 0,
      sireId: horseData.sireId ?? 0,
      damId: horseData.damId ?? 0,
      age: horseData.age,
      sex: horseData.sex,
      status: horseData.status,
      wins: horseData.wins,
      totalRaces: horseData.totalRaces,
      totalEarnings: horseData.totalEarnings,
      offspringCount: horseData.offspringCount,
      offspringWins: horseData.offspringWins,
    };

    const result = eventType
      ? engine.adjustForEvent(features, eventType, eventData ?? {}, marketData)
      : engine.predict(features, marketData);

    res.json(result);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
}
