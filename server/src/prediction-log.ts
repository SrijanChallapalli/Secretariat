import type { PredictionEntry } from "../../shared/types.js";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const DATA_DIR = path.resolve(process.cwd(), "server/data");
const JSONL_PATH = path.join(DATA_DIR, "prediction-log.jsonl");

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function logPrediction(
  entry: Omit<PredictionEntry, "id" | "resolved">,
): string {
  ensureDataDir();
  const id = `${entry.timestamp}-${crypto.createHash("md5").update(entry.agentId).digest("hex").slice(0, 8)}`;
  const full: PredictionEntry = { ...entry, id, resolved: false };
  fs.appendFileSync(JSONL_PATH, JSON.stringify(full) + "\n");
  return id;
}

export function resolvePrediction(id: string, actualValue: number): boolean {
  ensureDataDir();
  if (!fs.existsSync(JSONL_PATH)) return false;

  const lines = fs.readFileSync(JSONL_PATH, "utf-8").trim().split("\n").filter(Boolean);
  let found = false;
  const updated = lines.map((line) => {
    const entry = JSON.parse(line) as PredictionEntry;
    if (entry.id === id) {
      found = true;
      entry.actualValue = actualValue;
      entry.resolved = true;
    }
    return JSON.stringify(entry);
  });

  if (found) {
    fs.writeFileSync(JSONL_PATH, updated.join("\n") + "\n");
  }
  return found;
}

export function getPredictions(): PredictionEntry[] {
  ensureDataDir();
  if (!fs.existsSync(JSONL_PATH)) return [];
  const lines = fs.readFileSync(JSONL_PATH, "utf-8").trim().split("\n").filter(Boolean);
  return lines.map((line) => JSON.parse(line) as PredictionEntry);
}

export function getAccuracy(): {
  total: number;
  resolved: number;
  correct: number;
  accuracy: number;
} {
  const entries = getPredictions();
  const total = entries.length;
  const resolved = entries.filter((e) => e.resolved).length;
  const correct = entries.filter((e) => {
    if (!e.resolved || e.actualValue == null) return false;
    const diff = Math.abs(e.predictedValue - e.actualValue);
    return diff <= Math.abs(e.actualValue) * 0.2;
  }).length;
  const accuracy = resolved > 0 ? correct / resolved : 0;
  return { total, resolved, correct, accuracy };
}
