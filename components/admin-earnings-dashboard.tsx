"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { motion, useReducedMotion } from "framer-motion";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Link2,
  RefreshCw,
  Sparkles,
  TrendingDown,
} from "lucide-react";
import {
  CountUp,
  DatePresetBar,
  InflowwCustomDateRange,
  LuxuryStatCard,
  PeriodBadge,
  SectionLabel,
  StatInfoTooltip,
  money,
  pct,
  toLocalYmd,
} from "@/components/infloww-performance-ui";
import { AdminInflowwCreatorsLookup } from "@/components/admin-infloww-creators-lookup";
import { CREATOR_EARNINGS_STAT_INFO } from "@/services/infloww-creator-analytics";
import type { InflowwStatsPreset } from "@/services/infloww-performance";
import { VA_BTN_PRIMARY, VA_CARD, VA_CARD_GLOW, VA_FILTER_INPUT } from "@/lib/va-tasks-tokens";
import { cn } from "@/lib/utils";

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

type Tab = "overview" | "models" | "marketing" | "mass" | "transactions";

type ModelAnalytics = {
  model_record_id: string | null;
  creator_infloww_id: string;
  model_name: string;
  profit: { gross: number; fees: number; refunds: number; net_profit: number };
  refund_rate: { rate: number | null; flagged: string };
  churn: {
    active_fans: number;
    fans_with_renew_on: number;
    renew_on_share: number | null;
    at_risk: boolean;
    label: string;
  };
  arpu: number | null;
  growth: {
    new_subscribers: number;
    renewals: number;
    profile_visitors: number;
    messages_sent: number;
    latest_rank: number | null;
  };
  revenue_change: {
    current: number;
    previous: number;
    pct_change: number | null;
    direction: string;
  } | null;
  revenue_mix: { by_type: Array<{ type: string; gross: number; share: number }> };
};

type DashboardPayload = {
  range: { startYmd: string; endYmd: string; preset: InflowwStatsPreset };
  linkedCount?: number;
  models: Array<{ id: string; name: string; creatorInflowwId: string; stableId: string }>;
  daily: Array<{
    creator_infloww_id: string;
    model_record_id: string | null;
    model_name: string | null;
    date: string;
    performance_rank: number | null;
    profile_visitors: number;
    active_fans: number;
    expired_fans: number;
    new_subscribers: number;
    renewals: number;
    fans_with_renew_on?: number;
  }>;
  transactions: Array<{
    transaction_id: string;
    model_record_id: string | null;
    model_name: string | null;
    fan_name: string | null;
    created_time: string | null;
    type: string | null;
    status: string | null;
    amount: number;
    net: number;
    attribute_employee_id: string | null;
    sales_amount: number | null;
  }>;
  refunds: Array<{
    refund_id: string;
    payment_amount: number;
    refund_time: string | null;
    transaction_type: string | null;
    model_record_id: string | null;
  }>;
  marketingLinks: Array<{
    id: string;
    model_id: string;
    link_type: string;
    message: string | null;
    sub_count: number;
    paying_fans_count: number;
    earnings_gross: number;
    earnings_net: number;
  }>;
  priorityMassMessages: Array<{
    priority_mass_message_id: string;
    employee_id: string | null;
    price: number;
    revenue: number;
    number_of_times_sent: number;
    number_of_purchases: number;
    message_preview: string | null;
  }>;
  analytics: {
    agency_profit: { gross: number; fees: number; refunds: number; net_profit: number };
    agency_refund_rate: { rate: number | null; flagged: string };
    models: ModelAnalytics[];
    alerts: Array<{ id: string; severity: string; title: string; detail: string }>;
    acquisition: Array<{
      link_id: string;
      model_id: string;
      link_type: string;
      message: string | null;
      sub_count: number;
      earnings_gross: number;
      revenue_per_sub: number | null;
    }>;
    mass_message_leaderboard: Array<{
      employee_id: string;
      times_sent: number;
      purchases: number;
      revenue: number;
      conversion_rate: number | null;
      message_count: number;
    }>;
    tenure_insight: { available: boolean; note: string };
    pricing_insight: { available: boolean; note: string };
    chatter_model_heatmap: Array<{
      employee_id: string;
      model_name: string;
      sales: number;
    }>;
  };
  error?: string;
};

