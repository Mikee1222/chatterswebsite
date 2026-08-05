"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { AlertTriangle, Link2, RefreshCw, Search } from "lucide-react";
import {
  CountUp,
  DatePresetBar,
  money,
  parseYmdLocal,
  StatInfoTooltip,
  toLocalYmd,
} from "@/components/infloww-performance-ui";
import { VA_BTN_PRIMARY, VA_CARD, VA_CARD_GLOW, VA_FILTER_INPUT } from "@/lib/va-tasks-tokens";
import { cn } from "@/lib/utils";
import type { InflowwStatsPreset } from "@/services/infloww-performance";
import { AdminInflowwCreatorsLookup } from "@/components/admin-infloww-creators-lookup";

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

type Tab = "overview" | "marketing" | "transactions" | "crossref";

type DashboardPayload = {
  range: { startYmd: string; endYmd: string; preset: InflowwStatsPreset };
  models: Array<{ id: string; name: string; creatorInflowwId: string; stableId: string }>;
  daily: Array<{
    creator_infloww_id: string;
    model_record_id: string | null;
    model_name: string | null;
    date: string;
    performance_rank: number | null;
    profile_visitors: number;
    guest_visitors: number;
    active_fans: number;
    expired_fans: number;
    new_subscribers: number;
    renewals: number;
    messages_sent: number;
    ppvs_sent: number;
    fans_chatted: number;
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
    sales_rule: string | null;
    attribute_employee_id: string | null;
    sales_amount: number | null;
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
    finished_flag: boolean;
  }>;
  discrepancies: Array<{
    date: string;
    infloww_employee_id: string;
    perf_sales: number;
    employee_report_sales: number;
    delta: number;
  }>;
  totals: {
    gross: number;
    net: number;
    fee: number;
    new_subscribers: number;
    renewals: number;
    profile_visitors: number;
    messages_sent: number;
  };
  latestFanSnapshot: Array<{
    model_record_id: string | null;
    model_name: string | null;
    active_fans: number;
    expired_fans: number;
    date: string;
  }>;
  error?: string;
};

const EARNINGS_INFO = {
  gross: "Sum of transaction amounts (gross) in the selected range from synced Infloww transactions.",
  net: "Sum of net amounts after OnlyFans fees, from synced transaction rows.",
  visitors: "Profile visitors from Infloww creator-report reach (guest + logged-in).",
  fans: "Latest active vs expired fan counts from creator-report for each model in range.",
  subs: "New subscribers and renewals summed across days in the selected range.",
  rank: "Platform performance rank from Infloww (lower % is better — e.g. 3.00 ≈ top 3%).",
  marketing: "Campaign / trial / tracking link earnings and paying-fan conversion from Infloww links.",
  crossref:
    "Compares transaction-perf attributed sales to employee-report daily sales. Large deltas may indicate attribution lag or sync gaps.",
} as const;

function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-xl bg-white/5", className)} />;
}

