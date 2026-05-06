"use client";

import * as React from "react";
import { DayPicker, DateRange } from "react-day-picker";
import "react-day-picker/dist/style.css";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";
import { CalendarRange, ChevronDown, TrendingUp, X } from "lucide-react";
import { useToast } from "@/contexts/toast-context";
import { cn } from "@/lib/utils";
import type { AppNotification } from "@/types";
import type { InflowwEarningsResponse } from "@/types/infloww";

const ACCENT = "hsl(330,80%,55%)";
const ACCENT_SOFT = "hsl(330,80%,55% / 0.35)";
const CHART_GROSS = "#ec4899";
const CHART_NET = "#a78bfa";

type EarningsMetric = "gross" | "net";

function localToast(
  id: string,
  title: string,
  body: string,
  priority: "normal" | "high"
): AppNotification {
  return {
    id,
    notification_id: id,
    user_id: "local-user",
    category: "system",
    event_type: "system_alert",
    priority,
    title,
    body,
    entity_type: "system",
    entity_id: "",
    read_at: null,
    created_at: new Date().toISOString(),
  };
}

/** Parse `YYYY-MM-DD` as local calendar date (avoids UTC off-by-one). */
function parseYmdLocal(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map((n) => Number.parseInt(n, 10));
  if (!y || !m || !d) return new Date();
  return new Date(y, m - 1, d);
}

function toLocalYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Match `INFLOWW_ONLYFANS_NET_MULTIPLIER` in `lib/infloww-api.ts` (trend sums from raw tx amounts). */
const OF_NET_MULT = 0.8;

function eachLocalCalendarDayYmd(fromYmd: string, toYmd: string): string[] {
  const out: string[] = [];
  const cur = parseYmdLocal(fromYmd);
  const end = parseYmdLocal(toYmd);
  cur.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  let guard = 0;
  while (cur <= end && guard < 400) {
    out.push(toLocalYmd(cur));
    cur.setDate(cur.getDate() + 1);
    guard += 1;
  }
  return out;
}

function localYmdFromTxDateIso(iso: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) {
    const s = iso.trim().slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "1970-01-01";
  }
  return toLocalYmd(new Date(ms));
}

function money(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n || 0);
}

function EarningsStatSkeleton() {
  return (
    <div className="animate-pulse rounded-2xl border border-white/10 bg-black/40 p-6 md:max-w-2xl">
      <div className="flex justify-between gap-4">
        <div className="h-3 w-20 rounded bg-white/10" />
        <div className="h-9 w-44 rounded-lg bg-white/10" />
      </div>
      <div className="mt-6 h-10 w-48 rounded-lg bg-white/10" />
      <div className="mt-3 h-3 w-64 rounded bg-white/10" />
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="animate-pulse space-y-3 p-2">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="h-10 rounded-lg bg-white/5" />
      ))}
    </div>
  );
}

