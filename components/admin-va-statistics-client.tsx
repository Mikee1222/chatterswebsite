"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { ChevronDown, ChevronRight, Trophy, Timer } from "lucide-react";
import { cn } from "@/lib/utils";
import { VA_CARD, VA_TASKS } from "@/lib/va-tasks-tokens";
import { FindingCard } from "@/components/manager-review-ui";
import type {
  VaPerUserStatistics,
  VaStatisticsPreset,
  VaStatisticsReport,
} from "@/services/va-statistics";
import type { CategoryTimeStat, VaCategoryTimeStat } from "@/services/task-category-timer";

const PRESETS: { id: VaStatisticsPreset; label: string }[] = [
  { id: "this_week", label: "This Week" },
  { id: "last_week", label: "Last Week" },
  { id: "this_month", label: "This Month" },
  { id: "last_month", label: "Last Month" },
  { id: "custom", label: "Custom" },
];
const Bar = dynamic(() => import("recharts").then((m) => m.Bar), { ssr: false });
const BarChart = dynamic(() => import("recharts").then((m) => m.BarChart), { ssr: false });
const CartesianGrid = dynamic(() => import("recharts").then((m) => m.CartesianGrid), { ssr: false });
const Line = dynamic(() => import("recharts").then((m) => m.Line), { ssr: false });
const LineChart = dynamic(() => import("recharts").then((m) => m.LineChart), { ssr: false });
const ResponsiveContainer = dynamic(() => import("recharts").then((m) => m.ResponsiveContainer), { ssr: false });
const Tooltip = dynamic(() => import("recharts").then((m) => m.Tooltip), { ssr: false });
const XAxis = dynamic(() => import("recharts").then((m) => m.XAxis), { ssr: false });
const YAxis = dynamic(() => import("recharts").then((m) => m.YAxis), { ssr: false });

type SortMetric = "completion_rate" | "hours" | "tasks_done" | "on_time_rate";

function pct(n: number | null | undefined): string {
  if (n == null) return "—";
  return `${n}%`;
}

function hoursLabel(n: number | null | undefined): string {
  if (n == null) return "—";
  return `${n}h`;
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
  accent?: "pink" | "champagne" | "emerald" | "amber";
}) {
  const color =
    accent === "pink"
      ? "text-[#FF1493]"
      : accent === "champagne"
        ? "text-[#D4AF8C]"
        : accent === "emerald"
          ? "text-emerald-400"
          : accent === "amber"
            ? "text-amber-300"
            : "text-white";
  return (
    <div className={cn(VA_CARD, "p-4")}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35">{label}</p>
      <p className={cn("mt-1 text-2xl font-semibold tabular-nums", color)}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-white/40">{hint}</p> : null}
    </div>
  );
}

