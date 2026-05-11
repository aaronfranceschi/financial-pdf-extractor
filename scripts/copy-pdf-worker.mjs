import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const src = path.join(root, "node_modules", "pdfjs-dist", "build", "pdf.worker.min.mjs");
const dest = path.join(root, "public", "pdf.worker.min.mjs");

if (!fs.existsSync(src)) {
  console.warn("copy-pdf-worker: pdf.worker.min.mjs not found, skip");
  process.exit(0);
}

fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.copyFileSync(src, dest);
console.warn("copy-pdf-worker:", path.relative(root, dest));
