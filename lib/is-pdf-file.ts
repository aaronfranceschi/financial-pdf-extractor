/**
 * PDF uploads are inconsistent across OS/browser (MIME may be empty or octet-stream).
 * Require .pdf extension when MIME is generic; accept standard PDF MIME when extension is missing.
 */
export function isPdfFile(file: File): boolean {
  const name = file.name.toLowerCase();
  const hasPdfExtension = name.endsWith(".pdf");
  const t = (file.type || "").toLowerCase();

  const ambiguousOk =
    t === "" ||
    t === "application/pdf" ||
    t === "application/x-pdf" ||
    t === "application/octet-stream" ||
    t === "binary/octet-stream" ||
    t === "application/x-download";

  if (hasPdfExtension) {
    return ambiguousOk;
  }

  return t === "application/pdf" || t === "application/x-pdf";
}

/** First bytes of real PDFs are `%PDF` (drag/drop sometimes sends odd MIME types). */
export async function isLikelyPdfByMagicBytes(file: File): Promise<boolean> {
  const buf = await file.slice(0, 5).arrayBuffer();
  const u = new Uint8Array(buf);
  if (u.length < 4) return false;
  const sig = String.fromCharCode(u[0]!, u[1]!, u[2]!, u[3]!);
  return sig === "%PDF";
}
