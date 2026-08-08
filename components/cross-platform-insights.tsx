"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { ArrowRight, GitCompareArrows, Sparkles } from "lucide-react";
import {
  CountUp,
  LuxuryStatCard,
  SectionLabel,
  StatInfoTooltip,
} from "@/components/infloww-performance-ui";
import { IgEmptyState, IgSkeleton } from "@/components/instagram-insights-shared";
import { VA_CARD, VA_CARD_GLOW } from "@/lib/va-tasks-tokens";
import { cn } from "@/lib/utils";
import {
  CHART_TOOLTIP_STYLE,
  fmtDelta,
  fmtNum,
  fmtPct,
} from "@/lib/instagram-insights-ui";
import type {
  CrossPlatformAnalytics,
  ModelCrossPlatformCard,
} from "@/services/cross-platform-analytics";

const ResponsiveContainer = dynamic(() => import("recharts").then((m) => m.ResponsiveContainer), {
  ssr: false,
});
const LineChart = dynamic(() => import("recharts").then((m) => m.LineChart), { ssr: false });
const Line = dynamic(() => import("recharts").then((m) => m.Line), { ssr: false });
const CartesianGrid = dynamic(() => import("recharts").then((m) => m.CartesianGrid), {
  ssr: false,
});
const XAxis = dynamic(() => import("recharts").then((m) => m.XAxis), { ssr: false });
const YAxis = dynamic(() => import("recharts").then((m) => m.YAxis), { ssr: false });
const Tooltip = dynamic(() => import("recharts").then((m) => m.Tooltip), { ssr: false });
const Legend = dynamic(() => import("recharts").then((m) => m.Legend), { ssr: false });
const ComposedChart = dynamic(() => import("recharts").then((m) => m.ComposedChart), {
  ssr: false,
});
const Bar = dynamic(() => import("recharts").then((m) => m.Bar), { ssr: false });

export const CROSS_PLATFORM_STAT_INFO = {
  section:
    "Joins Instagram Insights (ClarioSuite) with Infloww OnlyFans daily stats for the same model and date range. Patterns describe alignment — not causation.",
  reach_visitors:
    "Pearson correlation of daily IG reach vs Infloww profile visitors on overlapping days. Needs ~5+ shared days. Correlation ≠ causation.",
  growth_alignment:
    "Daily IG follower change overlaid with Infloww new subscribers. Lines can move together without one causing the other.",
  content_window:
    "For top IG posts, OF new subs and revenue in the day before vs 24–72 hours after. Timing can coincide with other campaigns.",
  conversion_estimate:
    "ESTIMATE: new OF subscribers ÷ IG reach × 100. Not true attribution — fans arrive from many channels, and daily reach isn’t unique.",
  growth_score:
    "Composite 0–100 from IG engagement/follower trends and OF subscriber/revenue trends. Descriptive momentum — not a rank.",
} as const;

function shortDate(ymd: string): string {
  const [, m, d] = ymd.split("-");
  return `${m}/${d}`;
}

