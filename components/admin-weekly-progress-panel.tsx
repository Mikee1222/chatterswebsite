"use client";

/**
 * Weekly Progress tab — custom 4-week/month breakdown with rule-based insights.
 */

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMonthYyyyMm } from "@/lib/format";
import { VA_CARD } from "@/lib/va-tasks-tokens";
import {
  CountUp,
  LuxuryStatCard,
  PeriodBadge,
  SectionLabel,
  money,
  pct,
} from "@/components/infloww-performance-ui";
import type {
  InflowwChatterWeekSlice,
  InflowwWeeklyChatterProgress,
  InflowwWeeklyProgressReport,
} from "@/services/infloww-performance";
import type { WeeklyInsightSeverity, WeeklyInsightTag } from "@/services/infloww-analytics";

function insightTone(severity: WeeklyInsightSeverity): string {
  switch (severity) {
    case "positive":
      return "border-emerald-500/35 bg-emerald-500/12 text-emerald-200";
    case "warning":
      return "border-amber-500/35 bg-amber-500/12 text-amber-100";
    case "critical":
      return "border-red-500/40 bg-red-500/15 text-red-100";
    case "info":
      return "border-[#D4AF8C]/35 bg-[#D4AF8C]/10 text-[#E8D5C4]";
    default:
      return "border-white/12 bg-white/6 text-white/55";
  }
}

function InsightPills({ tags }: { tags: WeeklyInsightTag[] }) {
  if (tags.length === 0) {
    return <p className="text-[10px] text-white/25">No tags this week</p>;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((t) => (
        <span
          key={t.id}
          className={cn(
            "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide",
            insightTone(t.severity)
          )}
          title={t.category}
        >
          {t.label}
        </span>
      ))}
    </div>
  );
}

function WeekCard({ slice }: { slice: InflowwChatterWeekSlice }) {
  return (
    <div
      className={cn(
        "relative flex min-w-[11.5rem] flex-1 flex-col gap-3 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.07] to-black/30 p-3.5",
        "shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
      )}
    >
      <div className="pointer-events-none absolute -right-6 -top-6 h-16 w-16 rounded-full bg-[#FF1493]/15 blur-2xl" />
      <div className="relative flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#D4AF8C]/80">
            Week {slice.week}
          </p>
          <p className="mt-0.5 text-[11px] text-white/40">
            {slice.startYmd.slice(5)} → {slice.endYmd.slice(5)}
            <span className="text-white/25"> · {slice.dayCount}d</span>
          </p>
        </div>
        <PeriodBadge change={slice.wow.sales} />
      </div>
      <div className="relative">
        <p className="text-xl font-semibold tabular-nums text-[#FF1493]">
          {money(slice.totals.sales)}
        </p>
        <p className="mt-1 text-[11px] text-white/45">
          PPV {money(slice.totals.ppv_sales)} · Tips {money(slice.totals.tips)}
        </p>
      </div>
      <div className="relative grid grid-cols-2 gap-x-2 gap-y-1.5 text-[11px]">
        <div>
          <span className="text-white/35">Msgs</span>{" "}
          <span className="tabular-nums text-white/80">
            {slice.totals.messages_sent.toLocaleString()}
          </span>
          <div className="mt-0.5">
            <PeriodBadge change={slice.wow.messages_sent} />
          </div>
        </div>
        <div>
          <span className="text-white/35">CVR</span>{" "}
          <span className="tabular-nums text-white/80">{pct(slice.totals.fan_cvr)}</span>
          <div className="mt-0.5">
            <PeriodBadge change={slice.wow.fan_cvr} />
          </div>
        </div>
        <div>
          <span className="text-white/35">Fans</span>{" "}
          <span className="tabular-nums text-white/80">
            {slice.totals.fans_chatted.toLocaleString()}
          </span>
        </div>
        <div>
          <span className="text-white/35">PPVs</span>{" "}
          <span className="tabular-nums text-white/80">
            {slice.totals.ppvs_sent.toLocaleString()}
          </span>
        </div>
      </div>
      <div className="relative mt-auto border-t border-white/8 pt-2.5">
        <InsightPills tags={slice.insights} />
      </div>
    </div>
  );
}

