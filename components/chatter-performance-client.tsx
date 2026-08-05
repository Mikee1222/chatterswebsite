"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { Link2Off } from "lucide-react";
import { cn } from "@/lib/utils";
import { VA_CARD } from "@/lib/va-tasks-tokens";
import type {
  InflowwChatterPerformance,
  InflowwStatsPreset,
} from "@/services/infloww-performance";

const PRESETS: { id: InflowwStatsPreset; label: string }[] = [
  { id: "this_week", label: "This Week" },
  { id: "last_week", label: "Last Week" },
  { id: "this_month", label: "This Month" },
  { id: "custom", label: "Custom" },
];

const Area = dynamic(() => import("recharts").then((m) => m.Area), { ssr: false });
const AreaChart = dynamic(() => import("recharts").then((m) => m.AreaChart), { ssr: false });
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

function StatChip({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: "pink" | "champagne" | "emerald";
}) {
  const color =
    accent === "pink"
      ? "text-[#FF1493]"
      : accent === "champagne"
        ? "text-[#D4AF8C]"
        : accent === "emerald"
          ? "text-emerald-400"
          : "text-white";
  return (
    <div className={cn(VA_CARD, "p-4")}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35">{label}</p>
      <p className={cn("mt-1 text-2xl font-semibold tabular-nums", color)}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-white/40">{hint}</p> : null}
    </div>
  );
}

export function ChatterPerformanceClient({ initial }: { initial: InflowwChatterPerformance }) {
  const [data, setData] = React.useState(initial);
  const [preset, setPreset] = React.useState<InflowwStatsPreset>(initial.range.preset);
  const [customStart, setCustomStart] = React.useState(initial.range.startYmd);
  const [customEnd, setCustomEnd] = React.useState(initial.range.endYmd);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function load(nextPreset: InflowwStatsPreset, start?: string, end?: string) {
    setLoading(true);
    setError(null);
    try {
      const qp = new URLSearchParams({ preset: nextPreset });
      if (nextPreset === "custom") {
        qp.set("start", start ?? customStart);
        qp.set("end", end ?? customEnd);
      }
      const res = await fetch(`/api/infloww-stats?${qp.toString()}`);
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || `Failed (${res.status})`);
      }
      const json = (await res.json()) as InflowwChatterPerformance;
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

  if (!data.linked) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <div className={cn(VA_CARD, "flex flex-col items-center gap-4 p-10 text-center")}>
          <div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-white/5">
            <Link2Off className="h-6 w-6 text-[#D4AF8C]" />
          </div>
          <h1 className="text-xl font-semibold text-white">My Performance</h1>
          <p className="max-w-md text-sm leading-relaxed text-white/55">
            Your Infloww account isn&apos;t linked yet — contact your admin
          </p>
        </div>
      </div>
    );
  }

  const t = data.totals;

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#D4AF8C]/80">
            Infloww
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-white">My Performance</h1>
          <p className="mt-1 text-sm text-white/45">
            {data.range.startYmd} → {data.range.endYmd}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              disabled={loading}
              onClick={() => {
                setPreset(p.id);
                if (p.id !== "custom") void load(p.id);
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
        </div>
      </div>

      {preset === "custom" ? (
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
          <button
            type="button"
            disabled={loading}
            onClick={() => void load("custom", customStart, customEnd)}
            className="rounded-lg bg-[#FF1493] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            Apply
          </button>
        </div>
      ) : null}

      {error ? (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatChip label="Total sales" value={money(t.sales)} accent="pink" />
        <StatChip label="PPV sales" value={money(t.ppv_sales)} accent="champagne" />
        <StatChip label="Tips" value={money(t.tips)} />
        <StatChip label="DM sales" value={money(t.dm_sales)} />
        <StatChip label="Messages sent" value={String(t.messages_sent)} />
        <StatChip label="PPVs sent" value={String(t.ppvs_sent)} />
        <StatChip label="Fans chatted" value={String(t.fans_chatted)} accent="emerald" />
        <StatChip label="Fan CVR" value={pct(t.fan_cvr)} hint={`Golden ratio ${pct(t.golden_ratio)}`} />
      </div>

      <div className={cn(VA_CARD, "p-4")}>
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35">
          Sales trend
        </p>
        <div className="h-64 w-full">
          {data.daily.length === 0 ? (
            <p className="flex h-full items-center justify-center text-sm text-white/40">
              No synced data for this range yet.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.daily}>
                <defs>
                  <linearGradient id="perfSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#FF1493" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="#FF1493" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="ymd" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} />
                <YAxis tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    background: "#1a1a1a",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 12,
                  }}
                  formatter={(value) => money(Number(value ?? 0))}
                />
                <Area
                  type="monotone"
                  dataKey="sales"
                  stroke="#FF1493"
                  fill="url(#perfSales)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className={cn(VA_CARD, "overflow-hidden")}>
        <div className="border-b border-white/8 px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35">
            Per creator
          </p>
        </div>
        {data.by_performer.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-white/40">No creator breakdown yet.</p>
        ) : (
          <div className="divide-y divide-white/6">
            {data.by_performer.map((p) => (
              <div key={p.performer_id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">{p.performer_name}</p>
                  <p className="text-xs text-white/40">
                    {p.totals.messages_sent} msgs · {p.totals.fans_chatted} fans · CVR{" "}
                    {pct(p.totals.fan_cvr)}
                  </p>
                </div>
                <p className="text-sm font-semibold tabular-nums text-[#FF1493]">
                  {money(p.totals.sales)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
