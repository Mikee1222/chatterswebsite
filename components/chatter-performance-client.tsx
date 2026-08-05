"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { motion, useReducedMotion } from "framer-motion";
import { Link2Off, Sparkles, Trophy, Flame, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { VA_CARD, VA_CARD_GLOW } from "@/lib/va-tasks-tokens";
import {
  ConsistencyRing,
  ConversionFunnelViz,
  CountUp,
  DatePresetBar,
  InflowwCustomDateRange,
  LuxuryStatCard,
  MetricLabel,
  PeriodBadge,
  PersonalBestCallout,
  SectionLabel,
  StatInfoTooltip,
  money,
  pct,
} from "@/components/infloww-performance-ui";
import type {
  InflowwChatterPerformance,
  InflowwStatsPreset,
} from "@/services/infloww-performance";

const Area = dynamic(() => import("recharts").then((m) => m.Area), { ssr: false });
const AreaChart = dynamic(() => import("recharts").then((m) => m.AreaChart), { ssr: false });
const CartesianGrid = dynamic(() => import("recharts").then((m) => m.CartesianGrid), { ssr: false });
const ResponsiveContainer = dynamic(() => import("recharts").then((m) => m.ResponsiveContainer), {
  ssr: false,
});
const Tooltip = dynamic(() => import("recharts").then((m) => m.Tooltip), { ssr: false });
const XAxis = dynamic(() => import("recharts").then((m) => m.XAxis), { ssr: false });
const YAxis = dynamic(() => import("recharts").then((m) => m.YAxis), { ssr: false });

function UnlinkedEmpty() {
  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          VA_CARD,
          VA_CARD_GLOW,
          "flex flex-col items-center gap-5 border border-white/10 bg-white/5 p-10 text-center"
        )}
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-[#D4AF8C]/25 bg-[#D4AF8C]/10">
          <Link2Off className="h-7 w-7 text-[#D4AF8C]" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-white">My Performance</h1>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/55">
            Your Infloww account isn&apos;t linked yet. Ask an admin to set your Infloww employee ID
            so sales and chat stats can sync here.
          </p>
        </div>
      </motion.div>
    </div>
  );
}

