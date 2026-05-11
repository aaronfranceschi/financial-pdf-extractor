import type { ExtractionRow, FieldStatus, ValueKind } from "@/types";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const US_DATE = /^\d{1,2}\/\d{1,2}\/\d{4}$/;

export function isMalformedValue(value: string, kind?: ValueKind): boolean {
  const v = value.trim();
  if (!v) return false;
  if (!kind || kind === "text") {
    if (/\b20\d{2}-\d{2}-\d{2}\b/.test(v)) {
      const m = v.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
      if (m) {
        const mo = Number(m[2]);
        const day = Number(m[3]);
        if (mo < 1 || mo > 12 || day < 1 || day > 31) return true;
      }
    }
    if (US_DATE.test(v)) {
      const [mm, dd] = v.split("/").map((x) => Number(x));
      if (mm > 12 || dd > 31) return true;
    }
    return false;
  }
  if (kind === "date") {
    if (ISO_DATE.test(v)) {
      const parts = v.split("-").map(Number);
      const mo = parts[1] ?? 0;
      const day = parts[2] ?? 0;
      if (mo < 1 || mo > 12 || day < 1 || day > 31) return true;
      return false;
    }
    if (US_DATE.test(v)) {
      const [mm, dd, yy] = v.split("/").map(Number);
      if (mm > 12 || dd > 31 || yy < 1900) return true;
      return false;
    }
    if (/invalid|unkn|n\/a/i.test(v)) return true;
    return true;
  }
  if (kind === "currency") {
    const cleaned = v.replace(/[$,]/g, "").replace(/\s+/g, "");
    if (cleaned === "" || cleaned === "-") return false;
    if (!/^[-+]?\d*(\.\d+)?$/.test(cleaned)) return true;
    return false;
  }
  if (kind === "id") {
    if (v.length < 4) return true;
    if (/XX-XXX|••••|\*{3,}/.test(v)) return false;
    if (!/[0-9A-Za-z]/.test(v)) return true;
    return false;
  }
  return false;
}

export function deriveFieldStatus(
  value: string,
  confidence: number,
  reviewed: boolean,
  valueKind?: ValueKind,
): FieldStatus {
  const trimmed = value.trim();
  if (!trimmed) return "missing";
  if (isMalformedValue(trimmed, valueKind)) return "malformed";
  if (reviewed) return "verified";
  if (confidence < 62) return "low_confidence";
  /** Model score is decent, but the cell is not human-verified yet — do not treat as “looks fine”. */
  return "pending_review";
}

/** One-click acknowledge: same value, marked reviewed (export eligibility follows gates). */
export function verifyRowAcknowledged(row: ExtractionRow): ExtractionRow {
  const reviewed = true;
  const status = deriveFieldStatus(row.value, row.confidence, reviewed, row.valueKind);
  return { ...row, reviewed, status };
}

export function normalizeRowAfterEdit(row: ExtractionRow, nextValue: string): ExtractionRow {
  const value = nextValue;
  const reviewed = true;
  const status = deriveFieldStatus(value, row.confidence, reviewed, row.valueKind);
  return {
    ...row,
    value,
    reviewed,
    status,
    confidence:
      row.status === "malformed" && status === "verified"
        ? Math.max(row.confidence, 82)
        : row.confidence,
  };
}

/** Export gate: unresolved critical anchors or blocker statuses. */
export function computeCriticalBlocking(rows: ExtractionRow[]): boolean {
  return rows.some(
    (r) =>
      Boolean(r.critical) &&
      (!r.reviewed || r.status === "missing" || r.status === "malformed"),
  );
}

export function exportGateMessages(rows: ExtractionRow[]): string[] {
  const reviewedCount = rows.filter((r) => r.reviewed).length;
  const msgs: string[] = [];

  if (reviewedCount === 0) {
    msgs.push("Export needs at least one verified row. Click Verify or edit a cell.");
  }

  const critical = rows.filter((r) => r.critical);

  const missingCriticalLabels = critical
    .filter((r) => r.status === "missing")
    .map((r) => r.label.slice(0, 80));

  const malformedCriticalLabels = critical
    .filter((r) => r.status === "malformed")
    .map((r) => r.label.slice(0, 80));

  const untouchedCriticalLabels = critical
    .filter((r) => !r.reviewed)
    .map((r) => r.label.slice(0, 80));

  missingCriticalLabels.forEach((lbl) =>
    msgs.push(`Critical "${lbl}" is empty. Add a value before exporting.`),
  );
  malformedCriticalLabels.forEach((lbl) =>
    msgs.push(`Critical "${lbl}" is still blocking. Fix the malformed value.`),
  );
  const seenLabels = new Map<string, boolean>();
  untouchedCriticalLabels.forEach((lbl) => {
    if (seenLabels.has(lbl)) return;
    seenLabels.set(lbl, true);
    msgs.push(`Critical "${lbl}" is unacknowledged. Click Verify or edit the cell.`);
  });

  const seenMessages = new Map<string, boolean>();
  return msgs.filter((m) => {
    if (seenMessages.has(m)) return false;
    seenMessages.set(m, true);
    return true;
  });
}
