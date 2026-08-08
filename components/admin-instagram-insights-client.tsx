"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import {
  Activity,
  CheckCircle2,
  ExternalLink,
  RefreshCw,
  Sparkles,
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
import { VA_CARD, VA_CARD_GLOW } from "@/lib/va-tasks-tokens";
import { cn } from "@/lib/utils";
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

type InsightsPayload = {
  range: { startYmd: string; endYmd: string; preset: InflowwStatsPreset };
  models: Array<{ id: string; name: string; igUserId: string }>;
  selectedModelId: string | null;
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
  bestTime: { hourUtc: number; value: number; label: string } | null;
  topPosts: Array<{
    media_id: string;
    permalink: string | null;
    media_type: string | null;
    caption: string | null;
    engagement_score: number | null;
    reach: number;
    likes: number;
    comments: number;
    rank: number;
  }>;
  error?: string;
};

type HealthPayload = {
  configured: boolean;
  healthy: boolean;
  me: { name: string; keyId: string; orgId: string | null } | null;
  meError: string | null;
  modelsTotal: number;
  modelsLinked: number;
};

function fmtNum(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return Math.round(n).toLocaleString();
}

function fmtPct(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n.toFixed(2)}%`;
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

  const trend = data?.daily ?? [];
  const ages = (data?.audience?.age_ranges ?? []).slice(0, 8);
  const countries = (data?.audience?.countries ?? []).slice(0, 8);
  const genders = data?.audience?.gender_split ?? [];
  const online = [...(data?.audience?.online_followers_by_hour ?? [])].sort(
    (a, b) => a.hour - b.hour
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-1 pb-10">
      <div className={cn(VA_CARD, VA_CARD_GLOW, "p-5 md:p-6")}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#D4AF8C]/80">
              Marketing · Instagram
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-white md:text-3xl">
              Instagram Insights
            </h1>
            <p className="mt-1 max-w-xl text-sm text-white/50">
              Reach, engagement, audience demographics, and best times to post — powered by
              ClarioSuite.
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
              {health?.healthy ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
              {health?.healthy
                ? `API connected${health.me?.name ? ` · ${health.me.name}` : ""}`
                : health?.meError || "API not connected"}
            </div>
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

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
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
          <div className="mt-3">
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
          <p className="mt-3 text-xs text-white/40">
            {data.range.startYmd} → {data.range.endYmd}
            {health ? (
              <span className="ml-2 text-white/30">
                · {health.modelsLinked}/{health.modelsTotal} models linked
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
          <h2 className="text-lg font-semibold text-white">Link an Instagram account</h2>
          <p className="mx-auto max-w-md text-sm text-white/50">
            Copy an IG user ID from the lookup below, then paste it on Accounts → Models → Edit →
            ClarioSuite IG user ID. After linking, run Sync now.
          </p>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <LuxuryStatCard
          label="Reach"
          value={<CountUp value={data?.totals.reach ?? 0} />}
          tooltip="Total accounts reached in the selected range (sum of daily reach)."
        />
        <LuxuryStatCard
          label="Views"
          value={<CountUp value={data?.totals.views ?? 0} />}
          tooltip="Total content views across the selected range."
        />
        <LuxuryStatCard
          label="Engagement rate"
          value={fmtPct(data?.totals.avg_engagement_rate)}
          tooltip="Average of daily totalInteractions ÷ reach × 100."
        />
        <LuxuryStatCard
          label="Follower growth"
          value={
            data?.totals.follower_delta != null
              ? `${data.totals.follower_delta >= 0 ? "+" : ""}${fmtNum(data.totals.follower_delta)}`
              : "—"
          }
          tooltip="Change in reconstructed follower count from first to last day in range."
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className={cn(VA_CARD, "p-4")}>
          <SectionLabel>Reach & views</SectionLabel>
          <div className="mt-3 h-56">
            {trend.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend}>
                  <defs>
                    <linearGradient id="igReach" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#FF1493" stopOpacity={0.45} />
                      <stop offset="100%" stopColor="#FF1493" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }} />
                  <YAxis tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }} width={40} />
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
                    fill="url(#igReach)"
                    strokeWidth={2}
                    name="Reach"
                  />
                  <Area
                    type="monotone"
                    dataKey="views"
                    stroke="#D4AF8C"
                    fill="transparent"
                    strokeWidth={2}
                    name="Views"
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
          <SectionLabel>Engagement rate</SectionLabel>
          <div className="mt-3 h-56">
            {trend.some((d) => d.engagement_rate != null) ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend}>
                  <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }} />
                  <YAxis tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }} width={40} />
                  <Tooltip
                    contentStyle={{
                      background: "#121218",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 12,
                    }}
                    formatter={(v) => [`${Number(v ?? 0).toFixed(2)}%`, "Engagement"]}
                  />
                  <Line
                    type="monotone"
                    dataKey="engagement_rate"
                    stroke="#E879B8"
                    strokeWidth={2}
                    dot={false}
                    name="Engagement %"
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

      <div className={cn(VA_CARD, "p-5")}>
        <div className="flex flex-wrap items-center gap-2">
          <SectionLabel>Best time to post</SectionLabel>
          <StatInfoTooltip text="Derived from onlineFollowers (UTC hours). Peak = when the most followers are typically online." />
        </div>
        {data?.bestTime ? (
          <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end">
            <div>
              <p className="text-3xl font-semibold text-white">{data.bestTime.label}</p>
              <p className="mt-1 text-sm text-white/50">
                Highest online-follower signal in this account&apos;s audience snapshot.
              </p>
            </div>
            <div className="h-40 min-w-0 flex-1">
              {online.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={online}>
                    <XAxis dataKey="hour" tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }} />
                    <YAxis hide />
                    <Tooltip
                      contentStyle={{
                        background: "#121218",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: 12,
                      }}
                      labelFormatter={(h) => `${String(h).padStart(2, "0")}:00 UTC`}
                    />
                    <Bar dataKey="value" fill="#D4AF8C" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : null}
            </div>
          </div>
        ) : (
          <p className="mt-3 text-sm text-white/40">Audience online hours not synced yet.</p>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className={cn(VA_CARD, "p-4")}>
          <SectionLabel>Age ranges</SectionLabel>
          <div className="mt-3 h-48">
            {ages.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ages} layout="vertical" margin={{ left: 8 }}>
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="label"
                    width={56}
                    tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 10 }}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#121218",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 12,
                    }}
                  />
                  <Bar dataKey="value" fill="#FF1493" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="flex h-full items-center justify-center text-sm text-white/35">No age data</p>
            )}
          </div>
        </div>
        <div className={cn(VA_CARD, "p-4")}>
          <SectionLabel>Top countries</SectionLabel>
          <div className="mt-3 h-48">
            {countries.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={countries} layout="vertical" margin={{ left: 8 }}>
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="label"
                    width={40}
                    tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 10 }}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#121218",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 12,
                    }}
                  />
                  <Bar dataKey="value" fill="#D4AF8C" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="flex h-full items-center justify-center text-sm text-white/35">
                No country data
              </p>
            )}
          </div>
        </div>
        <div className={cn(VA_CARD, "p-4")}>
          <SectionLabel>Gender split</SectionLabel>
          <ul className="mt-3 space-y-2">
            {genders.length ? (
              genders.map((g) => (
                <li
                  key={g.label}
                  className="flex items-center justify-between rounded-xl border border-white/5 bg-black/20 px-3 py-2 text-sm"
                >
                  <span className="text-white/70">{g.label}</span>
                  <span className="font-medium text-white">{fmtNum(g.value)}</span>
                </li>
              ))
            ) : (
              <p className="text-sm text-white/35">No gender data</p>
            )}
          </ul>
        </div>
      </div>

      <div className={cn(VA_CARD, "overflow-hidden")}>
        <div className="border-b border-white/10 px-4 py-4">
          <SectionLabel>Top posts</SectionLabel>
          <p className="mt-1 text-xs text-white/40">
            Ranked by engagement score (likes + comments + shares + saved) ÷ reach × 100.
          </p>
        </div>
        {(data?.topPosts ?? []).length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-white/10 text-[11px] uppercase tracking-wider text-white/40">
                <tr>
                  <th className="px-4 py-3 font-medium">#</th>
                  <th className="px-4 py-3 font-medium">Post</th>
                  <th className="px-4 py-3 font-medium">Score</th>
                  <th className="px-4 py-3 font-medium">Reach</th>
                  <th className="px-4 py-3 font-medium">Likes</th>
                  <th className="px-4 py-3 font-medium">Comments</th>
                  <th className="px-4 py-3 font-medium">Link</th>
                </tr>
              </thead>
              <tbody>
                {(data?.topPosts ?? []).map((p) => (
                  <tr key={p.media_id} className="border-b border-white/5 hover:bg-white/[0.03]">
                    <td className="px-4 py-3 text-white/50">{p.rank}</td>
                    <td className="max-w-[240px] truncate px-4 py-3 text-white/80">
                      {p.caption?.trim() || p.media_type || p.media_id}
                    </td>
                    <td className="px-4 py-3 font-medium text-[#D4AF8C]">
                      {p.engagement_score != null ? `${p.engagement_score.toFixed(2)}%` : "—"}
                    </td>
                    <td className="px-4 py-3 text-white/70">{fmtNum(p.reach)}</td>
                    <td className="px-4 py-3 text-white/70">{fmtNum(p.likes)}</td>
                    <td className="px-4 py-3 text-white/70">{fmtNum(p.comments)}</td>
                    <td className="px-4 py-3">
                      {p.permalink ? (
                        <a
                          href={p.permalink}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[#FFB6DE] hover:underline"
                        >
                          Open <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="px-4 py-8 text-center text-sm text-white/35">
            {loading ? "Loading…" : "No top posts synced yet."}
          </p>
        )}
      </div>

      <div className={cn(VA_CARD, "p-4")}>
        <div className="mb-3 flex items-center gap-2 text-sm text-white/60">
          {health?.healthy ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          ) : (
            <Activity className="h-4 w-4 text-amber-300" />
          )}
          Connection & linking
        </div>
        <AdminClarioSuiteAccountsLookup />
      </div>
    </div>
  );
}
