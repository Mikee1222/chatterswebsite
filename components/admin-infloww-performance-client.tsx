"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { motion, useReducedMotion } from "framer-motion";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Flame,
  RefreshCw,
  Sparkles,
  TrendingDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { VA_CARD, VA_BTN_PRIMARY } from "@/lib/va-tasks-tokens";
import { ROUTES } from "@/lib/routes";
import { AdminInflowwEmployeesLookup } from "@/components/admin-infloww-employees-lookup";
import {
  ConsistencyRing,
  ConversionFunnelViz,
  CountUp,
  DatePresetBar,
  InflowwCustomDateRange,
  LuxuryStatCard,
  PeriodBadge,
  PersonalBestCallout,
  SectionLabel,
  money,
  pct,
} from "@/components/infloww-performance-ui";
import { AdminWeeklyProgressPanel } from "@/components/admin-weekly-progress-panel";
import type {
  InflowwAdminPerformanceReport,
  InflowwChatterPerformance,
  InflowwStatsPreset,
  InflowwWeeklyProgressReport,
} from "@/services/infloww-performance";

type AdminPerfTab = "overview" | "weekly_progress";

const Bar = dynamic(() => import("recharts").then((m) => m.Bar), { ssr: false });
const BarChart = dynamic(() => import("recharts").then((m) => m.BarChart), { ssr: false });
const CartesianGrid = dynamic(() => import("recharts").then((m) => m.CartesianGrid), { ssr: false });
const ResponsiveContainer = dynamic(() => import("recharts").then((m) => m.ResponsiveContainer), {
  ssr: false,
});
const Tooltip = dynamic(() => import("recharts").then((m) => m.Tooltip), { ssr: false });
const XAxis = dynamic(() => import("recharts").then((m) => m.XAxis), { ssr: false });
const YAxis = dynamic(() => import("recharts").then((m) => m.YAxis), { ssr: false });

type SortKey =
  | "name"
  | "sales"
  | "ppv_sales"
  | "tips"
  | "messages_sent"
  | "fans_chatted"
  | "fan_cvr"
  | "revenue_per_hour"
  | "consistency"
  | "avg_ppv";

function sortValue(row: InflowwChatterPerformance, key: SortKey): number | string {
  const a = row.analytics;
  switch (key) {
    case "name":
      return row.full_name || "";
    case "fan_cvr":
      return row.totals.fan_cvr ?? -1;
    case "revenue_per_hour":
      return a?.revenue_per_hour ?? -1;
    case "consistency":
      return a?.consistency_score ?? -1;
    case "avg_ppv":
      return a?.avg_ppv_price ?? -1;
    default:
      return row.totals[key];
  }
}

