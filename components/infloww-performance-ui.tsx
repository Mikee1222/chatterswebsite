"use client";

/**
 * Shared luxury UI primitives for Admin Chatter Performance + My Performance.
 */

import * as React from "react";
import { createPortal } from "react-dom";
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

/** Centralized metric explanations — keep labels consistent across admin / chatter / weekly. */
export const INFLOWW_STAT_INFO = {
  total_sales: "Total revenue generated, including PPVs, tips, and message-based sales.",
  team_sales: "Combined sales across all linked chatters in the selected period.",
  month_sales: "Team sales for the selected Athens calendar month.",
  month_ppv: "PPV revenue across the team for the selected month.",
  ppv: "Revenue from pay-per-view content unlocked by fans.",
  tips: "Revenue from fan tips.",
  messages: "Total direct messages sent to fans.",
  fans_chatted: "Number of unique fans messaged during this period.",
  fan_cvr:
    "Percentage of fans who made a purchase, out of those chatted with. Can look thin when spend attribution is incomplete.",
  rev_per_hour: "Revenue divided by hours worked (shifted) during this period.",
  rev_per_fan: "Average revenue generated per fan chatted.",
  avg_ppv: "Average price of PPV content sold (PPV revenue ÷ PPVs sent).",
  avg_tip: "Average tip amount received (estimated when tip counts aren't exact).",
  unlock_rate:
    "Percentage of sent PPVs that fans actually purchased/unlocked. Shows n/a when unlock counts haven't synced yet.",
  golden_ratio:
    "Revenue efficiency per message sent — a measure of how much value each message generates. Industry healthy range is typically 4–7%.",
  consistency:
    "How steady daily performance is — higher means less day-to-day variation, lower means bigger swings.",
  personal_best: "Highest single day and week of sales recorded in the available history.",
  team_standing: "Ranking compared to other chatters' performance in this period.",
  wow: "Percentage change compared to the previous equivalent period.",
  roi: "Revenue generated compared to compensation paid — return on this team member's cost. Admin-only.",
  roi_revenue: "Sales attributed to this chatter in the selected period.",
  estimated_comp: "Estimated compensation cost for this chatter in the period.",
  roi_ratio: "Dollars of revenue generated per dollar of estimated compensation.",
  conversion_funnel:
    "Path from messages sent → PPVs sent → unlocks → revenue. Spot where conversion drops off.",
  funnel_messages: "Messages sent in this period — the top of the conversion funnel.",
  funnel_ppvs: "Pay-per-view messages sent to fans.",
  funnel_unlocked: "PPVs fans actually purchased. n/a when unlock data hasn't synced.",
  funnel_revenue: "Revenue attributed at the bottom of the conversion funnel.",
  msg_to_ppv: "Share of messages that led to a PPV send.",
  streak: "Consecutive days with sales activity — a momentum signal.",
  best_day_of_week: "Weekday that historically averages the highest sales.",
  sales_trend: "Daily sales over the selected range.",
  team_sales_trend: "Aggregated sales across all linked chatters, daily or weekly.",
  leaderboard: "Top chatters by sales in the selected period.",
  heatmap: "Sales intensity by chatter × creator pairing — darker cells mean more revenue.",
  whale_suggestions:
    "High-value rebill activity not yet tracked as Whales — suggestions only, no auto-create.",
  ppv_pricing_signals:
    "Hints when average PPV looks high with low unlocks, or low with high unlocks.",
  best_creator: "Creator account where sales and conversion look strongest in this range.",
  per_creator: "Sales breakdown by creator account.",
  fans_to_watch:
    "High-value rebill activity not yet in Whales — suggest only, no auto-create.",
  daily_tip: "A short coaching nudge based on recent patterns.",
  week_sales: "Sales for this custom week of the Athens calendar month.",
  team_by_week: "Team sales rolled up into each custom week of the month.",
  alerts: "Automated flags for drops, effort/conversion mismatches, and other risk signals.",
} as const;