export function AdminEarningsDashboard({
  initialFrom,
  initialTo,
}: {
  initialFrom: string;
  initialTo: string;
}) {
  const { addToast } = useToast();
  const [from, setFrom] = React.useState(initialFrom);
  const [to, setTo] = React.useState(initialTo);
  const [modelId, setModelId] = React.useState("");
  const [showPicker, setShowPicker] = React.useState(false);
  const [pickerRange, setPickerRange] = React.useState<DateRange | undefined>(undefined);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [data, setData] = React.useState<InflowwEarningsResponse | null>(null);
  const [earningsMetric, setEarningsMetric] = React.useState<EarningsMetric>("gross");
  const [sortBy, setSortBy] = React.useState<"gross_earnings" | "net_earnings" | "agency_cut">("gross_earnings");

  React.useLayoutEffect(() => {
    if (!showPicker) return;
    setPickerRange({
      from: parseYmdLocal(from),
      to: parseYmdLocal(to),
    });
  }, [showPicker, from, to]);

  const earningsCalendarClassNames = React.useMemo(
    () => ({
      root: cn(
        "rdp-root !mx-auto !p-0 text-white/90",
        "[--rdp-accent-color:hsl(330,80%,55%)] [--rdp-animation_duration:0.22s] [--rdp-animation_timing:cubic-bezier(0.4,0,0.2,1)]",
        "[--rdp-range_start-date-background-color:hsl(330,78%,48%)] [--rdp-range_end-date-background-color:hsl(280,58%,46%)]",
        "[--rdp-range_start-color:white] [--rdp-range_end-color:white]"
      ),
      months: "rdp-months !gap-0",
      month: "rdp-month",
      month_caption: "rdp-month_caption mb-2 flex h-10 items-center justify-center text-sm font-semibold tracking-wide text-white",
      nav: "rdp-nav absolute right-0 top-0 flex items-center gap-0.5",
      button_previous: cn(
        "rdp-button_previous rounded-lg border border-white/10 bg-white/[0.06] p-1.5 text-white/80 transition-all duration-200",
        "hover:border-[hsl(330,80%,55%)]/50 hover:bg-white/[0.1] hover:text-white hover:shadow-[0_0_16px_-4px_hsl(330,80%,55%,0.45)]"
      ),
      button_next: cn(
        "rdp-button_next rounded-lg border border-white/10 bg-white/[0.06] p-1.5 text-white/80 transition-all duration-200",
        "hover:border-[hsl(330,80%,55%)]/50 hover:bg-white/[0.1] hover:text-white hover:shadow-[0_0_16px_-4px_hsl(330,80%,55%,0.45)]"
      ),
      chevron: "rdp-chevron fill-[hsl(330,80%,58%)]",
      weekdays: "rdp-weekdays",
      weekday: "rdp-weekday text-[0.65rem] font-medium uppercase tracking-wider text-white/45",
      week: "rdp-week",
      weeks: "rdp-weeks",
      month_grid: "rdp-month_grid w-full border-collapse",
      day: "rdp-day p-0.5 transition-colors duration-200 ease-out",
      day_button: cn(
        "rdp-day_button size-9 rounded-full text-[13px] font-medium text-white/88 transition-all duration-200 ease-out",
        "hover:shadow-[0_0_18px_-3px_hsl(330,80%,55%,0.55)] hover:ring-2 hover:ring-[hsl(330,80%,55%)]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(330,80%,55%)]/50"
      ),
      range_start: cn(
        "rdp-range_start rounded-l-full !bg-gradient-to-r from-transparent via-[hsl(330,80%,55%,0.28)] to-[hsl(330,80%,55%,0.22)]"
      ),
      range_middle: cn(
        "rdp-range_middle !bg-gradient-to-r from-[hsl(330,80%,55%,0.2)] via-[hsl(310,72%,52%,0.24)] to-[hsl(280,58%,50%,0.18)]"
      ),
      range_end: cn(
        "rdp-range_end rounded-r-full !bg-gradient-to-r from-[hsl(280,58%,50%,0.18)] via-[hsl(330,80%,55%,0.22)] to-transparent"
      ),
      selected: "rdp-selected",
      outside: "rdp-outside text-white/35 opacity-70",
      disabled: "rdp-disabled",
    }),
    []
  );

  const earningsCalendarModifiersClassNames = React.useMemo(
    () => ({
      today: cn(
        "rdp-today !font-semibold !text-cyan-300",
        "relative after:pointer-events-none after:absolute after:bottom-1 after:left-1/2 after:h-1 after:w-1 after:-translate-x-1/2 after:rounded-full after:bg-cyan-400 after:content-['']"
      ),
    }),
    []
  );

  const loadData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qp = new URLSearchParams({ from, to });
      if (modelId) qp.set("modelId", modelId);
      const res = await fetch(`/api/infloww/earnings?${qp.toString()}`, { cache: "no-store" });
      const payload = (await res.json()) as InflowwEarningsResponse & { error?: string };
      if (!res.ok) throw new Error(payload.error ?? "Failed to load earnings.");
      setData(payload);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load earnings.";
      setError(msg);
      addToast(localToast(`infloww-load-${Date.now()}`, "Could not load earnings", msg, "high"));
    } finally {
      setLoading(false);
    }
  }, [addToast, from, to, modelId]);

  React.useEffect(() => {
    void loadData();
  }, [loadData]);

  const byModel = React.useMemo(() => {
    const rows = (data?.earnings ?? []).slice();
    rows.sort((a, b) => b[sortBy] - a[sortBy]);
    return rows;
  }, [data?.earnings, sortBy]);

  const trend = React.useMemo(() => {
    const days = eachLocalCalendarDayYmd(from, to);
    const sumByDay = new Map<string, number>();
    for (const tx of data?.transactions ?? []) {
      const d = localYmdFromTxDateIso(tx.date);
      const add = earningsMetric === "gross" ? tx.amount : tx.amount * OF_NET_MULT;
      sumByDay.set(d, (sumByDay.get(d) ?? 0) + add);
    }
    return days.map((date) => {
      const labelPretty = new Date(`${date}T12:00:00`).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      });
      return {
        date,
        value: sumByDay.get(date) ?? 0,
        labelPretty,
      };
    });
  }, [from, to, data?.transactions, earningsMetric]);

  const primaryTotal = earningsMetric === "gross" ? (data?.totals.gross ?? 0) : (data?.totals.net ?? 0);
  const earningsSubtitle =
    earningsMetric === "gross"
      ? "Gross in selected range (before OnlyFans 20% fee)"
      : "Net in selected range (after OnlyFans 20% platform fee)";
  const chartSeriesName = earningsMetric === "gross" ? "Gross earnings" : "Net earnings (after OF 20%)";
  const chartStroke = earningsMetric === "gross" ? CHART_GROSS : CHART_NET;

  const topPerformers = React.useMemo(() => byModel.slice(0, 5), [byModel]);

  const showFullSkeleton = loading && data === null;
  const hasRows = byModel.length > 0;
  const txCount = data?.transactions?.length ?? 0;

  function handleRangeSelect(nextRange: DateRange | undefined) {
    if (nextRange === undefined) {
      setPickerRange({
        from: parseYmdLocal(from),
        to: parseYmdLocal(to),
      });
      return;
    }
    setPickerRange(nextRange);
    if (nextRange.from && nextRange.to) {
      const start = nextRange.from <= nextRange.to ? nextRange.from : nextRange.to;
      const end = nextRange.from <= nextRange.to ? nextRange.to : nextRange.from;
      setFrom(toLocalYmd(start));
      setTo(toLocalYmd(end));
      setShowPicker(false);
    }
  }

  function closeDatePicker() {
    setShowPicker(false);
    setPickerRange(undefined);
  }

  function exportCsv() {
    if (!byModel.length) return;
    const header = ["model_id", "model_name", "gross_earnings", "net_earnings", "agency_cut", "date"];
    const rows = byModel.map((r) =>
      [r.model_id, r.model_name, r.gross_earnings, r.net_earnings, r.agency_cut, r.date].join(",")
    );
    const csv = [header.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `infloww-earnings-${from}-to-${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    addToast(localToast(`infloww-export-${Date.now()}`, "CSV exported", "Earnings file downloaded.", "normal"));
  }

  const chartTooltipStyle = {
    backgroundColor: "rgba(0,0,0,0.88)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: "12px",
    color: "rgba(255,255,255,0.92)",
  };

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-white/10 bg-black/40 p-5 shadow-lg shadow-black/20">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              aria-expanded={showPicker}
              aria-haspopup="dialog"
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/90 transition hover:border-[hsl(330,80%,55%)]/35 hover:bg-white/[0.08] hover:shadow-[0_0_20px_-8px_hsl(330,80%,55%,0.35)]"
              onClick={() => setShowPicker((s) => !s)}
            >
              <CalendarRange className="h-4 w-4 shrink-0 text-[hsl(330,80%,65%)]" aria-hidden />
              <span>
                {from} → {to}
              </span>
            </button>
            <select
              value={modelId}
              onChange={(e) => setModelId(e.target.value)}
              className="rounded-xl border border-white/15 bg-black/30 px-4 py-2.5 text-sm text-white/90 focus:border-[hsl(330,80%,55%)]/50 focus:outline-none focus:ring-1 focus:ring-[hsl(330,80%,55%)]/40"
            >
              <option value="">All creators</option>
              {(data?.models ?? []).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void loadData()}
              disabled={loading}
              className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-md transition disabled:opacity-50"
              style={{ backgroundColor: ACCENT, boxShadow: `0 8px 24px ${ACCENT_SOFT}` }}
            >
              {loading ? "Refreshing…" : "Refresh"}
            </button>
          </div>
          <button
            type="button"
            onClick={exportCsv}
            disabled={!hasRows}
            className="rounded-xl border border-emerald-400/35 bg-emerald-500/15 px-4 py-2.5 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/25 disabled:opacity-40"
          >
            Export CSV
          </button>
        </div>
        {showPicker ? (
          <div
            className="animate-in fade-in zoom-in-95 slide-in-from-top-1 relative mt-4 overflow-hidden rounded-2xl border border-[hsl(330,80%,55%)] bg-black/90 p-4 pb-5 pt-3 shadow-[0_0_48px_-14px_hsl(330,80%,55%,0.38)] duration-200 ease-out"
            role="dialog"
            aria-label="Earnings date range"
          >
            <div className="mb-2 flex items-start justify-between gap-3 pr-1">
              <div>
                <p className="text-xs font-medium text-white/75">Date range</p>
                <p className="mt-0.5 text-[11px] text-white/45">
                  {pickerRange?.from && !pickerRange?.to
                    ? "Click the end date to finish the range."
                    : "Click a start date, then an end date. Filters refresh when the range is complete."}
                </p>
              </div>
              <button
                type="button"
                onClick={closeDatePicker}
                className="rounded-lg border border-white/12 bg-white/[0.06] p-1.5 text-white/70 transition-all duration-200 hover:border-[hsl(330,80%,55%)]/40 hover:bg-white/[0.1] hover:text-white hover:shadow-[0_0_14px_-3px_hsl(330,80%,55%,0.4)]"
                aria-label="Close calendar"
              >
                <X className="h-4 w-4" strokeWidth={2} />
              </button>
            </div>
            <div className="flex justify-center">
              <DayPicker
                mode="range"
                animate
                resetOnSelect
                numberOfMonths={1}
                defaultMonth={parseYmdLocal(to)}
                selected={pickerRange}
                onSelect={handleRangeSelect}
                classNames={earningsCalendarClassNames}
                modifiersClassNames={earningsCalendarModifiersClassNames}
              />
            </div>
          </div>
        ) : null}
      </div>

      <div>
        {showFullSkeleton ? (
          <EarningsStatSkeleton />
        ) : (
          <div
            className="relative rounded-2xl border border-white/10 border-l-4 bg-black/40 p-6 shadow-inner shadow-black/30 md:max-w-2xl"
            style={{ borderLeftColor: chartStroke }}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-white/60">Earnings</p>
              <div className="relative shrink-0">
                <select
                  aria-label="Earnings type"
                  value={earningsMetric}
                  onChange={(e) => setEarningsMetric(e.target.value as EarningsMetric)}
                  className={cn(
                    "appearance-none rounded-lg border border-white/12 bg-black/40 py-2 pl-3 pr-9 text-xs font-medium text-white/90",
                    "cursor-pointer shadow-sm transition-all duration-200 ease-out",
                    "hover:border-[hsl(330,80%,55%)]/55 hover:bg-white/[0.06] hover:text-white hover:shadow-[0_0_18px_-6px_hsl(330,80%,55%,0.45)]",
                    "focus:border-[hsl(330,80%,55%)]/50 focus:outline-none focus:ring-2 focus:ring-[hsl(330,80%,55%)]/35"
                  )}
                >
                  <option value="gross">Gross earnings</option>
                  <option value="net">Net earnings (after OF 20%)</option>
                </select>
                <ChevronDown
                  className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(330,80%,65%)] opacity-90"
                  aria-hidden
                  strokeWidth={2}
                />
              </div>
            </div>
            <p className="mt-5 text-3xl font-bold tracking-tight text-white/95 tabular-nums">{money(primaryTotal)}</p>
            <p className="mt-2 max-w-md text-xs leading-relaxed text-white/50">{earningsSubtitle}</p>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-white/10 bg-black/40 p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-white/90">Earnings trend</h2>
          <span className="text-xs text-white/50">
            All creators combined · {earningsMetric === "gross" ? "Gross" : "Net (after OF 20%)"} · every day in range
          </span>
        </div>
        <div className="h-72">
          {showFullSkeleton ? (
            <div className="flex h-full items-center justify-center rounded-xl bg-white/5">
              <div className="h-48 w-full max-w-md animate-pulse rounded-xl bg-white/10" />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis
                  dataKey="date"
                  stroke="rgba(255,255,255,0.45)"
                  tick={{ fill: "rgba(255,255,255,0.55)", fontSize: 10 }}
                  minTickGap={8}
                  tickFormatter={(v) => String(v).slice(5)}
                />
                <YAxis stroke="rgba(255,255,255,0.45)" tick={{ fill: "rgba(255,255,255,0.55)", fontSize: 11 }} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const row = payload[0].payload as { date: string; value: number; labelPretty: string };
                    const suffix = earningsMetric === "gross" ? "gross" : "net (after OF 20%)";
                    return (
                      <div className="rounded-xl border border-white/10 px-3 py-2 text-sm shadow-lg" style={chartTooltipStyle}>
                        <p className="text-white/70">{row.labelPretty}</p>
                        <p className="mt-1 font-semibold text-white">
                          {money(row.value)}{" "}
                          <span className="font-normal text-white/55">{suffix}</span>
                        </p>
                      </div>
                    );
                  }}
                />
                <Legend wrapperStyle={{ color: "rgba(255,255,255,0.65)", fontSize: 12 }} />
                <Area
                  type="monotone"
                  dataKey="value"
                  name={chartSeriesName}
                  stroke={chartStroke}
                  fill={`${chartStroke}33`}
                  strokeWidth={2}
                  isAnimationActive
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-black/40 p-6 lg:col-span-2">
          <h2 className="mb-4 text-sm font-semibold text-white/90">Earnings by creator</h2>
          <div className="overflow-auto rounded-xl border border-white/5">
            {showFullSkeleton ? (
              <TableSkeleton />
            ) : (
              <table className="min-w-full text-sm text-white/90">
                <thead className="border-b border-white/10 bg-black/40 text-left text-xs font-medium uppercase tracking-wider text-white/50">
                  <tr>
                    <th className="px-4 py-3 pr-3">Creator</th>
                    <th className="px-2 py-3 pr-3">
                      <button type="button" className="hover:text-[hsl(330,80%,65%)]" onClick={() => setSortBy("gross_earnings")}>
                        Gross
                      </button>
                    </th>
                    <th className="px-2 py-3 pr-3">
                      <button type="button" className="hover:text-[hsl(330,80%,65%)]" onClick={() => setSortBy("net_earnings")}>
                        Net (after OF)
                      </button>
                    </th>
                    <th className="px-2 py-3 pr-3">
                      <button type="button" className="hover:text-[hsl(330,80%,65%)]" onClick={() => setSortBy("agency_cut")}>
                        Agency cut
                      </button>
                    </th>
                    <th className="px-4 py-3">Period / day</th>
                  </tr>
                </thead>
                <tbody>
                  {byModel.map((row) => (
                    <tr key={`${row.model_id}-${row.date}`} className="border-t border-white/10 transition hover:bg-white/[0.04]">
                      <td className="px-4 py-3 pr-3 font-medium text-white/90">{row.model_name}</td>
                      <td className="px-2 py-3 pr-3 text-white/85 tabular-nums">{money(row.gross_earnings)}</td>
                      <td className="px-2 py-3 pr-3 text-white/85 tabular-nums">{money(row.net_earnings)}</td>
                      <td className="px-2 py-3 pr-3 text-white/85 tabular-nums">{money(row.agency_cut)}</td>
                      <td className="px-4 py-3 text-white/60">{row.date.slice(0, 10)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          {!showFullSkeleton && !hasRows ? (
            <div className="mt-6 flex flex-col items-center rounded-xl border border-dashed border-white/15 bg-white/[0.03] px-6 py-10 text-center">
              <CalendarRange className="mb-3 h-10 w-10 text-white/35" aria-hidden />
              <p className="text-sm font-medium text-white/80">No earnings in this range</p>
              <p className="mt-2 max-w-md text-sm text-white/55">
                Try widening the dates (e.g. last month), pick <strong className="text-white/70">All creators</strong>, or confirm
                Infloww has transactions for these days.                 If the API expects ISO datetimes instead of unix ms, set{" "}
                <code className="rounded bg-white/10 px-1.5 py-0.5 text-xs text-[hsl(330,80%,70%)]">INFLOWW_TX_TIME_FORMAT=iso</code>{" "}
                on the worker. Enable{" "}
                <code className="rounded bg-white/10 px-1.5 py-0.5 text-xs text-[hsl(330,80%,70%)]">INFLOWW_DEBUG=1</code> for server logs.
              </p>
              {txCount > 0 ? (
                <p className="mt-3 flex items-center gap-2 text-xs text-emerald-300/90">
                  <TrendingUp className="h-4 w-4" aria-hidden />
                  {txCount} raw transaction(s) returned — amounts may be in an unexpected field; check Infloww payload shape.
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/40 p-6">
          <h2 className="mb-4 text-sm font-semibold text-white/90">Top performers</h2>
          {showFullSkeleton ? (
            <TableSkeleton />
          ) : (
            <ol className="space-y-2 text-sm">
              {topPerformers.map((row, i) => (
                <li
                  key={`${row.model_id}-${i}`}
                  className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.04] px-4 py-3"
                >
                  <span className="truncate pr-3 text-white/85">
                    <span className="font-semibold text-[hsl(330,80%,65%)]">#{i + 1}</span> {row.model_name}
                  </span>
                  <span className="shrink-0 font-semibold text-violet-200 tabular-nums">
                    {money(earningsMetric === "gross" ? row.gross_earnings : row.net_earnings)}
                  </span>
                </li>
              ))}
            </ol>
          )}
          {!showFullSkeleton && !topPerformers.length ? (
            <p className="text-sm text-white/50">No ranked rows for this filter.</p>
          ) : null}
        </div>
      </div>

      {error ? (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>
      ) : null}
    </div>
  );
}
