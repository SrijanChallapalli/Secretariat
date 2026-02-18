import { Request, Response } from "express";
import { runValuation } from "./valuation-agent.js";

/**
 * POST /valuation/calculate
 * Body: { horseData: HorseValuationInput, marketData?: MarketData, eventType?: string, eventData?: object }
 * Returns: { value, breakdown, explanation } for Horse Valuation Agent (S-Agent spec).
 * Wire-in point: when HorseOracle reports race/injury/news, call this to get agent-suggested valuation.
 */
export async function valuationRoute(req: Request, res: Response) {
  try {
    const { horseData, marketData = {}, eventType, eventData } = req.body ?? {};
    if (!horseData || typeof horseData !== "object") {
      res.status(400).json({ error: "horseData (object) required" });
      return;
    }
    const result = runValuation(horseData, marketData, eventType, eventData);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
}
