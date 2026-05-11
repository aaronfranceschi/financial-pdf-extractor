import type { DetectionResult, DocumentKind, ValueKind } from "@/types";

/** Values are verbatim substrings or lines from the PDF text layer (exact extraction). */

function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

export function findIsoAndUsDates(text: string): string[] {
  const iso = Array.from(text.matchAll(/\b(20\d{2}-\d{2}-\d{2})\b/g), (m) => m[1]!);
  const us = Array.from(text.matchAll(/\b(\d{1,2}\/\d{1,2}\/(?:20)?\d{2})\b/g), (m) => m[1]!);
  return uniq([...iso, ...us]).slice(0, 8);
}

export function findDollarAmounts(text: string): string[] {
  return uniq(Array.from(text.matchAll(/\$[\d,]+\.\d{2}/g), (m) => m[0])).slice(0, 24);
}

function lineAfterLabel(text: string, label: RegExp): string {
  const m = text.match(label);
  if (!m || m.index === undefined) return "";
  const rest = text.slice(m.index + m[0].length);
  const line = rest
    .split(/\n/)
    .map((l) => l.trim())
    .find((l) => l.length > 2);
  return line?.slice(0, 240) ?? "";
}

function firstLineMatching(text: string, re: RegExp): string {
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (re.test(t)) return t.length > 280 ? `${t.slice(0, 277)}…` : t;
  }
  return "";
}

function invoiceNumberFromPdf(text: string): string {
  const patterns = [
    /(?:invoice|inv\.?)\s*#?\s*:?\s*([A-Z0-9][A-Z0-9\-/]{4,})/i,
    /\b(INV[-–—]?\d{4,})\b/i,
    /#\s*(\d{5,})\b/,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m?.[1]) return m[1].trim();
  }
  return "";
}

function totalLineFromPdf(text: string): string {
  const lower = text.toLowerCase();
  const keys = ["total due", "amount due", "balance due", "grand total", "total:", "total "];
  for (const line of text.split("\n")) {
    const t = line.trim();
    const l = t.toLowerCase();
    if (keys.some((k) => l.includes(k)) && /\$[\d,]+\.\d{2}/.test(t))
      return t.length > 280 ? `${t.slice(0, 277)}…` : t;
  }
  const m = lower.match(/(?:total|due)[^\n$]{0,40}(\$[\d,]+\.\d{2})/);
  if (m) {
    const idx = lower.indexOf(m[1]!);
    const slice = text.slice(Math.max(0, idx - 48), idx + 36).replace(/\s+/g, " ").trim();
    return slice.length > 280 ? `${slice.slice(0, 277)}…` : slice;
  }
  return "";
}

export type SemanticField = {
  label: string;
  value: string;
  valueKind?: ValueKind;
  critical?: boolean;
};

/**
 * Fixed field list per document kind. Each value is copied exactly from the PDF text where found.
 */
export function buildSemanticFieldsForKind(
  kind: DocumentKind,
  normalized: string,
): SemanticField[] {
  const dates = findIsoAndUsDates(normalized);
  const amounts = findDollarAmounts(normalized);

  switch (kind) {
    case "bank_statement": {
      const period =
        dates.length >= 2
          ? `${dates[0]} | ${dates[1]}`
          : dates[0] ?? "";
      const balanceLine = firstLineMatching(
        normalized,
        /balance|ending\s+balance|beginning\s+balance|available/i,
      );
      const activityLine = firstLineMatching(normalized, /ACH|transfer|deposit|withdraw/i);
      return [
        { label: "Statement period (dates in PDF)", value: period, valueKind: "text" },
        { label: "Balance row (exact line)", value: balanceLine, valueKind: "text" },
        { label: "Activity row (exact line)", value: activityLine, valueKind: "text" },
        {
          label: "First currency token (exact)",
          value: amounts[0] ?? "",
          valueKind: amounts[0] ? "currency" : "text",
        },
      ];
    }
    case "invoice": {
      const invNo = invoiceNumberFromPdf(normalized);
      const invDate = dates[0] ?? "";
      const due = lineAfterLabel(normalized, /(?:due\s*date|payment\s*due)/i);
      const totalLine = totalLineFromPdf(normalized);
      const billTo = lineAfterLabel(normalized, /bill\s*to|sold\s*to/i);
      return [
        { label: "Invoice number", value: invNo, valueKind: invNo ? "id" : "text" },
        { label: "Invoice date", value: invDate, valueKind: invDate ? "date" : "text" },
        { label: "Due date / terms line", value: due, valueKind: "text" },
        { label: "Total / amount due line", value: totalLine, valueKind: "text" },
        { label: "Bill-to line", value: billTo, valueKind: "text" },
      ];
    }
    case "pay_stub": {
      const earnings = firstLineMatching(normalized, /gross|net\s*pay|ytd/i);
      return [
        { label: "Pay period date", value: dates[0] ?? "", valueKind: "text" },
        { label: "Earnings row (exact line)", value: earnings, valueKind: "text" },
        {
          label: "First pay amount (exact)",
          value: amounts[0] ?? "",
          valueKind: amounts[0] ? "currency" : "text",
        },
      ];
    }
    case "w2":
    case "form_1099": {
      const amtLine = firstLineMatching(normalized, /box\s*\d|wages|withholding|1099/i);
      return [
        { label: "Tax year / date", value: dates[0] ?? "", valueKind: "text" },
        { label: "Wages / box line (exact)", value: amtLine, valueKind: "text" },
        {
          label: "Amount token (exact)",
          value: amounts[0] ?? "",
          valueKind: amounts[0] ? "currency" : "text",
        },
      ];
    }
    case "generic_financial":
    default: {
      const datesJoined = dates.length ? dates.join(", ") : "";
      const amountsJoined = amounts.length ? amounts.slice(0, 12).join(", ") : "";
      const firstLine = normalized.split("\n").find((l) => l.trim().length > 8)?.trim() ?? "";
      return [
        { label: "Dates (exact tokens)", value: datesJoined, valueKind: "text" },
        { label: "Currency tokens (exact)", value: amountsJoined, valueKind: "text" },
        {
          label: "First text line (exact)",
          value: firstLine.length > 280 ? `${firstLine.slice(0, 277)}…` : firstLine,
          valueKind: "text",
        },
      ];
    }
  }
}

/** Output of the classifier step only (not PDF field copies). */
export function classifierOutputRows(detection: DetectionResult): SemanticField[] {
  return [
    { label: "Document class", value: detection.label, valueKind: "text", critical: true },
    { label: "Schema", value: detection.schemaTitle, valueKind: "text" },
    { label: "Classifier notes", value: detection.rationale, valueKind: "text" },
    {
      label: "Routing",
      value: detection.usedFallback ? "Broad layout (weak cues)" : "Targeted layout",
      valueKind: "text",
    },
  ];
}
