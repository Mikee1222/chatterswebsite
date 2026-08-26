"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { AlertTriangle, RefreshCw, Sparkles } from "lucide-react";
import { ApplicationFormTabs } from "@/components/application-form-tabs";
import {
  CountUp,
  LuxuryStatCard,
  SectionLabel,
} from "@/components/infloww-performance-ui";
import { APPLY_SECTION } from "@/lib/application-ui-tokens";
import {
  APPLICATION_FUNNEL_STAGE_LABELS,
  type ApplicationLinkAnalyticsSummary,
} from "@/lib/application-link-analytics-types";
import type { ApplicationFormWithQuestions } from "@/lib/application-forms-types";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { useReducedMotion, motion } from "framer-motion";

const ResponsiveContainer = dynamic(
  () => import("recharts").then((m) => m.ResponsiveContainer),
  { ssr: false },
);
const AreaChart = dynamic(() => import("recharts").then((m) => m.AreaChart), { ssr: false });
const Area = dynamic(() => import("recharts").then((m) => m.Area), { ssr: false });
const XAxis = dynamic(() => import("recharts").then((m) => m.XAxis), { ssr: false });
const YAxis = dynamic(() => import("recharts").then((m) => m.YAxis), { ssr: false });
const Tooltip = dynamic(() => import("recharts").then((m) => m.Tooltip), { ssr: false });
const CartesianGrid = dynamic(() => import("recharts").then((m) => m.CartesianGrid), {
  ssr: false,
});
const PieChart = dynamic(() => import("recharts").then((m) => m.PieChart), { ssr: false });
const Pie = dynamic(() => import("recharts").then((m) => m.Pie), { ssr: false });
const Cell = dynamic(() => import("recharts").then((m) => m.Cell), { ssr: false });

type Props = {
  form: ApplicationFormWithQuestions;
  canManage: boolean;
};

type Preset = ApplicationLinkAnalyticsSummary["range"]["preset"];

const PRESETS: { id: Preset; label: string }[] = [
  { id: "7d", label: "7d" },
  { id: "30d", label: "30d" },
  { id: "90d", label: "90d" },
  { id: "all", label: "All" },
];

const FUNNEL_COLORS = ["#D4AF8C", "#E879B8", "#FF1493", "#F472B6", "#FB7185", "#FF1493"];

const DEVICE_COLORS: Record<string, string> = {
  mobile: "#FF1493",
  desktop: "#D4AF8C",
  tablet: "#E879B8",
  unknown: "rgba(255,255,255,0.25)",
};

const CHART_TOOLTIP = {
  backgroundColor: "rgba(12,10,14,0.95)",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 12,
  fontSize: 12,
};

function formatDuration(seconds: number | null): string {
  if (seconds == null) return "—";
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) return s > 0 ? `${m}m ${s}s` : `${m}m`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm > 0 ? `${h}h ${rm}m` : `${h}h`;
}