function ChatterDrilldown({
  row,
  showRoi,
}: {
  row: InflowwChatterPerformance;
  showRoi: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const a = row.analytics;
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
          <p className="truncate text-sm font-semibold text-white">{row.full_name || "Unknown"}</p>
          <p className="mt-0.5 text-xs text-white/40">
            Emp {row.infloww_employee_id} · {row.totals.messages_sent.toLocaleString()} msgs · CVR{" "}
            {pct(row.totals.fan_cvr)}
            {a?.revenue_per_hour != null ? ` · ${money(a.revenue_per_hour)}/h` : ""}
            {a?.team_standing ? ` · #${a.team_standing.rank}/${a.team_standing.of}` : ""}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold tabular-nums text-[#FF1493]">
            {money(row.totals.sales)}
          </p>
          {a ? <PeriodBadge change={a.period_change.sales} /> : null}
        </div>
      </button>
      {open && a ? (
        <div className="space-y-4 border-t border-white/6 bg-black/25 px-4 py-5">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <LuxuryStatCard
              label="Rev / hour"
              value={a.revenue_per_hour != null ? money(a.revenue_per_hour) : "—"}
              hint={
                a.revenue_per_hour != null
                  ? `${a.shift_hours}h shifted`
                  : "Not enough shift data"
              }
              accent="champagne"
            />
            <LuxuryStatCard
              label="Rev / fan"
              value={a.revenue_per_fan != null ? money(a.revenue_per_fan, 2) : "—"}
              accent="pink"
            />
            <LuxuryStatCard
              label="Avg PPV"
              value={a.avg_ppv_price != null ? money(a.avg_ppv_price, 2) : "—"}
            />
            <LuxuryStatCard
              label="Avg tip*"
              value={a.avg_tip_size != null ? money(a.avg_tip_size, 2) : "—"}
              hint={a.tip_size_note ? "Estimated" : undefined}
            />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <ConversionFunnelViz funnel={a.funnel} />
            <ConsistencyRing score={a.consistency_score} />
          </div>
          <PersonalBestCallout
            bestDay={a.personal_best.best_day}
            bestWeek={a.personal_best.best_week}
          />
          {a.high_effort_low_conversion.flagged ? (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
              <Flame className="mr-2 inline h-4 w-4" />
              {a.high_effort_low_conversion.detail}
            </div>
          ) : null}
          {showRoi && a.roi ? (
            <div className={cn(VA_CARD, "border border-white/10 bg-white/5 p-4")}>
              <SectionLabel>ROI (sensitive)</SectionLabel>
              <div className="mt-2 flex flex-wrap gap-4 text-sm">
                <span className="text-white/60">
                  Revenue{" "}
                  <strong className="text-white">{money(a.roi.revenue)}</strong>
                </span>
                <span className="text-white/60">
                  Est. comp{" "}
                  <strong className="text-[#D4AF8C]">
                    {a.roi.estimated_comp != null ? money(a.roi.estimated_comp) : "—"}
                  </strong>
                </span>
                <span className="text-white/60">
                  Ratio{" "}
                  <strong className="text-[#FF1493]">
                    {a.roi.ratio != null ? `${a.roi.ratio.toFixed(1)}×` : "—"}
                  </strong>
                </span>
              </div>
              {a.roi.note ? <p className="mt-2 text-xs text-white/35">{a.roi.note}</p> : null}
            </div>
          ) : null}
          {row.by_performer.length > 0 ? (
            <div>
              <SectionLabel>Creators</SectionLabel>
              <div className="mt-2 space-y-1">
                {row.by_performer.map((p) => (
                  <div
                    key={p.performer_id}
                    className="flex items-center justify-between rounded-xl border border-white/8 px-3 py-2 text-sm"
                  >
                    <span className="truncate text-white/80">{p.performer_name}</span>
                    <span className="tabular-nums text-[#D4AF8C]">{money(p.totals.sales)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Heatmap({
  cells,
  chatters,
}: {
  cells: InflowwAdminPerformanceReport["heatmap"];
  chatters: InflowwChatterPerformance[];
}) {
  const creators = React.useMemo(() => {
    const map = new Map<number, string>();
    for (const c of cells) {
      if (c.performer_id) map.set(c.performer_id, c.performer_name);
    }
    return Array.from(map.entries())
      .sort((a, b) => a[1].localeCompare(b[1]))
      .slice(0, 10);
  }, [cells]);

  const names = chatters.slice(0, 12);
  const maxSales = Math.max(1, ...cells.map((c) => c.sales));
  const lookup = React.useMemo(() => {
    const m = new Map<string, number>();
    for (const c of cells) m.set(`${c.user_public_id}:${c.performer_id}`, c.sales);
    return m;
  }, [cells]);

  if (names.length === 0 || creators.length === 0) {
    return (
      <p className="px-4 py-8 text-center text-sm text-white/40">
        Heatmap needs linked chatters with per-creator sales.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-collapse text-xs">
        <thead>
          <tr>
            <th className="sticky left-0 bg-[#0D0B0D] px-2 py-2 text-left font-medium text-white/40">
              Chatter
            </th>
            {creators.map(([id, name]) => (
              <th
                key={id}
                className="max-w-[5.5rem] truncate px-1.5 py-2 text-center font-medium text-white/40"
                title={name}
              >
                {name.replace(/^Creator\s+/i, "#")}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {names.map((ch) => (
            <tr key={ch.user_uuid}>
              <td className="sticky left-0 max-w-[7rem] truncate bg-[#0D0B0D] px-2 py-1.5 font-medium text-white/70">
                {ch.full_name.split(" ")[0] || ch.full_name}
              </td>
              {creators.map(([pid]) => {
                const sales = lookup.get(`${ch.user_public_id}:${pid}`) ?? 0;
                const intensity = sales / maxSales;
                return (
                  <td key={pid} className="px-1 py-1">
                    <div
                      className="flex h-9 items-center justify-center rounded-lg border border-white/5 tabular-nums"
                      style={{
                        background:
                          sales <= 0
                            ? "rgba(255,255,255,0.02)"
                            : `rgba(255, 20, 147, ${0.08 + intensity * 0.55})`,
                      }}
                      title={money(sales)}
                    >
                      {sales > 0 ? (
                        <span className="text-[10px] font-semibold text-white/90">
                          {sales >= 1000 ? `${(sales / 1000).toFixed(1)}k` : Math.round(sales)}
                        </span>
                      ) : (
                        <span className="text-white/15">·</span>
                      )}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AdminInflowwPerformanceClient({
  initial,
  linkedUsers,
  initialWeekly = null,
}: {
  initial: InflowwAdminPerformanceReport;
  linkedUsers: Array<{ id: string; name: string; employeeId: number }>;
  initialWeekly?: InflowwWeeklyProgressReport | null;
}) {
  const reduce = useReducedMotion();
  const [tab, setTab] = React.useState<AdminPerfTab>("overview");
  const [data, setData] = React.useState(initial);
  const [preset, setPreset] = React.useState<InflowwStatsPreset>(initial.range.preset);
  /** Draft custom range — not overwritten when loading named presets. */
  const [customStart, setCustomStart] = React.useState(initial.range.startYmd);
  const [customEnd, setCustomEnd] = React.useState(initial.range.endYmd);
  const [filterUserId, setFilterUserId] = React.useState("");
  const [filterPerformerId, setFilterPerformerId] = React.useState("");
  const [sortKey, setSortKey] = React.useState<SortKey>("sales");
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("desc");
  const [loading, setLoading] = React.useState(false);
  const [syncing, setSyncing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [syncMsg, setSyncMsg] = React.useState<string | null>(null);
  const [dismissedWhales, setDismissedWhales] = React.useState<Set<string>>(new Set());

  const performerOptions = React.useMemo(() => {
    const map = new Map<number, string>();
    for (const c of data.chatters) {
      for (const p of c.by_performer) {
        if (p.performer_id) map.set(p.performer_id, p.performer_name);
      }
    }
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [data.chatters]);

  async function load(opts?: {
    preset?: InflowwStatsPreset;
    start?: string;
    end?: string;
    userId?: string;
    performerId?: string;
  }) {
    setLoading(true);
    setError(null);
    try {
      const nextPreset = opts?.preset ?? preset;
      const qp = new URLSearchParams({ preset: nextPreset, includeRoi: "1" });
      if (nextPreset === "custom") {
        qp.set("start", opts?.start ?? customStart);
        qp.set("end", opts?.end ?? customEnd);
      }
      const userId = opts?.userId ?? filterUserId;
      const performerId = opts?.performerId ?? filterPerformerId;
      if (userId) qp.set("userId", userId);
      if (performerId) qp.set("performerId", performerId);
      const res = await fetch(`/api/infloww-stats?${qp.toString()}`);
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || `Failed (${res.status})`);
      }
      const json = (await res.json()) as InflowwAdminPerformanceReport;
      setData(json);
      setPreset(json.range.preset);
      // Only sync draft custom dates when the applied preset is custom —
      // keeps draft stable while flipping This Week / Last Month / etc.
      if (json.range.preset === "custom") {
        setCustomStart(json.range.startYmd);
        setCustomEnd(json.range.endYmd);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  async function syncNow() {
    setSyncing(true);
    setSyncMsg(null);
    setError(null);
    try {
      const startYmd = preset === "custom" ? customStart : data.range.startYmd;
      const endYmd = preset === "custom" ? customEnd : data.range.endYmd;
      const res = await fetch("/api/admin/infloww-stats/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startYmd,
          endYmd,
          publicUserIds: filterUserId ? [filterUserId] : undefined,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        rowsUpserted?: number;
        usersTargeted?: number;
        errors?: Array<{ employeeId: number; message: string; status?: number }>;
      };
      if (!res.ok) throw new Error(body.error || `Sync failed (${res.status})`);
      const errs = body.errors ?? [];
      const errCount = errs.length;
      const detail =
        errCount === 0
          ? ""
          : `: ${errs
              .slice(0, 3)
              .map((e) => `#${e.employeeId}${e.status ? ` (${e.status})` : ""} ${e.message}`)
              .join(" · ")}${errCount > 3 ? ` (+${errCount - 3} more)` : ""}`;
      setSyncMsg(
        `Synced ${body.rowsUpserted ?? 0} rows for ${body.usersTargeted ?? 0} users` +
          (errCount ? ` (${errCount} employee error(s)${detail})` : "")
      );
      if (errCount > 0) {
        setError(
          errs
            .slice(0, 5)
            .map((e) => `Employee ${e.employeeId}: ${e.message}`)
            .join("\n")
        );
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(key === "name" ? "asc" : "desc");
    }
  }

  const sorted = React.useMemo(() => {
    const rows = [...data.chatters];
    const dir = sortDir === "asc" ? 1 : -1;
    rows.sort((a, b) => {
      const av = sortValue(a, sortKey);
      const bv = sortValue(b, sortKey);
      if (typeof av === "string" && typeof bv === "string") return dir * av.localeCompare(bv);
      return dir * (Number(av) - Number(bv));
    });
    return rows;
  }, [data.chatters, sortKey, sortDir]);

  const chartData = sorted.slice(0, 12).map((c) => ({
    name: c.full_name.split(" ")[0] || c.full_name || "?",
    sales: Math.round(c.totals.sales),
  }));

  const effortFlags = data.chatters.filter((c) => c.analytics?.high_effort_low_conversion.flagged);
  const whaleList = (data.whale_suggestions ?? []).filter((w) => !dismissedWhales.has(w.id));

  const teamFunnel = React.useMemo(() => {
    const first = data.chatters[0]?.analytics?.funnel;
    if (!first) {
      return {
        messages: data.team_totals.messages_sent,
        ppvs_sent: data.team_totals.ppvs_sent,
        unlocked: data.team_totals.fans_who_spent,
        revenue: data.team_totals.sales,
        msg_to_ppv_rate:
          data.team_totals.messages_sent > 0
            ? data.team_totals.ppvs_sent / data.team_totals.messages_sent
            : null,
        unlock_rate:
          data.team_totals.ppvs_sent > 0
            ? data.team_totals.fans_who_spent / data.team_totals.ppvs_sent
            : null,
        unlock_data_sparse:
          data.team_totals.fans_who_spent <= 0 && data.team_totals.ppvs_sent > 0,
        notes: [] as string[],
      };
    }
    // Aggregate funnel from team totals
    return {
      messages: data.team_totals.messages_sent,
      ppvs_sent: data.team_totals.ppvs_sent,
      unlocked: data.team_totals.fans_who_spent,
      revenue: data.team_totals.sales,
      msg_to_ppv_rate:
        data.team_totals.messages_sent > 0
          ? data.team_totals.ppvs_sent / data.team_totals.messages_sent
          : null,
      unlock_rate:
        data.team_totals.ppvs_sent > 0
          ? data.team_totals.fans_who_spent / data.team_totals.ppvs_sent
          : null,
      unlock_data_sparse:
        data.team_totals.fans_who_spent <= 0 && data.team_totals.ppvs_sent > 0,
      notes: first.notes,
    };
  }, [data]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"
      >
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#D4AF8C]/80">
            Infloww · Flagship
          </p>
          <h1 className="mt-1 bg-gradient-to-r from-white via-white to-[#FF1493] bg-clip-text text-3xl font-semibold tracking-tight text-transparent md:text-4xl">
            Chatter performance
          </h1>
          <p className="mt-2 text-sm text-white/45">
            {tab === "overview"
              ? `${data.range.startYmd} → ${data.range.endYmd} · ${data.chatters.length} linked chatters`
              : "Custom 4-week month breakdown · rule-based insights"}
          </p>
        </div>
        {tab === "overview" ? (
          <div className="flex flex-col items-start gap-2 sm:items-end">
            <DatePresetBar
              preset={preset}
              loading={loading}
              onSelect={(p) => {
                setPreset(p);
                if (p !== "custom") void load({ preset: p });
              }}
            />
            <button
              type="button"
              disabled={syncing}
              onClick={() => void syncNow()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#D4AF8C]/40 bg-[#D4AF8C]/10 px-3 py-1.5 text-xs font-semibold text-[#D4AF8C] disabled:opacity-50"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", syncing && "animate-spin")} />
              Sync now
            </button>
          </div>
        ) : null}
      </motion.div>

      <div className="flex gap-1 rounded-xl border border-white/10 bg-black/30 p-1">
        {(
          [
            ["overview", "Overview"],
            ["weekly_progress", "Weekly Progress"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              "flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition",
              tab === id
                ? "bg-gradient-to-r from-[#FF1493]/25 to-[#D4AF8C]/15 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                : "text-white/45 hover:text-white/70"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "weekly_progress" ? (
        <AdminWeeklyProgressPanel initial={initialWeekly} linkedUsers={linkedUsers} />
      ) : null}

      {tab === "overview" && preset === "custom" ? (
        <InflowwCustomDateRange
          startYmd={customStart}
          endYmd={customEnd}
          loading={loading}
          onChange={(start, end) => {
            setCustomStart(start);
            setCustomEnd(end);
          }}
          onApply={(start, end) =>
            void load({
              preset: "custom",
              start,
              end,
            })
          }
        />
      ) : null}

      {tab === "overview" ? (
        <>
      <div className={cn(VA_CARD, "flex flex-col gap-3 border border-white/10 bg-white/5 p-4 sm:flex-row sm:flex-wrap sm:items-end")}>
        <label className="w-full text-xs text-white/50 sm:w-auto">
          Chatter
          <select
            value={filterUserId}
            onChange={(e) => setFilterUserId(e.target.value)}
            className="mt-1 block w-full min-w-[10rem] rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
          >
            <option value="">All linked</option>
            {linkedUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name || u.id}
              </option>
            ))}
          </select>
        </label>
        <label className="w-full text-xs text-white/50 sm:w-auto">
          Creator
          <select
            value={filterPerformerId}
            onChange={(e) => setFilterPerformerId(e.target.value)}
            className="mt-1 block w-full min-w-[10rem] rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
          >
            <option value="">All creators</option>
            {performerOptions.map(([id, name]) => (
              <option key={id} value={String(id)}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={loading}
          onClick={() =>
            void load(
              preset === "custom"
                ? {
                    preset: "custom",
                    start: customStart,
                    end: customEnd,
                  }
                : { preset }
            )
          }
          className={cn(VA_BTN_PRIMARY, "w-full px-4 py-2 text-sm disabled:opacity-50 sm:w-auto")}
        >
          Apply filters
        </button>
      </div>

      {error ? (
        <p className="whitespace-pre-wrap rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      ) : null}
      {syncMsg ? (
        <p
          className={
            syncMsg.includes("employee error")
              ? "rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100"
              : "rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200"
          }
        >
          {syncMsg}
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <LuxuryStatCard
          label="Team sales"
          value={<CountUp value={data.team_totals.sales} format={(n) => money(n)} />}
          accent="pink"
          glow
        />
        <LuxuryStatCard
          label="PPV"
          value={<CountUp value={data.team_totals.ppv_sales} format={(n) => money(n)} />}
          accent="champagne"
        />
        <LuxuryStatCard
          label="Messages"
          value={
            <CountUp value={data.team_totals.messages_sent} format={(n) => Math.round(n).toLocaleString()} />
          }
        />
        <LuxuryStatCard label="Fan CVR" value={pct(data.team_totals.fan_cvr)} accent="emerald" />
      </div>

      {(data.alerts?.length ?? 0) > 0 || effortFlags.length > 0 ? (
        <div className={cn(VA_CARD, "border border-white/10 bg-white/5 p-5")}>
          <div className="mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-300" />
            <SectionLabel>Alerts & flags</SectionLabel>
          </div>
          <div className="space-y-2">
            {(data.alerts ?? []).slice(0, 8).map((al) => (
              <div
                key={al.id}
                className={cn(
                  "flex gap-3 rounded-xl border px-3 py-2.5 text-sm",
                  al.severity === "critical" && "border-red-500/35 bg-red-500/10 text-red-100",
                  al.severity === "warning" && "border-amber-500/30 bg-amber-500/10 text-amber-100",
                  al.severity === "info" && "border-white/10 bg-white/5 text-white/70"
                )}
              >
                {al.severity === "critical" ? (
                  <TrendingDown className="mt-0.5 h-4 w-4 shrink-0" />
                ) : (
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                )}
                <div>
                  <p className="font-semibold">{al.title}</p>
                  <p className="text-xs opacity-80">{al.detail}</p>
                </div>
              </div>
            ))}
            {effortFlags.map((c) =>
              data.alerts?.some((a) => a.id === `effort-${c.user_public_id}`) ? null : (
                <div
                  key={`ef-${c.user_uuid}`}
                  className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-100"
                >
                  <Flame className="mr-2 inline h-4 w-4" />
                  <strong>{c.full_name}</strong> — high effort / low conversion
                </div>
              )
            )}
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <ConversionFunnelViz funnel={teamFunnel} />
        <div className={cn(VA_CARD, "border border-white/10 bg-white/5 p-4")}>
          <SectionLabel>Leaderboard</SectionLabel>
          <div className="mt-3 h-64 w-full">
            {chartData.length === 0 ? (
              <p className="flex h-full items-center justify-center text-sm text-white/40">
                No linked chatters with data yet.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} />
                  <YAxis tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      background: "#1a1a1a",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 12,
                    }}
                    formatter={(value) => money(Number(value ?? 0))}
                  />
                  <Bar dataKey="sales" fill="#FF1493" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <div className={cn(VA_CARD, "border border-white/10 bg-white/5 p-5")}>
        <SectionLabel>Chatter × Creator heatmap</SectionLabel>
        <p className="mt-1 mb-3 text-xs text-white/40">Sales intensity by chatter and creator</p>
        <Heatmap cells={data.heatmap ?? []} chatters={data.chatters} />
      </div>

      {whaleList.length > 0 ? (
        <div className={cn(VA_CARD, "border border-[#D4AF8C]/20 bg-white/5 p-5")}>
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[#D4AF8C]" />
            <SectionLabel>Whale candidate suggestions</SectionLabel>
          </div>
          <p className="mb-3 text-xs text-white/40">
            Suggest only — confirm opens the Whales flow. Infloww lacks fan-level IDs; candidates
            come from high-value rebills not yet in Whales.
          </p>
          <div className="space-y-2">
            {whaleList.map((w) => (
              <div
                key={w.id}
                className="flex flex-col gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold text-white">
                    <Sparkles className="mr-1.5 inline h-4 w-4 text-[#D4AF8C]" />
                    {w.label}
                  </p>
                  <p className="text-xs text-white/45">{w.reason}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setDismissedWhales((prev) => new Set(prev).add(w.id))
                    }
                    className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/50 hover:text-white"
                  >
                    Dismiss
                  </button>
                  <a
                    href={`${ROUTES.admin.whales}?suggest=${encodeURIComponent(w.suggested_username ?? w.label)}`}
                    className="rounded-lg border border-[#FF1493]/40 bg-[#FF1493]/15 px-3 py-1.5 text-xs font-semibold text-[#FF1493]"
                  >
                    Confirm → Whales
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {data.rebill_retention ? (
        <div className={cn(VA_CARD, "border border-white/10 bg-white/5 px-4 py-3 text-xs text-white/45")}>
          <strong className="text-white/60">Rebill ↔ sales:</strong>{" "}
          {data.rebill_retention.note}
          {data.rebill_retention.correlation != null
            ? ` (r=${data.rebill_retention.correlation}, n=${data.rebill_retention.sample_size})`
            : ""}
        </div>
      ) : null}

      <div className={cn(VA_CARD, "overflow-hidden border border-white/10 bg-white/5")}>
        <div className="flex flex-wrap gap-2 border-b border-white/8 px-4 py-3">
          {(
            [
              ["name", "Chatter"],
              ["sales", "Sales"],
              ["ppv_sales", "PPV"],
              ["messages_sent", "Msgs"],
              ["fans_chatted", "Fans"],
              ["fan_cvr", "CVR"],
              ["revenue_per_hour", "$/h"],
              ["consistency", "Consist."],
              ["avg_ppv", "Avg PPV"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => toggleSort(key)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider",
                sortKey === key
                  ? "border-[#D4AF8C]/40 text-[#D4AF8C]"
                  : "border-white/10 text-white/45"
              )}
            >
              {label}
              {sortKey === key ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
            </button>
          ))}
        </div>
        {sorted.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-white/40">
            No linked chatters. Add Infloww employee IDs in Accounts → edit user.
          </p>
        ) : (
          sorted.map((row) => (
            <ChatterDrilldown key={row.user_uuid} row={row} showRoi={data.include_roi} />
          ))
        )}
      </div>

      <AdminInflowwEmployeesLookup />
        </>
      ) : null}
    </div>
  );
}
