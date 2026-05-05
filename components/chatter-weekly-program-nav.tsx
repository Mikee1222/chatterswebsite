"use client";

import * as React from "react";
import Link from "next/link";
import {
  addWeeksLocal,
  diffWeeksOffset,
  getThisWeekMondayLocal,
} from "@/lib/weekly-program-local";

/**
 * Week navigation driven by `?week_start=` (server is source of truth).
 * useState only tracks offset for optimistic feedback + a11y hint.
 */
export function ChatterWeeklyProgramNavClient({
  weekStart,
  weekLabel,
  programPath,
}: {
  weekStart: string;
  weekLabel: string;
  programPath: string;
}) {
  const [offset, setOffset] = React.useState(() =>
    diffWeeksOffset(getThisWeekMondayLocal(), weekStart)
  );

  React.useEffect(() => {
    setOffset(diffWeeksOffset(getThisWeekMondayLocal(), weekStart));
  }, [weekStart]);

  const prevMonday = addWeeksLocal(weekStart, -1);
  const nextMonday = addWeeksLocal(weekStart, 1);

  return (
    <div className="mt-6 border-t border-white/10 pt-6">
      <p className="mb-3 text-center text-sm font-medium text-white/90">Week of {weekLabel}</p>
      <div className="flex flex-row items-center justify-center gap-2">
        <Link
          href={`${programPath}?week_start=${encodeURIComponent(prevMonday)}`}
          onClick={() => setOffset((o) => o - 1)}
          className="inline-flex shrink-0 items-center justify-center rounded-lg border border-white/25 bg-transparent px-2.5 py-2 text-xs font-medium text-white/90 transition-colors hover:border-white/40 hover:bg-white/5"
        >
          ← Previous
        </Link>
        <Link
          href={programPath}
          onClick={() => setOffset(0)}
          className="inline-flex shrink-0 items-center justify-center rounded-lg border border-pink-500/60 bg-gradient-to-r from-pink-600 to-pink-500 px-3 py-2 text-sm font-semibold text-white shadow-[0_2px_14px_-4px_rgba(236,72,153,0.45)] transition-opacity hover:opacity-95"
        >
          This week
        </Link>
        <Link
          href={`${programPath}?week_start=${encodeURIComponent(nextMonday)}`}
          onClick={() => setOffset((o) => o + 1)}
          className="inline-flex shrink-0 items-center justify-center rounded-lg border border-white/25 bg-transparent px-2.5 py-2 text-xs font-medium text-white/90 transition-colors hover:border-white/40 hover:bg-white/5"
        >
          Next →
        </Link>
      </div>
      <span className="sr-only">Week offset {offset}</span>
    </div>
  );
}
