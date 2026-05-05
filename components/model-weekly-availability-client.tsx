"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { submitModelAvailabilityAction, updateModelAvailabilityAction, deleteModelAvailabilityAction } from "@/app/actions/weekly-availability-models";
import { formatTimeRange } from "@/lib/format";
import { modelWeeklyAvailabilityUrl } from "@/lib/routes";
import { addDays, getThisWeekMonday, normalizeWeekStart, formatWeekLabel } from "@/lib/weekly-program";
import { PeriodDayIndicator } from "@/components/period-day-indicator";
import { Label, Select, Textarea, SubmitButton } from "@/components/ui/form";
import type { ModelWeeklyAvailabilityRequest, WeeklyProgramDay, ModelAvailabilityEntryType } from "@/types";

const DAYS: WeeklyProgramDay[] = [
  "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
];

const ENTRY_TYPES: { value: ModelAvailabilityEntryType; labelEn: string; labelEs: string }[] = [
  { value: "availability", labelEn: "Availability", labelEs: "Disponibilidad" },
  { value: "day_off", labelEn: "Day off", labelEs: "Día libre" },
  { value: "live_window", labelEn: "Live window", labelEs: "Ventana en vivo" },
  { value: "custom_window", labelEn: "Custom window", labelEs: "Ventana personalizada" },
];

type Props = {
  modelId: string;
  language: "en" | "es";
  weekStart: string;
  initialRequests: ModelWeeklyAvailabilityRequest[];
  periodDatesThisWeek: string[];
};

function t(lang: "en" | "es", en: string, es: string) {
  return lang === "es" ? es : en;
}

