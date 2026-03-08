"use client";

import * as React from "react";
import { ROUTES } from "@/lib/routes";
import { formatTimeEuropean, formatDurationMinutes, formatDateEuropean } from "@/lib/format";
import type { VaHomeShiftCardData } from "@/app/(dashboard)/va-home/page";

type ActivityItem = { type: string; label: string; at: string };

type Props = {
  totalWorkedHours: string;
  weekHours: string;
  todayHours: string;
  shiftCardData: VaHomeShiftCardData;
  recentActivity: ActivityItem[];
};

function formatLiveDurationMinutes(date: string, startTime: string | null): number {
  if (!date || !startTime?.trim()) return 0;
  const t = startTime.trim();
  const timePart = t.length >= 5 ? t.slice(0, 5) : t;
  const withSeconds = timePart.length === 5 && timePart.includes(":") ? `${timePart}:00` : timePart;
  const iso = `${date}T${withSeconds}`;
  const start = new Date(iso);
  if (Number.isNaN(start.getTime())) return 0;
  return Math.max(0, Math.floor((Date.now() - start.getTime()) / 60_000));
}

function formatDurationHHMM(totalMinutes: number): string {
  if (!Number.isFinite(totalMinutes) || totalMinutes < 0) return "0:00";
  const h = Math.floor(totalMinutes / 60);
  const m = Math.round(totalMinutes % 60);
  return `${h}:${m.toString().padStart(2, "0")}`;
}

function VaShiftCard({
  data,
  liveDurationMinutes,
}: {
  data: VaHomeShiftCardData;
  liveDurationMinutes: number;
}) {
  if (data.kind === "live") {
    const startedAt = formatTimeEuropean(data.startTime);
    const durationStr = formatDurationHHMM(liveDurationMinutes);
    const modelsLabel = data.modelNames.length > 0 ? data.modelNames.join(", ") : "—";
    return (
      <a
        href={ROUTES.va.shift}
        className="glass-card flex flex-col p-5 transition-all hover:bg-white/[0.08] hover:shadow-[0_0_24px_-4px_rgba(236,72,153,0.12)]"
      >
        <p className="text-sm font-medium text-white/60">Shift</p>
        <p className="mt-1 text-lg font-semibold text-emerald-300">Live now</p>
        <div className="mt-2 space-y-1 text-sm text-white/80">
          <p>Started {startedAt}</p>
          <p>Duration {durationStr}</p>
          <p>Models: {modelsLabel}</p>
        </div>
      </a>
    );
  }
  if (data.kind === "last") {
    const dateStr = formatDateEuropean(data.date);
    const durationStr = formatDurationMinutes(data.durationMinutes);
    const modelsLabel = data.modelNames.length > 0 ? data.modelNames.join(", ") : "—";
    return (
      <a
        href={ROUTES.va.shift}
        className="glass-card flex flex-col p-5 transition-all hover:bg-white/[0.08] hover:shadow-[0_0_24px_-4px_rgba(236,72,153,0.12)]"
      >
        <p className="text-sm font-medium text-white/60">Shift</p>
        <p className="mt-1 text-lg font-semibold text-white/90">Last shift</p>
        <div className="mt-2 space-y-1 text-sm text-white/80">
          <p>{dateStr}</p>
          <p>Duration {durationStr}</p>
          <p>Models: {modelsLabel}</p>
        </div>
      </a>
    );
  }
  return (
    <a
      href={ROUTES.va.shift}
      className="glass-card flex flex-col p-5 transition-all hover:bg-white/[0.08] hover:shadow-[0_0_24px_-4px_rgba(236,72,153,0.12)]"
    >
      <p className="text-sm font-medium text-white/60">Shift</p>
      <p className="mt-1 text-2xl font-semibold text-white/70">No shifts yet</p>
    </a>
  );
}

export function VaHomeClient({
  totalWorkedHours,
  weekHours,
  todayHours,
  shiftCardData,
  recentActivity,
}: Props) {
  const [liveDurationMinutes, setLiveDurationMinutes] = React.useState(0);
  const liveData = shiftCardData.kind === "live" ? shiftCardData : null;
  React.useEffect(() => {
    if (!liveData) return;
    const tick = () =>
      setLiveDurationMinutes(formatLiveDurationMinutes(liveData.date, liveData.startTime));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [liveData]);

  return (
    <>
      <section className="space-y-6">
        <a
          href={ROUTES.va.shift}
          className="glass-card block p-6 shadow-[0_0_32px_-8px_rgba(236,72,153,0.15)] transition-all hover:border-[hsl(330,80%,55%)]/30 hover:shadow-[0_0_40px_-6px_rgba(236,72,153,0.2)]"
        >
          <p className="text-sm font-medium uppercase tracking-wider text-white/50">Total worked</p>
          <p className="mt-2 text-4xl font-bold tracking-tight text-white sm:text-5xl">
            {totalWorkedHours != null && totalWorkedHours !== "" ? totalWorkedHours : "—"}
          </p>
          <p className="mt-1 text-sm text-white/50">All shifts</p>
        </a>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 content-start">
          <a
            href={ROUTES.va.weeklyProgram}
            className="glass-card flex flex-col p-5 transition-all hover:bg-white/[0.08] hover:shadow-[0_0_24px_-4px_rgba(236,72,153,0.12)]"
          >
            <p className="text-sm font-medium text-white/60">This week</p>
            <p className="mt-1 text-2xl font-semibold text-white">{weekHours}</p>
          </a>
          <a
            href={ROUTES.va.shift}
            className="glass-card flex flex-col p-5 transition-all hover:bg-white/[0.08] hover:shadow-[0_0_24px_-4px_rgba(236,72,153,0.12)]"
          >
            <p className="text-sm font-medium text-white/60">Today</p>
            <p className="mt-1 text-2xl font-semibold text-white">{todayHours}</p>
          </a>
          <VaShiftCard data={shiftCardData} liveDurationMinutes={liveDurationMinutes} />
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-medium text-white">Recent activity</h2>
        <div className="glass-card overflow-hidden">
          {recentActivity.length === 0 ? (
            <div className="p-8 text-center text-sm text-white/50">No recent activity</div>
          ) : (
            <ul className="divide-y divide-white/5">
              {recentActivity.map((a, i) => (
                <li key={`${a.at}-${i}`} className="flex items-center justify-between px-4 py-3">
                  <span className="font-medium text-white/90">{a.label}</span>
                  <span className="text-xs text-white/50">{a.at}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </>
  );
}