type SortKey = "name" | "gross" | "net" | "refund" | "churn" | "subs" | "rank";

function tip(key: keyof typeof CREATOR_EARNINGS_STAT_INFO) {
  return CREATOR_EARNINGS_STAT_INFO[key];
}

function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-xl bg-white/5", className)} />;
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className={cn(VA_CARD, "flex flex-col items-center justify-center px-6 py-12 text-center")}>
      <Sparkles className="mb-3 h-6 w-6 text-[#D4AF8C]/70" />
      <p className="text-sm font-medium text-white/80">{title}</p>
      <p className="mt-1 max-w-md text-xs text-white/45">{detail}</p>
    </div>
  );
}

function ModelDrilldown({ row }: { row: ModelAnalytics }) {
  const [open, setOpen] = React.useState(false);
  const reduce = useReducedMotion();
  return (
    <div className="border-b border-white/6 last:border-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-white/[0.03]"
      >
        {open ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-[#D4AF8C]" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-white/35" />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">{row.model_name}</p>
          <p className="mt-0.5 text-xs text-white/40">
            Net {money(row.profit.net_profit, 0)} · Refund{" "}
            {row.refund_rate.rate == null ? "—" : pct(row.refund_rate.rate)} · Renew-on{" "}
            {row.churn.renew_on_share == null ? "—" : pct(row.churn.renew_on_share)}
            {row.growth.latest_rank != null ? ` · Rank ${row.growth.latest_rank.toFixed(1)}%` : ""}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold tabular-nums text-[#D4AF8C]">
            {money(row.profit.gross, 0)}
          </p>
          {row.revenue_change ? (
            <PeriodBadge
              change={{
                current: row.revenue_change.current,
                previous: row.revenue_change.previous,
                pct_change: row.revenue_change.pct_change,
                direction: row.revenue_change.direction as "up" | "down" | "flat" | "na",
              }}
            />
          ) : null}
        </div>
      </button>
      {open ? (
        <motion.div
          initial={reduce ? false : { opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="space-y-4 border-t border-white/6 bg-black/20 px-4 py-4"
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <LuxuryStatCard
              label="Net profit"
              value={<CountUp value={row.profit.net_profit} format={(n) => money(n, 0)} />}
              tooltip={tip("net_profit")}
              accent="champagne"
            />
            <LuxuryStatCard
              label="Refunds"
              value={<CountUp value={row.profit.refunds} format={(n) => money(n, 0)} />}
              tooltip={tip("refunds")}
              accent="amber"
            />
            <LuxuryStatCard
              label="ARPU"
              value={row.arpu == null ? "—" : money(row.arpu, 2)}
              tooltip={tip("arpu")}
            />
            <LuxuryStatCard
              label="Auto-renew"
              value={row.churn.renew_on_share == null ? "—" : pct(row.churn.renew_on_share)}
              hint={row.churn.label}
              tooltip={tip("churn_risk")}
              accent={row.churn.at_risk ? "amber" : "emerald"}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-white/8 bg-white/[0.03] p-3">
              <p className="text-[10px] uppercase tracking-wider text-white/40">
                Fan funnel <StatInfoTooltip text={tip("visitors")} />
              </p>
              <p className="mt-1 text-sm text-white/80">
                {row.growth.profile_visitors.toLocaleString()} visitors →{" "}
                {row.growth.new_subscribers.toLocaleString()} new →{" "}
                {row.churn.active_fans.toLocaleString()} active →{" "}
                {row.growth.renewals.toLocaleString()} renewals
              </p>
            </div>
            <div className="rounded-xl border border-white/8 bg-white/[0.03] p-3 sm:col-span-2">
              <p className="text-[10px] uppercase tracking-wider text-white/40">Revenue mix</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {row.revenue_mix.by_type.slice(0, 6).map((t) => (
                  <span
                    key={t.type}
                    className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/70"
                  >
                    {t.type}: {money(t.gross, 0)} ({pct(t.share)})
                  </span>
                ))}
                {!row.revenue_mix.by_type.length ? (
                  <span className="text-xs text-white/40">No transactions in range</span>
                ) : null}
              </div>
            </div>
          </div>
        </motion.div>
      ) : null}
    </div>
  );
}

export function AdminEarningsDashboard() {
  const [tab, setTab] = React.useState<Tab>("overview");
  const [preset, setPreset] = React.useState<InflowwStatsPreset>("this_month");
  const [customStart, setCustomStart] = React.useState("");
  const [customEnd, setCustomEnd] = React.useState("");
  const [modelId, setModelId] = React.useState("");
  const [txSearch, setTxSearch] = React.useState("");
  const [sortKey, setSortKey] = React.useState<SortKey>("net");
  const [sortAsc, setSortAsc] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [syncing, setSyncing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [data, setData] = React.useState<DashboardPayload | null>(null);
  const reduce = useReducedMotion();

  const load = React.useCallback(
    async (opts?: { preset?: InflowwStatsPreset; startYmd?: string; endYmd?: string }) => {
      setLoading(true);
      setError(null);
      try {
        const nextPreset = opts?.preset ?? preset;
        const qp = new URLSearchParams({ preset: nextPreset });
        if (nextPreset === "custom") {
          qp.set("startYmd", opts?.startYmd ?? customStart);
          qp.set("endYmd", opts?.endYmd ?? customEnd);
        }
        if (modelId) qp.set("modelId", modelId);
        if (txSearch.trim()) qp.set("txSearch", txSearch.trim());
        const res = await fetch(`/api/admin/creator-earnings?${qp}`, { cache: "no-store" });
        const json = (await res.json()) as DashboardPayload;
        if (!res.ok) throw new Error(json.error ?? "Failed to load earnings");
        setData(json);
        setPreset(json.range.preset);
        if (json.range.preset === "custom") {
          setCustomStart(json.range.startYmd);
          setCustomEnd(json.range.endYmd);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    },
    [preset, customStart, customEnd, modelId, txSearch]
  );

  React.useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- model filter auto-refresh
  }, [modelId]);

  async function runSync() {
    setSyncing(true);
    try {
      const res = await fetch("/api/admin/creator-earnings/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startYmd: data?.range.startYmd,
          endYmd: data?.range.endYmd,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Sync failed");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  const revenueTrend = React.useMemo(() => {
    const byDay = new Map<string, number>();
    for (const tx of data?.transactions ?? []) {
      if (!tx.created_time) continue;
      const d = tx.created_time.slice(0, 10);
      byDay.set(d, (byDay.get(d) ?? 0) + tx.amount);
    }
    return [...byDay.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, gross]) => ({ date, gross }));
  }, [data?.transactions]);

  const sortedModels = React.useMemo(() => {
    const rows = [...(data?.analytics.models ?? [])];
    const dir = sortAsc ? 1 : -1;
    rows.sort((a, b) => {
      const va = (() => {
        switch (sortKey) {
          case "name":
            return a.model_name.toLowerCase();
          case "gross":
            return a.profit.gross;
          case "net":
            return a.profit.net_profit;
          case "refund":
            return a.refund_rate.rate ?? -1;
          case "churn":
            return a.churn.renew_on_share ?? -1;
          case "subs":
            return a.growth.new_subscribers;
          case "rank":
            return a.growth.latest_rank ?? 999;
          default:
            return 0;
        }
      })();
      const vb = (() => {
        switch (sortKey) {
          case "name":
            return b.model_name.toLowerCase();
          case "gross":
            return b.profit.gross;
          case "net":
            return b.profit.net_profit;
          case "refund":
            return b.refund_rate.rate ?? -1;
          case "churn":
            return b.churn.renew_on_share ?? -1;
          case "subs":
            return b.growth.new_subscribers;
          case "rank":
            return b.growth.latest_rank ?? 999;
          default:
            return 0;
        }
      })();
      if (typeof va === "string" && typeof vb === "string") return va.localeCompare(vb) * dir;
      return ((va as number) - (vb as number)) * dir;
    });
    return rows;
  }, [data?.analytics.models, sortKey, sortAsc]);

  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "models", label: "Models" },
    { id: "marketing", label: "Marketing" },
    { id: "mass", label: "Mass msgs" },
    { id: "transactions", label: "Transactions" },
  ];

  const profit = data?.analytics.agency_profit;
  const alerts = data?.analytics.alerts ?? [];

  return (
    <div className="space-y-6">
      <div className={cn(VA_CARD, VA_CARD_GLOW, "p-5 md:p-6")}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-[#D4AF8C]/80">
              Creator earnings
            </p>
            <h2 className="mt-1 text-xl font-semibold text-white md:text-2xl">Agency overview</h2>
            <p className="mt-1 max-w-xl text-sm text-white/50">
              Real net profit, refunds, auto-renew health, and marketing — synced daily from Infloww.
              {data?.linkedCount != null ? ` ${data.linkedCount} linked models.` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void runSync()}
            disabled={syncing || loading}
            className={cn(VA_BTN_PRIMARY, "inline-flex items-center gap-2 self-start")}
          >
            <RefreshCw className={cn("h-4 w-4", syncing && "animate-spin")} />
            {syncing ? "Syncing…" : "Sync now"}
          </button>
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <DatePresetBar
            preset={preset}
            loading={loading}
            onSelect={(p) => {
              if (p === "custom") {
                setPreset("custom");
                return;
              }
              setPreset(p);
              void load({ preset: p });
            }}
          />
          {preset === "custom" ? (
            <InflowwCustomDateRange
              startYmd={customStart || data?.range.startYmd || toLocalYmd(new Date())}
              endYmd={customEnd || data?.range.endYmd || toLocalYmd(new Date())}
              loading={loading}
              onChange={(s, e) => {
                setCustomStart(s);
                setCustomEnd(e);
              }}
              onApply={(s, e) => {
                setCustomStart(s);
                setCustomEnd(e);
                void load({ preset: "custom", startYmd: s, endYmd: e });
              }}
            />
          ) : null}
          <select
            value={modelId}
            onChange={(e) => setModelId(e.target.value)}
            className={cn(VA_FILTER_INPUT, "min-w-[160px]")}
          >
            <option value="">All models</option>
            {(data?.models ?? []).map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
        {data?.range ? (
          <p className="mt-3 text-xs text-white/40">
            {data.range.startYmd} → {data.range.endYmd}
          </p>
        ) : null}
      </div>

      {error ? (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      ) : null}

      <div className="flex gap-1 overflow-x-auto rounded-xl border border-white/8 bg-white/[0.03] p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "shrink-0 rounded-lg px-3.5 py-2 text-xs font-semibold uppercase tracking-wider transition",
              tab === t.id
                ? "bg-[#D4AF8C]/15 text-[#D4AF8C]"
                : "text-white/45 hover:text-white/70"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading && !data ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : null}

      {tab === "overview" && data ? (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <LuxuryStatCard
              label="Gross revenue"
              value={
                <CountUp value={profit?.gross ?? 0} format={(n) => money(n, 0)} duration={reduce ? 0 : 900} />
              }
              tooltip={tip("gross")}
              accent="champagne"
              glow
            />
            <LuxuryStatCard
              label="Net profit"
              value={<CountUp value={profit?.net_profit ?? 0} format={(n) => money(n, 0)} />}
              hint={
                profit
                  ? `Fees ${money(profit.fees, 0)} · Refunds ${money(profit.refunds, 0)}`
                  : undefined
              }
              tooltip={tip("net_profit")}
              accent="emerald"
              glow
            />
            <LuxuryStatCard
              label="Refund rate"
              value={
                data.analytics.agency_refund_rate.rate == null
                  ? "—"
                  : pct(data.analytics.agency_refund_rate.rate)
              }
              tooltip={tip("refund_rate")}
              accent={
                data.analytics.agency_refund_rate.flagged === "critical" ||
                data.analytics.agency_refund_rate.flagged === "warn"
                  ? "amber"
                  : "white"
              }
            />
            <LuxuryStatCard
              label="Linked models"
              value={String(data.analytics.models.length)}
              hint="With Infloww creator match"
              tooltip="Models matched via infloww_creator_id (preferred) or fallback matching."
            />
          </div>

          {alerts.length ? (
            <div className={cn(VA_CARD, "overflow-hidden")}>
              <div className="flex items-center gap-2 border-b border-white/8 px-4 py-3">
                <AlertTriangle className="h-4 w-4 text-amber-300" />
                <SectionLabel>At-risk alerts</SectionLabel>
                <StatInfoTooltip text="Automated flags for high refunds, low auto-renew share, and revenue drops." />
              </div>
              <ul className="divide-y divide-white/6">
                {alerts.slice(0, 12).map((a) => (
                  <li key={a.id} className="flex gap-3 px-4 py-3">
                    <TrendingDown
                      className={cn(
                        "mt-0.5 h-4 w-4 shrink-0",
                        a.severity === "critical" ? "text-red-400" : "text-amber-300"
                      )}
                    />
                    <div>
                      <p className="text-sm font-medium text-white">{a.title}</p>
                      <p className="mt-0.5 text-xs text-white/50">{a.detail}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {(data.analytics.tenure_insight.available || data.analytics.pricing_insight.available) && (
            <div className="grid gap-4 md:grid-cols-2">
              {data.analytics.tenure_insight.available ? (
                <div className={cn(VA_CARD, "p-4")}>
                  <p className="text-xs font-medium uppercase tracking-wider text-[#D4AF8C]/80">
                    Tenure insight <StatInfoTooltip text={tip("tenure")} />
                  </p>
                  <p className="mt-2 text-sm text-white/75">{data.analytics.tenure_insight.note}</p>
                </div>
              ) : null}
              {data.analytics.pricing_insight.available ? (
                <div className={cn(VA_CARD, "p-4")}>
                  <p className="text-xs font-medium uppercase tracking-wider text-[#D4AF8C]/80">
                    Pricing insight <StatInfoTooltip text={tip("pricing")} />
                  </p>
                  <p className="mt-2 text-sm text-white/75">{data.analytics.pricing_insight.note}</p>
                </div>
              ) : null}
            </div>
          )}

          <div className={cn(VA_CARD, "p-4 md:p-5")}>
            <div className="mb-3 flex items-center gap-2">
              <SectionLabel>Revenue trend</SectionLabel>
              <StatInfoTooltip text={tip("gross")} />
            </div>
            {revenueTrend.length ? (
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={revenueTrend}>
                    <defs>
                      <linearGradient id="earnGross" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#D4AF8C" stopOpacity={0.45} />
                        <stop offset="100%" stopColor="#D4AF8C" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                    <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }} />
                    <YAxis tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{
                        background: "#141214",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: 12,
                      }}
                      formatter={(v) => [money(Number(v), 0), "Gross"]}
                    />
                    <Area
                      type="monotone"
                      dataKey="gross"
                      stroke="#D4AF8C"
                      fill="url(#earnGross)"
                      strokeWidth={2}
                      isAnimationActive={!reduce}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState
                title="No revenue in this range"
                detail="Sync creator transactions or widen the date preset."
              />
            )}
          </div>

          <div className={cn(VA_CARD, "overflow-hidden")}>
            <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
              <div className="flex items-center gap-2">
                <SectionLabel>Model leaderboard</SectionLabel>
                <StatInfoTooltip text="Sortable by net profit, refund rate, auto-renew, growth, and rank." />
              </div>
              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as SortKey)}
                className={cn(VA_FILTER_INPUT, "text-xs")}
              >
                <option value="net">Net profit</option>
                <option value="gross">Gross</option>
                <option value="refund">Refund rate</option>
                <option value="churn">Auto-renew</option>
                <option value="subs">New subs</option>
                <option value="rank">Rank</option>
                <option value="name">Name</option>
              </select>
            </div>
            {sortedModels.length ? (
              sortedModels.slice(0, 15).map((row) => (
                <ModelDrilldown key={row.creator_infloww_id} row={row} />
              ))
            ) : (
              <EmptyState
                title="No linked models with data"
                detail="Link models via Creator ID lookup, then sync."
              />
            )}
          </div>

          {data.analytics.chatter_model_heatmap.length ? (
            <div className={cn(VA_CARD, "p-4")}>
              <div className="mb-3 flex items-center gap-2">
                <SectionLabel>Chatter × model</SectionLabel>
                <StatInfoTooltip text={tip("heatmap")} />
              </div>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={data.analytics.chatter_model_heatmap.slice(0, 12).map((c) => ({
                      label: `${c.employee_id.slice(-4)}·${c.model_name.slice(0, 8)}`,
                      sales: c.sales,
                    }))}
                  >
                    <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }} />
                    <YAxis tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{
                        background: "#141214",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: 12,
                      }}
                      formatter={(v) => [money(Number(v), 0), "Sales"]}
                    />
                    <Bar dataKey="sales" fill="#D4AF8C" radius={[6, 6, 0, 0]} isAnimationActive={!reduce} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : null}

          <AdminInflowwCreatorsLookup />
        </div>
      ) : null}

      {tab === "models" && data ? (
        <div className={cn(VA_CARD, "overflow-hidden")}>
          <div className="flex flex-wrap items-center gap-2 border-b border-white/8 px-4 py-3">
            <SectionLabel>All models</SectionLabel>
            <button
              type="button"
              className="ml-auto text-xs text-[#D4AF8C]"
              onClick={() => setSortAsc((v) => !v)}
            >
              {sortAsc ? "Asc" : "Desc"}
            </button>
          </div>
          {sortedModels.map((row) => (
            <ModelDrilldown key={row.creator_infloww_id} row={row} />
          ))}
          {!sortedModels.length ? (
            <EmptyState title="No models" detail="Link Infloww creator IDs on model profiles." />
          ) : null}
        </div>
      ) : null}

      {tab === "marketing" && data ? (
        <div className="space-y-4">
          <p className="text-xs text-white/45">
            True CPA isn’t available — Infloww links have no cost field. Showing revenue per subscriber
            instead. <StatInfoTooltip text={tip("rev_per_sub")} />
          </p>
          <div className={cn(VA_CARD, "overflow-x-auto")}>
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-white/8 text-[10px] uppercase tracking-wider text-white/40">
                <tr>
                  <th className="px-4 py-3">Link</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Subs</th>
                  <th className="px-4 py-3">Gross</th>
                  <th className="px-4 py-3">Rev / sub</th>
                </tr>
              </thead>
              <tbody>
                {(data.analytics.acquisition ?? []).slice(0, 40).map((l) => (
                  <tr key={l.link_id} className="border-b border-white/5">
                    <td className="max-w-[220px] truncate px-4 py-2.5 text-white/80">
                      {l.message || "—"}
                    </td>
                    <td className="px-4 py-2.5 text-white/50">{l.link_type}</td>
                    <td className="px-4 py-2.5 tabular-nums">{l.sub_count}</td>
                    <td className="px-4 py-2.5 tabular-nums text-[#D4AF8C]">
                      {money(l.earnings_gross, 0)}
                    </td>
                    <td className="px-4 py-2.5 tabular-nums">
                      {l.revenue_per_sub == null ? "—" : money(l.revenue_per_sub, 2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data.analytics.acquisition.length ? (
              <EmptyState title="No marketing links" detail="Sync marketing links for linked creators." />
            ) : null}
          </div>
        </div>
      ) : null}

      {tab === "mass" && data ? (
        <div className="space-y-4">
          {!data.analytics.pricing_insight.available ? (
            <p className="text-xs text-white/45">{data.analytics.pricing_insight.note}</p>
          ) : (
            <div className={cn(VA_CARD, "p-4 text-sm text-white/75")}>
              {data.analytics.pricing_insight.note}
            </div>
          )}
          <div className={cn(VA_CARD, "overflow-x-auto")}>
            <div className="flex items-center gap-2 border-b border-white/8 px-4 py-3">
              <SectionLabel>Mass message leaderboard</SectionLabel>
              <StatInfoTooltip text={tip("pmm_leaderboard")} />
            </div>
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="border-b border-white/8 text-[10px] uppercase tracking-wider text-white/40">
                <tr>
                  <th className="px-4 py-3">Employee</th>
                  <th className="px-4 py-3">Sent</th>
                  <th className="px-4 py-3">Purchases</th>
                  <th className="px-4 py-3">Conv.</th>
                  <th className="px-4 py-3">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {data.analytics.mass_message_leaderboard.map((r) => (
                  <tr key={r.employee_id} className="border-b border-white/5">
                    <td className="px-4 py-2.5 font-medium text-white">{r.employee_id}</td>
                    <td className="px-4 py-2.5 tabular-nums">{r.times_sent}</td>
                    <td className="px-4 py-2.5 tabular-nums">{r.purchases}</td>
                    <td className="px-4 py-2.5 tabular-nums">
                      {r.conversion_rate == null ? "—" : pct(r.conversion_rate)}
                    </td>
                    <td className="px-4 py-2.5 tabular-nums text-[#D4AF8C]">
                      {money(r.revenue, 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data.analytics.mass_message_leaderboard.length ? (
              <EmptyState
                title="No priority mass messages yet"
                detail="This agency has no PMM rows in the synced window — empty until campaigns are sent and synced."
              />
            ) : null}
          </div>
        </div>
      ) : null}

      {tab === "transactions" && data ? (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <input
              value={txSearch}
              onChange={(e) => setTxSearch(e.target.value)}
              placeholder="Search fan / tx id"
              className={cn(VA_FILTER_INPUT, "min-w-[200px]")}
            />
            <button
              type="button"
              className={cn(VA_BTN_PRIMARY, "text-xs")}
              onClick={() => void load()}
            >
              Apply
            </button>
          </div>
          <div className={cn(VA_CARD, "overflow-x-auto")}>
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-white/8 text-[10px] uppercase tracking-wider text-white/40">
                <tr>
                  <th className="px-4 py-3">When</th>
                  <th className="px-4 py-3">Model</th>
                  <th className="px-4 py-3">Fan</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Gross</th>
                  <th className="px-4 py-3">Net</th>
                </tr>
              </thead>
              <tbody>
                {data.transactions.slice(0, 80).map((t) => (
                  <tr key={t.transaction_id} className="border-b border-white/5">
                    <td className="px-4 py-2 text-xs text-white/45">
                      {t.created_time?.slice(0, 16)?.replace("T", " ") ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-white/80">{t.model_name ?? "—"}</td>
                    <td className="px-4 py-2 text-white/60">{t.fan_name ?? "—"}</td>
                    <td className="px-4 py-2 text-white/50">{t.type ?? "—"}</td>
                    <td className="px-4 py-2 tabular-nums">{money(t.amount, 2)}</td>
                    <td className="px-4 py-2 tabular-nums text-[#D4AF8C]">{money(t.net, 2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data.transactions.length ? (
              <EmptyState title="No transactions" detail="Widen the range or run a sync." />
            ) : null}
          </div>
          {data.refunds.length ? (
            <div className={cn(VA_CARD, "p-4")}>
              <div className="mb-2 flex items-center gap-2">
                <SectionLabel>Refunds in range</SectionLabel>
                <StatInfoTooltip text={tip("refunds")} />
              </div>
              <p className="text-sm text-white/70">
                {data.refunds.length} refunds ·{" "}
                {money(
                  data.refunds.reduce((s, r) => s + r.payment_amount, 0),
                  2
                )}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      {!loading && !data && !error ? (
        <EmptyState title="Nothing loaded" detail="Try syncing or another date range." />
      ) : null}

      <div className="flex items-center gap-2 text-xs text-white/35">
        <Link2 className="h-3.5 w-3.5" />
        Prefer stable <code className="text-white/50">infloww_creator_id</code> on each model.
      </div>
    </div>
  );
}
