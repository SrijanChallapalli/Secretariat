import { env } from "./env.js";
import express from "express";
import cors from "cors";
import multer from "multer";
import { uploadRoute } from "./og-upload.js";
import { downloadRoute } from "./og-download.js";
import { valuationRoute } from "./valuation-route.js";
import { breedingRoute } from "./breeding-route.js";
import { startIndexer, getTrainingData } from "./event-indexer.js";
import { getPredictions, getAccuracy } from "./prediction-log.js";
import { simulateEventRoute, applyEventRoute } from "./oracle-pipeline.js";

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ dest: "uploads/", limits: { fileSize: 100 * 1024 * 1024 } });

app.post("/og/upload", upload.single("file"), uploadRoute);
app.get("/og/download/:rootHash", downloadRoute);
app.post("/valuation/calculate", valuationRoute);
app.post("/breeding/recommend", breedingRoute);

app.post("/events/simulate", simulateEventRoute);
app.post("/oracle/apply-event", applyEventRoute);

app.get("/training/events", (_req, res) => {
  try {
    res.json(getTrainingData());
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get("/training/stats", (_req, res) => {
  try {
    const events = getTrainingData();
    const byType: Record<string, number> = {};
    for (const ev of events) {
      byType[ev.eventType] = (byType[ev.eventType] ?? 0) + 1;
    }
    res.json({ total: events.length, byType });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get("/predictions/log", (_req, res) => {
  try {
    res.json(getPredictions());
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get("/predictions/accuracy", (_req, res) => {
  try {
    res.json(getAccuracy());
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

const PORT = env.PORT;
app.listen(PORT, () => {
  console.log(`Secretariat server on http://localhost:${PORT}`);
  try {
    startIndexer();
  } catch (e) {
    console.warn("Failed to start event indexer:", e);
  }
});