function strengthLabel(s: string | null | undefined): string {
  if (!s) return "—";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function money(n: number): string {
  return `$${Math.round(n).toLocaleString()}`;
}

function liftColor(hint: string): string {
  if (hint === "up") return "text-emerald-300";
  if (hint === "down") return "text-amber-200";
  return "text-white/50";
}

/** Full admin Cross-Platform Insights section. */
export function CrossPlatformInsightsSection({
  data,
  loading,
}: {
  data: CrossPlatformAnalytics | null | undefined;
  loading?: boolean;
}) {
  if (loading && !data) {
    return (
      <div className="space-y-3">
        <IgSkeleton className="h-10 w-64" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <IgSkeleton key={i} className="h-28" />
          ))}
        </div>
        <IgSkeleton className="h-56" />
      </div>
    );
  }

  if (!data) return null;

  const blocked =
    data.status === "ig_only" ||
    data.status === "of_only" ||
    data.status === "unlinked";
  const sparseBanner = data.status === "sparse";

  const growthChart = (data.growth_alignment.series ?? []).map((d) => ({
    ...d,
    dateLabel: shortDate(d.date),
  }));

  const reachVisitorChart = (data.series ?? [])
    .filter((d) => d.reach > 0 || d.profile_visitors > 0)
    .map((d) => ({
      dateLabel: shortDate(d.date),
      reach: d.reach,
      profile_visitors: d.profile_visitors,
    }));

  const corr = data.reach_visitor_correlation;
  const score = data.growth_score;
  const conv = data.conversion_estimate;

  return (
    <div className="space-y-4">
      <div className={cn(VA_CARD, VA_CARD_GLOW, "relative overflow-hidden p-4 md:p-5")}>
        <div
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            background:
              "radial-gradient(ellipse 70% 50% at 10% 0%, rgba(255,20,147,0.14), transparent 55%), radial-gradient(ellipse 50% 40% at 90% 0%, rgba(212,175,140,0.12), transparent 50%)",
          }}
        />
        <div className="relative flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <GitCompareArrows className="h-4 w-4 text-[#FF1493]" />
              <SectionLabel>Cross-Platform Insights</SectionLabel>
              <StatInfoTooltip text={CROSS_PLATFORM_STAT_INFO.section} />
            </div>
            <h3 className="mt-2 text-lg font-semibold text-white">
              So what does this mean together?
            </h3>
            <p className="mt-1 max-w-2xl text-sm text-white/55">{data.status_message}</p>
            <p className="mt-2 text-[11px] text-white/35">
              {data.overlap_days} overlapping day{data.overlap_days === 1 ? "" : "s"} · IG{" "}
              {data.ig_days} · OF {data.of_days} · Correlation ≠ causation
            </p>
          </div>
          {score.score != null ? (
            <div className="rounded-2xl border border-[#FF1493]/30 bg-[#FF1493]/10 px-4 py-3 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#FFB6DE]/80">
                Growth Score
              </p>
              <p className="mt-1 text-3xl font-semibold tabular-nums text-white">
                <CountUp value={score.score} />
              </p>
              <p className="mt-0.5 text-xs text-[#D4AF8C]">{score.label}</p>
            </div>
          ) : null}
        </div>
      </div>

      {blocked ? (
        <IgEmptyState
          title="Not enough combined data yet"
          detail={data.status_message}
        />
      ) : null}

      {sparseBanner ? (
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-xs text-amber-100/90">
          {data.status_message}
        </div>
      ) : null}

      {!blocked ? (
        <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <LuxuryStatCard
          label="Reach ↔ visitors"
          value={
            corr.available && corr.correlation != null
              ? corr.correlation.toFixed(2)
              : "—"
          }
          hint={
            corr.available
              ? `${strengthLabel(corr.strength)} · n=${corr.sample_size}`
              : "Need more overlap"
          }
          tooltip={CROSS_PLATFORM_STAT_INFO.reach_visitors}
          accent="pink"
          glow
        />
        <LuxuryStatCard
          label="IG follower Δ"
          value={fmtDelta(data.growth_alignment.ig_follower_delta_total)}
          hint="Same range as OF below"
          tooltip={CROSS_PLATFORM_STAT_INFO.growth_alignment}
          accent="champagne"
        />
        <LuxuryStatCard
          label="OF new subs"
          value={<CountUp value={data.growth_alignment.of_new_subscribers_total} />}
          hint="Infloww · same dates"
          tooltip={CROSS_PLATFORM_STAT_INFO.growth_alignment}
          accent="pink"
        />
        <LuxuryStatCard
          label="IG→OF estimate"
          value={
            conv.available && conv.rate_pct != null ? (
              <span className="inline-flex items-baseline gap-1.5">
                <CountUp value={conv.rate_pct} format={(n) => `${n.toFixed(2)}%`} />
                <span className="rounded-md border border-amber-400/40 bg-amber-400/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-200">
                  Estimate
                </span>
              </span>
            ) : (
              "—"
            )
          }
          hint={
            conv.available
              ? `${fmtNum(conv.total_new_subs)} subs / ${fmtNum(conv.total_reach)} reach`
              : "Sparse combined data"
          }
          tooltip={CROSS_PLATFORM_STAT_INFO.conversion_estimate}
          accent="amber"
        />
      </div>

      <p className="text-xs leading-relaxed text-white/45">{corr.note}</p>

      {/* Growth alignment chart */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className={cn(VA_CARD, "p-4")}>
          <div className="flex items-center gap-2">
            <SectionLabel>IG growth vs OF subscriber growth</SectionLabel>
            <StatInfoTooltip text={CROSS_PLATFORM_STAT_INFO.growth_alignment} />
          </div>
          <p className="mt-1 text-[11px] text-white/40">{data.growth_alignment.note}</p>
          <div className="mt-3 h-56">
            {data.growth_alignment.available && growthChart.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={growthChart}>
                  <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                  <XAxis
                    dataKey="dateLabel"
                    tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }}
                  />
                  <YAxis
                    yAxisId="ig"
                    tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }}
                    width={36}
                  />
                  <YAxis
                    yAxisId="of"
                    orientation="right"
                    tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }}
                    width={36}
                  />
                  <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                  <Legend wrapperStyle={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }} />
                  <Line
                    yAxisId="ig"
                    type="monotone"
                    dataKey="ig_follower_delta"
                    name="IG follower Δ"
                    stroke="#D4AF8C"
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                  />
                  <Line
                    yAxisId="of"
                    type="monotone"
                    dataKey="of_new_subscribers"
                    name="OF new subs"
                    stroke="#FF1493"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="flex h-full items-center justify-center text-sm text-white/35">
                Not enough combined growth series yet.
              </p>
            )}
          </div>
        </div>

        <div className={cn(VA_CARD, "p-4")}>
          <div className="flex items-center gap-2">
            <SectionLabel>IG reach vs OF profile visitors</SectionLabel>
            <StatInfoTooltip text={CROSS_PLATFORM_STAT_INFO.reach_visitors} />
          </div>
          <p className="mt-1 text-[11px] text-white/40">
            Daily series used for the correlation above.
          </p>
          <div className="mt-3 h-56">
            {reachVisitorChart.length >= 3 ? (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={reachVisitorChart}>
                  <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                  <XAxis
                    dataKey="dateLabel"
                    tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }}
                  />
                  <YAxis
                    yAxisId="reach"
                    tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }}
                    width={44}
                  />
                  <YAxis
                    yAxisId="visitors"
                    orientation="right"
                    tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }}
                    width={40}
                  />
                  <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                  <Legend wrapperStyle={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }} />
                  <Bar
                    yAxisId="reach"
                    dataKey="reach"
                    name="IG reach"
                    fill="rgba(212,175,140,0.45)"
                    radius={[4, 4, 0, 0]}
                  />
                  <Line
                    yAxisId="visitors"
                    type="monotone"
                    dataKey="profile_visitors"
                    name="OF visitors"
                    stroke="#FF1493"
                    strokeWidth={2}
                    dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <p className="flex h-full items-center justify-center text-sm text-white/35">
                Not enough daily pairs yet.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Growth score components */}
      {score.available ? (
        <div className={cn(VA_CARD, "p-4")}>
          <div className="flex items-center gap-2">
            <SectionLabel>Combined Growth Score breakdown</SectionLabel>
            <StatInfoTooltip text={CROSS_PLATFORM_STAT_INFO.growth_score} />
          </div>
          <p className="mt-1 text-[11px] text-white/40">{score.note}</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {(
              [
                ["IG engagement", score.components.ig_engagement],
                ["IG follower trend", score.components.ig_follower_trend],
                ["OF sub trend", score.components.of_sub_trend],
                ["OF revenue trend", score.components.of_revenue_trend],
              ] as const
            ).map(([label, value]) => (
              <div
                key={label}
                className="rounded-xl border border-white/8 bg-black/25 px-3 py-2.5"
              >
                <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
                  {label}
                </p>
                <p className="mt-1 text-lg font-semibold tabular-nums text-white">
                  {value == null ? "—" : value}
                </p>
                {value != null ? (
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#D4AF8C] to-[#FF1493]"
                      style={{ width: `${value}%` }}
                    />
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Content → conversion */}
      <div className={cn(VA_CARD, "p-4 md:p-5")}>
        <div className="flex items-center gap-2">
          <SectionLabel>Content-to-conversion window</SectionLabel>
          <StatInfoTooltip text={CROSS_PLATFORM_STAT_INFO.content_window} />
        </div>
        <p className="mt-1 text-[11px] text-white/40">{data.content_conversion.note}</p>
        {data.content_conversion.available && data.content_conversion.windows.length ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-white/10 text-[11px] uppercase tracking-wider text-white/40">
                <tr>
                  <th className="px-3 py-2 font-medium">Post</th>
                  <th className="px-3 py-2 font-medium">Posted</th>
                  <th className="px-3 py-2 font-medium">Before 24h</th>
                  <th className="px-3 py-2 font-medium">After 24h</th>
                  <th className="px-3 py-2 font-medium">After 48h</th>
                  <th className="px-3 py-2 font-medium">After 72h</th>
                  <th className="px-3 py-2 font-medium">Hint</th>
                </tr>
              </thead>
              <tbody>
                {data.content_conversion.windows.map((w) => (
                  <tr key={w.media_id} className="border-b border-white/5">
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        {w.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={w.image_url}
                            alt=""
                            className="h-9 w-9 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="h-9 w-9 rounded-lg bg-white/5" />
                        )}
                        <div className="min-w-0">
                          <p className="truncate text-xs text-white/80 max-w-[160px]">
                            {w.caption || `Post #${w.rank}`}
                          </p>
                          <p className="text-[10px] text-white/35">
                            Reach {fmtNum(w.reach)}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 tabular-nums text-white/60">
                      {shortDate(w.posted_ymd)}
                    </td>
                    <td className="px-3 py-2.5 tabular-nums text-white/60">
                      {w.before_24h.new_subs} subs
                      <span className="block text-[10px] text-white/35">
                        {money(w.before_24h.revenue)}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 tabular-nums text-white/80">
                      {w.after_24h.new_subs} subs
                      <span className="block text-[10px] text-white/35">
                        {money(w.after_24h.revenue)}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 tabular-nums text-white/80">
                      {w.after_48h.new_subs} subs
                      <span className="block text-[10px] text-white/35">
                        {money(w.after_48h.revenue)}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 tabular-nums text-white/80">
                      {w.after_72h.new_subs} subs
                      <span className="block text-[10px] text-white/35">
                        {money(w.after_72h.revenue)}
                      </span>
                    </td>
                    <td className={cn("px-3 py-2.5 text-xs font-medium", liftColor(w.lift_hint))}>
                      {w.lift_hint === "up"
                        ? "Appears up"
                        : w.lift_hint === "down"
                          ? "Appears soft"
                          : w.lift_hint === "flat"
                            ? "Flat"
                            : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-4 text-sm text-white/40">
            No top-post windows available for this range yet.
          </p>
        )}
      </div>

      {/* Audience overlap skipped */}
      <div className="rounded-xl border border-white/8 bg-white/[0.02] px-4 py-3 text-xs text-white/40">
        <span className="font-medium text-white/55">Audience overlap:</span>{" "}
        {data.audience_overlap.reason}
      </div>

      <p className="text-[11px] leading-relaxed text-white/35">{conv.note}</p>
        </>
      ) : (
        <div className="rounded-xl border border-white/8 bg-white/[0.02] px-4 py-3 text-xs text-white/40">
          <span className="font-medium text-white/55">Audience overlap:</span>{" "}
          {data.audience_overlap.reason}
        </div>
      )}
    </div>
  );
}

/** Simplified encouraging card for model Earnings. */
export function ModelIgToOfCard({
  card,
  loading,
}: {
  card: ModelCrossPlatformCard | null | undefined;
  loading?: boolean;
}) {
  if (loading && !card) {
    return <IgSkeleton className="h-36" />;
  }
  if (!card) return null;

  const showEstimate = card.conversion_estimate_pct != null;
  const ready = card.status === "ready" || card.status === "sparse";

  return (
    <div className={cn(VA_CARD, VA_CARD_GLOW, "relative overflow-hidden p-4 md:p-5")}>
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 0% 0%, rgba(255,20,147,0.16), transparent 55%), radial-gradient(ellipse 50% 40% at 100% 100%, rgba(212,175,140,0.1), transparent 50%)",
        }}
      />
      <div className="relative">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[#D4AF8C]" />
          <SectionLabel>Your Instagram → Your OF</SectionLabel>
          <StatInfoTooltip text={CROSS_PLATFORM_STAT_INFO.section} />
        </div>
        <p className="mt-2 text-sm leading-relaxed text-white/75">{card.alignment_note}</p>

        {!ready ? (
          <p className="mt-3 text-xs text-white/40">{card.status_message}</p>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-white/8 bg-black/25 px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
                Growth score
              </p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-white">
                {card.growth_score == null ? "—" : card.growth_score}
              </p>
              <p className="text-[11px] text-[#D4AF8C]">{card.growth_label}</p>
            </div>
            <div className="rounded-xl border border-white/8 bg-black/25 px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
                Alignment
              </p>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-white/80">
                <span className="tabular-nums text-[#D4AF8C]">
                  {fmtDelta(card.ig_follower_delta)} IG
                </span>
                <ArrowRight className="h-3 w-3 text-white/30" />
                <span className="tabular-nums text-[#FFB6DE]">
                  +{fmtNum(card.of_new_subscribers)} OF
                </span>
              </p>
            </div>
            <div className="rounded-xl border border-white/8 bg-black/25 px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
                Conversion{" "}
                <span className="rounded border border-amber-400/40 bg-amber-400/10 px-1 py-0.5 text-[8px] font-bold uppercase text-amber-200">
                  Estimate
                </span>
              </p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-white">
                {showEstimate ? fmtPct(card.conversion_estimate_pct) : "—"}
              </p>
              <p className="text-[10px] text-white/35">Rough IG reach → new OF subs</p>
            </div>
          </div>
        )}

        {ready && showEstimate ? (
          <p className="mt-3 text-[10px] leading-relaxed text-white/35">
            Estimate only — not true attribution. Fans can discover you from many places.
          </p>
        ) : null}
      </div>
    </div>
  );
}
