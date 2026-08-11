"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import {
  Clapperboard,
  Heart,
  Layers,
  Smartphone,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  CountUp,
  DatePresetBar,
  InflowwCustomDateRange,
  LuxuryStatCard,
  SectionLabel,
  StatInfoTooltip,
} from "@/components/infloww-performance-ui";
import {
  GenderDonut,
  IgEmptyState,
  IgSkeleton,
  RankedBarList,
  TopPostsLeaderboard,
} from "@/components/instagram-insights-shared";
import { IgStoriesSection } from "@/components/instagram-stories-ui";
import type { IgStoriesPayload } from "@/components/instagram-stories-ui";
import { InstagramProfileSimulator } from "@/components/instagram-profile-simulator";
import { ModelIgToOfCard } from "@/components/cross-platform-insights";
import { VA_CARD, VA_CARD_GLOW } from "@/lib/va-tasks-tokens";
import { cn } from "@/lib/utils";
import {
  CHART_TOOLTIP_STYLE,
  countryLabel,
  fmtDelta,
  fmtNum,
  fmtPct,
  IG_STAT_INFO,
  modelConsistencyTip,
  modelContentTypeTip,
  modelGrowthTip,
  modelPostingFrequencyTip,
} from "@/lib/instagram-insights-ui";
import type { InflowwStatsPreset } from "@/services/infloww-performance";
import type { ModelCrossPlatformCard } from "@/services/cross-platform-analytics";

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
const Legend = dynamic(() => import("recharts").then((m) => m.Legend), { ssr: false });
const ComposedChart = dynamic(() => import("recharts").then((m) => m.ComposedChart), {
  ssr: false,
});
const Bar = dynamic(() => import("recharts").then((m) => m.Bar), { ssr: false });

type ContentTypeRow = {
  group: "reels" | "carousels" | "posts";
  label: string;
  count: number;
  avg_engagement: number | null;
  avg_reach: number | null;
};

type Payload = {
  linked: boolean;
  message?: string;
  modelName?: string;
  range: { startYmd: string; endYmd: string; preset: InflowwStatsPreset } | null;
  daily: Array<{
    date: string;
    reach: number;
    views: number;
    total_interactions: number;
    engagement_rate: number | null;
    follower_count?: number | null;
  }>;
  totals: {
    reach: number;
    views: number;
    total_interactions: number;
    avg_engagement_rate: number | null;
    follower_delta: number | null;
    follower_end?: number | null;
    follower_start?: number | null;
  } | null;
  audience: {
    followers_count: number | null;
    age_ranges: Array<{ label: string; value: number }>;
    countries: Array<{ label: string; value: number }>;
    gender_split: Array<{ label: string; value: number }>;
  } | null;
  audienceSummary: string | null;
  bestTime: { hourUtc: number; friendlyLabel: string; message: string } | null;
  topPosts: Array<{
    media_id: string;
    permalink: string | null;
    media_type?: string | null;
    media_product_type?: string | null;
    caption: string | null;
    image_url?: string | null;
    engagement_score: number | null;
    reach?: number;
    likes: number;
    comments: number;
    shares?: number;
    saved?: number;
    views?: number;
    posted_at?: string | null;
    rank: number;
  }>;
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
    content_type_performance: ContentTypeRow[];
  } | null;
  stories?: IgStoriesPayload;
  crossPlatformCard?: ModelCrossPlatformCard | null;
  error?: string;
};

type SubTab = "spotlight" | "trends" | "content" | "audience" | "profile";

const SUB_TABS: Array<{ id: SubTab; label: string }> = [
  { id: "spotlight", label: "Spotlight" },
  { id: "trends", label: "Trends" },
  { id: "content", label: "Your content" },
  { id: "audience", label: "Audience" },
  { id: "profile", label: "Profile" },
];

function shortDate(ymd: string): string {
  const [, m, d] = ymd.split("-");
  return `${m}/${d}`;
}