function VaDetailCard({ row }: { row: VaPerUserStatistics }) {
  const [open, setOpen] = React.useState(false);
  return (
    <FindingCard className="overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 p-4 text-left"
      >
        {open ? <ChevronDown className="h-4 w-4 text-[#D4AF8C]" /> : <ChevronRight className="h-4 w-4 text-white/40" />}
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold text-white">{row.va_name}</p>
          <p className="text-xs text-white/40">
            {row.tasks.completed}/{row.tasks.assigned} tasks · {pct(row.tasks.completion_rate)} complete ·{" "}
            {hoursLabel(row.shifts.total_hours)} worked
          </p>
        </div>
        <span
          className={cn(
            "rounded-full border px-2.5 py-1 text-xs font-semibold tabular-nums",
            (row.tasks.completion_rate ?? 0) >= 80
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
              : (row.tasks.completion_rate ?? 0) >= 70
                ? "border-[#D4AF8C]/30 bg-[#D4AF8C]/10 text-[#D4AF8C]"
                : "border-amber-500/30 bg-amber-500/10 text-amber-300",
          )}
        >
          {pct(row.tasks.completion_rate)}
        </span>
      </button>
      {open ? (
        <div className="space-y-4 border-t border-white/8 px-4 pb-4 pt-3">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatChip label="Assigned" value={String(row.tasks.assigned)} />
            <StatChip label="Completed" value={String(row.tasks.completed)} accent="emerald" />
            <StatChip label="Overdue / missed" value={String(row.tasks.overdue_or_missed)} accent="amber" />
            <StatChip
              label="Avg completion"
              value={row.tasks.avg_completion_hours != null ? `${row.tasks.avg_completion_hours}h` : "Unavailable"}
              hint={
                row.tasks.avg_completion_sample_size > 0
                  ? `n=${row.tasks.avg_completion_sample_size}`
                  : "Needs created_at + completed_at"
              }
            />
            <StatChip
              label="Screenshot compliance"
              value={pct(row.tasks.screenshot_compliance_rate)}
              hint={`${row.tasks.screenshot_provided}/${row.tasks.screenshot_required}`}
              accent="champagne"
            />
            <StatChip label="Shifts" value={String(row.shifts.shifts)} />
            <StatChip label="Hours" value={hoursLabel(row.shifts.total_hours)} accent="pink" />
            <StatChip
              label="On-time rate"
              value={pct(row.shifts.on_time_rate)}
              hint={`${row.shifts.late_starts} late · ${row.shifts.no_shows} no-show · ${row.shifts.break_exceeded} break exceeded`}
            />
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-white/35">By step type</p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              {row.tasks.by_step_type.map((s) => (
                <div key={s.step_type} className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2">
                  <p className="text-[11px] text-white/45">{s.step_type}</p>
                  <p className="text-sm font-semibold text-white">
                    {s.completed}/{s.total} · {pct(s.completion_rate)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </FindingCard>
  );
}

function fmtSeconds(s: number | null | undefined): string {
  if (s == null) return "—";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem > 0 ? `${h}h ${rem}m` : `${h}h`;
}

type CategoryTimeStats = { by_category: CategoryTimeStat[]; by_va: VaCategoryTimeStat[] };

export function AdminVaStatisticsClient({ initialReport }: { initialReport: VaStatisticsReport }) {
  const [preset, setPreset] = React.useState<VaStatisticsPreset>(initialReport.range.preset);
  const [customStart, setCustomStart] = React.useState(initialReport.range.startYmd);
  const [customEnd, setCustomEnd] = React.useState(initialReport.range.endYmd);
  const [report, setReport] = React.useState(initialReport);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [sortMetric, setSortMetric] = React.useState<SortMetric>("completion_rate");
  const [timeStats, setTimeStats] = React.useState<CategoryTimeStats | null>(null);
  const [timeStatsLoading, setTimeStatsLoading] = React.useState(false);

  const loadTimeStats = React.useCallback(async (start: string, end: string) => {
    setTimeStatsLoading(true);
    try {
      const params = new URLSearchParams({ start, end });
      const res = await fetch(`/api/admin/category-time-stats?${params}`, { credentials: "include", cache: "no-store" });
      const d = (await res.json().catch(() => ({}))) as { stats?: CategoryTimeStats };
      if (d.stats) setTimeStats(d.stats);
    } catch {
      // silently fail — time stats are supplemental
    } finally {
      setTimeStatsLoading(false);
    }
  }, []);

  const load = React.useCallback(async (nextPreset: VaStatisticsPreset, start: string, end: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ preset: nextPreset });
      if (nextPreset === "custom") {
        params.set("start", start);
        params.set("end", end);
      }
      const res = await fetch(`/api/admin/va-statistics?${params.toString()}`, {
        credentials: "include",
        cache: "no-store",
      });
      const data = (await res.json().catch(() => ({}))) as { report?: VaStatisticsReport; error?: string };
      if (!res.ok || !data.report) throw new Error(data.error || "Failed to load statistics");
      setReport(data.report);
      setCustomStart(data.report.range.startYmd);
      setCustomEnd(data.report.range.endYmd);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  // Load category time stats whenever the report range changes
  React.useEffect(() => {
    void loadTimeStats(report.range.startYmd, report.range.endYmd);
  }, [report.range.startYmd, report.range.endYmd, loadTimeStats]);

  const ranked = React.useMemo(() => {
    const rows = [...report.by_va];
    rows.sort((a, b) => {
      const av =
        sortMetric === "completion_rate"
          ? a.tasks.completion_rate ?? -1
          : sortMetric === "hours"
            ? a.shifts.total_hours
            : sortMetric === "tasks_done"
              ? a.tasks.completed
              : a.shifts.on_time_rate ?? -1;
      const bv =
        sortMetric === "completion_rate"
          ? b.tasks.completion_rate ?? -1
          : sortMetric === "hours"
            ? b.shifts.total_hours
            : sortMetric === "tasks_done"
              ? b.tasks.completed
              : b.shifts.on_time_rate ?? -1;
      return bv - av;
    });
    return rows;
  }, [report.by_va, sortMetric]);

  const chartData = report.team.daily.map((d) => ({
    day: d.ymd.slice(5),
    completion:
      d.assigned_tasks > 0 ? Math.round((d.completed_tasks / d.assigned_tasks) * 1000) / 10 : 0,
    hours: d.hours_worked,
  }));

  return (
    <div className="space-y-8" style={{ color: VA_TASKS.bodyText }}>
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#D4AF8C]/70">Team analytics</p>
        <h1 className="text-2xl font-semibold tracking-tight text-white md:text-3xl">VA Statistics</h1>
        <p className="max-w-2xl text-sm text-white/50">
          Historical task and shift performance across virtual assistants — coaching insights for the selected
          range (distinct from the single-day Progress Overview).
        </p>
      </header>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              disabled={loading}
              onClick={() => {
                setPreset(p.id);
                if (p.id !== "custom") void load(p.id, customStart, customEnd);
              }}
              className={cn(
                "rounded-xl border px-3 py-2 text-xs font-semibold transition",
                preset === p.id
                  ? "border-[#FF1493]/40 bg-[#FF1493]/15 text-[#FF1493]"
                  : "border-white/10 bg-white/5 text-white/50 hover:bg-white/10",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        {preset === "custom" ? (
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs text-white/40">
              From
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="mt-1 block rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white [color-scheme:dark]"
              />
            </label>
            <label className="text-xs text-white/40">
              To
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="mt-1 block rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white [color-scheme:dark]"
              />
            </label>
            <button
              type="button"
              disabled={loading}
              onClick={() => void load("custom", customStart, customEnd)}
              className="rounded-xl border border-[#D4AF8C]/35 bg-[#D4AF8C]/15 px-4 py-2 text-xs font-semibold text-[#D4AF8C]"
            >
              Apply
            </button>
          </div>
        ) : null}
        <p className="text-xs text-white/35">
          {report.range.startYmd} → {report.range.endYmd}
          {loading ? " · Loading…" : ""}
        </p>
      </div>

      {error ? (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>
      ) : null}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-6">
        <StatChip label="VAs active" value={String(report.team.va_count)} accent="champagne" />
        <StatChip
          label="Team completion"
          value={pct(report.team.tasks.completion_rate)}
          hint={`${report.team.tasks.completed}/${report.team.tasks.assigned}`}
          accent="pink"
        />
        <StatChip
          label="Avg VA completion"
          value={pct(report.team.avg_completion_rate)}
          hint={`${report.team.vas_below_70_pct} below 70%`}
        />
        <StatChip label="Hours worked" value={hoursLabel(report.team.shifts.total_hours)} accent="emerald" />
        <StatChip label="No-shows" value={String(report.team.shifts.no_shows)} accent="amber" />
        <StatChip
          label="Screenshot compliance"
          value={pct(report.team.tasks.screenshot_compliance_rate)}
          hint={`${report.team.tasks.screenshot_provided}/${report.team.tasks.screenshot_required}`}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <FindingCard className="p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-white/40">
            Completion rate trend
          </p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" vertical={false} />
                <XAxis dataKey="day" tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  unit="%"
                />
                <Tooltip
                  contentStyle={{
                    background: "#151315",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 12,
                    color: "#fff",
                  }}
                />
                <Line type="monotone" dataKey="completion" stroke="#FF1493" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </FindingCard>
        <FindingCard className="p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-white/40">Hours worked</p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" vertical={false} />
                <XAxis dataKey="day" tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    background: "#151315",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 12,
                    color: "#fff",
                  }}
                />
                <Bar dataKey="hours" fill="#D4AF8C" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </FindingCard>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-[#D4AF8C]" />
            <h2 className="text-lg font-semibold text-white">Performance ranking</h2>
          </div>
          <select
            value={sortMetric}
            onChange={(e) => setSortMetric(e.target.value as SortMetric)}
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white"
          >
            <option value="completion_rate">Completion rate</option>
            <option value="hours">Hours worked</option>
            <option value="tasks_done">Tasks completed</option>
            <option value="on_time_rate">On-time starts</option>
          </select>
        </div>
        <p className="text-xs text-white/40">
          Admin coaching view — factual ranking for the selected range. Team average completion:{" "}
          {pct(report.team.avg_completion_rate)}.
        </p>
        <div className="overflow-hidden rounded-2xl border border-white/10">
          <table className="w-full text-sm">
            <thead className="bg-white/[0.04] text-left text-xs uppercase tracking-wide text-white/40">
              <tr>
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">VA</th>
                <th className="px-4 py-3">Completion</th>
                <th className="px-4 py-3">Tasks</th>
                <th className="px-4 py-3">Hours</th>
                <th className="px-4 py-3">On-time</th>
              </tr>
            </thead>
            <tbody>
              {ranked.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-white/40">
                    No VA activity in this range.
                  </td>
                </tr>
              ) : (
                ranked.map((row, i) => (
                  <tr key={row.va_id} className="border-t border-white/5">
                    <td className="px-4 py-3 tabular-nums text-white/40">{i + 1}</td>
                    <td className="px-4 py-3 font-medium text-white">{row.va_name}</td>
                    <td className="px-4 py-3 tabular-nums text-[#FF1493]">{pct(row.tasks.completion_rate)}</td>
                    <td className="px-4 py-3 tabular-nums text-white/70">
                      {row.tasks.completed}/{row.tasks.assigned}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-[#D4AF8C]">{hoursLabel(row.shifts.total_hours)}</td>
                    <td className="px-4 py-3 tabular-nums text-white/70">{pct(row.shifts.on_time_rate)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-white">Per-VA breakdown</h2>
        <div className="space-y-3">
          {report.by_va.length === 0 ? (
            <p className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-8 text-center text-white/40">
              No task or shift data for this range.
            </p>
          ) : (
            report.by_va.map((row) => <VaDetailCard key={row.va_id} row={row} />)
          )}
        </div>
      </section>

      {/* Category time section */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Timer className="h-4 w-4 text-[#D4AF8C]/70" />
          <h2 className="text-lg font-semibold text-white">Category Time Tracking</h2>
          {timeStatsLoading ? <span className="text-xs text-white/30">Loading…</span> : null}
        </div>

        {!timeStats || (timeStats.by_category.every((c) => c.total_sessions === 0)) ? (
          <p className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-8 text-center text-sm text-white/40">
            No timed task sessions for this range.{" "}
            <a href="/admin/task-timer-config" className="text-[#D4AF8C]/70 underline underline-offset-2 hover:text-[#D4AF8C]">
              Enable categories in Timer Config.
            </a>
          </p>
        ) : (
          <div className="space-y-5">
            {/* Overall averages */}
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-white/35">Team averages</p>
              <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
                {timeStats.by_category.filter((c) => c.total_sessions > 0).map((c) => (
                  <div key={c.category} className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2">
                    <p className="text-[11px] text-white/45">{c.category}</p>
                    <p className="text-sm font-semibold text-white">{fmtSeconds(c.avg_seconds)}</p>
                    <p className="text-[10px] text-white/30">{c.total_sessions} sessions</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Per-VA breakdown */}
            {timeStats.by_va.length > 0 ? (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-white/35">Per-VA averages</p>
                <div className="overflow-hidden rounded-2xl border border-white/10">
                  <table className="w-full text-sm">
                    <thead className="bg-white/[0.04] text-left text-xs uppercase tracking-wide text-white/40">
                      <tr>
                        <th className="px-4 py-3">VA</th>
                        {timeStats.by_category.filter((c) => c.total_sessions > 0).map((c) => (
                          <th key={c.category} className="px-4 py-3">{c.category}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {timeStats.by_va.map((va) => (
                        <tr key={va.va_id} className="border-t border-white/5">
                          <td className="px-4 py-3 font-medium text-white">{va.va_name}</td>
                          {timeStats.by_category.filter((c) => c.total_sessions > 0).map((c) => {
                            const s = va.by_category.find((b) => b.category === c.category);
                            return (
                              <td key={c.category} className="px-4 py-3 tabular-nums text-[#D4AF8C]">
                                {s && s.total_sessions > 0 ? fmtSeconds(s.avg_seconds) : <span className="text-white/25">—</span>}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}