export type InflowwStatMetricId = keyof typeof INFLOWW_STAT_INFO;

export const GOLDEN_RATIO_TOOLTIP = INFLOWW_STAT_INFO.golden_ratio;
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
  if (change.display_note === "new_activity") {
    return <span className="text-xs font-medium text-emerald-300/85">New activity</span>;
  }
  if (
    change.display_note === "insufficient_baseline" ||
    change.display_note === "insufficient_history"
  ) {
    return <span className="text-xs text-white/35">Not enough prior data</span>;
  }
  if (change.direction === "na" || change.pct_change == null) {
    return <span className="text-xs text-white/35">vs prior —</span>;
  }
  const up = change.direction === "up";
  const down = change.direction === "down";
  const capSuffix = change.pct_capped ? "+" : "";
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
      {capSuffix}
    </span>
  );
}

function useFineHover(): boolean {
  const [fine, setFine] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    const sync = () => setFine(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return fine;
}

/** "?" info icon — hover on desktop, tap to toggle on mobile. */
export function StatInfoTooltip({
  metricId,
  text,
  className,
}: {
  metricId?: InflowwStatMetricId;
  text?: string;
  className?: string;
}) {
  const copy = text ?? (metricId ? INFLOWW_STAT_INFO[metricId] : undefined);
  const reduce = useReducedMotion();
  const fineHover = useFineHover();
  const [open, setOpen] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  const btnRef = React.useRef<HTMLButtonElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const [pos, setPos] = React.useState<{
    top?: number;
    bottom?: number;
    left: number;
    maxWidth: number;
  } | null>(null);

  React.useEffect(() => setMounted(true), []);

  React.useLayoutEffect(() => {
    if (!open || !btnRef.current) {
      setPos(null);
      return;
    }
    const rect = btnRef.current.getBoundingClientRect();
    const maxWidth = Math.min(280, window.innerWidth - 24);
    const preferredLeft = Math.min(
      Math.max(12, rect.left + rect.width / 2 - maxWidth / 2),
      window.innerWidth - maxWidth - 12
    );
    const spaceBelow = window.innerHeight - rect.bottom;
    if (spaceBelow < 120) {
      setPos({
        bottom: window.innerHeight - rect.top + 8,
        left: preferredLeft,
        maxWidth,
      });
    } else {
      setPos({ top: rect.bottom + 8, left: preferredLeft, maxWidth });
    }
  }, [open, copy]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (btnRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onOutside);
    document.addEventListener("touchstart", onOutside, { passive: true });
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onOutside);
      document.removeEventListener("touchstart", onOutside);
    };
  }, [open]);

  if (!copy) return null;

  return (
    <span className={cn("relative inline-flex shrink-0 align-middle", className)}>
      <button
        ref={btnRef}
        type="button"
        aria-label="What this metric means"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        onMouseEnter={() => {
          if (fineHover) setOpen(true);
        }}
        onMouseLeave={() => {
          if (fineHover) setOpen(false);
        }}
        onFocus={() => setOpen(true)}
        onBlur={(e) => {
          if (panelRef.current?.contains(e.relatedTarget as Node)) return;
          if (!fineHover) return;
          setOpen(false);
        }}
        className={cn(
          "inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border border-white/20 bg-white/[0.06] text-[9px] font-semibold leading-none text-white/45",
          "transition duration-200 motion-reduce:transition-none",
          "hover:border-[#D4AF8C]/45 hover:bg-white/10 hover:text-[#D4AF8C]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF8C]/40",
          open && "border-[#D4AF8C]/50 text-[#D4AF8C]"
        )}
      >
        ?
      </button>
      {mounted && open && pos
        ? createPortal(
            <div
              ref={panelRef}
              role="tooltip"
              onMouseEnter={() => {
                if (fineHover) setOpen(true);
              }}
              onMouseLeave={() => {
                if (fineHover) setOpen(false);
              }}
              className={cn(
                "fixed z-[10060] rounded-xl border border-white/12 bg-[#141214]/95 px-3 py-2.5 text-left shadow-[0_12px_40px_-12px_rgba(0,0,0,0.85)] backdrop-blur-md",
                reduce
                  ? "opacity-100"
                  : "animate-in fade-in-0 zoom-in-95 duration-150"
              )}
              style={{
                top: pos.top,
                bottom: pos.bottom,
                left: pos.left,
                maxWidth: pos.maxWidth,
                width: pos.maxWidth,
              }}
            >
              <p className="text-[12px] leading-relaxed text-white/75">{copy}</p>
            </div>,
            document.body
          )
        : null}
    </span>
  );
}

