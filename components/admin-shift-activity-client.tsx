"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Activity, Clock, Coffee } from "lucide-react";
import { adminShiftActivityUrl } from "@/lib/routes";

type Row = {
  name: string;
  role: string;
  totalMinutes: number;
  shifts: number;
  breakMinutes: number;
  avgDurationMinutes: number;
};

type Props = {
  range: string;
  from?: string;
  to?: string;
  rangeStartFormatted: string;
  rangeEndFormatted: string;
  rows: Row[];
  chatterRows: Row[];
  vaRows: Row[];
};

function formatHours(hrs: number): string {
  const h = Math.floor(hrs);
  const m = Math.round((hrs - h) * 60);
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function formatMinutes(totalMinutes: number): string {
  return formatHours(totalMinutes / 60);
}

function ProgressBar({ value, max, className = "h-2" }: { value: number; max: number; className?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className={`overflow-hidden rounded-full bg-white/10 ${className}`}>
      <div className="h-full rounded-full bg-[hsl(330,80%,55%)]/80 transition-all" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function AdminShiftActivityClient(props: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [roleFilter, setRoleFilter] = React.useState<"all" | "chatters" | "vas">("all");
  const [customFrom, setCustomFrom] = React.useState(props.from ?? "");
  const [customTo, setCustomTo] = React.useState(props.to ?? "");

  React.useEffect(() => {
    setCustomFrom(props.from ?? "");
    setCustomTo(props.to ?? "");
  }, [props.from, props.to]);

  const displayRows = React.useMemo(() => {
    let filtered: Row[];
    if (roleFilter === "chatters") filtered = props.chatterRows;
    else if (roleFilter === "vas") filtered = props.vaRows;
    else filtered = props.rows;
    return [...filtered].sort((a, b) => b.totalMinutes - a.totalMinutes);
  }, [roleFilter, props.rows, props.chatterRows, props.vaRows]);

  const maxMinutes = React.useMemo(
    () => (displayRows.length > 0 ? Math.max(...displayRows.map((r) => r.totalMinutes)) : 0),
    [displayRows]
  );

  const summary = React.useMemo(
    () =>
      displayRows.reduce(
        (acc, r) => ({
          totalMinutes: acc.totalMinutes + r.totalMinutes,
          shifts: acc.shifts + r.shifts,
          breakMinutes: acc.breakMinutes + r.breakMinutes,
        }),
        { totalMinutes: 0, shifts: 0, breakMinutes: 0 }
      ),
    [displayRows]
  );

  const kpiTotalMinutes = summary.totalMinutes;
  const kpiShifts = summary.shifts;
  const kpiBreakMinutes = summary.breakMinutes;
  const kpiAvgMinutes = summary.shifts > 0 ? summary.totalMinutes / summary.shifts : 0;

  const chatterMinutes = React.useMemo(
    () => props.chatterRows.reduce((s, r) => s + r.totalMinutes, 0),
    [props.chatterRows]
  );
  const vaMinutes = React.useMemo(
    () => props.vaRows.reduce((s, r) => s + r.totalMinutes, 0),
    [props.vaRows]
  );

  const hoursLabel =
    roleFilter === "chatters" ? "Chatter hours" : roleFilter === "vas" ? "VA hours" : "Total hours";
  const hoursSubtitle =
    roleFilter === "all"
      ? `${formatMinutes(chatterMinutes)} chatters · ${formatMinutes(vaMinutes)} VAs`
      : roleFilter === "chatters"
        ? `${displayRows.length} chatter${displayRows.length === 1 ? "" : "s"}`
        : `${displayRows.length} VA${displayRows.length === 1 ? "" : "s"}`;

  const setRange = (range: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("range", range);
    if (range !== "custom") {
      params.delete("from");
      params.delete("to");
    }
    router.push(adminShiftActivityUrl(Object.fromEntries(params.entries())));
  };

  const kpiCards = [
    {
      key: "hours",
      label: hoursLabel,
      value: formatMinutes(kpiTotalMinutes),
      subtitle: hoursSubtitle,
      Icon: Clock,
      accent: "border-l-[hsl(330,80%,55%)]",
      iconBg: "bg-[hsl(330,80%,55%)]/15 text-[hsl(330,90%,75%)]",
      valueClass: "text-[hsl(330,90%,75%)]",
    },
    {
      key: "shifts",
      label: "Total shifts",
      value: String(kpiShifts),
      subtitle: "Completed in range",
      Icon: Activity,
      accent: "border-l-sky-400",
      iconBg: "bg-sky-500/15 text-sky-300",
      valueClass: "text-white",
    },
    {
      key: "break",
      label: "Break time",
      value: `${kpiBreakMinutes} min`,
      subtitle: "Across all shifts",
      Icon: Coffee,
      accent: "border-l-amber-400",
      iconBg: "bg-amber-500/15 text-amber-300",
      valueClass: "text-white",
    },
    {
      key: "avg",
      label: "Avg shift duration",
      value: kpiShifts > 0 ? formatMinutes(kpiAvgMinutes) : "—",
      subtitle: "Per shift average",
      Icon: Clock,
      accent: "border-l-violet-400",
      iconBg: "bg-violet-500/15 text-violet-300",
      valueClass: "text-white",
    },
  ] as const;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-white md:text-2xl">Shift activity</h1>
        <p className="mt-1 text-sm text-white/60">Hours and activity reporting for chatters and virtual assistants.</p>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          {(["daily", "weekly", "monthly", "custom"] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={`rounded-full border px-4 py-2 text-sm font-medium capitalize transition ${
                props.range === r
                  ? "border-[hsl(330,80%,55%)]/40 bg-[hsl(330,80%,55%)]/20 text-[hsl(330,90%,65%)]"
                  : "border-white/10 text-white/60 hover:border-white/20 hover:bg-white/5 hover:text-white"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
        <p className="text-sm text-white/50">
          {props.rangeStartFormatted} — {props.rangeEndFormatted}
        </p>
      </div>

      {props.range === "custom" && (
        <div className="mt-3 flex items-center gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-white/50">From</label>
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="h-9 rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-white"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-white/50">To</label>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="h-9 rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-white"
            />
          </div>
          <button
            type="button"
            onClick={() => {
              if (customFrom && customTo) {
                router.push(adminShiftActivityUrl({ range: "custom", from: customFrom, to: customTo }));
              }
            }}
            disabled={!customFrom || !customTo}
            className="mt-5 h-9 rounded-lg bg-pink-500/80 px-4 text-sm text-white hover:bg-pink-500 disabled:opacity-40"
          >
            Apply
          </button>
        </div>
      )}

      <div className="flex w-fit gap-1 rounded-xl border border-white/10 bg-white/5 p-1">
        {(["all", "chatters", "vas"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setRoleFilter(f)}
            className={
              roleFilter === f
                ? "rounded-lg bg-pink-500/20 px-4 py-1.5 text-sm font-medium capitalize text-pink-300"
                : "px-4 py-1.5 text-sm capitalize text-white/50 hover:text-white"
            }
          >
            {f === "all" ? "All" : f === "chatters" ? "Chatters" : "VAs"}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {kpiCards.map((card) => (
          <div key={card.key} className={`glass-card border-l-4 p-5 ${card.accent}`}>
            <div className="flex items-start gap-3">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${card.iconBg}`}>
                <card.Icon className="h-5 w-5" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium uppercase tracking-wider text-white/50">{card.label}</p>
                <p className={`mt-1 text-2xl font-semibold tabular-nums ${card.valueClass}`}>{card.value}</p>
                <p className="mt-0.5 truncate text-xs text-white/45">{card.subtitle}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Mobile: stacked cards */}
      <ul className="space-y-3 md:hidden">
        {displayRows.length === 0 ? (
          <li className="rounded-xl border border-white/10 bg-white/5 p-8 text-center">
            <Activity className="mx-auto h-8 w-8 text-white/25" aria-hidden />
            <p className="mt-3 text-sm text-white/50">No shifts in range</p>
          </li>
        ) : (
          displayRows.map((row, i) => (
            <li key={i} className="rounded-xl border border-white/10 bg-white/[0.06] p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-semibold tabular-nums text-white/50">
                    {i + 1}
                  </span>
                  <span className="truncate font-medium text-white/90">{row.name}</span>
                </div>
                <span
                  className={
                    row.role === "Chatter"
                      ? "shrink-0 rounded-full border border-[hsl(330,80%,55%)]/30 bg-[hsl(330,80%,55%)]/15 px-2 py-0.5 text-xs text-[hsl(330,90%,75%)]"
                      : "shrink-0 rounded-full border border-sky-500/30 bg-sky-500/15 px-2 py-0.5 text-xs text-sky-300"
                  }
                >
                  {row.role}
                </span>
              </div>
              <div className="mt-3">
                <div className="mb-1 flex items-center justify-between text-xs text-white/50">
                  <span>Total hours</span>
                  <span className="font-medium text-white/80">{formatHours(row.totalMinutes / 60)}</span>
                </div>
                <ProgressBar value={row.totalMinutes} max={maxMinutes} className="h-1.5" />
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-sm text-white/80">
                <dt className="text-white/50">Shifts</dt>
                <dd>{row.shifts}</dd>
                <dt className="text-white/50">Break</dt>
                <dd>{row.breakMinutes} min</dd>
                <dt className="text-white/50">Avg shift</dt>
                <dd>{formatHours(row.avgDurationMinutes / 60)}</dd>
              </dl>
            </li>
          ))
        )}
      </ul>

      {/* Desktop: table */}
      <div className="glass-card hidden overflow-hidden md:block">
        <table className="w-full text-sm">
          <thead className="border-b border-white/10 bg-black/40 text-left text-xs font-medium uppercase tracking-wider text-white/50">
            <tr>
              <th className="p-3 font-medium">Name</th>
              <th className="p-3 font-medium">Role</th>
              <th className="p-3 font-medium">Total hours</th>
              <th className="p-3 font-medium">Progress</th>
              <th className="p-3 font-medium">Shifts</th>
              <th className="p-3 font-medium">Break (min)</th>
              <th className="p-3 font-medium">Avg shift</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {displayRows.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-10 text-center">
                  <Activity className="mx-auto h-8 w-8 text-white/25" aria-hidden />
                  <p className="mt-3 text-white/50">No shifts in range</p>
                </td>
              </tr>
            ) : (
              displayRows.map((row, i) => (
                <tr key={i} className="hover:bg-white/[0.03]">
                  <td className="p-3 font-medium text-white/90">
                    <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-xs font-semibold tabular-nums text-white/50">
                      {i + 1}
                    </span>
                    {row.name}
                  </td>
                  <td className="p-3">
                    <span
                      className={
                        row.role === "Chatter"
                          ? "rounded-full border border-[hsl(330,80%,55%)]/30 bg-[hsl(330,80%,55%)]/15 px-2 py-0.5 text-[hsl(330,90%,75%)]"
                          : "rounded-full border border-sky-500/30 bg-sky-500/15 px-2 py-0.5 text-sky-300"
                      }
                    >
                      {row.role}
                    </span>
                  </td>
                  <td className="p-3 text-white/90">{formatHours(row.totalMinutes / 60)}</td>
                  <td className="p-3">
                    <div className="min-w-[80px] max-w-[140px]">
                      <ProgressBar value={row.totalMinutes} max={maxMinutes} />
                    </div>
                  </td>
                  <td className="p-3 text-white/80">{row.shifts}</td>
                  <td className="p-3 text-white/80">{row.breakMinutes}</td>
                  <td className="p-3 text-white/80">{formatHours(row.avgDurationMinutes / 60)}</td>
                </tr>
              ))
            )}
          </tbody>
          {displayRows.length > 0 && (
            <tfoot className="border-t border-white/10 bg-black/30 text-sm font-medium text-white/90">
              <tr>
                <td className="p-3" colSpan={2}>
                  Total
                </td>
                <td className="p-3">{formatHours(summary.totalMinutes / 60)}</td>
                <td className="p-3" />
                <td className="p-3">{summary.shifts}</td>
                <td className="p-3">{summary.breakMinutes}</td>
                <td className="p-3">{summary.shifts > 0 ? formatMinutes(summary.totalMinutes / summary.shifts) : "—"}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
