"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { GitCompareArrows, BarChart3 } from "lucide-react";
import { CHART_TOOLTIP_STYLE, fmtCompact, fmtNum, fmtPct } from "@/lib/instagram-insights-ui";
import { fmtIgConversionEstimate } from "@/lib/instagram-weekly-insights";
import { StatInfoTooltip } from "@/components/infloww-performance-ui";
import { CROSS_PLATFORM_STAT_INFO } from "@/components/cross-platform-insights";
import type {
  IgCrossPlatformChartPoint,
  IgWeekMetricTotals,
  IgWeeklyCrossPlatformSection,
} from "@/services/instagram-weekly-progress";

const ResponsiveContainer = dynamic(() => import("recharts").then((m) => m.ResponsiveContainer), {
  ssr: false,
});
const ComposedChart = dynamic(() => import("recharts").then((m) => m.ComposedChart), {
  ssr: false,
});
const Line = dynamic(() => import("recharts").then((m) => m.Line), { ssr: false });
const Bar = dynamic(() => import("recharts").then((m) => m.Bar), { ssr: false });
const CartesianGrid = dynamic(() => import("recharts").then((m) => m.CartesianGrid), {
  ssr: false,
});
const XAxis = dynamic(() => import("recharts").then((m) => m.XAxis), { ssr: false });
const YAxis = dynamic(() => import("recharts").then((m) => m.YAxis), { ssr: false });
const Tooltip = dynamic(() => import("recharts").then((m) => m.Tooltip), { ssr: false });
const Legend = dynamic(() => import("recharts").then((m) => m.Legend), { ssr: false });

function shortDate(ymd: string): string {
  const [, m, d] = ymd.split("-");
  return `${m}/${d}`;
}

function money(n: number): string {
  return `$${Math.round(n).toLocaleString()}`;
}

