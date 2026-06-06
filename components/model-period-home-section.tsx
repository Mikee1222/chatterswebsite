"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Calendar, StickyNote } from "lucide-react";
import { logPeriodAction } from "@/app/actions/model-periods";
import { formatDateEuropean, formatDateLong } from "@/lib/format";
import { addDays, getTodayYmd } from "@/lib/weekly-program";
import { PeriodDayIndicator } from "@/components/period-day-indicator";
import { FormField } from "@/components/ui/form-field";
import { FormInput } from "@/components/ui/form-input";
import { FormTextarea } from "@/components/ui/form-textarea";
import { FormSubmitButton } from "@/components/ui/form-submit-button";
import type { ModelPeriodRecord } from "@/types";
import { useLanguage } from "@/lib/language-provider";
import { useTranslations } from "@/lib/use-translations";

type Props = {
  modelId: string;
  currentPeriod: ModelPeriodRecord | null;
  predictedNextStart: string | null;
  periods: ModelPeriodRecord[];
  defaultPeriodLengthDays: number;
};

export function ModelPeriodHomeSection({
  modelId,
  currentPeriod,
  predictedNextStart,
  periods,
  defaultPeriodLengthDays,
}: Props) {
  const { t } = useTranslations();
  const { language } = useLanguage();
  const locale = language === "es" ? "es" : "en-GB";
  const router = useRouter();
  const today = getTodayYmd();
  const [startDate, setStartDate] = React.useState(today);
  const [endDate, setEndDate] = React.useState(addDays(today, Math.max(1, defaultPeriodLengthDays) - 1));
  const [notes, setNotes] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [ok, setOk] = React.useState<string | null>(null);
  const [successPulse, setSuccessPulse] = React.useState(false);

  const handleLog = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setOk(null);
    setSuccessPulse(false);
    setBusy(true);
    try {
      const res = await logPeriodAction(modelId, startDate, endDate, notes.trim() || undefined);
      if (!res.success) {
        setError(res.error);
        return;
      }
      setOk(t("periodTracker.periodLogged"));
      setSuccessPulse(true);
      setNotes("");
      router.refresh();
      window.setTimeout(() => setSuccessPulse(false), 2200);
    } finally {
      setBusy(false);
    }
  };

  const sorted = [...periods].sort((a, b) => b.start_date.localeCompare(a.start_date)).slice(0, 8);

  return (
    <section className="rounded-2xl border border-white/10 bg-black/40 p-5 backdrop-blur-xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-white/50">{t("periodTracker.cycleTracking")}</h2>
          {currentPeriod ? (
            <p className="mt-2 text-sm text-rose-200/90">
              {t("periodTracker.inPeriodPrefix")}{""}
              <span className="font-medium text-white">{formatDateLong(currentPeriod.end_date, locale)}</span>
            </p>
          ) : predictedNextStart ? (
            <p className="mt-2 text-sm text-white/75">
              {t("periodTracker.nextPredictedAroundPrefix")}{""}
              <span className="font-medium text-white">{formatDateLong(predictedNextStart, locale)}</span>
            </p>
          ) : (
            <p className="mt-2 text-sm text-white/60">{t("periodTracker.logForPredictions")}</p>
          )}
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs text-white/50" title={t("periodTracker.periodDayTooltip")}>
          <PeriodDayIndicator />
          <span>{t("periodTracker.periodIndicator")}</span>
        </span>
      </div>

      <form
        onSubmit={(e) => void handleLog(e)}
        className="mt-5 space-y-4 rounded-xl border border-white/10 bg-white/[0.04] p-4 md:p-5"
      >
        <p className="text-sm font-medium text-white/90">{t("periodTracker.logPeriod")}</p>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label={t("common.start")} icon={<Calendar />} htmlFor="period-start-date" required staggerIndex={0}>
            <FormInput
              id="period-start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
          </FormField>
          <FormField label={t("common.end")} icon={<Calendar />} htmlFor="period-end-date" required staggerIndex={1}>
            <FormInput id="period-end-date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
          </FormField>
        </div>

        <FormField label={t("periodTracker.notesOptional")} icon={<StickyNote />} htmlFor="period-notes" staggerIndex={2}>
          <FormTextarea
            id="period-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder={t("common.optional")}
          />
        </FormField>

        {error ? <p className="text-sm text-rose-300">{error}</p> : null}
        {ok ? <p className="text-sm text-emerald-300">{ok}</p> : null}

        <motion.div layout className="pt-1">
          <FormSubmitButton disabled={busy} loading={busy} success={successPulse} successLabel={t("common.saved")}>
            {busy ? t("common.saving") : t("periodTracker.logPeriod")}
          </FormSubmitButton>
        </motion.div>
      </form>

      {sorted.length > 0 && (
        <div className="mt-6">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-white/50">{t("periodTracker.recentPeriods")}</h3>
          <ul className="mt-2 space-y-2 text-sm text-white/80">
            {sorted.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2"
              >
                <span>
                  {formatDateEuropean(p.start_date)} – {formatDateEuropean(p.end_date)}
                </span>
                {p.logged_by && <span className="text-xs text-white/45">{p.logged_by}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