function formatGeneratedAt(iso: string | null): string {
  if (!iso) return "Never";
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function ApplicationFunnelChart({
  funnel,
}: {
  funnel: ApplicationLinkAnalyticsSummary["funnel"];
}) {
  const reduce = useReducedMotion();
  const max = Math.max(1, ...funnel.map((s) => s.count));

  return (
    <div className={cn(APPLY_SECTION, "p-5")}>
      <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">
            Conversion funnel
          </p>
          <p className="mt-1 text-sm text-white/50">
            View → Started → Cognitive → EQ → Typing → Form Submitted
          </p>
        </div>
      </div>
      <div className="space-y-3">
        {funnel.map((s, i) => {
          const widthPct = Math.max(8, (s.count / max) * 100);
          const color = FUNNEL_COLORS[i % FUNNEL_COLORS.length]!;
          return (
            <div key={s.key}>
              <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                <span className="text-white/55">{s.label}</span>
                <span className="flex items-center gap-2 tabular-nums">
                  <span className="font-semibold text-white">
                    {s.count.toLocaleString()}
                  </span>
                  {s.drop_off_pct != null && i > 0 ? (
                    <span className="text-[10px] text-white/35">
                      −{s.drop_off_pct}% drop
                    </span>
                  ) : null}
                </span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-white/5">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: `linear-gradient(90deg, ${color}99, ${color})` }}
                  initial={reduce ? false : { width: 0 }}
                  animate={{ width: `${widthPct}%` }}
                  transition={{ duration: 0.7, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function AdminApplicationAnalyticsClient({ form, canManage }: Props) {
  const [preset, setPreset] = useState<Preset>("30d");
  const [granularity, setGranularity] = useState<"day" | "week">("day");
  const [data, setData] = useState<ApplicationLinkAnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [insightBusy, setInsightBusy] = useState(false);
  const [insightError, setInsightError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/application-forms/${encodeURIComponent(form.id)}/analytics?preset=${preset}&granularity=${granularity}`,
        { credentials: "include" },
      );
      const json = (await res.json().catch(() => ({}))) as {
        analytics?: ApplicationLinkAnalyticsSummary;
        error?: string;
      };
      if (!res.ok) throw new Error(json.error || "Failed to load analytics");
      setData(json.analytics ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [form.id, preset, granularity]);

  useEffect(() => {
    void load();
  }, [load]);

  async function refreshInsight() {
    if (!canManage) return;
    setInsightBusy(true);
    setInsightError(null);
    try {
      const res = await fetch(
        `/api/admin/application-forms/${encodeURIComponent(form.id)}/analytics/insights`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ preset }),
        },
      );
      const json = (await res.json().catch(() => ({}))) as {
        insight?: ApplicationLinkAnalyticsSummary["insight"];
        error?: string;
      };
      if (!res.ok) throw new Error(json.error || "Refresh failed");
      setData((prev) =>
        prev && json.insight
          ? { ...prev, insight: { ...json.insight, stale: false } }
          : prev,
      );
    } catch (e) {
      setInsightError(e instanceof Error ? e.message : "Refresh failed");
    } finally {
      setInsightBusy(false);
    }
  }

  const totals = data?.totals;
  const deviceTotal = data?.devices.reduce((s, d) => s + d.count, 0) ?? 0;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            href={ROUTES.admin.applicationForms}
            className="text-xs text-white/40 hover:text-white/70"
          >
            ← Applications
          </Link>
          <div className="mt-3">
            <SectionLabel>Link analytics</SectionLabel>
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            {form.title}
          </h1>
          <p className="mt-1 text-sm text-white/45">
            Funnel, traffic, devices, and AI insights for /apply/{form.slug}
          </p>
          <ApplicationFormTabs
            formId={form.id}
            active="analytics"
            responseCount={form.response_count}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl border border-white/10 bg-white/[0.03] p-1">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPreset(p.id)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-medium transition",
                  preset === p.id
                    ? "bg-[#FF1493]/20 text-[#FF1493]"
                    : "text-white/50 hover:text-white/80",
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="inline-flex rounded-xl border border-white/10 bg-white/[0.03] p-1">
            {(["day", "week"] as const).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGranularity(g)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition",
                  granularity === g
                    ? "bg-[#D4AF8C]/20 text-[#D4AF8C]"
                    : "text-white/50 hover:text-white/80",
                )}
              >
                {g === "day" ? "Daily" : "Weekly"}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/12 bg-white/[0.03] px-3 py-2 text-xs text-white/70 transition hover:border-[#D4AF8C]/35 hover:text-[#D4AF8C] disabled:opacity-40"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            Refresh
          </button>
        </div>
      </div>

      {error ? (
        <div className="mt-6 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      {/* AI insight — prominent top card */}
      <div
        className={cn(
          APPLY_SECTION,
          "relative mt-6 overflow-hidden border-[#D4AF8C]/25 bg-gradient-to-br from-[#D4AF8C]/10 via-white/[0.03] to-[#FF1493]/10 p-5 sm:p-6",
        )}
      >
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-[#D4AF8C]/15 blur-3xl" />
        <div className="relative flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#D4AF8C]/30 bg-[#D4AF8C]/15">
              <Sparkles className="h-4 w-4 text-[#D4AF8C]" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#D4AF8C]/80">
                AI smart insights
              </p>
              <p className="mt-1 text-xs text-white/40">
                Grounded in real funnel numbers ·{" "}
                {data?.insight.generated_at
                  ? `Updated ${formatGeneratedAt(data.insight.generated_at)}`
                  : "Not generated yet"}
                {data?.insight.stale ? " · stale (>24h)" : ""}
              </p>
            </div>
          </div>
          {canManage ? (
            <button
              type="button"
              disabled={insightBusy || loading}
              onClick={() => void refreshInsight()}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-[#D4AF8C]/35 bg-[#D4AF8C]/15 px-3 py-2 text-xs font-semibold text-[#D4AF8C] transition hover:bg-[#D4AF8C]/25 disabled:opacity-40"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", insightBusy && "animate-spin")} />
              {data?.insight.text ? "Refresh insight" : "Generate insight"}
            </button>
          ) : null}
        </div>
        {insightError ? (
          <p className="relative mt-3 text-sm text-rose-300">{insightError}</p>
        ) : null}
        {data?.insight.text ? (
          <p className="relative mt-4 text-sm leading-relaxed text-white/80">
            {data.insight.text}
          </p>
        ) : (
          <p className="relative mt-4 text-sm text-white/45">
            {canManage
              ? "Generate a natural-language summary of this funnel. Cached for 24h — refresh anytime."
              : "No insight cached yet. Ask someone with manage access to generate one."}
          </p>
        )}
      </div>

      {/* Stat cards */}
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <LuxuryStatCard
          label="Total Views"
          accent="champagne"
          value={
            loading ? "…" : <CountUp value={totals?.views ?? 0} />
          }
        />
        <LuxuryStatCard
          label="Started"
          accent="pink"
          value={
            loading ? "…" : <CountUp value={totals?.started ?? 0} />
          }
        />
        <LuxuryStatCard
          label="Completed"
          accent="emerald"
          value={
            loading ? "…" : <CountUp value={totals?.completed ?? 0} />
          }
        />
        <LuxuryStatCard
          label="Completion Rate"
          accent="amber"
          value={
            loading
              ? "…"
              : totals?.completion_rate_pct != null ? (
                  <CountUp
                    value={totals.completion_rate_pct}
                    format={(n) => `${n.toFixed(1)}%`}
                  />
                ) : (
                  "—"
                )
          }
          hint="Started → submitted"
        />
        <LuxuryStatCard
          label="Avg Time"
          accent="white"
          className="col-span-2 lg:col-span-1"
          value={loading ? "…" : formatDuration(totals?.avg_time_to_complete_seconds ?? null)}
          hint="Started → submitted"
        />
      </div>

      {/* Most lossy callout */}
      {data?.most_lossy_step && data.most_lossy_step.lost > 0 ? (
        <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
          <div className="text-sm text-amber-100/90">
            <span className="font-semibold">Biggest drop-off: </span>
            {APPLICATION_FUNNEL_STAGE_LABELS[data.most_lossy_step.from]} →{" "}
            {APPLICATION_FUNNEL_STAGE_LABELS[data.most_lossy_step.to]} — lost{" "}
            {data.most_lossy_step.lost.toLocaleString()} sessions (
            {data.most_lossy_step.drop_off_pct}% drop).
          </div>
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          {data ? (
            <ApplicationFunnelChart funnel={data.funnel} />
          ) : (
            <div className={cn(APPLY_SECTION, "flex h-64 items-center justify-center p-5 text-sm text-white/35")}>
              {loading ? "Loading funnel…" : "No funnel data"}
            </div>
          )}
        </div>

        <div className={cn(APPLY_SECTION, "p-5 lg:col-span-2")}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">
            Device breakdown
          </p>
          <p className="mt-1 text-sm text-white/50">Mobile vs desktop</p>
          {data && deviceTotal > 0 ? (
            <div className="mt-2">
              <div className="h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.devices.map((d) => ({
                        name: d.device,
                        value: d.count,
                      }))}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={48}
                      outerRadius={70}
                      paddingAngle={data.devices.length > 1 ? 3 : 0}
                      stroke="rgba(10,10,16,0.9)"
                      strokeWidth={2}
                    >
                      {data.devices.map((d) => (
                        <Cell
                          key={d.device}
                          fill={DEVICE_COLORS[d.device] ?? "rgba(255,255,255,0.25)"}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={CHART_TOOLTIP}
                      formatter={(v, name) => [
                        `${Number(v).toLocaleString()} (${
                          deviceTotal > 0
                            ? ((Number(v) / deviceTotal) * 100).toFixed(0)
                            : 0
                        }%)`,
                        String(name),
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="mt-1 space-y-1.5">
                {data.devices.map((d) => (
                  <li
                    key={d.device}
                    className="flex items-center justify-between text-xs capitalize"
                  >
                    <span className="flex items-center gap-2 text-white/65">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{
                          background: DEVICE_COLORS[d.device] ?? "rgba(255,255,255,0.25)",
                        }}
                      />
                      {d.device}
                    </span>
                    <span className="tabular-nums text-white/85">
                      {d.pct}% · {d.count.toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="mt-8 text-center text-sm text-white/35">
              {loading ? "Loading…" : "No device data yet"}
            </p>
          )}
        </div>
      </div>

      {/* Time series */}
      <div className={cn(APPLY_SECTION, "mt-4 p-5")}>
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">
              Traffic over time
            </p>
            <p className="mt-1 text-sm text-white/50">
              Views & applications ({granularity === "day" ? "daily" : "weekly"})
            </p>
          </div>
        </div>
        {data && data.time_series.points.length > 0 ? (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.time_series.points}>
                <defs>
                  <linearGradient id="viewsFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#D4AF8C" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="#D4AF8C" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="appsFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#FF1493" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="#FF1493" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip contentStyle={CHART_TOOLTIP} />
                <Area
                  type="monotone"
                  dataKey="views"
                  name="Views"
                  stroke="#D4AF8C"
                  fill="url(#viewsFill)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="applications"
                  name="Applications"
                  stroke="#FF1493"
                  fill="url(#appsFill)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="flex h-40 items-center justify-center text-sm text-white/35">
            {loading ? "Loading chart…" : "No traffic in this range yet"}
          </p>
        )}
      </div>
    </div>
  );
}
