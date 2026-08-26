"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { ArrowRight, Link2, RefreshCw, Shield } from "lucide-react";
import {
  CountUp,
  LuxuryStatCard,
  SectionLabel,
  StatInfoTooltip,
} from "@/components/infloww-performance-ui";
import { IgEmptyState, IgSkeleton, RankedBarList } from "@/components/instagram-insights-shared";
import { VA_CARD } from "@/lib/va-tasks-tokens";
import { cn } from "@/lib/utils";
import { CHART_TOOLTIP_STYLE, fmtNum, formatRelativeSync } from "@/lib/instagram-insights-ui";
import type { GetMySocialAnalyticsSummary } from "@/services/getmysocial-analytics";

const ResponsiveContainer = dynamic(() => import("recharts").then((m) => m.ResponsiveContainer), {
  ssr: false,
});
const ComposedChart = dynamic(() => import("recharts").then((m) => m.ComposedChart), {
  ssr: false,
});
const Bar = dynamic(() => import("recharts").then((m) => m.Bar), { ssr: false });
const Line = dynamic(() => import("recharts").then((m) => m.Line), { ssr: false });
const CartesianGrid = dynamic(() => import("recharts").then((m) => m.CartesianGrid), {
  ssr: false,
});
const XAxis = dynamic(() => import("recharts").then((m) => m.XAxis), { ssr: false });
const YAxis = dynamic(() => import("recharts").then((m) => m.YAxis), { ssr: false });
const Tooltip = dynamic(() => import("recharts").then((m) => m.Tooltip), { ssr: false });
const Legend = dynamic(() => import("recharts").then((m) => m.Legend), { ssr: false });

function shortReferrer(r: string): string {
  try {
    if (r === "Direct / None") return r;
    const u = new URL(r.startsWith("http") ? r : `https://${r}`);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return r.slice(0, 40);
  }
}

function money(n: number): string {
  return `$${Math.round(n).toLocaleString()}`;
}

