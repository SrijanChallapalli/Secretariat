import { Request, Response } from "express";
import fs from "fs";
import path from "path";
import os from "os";
import { fetchHorseFeatures } from "./chain-reader.js";
import { createBiometricScan } from "./biometric-engine.js";
import type { FeatureVector } from "../../shared/types.js";

/**
 * POST /biometric/calculate
 * Body: { tokenId: number, context?: { recentInjuryBps?, recentNewsSentBps?, recentRaceBoostBps? }, uploadToOg?: boolean }
 */
export async function biometricRoute(req: Request, res: Response) {
  try {
    const { tokenId, context, uploadToOg } = req.body ?? {};
    if (tokenId == null || typeof tokenId !== "number") {
      res.status(400).json({ error: "tokenId (number) required" });
      return;
    }

    const { features } = await fetchHorseFeatures(tokenId);

    const fullFeatures: FeatureVector = {
      speed: 0,
      stamina: 0,
      temperament: 0,
      conformation: 0,
      health: 80,
      agility: 0,
      raceIQ: 0,
      consistency: 0,
      pedigreeScore: 0,
      injured: false,
      retired: false,
      birthTimestamp: 0,
      sireId: 0,
      damId: 0,
      ...features,
    };

    const scan = createBiometricScan(tokenId, fullFeatures, context);

    if (uploadToOg) {
      const tmpFile = path.join(os.tmpdir(), `biometric-${tokenId}-${Date.now()}.json`);
      await fs.promises.writeFile(tmpFile, JSON.stringify(scan, null, 2));
      try {
        const { uploadRoute } = await import("./og-upload.js");
        const fakeReq = {
          file: { path: tmpFile },
        } as unknown as Request;

        let ogResult: Record<string, unknown> = {};
        const fakeRes = {
          status: (code: number) => ({
            json: (data: unknown) => {
              ogResult = { status: code, ...(data as Record<string, unknown>) };
            },
          }),
          json: (data: unknown) => {
            ogResult = data as Record<string, unknown>;
          },
        } as unknown as Response;

        await uploadRoute(fakeReq, fakeRes);
        res.json({ scan, og: ogResult });
      } catch (uploadErr) {
        await fs.promises.unlink(tmpFile).catch(() => {});
        res.json({ scan, og: { error: String(uploadErr) } });
      }
      return;
    }

    res.json(scan);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
}
