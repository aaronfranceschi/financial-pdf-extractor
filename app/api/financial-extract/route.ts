import OpenAI from "openai";
import { NextResponse } from "next/server";

import type { DetectionResult } from "@/types";
import {
  AI_EXTRACT_JSON_INSTRUCTION,
  type AiFinancialExtractPayload,
} from "@/lib/financial-ai-schema";
import {
  parseAiFinancialExtract,
  unwrapJsonContent,
} from "@/lib/ai-extraction-rows";

export const maxDuration = 120;

const MAX_INPUT_CHARS = 95_000;

function buildSystemPrompt(): string {
  return [
    "You are a financial document analyst. Read the supplied PDF text and return only the fields a reviewer must see—omit clutter.",
    "",
    "Include (when present): parties (vendor, bank, employer), statement or invoice period, balances or totals, taxes, amounts due, net pay, and other figures needed for reconciliation.",
    "Exclude: legal fluff, marketing lines, repeated headers/footers, page numbers, URLs, and minor figures that do not affect totals.",
    "Do not create one row per random number; merge duplicates; prefer labeled totals over scattered guesses.",
    "Normalize currencies as $12,345.67 or -$98.00; dates as ISO YYYY-MM-DD when clear, else unambiguous US MM/DD/YYYY.",
    "Mark critical: true sparingly for export/compliance anchors (totals, balances, tax IDs, amount due, net pay).",
    "If OCR is noisy, lower confidence and mention briefly in summary—still avoid filler rows.",
    "Never invent names, amounts, or IDs not supported by the text.",
    "",
    AI_EXTRACT_JSON_INSTRUCTION,
  ].join("\n");
}

function buildUserContent(detection: DetectionResult, pdfText: string): string {
  return [
    `Detected document type (heuristic): ${detection.label} (${detection.kind}).`,
    `Schema hint: ${detection.schemaTitle} — ${detection.schemaId}`,
    `Detection rationale: ${detection.rationale}`,
    "",
    "Document text follows:",
    "---",
    pdfText,
    "---",
  ].join("\n");
}

export async function POST(req: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey?.trim()) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not configured on the server." },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Expected JSON object." }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const pdfText = typeof b.pdfText === "string" ? b.pdfText : "";
  const detection = b.detection as DetectionResult | undefined;

  if (!detection || typeof detection.kind !== "string") {
    return NextResponse.json({ error: "Missing or invalid detection payload." }, { status: 400 });
  }

  const truncated =
    pdfText.length > MAX_INPUT_CHARS
      ? `${pdfText.slice(0, MAX_INPUT_CHARS)}\n\n[TRUNCATED — ${pdfText.length.toLocaleString()} total characters]`
      : pdfText;

  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o";

  const openai = new OpenAI({ apiKey });

  let content: string;
  try {
    const completion = await openai.chat.completions.create({
      model,
      temperature: 0.15,
      max_tokens: 8192,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: buildSystemPrompt() },
        { role: "user", content: buildUserContent(detection, truncated) },
      ],
    });
    content = completion.choices[0]?.message?.content ?? "";
  } catch (e) {
    const msg = e instanceof Error ? e.message : "OpenAI request failed.";
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  if (!content.trim()) {
    return NextResponse.json({ error: "Empty model response." }, { status: 502 });
  }

  let payload: AiFinancialExtractPayload;
  try {
    payload = parseAiFinancialExtract(unwrapJsonContent(content));
  } catch {
    return NextResponse.json(
      { error: "Model returned JSON that could not be parsed." },
      { status: 502 },
    );
  }

  const MAX_ROWS = 36;
  if (payload.rows.length > MAX_ROWS) {
    payload = {
      ...payload,
      rows: payload.rows.slice(0, MAX_ROWS),
      summary: [payload.summary, `(Trimmed to ${MAX_ROWS} highest-priority rows.)`]
        .filter(Boolean)
        .join(" "),
    };
  }

  return NextResponse.json({
    payload,
    meta: {
      model,
      inputChars: pdfText.length,
      truncated: pdfText.length > MAX_INPUT_CHARS,
    },
  });
}
