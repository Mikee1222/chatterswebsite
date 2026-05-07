"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Calendar, Loader2, StickyNote } from "lucide-react";
import { formatDateEuropean, formatDateLong } from "@/lib/format";
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
      if (!res.ok || !data.success) {
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
    <div className="fixed inset-0 z-[200] flex items-end justify-center p-4 md:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
        aria-label="Close"
        onClick={() => !busy && onClose()}
      />
      <div
        className="relative w-full max-w-md rounded-2xl border border-white/10 bg-zinc-950 p-5 shadow-2xl"
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
  const [modalOpen, setModalOpen] = React.useState(false);
  const [flagBusy, setFlagBusy] = React.useState<null | "early" | "missed">(null);
  const [flagError, setFlagError] = React.useState<string | null>(null);

  if (modelRecord.period_tracking_enabled !== true && periods[0]?.tracking_enabled !== true) {
    return null;
  }

  const sorted = [...periods].sort((a, b) => b.start_date.localeCompare(a.start_date));
  const lastStart = sorted[0]?.start_date ?? null;
  const avgCycle =
    typeof modelRecord.avg_cycle_length === "number" && modelRecord.avg_cycle_length > 0
      ? modelRecord.avg_cycle_length
      : null;
  const canFlag = sorted.length > 0;

  const patchFlag = async (action: "came_early" | "missed_period") => {
    setFlagError(null);
    setFlagBusy(action === "came_early" ? "early" : "missed");
    try {
      const res = await fetch("/api/model/period/flags", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action }),
      });
      const data = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (!res.ok || !data.success) {
        setFlagError(data.error || t("periodTracker.updateFailed"));
        return;
      }
      router.refresh();
    } catch {
      setFlagError(t("common.networkError"));
    } finally {
      setFlagBusy(null);
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
          <p className="mt-1 text-sm font-semibold text-white">
            {lastStart ? formatDateEuropean(lastStart) : "—"}
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-white/45">
            {t("periodTracker.avgCycle")}
          </p>
          <p className="mt-1 text-sm font-semibold text-white">
            {avgCycle != null
              ? `${avgCycle} ${t("periodTracker.days")}`
              : t("periodTracker.notEnoughData")}
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-white/45">
            {t("periodTracker.nextPredictedShort")}
          </p>
          <p className="mt-1 text-sm font-semibold text-pink-100">
            {predictedNextStart ? formatDateLong(predictedNextStart, language === "es" ? "es" : "en-GB") : "—"}
          </p>
        </div>
      </div>

      {currentPeriod ? (
        <p className="mt-4 text-sm text-rose-200/90">
          {t("periodTracker.currentlyUntil")}{" "}
          <span className="font-medium text-white">{formatDateLong(currentPeriod.end_date, language === "es" ? "es" : "en-GB")}</span>
        </p>
      ) : null}

      <CycleStrip today={today} periods={periods} predictedNext={predictedNextStart} />

      {flagError ? <p className="mt-3 text-sm text-rose-300">{flagError}</p> : null}

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500"
        >
          {t("periodTracker.logPeriod")}
        </button>
        <button
          type="button"
          disabled={!canFlag || flagBusy !== null}
          onClick={() => void patchFlag("came_early")}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-amber-500/90 px-4 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-amber-400 disabled:opacity-40"
        >
          {flagBusy === "early" ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden /> : null}
          {flagBusy === "early" ? t("common.saving") : t("periodTracker.cameEarly")}
        </button>
        <button
          type="button"
          disabled={!canFlag || flagBusy !== null}
          onClick={() => void patchFlag("missed_period")}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-40"
        >
          {flagBusy === "missed" ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden /> : null}
          {flagBusy === "missed" ? t("common.saving") : t("periodTracker.didNotComeReset")}
        </button>
      </div>

      <LogPeriodModal open={modalOpen} onClose={() => setModalOpen(false)} onLogged={() => router.refresh()} />
    </section>
  );
}
