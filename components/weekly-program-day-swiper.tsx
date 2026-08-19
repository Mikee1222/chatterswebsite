"use client";

import * as React from "react";
import { formatTimeFromISO, formatDateEuropean } from "@/lib/format";
import { addDays, shiftCardAccentClass } from "@/lib/weekly-program";
import { cn } from "@/lib/utils";
import type { WeeklyProgramRecord } from "@/types";
import { PeriodDayIndicator } from "@/components/period-day-indicator";
import { AdminRowAvatar, ShiftTypeBadge } from "@/components/admin-list-primitives";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

type ByDayItem = { day: string; entries: WeeklyProgramRecord[] };

type Props = {
  byDay: ByDayItem[];
  weekStart: string;
  idToName: Record<string, string>;
  periodDatesByModelId?: Record<string, string[]>;
  showOvernightContinuationBadge?: boolean;
  /** Team schedule: show who's working each shift. */
  showChatterName?: boolean;
  /** Highlight shifts belonging to this chatter (team view). */
  highlightChatterId?: string;
  /** My schedule: optional shift notes. Hidden in team view. */
  showNotes?: boolean;
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
  showChatterName = false,
  highlightChatterId,
  showNotes = false,
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
                  entries.map((e) => {
                    const isMine = highlightChatterId != null && e.chatter_id === highlightChatterId;
                    return (
                    <div
                      key={e.id}
                      className={cn(
                        "rounded-2xl border p-5 pl-4",
                        shiftCardAccentClass(e.shift_type),
                        isMine
                          ? "border-[#FF1493]/45 bg-[#FF1493]/[0.08] ring-1 ring-[#FF1493]/25"
                          : "border-white/10 bg-white/5",
                      )}
                    >
                      {showChatterName && e.chatter_name ? (
                        <div className="mb-3 inline-flex items-center gap-2 rounded-lg border border-white/10 bg-black/30 px-2.5 py-1.5">
                          <AdminRowAvatar name={e.chatter_name} size="sm" />
                          <span className="truncate text-sm font-semibold text-white/90">{e.chatter_name}</span>
                          {isMine ? (
                            <span className="rounded-full bg-[#FF1493]/25 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#FF69B4]">
                              You
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                      <ShiftTypeBadge shiftType={e.shift_type} />
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
                                className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-sm font-medium text-white"
                              >
                                {label}
                                {inPeriod ? <PeriodDayIndicator className="shrink-0" /> : null}
                              </span>
                            );
                          })}
                        </div>
                      )}
                      {showNotes && e.notes?.trim() ? (
                        <p className="mt-3 text-xs leading-relaxed text-white/50">
                          {e.notes.trim().length > 100 ? `${e.notes.trim().slice(0, 100)}…` : e.notes.trim()}
                        </p>
                      ) : null}
                    </div>
                  );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
