"use client";

/**
 * Instagram Insights — Weekly Progress tab (custom 4-week/month breakdown).
 */

import * as React from "react";
import dynamic from "next/dynamic";
import { motion, useReducedMotion } from "framer-motion";
import { ChevronDown, ChevronLeft, ChevronRight, Instagram, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMonthYyyyMm } from "@/lib/format";
import { VA_CARD } from "@/lib/va-tasks-tokens";
import { fmtNum, fmtPct } from "@/lib/instagram-insights-ui";
import {
  CountUp,
  LuxuryStatCard,
  PeriodBadge,
  SectionLabel,
  StatInfoTooltip,
} from "@/components/infloww-performance-ui";
import type {
  IgModelWeekSlice,
  IgWeeklyModelProgress,
  IgWeeklyProgressReport,
} from "@/services/instagram-weekly-progress";
import type { IgWeeklyInsightSeverity, IgWeeklyInsightTag } from "@/lib/instagram-weekly-insights";

const ResponsiveContainer = dynamic(() => import("recharts").then((m) => m.ResponsiveContainer), {
  ssr: false,
});
const AreaChart = dynamic(() => import("recharts").then((m) => m.AreaChart), { ssr: false });
const Area = dynamic(() => import("recharts").then((m) => m.Area), { ssr: false });

