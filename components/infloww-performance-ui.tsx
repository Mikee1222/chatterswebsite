"use client";

/**
 * Shared luxury UI primitives for Admin Chatter Performance + My Performance.
 */

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { CalendarRange, X } from "lucide-react";
import { DayPicker, type DateRange } from "react-day-picker";
import "react-day-picker/dist/style.css";
import { cn } from "@/lib/utils";
import { VA_CARD, VA_CARD_GLOW, VA_BTN_PRIMARY } from "@/lib/va-tasks-tokens";
import type { InflowwStatsPreset } from "@/services/infloww-performance";
import type {
  ConversionFunnel,
  PeriodChangeMetric,
} from "@/services/infloww-analytics";

/** Parse `YYYY-MM-DD` as local calendar date (avoids UTC off-by-one). */
export function parseYmdLocal(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map((n) => Number.parseInt(n, 10));
  if (!y || !m || !d) return new Date();
  return new Date(y, m - 1, d);
}

export function toLocalYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export const INFLOWW_PRESETS: { id: InflowwStatsPreset; label: string }[] = [
  { id: "this_week", label: "This Week" },
  { id: "last_week", label: "Last Week" },
  { id: "this_month", label: "This Month" },
  { id: "last_month", label: "Last Month" },
  { id: "custom", label: "Custom" },
];

export function money(n: number, digits = 0): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(n);
}

export function pct(n: number | null | undefined, digits = 1): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${(n * 100).toFixed(digits)}%`;
}

export function pctPoints(n: number | null | undefined, digits = 0): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(digits)}%`;
}

/** Animated count-up number with prefers-reduced-motion support. */
export function CountUp({
  value,
  format = (n) => String(Math.round(n)),
  duration = 900,
  className,
}: {
  value: number;
  format?: (n: number) => string;
  duration?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const [display, setDisplay] = React.useState(reduce ? value : 0);
  const preferRef = React.useRef(value);

  React.useEffect(() => {
    if (reduce) {
      setDisplay(value);
      return;
    }
    const from = preferRef.current;
    preferRef.current = value;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + (value - from) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration, reduce]);

  return <span className={cn("tabular-nums", className)}>{format(display)}</span>;
}

export function PeriodBadge({ change }: { change: PeriodChangeMetric }) {
  if (change.direction === "na" || change.pct_change == null) {
    return <span className="text-xs text-white/35">vs prior —</span>;
  }
  const up = change.direction === "up";
  const down = change.direction === "down";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
        up && "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
        down && "border-red-500/30 bg-red-500/10 text-red-300",
        change.direction === "flat" && "border-white/10 bg-white/5 text-white/45"
      )}
    >
      {up ? "▲" : down ? "▼" : "●"} {pctPoints(change.pct_change)}
    </span>
  );
}

export function LuxuryStatCard({
  label,
  value,
  hint,
  accent = "white",
  glow,
  badge,
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  accent?: "pink" | "champagne" | "emerald" | "white" | "amber";
  glow?: boolean;
  badge?: React.ReactNode;
  className?: string;
}) {
  const color =
    accent === "pink"
      ? "text-[#FF1493]"
      : accent === "champagne"
        ? "text-[#D4AF8C]"
        : accent === "emerald"
          ? "text-emerald-400"
          : accent === "amber"
            ? "text-amber-300"
            : "text-white";
  return (
    <div
      className={cn(
        VA_CARD,
        glow && VA_CARD_GLOW,
        "relative overflow-hidden border border-white/10 bg-white/5 p-4 md:p-5",
        className
      )}
    >
      <div
        className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-40 blur-2xl"
        style={{
          background:
            accent === "pink"
              ? "radial-gradient(circle, rgba(255,20,147,0.35), transparent 70%)"
              : accent === "champagne"
                ? "radial-gradient(circle, rgba(212,175,140,0.3), transparent 70%)"
                : "transparent",
        }}
      />
      <div className="relative flex items-start justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">
          {label}
        </p>
        {badge}
      </div>
      <p className={cn("relative mt-2 text-2xl font-semibold tracking-tight md:text-3xl", color)}>
        {value}
      </p>
      {hint ? <div className="relative mt-1.5 text-xs text-white/40">{hint}</div> : null}
    </div>
  );
}

