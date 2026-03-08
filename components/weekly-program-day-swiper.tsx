"use client";

import * as React from "react";
import { formatTimeFromISO, formatDateEuropean } from "@/lib/format";
import { addDays } from "@/lib/weekly-program";
import { cn } from "@/lib/utils";
import type { WeeklyProgramRecord } from "@/types";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

type ByDayItem = { day: string; entries: WeeklyProgramRecord[] };

type Props = {
  byDay: ByDayItem[];
  weekStart: string;
  idToName: Record<string, string>;
};

export function WeeklyProgramDaySwiper({ byDay, weekStart, idToName }: Props) {
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
      <div className="flex gap-1 overflow-x-auto pb-2 scrollbar-none">
        {DAYS.map((d, idx) => {
          const dayItem = byDay.find((x) => x.day === d);
          const hasShifts = dayItem && dayItem.entries.length > 0;
          const isToday = d === todayWeekday;
          return (
            <button
              key={d}
              type="button"
              onClick={() => goToDay(idx)}
              className={cn(
                "shrink-0 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors",
                activeIndex === idx
                  ? "border-[hsl(330,80%,55%)]/50 bg-[hsl(330,80%,55%)]/20 text-[hsl(330,90%,65%)]"
                  : "border-white/10 bg-white/5 text-white/80 hover:bg-white/10",
                isToday && "ring-1 ring-[hsl(330,80%,55%)]/40"
              )}
            >
              {d.slice(0, 3)}
            </button>
          );
        })}
      </div>
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-4 scrollbar-none"
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
              <div className="border-b border-white/10 bg-white/[0.04] px-4 py-3">
                <p className="text-base font-semibold uppercase tracking-wider text-white/90">{day}</p>
                <p className="mt-0.5 text-sm text-white/50">{dateLabel}</p>
                {isToday && (
                  <span className="mt-1.5 inline-block rounded-full bg-[hsl(330,80%,55%)]/20 px-2 py-0.5 text-xs font-medium text-[hsl(330,90%,65%)]">
                    Today
                  </span>
                )}
              </div>
              <div className="p-4 space-y-3">
                {entries.length === 0 ? (
                  <p className="py-6 text-center text-sm text-white/45">No shifts</p>
                ) : (
                  entries.map((e) => (
                    <div
                      key={e.id}
                      className="rounded-xl border border-white/10 bg-white/[0.06] p-4"
                    >
                      <span
                        className="rounded-lg border px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-[hsl(330,90%,75%)]"
                        style={{
                          borderColor: "hsl(330 80% 55% / 0.4)",
                          backgroundColor: "hsl(330 80% 55% / 0.12)",
                        }}
                      >
                        {e.shift_type}
                      </span>
                      <p className="mt-2 font-mono text-sm tabular-nums text-white/90">
                        {e.start_time ? formatTimeFromISO(e.start_time) : "—"} – {e.end_time ? formatTimeFromISO(e.end_time) : "—"}
                      </p>
                      {e.model_ids.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {e.model_ids.map((id) => (
                            <span
                              key={id}
                              className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-sm text-white/90"
                            >
                              {idToName[id] || id}
                            </span>
                          ))}
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
