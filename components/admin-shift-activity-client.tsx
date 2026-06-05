"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
  rows: Row[];
  chatterRows: Row[];
  vaRows: Row[];
  totalChatterHours: number;
  totalVaHours: number;
  totalShifts: number;
  totalBreakMinutes: number;
  avgShiftDurationMinutes: number;
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

  const setRange = (range: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("range", range);
    if (range !== "custom") {
      params.delete("from");
      params.delete("to");
    }
    router.push(adminShiftActivityUrl(Object.fromEntries(params.entries())));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-white md:text-2xl">Shift activity</h1>
        <p className="mt-1 text-sm text-white/60">Hours and activity reporting for chatters and virtual assistants.</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-xl border border-white/10 bg-white/5 p-1">
          {(["daily", "weekly", "monthly", "custom"] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={`rounded-lg px-4 py-2 text-sm font-medium capitalize ${
                props.range === r ? "bg-[hsl(330,80%,55%)]/20 text-[hsl(330,90%,65%)]" : "text-white/70 hover:bg-white/5 hover:text-white"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {props.range === "custom" && (
        <div className="flex items-center gap-3 mt-3">
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
            className="mt-5 h-9 px-4 rounded-lg bg-pink-500/80 text-sm text-white hover:bg-pink-500 disabled:opacity-40"
          >
            Apply
          </button>
        </div>
      )}

      <div className="flex gap-1 rounded-xl border border-white/10 bg-white/5 p-1 w-fit">
        {(["all", "chatters", "vas"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setRoleFilter(f)}
            className={
              roleFilter === f
                ? "rounded-lg bg-pink-500/20 text-pink-300 px-4 py-1.5 text-sm font-medium capitalize"
                : "px-4 py-1.5 text-sm text-white/50 hover:text-white capitalize"
            }
          >
            {f === "all" ? "All" : f === "chatters" ? "Chatters" : "VAs"}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="glass-card p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-white/50">Total Chatter Hours</p>
          <p className="mt-2 text-2xl font-semibold text-[hsl(330,90%,75%)]">
            {typeof props.totalChatterHours !== "number" || Number.isNaN(props.totalChatterHours)
              ? "—"
              : formatHours(props.totalChatterHours)}
          </p>
        </div>
        <div className="glass-card p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-white/50">Total VA Hours</p>
          <p className="mt-2 text-2xl font-semibold text-white">
            {typeof props.totalVaHours !== "number" || Number.isNaN(props.totalVaHours)
              ? "—"
              : formatHours(props.totalVaHours)}
          </p>
        </div>
        <div className="glass-card p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-white/50">Total Shifts</p>
          <p className="mt-2 text-2xl font-semibold text-white">
            {typeof props.totalShifts !== "number" ? "—" : props.totalShifts}
          </p>
        </div>
        <div className="glass-card p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-white/50">Total Break Time</p>
          <p className="mt-2 text-2xl font-semibold text-white">
            {typeof props.totalBreakMinutes !== "number" ? "—" : `${props.totalBreakMinutes} min`}
          </p>
        </div>
        <div className="glass-card p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-white/50">Avg shift duration</p>
          <p className="mt-2 text-2xl font-semibold text-white">
            {props.totalShifts > 0 ? formatMinutes(props.avgShiftDurationMinutes) : "—"}
          </p>
        </div>
      </div>

      {/* Mobile: stacked cards */}
      <ul className="space-y-3 md:hidden">
        {displayRows.length === 0 ? (
          <li className="rounded-xl border border-white/10 bg-white/5 p-6 text-center text-sm text-white/50">No shifts in range</li>
        ) : (
          displayRows.map((row, i) => (
            <li key={i} className="rounded-xl border border-white/10 bg-white/[0.06] p-4">
              <div className="flex items-start justify-between gap-2">
                <span className="font-medium text-white/90">{row.name}</span>
                <span
                  className={
                    row.role === "Chatter"
                      ? "rounded-full border border-[hsl(330,80%,55%)]/30 bg-[hsl(330,80%,55%)]/15 px-2 py-0.5 text-xs text-[hsl(330,90%,75%)]"
                      : "rounded-full border border-sky-500/30 bg-sky-500/15 px-2 py-0.5 text-xs text-sky-300"
                  }
                >
                  {row.role}
                </span>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-sm text-white/80">
                <dt className="text-white/50">Total hours</dt>
                <dd>{formatHours(row.totalMinutes / 60)}</dd>
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
              <th className="p-3 font-medium">Shifts</th>
              <th className="p-3 font-medium">Break (min)</th>
              <th className="p-3 font-medium">Avg shift</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {displayRows.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-white/50">
                  No shifts in range
                </td>
              </tr>
            ) : (
              displayRows.map((row, i) => (
                <tr key={i} className="hover:bg-white/[0.03]">
                  <td className="p-3 font-medium text-white/90">{row.name}</td>
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
                <td className="p-3">{summary.shifts}</td>
                <td className="p-3">{summary.breakMinutes}</td>
                <td className="p-3">
                  {summary.shifts > 0 ? formatMinutes(summary.totalMinutes / summary.shifts) : "—"}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