function ConsistencyVibe({ score }: { score: number | null }) {
  const tip = modelConsistencyTip(score);
  const v = score ?? 0;
  const r = 36;
  const c = 2 * Math.PI * r;
  const offset = c - (v / 100) * c;
  const tone =
    score == null
      ? "text-white/40"
      : score >= 70
        ? "text-emerald-400"
        : score >= 45
          ? "text-[#D4AF8C]"
          : "text-amber-200";

  return (
    <div className={cn(VA_CARD, "p-4")}>
      <div className="flex items-center gap-2">
        <SectionLabel>Your consistency vibe</SectionLabel>
        <StatInfoTooltip text={IG_STAT_INFO.consistency} />
      </div>
      <div className="mt-3 flex items-center gap-4">
        <div className="relative h-24 w-24 shrink-0">
          <svg viewBox="0 0 88 88" className="h-full w-full -rotate-90">
            <circle
              cx="44"
              cy="44"
              r={r}
              fill="none"
              stroke="rgba(255,255,255,0.06)"
              strokeWidth="8"
            />
            <circle
              cx="44"
              cy="44"
              r={r}
              fill="none"
              stroke="#FF1493"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={c}
              strokeDashoffset={score == null ? c : offset}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={cn("text-xl font-semibold tabular-nums", tone)}>
              {score == null ? "—" : score}
            </span>
          </div>
        </div>
        <p className="text-sm leading-relaxed text-white/60">{tip}</p>
      </div>
    </div>
  );
}

