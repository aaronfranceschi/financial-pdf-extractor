import type { ExtractionRow } from "@/types";

function csvEscape(cell: string) {
  if (/[,"\n]/.test(cell)) {
    return `"${cell.replace(/"/g, '""')}"`;
  }
  return cell;
}

export function exportReviewedRowsCsv(rows: ExtractionRow[]) {
  const reviewed = rows.filter((r) => r.reviewed);
  const header = ["Label", "Value", "Confidence", "Status", "RowKind", "Critical"];
  const lines = [
    header.join(","),
    ...reviewed.map((r) =>
      [
        csvEscape(r.label),
        csvEscape(r.value),
        String(r.confidence),
        csvEscape(r.status),
        csvEscape(r.rowKind),
        r.critical ? "yes" : "no",
      ].join(","),
    ),
  ];
  const csv = lines.join("\n");
  const blob = new Blob([`\ufeff${csv}`], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `financial-extract-${Date.now()}.csv`;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 250);
}

export async function exportReviewedRowsXlsx(rows: ExtractionRow[]) {
  const reviewed = rows.filter((r) => r.reviewed);
  const XLSX = await import("xlsx");
  const sheetData = reviewed.map((r) => ({
    Label: r.label,
    Value: r.value,
    Confidence: r.confidence,
    Status: r.status,
    RowKind: r.rowKind,
    Critical: r.critical ? "yes" : "no",
  }));
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(sheetData);
  XLSX.utils.book_append_sheet(wb, ws, "Reviewed fields");
  XLSX.writeFile(wb, `financial-extract-${Date.now()}.xlsx`);
}
