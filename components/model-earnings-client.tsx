"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { useReducedMotion } from "framer-motion";
import { Heart, Sparkles } from "lucide-react";
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
import { ModelInstagramInsightsPanel } from "@/components/model-instagram-insights-panel";
import { CREATOR_EARNINGS_STAT_INFO } from "@/services/infloww-creator-analytics";
import type { InflowwStatsPreset } from "@/services/infloww-performance";
import { VA_CARD, VA_CARD_GLOW } from "@/lib/va-tasks-tokens";
import { cn } from "@/lib/utils";

const ResponsiveContainer = dynamic(() => import("recharts").then((m) => m.ResponsiveContainer), {
  ssr: false,
});
const AreaChart = dynamic(() => import("recharts").then((m) => m.AreaChart), { ssr: false });
const Area = dynamic(() => import("recharts").then((m) => m.Area), { ssr: false });
const CartesianGrid = dynamic(() => import("recharts").then((m) => m.CartesianGrid), { ssr: false });
const XAxis = dynamic(() => import("recharts").then((m) => m.XAxis), { ssr: false });
const YAxis = dynamic(() => import("recharts").then((m) => m.YAxis), { ssr: false });
const Tooltip = dynamic(() => import("recharts").then((m) => m.Tooltip), { ssr: false });
const LineChart = dynamic(() => import("recharts").then((m) => m.LineChart), { ssr: false });
const Line = dynamic(() => import("recharts").then((m) => m.Line), { ssr: false });

type Payload = {
  range: { startYmd: string; endYmd: string; preset: InflowwStatsPreset };
  modelName?: string;
  linked?: boolean;
  daily: Array<{
    date: string;
    performance_rank: number | null;
    profile_visitors: number;
    active_fans: number;
    expired_fans: number;
    new_subscribers: number;
    renewals: number;
    fans_with_renew_on?: number;
  }>;
  marketingLinks: Array<{
    id: string;
    link_type: string;
    message: string | null;
    sub_count: number;
    paying_fans_count: number;
    earnings_gross: number;
    earnings_net: number;
  }>;
  analytics: {
    profit: { gross: number; fees: number; refunds: number; net_profit: number };
    refund_rate: { rate: number | null };
    churn: {
      active_fans: number;
      fans_with_renew_on: number | null;
      renew_on_share: number | null;
      label: string;
    };
    arpu: number | null;
    growth: {
      new_subscribers: number;
      renewals: number;
      profile_visitors: number;
      latest_rank: number | null;
    };
    revenue_change: {
      current: number;
      previous: number;
      pct_change: number | null;
      direction: "up" | "down" | "flat" | "na";
    } | null;
  };
  acquisition: Array<{
    link_id: string;
    link_type: string;
    message: string | null;
    sub_count: number;
    earnings_gross: number;
    revenue_per_sub: number | null;
  }>;
  latest: {
    active_fans: number;
    expired_fans: number;
    performance_rank: number | null;
    fans_with_renew_on?: number;
    date: string;
  } | null;
  error?: string;
};

function tip(key: keyof typeof CREATOR_EARNINGS_STAT_INFO) {
  return CREATOR_EARNINGS_STAT_INFO[key];
}

