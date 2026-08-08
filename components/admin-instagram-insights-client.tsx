"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import {
  Activity,
  CheckCircle2,
  Clock3,
  RefreshCw,
  Sparkles,
  Trophy,
  Wifi,
  WifiOff,
} from "lucide-react";
import {
  CountUp,
  DatePresetBar,
  InflowwCustomDateRange,
  LuxuryStatCard,
  SectionLabel,
  StatInfoTooltip,
} from "@/components/infloww-performance-ui";
import { AdminClarioSuiteAccountsLookup } from "@/components/admin-clariosuite-accounts-lookup";
import {
  GenderDonut,
  IgEmptyState,
  IgSkeleton,
  RankedBarList,
  TopPostsLeaderboard,
} from "@/components/instagram-insights-shared";
import { CrossPlatformInsightsSection } from "@/components/cross-platform-insights";
import { VA_CARD, VA_CARD_GLOW } from "@/lib/va-tasks-tokens";
import { cn } from "@/lib/utils";
import {
  CHART_TOOLTIP_STYLE,
  countryLabel,
  fmtDelta,
  fmtNum,
  fmtPct,
  formatRelativeSync,
  IG_STAT_INFO,
} from "@/lib/instagram-insights-ui";
import type { InflowwStatsPreset } from "@/services/infloww-performance";

const ResponsiveContainer = dynamic(() => import("recharts").then((m) => m.ResponsiveContainer), {
  ssr: false,
});
const AreaChart = dynamic(() => import("recharts").then((m) => m.AreaChart), { ssr: false });
const Area = dynamic(() => import("recharts").then((m) => m.Area), { ssr: false });
const BarChart = dynamic(() => import("recharts").then((m) => m.BarChart), { ssr: false });
const Bar = dynamic(() => import("recharts").then((m) => m.Bar), { ssr: false });
const CartesianGrid = dynamic(() => import("recharts").then((m) => m.CartesianGrid), { ssr: false });
const XAxis = dynamic(() => import("recharts").then((m) => m.XAxis), { ssr: false });
const YAxis = dynamic(() => import("recharts").then((m) => m.YAxis), { ssr: false });
const Tooltip = dynamic(() => import("recharts").then((m) => m.Tooltip), { ssr: false });
const LineChart = dynamic(() => import("recharts").then((m) => m.LineChart), { ssr: false });
const Line = dynamic(() => import("recharts").then((m) => m.Line), { ssr: false });
const Legend = dynamic(() => import("recharts").then((m) => m.Legend), { ssr: false });

type InsightsPayload = {
  range: { startYmd: string; endYmd: string; preset: InflowwStatsPreset };
  models: Array<{ id: string; name: string; igUserId: string }>;
  selectedModelId: string | null;
  selectedModelName?: string | null;
  linked: boolean;
  daily: Array<{
    date: string;
    reach: number;
    views: number;
    total_interactions: number;
    follower_count: number | null;
    engagement_rate: number | null;
  }>;
  totals: {
    reach: number;
    views: number;
    total_interactions: number;
    avg_engagement_rate: number | null;
    follower_start: number | null;
    follower_end: number | null;
    follower_delta: number | null;
  };
  audience: {
    followers_count: number | null;
    age_ranges: Array<{ label: string; value: number }>;
    countries: Array<{ label: string; value: number }>;
    gender_split: Array<{ label: string; value: number }>;
    online_followers_by_hour: Array<{ hour: number; value: number }>;
    synced_at: string | null;
  } | null;
  bestTime: {
    hourUtc: number;
    value: number;
    label: string;
    recommendation: string;
    athensHint: string | null;
    peakHourUtc: number;
  } | null;
  topPosts: Array<{
    media_id: string;
    permalink: string | null;
    media_type: string | null;
    caption: string | null;
    image_url: string | null;
    engagement_score: number | null;
    reach: number;
    likes: number;
    comments: number;
    shares?: number;
    saved?: number;
    views?: number;
    rank: number;
  }>;
  comparison: Array<{
    modelId: string;
    modelName: string;
    reach: number;
    views: number;
    avg_engagement_rate: number | null;
    follower_delta: number | null;
    days: number;
  }>;
  lastSyncedAt: string | null;
  crossPlatform?: import("@/services/cross-platform-analytics").CrossPlatformAnalytics | null;
  error?: string;
};

