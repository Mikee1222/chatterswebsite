"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { logPeriodAction } from "@/app/actions/model-periods";
import { formatDateEuropean, formatDateLong } from "@/lib/format";
import { addDays, getTodayYmd } from "@/lib/weekly-program";
import { PeriodDayIndicator } from "@/components/period-day-indicator";
import type { ModelPeriodRecord } from "@/types";

type Props = {
  modelId: string;
  language: "en" | "es";
  currentPeriod: ModelPeriodRecord | null;
  predictedNextStart: string | null;
  periods: ModelPeriodRecord[];
  defaultPeriodLengthDays: number;
};

function t(lang: "en" | "es", en: string, es: string) {
  return lang === "es" ? es : en;
}

export function ModelPeriodHomeSection({
  modelId,
  language,
  currentPeriod,
  predictedNextStart,
  periods,
  defaultPeriodLengthDays,
}: Props) {
  const router = useRouter();
  const today = getTodayYmd();
  const [startDate, setStartDate] = React.useState(today);
  const [endDate, setEndDate] = React.useState(addDays(today, Math.max(1, defaultPeriodLengthDays) - 1));
  const [notes, setNotes] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [ok, setOk] = React.useState<string | null>(null);

  const handleLog = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setOk(null);
    setBusy(true);
    const res = await logPeriodAction(modelId, startDate, endDate, notes.trim() || undefined);
    setBusy(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    setOk(t(language, "Period logged.", "Período registrado."));
    setNotes("");
    router.refresh();
  };

  const sorted = [...periods].sort((a, b) => b.start_date.localeCompare(a.start_date)).slice(0, 8);

  return (
    <section className="rounded-2xl border border-white/10 bg-black/40 p-5 backdrop-blur-xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-white/50">
            {t(language, "Cycle tracking", "Seguimiento del ciclo")}
          </h2>
          {currentPeriod ? (
            <p className="mt-2 text-sm text-rose-200/90">
              {t(language, "In period until ", "En período hasta ")}{" "}
              <span className="font-medium text-white">{formatDateLong(currentPeriod.end_date, language === "es" ? "es" : "en-GB")}</span>
            </p>
          ) : predictedNextStart ? (
            <p className="mt-2 text-sm text-white/75">
              {t(language, "Next period predicted around ", "Próximo período previsto hacia ")}{" "}
              <span className="font-medium text-white">{formatDateLong(predictedNextStart, language === "es" ? "es" : "en-GB")}</span>
            </p>
          ) : (
            <p className="mt-2 text-sm text-white/60">
              {t(language, "Log a period to see predictions.", "Registra un período para ver predicciones.")}
            </p>
          )}
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs text-white/50" title={t(language, "Period day — sensitive content restrictions may apply", "Día de período — pueden aplicarse restricciones de contenido")}>
          <PeriodDayIndicator />
          <span>{t(language, "Period indicator", "Indicador de período")}</span>
        </span>
      </div>

      <form onSubmit={handleLog} className="mt-5 space-y-3 rounded-xl border border-white/10 bg-white/[0.04] p-4">
        <p className="text-sm font-medium text-white/90">{t(language, "Log period", "Registrar período")}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs text-white/55">
            {t(language, "Start", "Inicio")}
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white [color-scheme:dark]"
            />
          </label>
          <label className="block text-xs text-white/55">
            {t(language, "End", "Fin")}
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white [color-scheme:dark]"
            />
          </label>
        </div>
        <label className="block text-xs text-white/55">
          {t(language, "Notes (optional)", "Notas (opcional)")}
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
          />
        </label>
        {error && <p className="text-sm text-red-300">{error}</p>}
        {ok && <p className="text-sm text-emerald-300">{ok}</p>}
        <button
          type="submit"
          disabled={busy}
          className="rounded-xl bg-[hsl(330,80%,55%)] px-4 py-2.5 text-sm font-medium text-white hover:bg-[hsl(330,80%,50%)] disabled:opacity-50"
        >
          {busy ? t(language, "Saving…", "Guardando…") : t(language, "Log period", "Registrar período")}
        </button>
      </form>

      {sorted.length > 0 && (
        <div className="mt-6">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-white/50">
            {t(language, "Recent periods", "Períodos recientes")}
          </h3>
          <ul className="mt-2 space-y-2 text-sm text-white/80">
            {sorted.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2">
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
