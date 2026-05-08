"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Calendar, Clock, ListChecks, Loader2, Plus, StickyNote, X } from "lucide-react";
import { submitModelAvailabilityAction, updateModelAvailabilityAction, deleteModelAvailabilityAction } from "@/app/actions/weekly-availability-models";
import { formatTimeRange } from "@/lib/format";
import { formatModelAvailabilityWindows, validateTimeWindows } from "@/lib/model-availability-windows";
import { modelWeeklyAvailabilityUrl } from "@/lib/routes";
import { addDays, getThisWeekMonday, normalizeWeekStart, formatWeekLabel } from "@/lib/weekly-program";
import { PeriodDayIndicator } from "@/components/period-day-indicator";
import { selectOptionClass } from "@/components/ui/form";
import { FormField } from "@/components/ui/form-field";
import { FormInput } from "@/components/ui/form-input";
import { FormSelect } from "@/components/ui/form-select";
import { FormTextarea } from "@/components/ui/form-textarea";
import { FormSubmitButton } from "@/components/ui/form-submit-button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type {
  ModelAvailabilityTimeWindow,
  ModelAvailabilityEntryType,
  ModelWeeklyAvailabilityRequest,
  WeeklyProgramDay,
} from "@/types";

const fieldMotion = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] },
} as const;

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

const DEFAULT_TIME_WINDOWS: ModelAvailabilityTimeWindow[] = [{ start: "09:00", end: "17:00" }];

function availValidationMessage(lang: "en" | "es", raw: string): string {
  const table: Record<string, [string, string]> = {
    "At least one time window is required.": [
      "At least one time window is required.",
      "Se requiere al menos una ventana horaria.",
    ],
    "Each window needs a start and end time.": [
      "Each window needs a start and end time.",
      "Cada ventana necesita hora de inicio y fin.",
    ],
    "Invalid time format.": ["Invalid time format.", "Formato de hora no válido."],
    "End time must be after start time.": [
      "End time must be after start time.",
      "La hora de fin debe ser posterior a la de inicio.",
    ],
    "Windows cannot overlap.": ["Windows cannot overlap.", "Las ventanas no pueden superponerse."],
  };
  const pair = table[raw];
  return pair ? t(lang, pair[0], pair[1]) : raw;
}