/** Label + "?" info icon, for hero metrics and inline week stats. */
export function MetricLabel({
  metricId,
  children,
  className,
}: {
  metricId: InflowwStatMetricId;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      <span>{children}</span>
      <StatInfoTooltip metricId={metricId} />
    </span>
  );
}

export function LuxuryStatCard({
  label,
  value,
  hint,
  metricId,
  tooltip,
  accent = "white",
  glow,
  badge,
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  /** Prefer this — looks up copy from INFLOWW_STAT_INFO. */
  metricId?: InflowwStatMetricId;
  /** Override / one-off explanation (falls back when metricId omitted). */
  tooltip?: string;
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
        <p className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">
          <span>{label}</span>
          {metricId || tooltip ? (
            <StatInfoTooltip metricId={metricId} text={tooltip} />
          ) : null}
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
    {
      key: "messages",
      label: "Messages",
      metricId: "funnel_messages" as const,
      value: funnel.messages,
      color: "#D4AF8C",
      sparse: false,
    },
    {
      key: "ppvs",
      label: "PPVs sent",
      metricId: "funnel_ppvs" as const,
      value: funnel.ppvs_sent,
      color: "#E879B8",
      sparse: false,
    },
    {
      key: "unlocked",
      label: "Unlocked",
      metricId: "funnel_unlocked" as const,
      value: funnel.unlocked,
      color: "#FF1493",
      sparse: funnel.unlock_data_sparse,
    },
    {
      key: "revenue",
      label: "Revenue",
      metricId: "funnel_revenue" as const,
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
          <p className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">
            Conversion funnel
            <StatInfoTooltip metricId="conversion_funnel" />
          </p>
          <p className="mt-1 text-sm text-white/50">Messages → PPV → unlock → revenue</p>
        </div>
        <div className="text-right text-xs text-white/40">
          <p className="inline-flex items-center justify-end gap-1">
            <MetricLabel metricId="msg_to_ppv" className="justify-end">
              Msg→PPV
            </MetricLabel>{" "}
            {pct(funnel.msg_to_ppv_rate)}
          </p>
          <p className="inline-flex items-center justify-end gap-1">
            <MetricLabel metricId="unlock_rate" className="justify-end">
              Unlock
            </MetricLabel>{" "}
            {funnel.unlock_data_sparse ? "n/a" : pct(funnel.unlock_rate)}
          </p>
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
                <span
                  className={cn(
                    "inline-flex items-center gap-1",
                    sparse ? "text-white/35" : "text-white/55"
                  )}
                >
                  {s.label}
                  <StatInfoTooltip metricId={s.metricId} />
                </span>
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
      <p className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">
        Consistency
        <StatInfoTooltip metricId="consistency" />
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
      <p className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#D4AF8C]">
        {warm ? "Your personal best" : "Personal best"}
        <StatInfoTooltip metricId="personal_best" />
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

export function SectionLabel({
  children,
  metricId,
}: {
  children: React.ReactNode;
  metricId?: InflowwStatMetricId;
}) {
  return (
    <p className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">
      <span>{children}</span>
      {metricId ? <StatInfoTooltip metricId={metricId} /> : null}
    </p>
  );
}