export function ModelWeeklyAvailabilityClient({
  modelId,
  language,
  weekStart: initialWeekStart,
  initialRequests,
  periodDatesThisWeek,
}: Props) {
  void modelId;
  const router = useRouter();
  const searchParams = useSearchParams();
  const weekStart = normalizeWeekStart(searchParams.get("week_start") || initialWeekStart);

  const [requests, setRequests] = React.useState(initialRequests);
  const [editingRequest, setEditingRequest] = React.useState<ModelWeeklyAvailabilityRequest | null>(null);
  const [entryType, setEntryType] = React.useState<ModelAvailabilityEntryType>("availability");
  const [day, setDay] = React.useState<WeeklyProgramDay>("Monday");
  const [startTime, setStartTime] = React.useState("09:00");
  const [endTime, setEndTime] = React.useState("17:00");
  const [notes, setNotes] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => setRequests(initialRequests), [weekStart, initialRequests]);

  const goToWeek = (offset: number) => {
    router.push(modelWeeklyAvailabilityUrl(addDays(weekStart, offset * 7)));
  };

  const needsTime = entryType === "availability" || entryType === "live_window" || entryType === "custom_window";

  const handleEdit = (r: ModelWeeklyAvailabilityRequest) => {
    setEditingRequest(r);
    setEntryType(r.entry_type);
    setDay(r.day);
    setStartTime(r.start_time?.slice(0, 5) || "09:00");
    setEndTime(r.end_time?.slice(0, 5) || "17:00");
    setNotes(r.notes ?? "");
    setError(null);
    setSuccess(null);
  };

  const handleCancelEdit = () => {
    setEditingRequest(null);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (needsTime && (!startTime.trim() || !endTime.trim())) {
      setError(t(language, "Start and end time are required.", "Se requieren hora de inicio y fin."));
      return;
    }
    if (needsTime && startTime === endTime) {
      setError(t(language, "Start and end time cannot be the same.", "La hora de inicio y fin no pueden ser iguales."));
      return;
    }
    setSubmitting(true);
    if (editingRequest) {
      const res = await updateModelAvailabilityAction(editingRequest.id, {
        entry_type: entryType,
        start_time: needsTime ? startTime : null,
        end_time: needsTime ? endTime : null,
        notes: notes.trim() || undefined,
      });
      setSubmitting(false);
      if (!res.success) {
        setError(res.error);
        return;
      }
      setSuccess(t(language, "Availability updated.", "Disponibilidad actualizada."));
      setEditingRequest(null);
      router.refresh();
      return;
    }
    const res = await submitModelAvailabilityAction({
      week_start: weekStart,
      day,
      entry_type: entryType,
      start_time: needsTime ? startTime : null,
      end_time: needsTime ? endTime : null,
      notes: notes.trim() || undefined,
    });
    setSubmitting(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    setSuccess(t(language, "Availability submitted.", "Disponibilidad enviada."));
    setNotes("");
    router.refresh();
  };

  const handleDelete = async (recordId: string) => {
    if (!confirm(t(language, "Delete this entry?", "¿Eliminar esta entrada?"))) return;
    const res = await deleteModelAvailabilityAction(recordId);
    if (res.success) router.refresh();
    else setError(res.error);
  };

  const byDay = React.useMemo(() => {
    return DAYS.map((d) => ({
      day: d,
      entries: requests.filter((r) => r.day === d),
    }));
  }, [requests]);

  const periodDateSet = React.useMemo(() => new Set(periodDatesThisWeek), [periodDatesThisWeek]);

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-white/10 bg-black/40 px-6 py-5 backdrop-blur-xl" style={{ boxShadow: "0 0 0 1px rgba(255,255,255,0.05), 0 0 32px -8px hsl(330 80% 55% / 0.08)" }}>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">
          {t(language, "Your schedule", "Tu horario")}
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white md:text-3xl">
          {t(language, "My weekly availability", "Mi disponibilidad semanal")}
        </h2>
        <p className="mt-1 text-white/60">
          {t(
            language,
            "Submit when you're available. You can add multiple entries per day (availability, day off, live window, custom window).",
            "Indica cuándo estás disponible. Puedes añadir varias entradas por día (disponibilidad, día libre, ventana en vivo, ventana personalizada)."
          )}
        </p>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-sm text-red-200">{error}</div>
      )}
      {success && (
        <div className="rounded-2xl border border-[hsl(330,80%,55%)]/30 bg-[hsl(330,80%,55%)]/10 px-5 py-4 text-sm text-[hsl(330,90%,75%)]">{success}</div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-black/40 p-5 backdrop-blur-xl" style={{ boxShadow: "0 0 0 1px rgba(255,255,255,0.05), 0 0 24px -8px hsl(330 80% 55% / 0.06)" }}>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-white/50">
            {t(language, "Week", "Semana")}
          </span>
          <button type="button" onClick={() => goToWeek(-1)} className="rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/90 hover:bg-white/10 transition-colors">
            ← {t(language, "Previous", "Anterior")}
          </button>
          <button type="button" onClick={() => router.push(modelWeeklyAvailabilityUrl(getThisWeekMonday()))} className="rounded-xl border border-[hsl(330,80%,55%)]/40 bg-[hsl(330,80%,55%)]/15 px-4 py-2.5 text-sm font-medium text-[hsl(330,90%,75%)] hover:bg-[hsl(330,80%,55%)]/25 transition-colors">
            {t(language, "This week", "Esta semana")}
          </button>
          <button type="button" onClick={() => goToWeek(1)} className="rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/90 hover:bg-white/10 transition-colors">
            {t(language, "Next", "Siguiente")} →
          </button>
          <span className="ml-2 text-sm font-medium text-white/80">{formatWeekLabel(weekStart)}</span>
        </div>
        <p className="mt-2 w-full text-xs text-white/45 md:mt-0 md:text-right">
          {t(language, "Pink dot on a day: period — content restrictions may apply.", "Punto rosa: día de período — pueden aplicarse restricciones.")}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/40 p-5 backdrop-blur-xl" style={{ boxShadow: "0 0 0 1px rgba(255,255,255,0.05), 0 0 24px -8px hsl(330 80% 55% / 0.06)" }}>
          <div className="border-b border-white/10 pb-4 mb-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-white/90">
              {editingRequest ? t(language, "Edit entry", "Editar entrada") : t(language, "Add entry", "Añadir entrada")}
            </h3>
          </div>
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div>
              <Label>{t(language, "Entry type", "Tipo de entrada")}</Label>
              <Select value={entryType} onChange={(e) => setEntryType(e.target.value as ModelAvailabilityEntryType)} className="mt-1">
                {ENTRY_TYPES.map((opt) => (
                  <option key={opt.value} value={opt.value}>{t(language, opt.labelEn, opt.labelEs)}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label>{t(language, "Day", "Día")}</Label>
              {editingRequest ? (
                <p className="mt-1 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-[15px] text-white/90">{day}</p>
              ) : (
                <Select value={day} onChange={(e) => setDay(e.target.value as WeeklyProgramDay)} className="mt-1">
                  {DAYS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </Select>
              )}
            </div>
            {needsTime && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>{t(language, "Start time", "Hora inicio")}</Label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="mt-1 w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-[15px] text-white [color-scheme:dark]"
                  />
                </div>
                <div>
                  <Label>{t(language, "End time", "Hora fin")}</Label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="mt-1 w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-[15px] text-white [color-scheme:dark]"
                  />
                </div>
              </div>
            )}
            <div>
              <Label>{t(language, "Notes (optional)", "Notas (opcional)")}</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder={t(language, "e.g. prefer morning", "ej. prefiero mañana")} className="mt-1" />
            </div>
            <div className="flex flex-wrap gap-2">
              <SubmitButton type="submit" disabled={submitting}>
                {submitting ? t(language, "Saving…", "Guardando…") : editingRequest ? t(language, "Save changes", "Guardar cambios") : t(language, "Submit", "Enviar")}
              </SubmitButton>
              {editingRequest && (
                <button type="button" onClick={handleCancelEdit} className="rounded-2xl border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-medium text-white/80 hover:bg-white/10 transition-colors">
                  {t(language, "Cancel", "Cancelar")}
                </button>
              )}
            </div>
          </form>
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/40 backdrop-blur-xl" style={{ boxShadow: "0 0 0 1px rgba(255,255,255,0.05), 0 0 24px -8px hsl(330 80% 55% / 0.06)" }}>
          <div className="border-b border-white/10 bg-white/[0.04] px-5 py-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-white/90">
              {t(language, "Your submissions this week", "Tus envíos esta semana")}
            </h3>
          </div>
          <div className="max-h-96 overflow-y-auto p-3 space-y-2">
            {requests.length === 0 ? (
              <p className="py-8 text-center text-sm text-white/50">
                {t(language, "No entries for this week yet.", "Aún no hay entradas para esta semana.")}
              </p>
            ) : (
              byDay.map(({ day: d, entries }) =>
                entries.length > 0 ? (
                  <div key={d}>
                    <p className="mb-1.5 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white/50">
                      <span>{d}</span>
                      {periodDateSet.has(addDays(weekStart, DAYS.indexOf(d))) ? <PeriodDayIndicator /> : null}
                    </p>
                    {entries.map((r) => (
                      <div key={r.id} className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 mb-2 text-sm">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-[hsl(330,90%,75%)]">
                            {d} — {ENTRY_TYPES.find((e) => e.value === r.entry_type) ? t(language, ENTRY_TYPES.find((e) => e.value === r.entry_type)!.labelEn, ENTRY_TYPES.find((e) => e.value === r.entry_type)!.labelEs) : r.entry_type}
                            {(r.start_time || r.end_time) && ` · ${formatTimeRange(r.start_time, r.end_time)}`}
                          </span>
                          <span className={`rounded-lg px-2 py-0.5 text-xs font-medium ${r.status === "submitted" ? "bg-amber-500/20 text-amber-300" : r.status === "used" ? "bg-emerald-500/20 text-emerald-300" : "bg-white/10 text-white/70"}`}>
                            {r.status}
                          </span>
                        </div>
                        {r.notes?.trim() && <p className="mt-1 text-white/50 truncate">{r.notes}</p>}
                        <div className="mt-2 flex gap-2">
                          <button type="button" onClick={() => handleEdit(r)} className="rounded-lg border border-white/20 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/80 hover:bg-white/10 transition-colors">
                            {t(language, "Edit", "Editar")}
                          </button>
                          <button type="button" onClick={() => handleDelete(r.id)} className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-300 hover:bg-red-500/20 transition-colors">
                            {t(language, "Delete", "Eliminar")}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
