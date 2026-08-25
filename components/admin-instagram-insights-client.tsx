"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  CheckCircle2,
  Clock3,
  CalendarRange,
  GitCompareArrows,
  LayoutDashboard,
  RefreshCw,
  Smartphone,
  Sparkles,
  Trophy,
  TrendingUp,
  Users,
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
  IgConsistencyRing,
  IgContentTypeChips,
  IgEmptyState,
  IgModelPicker,
  IgSkeleton,
  RankedBarList,
  TopPostsLeaderboard,
  type IgContentTypeFilter,
} from "@/components/instagram-insights-shared";
import { FilterBar } from "@/components/manager-review-ui";
import { IgStoriesSection } from "@/components/instagram-stories-ui";
import type { IgStoriesPayload } from "@/components/instagram-stories-ui";
import { InstagramProfileSimulator } from "@/components/instagram-profile-simulator";
import { CrossPlatformInsightsSection } from "@/components/cross-platform-insights";
import { CompareModelsSection } from "@/components/instagram-compare-models";
import { AdminInstagramWeeklyProgressPanel } from "@/components/admin-instagram-weekly-progress-panel";
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
import {
  buildFollowerTrendSeries,
  IG_MIN_FOLLOWER_TREND_POINTS,
} from "@/lib/instagram-insights-stats";

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
const ComposedChart = dynamic(() => import("recharts").then((m) => m.ComposedChart), {
  ssr: false,
});

type TabId = "overview" | "by_model" | "compare" | "weekly_progress" | "cross_platform";

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: "overview", label: "Overview", icon: <LayoutDashboard className="h-3.5 w-3.5" /> },
  { id: "by_model", label: "By Model", icon: <Users className="h-3.5 w-3.5" /> },
  { id: "compare", label: "Compare Models", icon: <GitCompareArrows className="h-3.5 w-3.5" /> },
  { id: "weekly_progress", label: "Weekly Progress", icon: <CalendarRange className="h-3.5 w-3.5" /> },
  { id: "cross_platform", label: "Cross-Platform", icon: <TrendingUp className="h-3.5 w-3.5" /> },
];

type ComparisonRow = {
  modelId: string;
  modelName: string;
  accountCount?: number;
  reach: number;
  views: number | null;
  avg_engagement_rate: number | null;
  follower_start: number | null;
  follower_end: number | null;
  follower_delta: number | null;
  growth_rate_pct: number | null;
  top_post_engagement: number | null;
  consistency_score: number | null;
  posting_frequency: number | null;
  days: number;
};

type IgAccountOption = {
  id: string;
  igUserId: string;
  label: string;
  isPrimary: boolean;
};