export function ModelEarningsClient({ modelName }: { modelName: string }) {
  const [tab, setTab] = React.useState<"earnings" | "instagram">("earnings");
  const [preset, setPreset] = React.useState<InflowwStatsPreset>("this_month");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [data, setData] = React.useState<Payload | null>(null);
  const reduce = useReducedMotion();

  const load = React.useCallback(
    async (nextPreset?: InflowwStatsPreset) => {
      setLoading(true);
      setError(null);
      try {
        const p = nextPreset ?? preset;
        const res = await fetch(`/api/model/earnings?preset=${p}`, { cache: "no-store" });
        const json = (await res.json()) as Payload;
        if (!res.ok) throw new Error(json.error ?? "Failed to load");
        setData(json);
        setPreset(json.range.preset);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    },
    [preset]
  );

  React.useEffect(() => {
    void load("this_month");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const a = data?.analytics;
  const revenueTrend = React.useMemo(() => {
    // Approximate daily revenue trend from daily new activity isn't available;
    // use visitor/sub series for growth feel + rank for platform standing.
    return (data?.daily ?? []).map((d) => ({
      date: d.date,
      visitors: d.profile_visitors,
      newSubs: d.new_subscribers,
      renewals: d.renewals,
    }));
  }, [data?.daily]);

  const rankTrend = React.useMemo(
    () =>
      (data?.daily ?? [])
        .filter((d) => d.performance_rank != null)
        .map((d) => ({ date: d.date, rank: d.performance_rank as number })),
    [data?.daily]
  );

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-1 pb-8">
      <div className={cn(VA_CARD, VA_CARD_GLOW, "p-5")}>
        <p className="text-xs font-medium uppercase tracking-wider text-[#D4AF8C]/80">
          {modelName}
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-white">My earnings</h1>
        <p className="mt-1 text-sm text-white/50">
          A warm look at your account health — revenue, fans, and Instagram performance.
        </p>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => setTab("earnings")}
            className={cn(
              "rounded-xl px-3 py-1.5 text-xs font-semibold transition",
              tab === "earnings"
                ? "bg-[#FF1493]/20 text-[#FFB6DE] ring-1 ring-[#FF1493]/40"
                : "bg-white/5 text-white/50 hover:bg-white/10"
            )}
          >
            OnlyFans
          </button>
          <button
            type="button"
            onClick={() => setTab("instagram")}
            className={cn(
              "rounded-xl px-3 py-1.5 text-xs font-semibold transition",
              tab === "instagram"
                ? "bg-[#FF1493]/20 text-[#FFB6DE] ring-1 ring-[#FF1493]/40"
                : "bg-white/5 text-white/50 hover:bg-white/10"
            )}
          >
            Instagram
          </button>
        </div>
        {tab === "earnings" ? (
          <>
            <div className="mt-4">
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
            {data?.range ? (
              <p className="mt-3 text-xs text-white/40">
                {data.range.startYmd} → {data.range.endYmd}
              </p>
            ) : null}
          </>
        ) : null}
      </div>

      {tab === "instagram" ? <ModelInstagramInsightsPanel /> : null}

      {tab === "earnings" ? (
        <>
      {error ? (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      ) : null}

      {data && data.linked === false && !loading ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          Earnings aren’t linked to Infloww yet. Ask an admin to set your Infloww creator ID — until
          then this page stays empty.
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <LuxuryStatCard
          label="Gross revenue"
          value={
            <CountUp
              value={a?.profit.gross ?? 0}
              format={(n) => money(n, 0)}
              duration={reduce ? 0 : 900}
            />
          }
          badge={
            a?.revenue_change ? (
              <PeriodBadge change={a.revenue_change} />
            ) : undefined
          }
          tooltip={tip("gross")}
          accent="champagne"
          glow
        />
        <LuxuryStatCard
          label="Net after fees & refunds"
          value={<CountUp value={a?.profit.net_profit ?? 0} format={(n) => money(n, 0)} />}
          hint={
            a
              ? `Fees ${money(a.profit.fees, 0)} · Refunds ${money(a.profit.refunds, 0)}`
              : undefined
          }
          tooltip={tip("net_profit")}
          accent="emerald"
          glow
        />
        <LuxuryStatCard
          label="Auto-renew fans"
          value={
            a?.churn.renew_on_share == null ? "—" : pct(a.churn.renew_on_share)
          }
          hint={a?.churn.label}
          tooltip={tip("churn_risk")}
          accent="pink"
        />
        <LuxuryStatCard
          label="Platform rank"
          value={
            a?.growth.latest_rank == null ? "—" : `${a.growth.latest_rank.toFixed(1)}%`
          }
          hint="Lower % is closer to the top"
          tooltip={tip("rank")}
        />
      </div>

      <div className={cn(VA_CARD, "p-4")}>
        <div className="mb-2 flex items-center gap-2">
          <Heart className="h-4 w-4 text-[#FF1493]" />
          <SectionLabel>Fan growth</SectionLabel>
          <StatInfoTooltip text="Visitors → new subscribers → active fans → renewals in this period." />
        </div>
        <p className="text-sm leading-relaxed text-white/75">
          {(a?.growth.profile_visitors ?? 0).toLocaleString()} profile visits brought{" "}
          <span className="text-[#D4AF8C]">
            {(a?.growth.new_subscribers ?? 0).toLocaleString()} new fans
          </span>
          . You have{" "}
          <span className="text-white">{(a?.churn.active_fans ?? 0).toLocaleString()} active</span>
          {a?.churn.fans_with_renew_on != null ? (
            <>
              {" "}
              — and{" "}
              <span className="text-emerald-300">
                {a.churn.fans_with_renew_on.toLocaleString()} with auto-renew on
              </span>
            </>
          ) : null}
          . Renewals this period: {(a?.growth.renewals ?? 0).toLocaleString()}.
        </p>
      </div>

      <div className={cn(VA_CARD, "p-4")}>
        <div className="mb-3 flex items-center gap-2">
          <SectionLabel>Growth trend</SectionLabel>
        </div>
        {revenueTrend.length ? (
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueTrend}>
                <defs>
                  <linearGradient id="modelSubs" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#FF1493" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#FF1493" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }} />
                <YAxis tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }} />
                <Tooltip
                  contentStyle={{
                    background: "#141214",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 12,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="newSubs"
                  name="New subs"
                  stroke="#FF1493"
                  fill="url(#modelSubs)"
                  strokeWidth={2}
                  isAnimationActive={!reduce}
                />
                <Area
                  type="monotone"
                  dataKey="renewals"
                  name="Renewals"
                  stroke="#D4AF8C"
                  fill="transparent"
                  strokeWidth={2}
                  isAnimationActive={!reduce}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex flex-col items-center py-10 text-center">
            <Sparkles className="mb-2 h-5 w-5 text-[#D4AF8C]/70" />
            <p className="text-sm text-white/70">No growth data in this window yet</p>
            <p className="mt-1 text-xs text-white/40">Check back after the daily sync.</p>
          </div>
        )}
      </div>

      {rankTrend.length ? (
        <div className={cn(VA_CARD, "p-4")}>
          <div className="mb-3 flex items-center gap-2">
            <SectionLabel>Ranking trend</SectionLabel>
            <StatInfoTooltip text={tip("rank")} />
          </div>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={rankTrend}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }} />
                <YAxis
                  reversed
                  tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }}
                  domain={["auto", "auto"]}
                />
                <Tooltip
                  contentStyle={{
                    background: "#141214",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 12,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="rank"
                  stroke="#D4AF8C"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={!reduce}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : null}

      <div className={cn(VA_CARD, "overflow-hidden")}>
        <div className="border-b border-white/8 px-4 py-3">
          <SectionLabel>Best marketing links</SectionLabel>
          <p className="mt-1 text-xs text-white/40">
            Trial &amp; tracking links ranked by earnings (campaign links are admin-only).{" "}
            <StatInfoTooltip text={tip("marketing")} />
          </p>
        </div>
        {(data?.acquisition ?? []).length ? (
          <ul className="divide-y divide-white/6">
            {(data?.acquisition ?? []).slice(0, 8).map((l) => (
              <li key={l.link_id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm text-white/85">{l.message || "Untitled link"}</p>
                  <p className="text-xs text-white/40">
                    {l.link_type} · {l.sub_count} subs
                    {l.revenue_per_sub != null
                      ? ` · ${money(l.revenue_per_sub, 2)}/sub`
                      : ""}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-semibold tabular-nums text-[#D4AF8C]">
                  {money(l.earnings_gross, 0)}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <div className="px-4 py-10 text-center text-sm text-white/45">
            No marketing links synced yet — that’s okay, they’ll show up after the next sync.
          </div>
        )}
      </div>
        </>
      ) : null}
    </div>
  );
}
