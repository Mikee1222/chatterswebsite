"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Calendar, CalendarRange, X } from "lucide-react";
import type { RecurringOccurrenceScope } from "@/lib/recurring-occurrence-scope";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  mode: "edit" | "delete";
  taskTitle?: string;
  onClose: () => void;
  onChoose: (scope: RecurringOccurrenceScope) => void;
};

export function RecurringOccurrenceScopeDialog({
  open,
  mode,
  taskTitle,
  onClose,
  onChoose,
}: Props) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  if (!open || !mounted) return null;

  const verb = mode === "edit" ? "Edit" : "Delete";
  const title = mode === "edit" ? "Edit recurring task" : "Delete recurring task";

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-end justify-center p-4 md:items-center">
      <button type="button" className="absolute inset-0 bg-black/75 backdrop-blur-sm" aria-label="Close" onClick={onClose} />
      <div
        className="relative w-full max-w-md rounded-2xl border border-white/10 bg-zinc-950 p-5 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="recurring-scope-dialog-title"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="recurring-scope-dialog-title" className="text-lg font-semibold text-white">
              {title}
            </h2>
            {taskTitle ? (
              <p className="mt-1 text-sm text-white/55 line-clamp-2">{taskTitle}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-white/40 transition hover:bg-white/5 hover:text-white"
            aria-label="Cancel"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-3 text-sm text-white/65">
          This task repeats. Choose how far {mode === "edit" ? "your changes" : "the deletion"} should apply.
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => onChoose("this_only")}
            className={cn(
              "flex min-h-[52px] items-start gap-3 rounded-xl border border-white/12 bg-white/[0.03] px-4 py-3 text-left transition",
              "hover:border-white/25 hover:bg-white/[0.06]",
            )}
          >
            <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" aria-hidden />
            <span>
              <span className="block text-sm font-semibold text-white">This occurrence only</span>
              <span className="mt-0.5 block text-xs text-white/50">
                {mode === "edit"
                  ? "Change just this date. Future days keep the original series."
                  : "Remove just this date. Future days still appear."}
              </span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => onChoose("this_and_future")}
            className={cn(
              "flex min-h-[52px] items-start gap-3 rounded-xl border border-white/12 bg-white/[0.03] px-4 py-3 text-left transition",
              mode === "delete"
                ? "hover:border-red-500/40 hover:bg-red-500/10"
                : "hover:border-purple-500/35 hover:bg-purple-500/10",
            )}
          >
            <CalendarRange
              className={cn("mt-0.5 h-4 w-4 shrink-0", mode === "delete" ? "text-red-300" : "text-purple-300")}
              aria-hidden
            />
            <span>
              <span className="block text-sm font-semibold text-white">This and all future occurrences</span>
              <span className="mt-0.5 block text-xs text-white/50">
                {mode === "edit"
                  ? "Update the series from this date forward. Past days stay unchanged."
                  : "Stop the series from this date forward. Past days stay unchanged."}
              </span>
            </span>
          </button>
        </div>
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-medium text-white/80 transition hover:bg-white/5"
          >
            Cancel
          </button>
        </div>
        <p className="sr-only">{verb} scope selection</p>
      </div>
    </div>,
    document.body,
  );
}
