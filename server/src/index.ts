import dotenv from "dotenv";
import path from "path";
// Load root .env when running from server/ (so one .env at repo root)
dotenv.config({ path: path.resolve(process.cwd(), "../.env") });
dotenv.config(); // then server/.env if present
import express from "express";
import cors from "cors";
import multer from "multer";
import fs from "fs";
import { uploadRoute } from "./og-upload.js";
import { downloadRoute } from "./og-download.js";

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ dest: "uploads/", limits: { fileSize: 100 * 1024 * 1024 } });

app.post("/og/upload", upload.single("file"), uploadRoute);
app.get("/og/download/:rootHash", downloadRoute);

const PORT = process.env.PORT ?? 4000;
app.listen(PORT, () => console.log(`Secretariat server on http://localhost:${PORT}`));