export function AdminEarningsDashboard() {
  const [tab, setTab] = React.useState<Tab>("overview");
  const [preset, setPreset] = React.useState<InflowwStatsPreset>("this_month");
  const [customStart, setCustomStart] = React.useState("");
  const [customEnd, setCustomEnd] = React.useState("");
  const [modelId, setModelId] = React.useState("");
  const [txType, setTxType] = React.useState("");
  const [txStatus, setTxStatus] = React.useState("");
  const [txSearch, setTxSearch] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [syncing, setSyncing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [data, setData] = React.useState<DashboardPayload | null>(null);

  const load = React.useCallback(
    async (opts?: {
      preset?: InflowwStatsPreset;
      startYmd?: string;
      endYmd?: string;
    }) => {
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
        if (txType) qp.set("txType", txType);
        if (txStatus) qp.set("txStatus", txStatus);
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
    [preset, customStart, customEnd, modelId, txType, txStatus, txSearch]
  );

  React.useEffect(() => {
    void load();
    // initial + when filters that should auto-refresh change (model)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: preset clicks call load explicitly
  }, [modelId]);

  async function runSync() {
    setSyncing(true);
    try {
      const startYmd = data?.range.startYmd;
      const endYmd = data?.range.endYmd;
      const res = await fetch("/api/admin/creator-earnings/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startYmd, endYmd }),
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
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, gross]) => ({ date, gross }));
  }, [data?.transactions]);

  const rankTrend = React.useMemo(() => {
    const rows = (data?.daily ?? []).filter((d) => d.performance_rank != null);
    const filtered = modelId
      ? rows.filter((d) => d.model_record_id === modelId)
      : rows;
    return filtered
      .map((d) => ({
        date: d.date,
        rank: d.performance_rank as number,
        name: d.model_name ?? d.creator_infloww_id,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [data?.daily, modelId]);

  const visitorTrend = React.useMemo(() => {
    const rows = modelId
      ? (data?.daily ?? []).filter((d) => d.model_record_id === modelId)
      : (data?.daily ?? []);
    const byDay = new Map<string, number>();
    for (const r of rows) {
      byDay.set(r.date, (byDay.get(r.date) ?? 0) + r.profile_visitors);
    }
    return [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, visitors]) => ({ date, visitors }));
  }, [data?.daily, modelId]);

  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "marketing", label: "Marketing" },
    { id: "transactions", label: "Transactions" },
    { id: "crossref", label: "Cross-check" },
  ];

  return (
    <div className="space-y-6">
      <div className={cn(VA_CARD, VA_CARD_GLOW, "p-5")}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <DatePresetBar
            preset={preset}
            loading={loading}
            onSelect={(p) => {
              setPreset(p);
              if (p !== "custom") void load({ preset: p });
            }}
          />
          <div className="flex flex-wrap items-center gap-2">
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
            <button
              type="button"
              disabled={syncing || loading}
              onClick={() => void runSync()}
              className={cn(VA_BTN_PRIMARY, "inline-flex items-center gap-2 px-4 py-2.5 text-xs")}
            >
              <RefreshCw className={cn("h-3.5 w-3.5", syncing && "animate-spin")} aria-hidden />
              {syncing ? "Syncing…" : "Sync now"}
            </button>
          </div>
        </div>
        {preset === "custom" ? (
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <label className="text-xs text-white/50">
              From
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className={cn(VA_FILTER_INPUT, "mt-1 block")}
              />
            </label>
            <label className="text-xs text-white/50">
              To
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className={cn(VA_FILTER_INPUT, "mt-1 block")}
              />
            </label>
            <button
              type="button"
              className={cn(VA_BTN_PRIMARY, "px-4 py-2 text-xs")}
              onClick={() =>
                void load({
                  preset: "custom",
                  startYmd: customStart || toLocalYmd(parseYmdLocal(data?.range.startYmd ?? "")),
                  endYmd: customEnd || toLocalYmd(new Date()),
                })
              }
            >
              Apply
            </button>
          </div>
        ) : null}
        {data?.range ? (
          <p className="mt-3 text-xs text-white/40">
            {data.range.startYmd} → {data.range.endYmd} · synced creator data
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-xs font-semibold transition",
              tab === t.id
                ? "border-[#FF1493]/50 bg-[#FF1493]/15 text-[#FF1493]"
                : "border-white/10 bg-white/5 text-white/55 hover:text-white"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error ? (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      ) : null}

      {tab === "overview" ? (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              {
                label: "Gross revenue",
                value: data?.totals.gross ?? 0,
                format: (n: number) => money(n, 2),
                info: EARNINGS_INFO.gross,
              },
              {
                label: "Net revenue",
                value: data?.totals.net ?? 0,
                format: (n: number) => money(n, 2),
                info: EARNINGS_INFO.net,
              },
              {
                label: "New subs",
                value: data?.totals.new_subscribers ?? 0,
                format: (n: number) => String(Math.round(n)),
                info: EARNINGS_INFO.subs,
              },
              {
                label: "Profile visitors",
                value: data?.totals.profile_visitors ?? 0,
                format: (n: number) => String(Math.round(n)),
                info: EARNINGS_INFO.visitors,
              },
            ].map((card) => (
              <div key={card.label} className={cn(VA_CARD, "p-5")}>
                <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/45">
                  {card.label}
                  <StatInfoTooltip text={card.info} />
                </div>
                {loading && !data ? (
                  <Skeleton className="mt-3 h-9 w-28" />
                ) : (
                  <p className="mt-3 text-2xl font-semibold text-white">
                    <CountUp value={card.value} format={card.format} />
                  </p>
                )}
              </div>
            ))}
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <div className={cn(VA_CARD, "p-5")}>
              <h2 className="mb-3 text-sm font-semibold text-white/90">Revenue trend</h2>
              <div className="h-64">
                {loading && !data ? (
                  <Skeleton className="h-full w-full" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={revenueTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                      <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 10 }} />
                      <YAxis tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 10 }} />
                      <Tooltip
                        contentStyle={{
                          background: "#141214",
                          border: "1px solid rgba(255,255,255,0.1)",
                          borderRadius: 12,
                        }}
                        formatter={(v) => [money(Number(v), 2), "Gross"]}
                      />
                      <Area
                        type="monotone"
                        dataKey="gross"
                        stroke="#FF1493"
                        fill="rgba(255,20,147,0.2)"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
            <div className={cn(VA_CARD, "p-5")}>
              <div className="mb-3 flex items-center gap-1.5">
                <h2 className="text-sm font-semibold text-white/90">Profile visitors</h2>
                <StatInfoTooltip text={EARNINGS_INFO.visitors} />
              </div>
              <div className="h-64">
                {loading && !data ? (
                  <Skeleton className="h-full w-full" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={visitorTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                      <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 10 }} />
                      <YAxis tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 10 }} />
                      <Tooltip
                        contentStyle={{
                          background: "#141214",
                          border: "1px solid rgba(255,255,255,0.1)",
                          borderRadius: 12,
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="visitors"
                        stroke="#D4AF8C"
                        fill="rgba(212,175,140,0.18)"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          <div className={cn(VA_CARD, "p-5")}>
            <div className="mb-3 flex items-center gap-1.5">
              <h2 className="text-sm font-semibold text-white/90">Platform rank trend</h2>
              <StatInfoTooltip text={EARNINGS_INFO.rank} />
            </div>
            <div className="h-56">
              {loading && !data ? (
                <Skeleton className="h-full w-full" />
              ) : rankTrend.length === 0 ? (
                <p className="py-10 text-center text-sm text-white/45">No rank data in this range.</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={rankTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 10 }} />
                    <YAxis
                      reversed
                      tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 10 }}
                      domain={["auto", "auto"]}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "#141214",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: 12,
                      }}
                    />
                    <Line type="monotone" dataKey="rank" stroke="#a78bfa" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className={cn(VA_CARD, "overflow-hidden")}>
            <div className="border-b border-white/8 px-5 py-3">
              <div className="flex items-center gap-1.5 text-sm font-semibold text-white/90">
                Fan snapshot
                <StatInfoTooltip text={EARNINGS_INFO.fans} />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left text-[11px] uppercase tracking-wider text-white/40">
                  <tr>
                    <th className="px-5 py-3">Model</th>
                    <th className="px-3 py-3">Active</th>
                    <th className="px-3 py-3">Expired</th>
                    <th className="px-5 py-3">As of</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.latestFanSnapshot ?? []).map((row) => (
                    <tr
                      key={`${row.model_record_id}-${row.date}`}
                      className="border-t border-white/6 text-white/80"
                    >
                      <td className="px-5 py-3 font-medium">{row.model_name ?? "—"}</td>
                      <td className="px-3 py-3 tabular-nums">{row.active_fans}</td>
                      <td className="px-3 py-3 tabular-nums">{row.expired_fans}</td>
                      <td className="px-5 py-3 text-white/45">{row.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!loading && !(data?.latestFanSnapshot?.length) ? (
                <p className="px-5 py-8 text-sm text-white/45">No fan snapshot yet — run Sync now.</p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {tab === "marketing" ? (
        <div className={cn(VA_CARD, "overflow-hidden")}>
          <div className="flex items-center gap-2 border-b border-white/8 px-5 py-3">
            <Link2 className="h-4 w-4 text-[#D4AF8C]" aria-hidden />
            <h2 className="text-sm font-semibold text-white/90">Marketing links</h2>
            <StatInfoTooltip text={EARNINGS_INFO.marketing} />
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-[11px] uppercase tracking-wider text-white/40">
                <tr>
                  <th className="px-5 py-3">Type</th>
                  <th className="px-3 py-3">Message</th>
                  <th className="px-3 py-3">Subs</th>
                  <th className="px-3 py-3">Paying</th>
                  <th className="px-3 py-3">Gross</th>
                  <th className="px-5 py-3">Net</th>
                </tr>
              </thead>
              <tbody>
                {(data?.marketingLinks ?? [])
                  .filter((l) => !modelId || l.model_id === modelId)
                  .map((l) => (
                    <tr key={l.id} className="border-t border-white/6 text-white/80">
                      <td className="px-5 py-3">
                        <span className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#D4AF8C]">
                          {l.link_type}
                        </span>
                      </td>
                      <td className="max-w-xs truncate px-3 py-3 text-white/65">{l.message ?? "—"}</td>
                      <td className="px-3 py-3 tabular-nums">{l.sub_count}</td>
                      <td className="px-3 py-3 tabular-nums">{l.paying_fans_count}</td>
                      <td className="px-3 py-3 tabular-nums">{money(l.earnings_gross, 2)}</td>
                      <td className="px-5 py-3 tabular-nums">{money(l.earnings_net, 2)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
            {!loading && !(data?.marketingLinks?.length) ? (
              <p className="px-5 py-8 text-sm text-white/45">No marketing links synced yet.</p>
            ) : null}
          </div>
        </div>
      ) : null}

      {tab === "transactions" ? (
        <div className="space-y-4">
          <div className={cn(VA_CARD, "flex flex-wrap gap-2 p-4")}>
            <div className="relative min-w-[200px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/35" />
              <input
                value={txSearch}
                onChange={(e) => setTxSearch(e.target.value)}
                placeholder="Search fan / tx id"
                className={cn(VA_FILTER_INPUT, "w-full pl-9")}
              />
            </div>
            <select
              value={txType}
              onChange={(e) => setTxType(e.target.value)}
              className={VA_FILTER_INPUT}
            >
              <option value="">All types</option>
              <option value="Tips">Tips</option>
              <option value="Subscription">Subscription</option>
            </select>
            <select
              value={txStatus}
              onChange={(e) => setTxStatus(e.target.value)}
              className={VA_FILTER_INPUT}
            >
              <option value="">All statuses</option>
              <option value="done">done</option>
              <option value="loading">loading</option>
            </select>
            <button
              type="button"
              className={cn(VA_BTN_PRIMARY, "px-4 py-2 text-xs")}
              onClick={() => void load()}
            >
              Filter
            </button>
          </div>
          <div className={cn(VA_CARD, "overflow-hidden")}>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left text-[11px] uppercase tracking-wider text-white/40">
                  <tr>
                    <th className="px-5 py-3">When</th>
                    <th className="px-3 py-3">Model</th>
                    <th className="px-3 py-3">Fan</th>
                    <th className="px-3 py-3">Type</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3">Gross</th>
                    <th className="px-5 py-3">Attribution</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.transactions ?? []).map((tx) => (
                    <tr key={tx.transaction_id} className="border-t border-white/6 text-white/80">
                      <td className="px-5 py-3 text-white/50 tabular-nums">
                        {tx.created_time ? tx.created_time.slice(0, 16).replace("T", " ") : "—"}
                      </td>
                      <td className="px-3 py-3">{tx.model_name ?? "—"}</td>
                      <td className="px-3 py-3">{tx.fan_name ?? "—"}</td>
                      <td className="px-3 py-3">{tx.type ?? "—"}</td>
                      <td className="px-3 py-3">
                        <span
                          className={cn(
                            "rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase",
                            tx.status === "loading"
                              ? "bg-amber-500/15 text-amber-200"
                              : "bg-emerald-500/15 text-emerald-200"
                          )}
                        >
                          {tx.status ?? "—"}
                        </span>
                      </td>
                      <td className="px-3 py-3 tabular-nums">{money(tx.amount, 2)}</td>
                      <td className="px-5 py-3 text-xs text-white/50">
                        {tx.sales_rule ?? "—"}
                        {tx.attribute_employee_id
                          ? ` · emp ${tx.attribute_employee_id.slice(-6)}`
                          : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!loading && !(data?.transactions?.length) ? (
                <p className="px-5 py-8 text-sm text-white/45">No transactions in this range.</p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {tab === "crossref" ? (
        <div className={cn(VA_CARD, "overflow-hidden")}>
          <div className="flex items-start gap-3 border-b border-white/8 px-5 py-4">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300/80" aria-hidden />
            <div>
              <div className="flex items-center gap-1.5 text-sm font-semibold text-white/90">
                Transaction-perf vs employee-report
                <StatInfoTooltip text={EARNINGS_INFO.crossref} />
              </div>
              <p className="mt-1 text-xs text-white/45">
                Rows where attributed sales and employee daily sales differ by ≥ $0.50.
              </p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-[11px] uppercase tracking-wider text-white/40">
                <tr>
                  <th className="px-5 py-3">Date</th>
                  <th className="px-3 py-3">Employee id</th>
                  <th className="px-3 py-3">Perf sales</th>
                  <th className="px-3 py-3">Employee report</th>
                  <th className="px-5 py-3">Delta</th>
                </tr>
              </thead>
              <tbody>
                {(data?.discrepancies ?? []).map((d) => (
                  <tr
                    key={`${d.infloww_employee_id}-${d.date}`}
                    className="border-t border-white/6 text-white/80"
                  >
                    <td className="px-5 py-3">{d.date}</td>
                    <td className="px-3 py-3 font-mono text-xs text-white/55">
                      {d.infloww_employee_id}
                    </td>
                    <td className="px-3 py-3 tabular-nums">{money(d.perf_sales, 2)}</td>
                    <td className="px-3 py-3 tabular-nums">{money(d.employee_report_sales, 2)}</td>
                    <td
                      className={cn(
                        "px-5 py-3 tabular-nums font-semibold",
                        d.delta > 0 ? "text-amber-200" : "text-sky-200"
                      )}
                    >
                      {money(d.delta, 2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!loading && !(data?.discrepancies?.length) ? (
              <p className="px-5 py-10 text-center text-sm text-emerald-200/80">
                No discrepancies found in this range.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      <AdminInflowwCreatorsLookup />
    </div>
  );
}