type HealthPayload = {
  configured: boolean;
  healthy: boolean;
  me: { name: string; keyId: string; orgId: string | null } | null;
  meError: string | null;
  accountsCount?: number | null;
  accountsError?: string | null;
  emptyReason?: "missing_api_key" | "no_ig_accounts" | "api_error" | null;
  message?: string | null;
  modelsTotal: number;
  modelsLinked: number;
};

function shortDate(ymd: string): string {
  const [, m, d] = ymd.split("-");
  return `${m}/${d}`;
}

export function AdminInstagramInsightsClient() {
  const [preset, setPreset] = React.useState<InflowwStatsPreset>("this_month");
  const [customFrom, setCustomFrom] = React.useState("");
  const [customTo, setCustomTo] = React.useState("");
  const [modelId, setModelId] = React.useState<string>("");
  const [loading, setLoading] = React.useState(true);
  const [syncing, setSyncing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [data, setData] = React.useState<InsightsPayload | null>(null);
  const [health, setHealth] = React.useState<HealthPayload | null>(null);
  const [compareSort, setCompareSort] = React.useState<"reach" | "engagement" | "growth">("reach");

  const loadHealth = React.useCallback(async () => {
    try {
      const res = await fetch("/api/admin/instagram-insights/health", { cache: "no-store" });
      const json = (await res.json()) as HealthPayload;
      if (res.ok) setHealth(json);
    } catch {
      // non-blocking
    }
  }, []);

  const load = React.useCallback(
    async (opts?: {
      preset?: InflowwStatsPreset;
      modelId?: string;
      from?: string;
      to?: string;
    }) => {
      setLoading(true);
      setError(null);
      try {
        const p = opts?.preset ?? preset;
        const mid = opts?.modelId ?? modelId;
        const params = new URLSearchParams({ preset: p });
        if (mid) params.set("modelId", mid);
        if (p === "custom") {
          const from = opts?.from ?? customFrom;
          const to = opts?.to ?? customTo;
          if (from) params.set("from", from);
          if (to) params.set("to", to);
        }
        const res = await fetch(`/api/admin/instagram-insights?${params}`, { cache: "no-store" });
        const json = (await res.json()) as InsightsPayload;
        if (!res.ok) throw new Error(json.error ?? "Failed to load insights");
        setData(json);
        setPreset(json.range.preset);
        if (json.selectedModelId) setModelId(json.selectedModelId);
        if (json.range.preset === "custom") {
          setCustomFrom(json.range.startYmd);
          setCustomTo(json.range.endYmd);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    },
    [preset, modelId, customFrom, customTo]
  );

  React.useEffect(() => {
    void loadHealth();
    void load({ preset: "this_month" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runSync() {
    setSyncing(true);
    try {
      const res = await fetch("/api/admin/instagram-insights/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelId: modelId || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Sync failed");
      await Promise.all([load(), loadHealth()]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  const trend = React.useMemo(
    () =>
      (data?.daily ?? []).map((d) => ({
        ...d,
        dateLabel: shortDate(d.date),
      })),
    [data?.daily]
  );
  const followerTrend = trend.filter((d) => d.follower_count != null);
  const ages = (data?.audience?.age_ranges ?? []).slice(0, 8);
  const countries = (data?.audience?.countries ?? []).slice(0, 8);
  const genders = data?.audience?.gender_split ?? [];
  const online = [...(data?.audience?.online_followers_by_hour ?? [])].sort(
    (a, b) => a.hour - b.hour
  );
  const syncLabel = formatRelativeSync(data?.lastSyncedAt ?? data?.audience?.synced_at);
  const erValue = data?.totals.avg_engagement_rate;

  const comparisonSorted = React.useMemo(() => {
    const rows = [...(data?.comparison ?? [])];
    rows.sort((a, b) => {
      if (compareSort === "engagement") {
        return (b.avg_engagement_rate ?? -1) - (a.avg_engagement_rate ?? -1);
      }
      if (compareSort === "growth") {
        return (b.follower_delta ?? -Infinity) - (a.follower_delta ?? -Infinity);
      }
      return b.reach - a.reach;
    });
    return rows;
  }, [data?.comparison, compareSort]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-1 pb-10">
      {/* Hero */}
      <div className={cn(VA_CARD, VA_CARD_GLOW, "relative overflow-hidden p-5 md:p-6")}>
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 10% 0%, rgba(255,20,147,0.18), transparent 55%), radial-gradient(ellipse 60% 50% at 90% 20%, rgba(212,175,140,0.12), transparent 50%)",
          }}
        />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#D4AF8C]/80">
              Marketing · Instagram
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-white md:text-3xl">
              Instagram Insights
            </h1>
            <p className="mt-1 max-w-xl text-sm text-white/50">
              Flagship ClarioSuite analytics — reach, engagement, demographics, best times to post,
              and cross-model comparison.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div
              className={cn(
                "inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium",
                health?.healthy
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                  : "border-amber-500/30 bg-amber-500/10 text-amber-200"
              )}
            >
              {health?.healthy ? (
                <Wifi className="h-3.5 w-3.5" />
              ) : (
                <WifiOff className="h-3.5 w-3.5" />
              )}
              {health?.healthy
                ? `API connected${health.me?.name ? ` · ${health.me.name}` : ""}`
                : health?.meError || "API not connected"}
            </div>
            {syncLabel ? (
              <div className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/55">
                <Clock3 className="h-3.5 w-3.5" />
                Synced {syncLabel}
              </div>
            ) : null}
            <button
              type="button"
              disabled={syncing || loading}
              onClick={() => void runSync()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#FF1493]/40 bg-[#FF1493]/10 px-3 py-1.5 text-xs font-semibold text-[#FFB6DE] transition hover:bg-[#FF1493]/15 disabled:opacity-50"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", syncing && "animate-spin")} />
              Sync now
            </button>
          </div>
        </div>

        <div className="relative mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <label className="flex min-w-[200px] flex-col gap-1 text-xs text-white/45">
            Model
            <select
              value={modelId}
              disabled={loading || !(data?.models?.length)}
              onChange={(e) => {
                const next = e.target.value;
                setModelId(next);
                void load({ modelId: next });
              }}
              className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-[#FF1493]/50"
            >
              {(data?.models ?? []).length === 0 ? (
                <option value="">No linked models</option>
              ) : (
                (data?.models ?? []).map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))
              )}
            </select>
          </label>
          <div className="flex-1">
            <DatePresetBar
              preset={preset}
              loading={loading}
              onSelect={(p) => {
                setPreset(p);
                if (p === "custom") {
                  if (!customFrom || !customTo) {
                    setCustomFrom(data?.range.startYmd ?? "");
                    setCustomTo(data?.range.endYmd ?? "");
                  }
                  return;
                }
                void load({ preset: p });
              }}
            />
          </div>
        </div>

        {preset === "custom" ? (
          <div className="relative mt-3">
            <InflowwCustomDateRange
              startYmd={customFrom || data?.range.startYmd || ""}
              endYmd={customTo || data?.range.endYmd || ""}
              loading={loading}
              onChange={(s, e) => {
                setCustomFrom(s);
                setCustomTo(e);
              }}
              onApply={(s, e) => {
                setCustomFrom(s);
                setCustomTo(e);
                void load({ preset: "custom", from: s, to: e });
              }}
            />
          </div>
        ) : null}

        {data?.range ? (
          <p className="relative mt-3 text-xs text-white/40">
            {data.range.startYmd} → {data.range.endYmd}
            {data.selectedModelName ? (
              <span className="ml-2 text-white/50">· Viewing {data.selectedModelName}</span>
            ) : null}
            {health ? (
              <span className="ml-2 text-white/30">
                · {health.modelsLinked}/{health.modelsTotal} models linked
                {health.accountsCount != null
                  ? ` · ${health.accountsCount} ClarioSuite IG account${health.accountsCount === 1 ? "" : "s"}`
                  : ""}
              </span>
            ) : null}
          </p>
        ) : null}
      </div>

      {error ? (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      {!loading && data && !data.models.length ? (
        <div className={cn(VA_CARD, "space-y-3 p-6 text-center")}>
          <Sparkles className="mx-auto h-8 w-8 text-[#D4AF8C]/70" />
          <h2 className="text-lg font-semibold text-white">
            {health && !health.configured
              ? "API key not configured"
              : health?.emptyReason === "no_ig_accounts"
                ? "No IG accounts in ClarioSuite"
                : "Link an Instagram account"}
          </h2>
          <p className="mx-auto max-w-md text-sm text-white/50">
            {health && !health.configured
              ? "Set CLARIOSUITE_API_KEY in Vercel Production and redeploy."
              : health?.emptyReason === "no_ig_accounts"
                ? health.message ||
                  "Connect Instagram accounts in the ClarioSuite dashboard first, then refresh the lookup below and paste an IG user ID on Accounts → Models."
                : "Copy an IG user ID from the lookup below, then paste it on Accounts → Models → Edit → ClarioSuite IG user ID. After linking, run Sync now."}
          </p>
        </div>
      ) : null}

      {/* Hero stats */}
      {loading && !data ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <IgSkeleton key={i} className="h-28" />
          ))}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <LuxuryStatCard
            label="Reach"
            value={<CountUp value={data?.totals.reach ?? 0} />}
            tooltip={IG_STAT_INFO.reach}
            accent="pink"
            glow
          />
          <LuxuryStatCard
            label="Views"
            value={<CountUp value={data?.totals.views ?? 0} />}
            tooltip={IG_STAT_INFO.views}
            accent="champagne"
          />
          <LuxuryStatCard
            label="Engagement rate"
            value={
              erValue != null ? (
                <CountUp value={erValue} format={(n) => `${n.toFixed(2)}%`} />
              ) : (
                "—"
              )
            }
            hint={
              data?.totals.total_interactions != null
                ? `${fmtNum(data.totals.total_interactions)} interactions`
                : undefined
            }
            tooltip={IG_STAT_INFO.engagement_rate}
            accent="pink"
            glow
          />
          <LuxuryStatCard
            label="Follower growth"
            value={fmtDelta(data?.totals.follower_delta)}
            hint={
              data?.totals.follower_end != null
                ? `${fmtNum(data.totals.follower_end)} now`
                : data?.audience?.followers_count != null
                  ? `${fmtNum(data.audience.followers_count)} now`
                  : undefined
            }
            tooltip={IG_STAT_INFO.follower_growth}
            accent={
              (data?.totals.follower_delta ?? 0) > 0
                ? "emerald"
                : (data?.totals.follower_delta ?? 0) < 0
                  ? "amber"
                  : "champagne"
            }
          />
        </div>
      )}

      {/* Trends */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className={cn(VA_CARD, "p-4")}>
          <div className="flex items-center gap-2">
            <SectionLabel>Reach & views</SectionLabel>
            <StatInfoTooltip text={`${IG_STAT_INFO.reach} ${IG_STAT_INFO.views}`} />
          </div>
          <div className="mt-3 h-56">
            {trend.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend}>
                  <defs>
                    <linearGradient id="igReach" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#FF1493" stopOpacity={0.45} />
                      <stop offset="100%" stopColor="#FF1493" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="igViews" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#D4AF8C" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#D4AF8C" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                  <XAxis
                    dataKey="dateLabel"
                    tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }}
                  />
                  <YAxis tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }} width={44} />
                  <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                  <Legend wrapperStyle={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }} />
                  <Area
                    type="monotone"
                    dataKey="reach"
                    stroke="#FF1493"
                    fill="url(#igReach)"
                    strokeWidth={2}
                    name="Reach"
                    isAnimationActive
                    animationDuration={900}
                  />
                  <Area
                    type="monotone"
                    dataKey="views"
                    stroke="#D4AF8C"
                    fill="url(#igViews)"
                    strokeWidth={2}
                    name="Views"
                    isAnimationActive
                    animationDuration={900}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <p className="flex h-full items-center justify-center text-sm text-white/35">
                {loading ? "Loading…" : "No daily insights yet — run Sync now."}
              </p>
            )}
          </div>
        </div>

        <div className={cn(VA_CARD, "p-4")}>
          <div className="flex items-center gap-2">
            <SectionLabel>Engagement rate</SectionLabel>
            <StatInfoTooltip text={IG_STAT_INFO.engagement_rate} />
          </div>
          <div className="mt-3 h-56">
            {trend.some((d) => d.engagement_rate != null) ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend}>
                  <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                  <XAxis
                    dataKey="dateLabel"
                    tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }}
                  />
                  <YAxis tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }} width={40} />
                  <Tooltip
                    contentStyle={CHART_TOOLTIP_STYLE}
                    formatter={(v) => [`${Number(v ?? 0).toFixed(2)}%`, "Engagement"]}
                  />
                  <Line
                    type="monotone"
                    dataKey="engagement_rate"
                    stroke="#E879B8"
                    strokeWidth={2.5}
                    dot={false}
                    name="Engagement %"
                    isAnimationActive
                    animationDuration={900}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="flex h-full items-center justify-center text-sm text-white/35">
                {loading ? "Loading…" : "No engagement series yet."}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Follower growth trend */}
      <div className={cn(VA_CARD, "p-4")}>
        <div className="flex items-center gap-2">
          <SectionLabel>Follower growth trend</SectionLabel>
          <StatInfoTooltip text={IG_STAT_INFO.follower_trend} />
        </div>
        <div className="mt-3 h-48">
          {followerTrend.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={followerTrend}>
                <defs>
                  <linearGradient id="igFollowers" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#34D399" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#34D399" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis
                  dataKey="dateLabel"
                  tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }}
                />
                <YAxis
                  tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }}
                  width={48}
                  domain={["dataMin - 20", "dataMax + 20"]}
                />
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                <Area
                  type="monotone"
                  dataKey="follower_count"
                  stroke="#34D399"
                  fill="url(#igFollowers)"
                  strokeWidth={2}
                  name="Followers"
                  isAnimationActive
                  animationDuration={900}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <p className="flex h-full items-center justify-center text-sm text-white/35">
              {loading ? "Loading…" : "Follower series not available for this range."}
            </p>
          )}
        </div>
      </div>

      {/* Best time */}
      <div className={cn(VA_CARD, VA_CARD_GLOW, "p-5")}>
        <div className="flex flex-wrap items-center gap-2">
          <SectionLabel>Best time to post</SectionLabel>
          <StatInfoTooltip text={IG_STAT_INFO.best_time} />
        </div>
        {data?.bestTime ? (
          <div className="mt-4 flex flex-col gap-5 lg:flex-row lg:items-stretch">
            <div className="flex min-w-[240px] flex-col justify-center rounded-2xl border border-[#FF1493]/25 bg-gradient-to-br from-[#FF1493]/15 to-transparent p-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#FFB6DE]/80">
                Recommendation
              </p>
              <p className="mt-2 text-3xl font-semibold tracking-tight text-white">
                Post at {data.bestTime.label}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-white/60">
                {data.bestTime.recommendation}
              </p>
            </div>
            <div className="h-44 min-w-0 flex-1">
              {online.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={online}>
                    <XAxis
                      dataKey="hour"
                      tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }}
                      tickFormatter={(h) => `${String(h).padStart(2, "0")}`}
                    />
                    <YAxis hide />
                    <Tooltip
                      contentStyle={CHART_TOOLTIP_STYLE}
                      labelFormatter={(h) => `${String(h).padStart(2, "0")}:00 UTC`}
                    />
                    <Bar
                      dataKey="value"
                      fill="#D4AF8C"
                      radius={[4, 4, 0, 0]}
                      isAnimationActive
                      animationDuration={800}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : null}
            </div>
          </div>
        ) : (
          <p className="mt-3 text-sm text-white/40">
            Audience online-hours aren&apos;t in the latest snapshot yet — sync again after ClarioSuite
            has onlineFollowers for this account.
          </p>
        )}
      </div>

      {/* Demographics */}
      <div>
        <div className="mb-3 flex items-center gap-2 px-1">
          <SectionLabel>Audience demographics</SectionLabel>
          <StatInfoTooltip text="Age, country, and gender mix from the latest Instagram audience snapshot." />
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <div className={cn(VA_CARD, "p-4")}>
            <div className="mb-3 flex items-center gap-2">
              <p className="text-xs font-medium uppercase tracking-wider text-white/45">Age</p>
              <StatInfoTooltip text={IG_STAT_INFO.age} />
            </div>
            <RankedBarList items={ages} accent="pink" empty="No age data" />
          </div>
          <div className={cn(VA_CARD, "p-4")}>
            <div className="mb-3 flex items-center gap-2">
              <p className="text-xs font-medium uppercase tracking-wider text-white/45">
                Top countries
              </p>
              <StatInfoTooltip text={IG_STAT_INFO.countries} />
            </div>
            <RankedBarList
              items={countries}
              accent="champagne"
              formatLabel={countryLabel}
              empty="No country data"
            />
          </div>
          <div className={cn(VA_CARD, "p-4")}>
            <div className="mb-3 flex items-center gap-2">
              <p className="text-xs font-medium uppercase tracking-wider text-white/45">Gender</p>
              <StatInfoTooltip text={IG_STAT_INFO.gender} />
            </div>
            <GenderDonut genders={genders} />
          </div>
        </div>
      </div>

      {/* Top posts */}
      <div className={cn(VA_CARD, "p-4 md:p-5")}>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <SectionLabel>Top posts leaderboard</SectionLabel>
          <StatInfoTooltip text={IG_STAT_INFO.top_posts} />
        </div>
        <TopPostsLeaderboard posts={data?.topPosts ?? []} loading={loading} />
      </div>

      {/* Cross-platform: IG × Infloww */}
      {data?.selectedModelId ? (
        <CrossPlatformInsightsSection data={data.crossPlatform} loading={loading} />
      ) : null}

      {/* Cross-model comparison */}
      <div className={cn(VA_CARD, "overflow-hidden")}>
        <div className="flex flex-col gap-3 border-b border-white/10 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-[#D4AF8C]" />
            <SectionLabel>Cross-model comparison</SectionLabel>
            <StatInfoTooltip text={IG_STAT_INFO.comparison} />
          </div>
          <select
            value={compareSort}
            onChange={(e) => setCompareSort(e.target.value as typeof compareSort)}
            className="rounded-xl border border-white/10 bg-black/30 px-3 py-1.5 text-xs text-white outline-none focus:border-[#FF1493]/50"
          >
            <option value="reach">Sort by reach</option>
            <option value="engagement">Sort by engagement</option>
            <option value="growth">Sort by growth</option>
          </select>
        </div>
        {comparisonSorted.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="border-b border-white/10 text-[11px] uppercase tracking-wider text-white/40">
                <tr>
                  <th className="px-4 py-3 font-medium">#</th>
                  <th className="px-4 py-3 font-medium">Model</th>
                  <th className="px-4 py-3 font-medium">Reach</th>
                  <th className="px-4 py-3 font-medium">Views</th>
                  <th className="px-4 py-3 font-medium">Engagement</th>
                  <th className="px-4 py-3 font-medium">Growth</th>
                </tr>
              </thead>
              <tbody>
                {comparisonSorted.map((row, idx) => {
                  const selected = row.modelId === modelId;
                  return (
                    <tr
                      key={row.modelId}
                      className={cn(
                        "border-b border-white/5 transition hover:bg-white/[0.03]",
                        selected && "bg-[#FF1493]/[0.07]"
                      )}
                    >
                      <td className="px-4 py-3 text-white/45">{idx + 1}</td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          className={cn(
                            "font-medium hover:underline",
                            selected ? "text-[#FFB6DE]" : "text-white"
                          )}
                          onClick={() => {
                            setModelId(row.modelId);
                            void load({ modelId: row.modelId });
                          }}
                        >
                          {row.modelName}
                        </button>
                      </td>
                      <td className="px-4 py-3 tabular-nums text-white/80">{fmtNum(row.reach)}</td>
                      <td className="px-4 py-3 tabular-nums text-white/70">{fmtNum(row.views)}</td>
                      <td className="px-4 py-3 tabular-nums text-[#D4AF8C]">
                        {fmtPct(row.avg_engagement_rate)}
                      </td>
                      <td
                        className={cn(
                          "px-4 py-3 tabular-nums",
                          (row.follower_delta ?? 0) > 0
                            ? "text-emerald-300"
                            : (row.follower_delta ?? 0) < 0
                              ? "text-amber-200"
                              : "text-white/60"
                        )}
                      >
                        {fmtDelta(row.follower_delta)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <IgEmptyState
            title={loading ? "Loading comparison…" : "No comparison data"}
            detail="Link more models with ClarioSuite IG IDs to compare reach, engagement, and growth."
          />
        )}
      </div>

      {/* Connection health */}
      <div className={cn(VA_CARD, "p-4")}>
        <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm text-white/60">
            {health?.healthy ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            ) : (
              <Activity className="h-4 w-4 text-amber-300" />
            )}
            Connection & linking
            <StatInfoTooltip text={IG_STAT_INFO.connection} />
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-white/45">
            {health?.me?.keyId ? <span>Key · {health.me.keyId.slice(0, 8)}…</span> : null}
            {syncLabel ? <span>Last synced {syncLabel}</span> : null}
          </div>
        </div>
        {health?.message && (health.emptyReason === "no_ig_accounts" || !health.configured) ? (
          <p className="mb-3 text-xs text-amber-200/80">{health.message}</p>
        ) : null}
        <AdminClarioSuiteAccountsLookup />
      </div>
    </div>
  );
}
