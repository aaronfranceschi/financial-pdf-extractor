"use client";

import type { ExtractionRow } from "@/types";
import { qualityBadge } from "@/lib/model-confidence";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { CheckCircle2, CircleAlert, FileSpreadsheet, FileText, ListChecks } from "lucide-react";

export function ReviewTable({
  rows,
  onChangeValue,
  onVerifyRow,
  onVerifyAll,
  exportToolbar,
}: {
  rows: ExtractionRow[];
  onChangeValue: (id: string, next: string) => void;
  onVerifyRow: (id: string) => void;
  onVerifyAll: () => void;
  exportToolbar: {
    disabled: boolean;
    onExportCsv: () => void;
    onExportXlsx: () => void;
  };
}) {
  const { disabled, onExportCsv, onExportXlsx } = exportToolbar;

  const canVerifyAll = rows.some(
    (r) => !r.reviewed && r.value.trim() && r.status !== "malformed",
  );

  return (
    <div className="rounded-2xl border border-zinc-200/90 bg-card shadow-lg shadow-zinc-950/10">
      <div className="flex flex-col gap-4 border-b bg-muted/25 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold leading-tight">Human Review</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Rows show the main fields extracted for review (noise trimmed when possible). Quality is high, medium,
            or low before you verify. Use Verify after you confirm values against the PDF.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={!canVerifyAll}
            className="gap-2"
            type="button"
            onClick={onVerifyAll}
          >
            <ListChecks className="h-4 w-4" />
            Verify All
          </Button>
          <Button
            size="sm"
            variant="default"
            disabled={disabled}
            className="gap-2"
            type="button"
            onClick={onExportCsv}
          >
            <FileText className="h-4 w-4" />
            Export CSV
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={disabled}
            className="gap-2"
            type="button"
            onClick={onExportXlsx}
          >
            <FileSpreadsheet className="h-4 w-4" />
            Export XLSX
          </Button>
        </div>
      </div>

      <div className="relative overflow-x-auto pb-px">
        <table className="min-w-[760px] w-full border-collapse text-sm">
          <thead className="sticky top-0 z-30 border-b bg-[color-mix(in_oklab,hsl(var(--muted))_86%,transparent)] backdrop-blur">
            <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground [&_th]:border-b [&_th]:border-zinc-200/70">
              <th className="sticky top-0 bg-[color-mix(in_oklab,hsl(var(--muted))_86%,transparent)] px-3 py-3 backdrop-blur">
                Verify
              </th>
              <th className="sticky top-0 bg-[color-mix(in_oklab,hsl(var(--muted))_86%,transparent)] px-4 py-3 backdrop-blur">
                OpenAI Structure
              </th>
              <th className="sticky top-0 bg-[color-mix(in_oklab,hsl(var(--muted))_86%,transparent)] px-4 py-3 backdrop-blur">
                Extracted Value
              </th>
              <th className="sticky top-0 bg-[color-mix(in_oklab,hsl(var(--muted))_86%,transparent)] px-4 py-3 backdrop-blur">
                Quality
              </th>
              <th className="sticky top-0 bg-[color-mix(in_oklab,hsl(var(--muted))_86%,transparent)] px-4 py-3 backdrop-blur">
                State
              </th>
              <th className="sticky top-0 bg-[color-mix(in_oklab,hsl(var(--muted))_86%,transparent)] px-4 py-3 backdrop-blur">
                Parsed As
              </th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {rows.map((r) => {
              const qualityUi = qualityBadge(r);
              const isCritical = Boolean(r.critical);
              const needsAttention =
                isCritical &&
                (!r.reviewed || r.status === "missing" || r.status === "malformed");
              const reviewIcon = r.reviewed ? (
                <Badge variant="success" className="gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Verified
                </Badge>
              ) : (
                <Badge variant="secondary" className="gap-1">
                  <CircleAlert className="h-3 w-3" />
                  Pending
                </Badge>
              );

              return (
                <tr
                  key={r.id}
                  className={cn(
                    "group border-b border-zinc-900/10 transition-colors",
                    r.reviewed
                      ? "bg-emerald-500/[0.03] hover:bg-emerald-500/[0.05]"
                      : "hover:bg-muted/40",
                    needsAttention ? "bg-rose-500/[0.04]" : "",
                  )}
                >
                  <td className="px-3 py-3 align-middle">
                    <Button
                      type="button"
                      variant={r.reviewed ? "ghost" : "outline"}
                      size="sm"
                      className="h-8 whitespace-nowrap px-2.5 text-[12px]"
                      disabled={
                        r.reviewed || r.status === "malformed" || !r.value.trim()
                      }
                      title={
                        r.reviewed
                          ? "Already verified"
                          : !r.value.trim()
                            ? "Enter a value first"
                            : r.status === "malformed"
                              ? "Fix malformed value before verifying"
                              : "Mark this row verified"
                      }
                      onClick={() => onVerifyRow(r.id)}
                    >
                      {r.reviewed ? (
                        <span className="text-muted-foreground">Done</span>
                      ) : (
                        "Verify"
                      )}
                    </Button>
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium leading-snug">{r.label}</span>
                      {isCritical && (
                        <span className="rounded-full bg-rose-500/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-rose-700 ring-1 ring-rose-500/20">
                          Critical
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="max-w-[360px] px-4 py-3 align-middle">
                    <Input
                      value={r.value}
                      onChange={(e) => onChangeValue(r.id, e.target.value)}
                      className={cn(
                        "h-11 rounded-lg border-transparent bg-muted/25 font-mono text-[13px] shadow-none transition-colors",
                        "group-hover:bg-background",
                        r.status === "malformed"
                          ? "ring-2 ring-rose-400/25 focus-visible:ring-rose-400/45"
                          : "focus-visible:ring-secondary",
                      )}
                    />
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <Badge variant={qualityUi.variant} className="shadow-sm font-medium lowercase">
                      {qualityUi.label}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 align-middle">{reviewIcon}</td>
                  <td className="px-4 py-3 align-middle font-mono text-xs text-muted-foreground">
                    {r.valueKind ?? "freeform"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex justify-end border-t bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
        <span className="font-mono tabular-nums">
          {rows.length} {rows.length === 1 ? "Row" : "Rows"}
        </span>
      </div>
    </div>
  );
}
