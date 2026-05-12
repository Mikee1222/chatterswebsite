"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { CalendarDays, Clock3, Droplets, Loader2 } from "lucide-react";
import { addDays, getTodayYmd } from "@/lib/weekly-program";
import { formatDateLong } from "@/lib/format";
import type { ModelPeriodRecord } from "@/types";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/language-provider";
import { useTranslations } from "@/lib/use-translations";

type CycleStatus = "period" | "predicted_soon" | "normal" | "overdue";

type Props = {
  modelRecordId: string;
  stableModelId?: string | null;
  currentPeriod: ModelPeriodRecord | null;
  periods: ModelPeriodRecord[];
  predictedNextStart: string | null;
  avgCycleLength: number | null;
  avgPeriodLength: number | null;
};

type PeriodLogResponse = {
  success?: boolean;
  error?: string;
  current_period?: ModelPeriodRecord | null;
  predicted_next_start?: string | null;
};

const LAST_LOGGED_PERIOD_STORAGE_KEY = "lastLoggedPeriodDate";
const LAST_LOGGED_PERIOD_MAX_AGE_MS = 10 * 60 * 1000;

function persistLastLoggedPeriod(date: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      LAST_LOGGED_PERIOD_STORAGE_KEY,
      JSON.stringify({ date, timestamp: Date.now() })
    );
  } catch {
    /* ignore storage failures */
  }
}

function clearPersistedLastLoggedPeriod(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(LAST_LOGGED_PERIOD_STORAGE_KEY);
  } catch {
    /* ignore storage failures */
  }
}

