"use client";

import * as React from "react";
import { formatDateTimeEuropean } from "@/lib/format";
import type { Shift } from "@/types";
import { LiveTimer } from "@/components/live-timer";

export type LiveShiftWithModels = Shift & { modelNames: string[] };

const MAX_BREAK_MINUTES = 45;
const cardShadow = "0 0 0 1px rgba(255,255,255,0.05), 0 0 24px -8px hsl(330 80% 55% / 0.08)";
const cardShadowOnBreak = "0 0 0 1px rgba(251,191,36,0.2), 0 0 24px -8px rgba(245,158,11,0.15)";
const sectionShadow = "0 0 0 1px rgba(255,255,255,0.05), 0 0 32px -8px hsl(330 80% 55% / 0.06)";

/** Live-updating break used display (X / 45 min used) when on break. */
function BreakUsedLive({
  breakMinutes,
  breakStartedAt,
  isOnBreak,
}: {
  breakMinutes: number;
  breakStartedAt: string | null;
  isOnBreak: boolean;
}) {
  const [totalUsed, setTotalUsed] = React.useState(breakMinutes);
  React.useEffect(() => {
    if (!isOnBreak || !breakStartedAt) {
      setTotalUsed(breakMinutes);
      return;
    }
    const tick = () => {
      const startMs = new Date(breakStartedAt).getTime();
      if (!startMs) return;
      const currentBreakMins = Math.floor((Date.now() - startMs) / 60_000);
      setTotalUsed(breakMinutes + currentBreakMins);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [isOnBreak, breakStartedAt, breakMinutes]);
  return (
    <p className="mt-1 text-sm text-amber-200/80 tabular-nums">
      {totalUsed} / {MAX_BREAK_MINUTES} min used
    </p>
  );
}

/** Uses the same real-time shift state as the actual shift page: status from record + break_started_at. */
function ShiftCard({ shift, subtitle }: { shift: LiveShiftWithModels; subtitle?: string }) {
  const isOnBreak = shift.status === "on_break" || Boolean(shift.break_started_at);
  const hasBreakStart = Boolean(shift.break_started_at);

  return (
    <div
      className={`rounded-xl border p-5 transition ${
        isOnBreak
          ? "border-amber-500/30 bg-amber-500/[0.06] hover:bg-amber-500/[0.08]"
          : "border-white/10 bg-white/[0.04] hover:bg-white/[0.06]"
      }`}
      style={{ boxShadow: isOnBreak ? cardShadowOnBreak : cardShadow }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-lg font-semibold tracking-tight text-white">
            {shift.chatter_name || "—"}
          </p>
          {subtitle && <p className="mt-0.5 text-xs text-white/45 uppercase tracking-wider">{subtitle}</p>}
          <p className="mt-1 text-xs text-white/50">
            Started {shift.start_time ? formatDateTimeEuropean(shift.start_time) : "—"}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-wider ${
            isOnBreak
              ? "border-amber-500/50 bg-amber-500/25 text-amber-200"
              : "border-emerald-500/40 bg-emerald-500/20 text-emerald-300"
          }`}
          style={
            isOnBreak
              ? { boxShadow: "0 0 14px -2px rgba(245,158,11,0.4)" }
              : { boxShadow: "0 0 12px -2px rgba(16,185,129,0.3)" }
          }
        >
          {isOnBreak ? "ON BREAK" : "ACTIVE"}
        </span>
      </div>
      <p className="mt-4 font-mono text-2xl tabular-nums text-[hsl(330,90%,75%)]" style={{ textShadow: "0 0 16px hsl(330 80% 55% / 0.25)" }}>
        {shift.start_time ? (
          <LiveTimer startTime={shift.start_time} className="tabular-nums" />
        ) : (
          "—"
        )}
      </p>
      <p className="mt-0.5 text-xs font-semibold uppercase tracking-wider text-white/45">Duration</p>
      {isOnBreak && hasBreakStart && (
        <>
          <p className="mt-4 font-mono text-xl tabular-nums text-amber-300" style={{ textShadow: "0 0 12px rgba(245,158,11,0.2)" }}>
            <LiveTimer startTime={shift.break_started_at} mode="break" />
          </p>
          <p className="mt-0.5 text-xs font-semibold uppercase tracking-wider text-amber-400/80">Break</p>
          <BreakUsedLive
            breakMinutes={shift.break_minutes ?? 0}
            breakStartedAt={shift.break_started_at}
            isOnBreak={isOnBreak}
          />
        </>
      )}
      {shift.modelNames.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {shift.modelNames.map((name) => (
            <span
              key={name}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white/90"
            >
              {name}
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-4 text-sm text-white/45">No models assigned</p>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div
      className="rounded-xl border border-white/10 bg-black/40 px-4 py-4 backdrop-blur-xl"
      style={{ boxShadow: sectionShadow }}
    >
      <p className="text-xs font-semibold uppercase tracking-wider text-white/45">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-white">{value}</p>
    </div>
  );
}

function EmptyState({ message, sub }: { message: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-white/5 bg-white/[0.02] py-16 text-center">
      <p className="text-base font-medium text-white/60">{message}</p>
      {sub && <p className="mt-1 text-sm text-white/40">{sub}</p>}
    </div>
  );
}

type Props = {
  shiftsWithModels: LiveShiftWithModels[];
};

export function AdminLiveShiftsClient({ shiftsWithModels }: Props) {
  const chatterShifts = shiftsWithModels.filter((s) => s.staff_role === "chatter");
  const vaShifts = shiftsWithModels.filter((s) => s.staff_role === "virtual_assistant");
  const totalShifts = shiftsWithModels.length;
  const totalModels = React.useMemo(
    () => new Set(shiftsWithModels.flatMap((s) => s.modelNames)).size,
    [shiftsWithModels]
  );

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div
        className="rounded-2xl border border-white/10 bg-black/40 px-6 py-5 backdrop-blur-xl"
        style={{ boxShadow: "0 0 0 1px rgba(255,255,255,0.05), 0 0 48px -12px hsl(330 80% 55% / 0.1)" }}
      >
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">Operations</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white md:text-3xl">Live shifts</h1>
        <p className="mt-1 text-white/60">Real-time visibility. Chatter and VA shifts.</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Active chatters" value={chatterShifts.length} />
        <StatCard label="Active VAs" value={vaShifts.length} />
        <StatCard label="Total active shifts" value={totalShifts} />
        <StatCard label="Models currently active" value={totalModels} />
      </div>

      {/* Two columns */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div
          className="overflow-hidden rounded-2xl border border-white/10 bg-black/40 backdrop-blur-xl"
          style={{ boxShadow: sectionShadow }}
        >
          <div className="border-b border-white/10 bg-white/[0.04] px-5 py-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-white/90">Live chatter shifts</h2>
          </div>
          <div className="p-4 space-y-4">
            {chatterShifts.length === 0 ? (
              <EmptyState message="No live chatter shifts" sub="Shifts will appear here when chatters are live" />
            ) : (
              chatterShifts.map((s) => <ShiftCard key={s.id} shift={s} />)
            )}
          </div>
        </div>

        <div
          className="overflow-hidden rounded-2xl border border-white/10 bg-black/40 backdrop-blur-xl"
          style={{ boxShadow: sectionShadow }}
        >
          <div className="border-b border-white/10 bg-white/[0.04] px-5 py-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-white/90">Live VA shifts</h2>
          </div>
          <div className="p-4 space-y-4">
            {vaShifts.length === 0 ? (
              <EmptyState message="No live VA shifts" sub="VA shifts will appear here when active" />
            ) : (
              vaShifts.map((s) => <ShiftCard key={s.id} shift={s} subtitle="Mistake check" />)
            )}
          </div>
        </div>
      </div>

      {totalShifts === 0 && (
        <div
          className="rounded-2xl border border-white/10 bg-black/40 py-16 text-center backdrop-blur-xl"
          style={{ boxShadow: sectionShadow }}
        >
          <p className="text-lg font-medium text-white/70">No live shifts right now</p>
          <p className="mt-1 text-sm text-white/50">When chatters or VAs start a shift, they will appear here.</p>
        </div>
      )}
    </div>
  );
}
