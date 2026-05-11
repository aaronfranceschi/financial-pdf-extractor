"use client";

import { cn } from "@/lib/utils";
import type { PipelineStep } from "@/types";
import { Check, Circle, Loader2, X } from "lucide-react";

export function ProcessingTimeline({ steps }: { steps: PipelineStep[] }) {
  const columns = `repeat(${steps.length}, minmax(102px, 1fr))`;

  return (
    <div className="w-full overflow-x-auto pb-1 pt-1 [scrollbar-width:thin]">
      <div
        className="mx-auto grid w-full min-w-0 gap-2 sm:gap-3"
        style={{ gridTemplateColumns: columns }}
      >
        {steps.map((s) => {
          const isComplete = s.state === "complete";
          const isActive = s.state === "active";
          const isErr = s.state === "error";

          return (
            <div
              key={s.id}
              className={cn(
                "flex min-w-0 flex-col items-center rounded-xl border px-2 py-3 text-center transition-colors",
                isComplete && "border-emerald-200/90 bg-emerald-500/[0.06]",
                isActive && "border-primary/40 bg-primary/[0.04] shadow-sm",
                !isComplete && !isActive && !isErr && "border-zinc-200/80 bg-muted/30",
                isErr && "border-rose-300/90 bg-rose-500/[0.07]",
              )}
            >
              <div
                className={cn(
                  "mb-2 flex h-8 w-8 items-center justify-center rounded-full border shadow-sm",
                  isComplete && "border-emerald-500/40 bg-white text-emerald-700",
                  isActive && "border-primary/40 bg-white text-primary",
                  !isComplete && !isActive && !isErr && "border-zinc-200 bg-white text-muted-foreground",
                  isErr && "border-rose-400/50 bg-white text-rose-700",
                )}
                aria-hidden
              >
                {isComplete ? (
                  <Check className="h-4 w-4" strokeWidth={2.5} />
                ) : isActive ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : isErr ? (
                  <X className="h-4 w-4" strokeWidth={2.5} />
                ) : (
                  <Circle className="h-3.5 w-3.5 fill-muted/25" strokeWidth={1.5} />
                )}
              </div>

              <p className="text-[11px] font-semibold leading-snug sm:text-xs">{s.label}</p>
              <p className="mt-1.5 line-clamp-2 text-[10px] leading-snug text-muted-foreground sm:text-[11px]">
                {isComplete && "Done"}
                {isActive && "Running"}
                {!isComplete && !isActive && !isErr && "Waiting"}
                {isErr && "Stopped"}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
