"use client";

import * as React from "react";
import { formatTimeFromISO, formatDateEuropean } from "@/lib/format";
import { addDays } from "@/lib/weekly-program";
import { cn } from "@/lib/utils";
import type { WeeklyProgramRecord } from "@/types";
import { PeriodDayIndicator } from "@/components/period-day-indicator";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

type ByDayItem = { day: string; entries: WeeklyProgramRecord[] };

type Props = {
  byDay: ByDayItem[];
  weekStart: string;
  idToName: Record<string, string>;
  periodDatesByModelId?: Record<string, string[]>;
  showOvernightContinuationBadge?: boolean;
};

function isOvernightContinuationStart(startIso: string): boolean {
  const start = new Date(startIso);
  if (!Number.isFinite(start.getTime())) return false;
  const hour = start.getUTCHours();
  return hour >= 0 && hour < 6;
}

function OvernightContinuationBadge() {
  return (
    <span className="inline-flex items-center rounded-full border border-indigo-400/30 bg-indigo-500/10 px-2 py-0.5 text-[11px] font-semibold text-indigo-100">
      +1 cont.
    </span>
  );
}

export function WeeklyProgramDaySwiper({
  byDay,
  weekStart,
  idToName,
  periodDatesByModelId = {},
  showOvernightContinuationBadge = false,
}: Props) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = React.useState(0);

  const todayWeekday = new Date().toLocaleDateString("en-GB", { weekday: "long" });

  const goToDay = (index: number) => {
    setActiveIndex(index);
    const el = scrollRef.current;
    if (el) {
      const card = el.querySelector(`[data-day-index="${index}"]`);
      card?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "start" });
    }
  };

  return (
    <div className="space-y-4 md:hidden">
      <p className="text-base font-semibold text-white/90">Week</p>
      <div className="horizontal-scroll flex gap-1 overflow-x-auto pb-2 scrollbar-none">
        {DAYS.map((d, idx) => {
          const isToday = d === todayWeekday;
          return (
            <button
              key={d}
              type="button"
              onClick={() => goToDay(idx)}
              className={cn(
                "flex h-12 shrink-0 items-center justify-center rounded-xl border px-3 text-sm font-medium transition-colors",
                activeIndex === idx
                  ? "border-pink-500/60 bg-pink-600/45 text-white shadow-[0_0_16px_-4px_rgba(236,72,153,0.5)]"
                  : "border-white/10 bg-white/5 text-white/80 hover:bg-white/10",
                isToday && activeIndex !== idx && "ring-1 ring-pink-400/50",
                isToday && activeIndex === idx && "ring-2 ring-pink-300/60"
              )}
            >
              {d.slice(0, 3)}
            </button>
          );
        })}
      </div>
      <div
        ref={scrollRef}
        className="horizontal-scroll flex gap-4 overflow-x-auto snap-x snap-mandatory pb-4 scrollbar-none"
        style={{ scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch" }}
      >
        {byDay.map(({ day, entries }, dayIndex) => {
          const dateYmd = addDays(weekStart, DAYS.indexOf(day));
          const dateLabel = formatDateEuropean(dateYmd);
          const isToday = day === todayWeekday;
          return (
            <div
              key={day}
              data-day-index={dayIndex}
              className="min-w-[85vw] shrink-0 snap-start rounded-2xl border border-white/10 bg-black/40 backdrop-blur-xl"
              style={{
                boxShadow: "0 0 0 1px rgba(255,255,255,0.05), 0 0 32px -8px hsl(330 80% 55% / 0.08)",
              }}
            >
              <div className="border-b border-white/10 bg-white/[0.04] px-4 py-4">
                <p className="text-2xl font-bold tracking-tight text-white">{day}</p>
                <p className="mt-0.5 text-base text-white/60">{dateLabel}</p>
                {isToday && (
                  <span className="mt-2 inline-block rounded-full bg-pink-600 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white shadow-[0_2px_12px_-2px_rgba(219,39,119,0.6)]">
                    Today
                  </span>
                )}
              </div>
              <div className="space-y-4 p-4">
                {entries.length === 0 ? (
                  <p className="py-6 text-center text-sm text-white/45">No shifts</p>
                ) : (
                  entries.map((e) => (
                    <div
                      key={e.id}
                      className="rounded-2xl border border-white/10 bg-white/5 p-5"
                    >
                      <span className="inline-flex rounded-full border border-pink-500/45 bg-pink-600/20 px-3 py-1.5 text-sm font-bold uppercase tracking-wide text-pink-100">
                        {e.shift_type}
                      </span>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <p className="text-xl font-semibold tabular-nums text-pink-400">
                          {e.start_time ? formatTimeFromISO(e.start_time) : "—"} – {e.end_time ? formatTimeFromISO(e.end_time) : "—"}
                        </p>
                        {showOvernightContinuationBadge && isOvernightContinuationStart(e.start_time) ? <OvernightContinuationBadge /> : null}
                      </div>
                      {e.model_ids.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {e.model_ids.map((id) => {
                            const label = idToName[id] || id;
                            const inPeriod = (periodDatesByModelId[id] ?? []).includes(dateYmd);
                            return (
                              <span
                                key={id}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 text-white text-sm font-medium"
                              >
                                {label}
                                {inPeriod ? <PeriodDayIndicator className="shrink-0" /> : null}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
