"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import type {
  AppErrorKind,
  DetectionResult,
  ExtractionRow,
  PipelineStep,
  ProcessingStatus,
  UploadedFileMeta,
} from "@/types";
import { UploadDropzone } from "@/components/UploadDropzone";
import { ProcessingTimeline } from "@/components/ProcessingTimeline";
import { ReviewTable } from "@/components/ReviewTable";
import { ErrorState } from "@/components/ErrorState";

import { detectDocument } from "@/lib/detection";
import { extractTextFromPdf } from "@/lib/pdf-text";
import { aiPayloadRowsToExtractionRows } from "@/lib/ai-extraction-rows";
import { fetchFinancialAiExtract } from "@/lib/fetch-ai-extraction";
import { buildRowsFromPdfText, hashPdfContent } from "@/lib/pdf-extraction-rows";
import { exportReviewedRowsCsv, exportReviewedRowsXlsx } from "@/lib/export";
import {
  computeCriticalBlocking,
  normalizeRowAfterEdit,
  verifyRowAcknowledged,
} from "@/lib/validation";

import { DEMO_PDF_DEFINITIONS, resolvePreviewHref } from "@/lib/sample-documents";
import { isLikelyPdfByMagicBytes, isPdfFile } from "@/lib/is-pdf-file";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fingerprintFile(file: File) {
  const slice = await file.slice(0, 16_384).arrayBuffer();
  const bytes = new Uint8Array(slice);
  let sum = 0;
  for (let i = 0; i < bytes.length; i++) sum += bytes[i]!;
  return sum + file.size;
}

function makeSteps(): PipelineStep[] {
  return [
    { id: "upload_received", label: "Upload Received", state: "pending" },
    { id: "analyzing", label: "Analyze Document", state: "pending" },
    { id: "detecting_type", label: "Detect Type", state: "pending" },
    { id: "extracting_text", label: "Read PDF Text", state: "pending" },
    { id: "ai_organize", label: "Structure", state: "pending" },
    { id: "review_prep", label: "Prep Review Desk", state: "pending" },
    { id: "ready_export", label: "Ready", state: "pending" },
  ];
}

function workflowStatusLabel(workflow: ProcessingStatus): string {
  switch (workflow) {
    case "idle":
      return "Idle";
    case "uploading":
      return "Uploading";
    case "processing":
      return "Running";
    case "ready":
      return "Complete";
    case "error":
      return "Halted";
    default:
      return "Idle";
  }
}

