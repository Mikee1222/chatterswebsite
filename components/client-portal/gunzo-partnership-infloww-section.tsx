"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { motion, useReducedMotion } from "framer-motion";
import { Heart, Link2Off, Megaphone, Sparkles, TrendingUp } from "lucide-react";
import {
  CountUp,
  DatePresetBar,
  LuxuryStatCard,
  PeriodBadge,
  SectionLabel,
  StatInfoTooltip,
  money,
  pct,
} from "@/components/infloww-performance-ui";
import {
  CLIENT_PARTNERSHIP_STAT_INFO,
  type ClientPartnershipInflowwStats,
} from "@/services/client-partnership-infloww";
import type { InflowwStatsPreset } from "@/services/infloww-performance";
import { VA_CARD, VA_CARD_GLOW } from "@/lib/va-tasks-tokens";
import { cn } from "@/lib/utils";

const ResponsiveContainer = dynamic(() => import("recharts").then((m) => m.ResponsiveContainer), {
  ssr: false,
});
const AreaChart = dynamic(() => import("recharts").then((m) => m.AreaChart), { ssr: false });
const Area = dynamic(() => import("recharts").then((m) => m.Area), { ssr: false });
const LineChart = dynamic(() => import("recharts").then((m) => m.LineChart), { ssr: false });
const Line = dynamic(() => import("recharts").then((m) => m.Line), { ssr: false });
const CartesianGrid = dynamic(() => import("recharts").then((m) => m.CartesianGrid), { ssr: false });
const XAxis = dynamic(() => import("recharts").then((m) => m.XAxis), { ssr: false });
const YAxis = dynamic(() => import("recharts").then((m) => m.YAxis), { ssr: false });
const Tooltip = dynamic(() => import("recharts").then((m) => m.Tooltip), { ssr: false });

type Props = {
  initial: ClientPartnershipInflowwStats;
  accountLabel?: string;
};

function tip(key: keyof typeof CLIENT_PARTNERSHIP_STAT_INFO) {
  return CLIENT_PARTNERSHIP_STAT_INFO[key];
}

function formatLinkType(linkType: string) {
  const t = linkType.trim();
  if (!t) return "Link";
  return t.charAt(0) + t.slice(1).toLowerCase().replace(/_/g, " ");
}

