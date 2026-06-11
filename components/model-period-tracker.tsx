"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Calendar, Loader2, StickyNote, Droplet } from "lucide-react";
import { formatDateLong } from "@/lib/format";
import { addDays, getTodayYmd } from "@/lib/weekly-program";
import { FormField } from "@/components/ui/form-field";
import { FormInput } from "@/components/ui/form-input";
import { FormTextarea } from "@/components/ui/form-textarea";
import type { ModelPeriodRecord, ModelRecord } from "@/types";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/language-provider";
import { useTranslations } from "@/lib/use-translations";

export type ModelPeriodTrackerProps = {
  modelId: string;
  modelRecord: ModelRecord;
  currentPeriod: ModelPeriodRecord | null;
  predictedNextStart: string | null;
  periods: ModelPeriodRecord[];
  defaultPeriodLengthDays: number;
};

function dayInAnyPeriod(ymd: string, list: ModelPeriodRecord[]): boolean {
  for (const p of list) {
    if (p.start_date && p.end_date && p.start_date <= ymd && ymd <= p.end_date) return true;
  }
  return false;
}

function CycleStrip({
  today,
  periods,
  predictedNext,
}: {
  today: string;
  periods: ModelPeriodRecord[];
  predictedNext: string | null;
}) {
  const { t } = useTranslations();
  const days = React.useMemo(() => {
    const out: string[] = [];
    for (let i = -13; i <= 14; i++) {
      out.push(addDays(today, i));
    }
    return out;
  }, [today]);

  return (
    <div className="mt-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/45">{t("periodTracker.cycleView")}</p>
      <div className="flex flex-wrap gap-1 sm:flex-nowrap sm:overflow-x-auto sm:pb-1">
        {days.map((d) => {
          const inPeriod = dayInAnyPeriod(d, periods);
          const isPred = predictedNext != null && d === predictedNext;
          const isToday = d === today;
          return (
            <div
              key={d}
              title={d}
              className={cn(
                "flex h-8 w-8 shrink-0 flex-col items-center justify-center rounded-lg border text-[10px] font-medium",
                isToday && "border-pink-400/70 ring-1 ring-pink-400/40",
                !isToday && "border-white/10",
                inPeriod && "bg-pink-500/35 text-pink-50",
                !inPeriod && !isPred && "bg-white/[0.04] text-white/50",
                isPred && !inPeriod && "border-pink-300/50 bg-pink-500/15 text-pink-100"
              )}
            >
              <span className="leading-none opacity-70">{d.slice(8)}</span>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-white/40">{t("periodTracker.cycleLegend")}</p>
    </div>
  );
}

function LogPeriodModal({
  open,
  onClose,
  onLogged,
}: {
  open: boolean;
  onClose: () => void;
  onLogged: () => void;
}) {
  const { t } = useTranslations();
  const today = getTodayYmd();
  const [startDate, setStartDate] = React.useState(today);
  const [notes, setNotes] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  React.useEffect(() => {
    if (open) {
      setStartDate(getTodayYmd());
      setNotes("");
      setError(null);
    }
  }, [open]);

  if (!open || !mounted) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/model/period/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ start_date: startDate, notes: notes.trim() || undefined }),
      });
      const data = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (!res.ok || data.success === false) {
        setError(data.error || t("periodTracker.couldNotSave"));
        return;
      }
      onLogged();
      onClose();
    } catch {
      setError(t("common.networkError"));
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[300] flex items-end justify-center p-4 md:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
        aria-label="Close"
        onClick={() => !busy && onClose()}
      />
      <div
        className="relative w-full max-w-md rounded-2xl border border-white/10 bg-zinc-950 p-5 pb-[calc(env(safe-area-inset-bottom)+76px+1.25rem)] shadow-2xl md:p-5"
        role="dialog"
        aria-modal="true"
        aria-labelledby="log-period-modal-title"
      >
        <h2 id="log-period-modal-title" className="text-lg font-semibold text-white">
          {t("periodTracker.logNewLong")}
        </h2>
        <form onSubmit={(e) => void submit(e)} className="mt-4 space-y-4">
          <FormField
            label={t("periodTracker.startDate")}
            icon={<Calendar className="h-4 w-4" />}
            htmlFor="mpt-period-start"
            required
            staggerIndex={0}
          >
            <FormInput
              id="mpt-period-start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
          </FormField>
          <FormField
            label={t("periodTracker.notesOptional")}
            icon={<StickyNote className="h-4 w-4" />}
            htmlFor="mpt-period-notes"
            staggerIndex={1}
          >
            <FormTextarea id="mpt-period-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </FormField>
          {error ? <p className="text-sm text-rose-300">{error}</p> : null}
          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-medium text-white/80 hover:bg-white/5 disabled:opacity-50"
            >
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              disabled={busy}
              className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                  {t("common.saving")}
                </>
              ) : (
                t("common.submit")
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

function ModelBodyModal({ open, children }: { open: boolean; children: React.ReactNode }) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    setMounted(true);
  }, []);
  if (!open || !mounted) return null;
  return createPortal(
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/75 p-4">{children}</div>,
    document.body
  );
}

