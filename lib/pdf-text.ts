/**
 * Client-side PDF text layer extraction (same bytes as View PDF and the uploaded file).
 */

export async function extractTextFromPdf(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");

  if (typeof window !== "undefined") {
    pdfjs.GlobalWorkerOptions.workerSrc = `${window.location.origin}/pdf.worker.min.mjs`;
  }

  const data = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data }).promise;
  const pageTexts: string[] = [];

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const textContent = await page.getTextContent();
    const lineParts: string[] = [];
    for (const item of textContent.items) {
      if (item && typeof item === "object" && "str" in item && typeof item.str === "string") {
        lineParts.push(item.str);
      }
    }
    pageTexts.push(lineParts.join(" "));
  }

  return pageTexts.join("\n").replace(/\u00a0/g, " ").replace(/[ \t]+\n/g, "\n").trim();
}