type InsightsPayload = {
  range: { startYmd: string; endYmd: string; preset: InflowwStatsPreset };
  priorRange?: { startYmd: string; endYmd: string; days: number };
  models: Array<{ id: string; name: string; igUserId: string; accountCount?: number }>;
  selectedModelId: string | null;
  selectedModelName?: string | null;
  selectedIgUserId?: string | null;
  selectedAccountFilter?: "all" | "single";
  igAccounts?: IgAccountOption[];
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
    views: number | null;
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
    media_product_type?: string | null;
    caption: string | null;
    image_url: string | null;
    engagement_score: number | null;
    reach: number;
    likes: number;
    comments: number;
    shares?: number;
    saved?: number;
    views?: number;
    posted_at?: string | null;
    rank: number;
  }>;
  comparison: ComparisonRow[];
  priorComparison?: ComparisonRow[];
  callouts?: Array<{
    kind: "improved" | "declining";
    modelId: string;
    modelName: string;
    metric: string;
    current: number;
    prior: number;
    deltaPct: number | null;
    message: string;
  }>;
  overview?: {
    total_reach: number;
    total_views?: number;
    total_interactions?: number;
    total_followers: number | null;
    avg_engagement_rate: number | null;
    top_model: {
      modelId: string;
      modelName: string;
      reach: number;
      avg_engagement_rate: number | null;
      follower_delta: number | null;
    } | null;
    models_with_data: number;
  };
  modelStats?: {
    growth_rate_pct: number | null;
    prior_growth_rate_pct: number | null;
    growth_momentum: "accelerating" | "decelerating" | "steady" | null;
    consistency_score: number | null;
    posting_frequency: {
      posts_in_range: number;
      days_in_range: number;
      posts_per_week: number | null;
      posts_per_day: number | null;
    };
    posting_vs_reach: Array<{
      date: string;
      posts: number;
      reach: number;
      engagement_rate: number | null;
    }>;
    posting_reach_correlation: number | null;
    content_type_performance: Array<{
      group: string;
      label: string;
      count: number;
      avg_engagement: number | null;
      avg_reach: number | null;
    }>;
  } | null;
  stories?: IgStoriesPayload;
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
  const [tab, setTab] = React.useState<TabId>("overview");
  const [preset, setPreset] = React.useState<InflowwStatsPreset>("this_month");
  const [customFrom, setCustomFrom] = React.useState("");
  const [customTo, setCustomTo] = React.useState("");
  const [modelId, setModelId] = React.useState<string>("");
  const [igUserId, setIgUserId] = React.useState<string>("");
  const [loading, setLoading] = React.useState(true);
  const [syncing, setSyncing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [data, setData] = React.useState<InsightsPayload | null>(null);
  const [health, setHealth] = React.useState<HealthPayload | null>(null);
  const [contentFilter, setContentFilter] = React.useState<IgContentTypeFilter>("all");
  const [viewAsProfile, setViewAsProfile] = React.useState(false);

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
      igUserId?: string;
      from?: string;
      to?: string;
    }) => {
      setLoading(true);
      setError(null);
      try {
        const p = opts?.preset ?? preset;
        const mid = opts?.modelId ?? modelId;
        const ig = opts?.igUserId ?? igUserId;
        const params = new URLSearchParams({ preset: p });
        if (mid) params.set("modelId", mid);
        if (ig) params.set("igUserId", ig);
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
        if (json.selectedIgUserId) setIgUserId(json.selectedIgUserId);
        else if (json.selectedAccountFilter === "all") setIgUserId("");
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
    [preset, modelId, igUserId, customFrom, customTo]
  );

  React.useEffect(() => {
    void loadHealth();
    void load({ preset: "this_month" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runSync() {
    setSyncing(true);
    try {
      // Always sync every linked model — scoped sync skipped newly linked accounts
      // when another model was selected in the picker / leaderboard.
      const res = await fetch("/api/admin/instagram-insights/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = (await res.json()) as {
        error?: string;
        skipped?: boolean;
        skipReason?: string;
        modelsTargeted?: number;
        dailyRowsUpserted?: number;
        errors?: Array<{ modelName?: string; message: string }>;
      };
      if (!res.ok) throw new Error(json.error || "Sync failed");
      if (json.skipped) {
        throw new Error(json.error || json.skipReason || "ClarioSuite sync skipped — API key not configured");
      }
      if (json.modelsTargeted === 0 && !json.dailyRowsUpserted) {
        setError("Sync finished but no linked Instagram accounts were targeted. Link models first.");
      } else if (json.errors?.length) {
        const names = json.errors
          .map((e) => e.modelName || "model")
          .slice(0, 3)
          .join(", ");
        setError(
          `Sync finished with errors for ${names}${json.errors.length > 3 ? "…" : ""}. Check logs.`
        );
      }
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
  const followerTrendMeta = React.useMemo(
    () => buildFollowerTrendSeries(data?.daily ?? []),
    [data?.daily]
  );
  const followerTrend = React.useMemo(
    () =>
      followerTrendMeta.points.map((d) => ({
        ...d,
        dateLabel: shortDate(d.date),
      })),
    [followerTrendMeta.points]
  );
  const ages = (data?.audience?.age_ranges ?? []).slice(0, 8);
  const countries = (data?.audience?.countries ?? []).slice(0, 8);
  const genders = data?.audience?.gender_split ?? [];
  const online = [...(data?.audience?.online_followers_by_hour ?? [])].sort(
    (a, b) => a.hour - b.hour
  );
  const syncLabel = formatRelativeSync(data?.lastSyncedAt ?? data?.audience?.synced_at);
  const erValue = data?.totals.avg_engagement_rate;
  const modelStats = data?.modelStats;
  const overview = data?.overview;

  const filteredTopPosts = React.useMemo(() => {
    const posts = data?.topPosts ?? [];
    if (contentFilter === "all") return posts;
    return posts.filter((p) => {
      const product = (p.media_product_type ?? "").toUpperCase();
      const type = (p.media_type ?? "").toUpperCase();
      if (contentFilter === "reels") return product === "REELS";
      if (contentFilter === "carousels") return type === "CAROUSEL_ALBUM";
      return product !== "REELS" && type !== "CAROUSEL_ALBUM";
    });
  }, [data?.topPosts, contentFilter]);

  const comparisonByReach = React.useMemo(() => {
    return [...(data?.comparison ?? [])].sort((a, b) => b.reach - a.reach);
  }, [data?.comparison]);

  const postingSeries = React.useMemo(
    () =>
      (modelStats?.posting_vs_reach ?? []).map((d) => ({
        ...d,
        dateLabel: shortDate(d.date),
      })),
    [modelStats?.posting_vs_reach]
  );

  const showModelFilter = tab === "by_model" || tab === "cross_platform";
  const showContentFilter = tab === "by_model";

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
              Agency hub — overview, per-model deep dive, compare models, and IG × OnlyFans
              cross-platform analytics.
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
            {tab === "by_model" ? (
              <button
                type="button"
                disabled={!data?.selectedModelId}
                onClick={() => setViewAsProfile((v) => !v)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50",
                  viewAsProfile
                    ? "border-[#D4AF8C]/50 bg-[#D4AF8C]/15 text-[#E8D0B0]"
                    : "border-white/15 bg-white/[0.04] text-white/70 hover:bg-white/[0.07]"
                )}
              >
                <Smartphone className="h-3.5 w-3.5" />
                {viewAsProfile ? "Hide profile" : "View as Profile"}
              </button>
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

        {/* Filters */}
        <FilterBar className="relative mt-5 border border-white/10 bg-white/[0.03] p-4 md:p-5">
          {tab === "weekly_progress" ? (
            <p className="text-sm text-white/45">
              Weekly Progress uses its own month picker — custom 4-week buckets per calendar month.
            </p>
          ) : (
          <>
          <div className="flex flex-col gap-5">
            {(showModelFilter || showContentFilter) && (
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-[minmax(0,240px)_1fr]">
                {showModelFilter ? (
                  <div className="min-w-0 space-y-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
                      Model
                    </p>
                    <IgModelPicker
                      models={data?.models ?? []}
                      value={modelId}
                      disabled={!(data?.models?.length)}
                      loading={loading}
                      onChange={(next) => {
                        setModelId(next);
                        setIgUserId("");
                        setViewAsProfile(false);
                        void load({ modelId: next, igUserId: "" });
                      }}
                    />
                  </div>
                ) : null}

                {showModelFilter && (data?.igAccounts?.length ?? 0) > 1 ? (
                  <div className="min-w-0 space-y-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
                      Instagram account
                    </p>
                    <select
                      value={igUserId}
                      disabled={loading}
                      onChange={(e) => {
                        const next = e.target.value;
                        setIgUserId(next);
                        setViewAsProfile(false);
                        void load({ igUserId: next });
                      }}
                      className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none focus:border-[#FF1493]/50"
                    >
                      <option value="">All accounts (combined)</option>
                      {(data?.igAccounts ?? []).map((a) => (
                        <option key={a.igUserId} value={a.igUserId}>
                          {a.label}
                          {a.isPrimary ? " · Primary" : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}

                {showContentFilter ? (
                  <div className="min-w-0 space-y-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
                      Content type
                    </p>
                    <IgContentTypeChips value={contentFilter} onChange={setContentFilter} />
                  </div>
                ) : null}
              </div>
            )}

            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
                Date range
              </p>
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
            <InflowwCustomDateRange
              startYmd={customFrom || data?.range.startYmd || ""}
              endYmd={customTo || data?.range.endYmd || ""}
              loading={loading}
              className="mt-4 border-white/8 bg-black/20"
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
          ) : null}

          {data?.range ? (
            <p className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs leading-relaxed text-white/45">
              {showModelFilter && data.selectedModelName ? (
                <>
                  <span>
                    Viewing{" "}
                    <span className="font-medium text-white/70">{data.selectedModelName}</span>
                  </span>
                  <span className="hidden text-white/25 sm:inline" aria-hidden>
                    ·
                  </span>
                </>
              ) : null}
              <span className="tabular-nums">
                {data.range.startYmd} → {data.range.endYmd}
              </span>
              {health ? (
                <>
                  <span className="hidden text-white/25 sm:inline" aria-hidden>
                    ·
                  </span>
                  <span>
                    {health.modelsLinked}/{health.modelsTotal} models linked
                    {health.accountsCount != null
                      ? ` · ${health.accountsCount} ClarioSuite IG account${health.accountsCount === 1 ? "" : "s"}`
                      : ""}
                  </span>
                </>
              ) : null}
            </p>
          ) : null}
          </>
          )}
        </FilterBar>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 rounded-2xl border border-white/[0.06] bg-[#0D0B0D]/80 p-1.5">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "relative inline-flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-medium transition sm:px-4",
              tab === t.id ? "text-white" : "text-[#B8B4B8]/55 hover:text-[#B8B4B8]"
            )}
          >
            {tab === t.id ? (
              <motion.span
                layoutId="ig-insights-tab"
                className="absolute inset-0 rounded-xl border border-[#FF1493]/25 bg-gradient-to-br from-[#FF1493]/25 to-[#D4AF8C]/10"
                transition={{ type: "spring", damping: 28, stiffness: 380 }}
              />
            ) : null}
            <span className="relative inline-flex items-center gap-1.5">
              {t.icon}
              {t.label}
            </span>
          </button>
        ))}
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
          <AdminClarioSuiteAccountsLookup />
        </div>
      ) : null}

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.2 }}
          className="space-y-6"
        >
          {/* ── Overview ─────────────────────────────────────────── */}
          {tab === "overview" ? (
            <>
              {loading && !data ? (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <IgSkeleton key={i} className="h-28" />
                  ))}
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <LuxuryStatCard
                    label="Total reach"
                    value={<CountUp value={overview?.total_reach ?? 0} />}
                    tooltip={IG_STAT_INFO.overview}
                    accent="pink"
                    glow
                  />
                  <LuxuryStatCard
                    label="Total followers"
                    value={
                      overview?.total_followers != null ? (
                        <CountUp value={overview.total_followers} />
                      ) : (
                        "—"
                      )
                    }
                    hint={
                      overview?.models_with_data != null
                        ? `${overview.models_with_data} model${overview.models_with_data === 1 ? "" : "s"} with data`
                        : undefined
                    }
                    tooltip="Sum of latest follower counts across linked models with data in this range."
                    accent="champagne"
                  />
                  <LuxuryStatCard
                    label="Avg engagement"
                    value={
                      overview?.avg_engagement_rate != null ? (
                        <CountUp
                          value={overview.avg_engagement_rate}
                          format={(n) => `${n.toFixed(2)}%`}
                        />
                      ) : (
                        "—"
                      )
                    }
                    tooltip={IG_STAT_INFO.engagement_rate}
                    accent="pink"
                    glow
                  />
                  <LuxuryStatCard
                    label="Top model"
                    value={overview?.top_model?.modelName ?? "—"}
                    hint={
                      overview?.top_model
                        ? `${fmtPct(overview.top_model.avg_engagement_rate)} eng · ${fmtNum(overview.top_model.reach)} reach`
                        : "Link & sync models to rank"
                    }
                    tooltip="Highest engagement rate this period (reach as tie-breaker)."
                    accent="emerald"
                  />
                </div>
              )}

              <div className={cn(VA_CARD, "overflow-hidden")}>
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-[#D4AF8C]" />
                    <SectionLabel>Agency leaderboard</SectionLabel>
                    <StatInfoTooltip text={IG_STAT_INFO.comparison} />
                  </div>
                  <button
                    type="button"
                    onClick={() => setTab("compare")}
                    className="text-xs font-medium text-[#FFB6DE] hover:underline"
                  >
                    Open Compare →
                  </button>
                </div>
                {comparisonByReach.length ? (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[480px] text-left text-sm">
                      <thead className="border-b border-white/10 text-[11px] uppercase tracking-wider text-white/40">
                        <tr>
                          <th className="px-4 py-3 font-medium">#</th>
                          <th className="px-4 py-3 font-medium">Model</th>
                          <th className="px-4 py-3 font-medium">Reach</th>
                          <th className="px-4 py-3 font-medium">Engagement</th>
                          <th className="px-4 py-3 font-medium">Growth</th>
                        </tr>
                      </thead>
                      <tbody>
                        {comparisonByReach.slice(0, 8).map((row, idx) => (
                          <tr
                            key={row.modelId}
                            className="border-b border-white/5 transition hover:bg-white/[0.03]"
                          >
                            <td className="px-4 py-3 text-white/45">{idx + 1}</td>
                            <td className="px-4 py-3">
                              <button
                                type="button"
                                className="font-medium text-white hover:underline"
                                onClick={() => {
                                  setModelId(row.modelId);
                                  setTab("by_model");
                                  void load({ modelId: row.modelId });
                                }}
                              >
                                {row.modelName}
                              </button>
                            </td>
                            <td className="px-4 py-3 tabular-nums text-white/80">
                              {fmtNum(row.reach)}
                            </td>
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
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <IgEmptyState
                    title={loading ? "Loading…" : "No agency data yet"}
                    detail="Link models and run Sync to see agency-wide reach and engagement."
                  />
                )}
              </div>

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
                {health?.message &&
                (health.emptyReason === "no_ig_accounts" || !health.configured) ? (
                  <p className="mb-3 text-xs text-amber-200/80">{health.message}</p>
                ) : null}
                <AdminClarioSuiteAccountsLookup />
              </div>
            </>
          ) : null}

          {/* ── By Model ─────────────────────────────────────────── */}
          {tab === "by_model" ? (
            <>
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
                    value={
                      data?.totals.views != null ? (
                        <CountUp value={data.totals.views} />
                      ) : (
                        "—"
                      )
                    }
                    hint={
                      data?.totals.views == null && (data?.totals.reach ?? 0) > 0
                        ? "Views not reported yet for this range"
                        : undefined
                    }
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
                      (data?.totals.total_interactions ?? 0) > 0
                        ? `${fmtNum(data?.totals.total_interactions)} interactions`
                        : erValue == null
                          ? "Interactions not synced yet"
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
                      modelStats?.growth_rate_pct != null
                        ? `${fmtPct(modelStats.growth_rate_pct)} · ${
                            modelStats.growth_momentum === "accelerating"
                              ? "accelerating"
                              : modelStats.growth_momentum === "decelerating"
                                ? "decelerating"
                                : modelStats.growth_momentum === "steady"
                                  ? "steady"
                                  : "vs prior"
                          }`
                        : data?.totals.follower_end != null
                          ? `${fmtNum(data.totals.follower_end)} now`
                          : undefined
                    }
                    tooltip={IG_STAT_INFO.growth_rate}
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

              {/* Extra stats row */}
              <div className="grid gap-3 lg:grid-cols-3">
                <div className={cn(VA_CARD, "p-4")}>
                  <div className="flex items-center gap-2">
                    <SectionLabel>Consistency</SectionLabel>
                    <StatInfoTooltip text={IG_STAT_INFO.consistency} />
                  </div>
                  <div className="mt-3 [&_.text-white\/50]:text-white/50">
                    <IgConsistencyRing
                      score={modelStats?.consistency_score ?? null}
                      className="border-0 bg-transparent p-0 shadow-none"
                    />
                    <p className="mt-2 text-xs text-white/40">
                      Based on daily reach steadiness (not sales).
                    </p>
                  </div>
                </div>
                <div className={cn(VA_CARD, "p-4")}>
                  <div className="flex items-center gap-2">
                    <SectionLabel>Posting frequency</SectionLabel>
                    <StatInfoTooltip text={IG_STAT_INFO.posting_frequency} />
                  </div>
                  <p className="mt-4 text-3xl font-semibold tabular-nums text-white">
                    {modelStats?.posting_frequency.posts_per_week != null
                      ? modelStats.posting_frequency.posts_per_week.toFixed(1)
                      : "—"}
                    <span className="ml-1 text-sm font-normal text-white/40">/ week</span>
                  </p>
                  <p className="mt-2 text-xs text-white/45">
                    {modelStats?.posting_frequency.posts_in_range ?? 0} posts in{" "}
                    {modelStats?.posting_frequency.days_in_range ?? 0} days (from synced top media)
                  </p>
                </div>
                <div className={cn(VA_CARD, "p-4")}>
                  <div className="flex items-center gap-2">
                    <SectionLabel>Content-type performance</SectionLabel>
                    <StatInfoTooltip text={IG_STAT_INFO.content_type} />
                  </div>
                  <div className="mt-3 space-y-2">
                    {(modelStats?.content_type_performance ?? []).map((ct) => (
                      <div
                        key={ct.group}
                        className="flex items-center justify-between rounded-xl border border-white/8 bg-black/20 px-3 py-2 text-sm"
                      >
                        <span className="text-white/70">{ct.label}</span>
                        <span className="tabular-nums text-[#D4AF8C]">
                          {ct.avg_engagement != null ? fmtPct(ct.avg_engagement) : "—"}
                          <span className="ml-2 text-[11px] text-white/35">n={ct.count}</span>
                        </span>
                      </div>
                    ))}
                    {!modelStats?.content_type_performance?.some((c) => c.count > 0) ? (
                      <p className="text-sm text-white/35">No top-media sample yet.</p>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* Posting vs reach correlation */}
              <div className={cn(VA_CARD, "p-4")}>
                <div className="flex flex-wrap items-center gap-2">
                  <SectionLabel>Posting vs reach</SectionLabel>
                  <StatInfoTooltip text={IG_STAT_INFO.posting_correlation} />
                  {modelStats?.posting_reach_correlation != null ? (
                    <span className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-white/50">
                      r = {modelStats.posting_reach_correlation.toFixed(2)} (observational)
                    </span>
                  ) : (
                    <span className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-white/40">
                      Not enough data yet (~2 weeks + varied posting days)
                    </span>
                  )}
                </div>
                <div className="mt-3 h-52">
                  {postingSeries.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={postingSeries}>
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
                          yAxisId="posts"
                          orientation="right"
                          tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }}
                          width={28}
                          allowDecimals={false}
                        />
                        <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                        <Legend wrapperStyle={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }} />
                        <Bar
                          yAxisId="posts"
                          dataKey="posts"
                          fill="rgba(212,175,140,0.55)"
                          name="Posts"
                          radius={[3, 3, 0, 0]}
                        />
                        <Line
                          yAxisId="reach"
                          type="monotone"
                          dataKey="reach"
                          stroke="#FF1493"
                          strokeWidth={2}
                          dot={false}
                          name="Reach"
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="flex h-full items-center justify-center text-sm text-white/35">
                      {loading ? "Loading…" : "No posting timeline for this range."}
                    </p>
                  )}
                </div>
              </div>

              {/* Stories */}
              <div className={cn(VA_CARD, "p-4 md:p-5")}>
                <div className="mb-3 flex items-center gap-2">
                  <SectionLabel>Stories</SectionLabel>
                  <StatInfoTooltip text={IG_STAT_INFO.stories} />
                </div>
                <IgStoriesSection
                  stories={data?.stories}
                  errorTitle="Stories unavailable"
                  errorDetail="ClarioSuite didn’t return active stories for this account right now."
                  emptyTitle="No active stories"
                  emptyDetail="When this account has live Stories, they’ll list here. Performance metrics appear only if the API provides them."
                  metricsUnavailableNote="No performance metrics from API for these Stories."
                />
              </div>

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
                          <YAxis
                            tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }}
                            width={44}
                          />
                          <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                          <Legend
                            wrapperStyle={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}
                          />
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
                          <YAxis
                            tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }}
                            width={40}
                          />
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

              <div className={cn(VA_CARD, "p-4")}>
                <div className="flex items-center gap-2">
                  <SectionLabel>Follower growth trend</SectionLabel>
                  <StatInfoTooltip text={IG_STAT_INFO.follower_trend} />
                </div>
                <div className="mt-3 h-48">
                  {followerTrend.length >= IG_MIN_FOLLOWER_TREND_POINTS ? (
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
                      {loading
                        ? "Loading…"
                        : followerTrendMeta.buildingHistory
                          ? "Building follower history — check back after a few more daily syncs."
                          : "Follower series not available for this range."}
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
                    Audience online-hours aren&apos;t in the latest snapshot yet — sync again after
                    ClarioSuite has onlineFollowers for this account.
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
                      <p className="text-xs font-medium uppercase tracking-wider text-white/45">
                        Age
                      </p>
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
                      <p className="text-xs font-medium uppercase tracking-wider text-white/45">
                        Gender
                      </p>
                      <StatInfoTooltip text={IG_STAT_INFO.gender} />
                    </div>
                    <GenderDonut genders={genders} />
                  </div>
                </div>
              </div>

              {/* Profile simulator */}
              {viewAsProfile && data?.selectedModelId ? (
                <div
                  className={cn(VA_CARD, VA_CARD_GLOW, "relative overflow-hidden p-5 md:p-8")}
                >
                  <div
                    className="pointer-events-none absolute inset-0 opacity-70"
                    style={{
                      background:
                        "radial-gradient(ellipse 70% 50% at 50% 0%, rgba(255,20,147,0.14), transparent 55%), radial-gradient(ellipse 50% 40% at 80% 80%, rgba(212,175,140,0.1), transparent 50%)",
                    }}
                  />
                  <div className="relative mb-5 flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <SectionLabel>Instagram Profile Simulator</SectionLabel>
                      <p className="mt-1 max-w-md text-xs text-white/45">
                        Realistic iPhone mockup with live ClarioSuite profile data — tap a post for
                        detailed stats.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setViewAsProfile(false)}
                      className="rounded-xl border border-white/10 px-3 py-1.5 text-xs text-white/55 hover:bg-white/[0.05]"
                    >
                      Back to analytics
                    </button>
                  </div>
                  <div className="relative flex justify-center py-2">
                    <InstagramProfileSimulator
                      key={data.selectedModelId}
                      profileUrl={`/api/admin/instagram-insights/profile?modelId=${encodeURIComponent(data.selectedModelId)}${igUserId ? `&igUserId=${encodeURIComponent(igUserId)}` : ""}`}
                      detailUrlFor={(mediaId) =>
                        `/api/admin/instagram-insights/media/${encodeURIComponent(mediaId)}?modelId=${encodeURIComponent(data.selectedModelId!)}`
                      }
                    />
                  </div>
                </div>
              ) : null}

              {/* Top posts */}
              <div className={cn(VA_CARD, "p-4 md:p-5")}>
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  <SectionLabel>Top posts leaderboard</SectionLabel>
                  <StatInfoTooltip text={IG_STAT_INFO.top_posts} />
                  {contentFilter !== "all" ? (
                    <span className="rounded-full border border-[#D4AF8C]/30 px-2 py-0.5 text-[11px] text-[#E8D0B0]">
                      Filtered: {contentFilter}
                    </span>
                  ) : null}
                </div>
                <TopPostsLeaderboard
                  posts={filteredTopPosts}
                  loading={loading}
                  detailUrlFor={
                    data?.selectedModelId
                      ? (mediaId) =>
                          `/api/admin/instagram-insights/media/${encodeURIComponent(mediaId)}?modelId=${encodeURIComponent(data.selectedModelId!)}`
                      : undefined
                  }
                />
              </div>
            </>
          ) : null}

          {/* ── Compare Models ───────────────────────────────────── */}
          {tab === "compare" ? (
            <CompareModelsSection
              rows={(data?.comparison ?? []).map((r) => ({
                ...r,
                accountCount: r.accountCount ?? 1,
              }))}
              callouts={data?.callouts}
              priorRange={data?.priorRange}
              loading={loading}
              selectedModelId={modelId}
              onSelectModel={(id) => {
                setModelId(id);
                setTab("by_model");
                void load({ modelId: id });
              }}
            />
          ) : null}

          {/* ── Weekly Progress ──────────────────────────────────── */}
          {tab === "weekly_progress" ? <AdminInstagramWeeklyProgressPanel /> : null}

          {/* ── Cross-Platform ───────────────────────────────────── */}
          {tab === "cross_platform" ? (
            <>
              {data?.selectedModelId ? (
                <CrossPlatformInsightsSection data={data.crossPlatform} loading={loading} />
              ) : (
                <IgEmptyState
                  title="Select a linked model"
                  detail="Cross-platform analytics join Instagram Insights with Infloww earnings for one model at a time."
                />
              )}
            </>
          ) : null}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
