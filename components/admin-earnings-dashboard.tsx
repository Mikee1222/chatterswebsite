"use client";

import * as React from "react";
import { DayPicker, DateRange } from "react-day-picker";
import "react-day-picker/dist/style.css";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";
import { useToast } from "@/contexts/toast-context";
import type { AppNotification } from "@/types";
import type { InflowwEarningsResponse } from "@/types/infloww";

function localToast(
  id: string,
  title: string,
  body: string,
  priority: "normal" | "high"
): AppNotification {
  return {
    id,
    user_id: "local-user",
    event_type: "SYSTEM_ALERT",
    title,
    body,
    entity_type: "system",
    priority,
    read: false,
    created_at: new Date().toISOString(),
  };
}

function toIsoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function money(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n || 0);
}

type SortKey = "gross_earnings" | "net_earnings" | "agency_cut";

export function AdminEarningsDashboard({
  initialFrom,
  initialTo,
}: {
  initialFrom: string;
  initialTo: string;
}) {
  const { addToast } = useToast();
  const [from, setFrom] = React.useState(initialFrom);
  const [to, setTo] = React.useState(initialTo);
  const [modelId, setModelId] = React.useState("");
  const [showPicker, setShowPicker] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [data, setData] = React.useState<InflowwEarningsResponse | null>(null);
  const [sortBy, setSortBy] = React.useState<SortKey>("gross_earnings");

  const dateRange: DateRange = React.useMemo(
    () => ({
      from: from ? new Date(`${from}T00:00:00`) : undefined,
      to: to ? new Date(`${to}T00:00:00`) : undefined,
    }),
    [from, to]
  );

  const loadData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qp = new URLSearchParams({ from, to });
      if (modelId) qp.set("modelId", modelId);
      const res = await fetch(`/api/infloww/earnings?${qp.toString()}`, { cache: "no-store" });
      const payload = (await res.json()) as InflowwEarningsResponse & { error?: string };
      if (!res.ok) throw new Error(payload.error ?? "Failed to load earnings.");
      setData(payload);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load earnings.";
      setError(msg);
      addToast(localToast(`infloww-load-${Date.now()}`, "Could not load earnings", msg, "high"));
    } finally {
      setLoading(false);
    }
  }, [addToast, from, to, modelId]);

  React.useEffect(() => {
    void loadData();
  }, [loadData]);

  const byModel = React.useMemo(() => {
    const rows = (data?.earnings ?? []).slice();
    rows.sort((a, b) => b[sortBy] - a[sortBy]);
    return rows;
  }, [data?.earnings, sortBy]);

  const trend = React.useMemo(() => {
    const grouped = new Map<string, { date: string; gross: number; net: number; cut: number }>();
    for (const row of data?.earnings ?? []) {
      const d = row.date.slice(0, 10);
      const existing = grouped.get(d) ?? { date: d, gross: 0, net: 0, cut: 0 };
      existing.gross += row.gross_earnings;
      existing.net += row.net_earnings;
      existing.cut += row.agency_cut;
      grouped.set(d, existing);
    }
    return Array.from(grouped.values()).sort((a, b) => a.date.localeCompare(b.date)).slice(-30);
  }, [data?.earnings]);

  const topPerformers = React.useMemo(() => byModel.slice(0, 5), [byModel]);

  function onDateRangeSelect(nextRange?: DateRange) {
    if (!nextRange?.from || !nextRange?.to) return;
    setFrom(toIsoDate(nextRange.from));
    setTo(toIsoDate(nextRange.to));
    setShowPicker(false);
  }

  function exportCsv() {
    if (!byModel.length) return;
    const header = ["model_id", "model_name", "gross_earnings", "net_earnings", "agency_cut", "date"];
    const rows = byModel.map((r) =>
      [r.model_id, r.model_name, r.gross_earnings, r.net_earnings, r.agency_cut, r.date].join(",")
    );
    const csv = [header.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `infloww-earnings-${from}-to-${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    addToast(localToast(`infloww-export-${Date.now()}`, "CSV exported", "Earnings file downloaded.", "normal"));
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-lg border border-white/20 bg-black/20 px-3 py-2 text-sm text-white"
              onClick={() => setShowPicker((s) => !s)}
            >
              {from} to {to}
            </button>
            <select
              value={modelId}
              onChange={(e) => setModelId(e.target.value)}
              className="rounded-lg border border-white/20 bg-black/20 px-3 py-2 text-sm text-white"
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
              onClick={() => void loadData()}
              disabled={loading}
              className="rounded-lg bg-fuchsia-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {loading ? "Loading..." : "Refresh"}
            </button>
          </div>
          <button
            type="button"
            onClick={exportCsv}
            disabled={!byModel.length}
            className="rounded-lg border border-emerald-400/40 bg-emerald-500/20 px-3 py-2 text-sm font-semibold text-emerald-200 disabled:opacity-50"
          >
            Export CSV
          </button>
        </div>
        {showPicker ? (
          <div className="mt-3 rounded-xl bg-black/30 p-3">
            <DayPicker mode="range" selected={dateRange} onSelect={onDateRangeSelect} numberOfMonths={1} />
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-wide text-white/60">Gross earnings</p>
          <p className="mt-2 text-2xl font-semibold text-white">{money(data?.totals.gross ?? 0)}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-wide text-white/60">Net earnings</p>
          <p className="mt-2 text-2xl font-semibold text-white">{money(data?.totals.net ?? 0)}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-wide text-white/60">Agency cut</p>
          <p className="mt-2 text-2xl font-semibold text-white">{money(data?.totals.cut ?? 0)}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <h2 className="mb-3 text-sm font-semibold text-white">Earnings trend (last 30 days)</h2>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.12)" />
              <XAxis dataKey="date" stroke="rgba(255,255,255,0.6)" />
              <YAxis stroke="rgba(255,255,255,0.6)" />
              <Tooltip />
              <Legend />
              <Area type="monotone" dataKey="gross" stroke="#f472b6" fill="#f472b633" />
              <Area type="monotone" dataKey="net" stroke="#22d3ee" fill="#22d3ee33" />
              <Area type="monotone" dataKey="cut" stroke="#fbbf24" fill="#fbbf2433" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold text-white">Earnings by model</h2>
          <div className="overflow-auto">
            <table className="min-w-full text-sm text-white/90">
              <thead className="text-left text-white/60">
                <tr>
                  <th className="pb-2 pr-3">Model</th>
                  <th className="pb-2 pr-3">
                    <button type="button" onClick={() => setSortBy("gross_earnings")}>
                      Gross
                    </button>
                  </th>
                  <th className="pb-2 pr-3">
                    <button type="button" onClick={() => setSortBy("net_earnings")}>
                      Net
                    </button>
                  </th>
                  <th className="pb-2 pr-3">
                    <button type="button" onClick={() => setSortBy("agency_cut")}>
                      Agency cut
                    </button>
                  </th>
                  <th className="pb-2">Date</th>
                </tr>
              </thead>
              <tbody>
                {byModel.map((row) => (
                  <tr key={`${row.model_id}-${row.date}`} className="border-t border-white/10">
                    <td className="py-2 pr-3">{row.model_name}</td>
                    <td className="py-2 pr-3">{money(row.gross_earnings)}</td>
                    <td className="py-2 pr-3">{money(row.net_earnings)}</td>
                    <td className="py-2 pr-3">{money(row.agency_cut)}</td>
                    <td className="py-2">{row.date.slice(0, 10)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!byModel.length && !loading ? (
            <p className="mt-3 text-sm text-white/60">No earnings found for this filter.</p>
          ) : null}
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <h2 className="mb-3 text-sm font-semibold text-white">Top performers</h2>
          <ol className="space-y-2 text-sm">
            {topPerformers.map((row, i) => (
              <li key={`${row.model_id}-${i}`} className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2">
                <span className="truncate pr-3 text-white/85">
                  #{i + 1} {row.model_name}
                </span>
                <span className="font-semibold text-emerald-300">{money(row.net_earnings)}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}
    </div>
  );
}