export function ClientGunzoPartnershipInflowwSection({ initial, accountLabel }: Props) {
  const reduce = useReducedMotion();
  const [data, setData] = React.useState(initial);
  const [preset, setPreset] = React.useState<InflowwStatsPreset>(initial.range.preset);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async (nextPreset: InflowwStatsPreset) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/client/partnership-stats?preset=${nextPreset}`, {
        cache: "no-store",
      });
      const json = (await res.json()) as ClientPartnershipInflowwStats & { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Failed to load");
      setData(json);
      setPreset(json.range.preset);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  const displayName =
    accountLabel?.trim() ||
    (data.modelNames.length === 1
      ? data.modelNames[0]
      : data.modelNames.length > 1
        ? data.modelNames.join(" · ")
        : "Your account");

  if (!data.linked && !loading) {
    return (
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          VA_CARD,
          VA_CARD_GLOW,
          "flex flex-col items-center gap-4 border border-white/10 bg-white/5 p-8 text-center"
        )}
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[#D4AF8C]/25 bg-[#D4AF8C]/10">
          <Link2Off className="h-6 w-6 text-[#D4AF8C]" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-white">Your account stats are syncing</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-white/55">
            Live OnlyFans performance will appear here once your creator account is linked and
            synced. Your partnership billing summary below still reflects weekly Gunzo fees.
          </p>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="space-y-6">
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#FF1493]/12 via-[#151315] to-[#0D0B0D] p-6 md:p-8"
      >
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[#FF1493]/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-12 left-8 h-36 w-36 rounded-full bg-[#D4AF8C]/12 blur-3xl" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#D4AF8C]/90">
              Your account is performing
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white md:text-3xl">
              {displayName}
            </h2>
            <p className="mt-2 text-sm text-white/50">
              {data.range.startYmd} → {data.range.endYmd}
            </p>
          </div>
          <DatePresetBar
            preset={preset}
            loading={loading}
            onSelect={(p) => {
              if (p === "custom") return;
              setPreset(p);
              void load(p);
            }}
          />
        </div>

        <div className="relative mt-8 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          <div className="col-span-2 md:col-span-1">
            <p className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
              Total revenue
              <StatInfoTooltip text={tip("gross_revenue")} />
            </p>
            <p className="mt-1 text-3xl font-semibold tabular-nums text-[#FF1493] md:text-4xl">
              <CountUp value={data.revenue.gross} format={(n) => money(n, 0)} />
            </p>
            {data.revenue.change ? (
              <div className="mt-2">
                <PeriodBadge change={data.revenue.change} />
              </div>
            ) : null}
          </div>
          <div>
            <p className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
              Net take-home
              <StatInfoTooltip text={tip("net_revenue")} />
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-[#D4AF8C] md:text-3xl">
              <CountUp value={data.revenue.net} format={(n) => money(n, 0)} />
            </p>
          </div>
          <div>
            <p className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
              Active fans
              <StatInfoTooltip text={tip("active_fans")} />
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-white md:text-3xl">
              <CountUp value={data.fans.active} format={(n) => Math.round(n).toLocaleString()} />
            </p>
          </div>
          <div>
            <p className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
              Platform rank
              <StatInfoTooltip text={tip("platform_rank")} />
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-emerald-300 md:text-3xl">
              {data.ranking.latest == null ? "—" : `${data.ranking.latest.toFixed(1)}%`}
            </p>
            <p className="mt-1 text-[11px] text-white/35">Lower is closer to top</p>
          </div>
        </div>
      </motion.div>

      {error ? (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className={cn(VA_CARD, "border border-white/10 bg-white/5 p-5")}>
          <div className="mb-3 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-[#FF1493]" />
            <SectionLabel>Revenue trend</SectionLabel>
            <StatInfoTooltip text={tip("revenue_trend")} />
          </div>
          {data.revenue.dailyTrend.length ? (
            <div className="h-52 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.revenue.dailyTrend}>
                  <defs>
                    <linearGradient id="clientRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#FF1493" stopOpacity={0.45} />
                      <stop offset="100%" stopColor="#FF1493" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }}
                    tickFormatter={(v: string) => v.slice(5)}
                  />
                  <YAxis
                    tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }}
                    tickFormatter={(v: number) => `$${Math.round(v / 1000)}k`.replace("$0k", "$0")}
                  />
                  <Tooltip
                    formatter={(value) => [money(Number(value ?? 0), 0), "Revenue"]}
                    contentStyle={{
                      background: "#141214",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 12,
                    }}
                    labelStyle={{ color: "rgba(255,255,255,0.5)" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="gross"
                    stroke="#FF1493"
                    fill="url(#clientRev)"
                    strokeWidth={2}
                    isAnimationActive={!reduce}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-white/40">No daily revenue in this period yet.</p>
          )}
        </div>

        <div className={cn(VA_CARD, "border border-white/10 bg-white/5 p-5")}>
          <div className="mb-3 flex items-center gap-2">
            <Heart className="h-4 w-4 text-[#D4AF8C]" />
            <SectionLabel>Fan growth</SectionLabel>
            <StatInfoTooltip text={tip("fan_trend")} />
          </div>
          {data.fans.dailyTrend.length ? (
            <div className="h-52 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.fans.dailyTrend}>
                  <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }}
                    tickFormatter={(v: string) => v.slice(5)}
                  />
                  <YAxis tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{
                      background: "#141214",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 12,
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="new_subscribers"
                    name="New fans"
                    stroke="#FF1493"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={!reduce}
                  />
                  <Line
                    type="monotone"
                    dataKey="renewals"
                    name="Renewals"
                    stroke="#D4AF8C"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={!reduce}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-white/40">Fan growth data not synced yet.</p>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <LuxuryStatCard
          label="New subscribers"
          value={
            <CountUp
              value={data.fans.new_subscribers}
              format={(n) => Math.round(n).toLocaleString()}
            />
          }
          tooltip={tip("new_fans")}
          accent="pink"
          glow
        />
        <LuxuryStatCard
          label="Renewals"
          value={
            <CountUp value={data.fans.renewals} format={(n) => Math.round(n).toLocaleString()} />
          }
          tooltip={tip("renewals")}
          accent="champagne"
        />
        <LuxuryStatCard
          label="Auto-renew share"
          value={data.fans.renew_on_share == null ? "—" : pct(data.fans.renew_on_share)}
          hint={data.fans.renew_on_label}
          tooltip={tip("auto_renew")}
          accent="emerald"
        />
        <LuxuryStatCard
          label="Fees & refunds"
          value={money(data.revenue.fees + data.revenue.refunds, 0)}
          hint={`Fees ${money(data.revenue.fees, 0)} · Refunds ${money(data.revenue.refunds, 0)}`}
          tooltip={tip("net_revenue")}
        />
      </div>

      {data.ranking.trend.length > 1 ? (
        <div className={cn(VA_CARD, "border border-white/10 bg-white/5 p-5")}>
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-emerald-300" />
            <SectionLabel>Platform ranking trend</SectionLabel>
            <StatInfoTooltip text={tip("rank_trend")} />
          </div>
          <div className="h-44 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.ranking.trend}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }}
                  tickFormatter={(v: string) => v.slice(5)}
                />
                <YAxis
                  reversed
                  domain={["dataMin - 2", "dataMax + 2"]}
                  tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }}
                  tickFormatter={(v: number) => `${v}%`}
                />
                <Tooltip
                  formatter={(value) => [`${Number(value ?? 0).toFixed(1)}%`, "Rank"]}
                  contentStyle={{
                    background: "#141214",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 12,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="rank"
                  stroke="#34d399"
                  strokeWidth={2}
                  dot={{ r: 2, fill: "#34d399" }}
                  isAnimationActive={!reduce}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : null}

      {data.marketing.length > 0 ? (
        <div className={cn(VA_CARD, "border border-white/10 bg-white/5 p-5")}>
          <div className="mb-4 flex items-center gap-2">
            <Megaphone className="h-4 w-4 text-[#FF1493]" />
            <SectionLabel>Top marketing links</SectionLabel>
            <StatInfoTooltip text={tip("marketing_links")} />
          </div>
          <div className="space-y-2">
            {data.marketing.map((link) => (
              <div
                key={link.link_id}
                className="flex flex-col gap-2 rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#D4AF8C]/80">
                    {formatLinkType(link.link_type)}
                  </p>
                  <p className="mt-0.5 truncate text-sm text-white/80">
                    {link.message?.trim() || "Promotional link"}
                  </p>
                  <p className="mt-1 text-xs text-white/40">
                    {link.sub_count.toLocaleString()} subs
                    {link.revenue_per_sub != null
                      ? ` · ${money(link.revenue_per_sub, 0)} per sub`
                      : null}
                  </p>
                </div>
                <p className="shrink-0 text-lg font-semibold tabular-nums text-[#FF1493]">
                  {money(link.earnings_gross, 0)}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {loading ? (
        <p className="text-center text-xs text-white/35" aria-live="polite">
          Updating your stats…
        </p>
      ) : null}
    </div>
  );
}
