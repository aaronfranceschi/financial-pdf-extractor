import type { DetectionResult, ExtractionRow } from "@/types";
import { deriveFieldStatus } from "@/lib/validation";
import {
  buildSemanticFieldsForKind,
  classifierOutputRows,
  findDollarAmounts,
} from "@/lib/pdf-semantic-extraction";

let rowSeq = 0;

function rid() {
  rowSeq += 1;
  return `pdf-${rowSeq}`;
}

function mk(
  section: string,
  label: string,
  value: string,
  confidence: number,
  opts: Partial<
    Pick<ExtractionRow, "critical" | "rowKind" | "valueKind" | "reviewed">
  > = {},
): ExtractionRow {
  const reviewed = opts.reviewed ?? false;
  const valueKind = opts.valueKind;
  const status = deriveFieldStatus(value, confidence, reviewed, valueKind);
  return {
    id: rid(),
    section,
    label,
    value,
    confidence,
    status,
    reviewed,
    critical: opts.critical,
    rowKind: opts.rowKind ?? "field",
    valueKind,
  };
}

/** Same PDF text → same hash → stable downstream jitter. */
export function hashPdfContent(text: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

function stableConf(seed: number, index: number, base: number): number {
  const mix = ((seed >>> (index % 13)) ^ (index * 2654435761)) >>> 0;
  const delta = (mix % 19) - 9;
  return Math.max(44, Math.min(94, base + delta));
}

export function buildRowsFromPdfText(
  text: string,
  detection: DetectionResult,
  seed: number,
  options: { partialFilename?: boolean; readError?: boolean } = {},
): ExtractionRow[] {
  rowSeq = 0;
  const rows: ExtractionRow[] = [];
  const normalized = text.replace(/\r\n/g, "\n").trim();

  if (options.readError) {
    rows.push(
      mk(
        "Extraction",
        "Reader status",
        "PDF.js could not extract text from this file.",
        48,
        { valueKind: "text", critical: true },
      ),
    );
    return rows;
  }

  if (!normalized.length) {
    rows.push(
      mk(
        "Extraction",
        "Selectable text",
        "None found. This may be image-only or scanned (no text layer). Open View PDF to confirm.",
        52,
        { valueKind: "text", critical: true },
      ),
    );
    return rows;
  }

  const thin = normalized.length < 120 || options.partialFilename;
  const lines = normalized
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  /* ── Layer 1: classifier output (PDF → class labels) ── */
  let idx = 0;
  for (const f of classifierOutputRows(detection)) {
    rows.push(
      mk(
        "AI classification",
        f.label,
        f.value,
        stableConf(seed, 10 + idx, 86),
        { valueKind: f.valueKind, critical: f.critical },
      ),
    );
    idx += 1;
  }

  /* ── Layer 2: structured extraction (class + text → semantic fields) ── */
  const semantic = buildSemanticFieldsForKind(detection.kind, normalized);
  semantic.forEach((f, i) => {
    rows.push(
      mk(
        "Extracted from PDF",
        f.label,
        f.value,
        stableConf(seed, 40 + i, 76),
        { valueKind: f.valueKind, critical: f.critical },
      ),
    );
  });

  /* Diagnostics (compact, not raw PDF field names only) */
  rows.push(
    mk(
      "Diagnostics",
      "Source stats",
      `${normalized.length} characters · ${lines.length} non-empty lines`,
      stableConf(seed, 2, 88),
      { valueKind: "text" },
    ),
  );

  const uniqAmounts = findDollarAmounts(normalized);
  if (uniqAmounts.length) {
    rows.push(
      mk(
        "Diagnostics",
        "Currency tokens (aggregated)",
        uniqAmounts.slice(0, 20).join(" · "),
        stableConf(seed, 3, 80),
        { valueKind: "text" },
      ),
    );
  }

  const previewCap = 680;
  const preview =
    normalized.length > previewCap ? `${normalized.slice(0, previewCap)}…` : normalized;
  rows.push(
    mk(
      "Full PDF text",
      "Continuous text (first slice, exact from PDF)",
      preview,
      stableConf(seed, 28, 74),
      { valueKind: "text" },
    ),
  );

  /* Verbatim source lines for spot-checking against the grid above */
  const maxRef = Math.min(10, lines.length);
  for (let i = 0; i < maxRef; i++) {
    const line = lines[i]!;
    const truncated = line.length > 220 ? `${line.slice(0, 217)}…` : line;
    const hasMoney = /\$[\d,]+/.test(line);
    rows.push(
      mk(
        "PDF lines (verbatim)",
        `Line ${i + 1}`,
        truncated,
        stableConf(seed, 60 + i, hasMoney ? 78 : 68),
        { rowKind: "transaction", valueKind: "text" },
      ),
    );
  }

  if (thin) {
    rows.push(
      mk(
        "Diagnostics",
        "Coverage warning",
        "Little selectable text or weak filename cues. Compare extracted fields to the PDF.",
        stableConf(seed, 99, 62),
        { valueKind: "text" },
      ),
    );
  }

  return rows;
}
