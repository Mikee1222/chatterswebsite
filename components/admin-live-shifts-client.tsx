"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Send, RefreshCw, Calendar, Users } from "lucide-react";
import { formatDateTimeEuropean } from "@/lib/format";
import type { AdminShiftQueueRow, Shift } from "@/types";
import { LiveTimer } from "@/components/live-timer";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { adminForceEndShift } from "@/app/actions/shift";

export type LiveShiftWithModels = Shift & { modelNames: string[] };

const CHATTER_TELEGRAM: Record<string, string> = {
  "Hlias Zarifes": "elias_drag",
  "Edgar": "Edgar200055",
  "Giannis Katsikas": "giannhskts",
  "Apostolis": "apo_dl",
  "Anastasis Haroupas": "Anastasiss99",
};

const MAX_BREAK_MINUTES = 45;

/** Minutes elapsed since break_started_at (live tick for badge). */
function useBreakSessionMinutesSoFar(breakStartedAt: string | null, isOnBreak: boolean): number {
  const [mins, setMins] = React.useState(0);
  React.useEffect(() => {
    if (!isOnBreak || !breakStartedAt) {
      setMins(0);
      return;
    }
    const tick = () => {
      const startMs = new Date(breakStartedAt).getTime();
      if (!startMs) return;
      setMins(Math.max(0, Math.floor((Date.now() - startMs) / 60_000)));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [isOnBreak, breakStartedAt]);
  return mins;
}

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

/** Pill from shift.break_minutes + live on-break session (no backend changes). */
function BreakSummaryBadge({ shift, isOnBreak }: { shift: LiveShiftWithModels; isOnBreak: boolean }) {
  const breakStartedAt = shift.break_started_at;
  const completedMins = shift.break_minutes ?? 0;
  const sessionMins = useBreakSessionMinutesSoFar(breakStartedAt, isOnBreak && Boolean(breakStartedAt));

  if (isOnBreak && breakStartedAt) {
    return (
      <span
        className="inline-flex shrink-0 items-center rounded-full border border-red-500/25 bg-red-500/15 px-2 py-0.5 text-xs font-medium text-red-400"
        title="Currently on break"
      >
        ⏸ On break · {sessionMins} min so far
      </span>
    );
  }
  if (completedMins > 0) {
    return (
      <span
        className="inline-flex shrink-0 items-center rounded-full border border-amber-500/25 bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-400"
        title="Total break time used this shift"
      >
        ☕ {completedMins} min break
      </span>
    );
  }
  return null;
}

function ShiftCard({
  shift,
  subtitle,
  index = 0,
  adminForceEnd,
}: {
  shift: LiveShiftWithModels;
  subtitle?: string;
  index?: number;
  adminForceEnd?: { onRequest: () => void; busy: boolean };
}) {
  const isOnBreak = shift.status === "on_break" || Boolean(shift.break_started_at);
  const hasBreakStart = Boolean(shift.break_started_at);
  const running = !isOnBreak;
  const chatterName = shift.chatter_name || "—";
  const telegramUsername = chatterName !== "—" ? CHATTER_TELEGRAM[chatterName] : undefined;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: index * 0.04, ease: "easeOut" }}
      className={`mb-3 rounded-2xl border border-white/10 bg-white/[0.08] p-5 transition-all last:mb-0 hover:bg-white/10 ${
        isOnBreak ? "ring-1 ring-amber-500/15" : ""
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 gap-y-1.5">
            <span className="text-lg font-bold tracking-tight text-white">{chatterName}</span>
            <BreakSummaryBadge shift={shift} isOnBreak={isOnBreak} />
            {telegramUsername && (
              <a
                href={`tg://resolve?domain=${telegramUsername}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex shrink-0 items-center gap-1 rounded-full border border-white/15 bg-gradient-to-r from-rose-600 via-pink-600 to-pink-500 px-2.5 py-1 text-xs font-medium text-white shadow-[0_2px_12px_-2px_rgba(236,72,153,0.45)] transition-opacity hover:opacity-90"
              >
                <Send className="h-3 w-3 shrink-0 opacity-95" aria-hidden />
                <span>Message</span>
              </a>
            )}
          </div>
          {subtitle && <p className="mt-0.5 text-xs text-white/40">{subtitle}</p>}
          <p className="mt-0.5 text-xs text-white/40">
            Started at: {shift.start_time ? formatDateTimeEuropean(shift.start_time) : "—"}
          </p>
        </div>
        <span
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-wider ${
            isOnBreak
              ? "border-amber-500/50 bg-amber-500/25 text-amber-200"
              : "border-emerald-500/40 bg-emerald-500/20 text-emerald-300"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 shrink-0 rounded-full ${running ? "animate-pulse bg-emerald-400" : "animate-pulse bg-amber-400"}`}
            aria-hidden
          />
          {isOnBreak ? "ON BREAK" : "ACTIVE"}
        </span>
      </div>

      <div className="mt-4">
        <div className="text-pink-400 text-3xl font-bold tabular-nums font-mono [font-variant-numeric:tabular-nums]">
          {shift.start_time ? <LiveTimer startTime={shift.start_time} className="tabular-nums font-mono font-bold" /> : "—"}
        </div>
        <p className="text-xs font-semibold uppercase tracking-widest text-white/30">Duration</p>
      </div>

      {isOnBreak && hasBreakStart && (
        <>
          <p className="mt-4 font-mono text-xl tabular-nums text-amber-300">
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
        <div className="mt-3 flex flex-wrap gap-2">
          {shift.modelNames.map((name) => (
            <span key={name} className="rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
              {name}
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-white/45">No models assigned</p>
      )}
    </motion.div>
  );
}

function StatCard({
  label,
  value,
  dotClass,
}: {
  label: string;
  value: React.ReactNode;
  dotClass: string;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 shrink-0 rounded-full ${dotClass}`} aria-hidden />
        <p className="text-xs font-semibold uppercase tracking-widest text-white/40">{label}</p>
      </div>
      <p className="mt-1 text-4xl font-bold tabular-nums text-white">{value}</p>
    </div>
  );
}