const PERIOD_MODAL_PANEL_CLASS =
  "w-full max-w-md rounded-2xl border border-white/10 bg-zinc-950 p-5 pb-[calc(env(safe-area-inset-bottom)+76px+1.25rem)] md:p-5";

export function ModelPeriodTracker({
  modelId,
  modelRecord,
  currentPeriod,
  predictedNextStart,
  periods,
  defaultPeriodLengthDays: _defaultPeriodLengthDays,
}: ModelPeriodTrackerProps) {
  const { t } = useTranslations();
  const { language } = useLanguage();
  const router = useRouter();
  const today = getTodayYmd();
  const locale = language === "es" ? "es" : "en-GB";
  const [customOpen, setCustomOpen] = React.useState(false);
  const [historyOpen, setHistoryOpen] = React.useState(false);
  const [missedOpen, setMissedOpen] = React.useState(false);
  const [busy, setBusy] = React.useState<null | "confirm" | "missed">(null);
  const [flagError, setFlagError] = React.useState<string | null>(null);
  const [cycleLength, setCycleLength] = React.useState(
    typeof modelRecord.avg_cycle_length === "number" && modelRecord.avg_cycle_length > 0
      ? modelRecord.avg_cycle_length
      : 28
  );
  const [periodLength, setPeriodLength] = React.useState(
    typeof modelRecord.avg_period_length === "number" && modelRecord.avg_period_length > 0
      ? modelRecord.avg_period_length
      : 5
  );

  React.useEffect(() => {
    setCycleLength(
      typeof modelRecord.avg_cycle_length === "number" && modelRecord.avg_cycle_length > 0
        ? modelRecord.avg_cycle_length
        : 28
    );
    setPeriodLength(
      typeof modelRecord.avg_period_length === "number" && modelRecord.avg_period_length > 0
        ? modelRecord.avg_period_length
        : 5
    );
  }, [modelRecord.avg_cycle_length, modelRecord.avg_period_length]);

  if (modelRecord.period_tracking_enabled !== true && periods[0]?.tracking_enabled !== true) {
    return null;
  }

  const sorted = [...periods].sort((a, b) => b.start_date.localeCompare(a.start_date));
  const lastStart = sorted[0]?.start_date ?? null;
  const hasLoggedPeriod = sorted.length > 0;
  const canReportMissed = Boolean(sorted[0]);
  const avgCycle =
    typeof modelRecord.avg_cycle_length === "number" && modelRecord.avg_cycle_length > 0
      ? modelRecord.avg_cycle_length
      : null;

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
      router.refresh();
    } catch {
      /* ignore */
    }
  }, [cycleLength, periodLength, router]);

  const handleConfirmToday = async () => {
    setFlagError(null);
    setBusy("confirm");
    try {
      const res = await fetch("/api/model/period/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ start_date: today, notes: t("periodTracker.confirmedFromWidget") }),
      });
      const data = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (!res.ok || data.success === false) {
        setFlagError(data.error || t("periodTracker.couldNotConfirm"));
        return;
      }
      router.refresh();
    } catch {
      setFlagError(t("common.networkError"));
    } finally {
      setBusy(null);
    }
  };

  const reportMissed = async () => {
    setFlagError(null);
    setBusy("missed");
    try {
      const res = await fetch("/api/model/period/missed", { method: "POST", credentials: "include" });
      const data = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (!res.ok || data.success === false) {
        setFlagError(data.error || t("periodTracker.couldNotUpdateCycle"));
        return;
      }
      setMissedOpen(false);
      setHistoryOpen(false);
      router.refresh();
    } catch {
      setFlagError(t("common.networkError"));
    } finally {
      setBusy(null);
    }
  };

  return (
    <section key={modelId} className="glass-card rounded-2xl border border-pink-500/20 bg-black/35 p-5 backdrop-blur-xl md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-pink-200/80">
            {t("periodTracker.periodTracking")}
          </h2>
          <p className="mt-1 text-xs text-white/45">{t("periodTracker.cycleAveragesHint")}</p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-white/45">
            {t("periodTracker.lastPeriodStart")}
          </p>
          <p className="mt-1 text-sm font-semibold text-white">{lastStart ? formatDateLong(lastStart, locale) : "—"}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-white/45">
            {t("periodTracker.avgCycle")}
          </p>
          <p className="mt-1 text-sm font-semibold text-white">
            {avgCycle != null ? `${avgCycle} ${t("periodTracker.days")}` : t("periodTracker.notEnoughData")}
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-white/45">
            {t("periodTracker.nextPredictedShort")}
          </p>
          <p className="mt-1 text-sm font-semibold text-pink-100">
            {predictedNextStart ? formatDateLong(predictedNextStart, locale) : "—"}
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs uppercase tracking-widest text-white/40">
            {t("periodTracker.cycleLengthDays")}
          </label>
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
          <label className="mb-1 block text-xs uppercase tracking-widest text-white/40">
            {t("periodTracker.periodLengthDays")}
          </label>
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

      {currentPeriod ? (
        <p className="mt-4 text-sm text-rose-200/90">
          {t("periodTracker.currentlyUntil")}{""}
          <span className="font-medium text-white">{formatDateLong(currentPeriod.end_date, locale)}</span>
        </p>
      ) : null}

      <CycleStrip today={today} periods={periods} predictedNext={predictedNextStart} />

      {flagError ? <p className="mt-3 text-sm text-rose-300">{flagError}</p> : null}

      <button
        type="button"
        disabled={busy !== null}
        onClick={() => void handleConfirmToday()}
        className="mt-5 w-full rounded-xl border border-rose-500/30 bg-rose-500/20 py-3 font-semibold text-rose-400 disabled:opacity-50"
      >
        {busy === "confirm" ? (
          <span className="inline-flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
            {t("common.saving")}
          </span>
        ) : (
          <><Droplet className="inline h-3.5 w-3.5 text-rose-400" aria-hidden /> {t("periodTracker.myPeriodStartedToday")}</>
        )}
      </button>

      {hasLoggedPeriod ? (
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={() => setHistoryOpen(true)}
            className="flex-1 rounded-xl border border-white/15 bg-white/[0.06] px-3 py-2.5 text-sm font-medium text-white/85 hover:bg-white/[0.1]"
          >
            {t("periodTracker.history")}
          </button>
          <button
            type="button"
            onClick={() => setCustomOpen(true)}
            className="flex-1 rounded-xl border border-white/15 bg-white/[0.06] px-3 py-2.5 text-sm font-medium text-white/85 hover:bg-white/[0.1]"
          >
            {t("periodTracker.differentDate")}
          </button>
        </div>
      ) : null}

      <LogPeriodModal open={customOpen} onClose={() => setCustomOpen(false)} onLogged={() => router.refresh()} />

      <ModelBodyModal open={historyOpen}>
        <div className={PERIOD_MODAL_PANEL_CLASS}>
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-lg font-semibold text-white">{t("periodTracker.history")}</h3>
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
                disabled={!canReportMissed}
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
      </ModelBodyModal>

      <ModelBodyModal open={missedOpen}>
        <div className={PERIOD_MODAL_PANEL_CLASS}>
            <h3 className="text-lg font-semibold text-white">{t("periodTracker.reportMissedTitle")}</h3>
            <p className="mt-2 text-sm text-white/70">{t("periodTracker.reportMissedDescription")}</p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={busy === "missed"}
                className="rounded-xl border border-white/15 px-4 py-2 text-white/80 disabled:opacity-45"
                onClick={() => setMissedOpen(false)}
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                disabled={busy === "missed"}
                onClick={() => void reportMissed()}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-2 font-medium text-white disabled:opacity-50"
              >
                {busy === "missed" ? (
                  <>
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                    {t("common.saving")}
                  </>
                ) : (
                  t("periodTracker.confirmReset")
                )}
              </button>
            </div>
          </div>
      </ModelBodyModal>
    </section>
  );
}
