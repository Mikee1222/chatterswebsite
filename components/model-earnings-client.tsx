"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import {
  CountUp,
  DatePresetBar,
  money,
  StatInfoTooltip,
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
const LineChart = dynamic(() => import("recharts").then((m) => m.LineChart), { ssr: false });
const Line = dynamic(() => import("recharts").then((m) => m.Line), { ssr: false });

type Payload = {
  range: { startYmd: string; endYmd: string; preset: InflowwStatsPreset };
  modelName?: string;
  daily: Array<{
    date: string;
    performance_rank: number | null;
    profile_visitors: number;
    active_fans: number;
    expired_fans: number;
    new_subscribers: number;
    renewals: number;
  }>;
  marketingLinks: Array<{
    id: string;
    link_type: string;
    message: string | null;
    sub_count: number;
    paying_fans_count: number;
    earnings_gross: number;
    earnings_net: number;
  }>;
  totals: {
    gross: number;
    net: number;
    new_subscribers: number;
    renewals: number;
    profile_visitors: number;
  };
  latest: {
    active_fans: number;
    expired_fans: number;
    performance_rank: number | null;
    date: string;
  } | null;
  error?: string;
};

export function ModelEarningsClient({ modelName }: { modelName: string }) {
  const [preset, setPreset] = React.useState<InflowwStatsPreset>("this_month");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [data, setData] = React.useState<Payload | null>(null);

  const load = React.useCallback(async (nextPreset?: InflowwStatsPreset) => {
    setLoading(true);
    setError(null);
    try {
      const p = nextPreset ?? preset;
      const res = await fetch(`/api/model/earnings?preset=${p}`, { cache: "no-store" });
      const json = (await res.json()) as Payload;
      if (!res.ok) throw new Error(json.error ?? "Failed to load");
      setData(json);
      setPreset(json.range.preset);
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

  const subTrend = React.useMemo(
    () =>
      (data?.daily ?? []).map((d) => ({
        date: d.date,
        newSubs: d.new_subscribers,
        renewals: d.renewals,
        visitors: d.profile_visitors,
      })),
    [data?.daily]
  );

  const rankTrend = React.useMemo(
    () =>
      (data?.daily ?? [])
        .filter((d) => d.performance_rank != null)
        .map((d) => ({ date: d.date, rank: d.performance_rank as number })),
    [data?.daily]
  );

  return (
    <div className="space-y-6">
      <div className={cn(VA_CARD, VA_CARD_GLOW, "p-5")}>
        <p className="text-xs font-medium uppercase tracking-wider text-[#D4AF8C]/80">
          {modelName}
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-white">My earnings</h1>
        <p className="mt-1 text-sm text-white/50">
          Your creator account health — revenue, fans, visitors, and marketing links.
        </p>
        <div className="mt-4">
          <DatePresetBar
            preset={preset}
            loading={loading}
            onSelect={(p) => {
              if (p === "custom") return;
              setPreset(p);
              void load(p);
            }}
          />
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: "Gross",
            value: data?.totals.gross ?? 0,
            fmt: (n: number) => money(n, 2),
            tip: "Gross transaction revenue in this period.",
          },
          {
            label: "Net",
            value: data?.totals.net ?? 0,
            fmt: (n: number) => money(n, 2),
            tip: "Net after OnlyFans fees.",
          },
          {
            label: "New subscribers",
            value: data?.totals.new_subscribers ?? 0,
            fmt: (n: number) => String(Math.round(n)),
            tip: "New subscribers across days in this range.",
          },
          {
            label: "Active fans",
            value: data?.latest?.active_fans ?? 0,
            fmt: (n: number) => String(Math.round(n)),
            tip: "Latest active fan count from Infloww.",
          },
        ].map((c) => (
          <div key={c.label} className={cn(VA_CARD, "p-5")}>
            <div className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-white/45">
              {c.label}
              <StatInfoTooltip text={c.tip} />
            </div>
            <p className="mt-3 text-2xl font-semibold text-white">
              <CountUp value={c.value} format={c.fmt} />
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className={cn(VA_CARD, "p-5")}>
          <h2 className="mb-3 text-sm font-semibold text-white/90">Growth</h2>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={subTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} />
                <YAxis tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} />
                <Tooltip
                  contentStyle={{
                    background: "#141214",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 12,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="newSubs"
                  name="New subs"
                  stroke="#FF1493"
                  fill="rgba(255,20,147,0.2)"
                />
                <Area
                  type="monotone"
                  dataKey="visitors"
                  name="Visitors"
                  stroke="#D4AF8C"
                  fill="rgba(212,175,140,0.12)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className={cn(VA_CARD, "p-5")}>
          <div className="mb-3 flex items-center gap-1.5">
            <h2 className="text-sm font-semibold text-white/90">Platform rank</h2>
            <StatInfoTooltip text="Lower % is better (e.g. 3 ≈ top 3%)." />
          </div>
          <div className="h-56">
            {rankTrend.length === 0 ? (
              <p className="py-12 text-center text-sm text-white/40">No rank data yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={rankTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} />
                  <YAxis reversed tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} />
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
      </div>

      <div className={cn(VA_CARD, "overflow-hidden")}>
        <div className="border-b border-white/8 px-5 py-3 text-sm font-semibold text-white/90">
          Your marketing links
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-[11px] uppercase tracking-wider text-white/40">
              <tr>
                <th className="px-5 py-3">Type</th>
                <th className="px-3 py-3">Message</th>
                <th className="px-3 py-3">Paying</th>
                <th className="px-5 py-3">Net</th>
              </tr>
            </thead>
            <tbody>
              {(data?.marketingLinks ?? []).map((l) => (
                <tr key={l.id} className="border-t border-white/6 text-white/80">
                  <td className="px-5 py-3 text-[10px] font-semibold uppercase text-[#D4AF8C]">
                    {l.link_type}
                  </td>
                  <td className="max-w-xs truncate px-3 py-3 text-white/60">{l.message ?? "—"}</td>
                  <td className="px-3 py-3 tabular-nums">{l.paying_fans_count}</td>
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
    </div>
  );
}
