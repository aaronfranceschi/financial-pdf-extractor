/**
 * Demo PDFs are served from `/public/samples` by default (created by postinstall).
 * Google Drive is optional and off unless `NEXT_PUBLIC_USE_GOOGLE_DRIVE_SAMPLES=true`.
 * Drive download URLs are unreliable for programmatic fetch (HTML virus-scan pages, not raw PDFs).
 */

/** Legacy defaults — only used when Drive mode is explicitly enabled. */
const DEFAULT_BANK_FILE_ID = "1fs1WoTshFbjhmFLI1Fl05EQ4lQNojvRQ";
const DEFAULT_INVOICE_FILE_ID = "17YfJ01VD9OjJ6193XPpZLLhkXHLtkUeS";

export interface DemoPdfDefinition {
  id: string;
  label: string;
  /** Passed to inference heuristics (keyword routing). */
  filename: string;
  /** Bundled sample under public/ — always used unless Drive mode is on. */
  localPath: string;
  /** Optional direct HTTPS URL to fetch (proxied through /api/demo-pdf when set). */
  remoteFetchUrl?: string;
  /** Optional preview URL (Drive viewer, etc.) — only when Drive mode is on. */
  remotePreviewUrl?: string;
  googleDriveFileId?: string;
}

function driveFileViewUrl(fileId: string) {
  return `https://drive.google.com/file/d/${fileId.trim()}/view?usp=drivesdk`;
}

function useGoogleDriveSamples(): boolean {
  return (
    typeof process !== "undefined" &&
    process.env.NEXT_PUBLIC_USE_GOOGLE_DRIVE_SAMPLES?.trim() === "true"
  );
}

export const DEMO_PDF_DEFINITIONS: DemoPdfDefinition[] = [
  {
    id: "bank",
    label: "Bank statement",
    filename: "commerce_bank.pdf",
    localPath: "/samples/commerce_bank.pdf",
    googleDriveFileId:
      process.env.NEXT_PUBLIC_SAMPLE_PDF_BANK_FILE_ID?.trim() || DEFAULT_BANK_FILE_ID,
    remotePreviewUrl: process.env.NEXT_PUBLIC_SAMPLE_PDF_BANK_PREVIEW_URL?.trim(),
    remoteFetchUrl:
      process.env.NEXT_PUBLIC_SAMPLE_PDF_BANK_FETCH_URL?.trim() ??
      process.env.NEXT_PUBLIC_SAMPLE_PDF_BANK_URL?.trim() ??
      undefined,
  },
  {
    id: "invoice",
    label: "Invoice",
    filename: "constoso_ltd_invoice.pdf",
    localPath: "/samples/constoso_ltd_invoice.pdf",
    googleDriveFileId:
      process.env.NEXT_PUBLIC_SAMPLE_PDF_INVOICE_FILE_ID?.trim() || DEFAULT_INVOICE_FILE_ID,
    remotePreviewUrl: process.env.NEXT_PUBLIC_SAMPLE_PDF_INVOICE_PREVIEW_URL?.trim(),
    remoteFetchUrl:
      process.env.NEXT_PUBLIC_SAMPLE_PDF_INVOICE_FETCH_URL?.trim() ??
      process.env.NEXT_PUBLIC_SAMPLE_PDF_INVOICE_URL?.trim() ??
      undefined,
  },
];

/** "View PDF" — same bundled file as Load Sample unless Drive mode is enabled. */
export function resolvePreviewHref(def: DemoPdfDefinition): string {
  if (!useGoogleDriveSamples()) {
    return def.localPath;
  }

  const explicit = def.remotePreviewUrl?.trim();
  if (explicit) return explicit;

  const id = def.googleDriveFileId?.trim();
  if (id) return driveFileViewUrl(id);

  return def.localPath;
}
