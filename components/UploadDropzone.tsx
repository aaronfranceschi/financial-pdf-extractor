"use client";

import { useMemo, useRef, useState } from "react";
import { ExternalLink, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isPdfFile } from "@/lib/is-pdf-file";

export type DemoSampleSlot = {
  id: string;
  label: string;
  /** Opens in a new tab so people can read the PDF before running the demo. */
  previewHref: string;
  loading?: boolean;
};

export function UploadDropzone({
  disabled,
  uploading,
  onFileChosen,
  demoSamples,
  onDemoSample,
}: {
  disabled?: boolean;
  /** True while the simulated ingress progress runs after a file is chosen. */
  uploading?: boolean;
  onFileChosen: (file: File) => void | Promise<void>;
  demoSamples?: DemoSampleSlot[];
  onDemoSample?: (id: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragHint, setDragHint] = useState<"idle" | "accepted" | "rejected">("idle");

  const busy = disabled || Boolean(uploading);

  const halo = useMemo(() => {
    if (dragHint === "accepted") return "border-primary/55 ring-4 ring-primary/10 bg-primary/[0.02]";
    if (dragHint === "rejected") return "border-rose-400/50 ring-4 ring-rose-500/10";
    return "border-zinc-200/80 hover:border-zinc-300";
  }, [dragHint]);

  async function ingest(file?: File | null) {
    if (!file || busy) return;
    try {
      await Promise.resolve(onFileChosen(file));
    } catch (err) {
      console.error(err);
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <Card className="overflow-hidden border-zinc-200/80 shadow-md">
      <CardHeader className="space-y-0 pb-3">
        <CardTitle className="text-xl sm:text-2xl">Upload Source Document</CardTitle>
      </CardHeader>

      <CardContent className="space-y-4 pb-4">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,7fr)] lg:items-stretch lg:gap-6">
          {/* Left: your file (~30% width) */}
          <div className="flex flex-col gap-2 lg:h-full">
            <p className="shrink-0 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Your PDF
            </p>
            <div
              onDragEnter={(e) => {
                e.preventDefault();
                if (busy) return;
                setDragHint("accepted");
              }}
              onDragOver={(e) => {
                e.preventDefault();
                if (busy) return;
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                  setDragHint("idle");
                }
              }}
              onDrop={async (e) => {
                e.preventDefault();
                if (busy) return;
                const f = e.dataTransfer.files?.[0];
                if (!f) {
                  setDragHint("idle");
                  return;
                }
                if (!isPdfFile(f)) {
                  setDragHint("rejected");
                  window.setTimeout(() => setDragHint("idle"), 900);
                  return;
                }
                setDragHint("accepted");
                await ingest(f);
                setDragHint("idle");
              }}
              onClick={() => {
                if (busy) return;
                inputRef.current?.click();
              }}
              onKeyDown={(e) => {
                if (busy) return;
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  inputRef.current?.click();
                }
              }}
              role="button"
              tabIndex={busy ? -1 : 0}
              aria-label="Upload PDF: click or drag and drop a file"
              className={[
                "relative flex min-h-[132px] flex-1 flex-col rounded-xl border-2 border-dashed bg-background/40 p-[1px] transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 lg:min-h-0",
                busy ? "pointer-events-none cursor-not-allowed opacity-60" : "cursor-pointer",
                halo,
              ].join(" ")}
            >
              <div className="relative flex flex-1 flex-col justify-center rounded-[11px] bg-muted/15 px-4 py-5 sm:px-5 sm:py-6 min-h-0">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border bg-card shadow-sm">
                    <Upload className="h-4 w-4 text-foreground/80" aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold leading-snug">Drag & Drop</div>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      <span className="font-mono">PDF</span> Only
                    </p>
                  </div>
                </div>

                <input
                  ref={inputRef}
                  type="file"
                  accept="application/pdf,.pdf"
                  tabIndex={-1}
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    void ingest(f);
                  }}
                />
              </div>
            </div>
          </div>

          {/* Right: sample PDFs (~70% width) */}
          <div className="flex flex-col gap-2 lg:h-full lg:min-h-0">
            <p className="shrink-0 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Sample PDFs (Demo)
            </p>
            <div className="flex flex-col gap-2.5 lg:min-h-0">
              {demoSamples?.map((s) => (
                <div
                  key={s.id}
                  className="flex flex-col gap-2.5 rounded-lg border border-zinc-200/90 bg-card px-3 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:py-3 sm:pr-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold leading-snug">{s.label}</div>
                    <a
                      href={s.previewHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1.5 inline-flex items-center gap-1 text-[13px] font-medium text-primary underline-offset-4 hover:underline"
                    >
                      View PDF
                      <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
                    </a>
                  </div>
                  <Button
                    variant="default"
                    size="sm"
                    disabled={busy || !onDemoSample}
                    type="button"
                    className="h-9 w-full shrink-0 gap-2 px-4 sm:w-auto sm:min-w-[128px]"
                    onClick={() => onDemoSample?.(s.id)}
                  >
                    {s.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Load Sample
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