export function FinancialWorkflow() {
  const runLock = useRef(false);

  const [workflow, setWorkflow] = useState<ProcessingStatus>("idle");
  const [fileMeta, setFileMeta] = useState<UploadedFileMeta | null>(null);

  const [errorKind, setErrorKind] = useState<AppErrorKind>(null);
  const [errorDetail, setErrorDetail] = useState<string | undefined>(undefined);

  const [steps, setSteps] = useState<PipelineStep[]>(() => makeSteps());
  const [rows, setRows] = useState<ExtractionRow[]>([]);
  const [partialRun, setPartialRun] = useState(false);
  const [heuristicFallback, setHeuristicFallback] = useState(false);
  const [busySampleId, setBusySampleId] = useState<string | null>(null);

  const resetFromUpload = useCallback(() => {
    runLock.current = false;
    setWorkflow("idle");
    setFileMeta(null);
    setErrorKind(null);
    setErrorDetail(undefined);
    setSteps(makeSteps());
    setRows([]);
    setPartialRun(false);
    setHeuristicFallback(false);
  }, []);

  const onChangeCell = useCallback((id: string, next: string) => {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? normalizeRowAfterEdit(r, next) : r)),
    );
  }, []);

  const onVerifyRow = useCallback((id: string) => {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? verifyRowAcknowledged(r) : r)),
    );
  }, []);

  const onVerifyAll = useCallback(() => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.reviewed || !r.value.trim() || r.status === "malformed") return r;
        return verifyRowAcknowledged(r);
      }),
    );
  }, []);

  const reviewedCount = useMemo(() => rows.filter((r) => r.reviewed).length, [rows]);
  const criticalBlocking = useMemo(() => computeCriticalBlocking(rows), [rows]);

  const exportDisabled =
    workflow !== "ready" || criticalBlocking || reviewedCount === 0;

  const uploadLocked = workflow === "uploading" || workflow === "processing";

  const mutateSteps = (
    updater: (
      curr: PipelineStep[],
      helpers: {
        activate: (index: number) => PipelineStep[];
        completeThrough: (index: number) => PipelineStep[];
      },
    ) => PipelineStep[],
  ) => {
    setSteps((curr) =>
      updater(curr, {
        activate: (idx) =>
          curr.map((s, i) => ({
            ...s,
            state:
              i < idx ? ("complete" as const) : i === idx ? ("active" as const) : ("pending" as const),
          })),
        completeThrough: (idx) =>
          curr.map((s, i) => ({
            ...s,
            state: i <= idx ? ("complete" as const) : ("pending" as const),
          })),
      }),
    );
  };

  const runPipeline = useCallback(async (file: File) => {
    let detected: DetectionResult | null = null;

    try {
      const sample = await fingerprintFile(file);

      mutateSteps((_, h) => h.activate(0));
      await sleep(640);
      mutateSteps((_, h) => h.completeThrough(0));

      mutateSteps((_, h) => h.activate(1));
      await sleep(780);
      mutateSteps((_, h) => h.completeThrough(1));

      mutateSteps((_, h) => h.activate(2));
      await sleep(240);
      detected = detectDocument(file.name, sample);
      await sleep(720);
      mutateSteps((_, h) => h.completeThrough(2));

      mutateSteps((_, h) => h.activate(3));
      let pdfText = "";
      let readError = false;
      try {
        pdfText = await extractTextFromPdf(file);
      } catch (err) {
        readError = true;
        console.error(err);
      }
      await sleep(520);
      mutateSteps((_, h) => h.completeThrough(3));

      mutateSteps((_, h) => h.activate(4));

      const contentSeed = (hashPdfContent(pdfText) ^ sample) >>> 0;
      const thinText = !readError && pdfText.trim().length < 120;
      setPartialRun(thinText);

      const heuristicOpts = {
        partialFilename: false,
        readError,
      };

      let nextRows: ExtractionRow[] = [];
      type Fallback = "none" | "no_text" | "ai_failed" | "ai_empty";
      let extractionFallback: Fallback = "none";

      if (readError || !pdfText.trim()) {
        extractionFallback = "no_text";
        nextRows = buildRowsFromPdfText(pdfText, detected!, contentSeed, heuristicOpts);
        setHeuristicFallback(true);
      } else {
        const ai = await fetchFinancialAiExtract(pdfText, detected!);
        if (ai.ok && ai.payload.rows.length > 0) {
          nextRows = aiPayloadRowsToExtractionRows(ai.payload);
          setHeuristicFallback(false);
        } else {
          extractionFallback = ai.ok ? "ai_empty" : "ai_failed";
          nextRows = buildRowsFromPdfText(pdfText, detected!, contentSeed, heuristicOpts);
          setHeuristicFallback(true);
          if (!ai.ok) {
            toast.message("OpenAI structuring unavailable", {
              description:
                ai.status === 503
                  ? "Add OPENAI_API_KEY on the server (.env.local), then restart. Showing heuristic extraction."
                  : `${ai.error} Showing heuristic extraction.`,
            });
          } else {
            toast.message("AI returned no rows", {
              description: "Showing heuristic extraction from PDF text.",
            });
          }
        }
      }

      setRows(nextRows);
      await sleep(620);
      mutateSteps((_, h) => h.completeThrough(4));

      mutateSteps((_, h) => h.activate(5));
      await sleep(900);
      mutateSteps((_, h) => h.completeThrough(5));

      mutateSteps((_, h) => h.activate(6));
      await sleep(380);
      mutateSteps((_, h) => h.completeThrough(6));

      setWorkflow("ready");
      toast.success("Processing Complete", {
        description:
          extractionFallback === "no_text"
            ? "Heuristic extraction only (PDF text missing or unread). Verify against the source document."
            : extractionFallback !== "none"
              ? "Local heuristics filled in where OpenAI did not produce rows. Spot-check before export."
              : "AI returned a focused field set. Verify amounts against the PDF before export.",
      });
    } catch (e) {
      setWorkflow("error");
      setErrorKind("corrupted");
      setErrorDetail(
        "Something went wrong while reading or structuring this PDF. Try another file or reload the page.",
      );
      console.error(e);
    }
  }, []);

  const handleFileChosen = useCallback(
    async (file: File) => {
      const acceptable =
        isPdfFile(file) || (await isLikelyPdfByMagicBytes(file).catch(() => false));
      if (!acceptable) {
        toast.error("Unsupported Document", {
          description: "This workflow accepts PDF files only.",
        });
        setErrorKind("unsupported");
        setErrorDetail(undefined);
        setWorkflow("idle");
        setFileMeta(null);
        setSteps(makeSteps());
        setPartialRun(false);
        setHeuristicFallback(false);
        return;
      }

      if (runLock.current) {
        toast.message("Already processing", {
          description: "Wait for the current document to finish or reset with Clear and Retry.",
        });
        return;
      }
      runLock.current = true;

      setErrorKind(null);
      setErrorDetail(undefined);
      setRows([]);
      setPartialRun(false);
      setHeuristicFallback(false);
      setSteps(makeSteps());

      try {
        setWorkflow("uploading");
        await animateUploadCycle(file);
        setWorkflow("processing");
        await runPipeline(file);
      } catch (e) {
        console.error(e);
        setWorkflow("error");
        setErrorKind("corrupted");
        setErrorDetail(
          e instanceof Error
            ? e.message
            : "Something went wrong while processing this PDF. Try again or use a different file.",
        );
        toast.error("Could Not Finish Processing", {
          description:
            e instanceof Error ? e.message : "Check the browser console for details.",
        });
      } finally {
        runLock.current = false;
      }
    },
    [runPipeline],
  );

  async function animateUploadCycle(file: File) {
    const meta: UploadedFileMeta = {
      name: file.name,
      size: file.size,
      uploadedAt: new Date().toISOString(),
    };
    setFileMeta(meta);
    await sleep(380);
  }

  const loadDemoPdfById = useCallback(
    async (sampleId: string) => {
      if (uploadLocked || runLock.current) {
        toast.message("Busy", {
          description: "Wait for the current run to finish, then try Load Sample again.",
        });
        return;
      }
      const def = DEMO_PDF_DEFINITIONS.find((d) => d.id === sampleId);
      if (!def) return;

      setBusySampleId(def.id);

      try {
        const localUrl = new URL(def.localPath, window.location.origin).href;
        let res = await fetch(localUrl, { cache: "no-store" });

        // Optional: env may point at a direct HTTPS PDF URL (not Google Drive).
        if (!res.ok && def.remoteFetchUrl?.trim()) {
          const proxied = `/api/demo-pdf?url=${encodeURIComponent(def.remoteFetchUrl.trim())}`;
          res = await fetch(new URL(proxied, window.location.origin).href, {
            cache: "no-store",
          });
        }

        if (!res.ok) {
          toast.error("Could Not Load Demo PDF", {
            description:
              "Bundled samples live under public/samples. Run: npm run postinstall — or: node scripts/ensure-sample-pdfs.mjs",
          });
          return;
        }

        const blob = await res.blob();
        const file = new File([blob], def.filename, {
          type: blob.type === "application/pdf" ? blob.type : "application/pdf",
        });

        await handleFileChosen(file);
      } catch (err) {
        toast.error("Demo PDF Failed");
        console.error(err);
      } finally {
        setBusySampleId(null);
      }
    },
    [handleFileChosen, uploadLocked],
  );

  const demoSamples = useMemo(
    () =>
      DEMO_PDF_DEFINITIONS.map((def) => ({
        id: def.id,
        label: def.label,
        previewHref: resolvePreviewHref(def),
        loading: busySampleId === def.id,
      })),
    [busySampleId],
  );

  const handleExportCsv = useCallback(() => {
    if (exportDisabled) {
      toast.message("Export Blocked", {
        description: "Review critical fields and ensure at least one reviewed row before export.",
      });
      return;
    }
    const reviewed = rows.filter((r) => r.reviewed);
    exportReviewedRowsCsv(reviewed);
    toast.success("CSV Exported", {
      description: `${reviewed.length} reviewed rows included.`,
    });
  }, [exportDisabled, rows]);

  const handleExportXlsx = useCallback(async () => {
    if (exportDisabled) {
      toast.message("Export Blocked", {
        description: "Review critical fields and ensure at least one reviewed row before export.",
      });
      return;
    }
    try {
      const reviewed = rows.filter((r) => r.reviewed);
      await exportReviewedRowsXlsx(reviewed);
      toast.success("XLSX Exported", {
        description: `${reviewed.length} reviewed rows included.`,
      });
    } catch (e) {
      toast.error("XLSX Export Failed");
      console.error(e);
    }
  }, [exportDisabled, rows]);

  const showReview = workflow === "ready";

  const showPartialBanner =
    partialRun &&
    workflow === "ready" &&
    rows.some((r) => r.status === "missing" || r.status === "malformed");

  const showOrchestration = Boolean(fileMeta && workflow !== "uploading");
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 pb-20">
      <header className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Financial PDFs
        </p>
        <h1 className="text-pretty text-3xl font-semibold tracking-tight sm:text-4xl">
          PDF Extraction, Organized with OpenAI
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
        Drop in your PDF and we'll take care of the rest, pulling out amounts and dates, tidying everything up, and laying it all out for you to review. When you're happy with how it looks, export to CSV or Excel in one click.
        </p>
      </header>

      {errorKind ? (
        <ErrorState
          kind={errorKind}
          detail={errorDetail}
          onRetry={() => {
            resetFromUpload();
            toast.message("Workflow Reset", { description: "Upload a fresh PDF to continue." });
          }}
        />
      ) : null}

      <UploadDropzone
        disabled={uploadLocked}
        uploading={workflow === "uploading"}
        onFileChosen={handleFileChosen}
        demoSamples={demoSamples}
        onDemoSample={loadDemoPdfById}
      />

      {showOrchestration && (
        <div className="flex flex-col gap-6">
          <section className="rounded-2xl border border-zinc-200/80 bg-card p-4 shadow-sm sm:p-5">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold">Processing Steps</h2>
                {fileMeta ? (
                  <p
                    className="mt-1 truncate text-xs font-medium text-foreground/90"
                    title={fileMeta.name}
                  >
                    {fileMeta.name}
                  </p>
                ) : null}
                <p className="mt-1 text-xs text-muted-foreground">
                  <span className="font-mono text-foreground">
                    {workflowStatusLabel(workflow)}
                  </span>
                </p>
              </div>
            </div>
            <ProcessingTimeline steps={steps} />
          </section>

          {workflow === "processing" ? (
            <div className="rounded-xl border border-zinc-200/80 bg-muted/25 px-4 py-3 text-sm text-muted-foreground">
              The review grid and exports appear below when extraction completes.
            </div>
          ) : null}
        </div>
      )}

      {showPartialBanner && (
        <div className="rounded-2xl border border-amber-200/70 bg-amber-50/50 p-4 text-sm leading-relaxed text-amber-950 shadow-sm">
          <div className="font-semibold">Partial Extraction Detected</div>
          <div className="mt-1 text-amber-950/80">
            Extraction looks thin or uneven. Double-check highlighted cells before you export from the
            review toolbar.
          </div>
        </div>
      )}

      {showReview && heuristicFallback && (
        <div className="rounded-2xl border border-sky-200/80 bg-sky-50/40 p-4 text-sm leading-relaxed text-sky-950 shadow-sm">
          <div className="font-semibold">Heuristic fallback</div>
          <div className="mt-1 text-sky-950/85">
            OpenAI did not produce the primary grid (missing API key, error, or empty response). Values below
            mix PDF text heuristics with diagnostics—verify carefully before exporting.
          </div>
        </div>
      )}

      {showReview && (
        <ReviewTable
          rows={rows}
          onChangeValue={onChangeCell}
          onVerifyRow={onVerifyRow}
          onVerifyAll={onVerifyAll}
          exportToolbar={{
            disabled: exportDisabled,
            onExportCsv: handleExportCsv,
            onExportXlsx: handleExportXlsx,
          }}
        />
      )}
    </div>
  );
}