export function DatePresetBar({
  preset,
  loading,
  onSelect,
}: {
  preset: InflowwStatsPreset;
  loading?: boolean;
  onSelect: (p: InflowwStatsPreset) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {INFLOWW_PRESETS.map((p) => (
        <button
          key={p.id}
          type="button"
          disabled={loading}
          onClick={() => onSelect(p.id)}
          className={cn(
            "rounded-full border px-3 py-1.5 text-xs font-semibold transition duration-200 motion-reduce:transition-none",
            preset === p.id
              ? "border-[#FF1493]/50 bg-[#FF1493]/15 text-[#FF1493] shadow-[0_0_24px_-8px_rgba(255,20,147,0.55)]"
              : "border-white/10 bg-white/5 text-white/60 hover:border-white/20 hover:text-white"
          )}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

const performanceCalendarClassNames = {
  root: cn(
    "rdp-root !mx-auto !p-0 text-white/90",
    "[--rdp-accent-color:#FF1493] [--rdp-animation_duration:0.22s] [--rdp-animation_timing:cubic-bezier(0.4,0,0.2,1)]",
    "[--rdp-range_start-date-background-color:#FF1493] [--rdp-range_end-date-background-color:#D4AF8C]",
    "[--rdp-range_start-color:white] [--rdp-range_end-color:#0D0B0D]"
  ),
  months: "rdp-months !gap-0",
  month: "rdp-month",
  month_caption:
    "rdp-month_caption mb-2 flex h-10 items-center justify-center text-sm font-semibold tracking-wide text-white",
  nav: "rdp-nav absolute right-0 top-0 flex items-center gap-0.5",
  button_previous: cn(
    "rdp-button_previous rounded-lg border border-white/10 bg-white/[0.06] p-1.5 text-white/80 transition-all duration-200",
    "hover:border-[#FF1493]/50 hover:bg-white/[0.1] hover:text-white hover:shadow-[0_0_16px_-4px_rgba(255,20,147,0.45)]"
  ),
  button_next: cn(
    "rdp-button_next rounded-lg border border-white/10 bg-white/[0.06] p-1.5 text-white/80 transition-all duration-200",
    "hover:border-[#FF1493]/50 hover:bg-white/[0.1] hover:text-white hover:shadow-[0_0_16px_-4px_rgba(255,20,147,0.45)]"
  ),
  chevron: "rdp-chevron fill-[#FF1493]",
  weekdays: "rdp-weekdays",
  weekday: "rdp-weekday text-[0.65rem] font-medium uppercase tracking-wider text-white/45",
  week: "rdp-week",
  weeks: "rdp-weeks",
  month_grid: "rdp-month_grid w-full border-collapse",
  day: "rdp-day p-0.5 transition-colors duration-200 ease-out",
  day_button: cn(
    "rdp-day_button size-9 rounded-full text-[13px] font-medium text-white/88 transition-all duration-200 ease-out",
    "hover:shadow-[0_0_18px_-3px_rgba(255,20,147,0.55)] hover:ring-2 hover:ring-[#FF1493]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF1493]/50"
  ),
  range_start: cn(
    "rdp-range_start rounded-l-full !bg-gradient-to-r from-transparent via-[#FF1493]/28 to-[#FF1493]/22"
  ),
  range_middle: cn(
    "rdp-range_middle !bg-gradient-to-r from-[#FF1493]/20 via-[#E879B8]/24 to-[#D4AF8C]/18"
  ),
  range_end: cn(
    "rdp-range_end rounded-r-full !bg-gradient-to-r from-[#D4AF8C]/18 via-[#FF1493]/22 to-transparent"
  ),
  selected: "rdp-selected",
  outside: "rdp-outside text-white/35 opacity-70",
  disabled: "rdp-disabled",
};

/**
 * Luxury Custom date-range control (react-day-picker), shared by Admin + Chatter
 * performance pages. Draft range stays stable when switching presets ↔ Custom.
 */
export function InflowwCustomDateRange({
  startYmd,
  endYmd,
  loading,
  onChange,
  onApply,
  className,
}: {
  startYmd: string;
  endYmd: string;
  loading?: boolean;
  onChange: (start: string, end: string) => void;
  onApply: (start: string, end: string) => void;
  className?: string;
}) {
  const [showPicker, setShowPicker] = React.useState(false);
  const [pickerRange, setPickerRange] = React.useState<DateRange | undefined>(undefined);

  React.useLayoutEffect(() => {
    if (!showPicker) return;
    setPickerRange({
      from: parseYmdLocal(startYmd),
      to: parseYmdLocal(endYmd),
    });
  }, [showPicker, startYmd, endYmd]);

  function handleRangeSelect(nextRange: DateRange | undefined) {
    if (nextRange === undefined) {
      setPickerRange({
        from: parseYmdLocal(startYmd),
        to: parseYmdLocal(endYmd),
      });
      return;
    }
    setPickerRange(nextRange);
    if (nextRange.from && nextRange.to) {
      const start = nextRange.from <= nextRange.to ? nextRange.from : nextRange.to;
      const end = nextRange.from <= nextRange.to ? nextRange.to : nextRange.from;
      onChange(toLocalYmd(start), toLocalYmd(end));
      setShowPicker(false);
    }
  }

  return (
    <div
      className={cn(
        VA_CARD,
        "flex flex-col gap-3 border border-white/10 bg-white/5 p-4",
        className
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <button
          type="button"
          aria-expanded={showPicker}
          aria-haspopup="dialog"
          disabled={loading}
          onClick={() => setShowPicker((s) => !s)}
          className={cn(
            "inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/90 transition",
            "hover:border-[#FF1493]/35 hover:bg-white/[0.08] hover:shadow-[0_0_20px_-8px_rgba(255,20,147,0.35)]",
            "sm:w-auto sm:justify-start",
            "disabled:opacity-50"
          )}
        >
          <CalendarRange className="h-4 w-4 shrink-0 text-[#FF1493]" aria-hidden />
          <span className="tabular-nums">
            {startYmd} → {endYmd}
          </span>
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={() => onApply(startYmd, endYmd)}
          className={cn(VA_BTN_PRIMARY, "w-full px-4 py-2.5 text-sm disabled:opacity-50 sm:w-auto")}
        >
          Apply range
        </button>
      </div>

      {showPicker ? (
        <div
          className="relative overflow-hidden rounded-2xl border border-[#FF1493]/40 bg-black/90 p-3 pb-4 pt-3 shadow-[0_0_48px_-14px_rgba(255,20,147,0.38)] sm:p-4"
          role="dialog"
          aria-label="Custom date range"
        >
          <div className="mb-2 flex items-start justify-between gap-3 pr-1">
            <div>
              <p className="text-xs font-medium text-white/75">Custom range</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-white/45">
                {pickerRange?.from && !pickerRange?.to
                  ? "Tap the end date to finish the range."
                  : "Pick a start date, then an end date. Apply when ready."}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setShowPicker(false);
                setPickerRange(undefined);
              }}
              className="rounded-lg border border-white/12 bg-white/[0.06] p-1.5 text-white/70 transition-all duration-200 hover:border-[#FF1493]/40 hover:bg-white/[0.1] hover:text-white"
              aria-label="Close calendar"
            >
              <X className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>
          <div className="flex justify-center overflow-x-auto">
            <DayPicker
              mode="range"
              animate
              resetOnSelect
              numberOfMonths={1}
              defaultMonth={parseYmdLocal(endYmd)}
              selected={pickerRange}
              onSelect={handleRangeSelect}
              classNames={performanceCalendarClassNames}
              modifiersClassNames={{
                today: cn(
                  "rdp-today !font-semibold !text-[#D4AF8C]",
                  "relative after:pointer-events-none after:absolute after:bottom-1 after:left-1/2 after:h-1 after:w-1 after:-translate-x-1/2 after:rounded-full after:bg-[#D4AF8C] after:content-['']"
                ),
              }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function ConversionFunnelViz({
  funnel,
  className,
}: {
  funnel: ConversionFunnel;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const stages = [
    { key: "messages", label: "Messages", value: funnel.messages, color: "#D4AF8C", sparse: false },
    { key: "ppvs", label: "PPVs sent", value: funnel.ppvs_sent, color: "#E879B8", sparse: false },
    {
      key: "unlocked",
      label: "Unlocked",
      value: funnel.unlocked,
      color: "#FF1493",
      sparse: funnel.unlock_data_sparse,
    },
    {
      key: "revenue",
      label: "Revenue",
      value: funnel.revenue,
      color: "#FF1493",
      money: true,
      sparse: false,
    },
  ] as const;
  const max = Math.max(
    1,
    ...stages.filter((s) => s.key !== "revenue" && !s.sparse).map((s) => s.value)
  );

  return (
    <div className={cn(VA_CARD, "border border-white/10 bg-white/5 p-5", className)}>
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">
            Conversion funnel
          </p>
          <p className="mt-1 text-sm text-white/50">Messages → PPV → unlock → revenue</p>
        </div>
        <div className="text-right text-xs text-white/40">
          <p>Msg→PPV {pct(funnel.msg_to_ppv_rate)}</p>
          <p>Unlock {funnel.unlock_data_sparse ? "n/a" : pct(funnel.unlock_rate)}</p>
        </div>
      </div>
      <div className="space-y-3">
        {stages.map((s, i) => {
          const sparse = s.sparse;
          const widthPct = sparse
            ? 40
            : s.key === "revenue"
              ? Math.min(100, funnel.messages > 0 ? 55 + (funnel.revenue > 0 ? 35 : 0) : 20)
              : Math.max(8, (s.value / max) * 100);
          return (
            <div key={s.key}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className={sparse ? "text-white/35" : "text-white/55"}>{s.label}</span>
                <span
                  className={cn(
                    "font-semibold tabular-nums",
                    sparse ? "text-white/35" : "text-white"
                  )}
                >
                  {sparse
                    ? "n/a"
                    : "money" in s && s.money
                      ? money(s.value)
                      : s.value.toLocaleString()}
                </span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-white/5">
                {sparse ? (
                  <div
                    className="h-full rounded-full border border-dashed border-white/25 bg-transparent"
                    style={{ width: `${widthPct}%` }}
                    title="Unlock data unavailable from Infloww sync"
                  />
                ) : (
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: `linear-gradient(90deg, ${s.color}99, ${s.color})` }}
                    initial={reduce ? false : { width: 0 }}
                    animate={{ width: `${widthPct}%` }}
                    transition={{ duration: 0.7, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
      {funnel.notes[0] ? (
        <p className="mt-3 text-[11px] leading-relaxed text-white/35">{funnel.notes[0]}</p>
      ) : null}
    </div>
  );
}

export function ConsistencyRing({
  score,
  className,
}: {
  score: number | null;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const v = score ?? 0;
  const r = 36;
  const c = 2 * Math.PI * r;
  const offset = c - (v / 100) * c;
  const tone =
    score == null
      ? "text-white/40"
      : score >= 70
        ? "text-emerald-400"
        : score >= 45
          ? "text-[#D4AF8C]"
          : "text-amber-300";

  return (
    <div className={cn(VA_CARD, "border border-white/10 bg-white/5 p-5", className)}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">
        Consistency
      </p>
      <div className="mt-3 flex items-center gap-4">
        <div className="relative h-24 w-24 shrink-0">
          <svg viewBox="0 0 88 88" className="h-full w-full -rotate-90">
            <circle cx="44" cy="44" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
            <motion.circle
              cx="44"
              cy="44"
              r={r}
              fill="none"
              stroke="#FF1493"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={c}
              initial={reduce ? false : { strokeDashoffset: c }}
              animate={{ strokeDashoffset: score == null ? c : offset }}
              transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={cn("text-xl font-semibold tabular-nums", tone)}>
              {score == null ? "—" : score}
            </span>
          </div>
        </div>
        <p className="text-sm leading-relaxed text-white/50">
          {score == null
            ? "Need a few active sales days to score consistency."
            : score >= 70
              ? "Steady rhythm — sales are reliable day to day."
              : score >= 45
                ? "Some swings — aim for a more even daily floor."
                : "High variance — focus on repeatable openers and PPV cadence."}
        </p>
      </div>
    </div>
  );
}

export function PersonalBestCallout({
  bestDay,
  bestWeek,
  warm,
}: {
  bestDay: { ymd: string; sales: number } | null;
  bestWeek: { week_start: string; week_end: string; sales: number } | null;
  warm?: boolean;
}) {
  if (!bestDay && !bestWeek) return null;
  return (
    <div
      className={cn(
        VA_CARD,
        VA_CARD_GLOW,
        "border border-[#D4AF8C]/25 bg-gradient-to-br from-[#D4AF8C]/10 via-white/5 to-transparent p-5"
      )}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#D4AF8C]">
        {warm ? "Your personal best" : "Personal best"}
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {bestDay ? (
          <div>
            <p className="text-xs text-white/45">Best day</p>
            <p className="mt-0.5 text-lg font-semibold text-white">
              {money(bestDay.sales)}{" "}
              <span className="text-sm font-normal text-white/40">· {bestDay.ymd}</span>
            </p>
          </div>
        ) : null}
        {bestWeek ? (
          <div>
            <p className="text-xs text-white/45">Best week</p>
            <p className="mt-0.5 text-lg font-semibold text-white">
              {money(bestWeek.sales)}{" "}
              <span className="text-sm font-normal text-white/40">
                · {bestWeek.week_start} → {bestWeek.week_end}
              </span>
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">
      {children}
    </p>
  );
}
