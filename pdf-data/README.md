# PDF Pedigree Data

Pedigree PDFs and extracted text for famous racehorses.

## Extraction

Run from project root:

```bash
npm run extract:pdf
```

This extracts text from all `.pdf` files and saves as `.txt` in this folder.

## Scanned PDFs / OCR

If a PDF is scanned (image-based) rather than text-based, extraction will yield little or no text. In that case:

1. **OCR the PDF** using:
   - [Tesseract](https://github.com/tesseract-ocr/tesseract): `tesseract input.pdf output`
   - Adobe Acrobat: File → Export To → Text
   - Online OCR tools

2. **Save the extracted text** as `HorseName pedigree.txt` (or `HorseName offspring.txt`) in this folder.

3. The static pedigree data in `app/lib/pdf-pedigree-data.ts` can be updated manually from the text, or a parser can be extended to read the OCR output format.

## Data Flow

- `app/lib/pdf-pedigree-data.ts` – static `PedigreeNode` trees keyed by horse name
- `PedigreeTree` component – looks up by `horseName` first; falls back to on-chain `buildPedigreeTree(tokenId)`
- Horse detail page (Overview & Breeding tabs) – shows pedigree from PDF when name matches, otherwise from chain
