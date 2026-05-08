"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { AlertCircle, CalendarDays, Clock3, Droplets, History, Loader2, Plus } from "lucide-react";
import { addDays, getTodayYmd } from "@/lib/weekly-program";
import { formatDateLong } from "@/lib/format";
import type { ModelPeriodRecord } from "@/types";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/language-provider";
import { useTranslations } from "@/lib/use-translations";

type CycleStatus = "period" | "predicted_soon" | "normal" | "overdue";

type Props = {
  periods: ModelPeriodRecord[];
  predictedNextStart: string | null;
  avgCycleLength: number | null;
  avgPeriodLength: number | null;
};

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

export function ModelPeriodTrackerWidget({ periods, predictedNextStart, avgCycleLength, avgPeriodLength }: Props) {
  const { t } = useTranslations();
  const { language } = useLanguage();
  const locale = language === "es" ? "es" : "en-GB";
  const router = useRouter();
  const today = getTodayYmd();
  const [openLogModal, setOpenLogModal] = React.useState(false);
  const [openMissedModal, setOpenMissedModal] = React.useState(false);
  const [historyOpen, setHistoryOpen] = React.useState(false);
  const [busyAction, setBusyAction] = React.useState<null | "confirm" | "missed" | "log">(null);
  const [error, setError] = React.useState<string | null>(null);
  const [startDate, setStartDate] = React.useState(ymdInputFromLocalNow());
  const [notes, setNotes] = React.useState("");

  const sorted = React.useMemo(() => [...periods].sort((a, b) => b.start_date.localeCompare(a.start_date)), [periods]);
  const latest = sorted[0] ?? null;
  const canReportMissed = Boolean(latest);
  const currentlyInPeriod = inPeriod(today, sorted);
  const daysToPredicted = predictedNextStart ? dayDiff(today, predictedNextStart) : null;

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

  const confirmStartedToday = async () => {
    setBusyAction("confirm");
    setError(null);
    try {
      const res = await fetch("/api/model/period/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ start_date: today, notes: t("periodTracker.confirmedFromWidget") }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || "Failed");
      }
      refreshData();
    } catch (e) {
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
      setOpenMissedModal(false);
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
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || "Failed");
      }
      setOpenLogModal(false);
      setNotes("");
      refreshData();
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
            <p className="mt-1 text-sm font-semibold text-white">{predictedNextStart ? formatDateLong(predictedNextStart, locale) : "—"}</p>
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

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/45">
            {t("periodTracker.cycleTimeline")}
          </p>
          <div className="flex gap-1 overflow-x-auto rounded-xl border border-white/10 bg-black/25 p-2">
            {timelineDays.map((d) => {
              const isToday = d === today;
              const isPeriod = inPeriod(d, sorted);
              const isPredicted = predictedNextStart && d === predictedNextStart;
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
          <p className="mt-2 text-xs text-white/45">
            {t("periodTracker.timelineLegend")}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busyAction !== null}
            onClick={() => void confirmStartedToday()}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-400/35 bg-emerald-500/15 px-3.5 py-2.5 text-sm font-medium text-emerald-100 hover:bg-emerald-500/25 disabled:opacity-50"
          >
            {busyAction === "confirm" ? (
              <>
                <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                {t("common.saving")}
              </>
            ) : (
              <>
                <CalendarDays className="h-4 w-4 shrink-0" aria-hidden />
                {t("periodTracker.confirmToday")}
              </>
            )}
          </button>
          <button
            type="button"
            disabled={busyAction !== null || !canReportMissed}
            title={!canReportMissed ? t("periodTracker.reportMissedNeedPeriod") : undefined}
            onClick={() => {
              if (!canReportMissed) return;
              setOpenMissedModal(true);
            }}
            className="inline-flex items-center gap-2 rounded-xl border border-amber-400/35 bg-amber-500/15 px-3.5 py-2.5 text-sm font-medium text-amber-100 hover:bg-amber-500/25 disabled:opacity-50"
          >
            <AlertCircle className="h-4 w-4" />
            {t("periodTracker.reportDidNotArrive")}
          </button>
          <button
            type="button"
            disabled={busyAction !== null}
            onClick={() => {
              setStartDate(ymdInputFromLocalNow());
              setOpenLogModal(true);
            }}
            className="inline-flex items-center gap-2 rounded-xl border border-pink-400/35 bg-pink-500/20 px-3.5 py-2.5 text-sm font-medium text-pink-100 hover:bg-pink-500/30 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            {t("periodTracker.logNewLong")}
          </button>
          <button
            type="button"
            onClick={() => setHistoryOpen((v) => !v)}
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.06] px-3.5 py-2.5 text-sm font-medium text-white/80 hover:bg-white/[0.1]"
          >
            <History className="h-4 w-4" />
            {historyOpen ? t("periodTracker.hideHistory") : t("periodTracker.viewHistory")}
          </button>
        </div>

        {historyOpen ? (
          <div className="max-h-[min(24rem,60vh)] overflow-auto rounded-2xl border border-white/10">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/[0.04] text-white/60">
                <tr>
                  <th className="px-3 py-2">{t("common.start")}</th>
                  <th className="px-3 py-2">{t("common.end")}</th>
                  <th className="px-3 py-2">{t("periodTracker.length")}</th>
                  <th className="px-3 py-2">{t("common.notes")}</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((p) => (
                  <tr key={p.id} className="border-t border-white/10 text-white/85">
                    <td className="px-3 py-2">{p.start_date}</td>
                    <td className="px-3 py-2">{p.end_date}</td>
                    <td className="px-3 py-2">{p.period_length_days ?? avgPeriodLength ?? "—"}d</td>
                    <td className="max-w-[260px] truncate px-3 py-2 text-white/60">{p.notes || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {error ? <p className="text-sm text-rose-300">{error}</p> : null}
      </div>

      {openLogModal ? (
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
                  onClick={() => setOpenLogModal(false)}
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

      {openMissedModal ? (
        <div className="fixed inset-0 z-[190] flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-950 p-5">
            <h3 className="text-lg font-semibold text-white">{t("periodTracker.reportMissedTitle")}</h3>
            <p className="mt-2 text-sm text-white/70">{t("periodTracker.reportMissedDescription")}</p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={busyAction === "missed"}
                className="rounded-xl border border-white/15 px-4 py-2 text-white/80 disabled:opacity-45"
                onClick={() => setOpenMissedModal(false)}
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