export function ChatterPerformanceClient({ initial }: { initial: InflowwChatterPerformance }) {
  const reduce = useReducedMotion();
  const [data, setData] = React.useState(initial);
  const [preset, setPreset] = React.useState<InflowwStatsPreset>(initial.range.preset);
  /** Draft custom range — not overwritten when loading named presets. */
  const [customStart, setCustomStart] = React.useState(initial.range.startYmd);
  const [customEnd, setCustomEnd] = React.useState(initial.range.endYmd);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function load(nextPreset: InflowwStatsPreset, start?: string, end?: string) {
    setLoading(true);
    setError(null);
    try {
      const qp = new URLSearchParams({ preset: nextPreset });
      if (nextPreset === "custom") {
        qp.set("start", start ?? customStart);
        qp.set("end", end ?? customEnd);
      }
      const res = await fetch(`/api/infloww-stats?${qp.toString()}`);
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || `Failed (${res.status})`);
      }
      const json = (await res.json()) as InflowwChatterPerformance;
      setData(json);
      setPreset(json.range.preset);
      if (json.range.preset === "custom") {
        setCustomStart(json.range.startYmd);
        setCustomEnd(json.range.endYmd);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  if (!data.linked) {
    return <UnlinkedEmpty />;
  }

  const t = data.totals;
  const a = data.analytics;
  const bestCreator = data.by_performer[0];

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#FF1493]/15 via-[#151315] to-[#0D0B0D] p-6 md:p-8"
      >
        <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-[#FF1493]/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 left-10 h-40 w-40 rounded-full bg-[#D4AF8C]/15 blur-3xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#D4AF8C]/90">
              Infloww · Your stage
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white md:text-4xl">
              My Performance
            </h1>
            <p className="mt-2 text-sm text-white/50">
              {data.range.startYmd} → {data.range.endYmd}
            </p>
          </div>
          <DatePresetBar
            preset={preset}
            loading={loading}
            onSelect={(p) => {
              setPreset(p);
              if (p !== "custom") void load(p);
            }}
          />
        </div>

        <div className="relative mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
              <MetricLabel metricId="total_sales">Total sales</MetricLabel>
            </p>
            <p className="mt-1 text-3xl font-semibold tabular-nums text-[#FF1493] md:text-4xl">
              <CountUp value={t.sales} format={(n) => money(n)} />
            </p>
            {a ? <div className="mt-2"><PeriodBadge change={a.period_change.sales} /></div> : null}
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
              <MetricLabel metricId="ppv">PPV</MetricLabel>
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-[#D4AF8C] md:text-3xl">
              <CountUp value={t.ppv_sales} format={(n) => money(n)} />
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
              <MetricLabel metricId="tips">Tips</MetricLabel>
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-white md:text-3xl">
              <CountUp value={t.tips} format={(n) => money(n)} />
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
              <MetricLabel metricId="fans_chatted">Fans chatted</MetricLabel>
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-emerald-400 md:text-3xl">
              <CountUp value={t.fans_chatted} format={(n) => Math.round(n).toLocaleString()} />
            </p>
          </div>
        </div>
      </motion.div>

      {preset === "custom" ? (
        <InflowwCustomDateRange
          startYmd={customStart}
          endYmd={customEnd}
          loading={loading}
          onChange={(start, end) => {
            setCustomStart(start);
            setCustomEnd(end);
          }}
          onApply={(start, end) => void load("custom", start, end)}
        />
      ) : null}

      {error ? (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      {a ? (
        <PersonalBestCallout
          bestDay={a.personal_best.best_day}
          bestWeek={a.personal_best.best_week}
          warm
        />
      ) : null}

      {a?.daily_tip ? (
        <div
          className={cn(
            VA_CARD,
            "border border-white/10 bg-gradient-to-r from-white/5 to-[#D4AF8C]/8 p-5"
          )}
        >
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#D4AF8C]/30 bg-[#D4AF8C]/10">
              <Sparkles className="h-5 w-5 text-[#D4AF8C]" />
            </div>
            <div>
              <SectionLabel metricId="daily_tip">Today&apos;s tip</SectionLabel>
              <p className="mt-1 text-lg font-semibold text-white">{a.daily_tip.label}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-white/55">{a.daily_tip.detail}</p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <LuxuryStatCard
          label="Golden Ratio"
          metricId="golden_ratio"
          value={pct(t.golden_ratio)}
          hint="PPVs ÷ messages"
          accent="champagne"
        />
        <LuxuryStatCard
          label="Unlock rate"
          metricId="unlock_rate"
          value={
            a?.funnel.unlock_data_sparse
              ? "n/a"
              : a
                ? pct(a.funnel.unlock_rate)
                : "—"
          }
          hint={
            a?.funnel.unlock_data_sparse
              ? "Not yet synced"
              : a
                ? `${a.funnel.unlocked.toLocaleString()} / ${a.funnel.ppvs_sent.toLocaleString()} PPVs`
                : undefined
          }
          accent="emerald"
        />
        <LuxuryStatCard
          label="Rev / hour"
          metricId="rev_per_hour"
          value={a?.revenue_per_hour != null ? money(a.revenue_per_hour) : "—"}
          hint={
            a?.revenue_per_hour != null
              ? `${a.shift_hours}h on shift`
              : "Not enough shift data"
          }
          accent="champagne"
        />
        <LuxuryStatCard
          label="Rev / fan"
          metricId="rev_per_fan"
          value={a?.revenue_per_fan != null ? money(a.revenue_per_fan, 2) : "—"}
          accent="pink"
        />
        <LuxuryStatCard
          label="Avg PPV price"
          metricId="avg_ppv"
          value={a?.avg_ppv_price != null ? money(a.avg_ppv_price, 2) : "—"}
          hint="PPV revenue ÷ PPVs sent"
        />
        <LuxuryStatCard
          label="Avg tip"
          metricId="avg_tip"
          value={a?.avg_tip_size != null ? money(a.avg_tip_size, 2) : "—"}
          hint={a?.tip_size_note ? "Estimated from tip days" : undefined}
        />
      </div>

      {(a?.sales_streak || a?.best_day_of_week) ? (
        <div className="grid gap-3 md:grid-cols-2">
          {a.sales_streak ? (
            <div
              className={cn(
                VA_CARD,
                "border border-emerald-500/20 bg-emerald-500/5 p-5"
              )}
            >
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10">
                  <Flame className="h-5 w-5 text-emerald-300" />
                </div>
                <div>
                  <SectionLabel metricId="streak">Streak</SectionLabel>
                  <p className="mt-1 text-2xl font-semibold text-emerald-300">
                    {a.sales_streak.days} days
                  </p>
                  <p className="mt-1.5 text-sm leading-relaxed text-white/55">
                    {a.sales_streak.label}
                  </p>
                </div>
              </div>
            </div>
          ) : null}
          {a.best_day_of_week ? (
            <div className={cn(VA_CARD, "border border-white/10 bg-white/5 p-5")}>
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5">
                  <CalendarDays className="h-5 w-5 text-[#D4AF8C]" />
                </div>
                <div>
                  <SectionLabel metricId="best_day_of_week">Best day of week</SectionLabel>
                  {a.best_day_of_week.confidence === "insufficient" ? (
                    <>
                      <p className="mt-1 text-lg font-semibold text-white/50">Not enough data</p>
                      <p className="mt-1.5 text-sm text-white/45">{a.best_day_of_week.note}</p>
                    </>
                  ) : (
                    <>
                      <p className="mt-1 text-2xl font-semibold text-white">
                        {a.best_day_of_week.weekday}
                        <span className="ml-2 text-sm font-normal text-white/40">
                          avg {money(a.best_day_of_week.avg_sales)}
                        </span>
                      </p>
                      <p className="mt-1.5 text-sm leading-relaxed text-white/55">
                        {a.best_day_of_week.note}
                        {a.best_day_of_week.confidence === "weak"
                          ? " (best-effort)"
                          : ""}
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {a ? <ConversionFunnelViz funnel={a.funnel} /> : null}
        {a ? <ConsistencyRing score={a.consistency_score} /> : null}
      </div>

      {a?.team_standing ? (
        <div
          className={cn(
            VA_CARD,
            "border border-white/10 bg-gradient-to-r from-white/5 to-[#FF1493]/5 p-5"
          )}
        >
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#FF1493]/30 bg-[#FF1493]/10">
              <Trophy className="h-5 w-5 text-[#FF1493]" />
            </div>
            <div>
              <SectionLabel metricId="team_standing">Team standing</SectionLabel>
              <p className="mt-1 text-lg font-semibold text-white">
                #{a.team_standing.rank} of {a.team_standing.of}{" "}
                <span className="text-sm font-normal text-white/45">
                  · top {a.team_standing.percentile}%
                </span>
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-white/55">{a.team_standing.label}</p>
            </div>
          </div>
        </div>
      ) : a ? (
        <div className={cn(VA_CARD, "border border-white/10 bg-white/5 p-5")}>
          <SectionLabel metricId="team_standing">Team standing</SectionLabel>
          <p className="mt-2 text-sm text-white/45">Not enough team data yet to rank</p>
        </div>
      ) : null}

      {bestCreator && bestCreator.totals.sales > 0 ? (
        <div className={cn(VA_CARD, VA_CARD_GLOW, "border border-[#D4AF8C]/20 bg-white/5 p-5")}>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[#D4AF8C]" />
            <SectionLabel metricId="best_creator">You perform best with…</SectionLabel>
          </div>
          <p className="mt-2 text-xl font-semibold text-white">{bestCreator.performer_name}</p>
          <p className="mt-1 text-sm text-white/50">
            {money(bestCreator.totals.sales)} sales · {bestCreator.totals.messages_sent} msgs · CVR{" "}
            {pct(bestCreator.totals.fan_cvr)}
          </p>
        </div>
      ) : null}

      <div className={cn(VA_CARD, "border border-white/10 bg-white/5 p-4")}>
        <SectionLabel metricId="sales_trend">Sales trend</SectionLabel>
        <div className="mt-3 h-64 w-full">
          {data.daily.length === 0 ? (
            <p className="flex h-full items-center justify-center text-sm text-white/40">
              No synced data for this range yet — check back after the daily sync.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.daily}>
                <defs>
                  <linearGradient id="perfSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#FF1493" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="#FF1493" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="ymd" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} />
                <YAxis tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    background: "#1a1a1a",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 12,
                  }}
                  formatter={(value) => money(Number(value ?? 0))}
                />
                <Area
                  type="monotone"
                  dataKey="sales"
                  stroke="#FF1493"
                  fill="url(#perfSales)"
                  strokeWidth={2}
                  isAnimationActive={!reduce}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className={cn(VA_CARD, "overflow-hidden border border-white/10 bg-white/5")}>
        <div className="border-b border-white/8 px-4 py-3">
          <SectionLabel metricId="per_creator">Per creator ranking</SectionLabel>
        </div>
        {data.by_performer.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-white/40">No creator breakdown yet.</p>
        ) : (
          <div className="divide-y divide-white/6">
            {data.by_performer.map((p, i) => (
              <div key={p.performer_id} className="flex items-center gap-3 px-4 py-3">
                <span
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold",
                    i === 0
                      ? "bg-[#FF1493]/20 text-[#FF1493]"
                      : "bg-white/5 text-white/40"
                  )}
                >
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">{p.performer_name}</p>
                  <p className="text-xs text-white/40">
                    {p.totals.messages_sent} msgs · {p.totals.fans_chatted} fans · CVR{" "}
                    {pct(p.totals.fan_cvr)}
                  </p>
                </div>
                <p className="text-sm font-semibold tabular-nums text-[#FF1493]">
                  {money(p.totals.sales)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {a?.period_change ? (
        <div className="grid grid-cols-3 gap-3">
          {(
            [
              ["Sales", "total_sales", a.period_change.sales],
              ["Messages", "messages", a.period_change.messages],
              ["Unlock rate", "unlock_rate", a.period_change.unlock_rate],
            ] as const
          ).map(([label, metricId, change]) => (
            <div
              key={label}
              className={cn(VA_CARD, "border border-white/10 bg-white/5 p-3 text-center")}
            >
              <p className="inline-flex items-center justify-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-white/35">
                <MetricLabel metricId={metricId}>{label}</MetricLabel>
              </p>
              <div className="mt-2 flex items-center justify-center gap-1">
                <PeriodBadge change={change} />
                <StatInfoTooltip metricId="wow" />
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {a?.whale_suggestions && a.whale_suggestions.length > 0 ? (
        <div className={cn(VA_CARD, "border border-[#D4AF8C]/20 bg-white/5 p-5")}>
          <SectionLabel metricId="fans_to_watch">Fans to watch</SectionLabel>
          <p className="mt-1 mb-3 text-xs text-white/40">
            High-value rebill activity not yet in Whales — suggest only, no auto-create.
          </p>
          <ul className="space-y-2">
            {a.whale_suggestions.slice(0, 5).map((w) => (
              <li
                key={w.id}
                className="rounded-xl border border-white/8 px-3 py-2 text-sm text-white/80"
              >
                <span className="font-semibold text-white">{w.label}</span>
                <span className="mt-0.5 block text-xs text-white/45">{w.reason}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {a?.rebill_retention && !a.rebill_retention.available ? (
        <p className="text-center text-[11px] text-white/30">{a.rebill_retention.note}</p>
      ) : null}
    </div>
  );
}
