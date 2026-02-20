import { Request, Response } from "express";
import path from "path";
import fs from "fs";
import { Indexer } from "@0glabs/0g-ts-sdk";

const INDEXER_RPC = process.env.INDEXER_RPC ?? "https://indexer-storage-testnet-turbo.0g.ai";
const LOCAL_TESTING = process.env.LOCAL_TESTING === "true" || process.env.LOCAL_TESTING === "1";
const MOCK_STORAGE_DIR = path.resolve(process.cwd(), "server", "mock-og-storage");

export async function downloadRoute(req: Request, res: Response) {
  const rootHash = req.params.rootHash;
  if (!rootHash || !/^[a-fA-F0-9x]+$/.test(rootHash.replace("0x", ""))) {
    res.status(400).json({ error: "Invalid rootHash" });
    return;
  }
  try {
    // Local testing: serve from mock storage if available
    if (LOCAL_TESTING) {
      const hex = rootHash.replace("0x", "").toLowerCase();
      const filePath = path.join(MOCK_STORAGE_DIR, hex + ".bin");
      if (fs.existsSync(filePath)) {
        res.sendFile(path.resolve(filePath));
        return;
      }
    }
    const indexer = new Indexer(INDEXER_RPC);
    const outPath = path.join("downloads", `${rootHash}.bin`);
    await fs.promises.mkdir("downloads", { recursive: true });
    const err = await indexer.download(rootHash, outPath, true);
    if (err) {
      res.status(404).json({ error: String(err) });
      return;
    }
    res.sendFile(path.resolve(outPath), () => {
      fs.promises.unlink(outPath).catch(() => {});
    });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
}
