"use client";

import { AlertTriangle, FileWarning, TimerOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AppErrorKind } from "@/types";
import { Card, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

const copy: Record<
  Exclude<AppErrorKind, null>,
  { title: string; subtitle: string; icon: typeof AlertTriangle }
> = {
  unsupported: {
    title: "Unsupported Document",
    subtitle:
      "Only PDF files are processed in this workflow. Export the source to PDF and upload again.",
    icon: FileWarning,
  },
  corrupted: {
    title: "Corrupted or Unreadable PDF",
    subtitle:
      "The file structure could not be parsed reliably. Replace the file or regenerate the export from source.",
    icon: AlertTriangle,
  },
  partial: {
    title: "Partial Extraction Completed",
    subtitle:
      "Some regions were blurry, rotated, or redacted. Review low-confidence rows before exporting.",
    icon: AlertTriangle,
  },
  timeout: {
    title: "Extraction Timed Out",
    subtitle:
      "Processing did not finish within its budget. Retry with the same file or simplify the PDF.",
    icon: TimerOff,
  },
};

export function ErrorState({
  kind,
  detail,
  onRetry,
}: {
  kind: Exclude<AppErrorKind, null>;
  detail?: string;
  onRetry: () => void;
}) {
  const meta = copy[kind];
  const Icon = meta.icon;

  return (
    <Card className="border-rose-200/80 bg-gradient-to-b from-rose-50/60 to-background">
      <CardHeader className="flex flex-row items-start gap-4 space-y-0">
        <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-full bg-rose-500/15 text-rose-700 ring-1 ring-rose-500/25">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <CardTitle>{meta.title}</CardTitle>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            {detail ?? meta.subtitle}
          </p>
        </div>
      </CardHeader>
      <CardFooter>
        <Button variant="outline" size="sm" onClick={onRetry}>
          Clear and Retry Workflow
        </Button>
      </CardFooter>
    </Card>
  );
}