function strengthLabel(s: string | null | undefined): string {
  if (!s) return "—";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function MetricCell({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-lg border border-white/8 bg-black/20 px-2 py-1.5">
      <p className="text-[9px] uppercase tracking-wider text-white/30">{label}</p>
      <p className="text-[11px] font-semibold tabular-nums text-white/85">{value}</p>
      {sub ? <p className="text-[9px] text-white/25">{sub}</p> : null}
    </div>
  );
}

export function IgWeeklyCrossPlatformSection({
  section,
  igTotals,
}: {
  section: IgWeeklyCrossPlatformSection;
  igTotals: IgWeekMetricTotals;
}) {
  const [showChart, setShowChart] = React.useState(false);
  const { analytics, chart, of_totals } = section;
  const blocked =
    analytics.status === "ig_only" ||
    analytics.status === "of_only" ||
    analytics.status === "unlinked";
  const sparse = analytics.status === "sparse" || analytics.overlap_days < 3;
  const corr = analytics.reach_visitor_correlation;
  const conv = analytics.conversion_estimate;

  const chartData = chart.map((d: IgCrossPlatformChartPoint) => ({
    ...d,
    dateLabel: shortDate(d.date),
  }));

  const activeDays = chartData.filter(
    (d) => d.reach > 0 || d.new_subscribers > 0 || d.revenue > 0
  ).length;

  const topWindow = analytics.content_conversion.windows[0];

  if (blocked || (sparse && activeDays < 2)) {
    return (
      <div className="relative overflow-hidden rounded-xl border border-[#D4AF8C]/20 bg-gradient-to-br from-[#D4AF8C]/8 via-black/30 to-[#FF1493]/5 px-3 py-2.5">
        <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#D4AF8C]/80">
          <BarChart3 className="h-3 w-3 text-[#FF1493]/80" aria-hidden />
          Cross-Platform: Instagram → OnlyFans
        </p>
        <p className="mt-1.5 text-[11px] leading-relaxed text-white/50">
          Not enough combined data this week
          {analytics.status_message ? ` — ${analytics.status_message}` : "."}
        </p>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-xl border border-[#D4AF8C]/25 bg-gradient-to-br from-[#D4AF8C]/10 via-black/35 to-[#FF1493]/8 px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
      <div className="pointer-events-none absolute -right-6 -top-6 h-14 w-14 rounded-full bg-[#FF1493]/12 blur-2xl" />
      <div className="relative flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <GitCompareArrows className="h-3 w-3 text-[#FF1493]/80" />
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#D4AF8C]/85">
            Cross-Platform: Instagram → OnlyFans
          </p>
          <StatInfoTooltip text={CROSS_PLATFORM_STAT_INFO.section} />
        </div>
        {analytics.growth_score.score != null ? (
          <span className="rounded-full border border-[#FF1493]/30 bg-[#FF1493]/10 px-2 py-0.5 text-[9px] font-semibold tabular-nums text-[#FFB6DE]">
            Score {analytics.growth_score.score}
          </span>
        ) : null}
      </div>

      {sparse ? (
        <p className="relative mt-1.5 rounded-lg border border-amber-500/20 bg-amber-500/8 px-2 py-1 text-[10px] text-amber-100/85">
          Not enough combined data this week — patterns below are early signals only.
        </p>
      ) : null}

      <div className="relative mt-2.5 grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-[#FF1493]/70">
            Instagram
          </p>
          <MetricCell label="Reach" value={fmtCompact(igTotals.reach)} />
          <MetricCell label="Engagement" value={fmtPct(igTotals.avg_engagement_rate, 1)} />
          <MetricCell
            label="Posts / wk"
            value={
              igTotals.posting_frequency != null
                ? igTotals.posting_frequency.toFixed(1)
                : igTotals.posts_in_week > 0
                  ? String(igTotals.posts_in_week)
                  : "—"
            }
          />
        </div>
        <div className="space-y-1.5">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-[#D4AF8C]/70">
            OnlyFans
          </p>
          <MetricCell label="New subs" value={fmtNum(of_totals.new_subscribers)} />
          <MetricCell label="Profile visitors" value={fmtNum(of_totals.profile_visitors)} />
          <MetricCell label="Revenue" value={money(of_totals.revenue)} />
        </div>
      </div>

      <button
        type="button"
        onClick={() => setShowChart((v) => !v)}
        className="relative mt-2 flex w-full items-center justify-between rounded-lg border border-white/8 bg-white/[0.03] px-2 py-1.5 text-[10px] font-medium uppercase tracking-wider text-white/45 transition hover:bg-white/[0.06] hover:text-white/70"
      >
        {showChart ? "Hide daily trends" : "Daily trends"}
        <span className="text-white/30">{chartData.length}d</span>
      </button>

      {showChart && chartData.length >= 2 ? (
        <div className="relative mt-2 h-28 rounded-lg border border-white/8 bg-black/25 p-1">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 2, right: 2, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis
                dataKey="dateLabel"
                tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 9 }}
                interval="preserveStartEnd"
              />
              <YAxis
                yAxisId="ig"
                tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 9 }}
                width={32}
                tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
              />
              <YAxis
                yAxisId="of"
                orientation="right"
                tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 9 }}
                width={28}
              />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
              <Legend wrapperStyle={{ fontSize: 9, color: "rgba(255,255,255,0.45)" }} />
              <Bar
                yAxisId="ig"
                dataKey="reach"
                name="IG reach"
                fill="rgba(255,20,147,0.35)"
                radius={[2, 2, 0, 0]}
              />
              <Line
                yAxisId="ig"
                type="monotone"
                dataKey="engagement_rate"
                name="IG eng %"
                stroke="#D4AF8C"
                strokeWidth={1.5}
                dot={false}
                connectNulls
              />
              <Line
                yAxisId="of"
                type="monotone"
                dataKey="new_subscribers"
                name="OF subs"
                stroke="#FFB6DE"
                strokeWidth={1.5}
                dot={false}
              />
              <Line
                yAxisId="of"
                type="monotone"
                dataKey="revenue"
                name="OF $"
                stroke="#86efac"
                strokeWidth={1.5}
                dot={false}
                strokeDasharray="3 2"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      ) : showChart ? (
        <p className="relative mt-2 text-center text-[10px] text-white/35">
          Not enough daily overlap for a chart yet.
        </p>
      ) : null}

      <div className="relative mt-2.5 space-y-1.5 rounded-lg border border-white/8 bg-black/20 px-2 py-2">
        <p className="text-[10px] leading-relaxed text-white/70">
          {corr.available && corr.correlation != null ? (
            <>
              <span className="font-medium text-[#D4AF8C]">
                {strengthLabel(corr.strength)} alignment
              </span>{" "}
              (r={corr.correlation}) — IG reach appears to align with OF profile visitors in this
              week&apos;s data.
            </>
          ) : (
            corr.note
          )}
        </p>
        {conv.available && conv.rate_pct != null ? (
          <p className="text-[10px] leading-relaxed text-white/55">
            <span className="rounded border border-amber-400/35 bg-amber-400/10 px-1 py-0.5 text-[8px] font-bold uppercase text-amber-200">
              Estimate
            </span>{" "}
            {fmtIgConversionEstimate({
              rate_pct: conv.rate_pct,
              total_reach: conv.total_reach,
              total_new_subs: conv.total_new_subs,
            })}{" "}
            — descriptive only, not true attribution.
          </p>
        ) : (
          <p className="text-[10px] text-white/40">{conv.note}</p>
        )}
      </div>

      {analytics.content_conversion.available && topWindow ? (
        <div className="relative mt-2 rounded-lg border border-white/8 bg-white/[0.02] px-2 py-1.5">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-white/35">
            Content → conversion
            <StatInfoTooltip text={CROSS_PLATFORM_STAT_INFO.content_window} />
          </p>
          <div className="mt-1 flex items-center gap-2">
            {topWindow.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={topWindow.image_url}
                alt=""
                className="h-8 w-8 shrink-0 rounded object-cover"
              />
            ) : (
              <div className="h-8 w-8 shrink-0 rounded bg-white/5" />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-[10px] text-white/75">
                {topWindow.caption?.slice(0, 48) || `Top post · ${shortDate(topWindow.posted_ymd)}`}
              </p>
              <p className="text-[9px] text-white/40">
                72h after: {topWindow.after_72h.new_subs} subs · {money(topWindow.after_72h.revenue)}
                {topWindow.lift_hint === "up"
                  ? " · appears up vs day before"
                  : topWindow.lift_hint === "down"
                    ? " · appears soft vs day before"
                    : ""}
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
