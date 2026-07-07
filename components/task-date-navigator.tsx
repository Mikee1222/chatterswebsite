"use client";

import * as React from "react";
import { Calendar, ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { addDaysAthensYmd } from "@/lib/airtable-datetime";
import { getVaTasksViewTodayYmd } from "@/lib/va-task-date-filter";
import { formatDateEuropean } from "@/lib/format";
import { cn } from "@/lib/utils";

type TaskDateNavigatorProps = {
  value: string;
  onChange: (ymd: string) => void;
  className?: string;
};

const NAV_BTN =
  "flex h-9 w-9 items-center justify-center rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#151315] text-[#B8B4B8]/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition hover:border-[#D4AF8C]/30 hover:bg-[#1A1618] hover:text-[#D4AF8C] disabled:opacity-40";

export function TaskDateNavigator({ value, onChange, className }: TaskDateNavigatorProps) {
  const todayYmd = getVaTasksViewTodayYmd();
  const isToday = value === todayYmd;
  const dateInputRef = React.useRef<HTMLInputElement>(null);

  function openPicker() {
    const el = dateInputRef.current;
    if (!el) return;
    if (typeof el.showPicker === "function") el.showPicker();
    else el.click();
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onChange(addDaysAthensYmd(value, -1))}
          className={NAV_BTN}
          aria-label="Previous day"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
        </button>

        <button
          type="button"
          onClick={openPicker}
          className={cn(
            "inline-flex min-w-[10rem] items-center justify-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition",
            isToday
              ? "border-[#FF1493]/35 bg-[#FF1493]/10 text-white shadow-[0_0_20px_-8px_rgba(255,20,147,0.5)]"
              : "border-[#D4AF8C]/30 bg-[#151315] text-[#D4AF8C] hover:border-[#D4AF8C]/45 hover:bg-[#D4AF8C]/[0.06]",
          )}
        >
          <Calendar className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
          <span className="tabular-nums">{formatDateEuropean(value)}</span>
          {isToday ? (
            <span className="rounded-full border border-[#FF1493]/30 bg-[#FF1493]/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#FF1493]">
              Today
            </span>
          ) : null}
        </button>

        <input
          ref={dateInputRef}
          type="date"
          value={value}
          onChange={(e) => {
            const next = e.target.value.trim().slice(0, 10);
            if (next) onChange(next);
          }}
          className="sr-only"
          tabIndex={-1}
          aria-hidden
        />

        <button
          type="button"
          onClick={() => onChange(addDaysAthensYmd(value, 1))}
          className={NAV_BTN}
          aria-label="Next day"
        >
          <ChevronRight className="h-4 w-4" aria-hidden />
        </button>
      </div>

      {!isToday ? (
        <button
          type="button"
          onClick={() => onChange(todayYmd)}
          className="inline-flex items-center gap-1.5 rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#151315] px-3 py-2 text-xs font-medium text-[#B8B4B8]/70 transition hover:border-[#D4AF8C]/30 hover:text-[#D4AF8C]"
        >
          <RotateCcw className="h-3 w-3" aria-hidden />
          Today
        </button>
      ) : null}
    </div>
  );
}