function dayDiff(fromYmd: string, toYmd: string): number {
  const a = Date.parse(`${fromYmd}T12:00:00.000Z`);
  const b = Date.parse(`${toYmd}T12:00:00.000Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.round((b - a) / 86400000);
}

function statusClass(status: CycleStatus): string {
  if (status === "period") return "border-rose-400/35 bg-rose-500/15 text-rose-100";
  if (status === "predicted_soon") return "border-amber-400/35 bg-amber-500/15 text-amber-100";
  if (status === "overdue") return "border-red-400/35 bg-red-500/18 text-red-100";
  return "border-white/20 bg-white/[0.08] text-white/80";
}

function buildTimelineDays(today: string): string[] {
  const out: string[] = [];
  for (let i = -20; i <= 16; i += 1) out.push(addDays(today, i));
  return out;
}

function inPeriod(ymd: string, periods: ModelPeriodRecord[]): boolean {
  return periods.some((p) => p.start_date <= ymd && ymd <= p.end_date);
}

function ymdInputFromLocalNow(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function ModelPeriodTrackerWidget({
  modelRecordId: _modelRecordId,
  stableModelId: _stableModelId,
  currentPeriod,
  periods,
  predictedNextStart,
  avgCycleLength,
  avgPeriodLength,
}: Props) {
  const { t } = useTranslations();
  const { language } = useLanguage();
  const locale = language === "es" ? "es" : "en-GB";
  const router = useRouter();
  const today = getTodayYmd();
  const [historyOpen, setHistoryOpen] = React.useState(false);
  const [customDateOpen, setCustomDateOpen] = React.useState(false);
  const [missedOpen, setMissedOpen] = React.useState(false);
  const [busyAction, setBusyAction] = React.useState<null | "confirm" | "missed" | "log">(null);
  const [error, setError] = React.useState<string | null>(null);
  const [startDate, setStartDate] = React.useState(ymdInputFromLocalNow());
  const [notes, setNotes] = React.useState("");
  const [cycleLength, setCycleLength] = React.useState(
    typeof avgCycleLength === "number" && avgCycleLength > 0 ? avgCycleLength : 28
  );
  const [periodLength, setPeriodLength] = React.useState(
    typeof avgPeriodLength === "number" && avgPeriodLength > 0 ? avgPeriodLength : 5
  );
  const [showSuccess, setShowSuccess] = React.useState(false);
  /** Until server props refresh, show the new row in timeline / history. */
  const [justLoggedStartYmd, setJustLoggedStartYmd] = React.useState<string | null>(null);
  const [optimisticCurrentPeriod, setOptimisticCurrentPeriod] = React.useState<ModelPeriodRecord | null>(null);
  const [optimisticNextPeriod, setOptimisticNextPeriod] = React.useState<string | null>(null);

  React.useEffect(() => {
    setCycleLength(typeof avgCycleLength === "number" && avgCycleLength > 0 ? avgCycleLength : 28);
    setPeriodLength(typeof avgPeriodLength === "number" && avgPeriodLength > 0 ? avgPeriodLength : 5);
  }, [avgCycleLength, avgPeriodLength]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(LAST_LOGGED_PERIOD_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { date?: unknown; timestamp?: unknown };
      const date = typeof parsed.date === "string" ? parsed.date.trim().slice(0, 10) : "";
      const timestamp = typeof parsed.timestamp === "number" ? parsed.timestamp : 0;
      if (/^\d{4}-\d{2}-\d{2}$/.test(date) && Date.now() - timestamp < LAST_LOGGED_PERIOD_MAX_AGE_MS) {
        setJustLoggedStartYmd(date);
        return;
      }
      clearPersistedLastLoggedPeriod();
    } catch {
      clearPersistedLastLoggedPeriod();
    }
  }, []);

  React.useEffect(() => {
    if (currentPeriod?.start_date && currentPeriod.start_date === justLoggedStartYmd) {
      clearPersistedLastLoggedPeriod();
    }
  }, [currentPeriod?.start_date, justLoggedStartYmd]);

  React.useEffect(() => {
    if (!justLoggedStartYmd) return;
    if (periods.some((p) => p.start_date === justLoggedStartYmd)) {
      setJustLoggedStartYmd(null);
    }
  }, [periods, justLoggedStartYmd]);

  React.useEffect(() => {
    if (!optimisticCurrentPeriod) return;
    const optimisticStart = optimisticCurrentPeriod.start_date;
    if (currentPeriod?.start_date === optimisticStart || periods.some((p) => p.start_date === optimisticStart)) {
      setOptimisticCurrentPeriod(null);
    }
  }, [currentPeriod, periods, optimisticCurrentPeriod]);

  React.useEffect(() => {
    if (!optimisticNextPeriod) return;
    if (predictedNextStart === optimisticNextPeriod || (!optimisticCurrentPeriod && !justLoggedStartYmd && predictedNextStart)) {
      setOptimisticNextPeriod(null);
    }
  }, [justLoggedStartYmd, optimisticCurrentPeriod, optimisticNextPeriod, predictedNextStart]);

  const mergedPeriods = React.useMemo((): ModelPeriodRecord[] => {
    if (optimisticCurrentPeriod && !periods.some((p) => p.start_date === optimisticCurrentPeriod.start_date)) {
      return [...periods, optimisticCurrentPeriod];
    }
    if (!justLoggedStartYmd) return periods;
    if (periods.some((p) => p.start_date === justLoggedStartYmd)) return periods;
    const pl = Math.max(2, Math.min(10, Math.round(periodLength)));
    const end = addDays(justLoggedStartYmd, pl - 1);
    const synthetic: ModelPeriodRecord = {
      id: "__optimistic__",
      model_id: "",
      start_date: justLoggedStartYmd,
      end_date: end,
      cycle_length_days: null,
      period_length_days: pl,
      notes: "",
      logged_by: "model",
      created_at: null,
    };
    return [...periods, synthetic];
  }, [periods, optimisticCurrentPeriod, justLoggedStartYmd, periodLength]);

  const sorted = React.useMemo(
    () => [...mergedPeriods].sort((a, b) => b.start_date.localeCompare(a.start_date)),
    [mergedPeriods]
  );
  const latest = sorted[0] ?? null;
  const displayCurrentPeriod = optimisticCurrentPeriod ?? currentPeriod;
  const displayNextPeriod = optimisticNextPeriod ?? predictedNextStart;
  const hasLoggedPeriod = sorted.length > 0;
  const canReportMissed = Boolean(latest);
  const currentlyInPeriod = displayCurrentPeriod
    ? displayCurrentPeriod.start_date <= today && today <= displayCurrentPeriod.end_date
    : inPeriod(today, sorted);
  const daysToPredicted = displayNextPeriod ? dayDiff(today, displayNextPeriod) : null;

  const status: CycleStatus = currentlyInPeriod
    ? "period"
    : daysToPredicted == null
      ? "normal"
      : daysToPredicted < 0
        ? "overdue"
        : daysToPredicted <= 3
          ? "predicted_soon"
          : "normal";

  const statusLabel =
    status === "period"
      ? t("periodTracker.statusPeriod")
      : status === "predicted_soon"
        ? t("periodTracker.statusPredictedSoon")
        : status === "overdue"
          ? t("periodTracker.statusOverdue")
          : t("periodTracker.statusNormal");

  const refreshData = () => router.refresh();

  const applySuccessfulLog = (
    data: PeriodLogResponse,
    loggedStart: string,
    options: { refreshDelayMs: number | null }
  ) => {
    setShowSuccess(true);
    setJustLoggedStartYmd(loggedStart);
    persistLastLoggedPeriod(loggedStart);
    if (data.current_period) setOptimisticCurrentPeriod(data.current_period);
    if ("predicted_next_start" in data) setOptimisticNextPeriod(data.predicted_next_start ?? null);
    window.setTimeout(() => setShowSuccess(false), 5500);
    if (options.refreshDelayMs != null) {
      window.setTimeout(() => refreshData(), options.refreshDelayMs);
    }
  };

  const saveCycleSettings = React.useCallback(async () => {
    const c = Math.min(45, Math.max(21, Math.round(cycleLength)));
    const p = Math.min(10, Math.max(2, Math.round(periodLength)));
    try {
      await fetch("/api/model/period/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ cycle_length: c, period_length: p }),
      }).catch(() => {});
      refreshData();
    } catch {
      /* ignore */
    }
  }, [cycleLength, periodLength, router]);

  const handleConfirmToday = async () => {
    setBusyAction("confirm");
    setError(null);
    try {
      const res = await fetch("/api/model/period/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ start_date: today, notes: t("periodTracker.confirmedFromWidget") }),
      });
      const data = (await res.json().catch(() => ({}))) as PeriodLogResponse;
      if (!res.ok || data.success === false) {
        console.error("[period/log] error:", data);
        throw new Error(data.error || "Failed");
      }
      applySuccessfulLog(data, today, { refreshDelayMs: data.current_period ? null : 6000 });
    } catch (e) {
      console.error("[period] handleConfirmToday error:", e);
      setError(e instanceof Error ? e.message : t("periodTracker.couldNotConfirm"));
    } finally {
      setBusyAction(null);
    }
  };

  const reportMissed = async () => {
    setBusyAction("missed");
    setError(null);
    try {
      const res = await fetch("/api/model/period/missed", { method: "POST", credentials: "include" });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || "Failed");
      }
      setMissedOpen(false);
      refreshData();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("periodTracker.couldNotUpdateCycle"));
    } finally {
      setBusyAction(null);
    }
  };

  const submitLog = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusyAction("log");
    setError(null);
    try {
      const res = await fetch("/api/model/period/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ start_date: startDate, notes: notes.trim() || undefined }),
      });
      const data = (await res.json().catch(() => ({}))) as PeriodLogResponse;
      if (!res.ok || data.success === false) {
        console.error("[period/log] error:", data);
        throw new Error(data.error || "Failed");
      }
      const loggedStart = startDate.trim().slice(0, 10);
      applySuccessfulLog(data, loggedStart, { refreshDelayMs: 6000 });
      setCustomDateOpen(false);
      setNotes("");
    } catch (e2) {
      setError(e2 instanceof Error ? e2.message : t("periodTracker.couldNotSavePeriod"));
    } finally {
      setBusyAction(null);
    }
  };

  const timelineDays = React.useMemo(() => buildTimelineDays(today), [today]);

  return (
    <section className="overflow-hidden rounded-3xl border border-white/10 bg-zinc-950/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-xl">
      <div className="border-b border-white/10 bg-zinc-900/55 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl border border-pink-400/35 bg-pink-500/20 text-pink-100">
              <Droplets className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg font-semibold text-white">{t("periodTracker.trackerTitle")}</h2>
              <p className="mt-1 text-sm text-white/60">{t("periodTracker.trackerSubtitle")}</p>
            </div>
          </div>
          <span className={cn("rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide", statusClass(status))}>
            {statusLabel}
          </span>
        </div>
      </div>

      <div className="space-y-5 p-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
            <p className="text-xs uppercase tracking-wide text-white/45">{t("periodTracker.lastPeriod")}</p>
            <p className="mt-1 text-sm font-semibold text-white">{latest ? formatDateLong(latest.start_date, locale) : "—"}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
            <p className="text-xs uppercase tracking-wide text-white/45">{t("periodTracker.avgCycle")}</p>
            <p className="mt-1 text-sm font-semibold text-white">{avgCycleLength ? `${avgCycleLength}d` : "—"}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
            <p className="text-xs uppercase tracking-wide text-white/45">{t("periodTracker.nextExpected")}</p>
            <p className="mt-1 text-sm font-semibold text-white">
              {displayNextPeriod ? formatDateLong(displayNextPeriod, locale) : "—"}
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
            <p className="text-xs uppercase tracking-wide text-white/45">{t("periodTracker.cycleDelta")}</p>
            <p className="mt-1 text-sm font-semibold text-white">
              {daysToPredicted == null
                ? "—"
                : daysToPredicted >= 0
                  ? t("periodTracker.daysLeft", { days: daysToPredicted })
                  : t("periodTracker.daysOverdue", { days: Math.abs(daysToPredicted) })}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs uppercase tracking-widest text-white/40">{t("periodTracker.cycleLengthDays")}</label>
            <input
              type="number"
              min={21}
              max={45}
              value={cycleLength}
              onChange={(e) => setCycleLength(Number(e.target.value))}
              onBlur={() => void saveCycleSettings()}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs uppercase tracking-widest text-white/40">{t("periodTracker.periodLengthDays")}</label>
            <input
              type="number"
              min={2}
              max={10}
              value={periodLength}
              onChange={(e) => setPeriodLength(Number(e.target.value))}
              onBlur={() => void saveCycleSettings()}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
            />
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/45">{t("periodTracker.cycleTimeline")}</p>
          <div className="flex gap-1 overflow-x-auto rounded-xl border border-white/10 bg-black/25 p-2">
            {timelineDays.map((d) => {
              const isToday = d === today;
              const isPeriod = inPeriod(d, sorted);
              const isPredicted = displayNextPeriod && d === displayNextPeriod;
              return (
                <motion.div
                  key={d}
                  className={cn(
                    "relative flex h-9 w-8 shrink-0 items-center justify-center rounded-md border text-[10px] font-medium",
                    isToday ? "border-pink-300/80 text-pink-100 ring-1 ring-pink-400/40" : "border-white/10 text-white/55",
                    isPeriod && "border-rose-300/40 bg-rose-500/35 text-white",
                    isPredicted && !isPeriod && "border-amber-300/45 bg-amber-500/20 text-amber-100"
                  )}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.16 }}
                  title={d}
                >
                  {d.slice(8)}
                  {isToday ? <span className="absolute -bottom-1 h-1 w-1 rounded-full bg-pink-300" /> : null}
                </motion.div>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-white/45">{t("periodTracker.timelineLegend")}</p>
        </div>

        <button
          type="button"
          disabled={busyAction !== null}
          onClick={() => void handleConfirmToday()}
          className="w-full rounded-xl border border-rose-500/30 bg-rose-500/20 py-3 font-semibold text-rose-400 disabled:opacity-50"
        >
          {busyAction === "confirm" ? (
            <span className="inline-flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
              {t("common.saving")}
            </span>
          ) : (
            <>🩸 {t("periodTracker.myPeriodStartedToday")}</>
          )}
        </button>

        {showSuccess ? (
          <div className="mt-2 flex items-center gap-2 rounded-xl border border-rose-500/25 bg-rose-500/15 px-4 py-3">
            <span aria-hidden>🩸</span>
            <p className="text-sm font-medium text-rose-400">{t("periodTracker.periodLoggedSuccessBanner")}</p>
          </div>
        ) : null}

        {hasLoggedPeriod ? (
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => setHistoryOpen(true)}
              className="flex-1 rounded-xl border border-white/15 bg-white/[0.06] px-3 py-2.5 text-sm font-medium text-white/85 hover:bg-white/[0.1]"
            >
              📋 {t("periodTracker.history")}
            </button>
            <button
              type="button"
              onClick={() => {
                setStartDate(ymdInputFromLocalNow());
                setCustomDateOpen(true);
              }}
              className="flex-1 rounded-xl border border-white/15 bg-white/[0.06] px-3 py-2.5 text-sm font-medium text-white/85 hover:bg-white/[0.1]"
            >
              📅 {t("periodTracker.differentDate")}
            </button>
          </div>
        ) : null}

        {error ? <p className="text-sm text-rose-300">{error}</p> : null}
      </div>

      {customDateOpen ? (
        <div className="fixed inset-0 z-[190] flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-950 p-5">
            <h3 className="text-lg font-semibold text-white">{t("periodTracker.logNewShort")}</h3>
            <form onSubmit={(e) => void submitLog(e)} className="mt-4 space-y-4">
              <label className="block">
                <span className="text-xs uppercase tracking-wide text-white/45">{t("periodTracker.startDate")}</span>
                <input
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2.5 text-white"
                />
              </label>
              <label className="block">
                <span className="text-xs uppercase tracking-wide text-white/45">{t("common.notes")}</span>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2.5 text-white"
                />
              </label>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  disabled={busyAction === "log"}
                  className="rounded-xl border border-white/15 px-4 py-2 text-white/80 disabled:opacity-45"
                  onClick={() => setCustomDateOpen(false)}
                >
                  {t("common.cancel")}
                </button>
                <button
                  type="submit"
                  disabled={busyAction === "log"}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-pink-600 px-4 py-2 font-medium text-white disabled:opacity-50"
                >
                  {busyAction === "log" ? (
                    <>
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                      {t("common.saving")}
                    </>
                  ) : (
                    t("periodTracker.save")
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {historyOpen ? (
        <div className="fixed inset-0 z-[190] flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-950 p-5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-lg font-semibold text-white">📋 {t("periodTracker.history")}</h3>
              <button
                type="button"
                className="rounded-lg border border-white/15 px-3 py-1 text-sm text-white/70 hover:bg-white/5"
                onClick={() => setHistoryOpen(false)}
              >
                {t("common.close")}
              </button>
            </div>
            <div className="mt-4 max-h-64 space-y-2 overflow-y-auto">
              {sorted.map((p, i) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white">
                      {formatDateLong(p.start_date, locale)}
                      {i === 0 ? (
                        <span className="ml-2 text-xs text-rose-400">{t("periodTracker.historyLatest")}</span>
                      ) : null}
                    </p>
                    <p className="text-xs text-white/40">
                      {p.end_date ? `${p.start_date} → ${p.end_date}` : p.start_date}
                      {p.cycle_length_days != null ? ` · ${p.cycle_length_days}d cycle` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    {p.missed_period ? (
                      <span className="rounded-full border border-amber-500/25 bg-amber-500/15 px-2 py-0.5 text-xs text-amber-400">
                        {t("periodTracker.historyMissed")}
                      </span>
                    ) : null}
                    {p.came_early ? (
                      <span className="rounded-full border border-blue-500/25 bg-blue-500/15 px-2 py-0.5 text-xs text-blue-400">
                        {t("periodTracker.historyEarly")}
                      </span>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 border-t border-white/10 pt-4">
              <button
                type="button"
                disabled={busyAction !== null || !canReportMissed}
                title={!canReportMissed ? t("periodTracker.reportMissedNeedPeriod") : undefined}
                onClick={() => {
                  setHistoryOpen(false);
                  setMissedOpen(true);
                }}
                className="w-full rounded-xl border border-amber-400/35 bg-amber-500/15 py-2.5 text-sm font-medium text-amber-100 hover:bg-amber-500/25 disabled:opacity-50"
              >
                {t("periodTracker.reportDidNotArrive")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {missedOpen ? (
        <div className="fixed inset-0 z-[191] flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-950 p-5">
            <h3 className="text-lg font-semibold text-white">{t("periodTracker.reportMissedTitle")}</h3>
            <p className="mt-2 text-sm text-white/70">{t("periodTracker.reportMissedDescription")}</p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={busyAction === "missed"}
                className="rounded-xl border border-white/15 px-4 py-2 text-white/80 disabled:opacity-45"
                onClick={() => setMissedOpen(false)}
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                disabled={busyAction === "missed"}
                onClick={() => void reportMissed()}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-2 font-medium text-white disabled:opacity-50"
              >
                {busyAction === "missed" ? (
                  <>
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                    {t("common.saving")}
                  </>
                ) : (
                  <>
                    <Clock3 className="h-4 w-4 shrink-0" aria-hidden />
                    {t("periodTracker.confirmReset")}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
