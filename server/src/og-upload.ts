import { Request, Response } from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { Indexer, ZgFile } from "@0glabs/0g-ts-sdk";
import { ethers } from "ethers";

const INDEXER_RPC = process.env.INDEXER_RPC ?? "https://indexer-storage-testnet-turbo.0g.ai";
const RPC_URL = process.env.RPC_URL_0G ?? "https://evmrpc-testnet.0g.ai";
const PRIVATE_KEY = process.env.OG_UPLOADER_PRIVATE_KEY;
const LOCAL_TESTING = process.env.LOCAL_TESTING === "true" || process.env.LOCAL_TESTING === "1";

const MOCK_STORAGE_DIR = path.resolve(process.cwd(), "server", "mock-og-storage");

export async function uploadRoute(req: Request, res: Response) {
  if (!req.file?.path) {
    res.status(400).json({ error: "No file in field 'file'" });
    return;
  }
  const filePath = path.resolve(req.file.path);
  try {
    // Local testing: mock 0G storage when OG_UPLOADER_PRIVATE_KEY not set
    if (LOCAL_TESTING && !PRIVATE_KEY) {
      await fs.promises.mkdir(MOCK_STORAGE_DIR, { recursive: true });
      const content = await fs.promises.readFile(filePath);
      const rootHash = "0x" + crypto.createHash("sha256").update(content).digest("hex");
      const destPath = path.join(MOCK_STORAGE_DIR, rootHash.replace("0x", "") + ".bin");
      await fs.promises.copyFile(filePath, destPath);
      await fs.promises.unlink(filePath).catch(() => {});
      res.json({ rootHash, txHash: "0x" + "0".repeat(64) });
      return;
    }
    if (!PRIVATE_KEY) {
      res.status(500).json({ error: "OG_UPLOADER_PRIVATE_KEY not set" });
      return;
    }
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const signer = new ethers.Wallet(PRIVATE_KEY, provider);
    const indexer = new Indexer(INDEXER_RPC);

    const zgFile = await ZgFile.fromFilePath(filePath);
    const [tree, treeErr] = await zgFile.merkleTree();
    if (treeErr) {
      res.status(500).json({ error: `Merkle tree: ${treeErr}` });
      await zgFile.close();
      return;
    }
    const [tx, uploadErr] = await indexer.upload(zgFile, RPC_URL, signer as unknown as Parameters<Indexer["upload"]>[2]);
    await zgFile.close();
    fs.promises.unlink(filePath).catch(() => {});

    if (uploadErr) {
      res.status(500).json({ error: `Upload: ${uploadErr}` });
      return;
    }
    res.json({ rootHash: tx.rootHash, txHash: tx.txHash });
  } catch (e) {
    fs.promises.unlink(filePath).catch(() => {});
    res.status(500).json({ error: String(e) });
  }
}
