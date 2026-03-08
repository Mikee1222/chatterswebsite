"use client";

import * as React from "react";
import Link from "next/link";
import { LiveTimer } from "@/components/live-timer";
import type { Shift } from "@/types";

type Props = {
  activeShift: Shift;
  shiftHref: string;
  /** Real count from shift_models (layout fetches getActiveShiftModels). Falls back to shift.models_count if null. */
  modelsCount?: number | null;
};

export function LiveShiftMiniBar({ activeShift, shiftHref, modelsCount: modelsCountProp }: Props) {
  const isOnBreak = activeShift.status === "on_break";
  const modelsCount = modelsCountProp != null ? modelsCountProp : (activeShift.models_count ?? 0);

  return (
    <Link
      href={shiftHref}
      className="fixed left-0 right-0 z-35 flex items-center justify-between gap-3 border-t border-white/10 bg-black/90 px-4 py-2.5 backdrop-blur-xl md:hidden"
      style={{
        bottom: "calc(72px + env(safe-area-inset-bottom, 0px))",
        boxShadow: "0 -2px 16px rgba(0,0,0,0.35)",
      }}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span
          className={isOnBreak
            ? "shrink-0 rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-semibold text-amber-300"
            : "shrink-0 rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-semibold text-emerald-300"
          }
        >
          {isOnBreak ? "ON BREAK" : "LIVE"}
        </span>
        <span className="min-w-0 truncate font-mono text-sm tabular-nums text-white/95">
          {isOnBreak && activeShift.break_started_at ? (
            <LiveTimer startTime={activeShift.break_started_at} mode="break" />
          ) : activeShift.start_time ? (
            <LiveTimer startTime={activeShift.start_time} />
          ) : (
            "00:00:00"
          )}
        </span>
        <span className="shrink-0 text-xs text-white/60">
          {modelsCount} model{modelsCount !== 1 ? "s" : ""}
        </span>
      </div>
      <span className="shrink-0 text-xs font-medium text-[hsl(330,90%,65%)]">View →</span>
    </Link>
  );
}