function RoleCard({
  title,
  shortcode,
  storyUrl,
  pageviews,
  button_clicks,
  unique_visitors,
  ctr_pct,
}: {
  title: string;
  shortcode: string | null | undefined;
  storyUrl: string | null;
  pageviews: number;
  button_clicks: number;
  unique_visitors: number;
  ctr_pct: number | null;
}) {
  return (
    <div className={cn(VA_CARD, "space-y-3 p-4")}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#D4AF8C]/90">
            {title}
          </p>
          <p className="mt-0.5 text-sm text-white/85">
            {shortcode ? `/${shortcode}` : "Not linked"}
          </p>
        </div>
        {storyUrl ? (
          <span className="max-w-[45%] truncate rounded-md border border-white/10 px-2 py-0.5 text-[10px] text-white/40">
            Story: {storyUrl.replace(/^https?:\/\//, "")}
          </span>
        ) : null}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <LuxuryStatCard label="Pageviews" value={<CountUp value={pageviews} />} />
        <LuxuryStatCard label="Button clicks" value={<CountUp value={button_clicks} />} />
        <LuxuryStatCard label="Unique visitors" value={<CountUp value={unique_visitors} />} />
        <LuxuryStatCard label="CTR" value={ctr_pct != null ? `${ctr_pct}%` : "—"} />
      </div>
    </div>
  );
}

/** Flagship Link Funnel Analytics panel for Instagram Insights. */
export function GetMySocialLinkAnalyticsPanel({
  modelId,
  modelName,
  canSync,
}: {
  modelId: string | null;
  modelName?: string;
  canSync?: boolean;
}) {
  const [data, setData] = React.useState<GetMySocialAnalyticsSummary | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [syncing, setSyncing] = React.useState(false);
  const [syncMsg, setSyncMsg] = React.useState<string | null>(null);

  const load = React.useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/getmysocial/analytics?modelId=${encodeURIComponent(id)}&timeframe=thisMonth`,
        { cache: "no-store" }
      );
      const json = (await res.json()) as {
        data?: GetMySocialAnalyticsSummary | null;
        error?: string;
      };
      if (!res.ok) throw new Error(json.error || "Failed to load");
      setData(json.data ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (!modelId) {
      setData(null);
      return;
    }
    void load(modelId);
  }, [modelId, load]);

  async function syncNow() {
    if (!modelId || !canSync) return;
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res = await fetch("/api/admin/getmysocial/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelId, timeframe: "thisMonth" }),
      });
      const json = (await res.json()) as {
        skipped?: boolean;
        skipReason?: string;
        analyticsRowsUpserted?: number;
        error?: string;
        errors?: Array<{ message: string }>;
      };
      if (!res.ok && !json.skipped) {
        throw new Error(json.error || json.errors?.[0]?.message || "Sync failed");
      }
      setSyncMsg(
        json.skipped
          ? json.skipReason || "Skipped"
          : `Synced ${json.analyticsRowsUpserted ?? 0} daily rows`
      );
      await load(modelId);
    } catch (e) {
      setSyncMsg(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  if (!modelId) {
    return (
      <IgEmptyState
        title="Select a model"
        detail="Choose a model to view Link Funnel Analytics (GetMySocial A/B)."
      />
    );
  }

  if (loading && !data) {
    return (
      <div className="space-y-3">
        <IgSkeleton className="h-10 w-64" />
        <div className="grid gap-3 sm:grid-cols-2">
          <IgSkeleton className="h-40" />
          <IgSkeleton className="h-40" />
        </div>
        <IgSkeleton className="h-56" />
      </div>
    );
  }

  if (error) {
    return <IgEmptyState title="Couldn’t load link analytics" detail={error} />;
  }

  if (!data) {
    return (
      <div className={cn(VA_CARD, "space-y-3 p-5")}>
        <SectionLabel>
          <Link2 className="mr-1 inline h-3.5 w-3.5" />
          Link Funnel Analytics
        </SectionLabel>
        <IgEmptyState
          title="No GetMySocial links linked"
          detail={`Link A/B pages for ${modelName ?? "this model"} under Accounts → Models → Integrations, then sync.`}
        />
        {canSync ? (
          <button
            type="button"
            onClick={() => void syncNow()}
            disabled={syncing}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/70 hover:bg-white/5"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", syncing && "animate-spin")} />
            {syncing ? "Syncing…" : "Try sync"}
          </button>
        ) : null}
      </div>
    );
  }

  const funnelChart = data.funnel.map((d) => ({
    ...d,
    short: d.date.slice(5),
  }));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <SectionLabel>
            <Link2 className="mr-1 inline h-3.5 w-3.5" />
            Link Funnel Analytics
          </SectionLabel>
          <p className="mt-1 text-xs text-white/45">
            {data.modelName}
            {data.lastSyncedAt ? ` · synced ${formatRelativeSync(data.lastSyncedAt)}` : ""}
          </p>
        </div>
        {canSync ? (
          <button
            type="button"
            onClick={() => void syncNow()}
            disabled={syncing}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/70 hover:bg-white/5"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", syncing && "animate-spin")} />
            {syncing ? "Syncing…" : "Sync now"}
          </button>
        ) : null}
      </div>
      {syncMsg ? <p className="text-[11px] text-white/45">{syncMsg}</p> : null}

      {/* Link A vs B */}
      <div className="grid gap-3 lg:grid-cols-2">
        <RoleCard
          title="Link A"
          shortcode={data.linkA.link?.shortcode}
          storyUrl={data.storyLinks.link_a_url}
          pageviews={data.linkA.pageviews}
          button_clicks={data.linkA.button_clicks}
          unique_visitors={data.linkA.unique_visitors}
          ctr_pct={data.linkA.ctr_pct}
        />
        <RoleCard
          title="Link B"
          shortcode={data.linkB.link?.shortcode}
          storyUrl={data.storyLinks.link_b_url}
          pageviews={data.linkB.pageviews}
          button_clicks={data.linkB.button_clicks}
          unique_visitors={data.linkB.unique_visitors}
          ctr_pct={data.linkB.ctr_pct}
        />
      </div>

      {/* Funnel strip */}
      <div className={cn(VA_CARD, "p-4")}>
        <div className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-white/50">
          Full funnel
          <StatInfoTooltip text="IG Reach (ClarioSuite) → bio pageviews/clicks (GetMySocial) → OF new subs & revenue (Infloww). Alignment, not attribution." />
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wider text-white/40">IG reach</p>
            <p className="tabular-nums text-white/90">{fmtNum(data.funnelTotals.ig_reach)}</p>
          </div>
          <ArrowRight className="h-4 w-4 text-white/25" />
          <div className="rounded-xl border border-[#D4AF8C]/25 bg-[#D4AF8C]/5 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wider text-[#D4AF8C]/80">Bio views</p>
            <p className="tabular-nums text-white/90">
              {fmtNum(data.funnelTotals.bio_pageviews)}
            </p>
          </div>
          <ArrowRight className="h-4 w-4 text-white/25" />
          <div className="rounded-xl border border-[#D4AF8C]/25 bg-[#D4AF8C]/5 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wider text-[#D4AF8C]/80">Bio clicks</p>
            <p className="tabular-nums text-white/90">
              {fmtNum(data.funnelTotals.bio_button_clicks)}
            </p>
          </div>
          <ArrowRight className="h-4 w-4 text-white/25" />
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wider text-emerald-300/80">OF new subs</p>
            <p className="tabular-nums text-white/90">
              {fmtNum(data.funnelTotals.of_new_subscribers)}
            </p>
          </div>
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wider text-emerald-300/80">OF revenue</p>
            <p className="tabular-nums text-white/90">{money(data.funnelTotals.of_revenue)}</p>
          </div>
        </div>

        {funnelChart.length > 1 ? (
          <div className="mt-4 h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={funnelChart}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="short" tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 11 }} />
                <YAxis yAxisId="left" tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 11 }} />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 11 }}
                />
                <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                <Legend />
                <Bar
                  yAxisId="left"
                  dataKey="ig_reach"
                  name="IG reach"
                  fill="rgba(225,48,108,0.55)"
                />
                <Bar
                  yAxisId="left"
                  dataKey="bio_button_clicks"
                  name="Bio clicks"
                  fill="rgba(212,175,140,0.75)"
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="of_new_subscribers"
                  name="OF new subs"
                  stroke="#34d399"
                  strokeWidth={2}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <LuxuryStatCard
          label="Total pageviews"
          value={<CountUp value={data.totals.pageviews} />}
        />
        <LuxuryStatCard
          label="Total button clicks"
          value={<CountUp value={data.totals.button_clicks} />}
        />
        <LuxuryStatCard
          label="Unique visitors"
          value={<CountUp value={data.totals.unique_visitors} />}
        />
        <LuxuryStatCard
          label="Shield blocked"
          value={`${data.totals.shield_blocked_pct}%`}
          tooltip={`Bot/VPN/datacenter blocks · count ${fmtNum(data.totals.shield_blocked_count)}`}
          hint={
            <span className="inline-flex items-center gap-1">
              <Shield className="h-3 w-3" />
              {fmtNum(data.totals.shield_blocked_count)} events
            </span>
          }
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className={cn(VA_CARD, "p-4")}>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/50">
            Top referrers
          </div>
          <RankedBarList
            items={data.referrers.slice(0, 8).map((r) => ({
              label: shortReferrer(r.referrer),
              value: r.count,
            }))}
            accent="champagne"
          />
        </div>
        <div className={cn(VA_CARD, "p-4")}>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/50">
            Top countries
          </div>
          <RankedBarList
            items={data.countries.slice(0, 8).map((c) => ({
              label: c.label,
              value: c.count,
            }))}
          />
        </div>
        <div className={cn(VA_CARD, "p-4")}>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/50">
            Devices
          </div>
          <RankedBarList
            items={data.devices.map((d) => ({ label: d.label, value: d.count }))}
            accent="champagne"
          />
        </div>
        <div className={cn(VA_CARD, "p-4")}>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/50">
            Browsers / in-app
          </div>
          <RankedBarList
            items={data.browsers.map((d) => ({ label: d.label, value: d.count }))}
          />
        </div>
      </div>
    </div>
  );
}

/** Compact model-facing card for Earnings. */
export function ModelGetMySocialCard() {
  const [payload, setPayload] = React.useState<{
    totals: {
      pageviews: number;
      button_clicks: number;
      unique_visitors: number;
      ctr_pct: number | null;
    };
    linkA?: { pageviews: number; button_clicks: number; ctr_pct: number | null };
    linkB?: { pageviews: number; button_clicks: number; ctr_pct: number | null };
    topReferrers: Array<{ referrer: string; count: number }>;
    lastSyncedAt: string | null;
    message?: string;
  } | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/model/getmysocial/analytics?timeframe=thisMonth", {
          cache: "no-store",
        });
        const json = (await res.json()) as {
          data?: {
            totals: {
              pageviews: number;
              button_clicks: number;
              unique_visitors: number;
              ctr_pct: number | null;
            };
            linkA?: { pageviews: number; button_clicks: number; ctr_pct: number | null };
            linkB?: { pageviews: number; button_clicks: number; ctr_pct: number | null };
            topReferrers: Array<{ referrer: string; count: number }>;
            lastSyncedAt: string | null;
          } | null;
          message?: string;
        };
        if (cancelled) return;
        if (!json.data) {
          setPayload({
            totals: { pageviews: 0, button_clicks: 0, unique_visitors: 0, ctr_pct: null },
            topReferrers: [],
            lastSyncedAt: null,
            message: json.message,
          });
        } else {
          setPayload({ ...json.data, message: undefined });
        }
      } catch {
        if (!cancelled) setPayload(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <IgSkeleton className="h-40 w-full" />;
  if (!payload || payload.message) return null;

  return (
    <div className={cn(VA_CARD, "space-y-3 p-4")}>
      <div className="flex items-center justify-between gap-2">
        <SectionLabel>
          <Link2 className="mr-1 inline h-3.5 w-3.5" />
          My link-in-bio
        </SectionLabel>
        {payload.lastSyncedAt ? (
          <span className="text-[10px] text-white/35">
            {formatRelativeSync(payload.lastSyncedAt)}
          </span>
        ) : null}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <LuxuryStatCard label="Views" value={<CountUp value={payload.totals.pageviews} />} />
        <LuxuryStatCard label="Clicks" value={<CountUp value={payload.totals.button_clicks} />} />
        <LuxuryStatCard
          label="Visitors"
          value={<CountUp value={payload.totals.unique_visitors} />}
        />
        <LuxuryStatCard
          label="CTR"
          value={payload.totals.ctr_pct != null ? `${payload.totals.ctr_pct}%` : "—"}
        />
      </div>
      {payload.linkA || payload.linkB ? (
        <div className="grid grid-cols-2 gap-2 text-xs text-white/70">
          <div className="rounded-lg border border-white/10 px-2 py-1.5">
            <p className="text-[10px] uppercase text-[#D4AF8C]/80">Link A</p>
            <p>
              {fmtNum(payload.linkA?.pageviews ?? 0)} views ·{" "}
              {payload.linkA?.ctr_pct != null ? `${payload.linkA.ctr_pct}%` : "—"} CTR
            </p>
          </div>
          <div className="rounded-lg border border-white/10 px-2 py-1.5">
            <p className="text-[10px] uppercase text-[#D4AF8C]/80">Link B</p>
            <p>
              {fmtNum(payload.linkB?.pageviews ?? 0)} views ·{" "}
              {payload.linkB?.ctr_pct != null ? `${payload.linkB.ctr_pct}%` : "—"} CTR
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