function submissionTimeLabel(r: ModelWeeklyAvailabilityRequest): string | null {
  if (r.time_windows.length > 0) return formatModelAvailabilityWindows(r.time_windows);
  if (r.start_time && r.end_time) return formatTimeRange(r.start_time, r.end_time);
  return null;
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
  const [timeWindows, setTimeWindows] = React.useState<ModelAvailabilityTimeWindow[]>(() => [...DEFAULT_TIME_WINDOWS]);
  const [notes, setNotes] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = React.useState<string | null>(null);

  React.useEffect(() => setRequests(initialRequests), [weekStart, initialRequests]);

  const goToWeek = (offset: number) => {
    router.push(modelWeeklyAvailabilityUrl(addDays(weekStart, offset * 7)));
  };

  const needsTime = entryType === "availability" || entryType === "live_window" || entryType === "custom_window";

  const handleEdit = (r: ModelWeeklyAvailabilityRequest) => {
    setEditingRequest(r);
    setEntryType(r.entry_type);
    setDay(r.day);
    if (r.time_windows.length > 0) {
      setTimeWindows(r.time_windows.map((w) => ({ start: w.start.slice(0, 5), end: w.end.slice(0, 5) })));
    } else if (r.start_time && r.end_time) {
      setTimeWindows([{ start: r.start_time.slice(0, 5), end: r.end_time.slice(0, 5) }]);
    } else {
      setTimeWindows([...DEFAULT_TIME_WINDOWS]);
    }
    setNotes(r.notes ?? "");
    setError(null);
    setSuccess(null);
  };

  const handleCancelEdit = () => {
    setEditingRequest(null);
    setTimeWindows([...DEFAULT_TIME_WINDOWS]);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    let normalizedWindows: ModelAvailabilityTimeWindow[] | undefined;
    if (needsTime) {
      const v = validateTimeWindows(timeWindows);
      if (!v.ok) {
        setError(availValidationMessage(language, v.error));
        return;
      }
      normalizedWindows = v.normalized;
    }
    setSubmitting(true);
    try {
      if (editingRequest) {
        const res = await updateModelAvailabilityAction(editingRequest.id, {
          entry_type: entryType,
          ...(needsTime && normalizedWindows ? { time_windows: normalizedWindows } : {}),
          notes: notes.trim() || undefined,
        });
        if (!res.success) {
          setError(res.error);
          return;
        }
        setSuccess(t(language, "Availability updated.", "Disponibilidad actualizada."));
        setEditingRequest(null);
        setTimeWindows([...DEFAULT_TIME_WINDOWS]);
        router.refresh();
        return;
      }
      const res = await submitModelAvailabilityAction({
        week_start: weekStart,
        day,
        entry_type: entryType,
        ...(needsTime && normalizedWindows ? { time_windows: normalizedWindows } : {}),
        notes: notes.trim() || undefined,
      });
      if (!res.success) {
        setError(res.error);
        return;
      }
      setSuccess(t(language, "Availability submitted.", "Disponibilidad enviada."));
      setNotes("");
      setTimeWindows([...DEFAULT_TIME_WINDOWS]);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  };

  const runDeleteEntry = async (recordId: string) => {
    setDeletingId(recordId);
    setError(null);
    try {
      const res = await deleteModelAvailabilityAction(recordId);
      if (res.success) {
        setDeleteConfirmId(null);
        router.refresh();
      } else {
        setError(res.error);
      }
    } finally {
      setDeletingId(null);
    }
  };

  const requestDeleteEntry = (recordId: string) => {
    setDeleteConfirmId(recordId);
  };

  const byDay = React.useMemo(() => {
    return DAYS.map((d) => ({
      day: d,
      entries: requests.filter((r) => r.day === d),
    }));
  }, [requests]);

  const periodDateSet = React.useMemo(() => new Set(periodDatesThisWeek), [periodDatesThisWeek]);

  return (
    <>
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
          <form onSubmit={handleSubmit} className="model-weekly-availability-page mt-4 space-y-4">
            <motion.div {...fieldMotion}>
              <FormField
                label={t(language, "Entry type", "Tipo de entrada")}
                icon={<ListChecks />}
                htmlFor="model-avail-entry-type"
              >
                <FormSelect
                  id="model-avail-entry-type"
                  value={entryType}
                  onChange={(e) => setEntryType(e.target.value as ModelAvailabilityEntryType)}
                >
                  {ENTRY_TYPES.map((opt) => (
                    <option key={opt.value} value={opt.value} className={selectOptionClass}>
                      {t(language, opt.labelEn, opt.labelEs)}
                    </option>
                  ))}
                </FormSelect>
              </FormField>
            </motion.div>
            <motion.div {...fieldMotion} transition={{ ...fieldMotion.transition, delay: 0.05 }}>
              <FormField label={t(language, "Day", "Día")} icon={<Calendar />} htmlFor="model-avail-day">
                {editingRequest ? (
                  <FormInput
                    id="model-avail-day"
                    readOnly
                    tabIndex={-1}
                    value={day}
                    className="cursor-default opacity-95"
                    aria-readonly="true"
                  />
                ) : (
                  <FormSelect
                    id="model-avail-day"
                    value={day}
                    onChange={(e) => setDay(e.target.value as WeeklyProgramDay)}
                  >
                    {DAYS.map((d) => (
                      <option key={d} value={d} className={selectOptionClass}>
                        {d}
                      </option>
                    ))}
                  </FormSelect>
                )}
              </FormField>
            </motion.div>
            {needsTime && (
              <div className="space-y-4">
                {timeWindows.map((windowRow, idx) => (
                  <div key={idx}>
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-white/45">
                      {t(language, `Window ${idx + 1}`, `Ventana ${idx + 1}`)}
                    </p>
                    <div className="mb-2 flex flex-wrap items-end gap-2">
                      <div className="min-w-[120px] flex-1">
                        <FormField
                          label={t(language, "Start time", "Hora inicio")}
                          icon={<Clock />}
                          htmlFor={`model-avail-start-${idx}`}
                          required
                          className="mb-0"
                        >
                          <FormInput
                            id={`model-avail-start-${idx}`}
                            type="time"
                            value={windowRow.start}
                            onChange={(e) => {
                              const next = [...timeWindows];
                              next[idx] = { ...next[idx]!, start: e.target.value };
                              setTimeWindows(next);
                            }}
                            className="weekly-avail-time-input"
                          />
                        </FormField>
                      </div>
                      <span className="hidden self-center pb-2 text-sm text-white/40 sm:inline md:pb-6">
                        {t(language, "to", "a")}
                      </span>
                      <div className="min-w-[120px] flex-1">
                        <FormField
                          label={t(language, "End time", "Hora fin")}
                          icon={<Clock />}
                          htmlFor={`model-avail-end-${idx}`}
                          required
                          className="mb-0"
                        >
                          <FormInput
                            id={`model-avail-end-${idx}`}
                            type="time"
                            value={windowRow.end}
                            onChange={(e) => {
                              const next = [...timeWindows];
                              next[idx] = { ...next[idx]!, end: e.target.value };
                              setTimeWindows(next);
                            }}
                            className="weekly-avail-time-input"
                          />
                        </FormField>
                      </div>
                      {idx > 0 && (
                        <button
                          type="button"
                          onClick={() => setTimeWindows((prev) => prev.filter((_, i) => i !== idx))}
                          className="mb-2 shrink-0 rounded-lg p-2 text-red-400 transition-colors hover:bg-red-500/10 hover:text-red-300"
                          aria-label={t(language, "Remove window", "Quitar ventana")}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setTimeWindows((prev) => [...prev, { start: "", end: "" }])}
                  className="inline-flex items-center gap-1 text-xs font-medium text-[hsl(330,90%,72%)] transition-colors hover:text-[hsl(330,90%,82%)]"
                >
                  <Plus className="h-3 w-3 shrink-0" />
                  {t(language, "Add another window", "Añadir otra ventana")}
                </button>
              </div>
            )}
            <motion.div {...fieldMotion} transition={{ ...fieldMotion.transition, delay: 0.1 }}>
              <FormField
                label={t(language, "Notes (optional)", "Notas (opcional)")}
                icon={<StickyNote />}
                htmlFor="model-avail-notes"
              >
                <FormTextarea
                  id="model-avail-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder={t(language, "e.g. prefer morning", "ej. prefiero mañana")}
                />
              </FormField>
            </motion.div>
            <motion.div className="flex flex-col gap-2 pt-1 sm:flex-row sm:items-stretch" layout>
              <FormSubmitButton disabled={submitting} loading={submitting} className="sm:flex-1">
                {submitting ? t(language, "Saving…", "Guardando…") : editingRequest ? t(language, "Save changes", "Guardar cambios") : t(language, "Submit", "Enviar")}
              </FormSubmitButton>
              {editingRequest && (
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.97 }}
                  disabled={submitting}
                  onClick={handleCancelEdit}
                  className="shrink-0 rounded-xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-medium text-white/80 transition-colors hover:border-white/25 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-45 sm:self-stretch"
                >
                  {t(language, "Cancel", "Cancelar")}
                </motion.button>
              )}
            </motion.div>
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
                            {submissionTimeLabel(r) ? ` · ${submissionTimeLabel(r)}` : ""}
                          </span>
                          <span className={`rounded-lg px-2 py-0.5 text-xs font-medium ${r.status === "submitted" ? "bg-amber-500/20 text-amber-300" : r.status === "used" ? "bg-emerald-500/20 text-emerald-300" : "bg-white/10 text-white/70"}`}>
                            {r.status}
                          </span>
                        </div>
                        {r.notes?.trim() && <p className="mt-1 text-white/50 truncate">{r.notes}</p>}
                        <div className="mt-2 flex gap-2">
                          <button
                            type="button"
                            disabled={submitting || deletingId !== null}
                            onClick={() => handleEdit(r)}
                            className="rounded-lg border border-white/20 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/80 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-45"
                          >
                            {t(language, "Edit", "Editar")}
                          </button>
                          <button
                            type="button"
                            disabled={submitting || deletingId !== null}
                            onClick={() => requestDeleteEntry(r.id)}
                            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-300 transition-colors hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-45"
                          >
                            {deletingId === r.id ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden /> : null}
                            {deletingId === r.id
                              ? t(language, "Deleting…", "Eliminando…")
                              : t(language, "Delete", "Eliminar")}
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
      <style jsx global>{`
        .model-weekly-availability-page .weekly-avail-time-input {
          accent-color: rgb(236 72 153);
          color-scheme: dark;
        }
        .model-weekly-availability-page .weekly-avail-time-input::-webkit-calendar-picker-indicator {
          filter: invert(0.85) sepia(1) saturate(5) hue-rotate(280deg) opacity(0.85);
          cursor: pointer;
        }
      `}</style>
    <ConfirmDialog
      open={deleteConfirmId != null}
      onClose={() => deletingId == null && setDeleteConfirmId(null)}
      onConfirm={() => {
        const id = deleteConfirmId;
        if (id) return runDeleteEntry(id);
      }}
      title={t(language, "Delete this entry?", "¿Eliminar esta entrada?")}
      description={t(
        language,
        "This removes your availability entry for this week. This cannot be undone.",
        "Se eliminará tu entrada de disponibilidad para esta semana. No se puede deshacer."
      )}
      confirmLabel={t(language, "Delete", "Eliminar")}
      confirmVariant="danger"
      loading={deletingId != null}
    />
    </>
  );
}
