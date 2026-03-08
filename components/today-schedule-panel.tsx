"use client";

import * as React from "react";
import { formatDateOnlyEuropean, formatTimeFromDate } from "@/lib/format";

export type TodayScheduleItem = {
  timeRange: string;
  modelNames: string[];
};

export type TodaySchedulePanelProps = {
  /** e.g. "Monday 02/03/2026" */
  todayLabel: string;
  /** Schedule blocks for today (time range + model names). */
  items: TodayScheduleItem[];
  /** Panel title: "Your scheduled models today" (chatter) or "Today's assigned models to review" (va). */
  title: string;
  /** When items is empty. */
  emptyMessage?: string;
  /** Compact mode for use inside modal (smaller text, less padding). */
  compact?: boolean;
};

/** Live current time (HH:mm), updates every minute. */
function useCurrentTime(): string {
  const [time, setTime] = React.useState(() => formatTimeFromDate(new Date()));
  React.useEffect(() => {
    const tick = () => setTime(formatTimeFromDate(new Date()));
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);
  return time;
}

export function TodaySchedulePanel({
  todayLabel,
  items,
  title,
  emptyMessage = "No scheduled models today",
  compact = false,
}: TodaySchedulePanelProps) {
  const currentTime = useCurrentTime();

  const content = (
    <>
      <div className={compact ? "space-y-1.5" : "space-y-3"}>
        <div className={compact ? "flex flex-wrap gap-x-3 gap-y-0.5 text-xs" : "flex flex-wrap gap-x-4 gap-y-1 text-sm"}>
          <span className="text-white/70">Today: {todayLabel}</span>
          <span className="text-white/50">Current time: {currentTime}</span>
        </div>
        <p className={compact ? "text-xs font-medium uppercase tracking-wider text-[hsl(330,90%,75%)]/90" : "text-sm font-semibold uppercase tracking-wider text-[hsl(330,90%,75%)]/95"}>
          {title}
        </p>
        {items.length === 0 ? (
          <p className={compact ? "text-xs text-white/50" : "text-sm text-white/50"}>{emptyMessage}</p>
        ) : (
          <ul className={compact ? "space-y-2" : "space-y-3"}>
            {items.map((item, i) => (
              <li key={i} className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">
                <p className={compact ? "text-xs font-medium text-white/80" : "text-sm font-medium text-white/90"}>
                  {item.timeRange}
                </p>
                <p className={compact ? "mt-0.5 text-xs text-white/70" : "mt-1 text-sm text-white/75"}>
                  {item.modelNames.length === 0 ? "—" : item.modelNames.join(", ")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );

  if (compact) {
    return (
      <div className="rounded-xl border border-white/10 bg-black/40 p-3 backdrop-blur-sm">
        {content}
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl border border-white/10 bg-white/[0.06] p-5 shadow-lg backdrop-blur-sm"
      style={{ boxShadow: "0 0 0 1px rgba(255,255,255,0.04), 0 0 24px -8px hsl(330 80% 55% / 0.08)" }}
    >
      {content}
    </div>
  );
}

/** Build today label from YYYY-MM-DD: "Monday 02/03/2026". */
export function buildTodayLabel(todayYmd: string, todayWeekday: string): string {
  const datePart = formatDateOnlyEuropean(todayYmd);
  return `${todayWeekday} ${datePart}`;
}

/** Mobile-only collapsible wrapper: collapsed shows "Today • 12:00–20:00 • N models"; tap to expand full schedule. */
export function TodayScheduleCollapsible(props: TodaySchedulePanelProps) {
  const [expanded, setExpanded] = React.useState(false);
  const currentTime = useCurrentTime();
  const { todayLabel, items, title, emptyMessage = "No scheduled models today" } = props;

  const summary =
    items.length === 0
      ? "Today · No shifts"
      : items.length === 1
        ? `Today · ${items[0].timeRange} · ${items[0].modelNames.length} model${items[0].modelNames.length !== 1 ? "s" : ""}`
        : `Today · ${items.length} shifts · ${items.reduce((acc, i) => acc + i.modelNames.length, 0)} models`;

  return (
    <div className="rounded-xl border border-white/10 bg-black/40 backdrop-blur-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center justify-between px-4 py-3 text-left md:pointer-events-none"
      >
        <span className="text-sm font-medium text-white/90">{summary}</span>
        <span
          className="ml-2 shrink-0 text-white/50 transition-transform md:hidden"
          style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      </button>
      <div className={`border-t border-white/10 px-4 pb-4 pt-2 ${expanded ? "block" : "hidden md:block"}`}>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-white/70">
          <span>Today: {todayLabel}</span>
          <span className="text-white/50">Current time: {currentTime}</span>
        </div>
        <p className="mt-1.5 text-xs font-semibold uppercase tracking-wider text-[hsl(330,90%,75%)]/90">{title}</p>
        {items.length === 0 ? (
          <p className="mt-1 text-xs text-white/50">{emptyMessage}</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {items.map((item, i) => (
              <li key={i} className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2">
                <p className="text-xs font-medium text-white/80">{item.timeRange}</p>
                <p className="mt-0.5 text-xs text-white/70">{item.modelNames.length ? item.modelNames.join(", ") : "—"}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