export function ModelInstagramInsightsPanel() {
  const [preset, setPreset] = React.useState<InflowwStatsPreset>("this_month");
  const [customFrom, setCustomFrom] = React.useState("");
  const [customTo, setCustomTo] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [data, setData] = React.useState<Payload | null>(null);
  const [subTab, setSubTab] = React.useState<SubTab>("spotlight");
  const [viewAsProfile, setViewAsProfile] = React.useState(false);

  const load = React.useCallback(
    async (opts?: { preset?: InflowwStatsPreset; from?: string; to?: string }) => {
      setLoading(true);
      setError(null);
      try {
        const p = opts?.preset ?? preset;
        const params = new URLSearchParams({ preset: p });
        if (p === "custom") {
          const from = opts?.from ?? customFrom;
          const to = opts?.to ?? customTo;
          if (from) params.set("from", from);
          if (to) params.set("to", to);
        }
        const res = await fetch(`/api/model/instagram-insights?${params}`, { cache: "no-store" });
        const json = (await res.json()) as Payload;
        if (!res.ok && res.status !== 404) throw new Error(json.error ?? "Failed to load");
        setData(json);
        if (json.range?.preset) setPreset(json.range.preset);
        if (json.range?.preset === "custom") {
          setCustomFrom(json.range.startYmd);
          setCustomTo(json.range.endYmd);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    },
    [preset, customFrom, customTo]
  );

  React.useEffect(() => {
    void load({ preset: "this_month" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!loading && data && !data.linked) {
    return (
      <div className={cn(VA_CARD, VA_CARD_GLOW, "relative overflow-hidden space-y-3 p-8 text-center")}>
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 70% 50% at 50% 0%, rgba(255,20,147,0.14), transparent 60%)",
          }}
        />
        <Sparkles className="relative mx-auto h-9 w-9 text-[#D4AF8C]/85" />
        <h2 className="relative text-lg font-semibold text-white">
          Your Instagram story starts here
        </h2>
        <p className="relative mx-auto max-w-sm text-sm text-white/55">
          {data.message ||
            "Your Instagram isn’t linked yet. Once an admin connects it, you’ll see reach, audience vibes, and your best posting times — all in one place."}
        </p>
      </div>
    );
  }

  const trend = (data?.daily ?? []).map((d) => ({
    ...d,
    dateLabel: shortDate(d.date),
  }));
  const erValue = data?.totals?.avg_engagement_rate;
  const stats = data?.modelStats ?? null;
  const postingSeries = (stats?.posting_vs_reach ?? []).map((d) => ({
    ...d,
    dateLabel: shortDate(d.date),
  }));
  const growthTip = modelGrowthTip({
    growthRatePct: stats?.growth_rate_pct ?? null,
    momentum: stats?.growth_momentum ?? null,
  });
  const postingTip = modelPostingFrequencyTip({
    postsPerWeek: stats?.posting_frequency.posts_per_week ?? null,
    postsInRange: stats?.posting_frequency.posts_in_range ?? 0,
    correlation: stats?.posting_reach_correlation ?? null,
  });
  const contentTip = modelContentTypeTip(stats?.content_type_performance ?? []);
  const detailUrlFor = (mediaId: string) =>
    `/api/model/instagram-insights/media/${encodeURIComponent(mediaId)}`;

  return (
    <div className="space-y-5">
      <div className={cn(VA_CARD, VA_CARD_GLOW, "relative overflow-hidden p-4 md:p-5")}>
        <div
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 0% 0%, rgba(255,20,147,0.16), transparent 55%), radial-gradient(ellipse 50% 40% at 100% 0%, rgba(212,175,140,0.1), transparent 50%)",
          }}
        />
        <div className="relative">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#D4AF8C]/80">
            Your Instagram
          </p>
          <h2 className="mt-1 text-xl font-semibold text-white">
            {data?.modelName ? `${data.modelName}'s spotlight` : "How you're showing up"}
          </h2>
          <p className="mt-1 max-w-lg text-sm text-white/50">
            Celebrate the reach you&apos;re building — tips, trends, and what&apos;s working for
            you.
          </p>
          <div className="mt-4">
            <DatePresetBar
              preset={preset}
              loading={loading}
              onSelect={(p) => {
                setPreset(p);
                if (p === "custom") {
                  if (!customFrom || !customTo) {
                    setCustomFrom(data?.range?.startYmd ?? "");
                    setCustomTo(data?.range?.endYmd ?? "");
                  }
                  return;
                }
                void load({ preset: p });
              }}
            />
          </div>
          {preset === "custom" ? (
            <div className="mt-3">
              <InflowwCustomDateRange
                startYmd={customFrom || data?.range?.startYmd || ""}
                endYmd={customTo || data?.range?.endYmd || ""}
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
            <p className="mt-2 text-xs text-white/40">
              {data.range.startYmd} → {data.range.endYmd}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {SUB_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setSubTab(t.id);
                if (t.id !== "profile") setViewAsProfile(false);
              }}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-xs font-semibold transition",
                subTab === t.id
                  ? "border-[#FF1493]/50 bg-[#FF1493]/15 text-[#FFB6DE]"
                  : "border-white/10 bg-white/[0.03] text-white/55 hover:bg-white/[0.06]"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => {
            setSubTab("profile");
            setViewAsProfile((v) => !v);
          }}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition",
            viewAsProfile && subTab === "profile"
              ? "border-[#D4AF8C]/50 bg-[#D4AF8C]/15 text-[#E8D0B0]"
              : "border-white/15 bg-white/[0.04] text-white/70 hover:bg-white/[0.07]"
          )}
        >
          <Smartphone className="h-3.5 w-3.5" />
          {viewAsProfile && subTab === "profile" ? "Hide profile" : "View as Profile"}
        </button>
      </div>

      {error ? (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      {/* ── Spotlight ─────────────────────────────────────────── */}
      {subTab === "spotlight" ? (
        <div className="space-y-5">
          {loading && !data ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <IgSkeleton key={i} className="h-28" />
              ))}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <LuxuryStatCard
                label="Your reach"
                value={<CountUp value={data?.totals?.reach ?? 0} />}
                tooltip="How many unique accounts saw your content in this range."
                accent="pink"
                glow
              />
              <LuxuryStatCard
                label="Your views"
                value={
                  data?.totals?.views != null ? (
                    <CountUp value={data.totals.views} />
                  ) : (
                    "—"
                  )
                }
                hint={
                  data?.totals?.views == null && (data?.totals?.reach ?? 0) > 0
                    ? "Views not reported yet"
                    : undefined
                }
                tooltip="Total views across your Instagram content."
                accent="champagne"
              />
              <LuxuryStatCard
                label="Engagement"
                value={
                  erValue != null ? (
                    <CountUp value={erValue} format={(n) => `${n.toFixed(1)}%`} />
                  ) : (
                    "—"
                  )
                }
                tooltip="Interactions relative to reach — higher means a warmer audience."
                accent="pink"
              />
              <LuxuryStatCard
                label="Follower growth"
                value={fmtDelta(data?.totals?.follower_delta)}
                hint={
                  stats?.growth_rate_pct != null
                    ? `${fmtPct(stats.growth_rate_pct, 1)} · ${
                        stats.growth_momentum === "accelerating"
                          ? "accelerating"
                          : stats.growth_momentum === "decelerating"
                            ? "room to grow"
                            : stats.growth_momentum === "steady"
                              ? "steady"
                              : "this range"
                      }`
                    : data?.totals?.follower_end != null
                      ? `${data.totals.follower_end.toLocaleString()} followers`
                      : data?.audience?.followers_count != null
                        ? `${data.audience.followers_count.toLocaleString()} followers`
                        : undefined
                }
                tooltip={IG_STAT_INFO.growth_rate}
                accent={
                  (data?.totals?.follower_delta ?? 0) > 0
                    ? "emerald"
                    : (data?.totals?.follower_delta ?? 0) < 0
                      ? "amber"
                      : "white"
                }
              />
            </div>
          )}

          {growthTip ? (
            <div className={cn(VA_CARD, VA_CARD_GLOW, "p-4")}>
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-400/25 bg-emerald-400/10">
                  <TrendingUp className="h-5 w-5 text-emerald-300" />
                </div>
                <div>
                  <SectionLabel>Growth pace</SectionLabel>
                  <p className="mt-2 text-sm leading-relaxed text-white/70">{growthTip}</p>
                </div>
              </div>
            </div>
          ) : null}

          <div className="grid gap-3 lg:grid-cols-3">
            <ConsistencyVibe score={stats?.consistency_score ?? null} />

            <div className={cn(VA_CARD, "p-4")}>
              <div className="flex items-center gap-2">
                <SectionLabel>Posting rhythm</SectionLabel>
                <StatInfoTooltip text={IG_STAT_INFO.posting_frequency} />
              </div>
              <p className="mt-4 text-3xl font-semibold tabular-nums text-white">
                {stats?.posting_frequency.posts_per_week != null
                  ? stats.posting_frequency.posts_per_week.toFixed(1)
                  : "—"}
                <span className="ml-1 text-sm font-normal text-white/40">/ week</span>
              </p>
              <p className="mt-2 text-xs text-white/45">
                {stats?.posting_frequency.posts_in_range ?? 0} posts in{" "}
                {stats?.posting_frequency.days_in_range ?? 0} days
              </p>
              {postingTip ? (
                <p className="mt-3 text-sm leading-relaxed text-white/60">{postingTip}</p>
              ) : null}
            </div>

            <div className={cn(VA_CARD, "p-4")}>
              <div className="flex items-center gap-2">
                <SectionLabel>What&apos;s working</SectionLabel>
                <StatInfoTooltip text={IG_STAT_INFO.content_type} />
              </div>
              <div className="mt-3 space-y-2">
                {(stats?.content_type_performance ?? []).map((ct) => (
                  <div
                    key={ct.group}
                    className="flex items-center justify-between rounded-xl border border-white/8 bg-black/20 px-3 py-2 text-sm"
                  >
                    <span className="inline-flex items-center gap-1.5 text-white/70">
                      {ct.group === "reels" ? <Clapperboard className="h-3 w-3" /> : null}
                      {ct.group === "carousels" ? <Layers className="h-3 w-3" /> : null}
                      {ct.label}
                    </span>
                    <span className="tabular-nums text-[#D4AF8C]">
                      {ct.avg_engagement != null ? fmtPct(ct.avg_engagement) : "—"}
                      <span className="ml-2 text-[11px] text-white/35">n={ct.count}</span>
                    </span>
                  </div>
                ))}
                {!stats?.content_type_performance?.some((c) => c.count > 0) ? (
                  <p className="text-sm text-white/35">
                    Format tips appear after a few posts sync.
                  </p>
                ) : null}
              </div>
              {contentTip ? (
                <p className="mt-3 text-sm leading-relaxed text-white/60">{contentTip}</p>
              ) : null}
            </div>
          </div>

          <ModelIgToOfCard card={data?.crossPlatformCard} loading={loading} />

          {data?.bestTime ? (
            <div className={cn(VA_CARD, VA_CARD_GLOW, "p-5")}>
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#FF1493]/30 bg-[#FF1493]/10">
                  <Heart className="h-5 w-5 text-[#FF1493]" />
                </div>
                <div>
                  <SectionLabel>Best time to post</SectionLabel>
                  <p className="mt-2 text-2xl font-semibold text-white">
                    Post at {data.bestTime.friendlyLabel}
                  </p>
                  <p className="mt-1.5 text-sm leading-relaxed text-white/60">
                    {data.bestTime.message}
                  </p>
                </div>
              </div>
            </div>
          ) : !loading ? (
            <div className={cn(VA_CARD, "p-4 text-sm text-white/45")}>
              We&apos;ll surface your best posting window once online-follower hours sync for your
              account.
            </div>
          ) : null}
        </div>
      ) : null}

      {/* ── Trends ────────────────────────────────────────────── */}
      {subTab === "trends" ? (
        <div className="space-y-5">
          <div className={cn(VA_CARD, "p-4")}>
            <div className="flex items-center gap-2">
              <SectionLabel>Your reach & views</SectionLabel>
              <StatInfoTooltip text={`${IG_STAT_INFO.reach} ${IG_STAT_INFO.views}`} />
            </div>
            <div className="mt-3 h-52">
              {trend.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trend}>
                    <defs>
                      <linearGradient id="modelIgReach" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#FF1493" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="#FF1493" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="modelIgViews" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#D4AF8C" stopOpacity={0.22} />
                        <stop offset="100%" stopColor="#D4AF8C" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                    <XAxis
                      dataKey="dateLabel"
                      tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }}
                    />
                    <YAxis tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }} width={40} />
                    <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                    <Legend wrapperStyle={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }} />
                    <Area
                      type="monotone"
                      dataKey="reach"
                      stroke="#FF1493"
                      fill="url(#modelIgReach)"
                      strokeWidth={2}
                      name="Reach"
                      isAnimationActive
                      animationDuration={900}
                    />
                    <Area
                      type="monotone"
                      dataKey="views"
                      stroke="#D4AF8C"
                      fill="url(#modelIgViews)"
                      strokeWidth={2}
                      name="Views"
                      isAnimationActive
                      animationDuration={900}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <p className="flex h-full items-center justify-center text-sm text-white/40">
                  {loading
                    ? "Loading your Instagram story…"
                    : "No insights yet — check back after the next sync."}
                </p>
              )}
            </div>
          </div>

          {trend.some((d) => d.engagement_rate != null) ? (
            <div className={cn(VA_CARD, "p-4")}>
              <div className="flex items-center gap-2">
                <SectionLabel>Engagement vibe</SectionLabel>
                <StatInfoTooltip text={IG_STAT_INFO.engagement_rate} />
              </div>
              <div className="mt-3 h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trend}>
                    <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                    <XAxis
                      dataKey="dateLabel"
                      tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }}
                    />
                    <YAxis tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }} width={36} />
                    <Tooltip
                      contentStyle={CHART_TOOLTIP_STYLE}
                      formatter={(v) => [`${Number(v ?? 0).toFixed(1)}%`, "Engagement"]}
                    />
                    <Line
                      type="monotone"
                      dataKey="engagement_rate"
                      stroke="#E879B8"
                      strokeWidth={2.5}
                      dot={false}
                      isAnimationActive
                      animationDuration={900}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : null}

          <div className={cn(VA_CARD, "p-4")}>
            <div className="flex flex-wrap items-center gap-2">
              <SectionLabel>Posting vs reach</SectionLabel>
              <StatInfoTooltip text={IG_STAT_INFO.posting_correlation} />
              {stats?.posting_reach_correlation != null ? (
                <span className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-white/50">
                  pattern strength {stats.posting_reach_correlation.toFixed(2)} (observational)
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
                  {loading ? "Loading…" : "No posting timeline for this range yet."}
                </p>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Content ───────────────────────────────────────────── */}
      {subTab === "content" ? (
        <div className="space-y-5">
          {contentTip ? (
            <div className={cn(VA_CARD, VA_CARD_GLOW, "p-4")}>
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#D4AF8C]/30 bg-[#D4AF8C]/10">
                  <Clapperboard className="h-5 w-5 text-[#D4AF8C]" />
                </div>
                <div>
                  <SectionLabel>Format tip</SectionLabel>
                  <p className="mt-2 text-sm leading-relaxed text-white/70">{contentTip}</p>
                </div>
              </div>
            </div>
          ) : null}

          <div className={cn(VA_CARD, "p-4 md:p-5")}>
            <div className="mb-3">
              <SectionLabel>Reels, carousels & posts</SectionLabel>
              <p className="mt-1 text-xs text-white/40">
                Tap a post for full stats — same detail view as admin, your content only.
              </p>
            </div>
            <TopPostsLeaderboard
              posts={data?.topPosts ?? []}
              loading={loading}
              compact
              emptyDetail="Top posts will appear after the next Instagram sync."
              detailUrlFor={detailUrlFor}
            />
          </div>

          <div className={cn(VA_CARD, "p-4 md:p-5")}>
            <div className="mb-3 flex items-center gap-2">
              <SectionLabel>Story activity</SectionLabel>
              <StatInfoTooltip text={IG_STAT_INFO.stories} />
            </div>
            <IgStoriesSection
              stories={data?.stories}
              errorTitle="Stories taking a break"
              errorDetail="We couldn’t load active Stories right now — try again after the next sync."
              emptyTitle="No live Stories right now"
              emptyDetail="When you have active Stories up, they’ll show here. We only list what’s live — no made-up metrics."
              metricsUnavailableNote="Live now — Instagram didn’t share performance numbers for these."
            />
          </div>
        </div>
      ) : null}

      {/* ── Audience ──────────────────────────────────────────── */}
      {subTab === "audience" ? (
        <div className="space-y-5">
          {data?.audienceSummary || data?.audience ? (
            <div className={cn(VA_CARD, "p-4 md:p-5")}>
              <div className="mb-3 flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#D4AF8C]/30 bg-[#D4AF8C]/10">
                  <Users className="h-5 w-5 text-[#D4AF8C]" />
                </div>
                <div>
                  <SectionLabel>Who&apos;s watching</SectionLabel>
                  {data.audienceSummary ? (
                    <p className="mt-2 text-sm leading-relaxed text-white/75">
                      {data.audienceSummary}
                    </p>
                  ) : (
                    <p className="mt-2 text-sm text-white/45">
                      Audience details are still warming up.
                    </p>
                  )}
                </div>
              </div>
              {data.audience ? (
                <div className="mt-4 grid gap-4 lg:grid-cols-3">
                  <div className="rounded-2xl border border-white/8 bg-black/20 p-3">
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-white/40">
                      Age
                    </p>
                    <RankedBarList
                      items={data.audience.age_ranges}
                      accent="pink"
                      empty="Age mix coming soon"
                    />
                  </div>
                  <div className="rounded-2xl border border-white/8 bg-black/20 p-3">
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-white/40">
                      Countries
                    </p>
                    <RankedBarList
                      items={data.audience.countries}
                      accent="champagne"
                      formatLabel={countryLabel}
                      empty="Country mix coming soon"
                    />
                  </div>
                  <div className="rounded-2xl border border-white/8 bg-black/20 p-3">
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-white/40">
                      Gender
                    </p>
                    <GenderDonut genders={data.audience.gender_split} height={150} />
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <IgEmptyState
              title="Audience snapshot warming up"
              detail="Demographics appear after Instagram audience data syncs for your account."
            />
          )}
        </div>
      ) : null}

      {/* ── Profile ───────────────────────────────────────────── */}
      {subTab === "profile" ? (
        <div className="space-y-5">
          {viewAsProfile ? (
            <div className={cn(VA_CARD, VA_CARD_GLOW, "relative overflow-hidden p-5 md:p-8")}>
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
                  <p className="mt-1 max-w-md text-sm text-white/60">
                    See your profile the way your fans do! Live ClarioSuite data in a realistic
                    iPhone mockup — tap Posts, Reels, or Carousels, then tap any post for stats.
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
                  compact
                  profileUrl="/api/model/instagram-insights/profile"
                  detailUrlFor={detailUrlFor}
                />
              </div>
            </div>
          ) : (
            <div className={cn(VA_CARD, "p-4 md:p-5")}>
              <SectionLabel>Your Instagram profile</SectionLabel>
              <p className="mt-2 max-w-lg text-sm leading-relaxed text-white/55">
                See your profile the way your fans do! Tap{" "}
                <span className="font-semibold text-white/75">View as Profile</span> above to open
                the iPhone mockup with your live posts, reels, and carousels.
              </p>
            </div>
          )}

          <ModelIgToOfCard card={data?.crossPlatformCard} loading={loading} />
        </div>
      ) : null}
    </div>
  );
}