function EmptyState({ message, sub, icon: Icon }: { message: string; sub?: string; icon?: React.ComponentType<{ className?: string }> }) {
  const I = Icon ?? Calendar;
  return (
    <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 py-12 text-center">
      <I className="h-10 w-10 text-white/20" aria-hidden />
      <p className="text-white/50">{message}</p>
      {sub && <p className="max-w-xs text-sm text-white/30">{sub}</p>}
    </div>
  );
}

type Props = {
  shiftsWithModels: LiveShiftWithModels[];
  shiftQueue?: AdminShiftQueueRow[];
};

export function AdminLiveShiftsClient({ shiftsWithModels, shiftQueue = [] }: Props) {
  const router = useRouter();
  const [refreshing, setRefreshing] = React.useState(false);
  const [forceEndFor, setForceEndFor] = React.useState<LiveShiftWithModels | null>(null);
  const forceEndReasonRef = React.useRef("");
  const [endingId, setEndingId] = React.useState<string | null>(null);
  const handleRefresh = React.useCallback(() => {
    setRefreshing(true);
    router.refresh();
    setTimeout(() => setRefreshing(false), 1000);
  }, [router]);

  const chatterShifts = shiftsWithModels.filter((s) => s.staff_role === "chatter");
  const vaShifts = shiftsWithModels.filter((s) => s.staff_role === "virtual_assistant");
  const totalShifts = shiftsWithModels.length;
  const totalModels = React.useMemo(
    () => new Set(shiftsWithModels.flatMap((s) => s.modelNames)).size,
    [shiftsWithModels]
  );

  const confirmForceEnd = React.useCallback(async () => {
    if (!forceEndFor) return;
    setEndingId(forceEndFor.id);
    try {
      const res = await adminForceEndShift(forceEndFor.id, forceEndReasonRef.current.trim() || undefined);
      if (!res.success) {
        window.alert(res.error);
        return;
      }
      setForceEndFor(null);
      forceEndReasonRef.current = "";
      router.refresh();
    } finally {
      setEndingId(null);
    }
  }, [forceEndFor, router]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-white/40">Operations</p>
          <h1 className="mt-1 text-4xl font-bold text-white">Live shifts</h1>
          <p className="mt-2 text-sm text-white/50">Real-time visibility into chatter and VA shifts.</p>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          className="flex shrink-0 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white transition-colors hover:bg-white/10"
        >
          <RefreshCw className={`h-4 w-4 shrink-0 ${refreshing ? "animate-spin" : ""}`} aria-hidden />
          <span>{refreshing ? "Refreshing…" : "Refresh"}</span>
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Active Chatters" value={chatterShifts.length} dotClass="bg-pink-400 shadow-[0_0_8px_hsl(330_90%_70%_/_0.5)]" />
        <StatCard label="Active VAs" value={vaShifts.length} dotClass="bg-purple-400 shadow-[0_0_8px_rgb(192_132_252_/_0.45)]" />
        <StatCard label="Total Active Shifts" value={totalShifts} dotClass="bg-sky-400 shadow-[0_0_8px_rgb(56_189_248_/_0.45)]" />
        <StatCard label="Models Currently Active" value={totalModels} dotClass="bg-emerald-400 shadow-[0_0_8px_rgb(52_211_153_/_0.45)]" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-white/40">Live chatter shifts</h2>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            {chatterShifts.length === 0 ? (
              <EmptyState
                message="No live chatter shifts"
                sub="Shifts will appear here when chatters are live"
                icon={Calendar}
              />
            ) : (
              chatterShifts.map((s, i) => <ShiftCard key={s.id} shift={s} index={i} />)
            )}
            {shiftQueue.length > 0 && (
              <div className="mt-4">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-white/40">Waiting in queue</h3>
                {shiftQueue.map((entry) => (
                  <div
                    key={entry.id}
                    className="mb-2 rounded-xl border border-sky-500/25 bg-sky-500/10 p-3 last:mb-0"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-medium text-white">{entry.chatter_name}</span>
                      <span className="text-xs text-sky-300">
                        Waiting for {entry.waitingForChatterName || "chatter"}
                      </span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {entry.selectedModelNames.map((name, idx) => (
                        <span
                          key={`${entry.id}-${name}-${idx}`}
                          className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/50"
                        >
                          {name}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div>
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-white/40">Live VA shifts</h2>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            {vaShifts.length === 0 ? (
              <EmptyState
                message="No live VA shifts"
                sub="VA shifts will appear here when active"
                icon={Users}
              />
            ) : (
              vaShifts.map((s, i) => (
                <ShiftCard
                  key={s.id}
                  shift={s}
                  subtitle="Mistake check"
                  index={i}
                  adminForceEnd={{
                    onRequest: () => setForceEndFor(s),
                    busy: endingId === s.id,
                  }}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {totalShifts === 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/5 py-16 text-center">
          <p className="text-lg font-medium text-white/70">No live shifts right now</p>
          <p className="mt-1 text-sm text-white/50">When chatters or VAs start a shift, they will appear here.</p>
        </div>
      )}

      <ConfirmDialog
        open={forceEndFor != null}
        onClose={() => {
          if (endingId) return;
          setForceEndFor(null);
          forceEndReasonRef.current = "";
        }}
        onConfirm={() => confirmForceEnd()}
        title="Force end shift?"
        description={
          forceEndFor
            ? `End ${forceEndFor.chatter_name || "this user"}’s shift now? Models will be freed, shift rows removed, and the staff member will be notified.`
            : ""
        }
        confirmLabel="End shift"
        confirmVariant="danger"
        loading={endingId !== null}
        reasonPlaceholder="Optional note (shown to chatter and admins)…"
        onReasonChange={(r) => {
          forceEndReasonRef.current = r;
        }}
      />
    </div>
  );
}
