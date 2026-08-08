"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { ExternalLink, Heart, Sparkles } from "lucide-react";
import {
  CountUp,
  DatePresetBar,
  LuxuryStatCard,
  SectionLabel,
} from "@/components/infloww-performance-ui";
import { VA_CARD, VA_CARD_GLOW } from "@/lib/va-tasks-tokens";
import { cn } from "@/lib/utils";
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

type Payload = {
  linked: boolean;
  message?: string;
  range: { startYmd: string; endYmd: string; preset: InflowwStatsPreset } | null;
  daily: Array<{
    date: string;
    reach: number;
    views: number;
    total_interactions: number;
    engagement_rate: number | null;
  }>;
  totals: {
    reach: number;
    views: number;
    total_interactions: number;
    avg_engagement_rate: number | null;
    follower_delta: number | null;
  } | null;
  audience: {
    followers_count: number | null;
    age_ranges: Array<{ label: string; value: number }>;
    countries: Array<{ label: string; value: number }>;
    gender_split: Array<{ label: string; value: number }>;
  } | null;
  bestTime: { hourUtc: number; friendlyLabel: string; message: string } | null;
  topPosts: Array<{
    media_id: string;
    permalink: string | null;
    caption: string | null;
    engagement_score: number | null;
    likes: number;
    comments: number;
    rank: number;
  }>;
  error?: string;
};

