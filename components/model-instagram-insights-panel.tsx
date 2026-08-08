"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { Heart, Sparkles, Users } from "lucide-react";
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
  IgSkeleton,
  RankedBarList,
  TopPostsLeaderboard,
} from "@/components/instagram-insights-shared";
import { VA_CARD, VA_CARD_GLOW } from "@/lib/va-tasks-tokens";
import { cn } from "@/lib/utils";
import {
  CHART_TOOLTIP_STYLE,
  countryLabel,
  fmtDelta,
  IG_STAT_INFO,
} from "@/lib/instagram-insights-ui";
import type { InflowwStatsPreset } from "@/services/infloww-performance";

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
    caption: string | null;
    image_url?: string | null;
    engagement_score: number | null;
    reach?: number;
    likes: number;
    comments: number;
    rank: number;
  }>;
  error?: string;
};

function shortDate(ymd: string): string {
  const [, m, d] = ymd.split("-");
  return `${m}/${d}`;
}

export function ModelInstagramInsightsPanel() {
  const [preset, setPreset] = React.useState<InflowwStatsPreset>("this_month");
  const [customFrom, setCustomFrom] = React.useState("");
  const [customTo, setCustomTo] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [data, setData] = React.useState<Payload | null>(null);

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
            Celebrate the reach you&apos;re building — trends, who&apos;s watching, and when to post
            next.
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

      {error ? (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      ) : null}

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
            value={<CountUp value={data?.totals?.views ?? 0} />}
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
            label="Follower change"
            value={fmtDelta(data?.totals?.follower_delta)}
            hint={
              data?.totals?.follower_end != null
                ? `${data.totals.follower_end.toLocaleString()} followers`
                : data?.audience?.followers_count != null
                  ? `${data.audience.followers_count.toLocaleString()} followers`
                  : undefined
            }
            tooltip="Estimated follower change over this range."
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
              <p className="mt-1.5 text-sm leading-relaxed text-white/60">{data.bestTime.message}</p>
            </div>
          </div>
        </div>
      ) : !loading ? (
        <div className={cn(VA_CARD, "p-4 text-sm text-white/45")}>
          We&apos;ll surface your best posting window once online-follower hours sync for your
          account.
        </div>
      ) : null}

      {data?.audienceSummary || data?.audience ? (
        <div className={cn(VA_CARD, "p-4 md:p-5")}>
          <div className="mb-3 flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#D4AF8C]/30 bg-[#D4AF8C]/10">
              <Users className="h-5 w-5 text-[#D4AF8C]" />
            </div>
            <div>
              <SectionLabel>Who&apos;s watching</SectionLabel>
              {data.audienceSummary ? (
                <p className="mt-2 text-sm leading-relaxed text-white/75">{data.audienceSummary}</p>
              ) : (
                <p className="mt-2 text-sm text-white/45">Audience details are still warming up.</p>
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
      ) : null}

      <div className={cn(VA_CARD, "p-4 md:p-5")}>
        <div className="mb-3">
          <SectionLabel>Your top posts</SectionLabel>
          <p className="mt-1 text-xs text-white/40">
            What resonated most — gold, silver, bronze, and keep that energy going.
          </p>
        </div>
        <TopPostsLeaderboard
          posts={data?.topPosts ?? []}
          loading={loading}
          compact
          emptyDetail="Top posts will appear after the next Instagram sync."
        />
      </div>
    </div>
  );
}
