"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { ChevronDown, ChevronRight, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { VA_CARD } from "@/lib/va-tasks-tokens";
import type {
  InflowwAdminPerformanceReport,
  InflowwChatterPerformance,
  InflowwStatsPreset,
} from "@/services/infloww-performance";
import { AdminInflowwEmployeesLookup } from "@/components/admin-infloww-employees-lookup";

const PRESETS: { id: InflowwStatsPreset; label: string }[] = [
  { id: "this_week", label: "This Week" },
  { id: "last_week", label: "Last Week" },
  { id: "this_month", label: "This Month" },
  { id: "custom", label: "Custom" },
];

type SortKey = "sales" | "ppv_sales" | "tips" | "messages_sent" | "fans_chatted" | "fan_cvr" | "name";

const Bar = dynamic(() => import("recharts").then((m) => m.Bar), { ssr: false });
const BarChart = dynamic(() => import("recharts").then((m) => m.BarChart), { ssr: false });
const CartesianGrid = dynamic(() => import("recharts").then((m) => m.CartesianGrid), { ssr: false });
const ResponsiveContainer = dynamic(() => import("recharts").then((m) => m.ResponsiveContainer), {
  ssr: false,
});
const Tooltip = dynamic(() => import("recharts").then((m) => m.Tooltip), { ssr: false });
const XAxis = dynamic(() => import("recharts").then((m) => m.XAxis), { ssr: false });
const YAxis = dynamic(() => import("recharts").then((m) => m.YAxis), { ssr: false });

function money(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function pct(n: number | null): string {
  if (n == null) return "—";
  return `${(n * 100).toFixed(1)}%`;
}

function StatChip({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={cn(VA_CARD, "p-4")}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35">{label}</p>
      <p className={cn("mt-1 text-2xl font-semibold tabular-nums", accent ? "text-[#FF1493]" : "text-white")}>
        {value}
      </p>
    </div>
  );
}

function ChatterRow({ row }: { row: InflowwChatterPerformance }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="border-b border-white/6 last:border-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.03]"
      >
        {open ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-[#D4AF8C]" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-white/35" />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">{row.full_name || "Unknown"}</p>
          <p className="text-xs text-white/40">
            Emp {row.infloww_employee_id} · {row.totals.messages_sent} msgs · CVR{" "}
            {pct(row.totals.fan_cvr)}
          </p>
        </div>
        <p className="text-sm font-semibold tabular-nums text-[#FF1493]">{money(row.totals.sales)}</p>
      </button>
      {open ? (
        <div className="space-y-3 border-t border-white/6 bg-black/20 px-4 py-4">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <StatChip label="PPV" value={money(row.totals.ppv_sales)} />
            <StatChip label="Tips" value={money(row.totals.tips)} />
            <StatChip label="Fans chatted" value={String(row.totals.fans_chatted)} />
            <StatChip label="PPVs sent" value={String(row.totals.ppvs_sent)} />
          </div>
          {row.by_performer.length > 0 ? (
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35">
                Creators
              </p>
              <div className="space-y-1">
                {row.by_performer.map((p) => (
                  <div
                    key={p.performer_id}
                    className="flex items-center justify-between rounded-lg border border-white/8 px-3 py-2 text-sm"
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

export function AdminInflowwPerformanceClient({
  initial,
  linkedUsers,
}: {
  initial: InflowwAdminPerformanceReport;
  linkedUsers: Array<{ id: string; name: string; employeeId: number }>;
}) {
  const [data, setData] = React.useState(initial);
  const [preset, setPreset] = React.useState<InflowwStatsPreset>(initial.range.preset);
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
      const qp = new URLSearchParams({ preset: nextPreset });
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
      setCustomStart(json.range.startYmd);
      setCustomEnd(json.range.endYmd);
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
      const res = await fetch("/api/admin/infloww-stats/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startYmd: customStart,
          endYmd: customEnd,
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
      if (sortKey === "name") return dir * a.full_name.localeCompare(b.full_name);
      if (sortKey === "fan_cvr") {
        const av = a.totals.fan_cvr ?? -1;
        const bv = b.totals.fan_cvr ?? -1;
        return dir * (av - bv);
      }
      return dir * (a.totals[sortKey] - b.totals[sortKey]);
    });
    return rows;
  }, [data.chatters, sortKey, sortDir]);

  const chartData = sorted.slice(0, 12).map((c) => ({
    name: c.full_name.split(" ")[0] || c.full_name || "?",
    sales: Math.round(c.totals.sales),
  }));

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#D4AF8C]/80">
            Infloww
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-white">Chatter performance</h1>
          <p className="mt-1 text-sm text-white/45">
            {data.range.startYmd} → {data.range.endYmd} · {data.chatters.length} linked chatters
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              disabled={loading}
              onClick={() => {
                setPreset(p.id);
                if (p.id !== "custom") void load({ preset: p.id });
              }}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                preset === p.id
                  ? "border-[#FF1493]/50 bg-[#FF1493]/15 text-[#FF1493]"
                  : "border-white/10 bg-white/5 text-white/60 hover:border-white/20 hover:text-white"
              )}
            >
              {p.label}
            </button>
          ))}
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
      </div>

      <div className={cn(VA_CARD, "flex flex-wrap items-end gap-3 p-4")}>
        <label className="text-xs text-white/50">
          From
          <input
            type="date"
            value={customStart}
            onChange={(e) => setCustomStart(e.target.value)}
            className="mt-1 block rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
          />
        </label>
        <label className="text-xs text-white/50">
          To
          <input
            type="date"
            value={customEnd}
            onChange={(e) => setCustomEnd(e.target.value)}
            className="mt-1 block rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
          />
        </label>
        <label className="text-xs text-white/50">
          Chatter
          <select
            value={filterUserId}
            onChange={(e) => setFilterUserId(e.target.value)}
            className="mt-1 block min-w-[10rem] rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
          >
            <option value="">All linked</option>
            {linkedUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name || u.id}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-white/50">
          Creator
          <select
            value={filterPerformerId}
            onChange={(e) => setFilterPerformerId(e.target.value)}
            className="mt-1 block min-w-[10rem] rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
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
            void load({
              preset: "custom",
              start: customStart,
              end: customEnd,
            })
          }
          className="rounded-lg bg-[#FF1493] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          Apply
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
        <StatChip label="Team sales" value={money(data.team_totals.sales)} accent />
        <StatChip label="PPV" value={money(data.team_totals.ppv_sales)} />
        <StatChip label="Messages" value={String(data.team_totals.messages_sent)} />
        <StatChip label="Fan CVR" value={pct(data.team_totals.fan_cvr)} />
      </div>

      <div className={cn(VA_CARD, "p-4")}>
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35">
          Leaderboard (top 12)
        </p>
        <div className="h-64 w-full">
          {chartData.length === 0 ? (
            <p className="flex h-full items-center justify-center text-sm text-white/40">
              No linked chatters with data yet. Set Infloww employee IDs on accounts, then Sync now.
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

      <div className={cn(VA_CARD, "overflow-hidden")}>
        <div className="flex flex-wrap gap-2 border-b border-white/8 px-4 py-3">
          {(
            [
              ["name", "Chatter"],
              ["sales", "Sales"],
              ["ppv_sales", "PPV"],
              ["messages_sent", "Msgs"],
              ["fans_chatted", "Fans"],
              ["fan_cvr", "CVR"],
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
          sorted.map((row) => <ChatterRow key={row.user_uuid} row={row} />)
        )}
      </div>

      <AdminInflowwEmployeesLookup />
    </div>
  );
}
