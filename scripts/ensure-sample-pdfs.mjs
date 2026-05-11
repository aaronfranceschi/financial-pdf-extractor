/**
 * Writes tiny valid-ish PDF stubs into public/samples/ for offline demos.
 * Filenames steer `detectDocument(...)` routing.
 *
 * Usage: node scripts/ensure-sample-pdfs.mjs
 */
import fs from "node:fs";
import path from "node:path";

const root = path.join(process.cwd(), "public", "samples");

/* Minimal portable PDF skeleton (many viewers render a blank page). */
function minimalPdfAscii() {
  return Buffer.from(
    [
      "%PDF-1.4",
      "1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj",
      "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj",
      "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>endobj",
      "xref",
      "0 4",
      "0000000000 65535 f ",
      "0000000010 00000 n ",
      "0000000060 00000 n ",
      "0000000111 00000 n ",
      "trailer<</Size 4/Root 1 0 R>>",
      "startxref",
      "183",
      "%%EOF",
    ].join("\n"),
    "utf8",
  );
}

/** Must match `localPath` in lib/sample-documents.ts */
const stubs = ["commerce_bank.pdf", "constoso_ltd_invoice.pdf"];

fs.mkdirSync(root, { recursive: true });

const pdf = minimalPdfAscii();
for (const name of stubs) {
  const full = path.join(root, name);
  if (!fs.existsSync(full)) {
    fs.writeFileSync(full, pdf);
    console.warn("created", path.relative(process.cwd(), full));
  }
}
