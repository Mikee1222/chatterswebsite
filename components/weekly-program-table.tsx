"use client";

import * as React from "react";
import Link from "next/link";
import type { WeeklyProgramRecord } from "@/types";
import { formatTimeEuropean, formatDateOnlyEuropean } from "@/lib/format";
import { addDays } from "@/lib/weekly-program";
import {
  addWeeksLocal,
  diffWeeksOffset,
  getMondayOfWeekLocalFromYmd,
  getThisWeekMondayLocal,
} from "@/lib/weekly-program-local";
import { ModelPeriodNamesRow } from "@/components/model-period-names-row";

const dayOrder = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export { addWeeksLocal, getMondayOfWeekLocalFromYmd, getThisWeekMondayLocal } from "@/lib/weekly-program-local";

/** Chatter weekly program: week nav with optimistic offset + router updates. */
export function ChatterWeeklyProgramWeekNav({
  weekStart,
  programPath,
}: {
  weekStart: string;
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
  const weekLabel = formatDateOnlyEuropean(weekStart);

  return (
    <div className="mt-6 flex flex-col gap-4 border-t border-white/10 pt-6">
      <p className="text-center text-sm font-medium text-white/90">
        Week of {weekLabel}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
        <Link
          href={`${programPath}?week_start=${encodeURIComponent(prevMonday)}`}
          onClick={() => setOffset((o) => o - 1)}
          className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/15 bg-white/5 px-4 text-sm font-medium text-white/90 transition-colors hover:bg-white/10"
        >
          ← Previous
        </Link>
        <Link
          href={programPath}
          onClick={() => setOffset(0)}
          className="inline-flex min-h-12 items-center justify-center rounded-xl border border-[hsl(330,80%,55%)]/40 bg-[hsl(330,80%,55%)]/15 px-4 text-sm font-medium text-[hsl(330,90%,78%)] transition-colors hover:bg-[hsl(330,80%,55%)]/25"
        >
          This week
        </Link>
        <Link
          href={`${programPath}?week_start=${encodeURIComponent(nextMonday)}`}
          onClick={() => setOffset((o) => o + 1)}
          className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/15 bg-white/5 px-4 text-sm font-medium text-white/90 transition-colors hover:bg-white/10"
        >
          Next →
        </Link>
      </div>
      {/* offset drives optimistic UI before navigation completes; 0 = current calendar week */}
      <span className="sr-only">Week offset {offset}</span>
    </div>
  );
}

export function WeeklyProgramTable({
  programs,
  weekStart,
  isAdmin,
  modelIdToName = {},
  periodDatesByModelId = {},
}: {
  programs: WeeklyProgramRecord[];
  weekStart: string;
  isAdmin: boolean;
  modelIdToName?: Record<string, string>;
  periodDatesByModelId?: Record<string, string[]>;
}) {
  const sorted = [...programs].sort((a, b) => {
    const ai = dayOrder.indexOf(a.day);
    const bi = dayOrder.indexOf(b.day);
    if (ai !== bi) return ai - bi;
    return a.shift_type === "Morning" ? -1 : 1;
  });

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10 text-left text-white/60">
            <th className="p-3 font-medium">Day</th>
            {isAdmin && <th className="p-3 font-medium">Chatter</th>}
            <th className="p-3 font-medium">Shift</th>
            <th className="p-3 font-medium">Models</th>
            <th className="p-3 font-medium">Time</th>
            <th className="p-3 font-medium">Notes</th>
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 ? (
            <tr>
              <td colSpan={isAdmin ? 6 : 5} className="p-8 text-center text-white/50">
                No scheduled shifts for this week
              </td>
            </tr>
          ) : (
            sorted.map((p) => {
              const dayIndex = dayOrder.indexOf(p.day);
              const dateYmd = addDays(weekStart, dayIndex >= 0 ? dayIndex : 0);
              return (
                <tr key={p.id} className="border-b border-white/5 hover:bg-white/5">
                  <td className="p-3 text-white/90">{p.day}</td>
                  {isAdmin && <td className="p-3 text-white/80">{p.chatter_name || "—"}</td>}
                  <td className="p-3 text-white/80">{p.shift_type}</td>
                  <td className="p-3 text-white/80">
                    {p.model_ids.length > 0 ? (
                      <ModelPeriodNamesRow
                        modelIds={p.model_ids}
                        idToName={modelIdToName}
                        dateYmd={dateYmd}
                        periodDatesByModelId={periodDatesByModelId}
                      />
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="p-3 text-white/70">
                    {formatTimeEuropean(p.start_time)} – {formatTimeEuropean(p.end_time)}
                  </td>
                  <td className="max-w-[200px] truncate p-3 text-white/60">{p.notes || "—"}</td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