function insightTone(severity: IgWeeklyInsightSeverity): string {
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

function InsightPills({ tags }: { tags: IgWeeklyInsightTag[] }) {
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

function statusGlow(status: IgModelWeekSlice["status"], hasActivity: boolean): string {
  if (status === "not_started") return "text-white/30";
  if (!hasActivity) return "text-amber-200/70";
  return "text-emerald-300/90";
}

function MiniSparkline({ values }: { values: number[] }) {
  if (!values.length) return null;
  const max = Math.max(...values, 1);
  const w = 72;
  const h = 28;
  const pts = values
    .map((v, i) => {
      const x = values.length <= 1 ? w / 2 : (i / (values.length - 1)) * w;
      const y = h - (v / max) * (h - 4) - 2;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="h-7 w-[4.5rem] shrink-0 opacity-80"
      aria-hidden
    >
      <defs>
        <linearGradient id="igWeekSpark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FF1493" stopOpacity={0.35} />
          <stop offset="100%" stopColor="#FF1493" stopOpacity={0} />
        </linearGradient>
      </defs>
      <polyline
        fill="none"
        stroke="#FF1493"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        points={pts}
      />
      <polygon
        fill="url(#igWeekSpark)"
        points={`0,${h} ${pts} ${w},${h}`}
        opacity={0.5}
      />
    </svg>
  );
}

function MetricRow({
  label,
  value,
  wow,
  comparable,
}: {
  label: string;
  value: string;
  wow?: IgModelWeekSlice["wow"]["reach"];
  comparable?: boolean;
}) {
  return (
    <div>
      <p className="text-[10px] text-white/35">{label}</p>
      <p className="text-[11px] font-medium tabular-nums text-white/80">{value}</p>
      {comparable && wow ? (
        <div className="mt-0.5 flex items-center gap-1">
          <PeriodBadge change={wow} />
          <StatInfoTooltip text="Week-over-week vs prior custom week (per-day adjusted when in progress)." />
        </div>
      ) : null}
    </div>
  );
}

function WeekCard({ slice }: { slice: IgModelWeekSlice }) {
  const [showMore, setShowMore] = React.useState(false);
  const notStarted = slice.status === "not_started";
  const inProgress = slice.status === "in_progress";
  const t = slice.totals;

  return (
    <div
      className={cn(
        "relative flex min-w-[13rem] flex-1 flex-col gap-3 overflow-hidden rounded-2xl border p-3.5",
        "shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]",
        notStarted
          ? "border-white/6 bg-gradient-to-b from-white/[0.03] to-black/40 opacity-70"
          : "border-white/10 bg-gradient-to-b from-white/[0.07] to-black/30"
      )}
    >
      {!notStarted ? (
        <div className="pointer-events-none absolute -right-6 -top-6 h-16 w-16 rounded-full bg-[#FF1493]/15 blur-2xl" />
      ) : null}
      <div className="relative flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#D4AF8C]/80">
            Week {slice.week}
            {inProgress ? (
              <span className="ml-1 font-medium normal-case tracking-normal text-amber-200/80">
                · in progress
              </span>
            ) : null}
          </p>
          <p className="mt-0.5 text-[11px] text-white/40">
            {notStarted ? (
              <span className="text-white/30">Not yet started</span>
            ) : inProgress ? (
              <>
                day {slice.elapsedDays} of {slice.dayCount}
                <span className="text-white/25">
                  {" "}
                  · {slice.startYmd.slice(5)} → {slice.endYmd.slice(5)}
                </span>
              </>
            ) : (
              <>
                {slice.startYmd.slice(5)} → {slice.endYmd.slice(5)}
                <span className="text-white/25"> · {slice.dayCount}d</span>
              </>
            )}
          </p>
        </div>
        {!notStarted ? (
          <div className="flex flex-col items-end gap-1">
            {slice.wowComparable ? (
              <>
                <PeriodBadge change={slice.wow.reach} />
                {slice.wowScaled ? (
                  <span className="text-[9px] text-white/30">per-day adj.</span>
                ) : null}
              </>
            ) : (
              <span className="text-[10px] text-white/30">vs prior —</span>
            )}
            <MiniSparkline values={t.daily_sparkline} />
          </div>
        ) : (
          <span className="rounded-full border border-white/8 bg-white/5 px-2 py-0.5 text-[10px] text-white/35">
            —
          </span>
        )}
      </div>

      {notStarted ? (
        <div className="relative py-2">
          <p className="text-lg font-medium text-white/30">Not yet started</p>
          <p className="mt-1 text-[11px] text-white/25">Insights unlock when the week starts</p>
        </div>
      ) : (
        <>
          <div className="relative">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35">
              Reach
            </p>
            <p className="text-xl font-semibold tabular-nums text-[#FF1493]">
              <CountUp value={t.reach} format={(n) => fmtNum(Math.round(n))} />
            </p>
            <p className={cn("mt-1 text-[11px]", statusGlow(slice.status, slice.hasActivity))}>
              {t.views != null
                ? `${fmtNum(t.views)} views`
                : t.reach > 0
                  ? "Views pending sync"
                  : "No reach yet"}
              {t.posts_in_week > 0 ? ` · ${t.posts_in_week} posts` : ""}
            </p>
          </div>
          <div className="relative grid grid-cols-2 gap-x-2 gap-y-2 text-[11px]">
            <MetricRow
              label="Engagement"
              value={fmtPct(t.avg_engagement_rate)}
              wow={slice.wow.engagement_rate}
              comparable={slice.wowComparable}
            />
            <MetricRow
              label="Followers"
              value={
                t.follower_delta != null
                  ? `${t.follower_delta >= 0 ? "+" : ""}${fmtNum(t.follower_delta)}`
                  : "—"
              }
              wow={slice.wow.follower_delta}
              comparable={slice.wowComparable}
            />
            <MetricRow
              label="Posts / wk"
              value={
                t.posting_frequency != null ? t.posting_frequency.toFixed(1) : "—"
              }
              wow={slice.wow.posting_frequency}
              comparable={slice.wowComparable}
            />
            <MetricRow
              label="Views WoW"
              value={t.views != null ? fmtNum(t.views) : "—"}
              wow={slice.wow.views}
              comparable={slice.wowComparable && t.views != null}
            />
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => setShowMore((v) => !v)}
              className="flex w-full items-center justify-between gap-2 rounded-lg border border-white/8 bg-white/[0.03] px-2 py-1.5 text-[10px] font-medium uppercase tracking-wider text-white/45 transition hover:bg-white/[0.06] hover:text-white/70"
            >
              {showMore ? "Show less" : "Daily reach"}
              <ChevronDown
                className={cn("h-3.5 w-3.5 transition", showMore && "rotate-180")}
              />
            </button>
            {showMore && t.daily_sparkline.length ? (
              <div className="mt-2 h-16 rounded-lg border border-white/8 bg-black/25 p-1">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={t.daily_sparkline.map((reach, i) => ({ i, reach }))}
                    margin={{ top: 2, right: 2, left: 2, bottom: 2 }}
                  >
                    <Area
                      type="monotone"
                      dataKey="reach"
                      stroke="#FF1493"
                      fill="#FF1493"
                      fillOpacity={0.2}
                      strokeWidth={1.5}
                      dot={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : null}
          </div>
        </>
      )}

      <div className="relative mt-auto border-t border-white/8 pt-2.5">
        {notStarted ? (
          <p className="text-[10px] text-white/25">Insights unlock when the week starts</p>
        ) : (
          <InsightPills tags={slice.insights} />
        )}
      </div>
    </div>
  );
}

function initialsFromName(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function ModelWeekRow({ row }: { row: IgWeeklyModelProgress }) {
  const [open, setOpen] = React.useState(true);
  const mt = row.month_totals;
  const tierColor =
    mt.reach > 0 && mt.avg_engagement_rate != null && mt.avg_engagement_rate >= 3
      ? "border-emerald-500/30"
      : mt.reach > 0
        ? "border-amber-500/25"
        : "border-white/10";

  return (
    <div className={cn(VA_CARD, "overflow-hidden border bg-white/5", tierColor)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-white/[0.03]"
      >
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-xs font-bold",
            mt.reach > 0
              ? "border-[#FF1493]/35 bg-gradient-to-br from-[#FF1493]/25 to-[#D4AF8C]/15 text-white"
              : "border-white/10 bg-white/5 text-white/40"
          )}
        >
          {initialsFromName(row.modelName)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">{row.modelName}</p>
          <p className="mt-0.5 text-xs text-white/40">
            {row.accountCount > 1 ? `${row.accountCount} accounts · ` : ""}
            Month {fmtNum(mt.reach)} reach · {fmtPct(mt.avg_engagement_rate)} eng
            {mt.follower_delta != null ? ` · ${mt.follower_delta >= 0 ? "+" : ""}${fmtNum(mt.follower_delta)} followers` : ""}
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

export function AdminInstagramWeeklyProgressPanel({
  initial,
}: {
  initial?: IgWeeklyProgressReport | null;
}) {
  const reduce = useReducedMotion();
  const now = new Date();
  const [data, setData] = React.useState<IgWeeklyProgressReport | null>(initial ?? null);
  const [year, setYear] = React.useState(initial?.year ?? now.getFullYear());
  const [month, setMonth] = React.useState(initial?.month ?? now.getMonth() + 1);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function load(opts?: { year?: number; month?: number }) {
    setLoading(true);
    setError(null);
    try {
      const y = opts?.year ?? year;
      const m = opts?.month ?? month;
      const monthKey = `${y}-${String(m).padStart(2, "0")}`;
      const res = await fetch(
        `/api/admin/instagram-insights?tab=weekly-progress&month=${monthKey}`,
        { cache: "no-store" }
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || `Failed (${res.status})`);
      }
      const json = (await res.json()) as IgWeeklyProgressReport;
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

  React.useEffect(() => {
    if (!data) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only bootstrap
  }, []);

  const monthLabel = formatMonthYyyyMm(`${year}-${String(month).padStart(2, "0")}`);

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
            <Instagram className="h-4 w-4 text-[#FF1493]/70" />
          </div>
          <p className="mt-1 text-sm text-white/45">
            Custom month weeks (1–7 · 8–14 · 15–21 · 22–end) · combined multi-account · auto
            insights per model
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
            {monthLabel} · {data.models.length} models · weeks{" "}
            {data.weeks.map((w) => w.label.replace(/^Week \d+ · /, "")).join(" · ")}
            {data.asOfYmd ? ` · as of ${data.asOfYmd}` : ""}
            {loading ? " · refreshing…" : ""}
          </p>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <LuxuryStatCard
              label="Month reach"
              value={<CountUp value={data.team_month_totals.reach} format={(n) => fmtNum(n)} />}
              accent="pink"
              glow
            />
            <LuxuryStatCard
              label="Avg engagement"
              value={fmtPct(data.team_month_totals.avg_engagement_rate)}
              accent="champagne"
            />
            <LuxuryStatCard
              label="Follower growth"
              value={
                data.team_month_totals.follower_delta != null
                  ? `${data.team_month_totals.follower_delta >= 0 ? "+" : ""}${fmtNum(data.team_month_totals.follower_delta)}`
                  : "—"
              }
              accent={
                (data.team_month_totals.follower_delta ?? 0) > 0
                  ? "emerald"
                  : (data.team_month_totals.follower_delta ?? 0) < 0
                    ? "amber"
                    : "champagne"
              }
            />
            <LuxuryStatCard
              label="Posts / week (avg)"
              value={
                data.team_month_totals.posting_frequency != null
                  ? data.team_month_totals.posting_frequency.toFixed(1)
                  : "—"
              }
              hint={`${data.team_month_totals.posts_in_week} posts in month`}
            />
          </div>

          <div className={cn(VA_CARD, "border border-white/10 bg-white/5 p-4")}>
            <SectionLabel>Team by week</SectionLabel>
            <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
              {data.team_by_week.map((tw) => {
                const boundary = data.weeks.find((w) => w.week === tw.week);
                const notStarted =
                  tw.status === "not_started" || boundary?.status === "not_started";
                return (
                  <div
                    key={tw.week}
                    className={cn(
                      "rounded-xl border px-3 py-3",
                      notStarted
                        ? "border-white/6 bg-black/15 opacity-65"
                        : "border-white/8 bg-black/25"
                    )}
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[#D4AF8C]/70">
                      Week {tw.week}
                      {tw.status === "in_progress" || boundary?.status === "in_progress"
                        ? " · live"
                        : null}
                    </p>
                    {notStarted ? (
                      <>
                        <p className="mt-1 text-base font-medium text-white/30">Not yet started</p>
                        <p className="text-[11px] text-white/30">
                          {boundary?.label.replace(/^Week \d+ · /, "") ?? ""}
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="mt-1 text-lg font-semibold tabular-nums text-white">
                          {fmtNum(tw.totals.reach)}
                        </p>
                        <p className="text-[11px] text-white/40">
                          {boundary?.status === "in_progress"
                            ? `day ${boundary.elapsedDays} of ${boundary.dayCount}`
                            : (boundary?.label.replace(/^Week \d+ · /, "") ?? "")}{" "}
                          · {fmtPct(tw.totals.avg_engagement_rate)} eng
                        </p>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-3">
            {data.models.length === 0 ? (
              <div className={cn(VA_CARD, "px-4 py-10 text-center")}>
                <Instagram className="mx-auto h-8 w-8 text-[#FF1493]/40" />
                <p className="mt-3 text-sm text-white/40">
                  No linked models with Instagram data for this month.
                </p>
              </div>
            ) : (
              data.models.map((row) => <ModelWeekRow key={row.modelId} row={row} />)
            )}
          </div>
        </>
      ) : loading ? (
        <p className="py-12 text-center text-sm text-white/40">Loading weekly progress…</p>
      ) : null}
    </div>
  );
}