function fmtPct(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n.toFixed(1)}%`;
}

export function ModelInstagramInsightsPanel() {
  const [preset, setPreset] = React.useState<InflowwStatsPreset>("this_month");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [data, setData] = React.useState<Payload | null>(null);

  const load = React.useCallback(async (nextPreset?: InflowwStatsPreset) => {
    setLoading(true);
    setError(null);
    try {
      const p = nextPreset ?? preset;
      const res = await fetch(`/api/model/instagram-insights?preset=${p}`, { cache: "no-store" });
      const json = (await res.json()) as Payload;
      if (!res.ok && res.status !== 404) throw new Error(json.error ?? "Failed to load");
      setData(json);
      if (json.range?.preset) setPreset(json.range.preset);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [preset]);

  React.useEffect(() => {
    void load("this_month");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!loading && data && !data.linked) {
    return (
      <div className={cn(VA_CARD, VA_CARD_GLOW, "space-y-3 p-6 text-center")}>
        <Sparkles className="mx-auto h-8 w-8 text-[#D4AF8C]/80" />
        <h2 className="text-lg font-semibold text-white">Instagram insights coming soon</h2>
        <p className="mx-auto max-w-sm text-sm text-white/55">
          {data.message ||
            "Your Instagram isn’t linked yet. Once an admin connects it, you’ll see reach, audience, and your best posting times here."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className={cn(VA_CARD, "p-4")}>
        <DatePresetBar
          preset={preset}
          loading={loading}
          onSelect={(p) => {
            if (p === "custom") return;
            setPreset(p);
            void load(p);
          }}
        />
        {data?.range ? (
          <p className="mt-2 text-xs text-white/40">
            {data.range.startYmd} → {data.range.endYmd}
          </p>
        ) : null}
      </div>

      {error ? (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <LuxuryStatCard
          label="Reach"
          value={<CountUp value={data?.totals?.reach ?? 0} />}
          tooltip="How many unique accounts saw your content."
        />
        <LuxuryStatCard
          label="Views"
          value={<CountUp value={data?.totals?.views ?? 0} />}
          tooltip="Total views across your Instagram content."
        />
        <LuxuryStatCard
          label="Engagement"
          value={fmtPct(data?.totals?.avg_engagement_rate)}
          tooltip="Interactions relative to reach — higher is warmer."
        />
        <LuxuryStatCard
          label="Follower change"
          value={
            data?.totals?.follower_delta != null
              ? `${data.totals.follower_delta >= 0 ? "+" : ""}${data.totals.follower_delta.toLocaleString()}`
              : "—"
          }
          tooltip="Estimated follower change over this range."
        />
      </div>

      <div className={cn(VA_CARD, "p-4")}>
        <SectionLabel>Your reach & views</SectionLabel>
        <div className="mt-3 h-48">
          {(data?.daily ?? []).length ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data?.daily ?? []}>
                <defs>
                  <linearGradient id="modelIgReach" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#FF1493" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#FF1493" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }} />
                <YAxis tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }} width={36} />
                <Tooltip
                  contentStyle={{
                    background: "#121218",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 12,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="reach"
                  stroke="#FF1493"
                  fill="url(#modelIgReach)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="views"
                  stroke="#D4AF8C"
                  fill="transparent"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <p className="flex h-full items-center justify-center text-sm text-white/40">
              {loading ? "Loading your Instagram story…" : "No insights yet — check back after the next sync."}
            </p>
          )}
        </div>
      </div>

      {data?.bestTime ? (
        <div className={cn(VA_CARD, VA_CARD_GLOW, "p-5")}>
          <div className="flex items-start gap-3">
            <Heart className="mt-0.5 h-5 w-5 text-[#FF1493]" />
            <div>
              <SectionLabel>Best time to post</SectionLabel>
              <p className="mt-2 text-lg font-semibold text-white">{data.bestTime.message}</p>
            </div>
          </div>
        </div>
      ) : null}

      {data?.audience ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className={cn(VA_CARD, "p-4")}>
            <SectionLabel>Who’s watching</SectionLabel>
            <ul className="mt-3 space-y-2 text-sm">
              {(data.audience.age_ranges.length ? data.audience.age_ranges : []).map((a) => (
                <li key={a.label} className="flex justify-between text-white/70">
                  <span>{a.label}</span>
                  <span className="text-white">{a.value.toLocaleString()}</span>
                </li>
              ))}
              {!data.audience.age_ranges.length ? (
                <li className="text-white/40">Audience age data isn’t ready yet.</li>
              ) : null}
            </ul>
          </div>
          <div className={cn(VA_CARD, "p-4")}>
            <SectionLabel>Top countries</SectionLabel>
            <ul className="mt-3 space-y-2 text-sm">
              {(data.audience.countries.length ? data.audience.countries : []).map((c) => (
                <li key={c.label} className="flex justify-between text-white/70">
                  <span>{c.label}</span>
                  <span className="text-white">{c.value.toLocaleString()}</span>
                </li>
              ))}
              {!data.audience.countries.length ? (
                <li className="text-white/40">Country mix will show up after sync.</li>
              ) : null}
            </ul>
          </div>
        </div>
      ) : null}

      <div className={cn(VA_CARD, "overflow-hidden")}>
        <div className="border-b border-white/10 px-4 py-3">
          <SectionLabel>Your top posts</SectionLabel>
          <p className="mt-1 text-xs text-white/40">What resonated most recently — keep that energy.</p>
        </div>
        {(data?.topPosts ?? []).length ? (
          <ul className="divide-y divide-white/5">
            {(data?.topPosts ?? []).map((p) => (
              <li key={p.media_id} className="flex items-center gap-3 px-4 py-3">
                <span className="w-6 text-xs text-white/40">#{p.rank}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-white/85">
                    {p.caption?.trim() || "Instagram post"}
                  </p>
                  <p className="text-xs text-white/40">
                    {p.engagement_score != null ? `${p.engagement_score.toFixed(1)}% score` : "—"} ·{" "}
                    {p.likes.toLocaleString()} likes · {p.comments.toLocaleString()} comments
                  </p>
                </div>
                {p.permalink ? (
                  <a
                    href={p.permalink}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#FFB6DE]"
                    aria-label="Open post"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-4 py-8 text-center text-sm text-white/40">
            {loading ? "Loading…" : "Top posts will appear after the next Instagram sync."}
          </p>
        )}
      </div>
    </div>
  );
}
