"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/form";
import { adminShiftActivityUrl } from "@/lib/routes";
import { isoToEuropeanDisplay, parseEuropeanDateInput } from "@/lib/format";

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
  totalChatterHours: number;
  totalVaHours: number;
  totalShifts: number;
  totalBreakMinutes: number;
};

function formatHours(hrs: number): string {
  const h = Math.floor(hrs);
  const m = Math.round((hrs - h) * 60);
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function AdminShiftActivityClient(props: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  /** Current week Monday–Sunday in YYYY-MM-DD for default custom range. */
  const defaultCustomRange = React.useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const mon = new Date(d);
    mon.setDate(diff);
    const sun = new Date(mon);
    sun.setDate(sun.getDate() + 6);
    const ymd = (x: Date) => x.toISOString().slice(0, 10);
    return { from: ymd(mon), to: ymd(sun) };
  }, []);

  const fromIso = props.from ?? defaultCustomRange.from;
  const toIso = props.to ?? defaultCustomRange.to;
  const [fromDisplay, setFromDisplay] = React.useState(() => isoToEuropeanDisplay(fromIso));
  const [toDisplay, setToDisplay] = React.useState(() => isoToEuropeanDisplay(toIso));
  React.useEffect(() => {
    setFromDisplay(isoToEuropeanDisplay(props.from ?? defaultCustomRange.from));
    setToDisplay(isoToEuropeanDisplay(props.to ?? defaultCustomRange.to));
  }, [props.from, props.to, defaultCustomRange.from, defaultCustomRange.to]);

  const setRange = (range: string, from?: string, to?: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("range", range);
    if (range === "custom") {
      const fromVal = from ?? searchParams.get("from") ?? defaultCustomRange.from;
      const toVal = to ?? searchParams.get("to") ?? defaultCustomRange.to;
      params.set("from", fromVal);
      params.set("to", toVal);
    } else {
      if (from) params.set("from", from);
      else params.delete("from");
      if (to) params.set("to", to);
      else params.delete("to");
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
        {props.range === "custom" && (
          <div className="flex items-center gap-2">
            <Input
              type="text"
              inputMode="numeric"
              placeholder="dd/mm/yyyy"
              value={fromDisplay}
              onChange={(e) => setFromDisplay(e.target.value)}
              onBlur={() => {
                const iso = parseEuropeanDateInput(fromDisplay);
                if (iso) setRange("custom", iso, toIso);
                else setFromDisplay(isoToEuropeanDisplay(fromIso));
              }}
              className="min-w-0 max-w-[8rem]"
            />
            <span className="text-white/50">→</span>
            <Input
              type="text"
              inputMode="numeric"
              placeholder="dd/mm/yyyy"
              value={toDisplay}
              onChange={(e) => setToDisplay(e.target.value)}
              onBlur={() => {
                const iso = parseEuropeanDateInput(toDisplay);
                if (iso) setRange("custom", fromIso, iso);
                else setToDisplay(isoToEuropeanDisplay(toIso));
              }}
              className="min-w-0 max-w-[8rem]"
            />
          </div>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="glass-card p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-white/50">Total chatter hours</p>
          <p className="mt-2 text-2xl font-semibold text-[hsl(330,90%,75%)]">
            {typeof props.totalChatterHours !== "number" || Number.isNaN(props.totalChatterHours)
              ? "—"
              : formatHours(props.totalChatterHours)}
          </p>
        </div>
        <div className="glass-card p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-white/50">Total VA hours</p>
          <p className="mt-2 text-2xl font-semibold text-white">
            {typeof props.totalVaHours !== "number" || Number.isNaN(props.totalVaHours)
              ? "—"
              : formatHours(props.totalVaHours)}
          </p>
        </div>
        <div className="glass-card p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-white/50">Total shifts</p>
          <p className="mt-2 text-2xl font-semibold text-white">
            {typeof props.totalShifts !== "number" ? "—" : props.totalShifts}
          </p>
        </div>
        <div className="glass-card p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-white/50">Total break time</p>
          <p className="mt-2 text-2xl font-semibold text-white">
            {typeof props.totalBreakMinutes !== "number" ? "—" : `${props.totalBreakMinutes} min`}
          </p>
        </div>
      </div>

      {/* Mobile: stacked cards */}
      <ul className="space-y-3 md:hidden">
        {props.rows.length === 0 ? (
          <li className="rounded-xl border border-white/10 bg-white/5 p-6 text-center text-sm text-white/50">No shifts in range</li>
        ) : (
          [...props.rows]
            .sort((a, b) => b.totalMinutes - a.totalMinutes)
            .map((row, i) => (
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
            {props.rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-white/50">No shifts in range</td>
              </tr>
            ) : (
              props.rows
                .sort((a, b) => b.totalMinutes - a.totalMinutes)
                .map((row, i) => (
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
        </table>
      </div>
    </div>
  );
}
