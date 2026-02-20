import { Request, Response } from "express";
import { fetchHorseFeatures } from "./chain-reader.js";
import { createBiometricScan } from "./biometric-engine.js";
import type { BiometricScanResult } from "../../shared/types.js";
import { Indexer, ZgFile } from "@0glabs/0g-ts-sdk";
import { ethers } from "ethers";
import fs from "fs";
import path from "path";

const INDEXER_RPC = process.env.INDEXER_RPC ?? "https://indexer-storage-testnet-turbo.0g.ai";
const RPC_URL = process.env.RPC_URL_0G ?? "https://evmrpc-testnet.0g.ai";
const PRIVATE_KEY = process.env.OG_UPLOADER_PRIVATE_KEY;

async function uploadToOg(data: BiometricScanResult): Promise<{ rootHash: string; txHash?: string }> {
  if (!PRIVATE_KEY) {
    throw new Error("OG_UPLOADER_PRIVATE_KEY not set");
  }

  const tempPath = path.join(process.cwd(), "uploads", `biometric-${data.horseTokenId}-${Date.now()}.json`);
  await fs.promises.mkdir(path.dirname(tempPath), { recursive: true });
  await fs.promises.writeFile(tempPath, JSON.stringify(data, null, 2));

  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const signer = new ethers.Wallet(PRIVATE_KEY, provider);
    const indexer = new Indexer(INDEXER_RPC);

    const zgFile = await ZgFile.fromFilePath(tempPath);
    const [tree, treeErr] = await zgFile.merkleTree();
    if (treeErr) {
      await zgFile.close();
      throw new Error(`Merkle tree: ${treeErr}`);
    }

    const [tx, uploadErr] = await indexer.upload(
      zgFile,
      RPC_URL,
      signer as unknown as Parameters<Indexer["upload"]>[2]
    );
    await zgFile.close();

    if (uploadErr) {
      throw new Error(`Upload: ${uploadErr}`);
    }

    return { rootHash: tx.rootHash, txHash: tx.txHash };
  } finally {
    fs.promises.unlink(tempPath).catch(() => {});
  }
}

export async function biometricRoute(req: Request, res: Response) {
  try {
    const { tokenId, context, uploadToOg: shouldUpload } = req.body ?? {};

    if (typeof tokenId !== "number" || tokenId < 0) {
      res.status(400).json({ error: "tokenId (number) required" });
      return;
    }

    const { features } = await fetchHorseFeatures(tokenId);
    const scan = createBiometricScan(tokenId, features, context);

    if (shouldUpload === true) {
      try {
        const og = await uploadToOg(scan);
        res.json({ scan, og });
      } catch (uploadErr) {
        res.status(500).json({
          error: `Failed to upload to 0G: ${String(uploadErr)}`,
          scan, // Still return scan even if upload fails
        });
      }
    } else {
      res.json(scan);
    }
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
}
