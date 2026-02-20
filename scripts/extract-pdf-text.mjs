#!/usr/bin/env node
/**
 * Extracts text from pedigree PDFs in pdf-data/ and saves as .txt files.
 * Run: node scripts/extract-pdf-text.mjs
 *
 * If PDFs are scanned/unreadable, the output will be empty or garbled.
 * In that case, use OCR (e.g. tesseract, Adobe Acrobat) to extract text
 * and save manually as .txt in pdf-data/ for parsing.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PDF_DATA = path.join(__dirname, "..", "pdf-data");

async function extractPdf(pdfPath) {
  try {
    // Use dynamic import for ESM compatibility; pdf-parse@1.1.1 exports default
    const mod = await import("pdf-parse");
    const pdf = mod.default ?? mod;
    const buf = fs.readFileSync(pdfPath);
    const data = await pdf(buf);
    return { text: data.text || "", pages: data.numpages, error: null };
  } catch (err) {
    return { text: "", pages: 0, error: err.message };
  }
}

async function main() {
  if (!fs.existsSync(PDF_DATA)) {
    console.error("pdf-data/ folder not found. Create it and add PDFs.");
    process.exit(1);
  }

  const files = fs.readdirSync(PDF_DATA).filter((f) => f.endsWith(".pdf"));
  console.log(`Found ${files.length} PDF(s) in pdf-data/\n`);

  for (const file of files) {
    const pdfPath = path.join(PDF_DATA, file);
    const txtPath = pdfPath.replace(/\.pdf$/i, ".txt");
    const name = path.basename(file, ".pdf");

    process.stdout.write(`Extracting ${file}... `);
    const { text, pages, error } = await extractPdf(pdfPath);

    if (error) {
      console.log(`ERROR: ${error}`);
      fs.writeFileSync(txtPath, `EXTRACT_ERROR: ${error}\n`, "utf8");
      continue;
    }

    if (!text || text.trim().length < 50) {
      console.log("WARNING: Little or no text extracted (scanned PDF?). Consider OCR.");
    } else {
      console.log(`OK (${pages} pages, ${text.length} chars)`);
    }

    fs.writeFileSync(txtPath, text, "utf8");
  }

  console.log("\nDone. Check pdf-data/*.txt for extracted text.");
}

main().catch(console.error);
