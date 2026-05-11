/**
 * Shared JSON shape for OpenAI financial structuring responses.
 */
export interface AiFinancialRowPayload {
  section: string;
  label: string;
  value: string;
  confidence: number;
  critical?: boolean;
  rowKind?: "field" | "transaction" | "line_item";
  valueKind?: "date" | "currency" | "id" | "text";
}

export interface AiFinancialExtractPayload {
  rows: AiFinancialRowPayload[];
  summary?: string;
}

export const AI_EXTRACT_JSON_INSTRUCTION = `Return a single JSON object with this exact shape:
{
  "summary": "one short sentence on coverage or gaps (optional)",
  "rows": [
    {
      "section": "logical grouping e.g. Statement, Invoice, Totals",
      "label": "concise field name",
      "value": "normalized extracted value as plain text",
      "confidence": 0-100 integer,
      "critical": true only for must-review items (totals, balances, tax IDs, amounts due, net pay, etc.)",
      "rowKind": "field" | "transaction" | "line_item",
      "valueKind": "date" | "currency" | "id" | "text"
    }
  ]
}
Keep the row list focused: prefer roughly 8–28 rows for typical documents (hard maximum 36 rows). Omit boilerplate, disclaimers, page headers/footers, duplicate labels, and noise. For long transaction lists, include header-level totals plus up to about 12 representative transaction or line rows unless the document is short. Use only text grounded in the document.`;
