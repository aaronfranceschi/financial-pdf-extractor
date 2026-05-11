import type {
  AiFinancialExtractPayload,
  AiFinancialRowPayload,
} from "@/lib/financial-ai-schema";
import type { ExtractionRow, RowKind, ValueKind } from "@/types";
import { deriveFieldStatus } from "@/lib/validation";

let seq = 0;

function nextId() {
  seq += 1;
  return `ai-${seq}`;
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function asRowKind(x: unknown): RowKind {
  if (x === "transaction" || x === "line_item") return x;
  return "field";
}

function asValueKind(x: unknown): ValueKind | undefined {
  if (x === "date" || x === "currency" || x === "id" || x === "text") return x;
  return undefined;
}

function coercePayloadRow(raw: Record<string, unknown>): AiFinancialRowPayload | null {
  const section = typeof raw.section === "string" ? raw.section.trim() : "";
  const label = typeof raw.label === "string" ? raw.label.trim() : "";
  const value = typeof raw.value === "string" ? raw.value : String(raw.value ?? "");
  if (!section && !label) return null;

  let confidence = 70;
  if (typeof raw.confidence === "number" && Number.isFinite(raw.confidence)) {
    confidence = clamp(Math.round(raw.confidence), 0, 100);
  }

  return {
    section: section || "General",
    label: label || "Field",
    value,
    confidence,
    critical: raw.critical === true,
    rowKind: asRowKind(raw.rowKind),
    valueKind: asValueKind(raw.valueKind),
  };
}

/** Strip accidental markdown code fences from model output. */
export function unwrapJsonContent(content: string): string {
  let s = content.trim();
  if (s.startsWith("```")) {
    s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  }
  return s.trim();
}

export function parseAiFinancialExtract(jsonText: string): AiFinancialExtractPayload {
  const parsed: unknown = JSON.parse(jsonText);
  if (!parsed || typeof parsed !== "object") {
    return { rows: [] };
  }
  const obj = parsed as Record<string, unknown>;
  const rowsRaw = obj.rows;
  const rows: AiFinancialRowPayload[] = [];
  if (Array.isArray(rowsRaw)) {
    for (const item of rowsRaw) {
      if (item && typeof item === "object") {
        const r = coercePayloadRow(item as Record<string, unknown>);
        if (r) rows.push(r);
      }
    }
  }
  const summary = typeof obj.summary === "string" ? obj.summary : undefined;
  return { rows, summary };
}

export function aiPayloadRowsToExtractionRows(payload: AiFinancialExtractPayload): ExtractionRow[] {
  seq = 0;
  const out: ExtractionRow[] = [];
  for (const p of payload.rows) {
    const reviewed = false;
    const valueKind = p.valueKind;
    const status = deriveFieldStatus(p.value, p.confidence, reviewed, valueKind);
    out.push({
      id: nextId(),
      section: p.section,
      label: p.label,
      value: p.value,
      confidence: p.confidence,
      status,
      reviewed,
      critical: p.critical,
      rowKind: p.rowKind ?? "field",
      valueKind,
    });
  }
  return out;
}

export function appendDiagnosticsRow(
  rows: ExtractionRow[],
  opts: { charCount: number; model: string; summary?: string },
): ExtractionRow[] {
  const parts = [
    `${opts.charCount.toLocaleString()} characters analyzed`,
    `model ${opts.model}`,
  ];
  if (opts.summary?.trim()) parts.push(opts.summary.trim());

  const summaryText = parts.join(" · ");
  const diag: ExtractionRow = {
    id: nextId(),
    section: "AI extraction",
    label: "Run summary",
    value: summaryText,
    confidence: 88,
    status: deriveFieldStatus(summaryText, 88, false, "text"),
    reviewed: false,
    critical: false,
    rowKind: "field",
    valueKind: "text",
  };
  return [...rows, diag];
}
