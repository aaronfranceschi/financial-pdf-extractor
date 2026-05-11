import type { DetectionResult } from "@/types";
import type { AiFinancialExtractPayload } from "@/lib/financial-ai-schema";

export interface FinancialExtractSuccess {
  ok: true;
  payload: AiFinancialExtractPayload;
  meta: { model: string; inputChars: number; truncated: boolean };
}

export interface FinancialExtractFailure {
  ok: false;
  status: number;
  error: string;
}

export type FinancialExtractResult = FinancialExtractSuccess | FinancialExtractFailure;

const EXTRACT_TIMEOUT_MS = 110_000;

export async function fetchFinancialAiExtract(
  pdfText: string,
  detection: DetectionResult,
): Promise<FinancialExtractResult> {
  let res: Response;
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), EXTRACT_TIMEOUT_MS);
  try {
    res = await fetch("/api/financial-extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pdfText, detection }),
      signal: ctrl.signal,
    });
  } catch (e) {
    const aborted =
      (typeof DOMException !== "undefined" &&
        e instanceof DOMException &&
        e.name === "AbortError") ||
      (e instanceof Error && e.name === "AbortError");
    const msg = aborted
      ? "OpenAI request timed out. Try again or use a smaller PDF."
      : e instanceof Error
        ? e.message
        : "Network error calling extraction API.";
    return { ok: false, status: 0, error: msg };
  } finally {
    clearTimeout(tid);
  }

  const data: unknown = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err =
      data && typeof data === "object" && "error" in data && typeof (data as { error: unknown }).error === "string"
        ? (data as { error: string }).error
        : `Request failed (${res.status})`;
    return { ok: false, status: res.status, error: err };
  }

  if (!data || typeof data !== "object") {
    return { ok: false, status: res.status, error: "Invalid response shape." };
  }

  const d = data as Record<string, unknown>;
  if (!d.payload || typeof d.payload !== "object") {
    return { ok: false, status: res.status, error: "Missing payload in response." };
  }

  const meta = d.meta;
  const model =
    meta && typeof meta === "object" && typeof (meta as { model?: unknown }).model === "string"
      ? (meta as { model: string }).model
      : "unknown";
  const inputChars =
    meta && typeof meta === "object" && typeof (meta as { inputChars?: unknown }).inputChars === "number"
      ? (meta as { inputChars: number }).inputChars
      : pdfText.length;
  const truncated =
    meta && typeof meta === "object" && typeof (meta as { truncated?: unknown }).truncated === "boolean"
      ? (meta as { truncated: boolean }).truncated
      : false;

  return {
    ok: true,
    payload: d.payload as AiFinancialExtractPayload,
    meta: { model, inputChars, truncated },
  };
}