function ChatterWeekRow({ row }: { row: InflowwWeeklyChatterProgress }) {
  const [open, setOpen] = React.useState(true);
  return (
    <div className={cn(VA_CARD, "overflow-hidden border border-white/10 bg-white/5")}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-white/[0.03]"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">{row.full_name || "Unknown"}</p>
          <p className="mt-0.5 text-xs text-white/40">
            Emp {row.infloww_employee_id} · Month {money(row.month_totals.sales)} ·{" "}
            {row.month_totals.messages_sent.toLocaleString()} msgs · CVR{" "}
            {pct(row.month_totals.fan_cvr)}
          </p>
        </div>
        <span className="text-xs text-white/35">{open ? "Collapse" : "Expand"}</span>
      </button>
      {open ? (
        <div className="border-t border-white/8 px-3 pb-4 pt-3">
          <div className="flex gap-3 overflow-x-auto pb-1">
            {row.weeks.map((w) => (
              <WeekCard key={w.week} slice={w} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function AdminWeeklyProgressPanel({
  initial,
  linkedUsers,
}: {
  initial: InflowwWeeklyProgressReport | null;
  linkedUsers: Array<{ id: string; name: string; employeeId: number }>;
}) {
  const reduce = useReducedMotion();
  const [data, setData] = React.useState<InflowwWeeklyProgressReport | null>(initial);
  const [year, setYear] = React.useState(initial?.year ?? new Date().getFullYear());
  const [month, setMonth] = React.useState(initial?.month ?? new Date().getMonth() + 1);
  const [filterUserId, setFilterUserId] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function load(opts?: { year?: number; month?: number; userId?: string }) {
    setLoading(true);
    setError(null);
    try {
      const y = opts?.year ?? year;
      const m = opts?.month ?? month;
      const qp = new URLSearchParams({
        view: "weekly_progress",
        year: String(y),
        month: String(m),
      });
      const userId = opts?.userId ?? filterUserId;
      if (userId) qp.set("userId", userId);
      const res = await fetch(`/api/infloww-stats?${qp.toString()}`);
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || `Failed (${res.status})`);
      }
      const json = (await res.json()) as InflowwWeeklyProgressReport;
      setData(json);
      setYear(json.year);
      setMonth(json.month);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  function shiftMonth(delta: number) {
    let m = month + delta;
    let y = year;
    if (m < 1) {
      m = 12;
      y -= 1;
    } else if (m > 12) {
      m = 1;
      y += 1;
    }
    setYear(y);
    setMonth(m);
    void load({ year: y, month: m });
  }

  // Lazy-load if SSR didn't provide weekly data
  React.useEffect(() => {
    if (!data) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only bootstrap
  }, []);

  const monthLabel = formatMonthYyyyMm(
    `${year}-${String(month).padStart(2, "0")}`
  );

  return (
    <div className="space-y-6">
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
      >
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[#D4AF8C]" />
            <SectionLabel>Weekly Progress</SectionLabel>
          </div>
          <p className="mt-1 text-sm text-white/45">
            Custom month weeks (1–7 · 8–14 · 15–21 · 22–end) · auto insights per chatter
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={loading}
            onClick={() => shiftMonth(-1)}
            className="rounded-lg border border-white/10 p-2 text-white/60 hover:text-white disabled:opacity-50"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <label className="text-xs text-white/50">
            <span className="sr-only">Month</span>
            <input
              type="month"
              value={`${year}-${String(month).padStart(2, "0")}`}
              onChange={(e) => {
                const [ys, ms] = e.target.value.split("-");
                const y = Number(ys);
                const m = Number(ms);
                if (!Number.isFinite(y) || !Number.isFinite(m)) return;
                setYear(y);
                setMonth(m);
                void load({ year: y, month: m });
              }}
              className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm font-medium text-white"
            />
          </label>
          <button
            type="button"
            disabled={loading}
            onClick={() => shiftMonth(1)}
            className="rounded-lg border border-white/10 p-2 text-white/60 hover:text-white disabled:opacity-50"
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <select
            value={filterUserId}
            onChange={(e) => {
              setFilterUserId(e.target.value);
              void load({ userId: e.target.value });
            }}
            className="min-w-[10rem] rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
          >
            <option value="">All linked</option>
            {linkedUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name || u.id}
              </option>
            ))}
          </select>
        </div>
      </motion.div>

      {error ? (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      {data ? (
        <>
          <p className="text-xs text-white/40">
            {monthLabel} · {data.chatters.length} chatters · weeks{" "}
            {data.weeks.map((w) => w.label.replace(/^Week \d+ · /, "")).join(" · ")}
            {loading ? " · refreshing…" : ""}
          </p>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <LuxuryStatCard
              label="Month sales"
              value={
                <CountUp
                  value={data.team_month_totals.sales}
                  format={(n) => money(n)}
                />
              }
              accent="pink"
              glow
            />
            <LuxuryStatCard
              label="Month PPV"
              value={money(data.team_month_totals.ppv_sales)}
              accent="champagne"
            />
            <LuxuryStatCard
              label="Messages"
              value={data.team_month_totals.messages_sent.toLocaleString()}
            />
            <LuxuryStatCard
              label="Fan CVR"
              value={pct(data.team_month_totals.fan_cvr)}
              accent="emerald"
            />
          </div>

          <div className={cn(VA_CARD, "border border-white/10 bg-white/5 p-4")}>
            <SectionLabel>Team by week</SectionLabel>
            <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
              {data.team_by_week.map((tw) => {
                const boundary = data.weeks.find((w) => w.week === tw.week);
                return (
                  <div
                    key={tw.week}
                    className="rounded-xl border border-white/8 bg-black/25 px-3 py-3"
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[#D4AF8C]/70">
                      Week {tw.week}
                    </p>
                    <p className="mt-1 text-lg font-semibold tabular-nums text-white">
                      {money(tw.totals.sales)}
                    </p>
                    <p className="text-[11px] text-white/40">
                      {boundary?.label.replace(/^Week \d+ · /, "") ?? ""} ·{" "}
                      {tw.totals.messages_sent.toLocaleString()} msgs
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-3">
            {data.chatters.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-white/40">
                No linked chatters for this month.
              </p>
            ) : (
              data.chatters.map((row) => <ChatterWeekRow key={row.user_uuid} row={row} />)
            )}
          </div>
        </>
      ) : loading ? (
        <p className="py-12 text-center text-sm text-white/40">Loading weekly progress…</p>
      ) : null}
    </div>
  );
}
