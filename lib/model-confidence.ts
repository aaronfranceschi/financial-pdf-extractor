import type { ExtractionRow } from "@/types";

/** Maps numeric confidence to three quality bands (aligned with deriveFieldStatus thresholds). */
export type QualityLevel = "high" | "medium" | "low";

export function confidenceTierScore(confidence: number): QualityLevel {
  if (confidence >= 78) return "high";
  if (confidence >= 62) return "medium";
  return "low";
}

export type QualityBadge = {
  /** Display text: high | medium | low, or — when empty */
  label: string;
  variant: "success" | "warning" | "danger" | "muted" | "secondary" | "outline";
};

/** Quality before human review: high / medium / low only (plus — / low for edge cases). */
export function qualityBadge(row: ExtractionRow): QualityBadge {
  const trimmed = row.value.trim();
  if (!trimmed) {
    return { label: "—", variant: "muted" };
  }
  if (row.status === "malformed") {
    return { label: "low", variant: "danger" };
  }

  const q = confidenceTierScore(row.confidence);

  if (q === "high") {
    return { label: "high", variant: "success" };
  }
  if (q === "medium") {
    return { label: "medium", variant: "secondary" };
  }
  return { label: "low", variant: "warning" };
}
