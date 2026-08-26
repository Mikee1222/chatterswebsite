"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { ArrowRight, Link2, MessageSquare, RefreshCw, Shield, Smartphone } from "lucide-react";
import {
  CountUp,
  LuxuryStatCard,
  PeriodBadge,
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

type FunnelSubTab = "overview" | "by_model" | "traffic" | "funnel";

const SUB_TABS: { id: FunnelSubTab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "by_model", label: "By Model" },
  { id: "traffic", label: "Traffic Sources" },
  { id: "funnel", label: "Full Funnel" },
];

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

function TalkingPointsBlock({ text }: { text: string }) {
  if (!text.trim()) return null;
  return (
    <div className="relative overflow-hidden rounded-xl border border-[#D4AF8C]/25 bg-gradient-to-br from-[#D4AF8C]/10 via-[#FF1493]/5 to-black/30 px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
      <div className="pointer-events-none absolute -right-4 -top-4 h-12 w-12 rounded-full bg-[#D4AF8C]/10 blur-xl" />
      <div className="relative flex gap-2">
        <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#D4AF8C]/80" />
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-[#D4AF8C]/75">
            Talking Points
          </p>
          <p className="mt-1 text-[12px] leading-relaxed text-white/85">{text}</p>
        </div>
      </div>
    </div>
  );
}

function RoleCard({
  title,
  shortcode,
  storyUrl,
  pageviews,
  button_clicks,
  unique_visitors,
  ctr_pct,
  winning,
}: {
  title: string;
  shortcode: string | null | undefined;
  storyUrl: string | null;
  pageviews: number;
  button_clicks: number;
  unique_visitors: number;
  ctr_pct: number | null;
  winning?: boolean;
}) {
  return (
    <div
      className={cn(
        VA_CARD,
        "space-y-3 p-4",
        winning && "border-[#D4AF8C]/40 ring-1 ring-[#D4AF8C]/25"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#D4AF8C]/90">
            {title}
            {winning ? " · winning" : ""}
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

function HourBars({ hours }: { hours: Array<{ hour: number; count: number }> }) {
  if (!hours.length) {
    return <p className="text-xs text-white/40">No visitor-hour sample yet (sync visitors).</p>;
  }
  const max = Math.max(...hours.map((h) => h.count), 1);
  const byHour = new Map(hours.map((h) => [h.hour, h.count]));
  return (
    <div className="flex h-24 items-end gap-0.5">
      {Array.from({ length: 24 }, (_, hour) => {
        const count = byHour.get(hour) ?? 0;
        const pct = (count / max) * 100;
        return (
          <div key={hour} className="flex flex-1 flex-col items-center gap-0.5">
            <div
              className="w-full rounded-t bg-[#D4AF8C]/70"
              style={{ height: `${Math.max(pct, count > 0 ? 6 : 2)}%` }}
              title={`${String(hour).padStart(2, "0")}:00 Athens · ${count}`}
            />
          </div>
        );
      })}
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
  const [subTab, setSubTab] = React.useState<FunnelSubTab>("overview");

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
  const periodWinner = data.winners?.period;
  const winA = periodWinner && !periodWinner.tie && periodWinner.role === "A";
  const winB = periodWinner && !periodWinner.tie && periodWinner.role === "B";

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

      <div className="flex flex-wrap gap-1.5">
        {SUB_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setSubTab(t.id)}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
              subTab === t.id
                ? "border-[#D4AF8C]/40 bg-[#D4AF8C]/15 text-[#F5E6D3]"
                : "border-white/10 text-white/55 hover:bg-white/5"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {subTab === "overview" ? (
        <div className="space-y-4">
          {data.talking_points ? <TalkingPointsBlock text={data.talking_points} /> : null}

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <LuxuryStatCard
              label="Total pageviews"
              value={<CountUp value={data.totals.pageviews} />}
              hint={<PeriodBadge change={data.trends.pageviews_wow} />}
            />
            <LuxuryStatCard
              label="Total button clicks"
              value={<CountUp value={data.totals.button_clicks} />}
              hint={
                <span className="inline-flex flex-wrap items-center gap-1.5">
                  <PeriodBadge change={data.trends.clicks_dod} />
                  <span className="text-[10px] text-white/35">DoD</span>
                  <PeriodBadge change={data.trends.clicks_wow} />
                  <span className="text-[10px] text-white/35">WoW</span>
                </span>
              }
            />
            <LuxuryStatCard
              label="Unique visitors"
              value={<CountUp value={data.totals.unique_visitors} />}
            />
            <LuxuryStatCard
              label="CTR"
              value={data.totals.ctr_pct != null ? `${data.totals.ctr_pct}%` : "—"}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
            <LuxuryStatCard
              label="Bot visits (sample)"
              value={
                data.visitorInsights.bot_pct != null
                  ? `${data.visitorInsights.bot_pct}%`
                  : "—"
              }
              hint={
                data.visitorInsights.sample_size > 0
                  ? `${fmtNum(data.visitorInsights.bot_count)} / ${fmtNum(data.visitorInsights.sample_size)} events`
                  : "No visitor sample"
              }
              tooltip="Share of cached visitor events flagged is_bot (recent sample)."
            />
            <LuxuryStatCard
              label="Mobile share"
              value={data.mobile_device_pct != null ? `${data.mobile_device_pct}%` : "—"}
              hint={
                <span className="inline-flex items-center gap-1">
                  <Smartphone className="h-3 w-3" />
                  Device mix
                </span>
              }
            />
            <LuxuryStatCard
              label="Peak hour (Athens)"
              value={
                data.visitorInsights.peak_hour_athens != null
                  ? `${String(data.visitorInsights.peak_hour_athens).padStart(2, "0")}:00`
                  : "—"
              }
              hint={
                data.winners.today && !data.winners.today.tie
                  ? `Today winner: Link ${data.winners.today.role}`
                  : data.winners.this_week && !data.winners.this_week.tie
                    ? `Week winner: Link ${data.winners.this_week.role}`
                    : undefined
              }
            />
          </div>

          <div className={cn(VA_CARD, "p-4")}>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/50">
              Hour of day · visitor events (Athens)
            </div>
            <HourBars hours={data.visitorInsights.hours} />
            <p className="mt-2 text-[10px] text-white/35">0–23 Athens wall clock from visitor sample</p>
          </div>
        </div>
      ) : null}

      {subTab === "by_model" ? (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2 text-xs text-white/55">
            {data.winners.today && !data.winners.today.tie ? (
              <span className="rounded-md border border-[#D4AF8C]/35 bg-[#D4AF8C]/10 px-2 py-1 text-[#D4AF8C]">
                Today: Link {data.winners.today.role}
                {data.winners.today.margin_pct != null
                  ? ` (+${data.winners.today.margin_pct}%)`
                  : ""}
              </span>
            ) : null}
            {data.winners.this_week && !data.winners.this_week.tie ? (
              <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-emerald-300">
                This week: Link {data.winners.this_week.role}
                {data.winners.this_week.margin_pct != null
                  ? ` (+${data.winners.this_week.margin_pct}%)`
                  : ""}
              </span>
            ) : null}
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            <RoleCard
              title="Link A"
              shortcode={data.linkA.link?.shortcode}
              storyUrl={data.storyLinks.link_a_url}
              pageviews={data.linkA.pageviews}
              button_clicks={data.linkA.button_clicks}
              unique_visitors={data.linkA.unique_visitors}
              ctr_pct={data.linkA.ctr_pct}
              winning={Boolean(winA)}
            />
            <RoleCard
              title="Link B"
              shortcode={data.linkB.link?.shortcode}
              storyUrl={data.storyLinks.link_b_url}
              pageviews={data.linkB.pageviews}
              button_clicks={data.linkB.button_clicks}
              unique_visitors={data.linkB.unique_visitors}
              ctr_pct={data.linkB.ctr_pct}
              winning={Boolean(winB)}
            />
          </div>
        </div>
      ) : null}

      {subTab === "traffic" ? (
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
            <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-white/50">
              Devices
              {data.mobile_device_pct != null ? (
                <span className="font-normal normal-case tracking-normal text-[#D4AF8C]/80">
                  · {data.mobile_device_pct}% mobile-ish
                </span>
              ) : null}
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
      ) : null}

      {subTab === "funnel" ? (
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
      ) : null}
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
