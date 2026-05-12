"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  Inbox,
  ListChecks,
  Loader2,
  Plus,
  StickyNote,
  X,
} from "lucide-react";
import { submitModelAvailabilityAction, updateModelAvailabilityAction, deleteModelAvailabilityAction } from "@/app/actions/weekly-availability-models";
import { formatTimeRange } from "@/lib/format";
import { validateTimeWindows } from "@/lib/model-availability-windows";
import { modelWeeklyAvailabilityUrl } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { addDays, getThisWeekMonday, normalizeWeekStart } from "@/lib/weekly-program";
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
  WeeklyAvailabilityRequestStatus,
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

function formatUtcWeekRangeLabel(weekMondayYmd: string, lang: "en" | "es"): string {
  const mon = normalizeWeekStart(weekMondayYmd);
  const sun = addDays(mon, 6);
  const locale = lang === "es" ? "es-ES" : "en-GB";
  const opts: Intl.DateTimeFormatOptions = {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  };
  const a = new Date(`${mon}T00:00:00.000Z`).toLocaleDateString(locale, opts);
  const b = new Date(`${sun}T00:00:00.000Z`).toLocaleDateString(locale, opts);
  return `${a} – ${b} · UTC`;
}

function utcDayShortLabel(ymd: string, lang: "en" | "es"): string {
  const s = ymd.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return "";
  const locale = lang === "es" ? "es-ES" : "en-GB";
  return new Date(`${s}T12:00:00.000Z`).toLocaleDateString(locale, {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function statusFriendlyLabel(lang: "en" | "es", status: WeeklyAvailabilityRequestStatus): string {
  const map: Record<WeeklyAvailabilityRequestStatus, [string, string]> = {
    submitted: ["Submitted", "Enviado"],
    reviewed: ["Reviewed", "Revisado"],
    used: ["Used in schedule", "Usado en el horario"],
    rejected: ["Rejected", "Rechazado"],
  };
  const pair = map[status];
  return pair ? t(lang, pair[0], pair[1]) : status;
}

function statusCardRing(status: WeeklyAvailabilityRequestStatus): string {
  switch (status) {
    case "submitted":
      return "border-amber-500/55 ring-1 ring-amber-500/20";
    case "reviewed":
      return "border-sky-400/50 ring-1 ring-sky-400/15";
    case "used":
      return "border-emerald-500/50 ring-1 ring-emerald-500/15";
    case "rejected":
      return "border-red-500/55 ring-1 ring-red-500/20";
    default:
      return "border-white/12";
  }
}

function statusBadgeClass(status: WeeklyAvailabilityRequestStatus): string {
  switch (status) {
    case "submitted":
      return "border-amber-500/25 bg-amber-500/15 text-amber-100";
    case "reviewed":
      return "border-sky-400/25 bg-sky-500/15 text-sky-100";
    case "used":
      return "border-emerald-500/25 bg-emerald-500/15 text-emerald-100";
    case "rejected":
      return "border-red-500/30 bg-red-500/15 text-red-100";
    default:
      return "border-white/15 bg-white/10 text-white/75";
  }
}

function entryTypeLabel(lang: "en" | "es", type: ModelAvailabilityEntryType): string {
  const row = ENTRY_TYPES.find((e) => e.value === type);
  return row ? t(lang, row.labelEn, row.labelEs) : type;
}

function canEditOrDelete(status: WeeklyAvailabilityRequestStatus): boolean {
  return status === "submitted" || status === "reviewed";
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

  const formRef = React.useRef<HTMLDivElement>(null);
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

  const startEdit = (r: ModelWeeklyAvailabilityRequest) => {
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
    requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const handleCancelEdit = () => {
    setEditingRequest(null);
    setTimeWindows([...DEFAULT_TIME_WINDOWS]);
    setEntryType("availability");
    setDay("Monday");
    setNotes("");
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
        setEntryType("availability");
        setDay("Monday");
        setNotes("");
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
        if (editingRequest?.id === recordId) handleCancelEdit();
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
    return DAYS.map((d, idx) => ({
      day: d,
      dateYmd: addDays(weekStart, idx),
      entries: requests.filter((r) => r.day === d),
    }));
  }, [requests, weekStart]);

  const periodDateSet = React.useMemo(() => new Set(periodDatesThisWeek), [periodDatesThisWeek]);

  return (
    <>
      <div className="space-y-8">
        <div
          className="rounded-2xl border border-white/10 bg-black/40 px-6 py-5 backdrop-blur-xl"
          style={{
            boxShadow:
              "0 0 0 1px rgba(255,255,255,0.05), 0 0 32px -8px hsl(330 80% 55% / 0.08)",
          }}
        >
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
          <div className="rounded-2xl border border-[hsl(330,80%,55%)]/30 bg-[hsl(330,80%,55%)]/10 px-5 py-4 text-sm text-[hsl(330,90%,75%)]">
            {success}
          </div>
        )}

        <div
          className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-black/45 p-5 backdrop-blur-xl sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"
          style={{
            boxShadow: "0 0 0 1px rgba(255,255,255,0.05), 0 0 24px -8px hsl(330 80% 55% / 0.06)",
          }}
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">
              {t(language, "Week", "Semana")}
            </span>
            <button
              type="button"
              onClick={() => goToWeek(-1)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/14 bg-white/[0.06] px-3 py-2 text-sm font-medium text-white/90 shadow-sm transition-colors hover:border-white/22 hover:bg-white/10"
            >
              <ChevronLeft className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
              {t(language, "Previous", "Anterior")}
            </button>
            <button
              type="button"
              onClick={() => router.push(modelWeeklyAvailabilityUrl(getThisWeekMonday()))}
              className="rounded-xl border border-[hsl(330,80%,52%)]/45 bg-[hsl(330,80%,55%)]/18 px-4 py-2 text-sm font-semibold text-[hsl(330,92%,78%)] shadow-[0_0_20px_-6px_hsl(330_80%_55%/0.35)] transition-colors hover:bg-[hsl(330,80%,55%)]/28"
            >
              {t(language, "This week", "Esta semana")}
            </button>
            <button
              type="button"
              onClick={() => goToWeek(1)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/14 bg-white/[0.06] px-3 py-2 text-sm font-medium text-white/90 shadow-sm transition-colors hover:border-white/22 hover:bg-white/10"
            >
              {t(language, "Next", "Siguiente")}
              <ChevronRight className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
            </button>
          </div>
          <div className="min-w-0 sm:max-w-[min(100%,28rem)] sm:text-right">
            <p className="text-xs font-medium uppercase tracking-wider text-white/40">{t(language, "Week range (UTC)", "Rango semanal (UTC)")}</p>
            <p className="mt-0.5 text-sm font-semibold leading-snug tracking-tight text-white/90">{formatUtcWeekRangeLabel(weekStart, language)}</p>
          </div>
          <p className="w-full text-xs leading-relaxed text-white/45 sm:basis-full sm:text-right">
            {t(
              language,
              "Pink dot on a day: period — content restrictions may apply.",
              "Punto rosa: día de período — pueden aplicarse restricciones."
            )}
          </p>
        </div>

        {requests.length > 0 && (
          <div className="mb-4 flex items-center gap-2 rounded-2xl border border-green-500/20 bg-green-500/10 px-4 py-3 md:hidden">
            <span className="text-sm font-semibold text-green-400">
              ✅ {requests.length} {requests.length === 1 ? "entry" : "entries"} submitted this week
            </span>
            <span className="ml-auto text-xs text-green-400/50">Scroll down to see →</span>
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          <div
            className="flex min-h-[22rem] flex-col overflow-hidden rounded-2xl border border-white/10 bg-black/40 backdrop-blur-xl md:sticky md:top-4 md:self-start md:max-h-[calc(100vh-6rem)] md:order-2"
            style={{
              boxShadow: "0 0 0 1px rgba(255,255,255,0.05), 0 0 24px -8px hsl(330 80% 55% / 0.06)",
            }}
          >
            <div className="flex flex-wrap items-end justify-between gap-2 border-b border-white/10 bg-white/[0.04] px-5 py-4">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-white/90">
                  {t(language, "This week's submissions", "Envíos de esta semana")}
                </h3>
                <p className="mt-1 text-xs text-white/50">
                  {requests.length === 0
                    ? t(language, "No entries yet", "Sin entradas")
                    : t(
                        language,
                        `${requests.length} ${requests.length === 1 ? "entry" : "entries"}`,
                        `${requests.length} ${requests.length === 1 ? "entrada" : "entradas"}`
                      )}
                </p>
              </div>
            </div>

            <div className="flex flex-1 flex-col overflow-hidden">
              {requests.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-14 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-white/35">
                    <Inbox className="h-7 w-7" strokeWidth={1.25} aria-hidden />
                  </div>
                  <p className="text-base font-medium text-white/80">
                    {t(language, "Nothing here yet", "Aún no hay nada")}
                  </p>
                  <p className="max-w-sm text-sm leading-relaxed text-white/50">
                    {t(
                      language,
                      "You have not submitted availability for this week. Add your first entry with the form on the left.",
                      "No has enviado disponibilidad para esta semana. Añade tu primera entrada con el formulario de la izquierda."
                    )}
                  </p>
                </div>
              ) : (
                <div className="max-h-[min(28rem,70vh)] space-y-5 overflow-y-auto p-4">
                  {byDay.map(({ day: d, dateYmd, entries }) => (
                    <section key={d} className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.06] pb-1.5">
                        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/55">{d}</p>
                        <span className="text-[11px] text-white/40">{utcDayShortLabel(dateYmd, language)}</span>
                        {periodDateSet.has(dateYmd) ? <PeriodDayIndicator /> : null}
                      </div>
                      {entries.length === 0 ? (
                        <p className="pl-0.5 text-xs text-white/35">{t(language, "No entries this day.", "Sin entradas este día.")}</p>
                      ) : (
                        <ul className="space-y-2.5">
                          {entries.map((r) => {
                            const showChips = r.entry_type !== "day_off" && r.time_windows.length > 0;
                            const showStartEndLine =
                              r.entry_type !== "day_off" &&
                              !showChips &&
                              Boolean(r.start_time && r.end_time);
                            const mutable = canEditOrDelete(r.status);
                            return (
                              <li
                                key={r.id}
                                className={cn(
                                  "rounded-xl border bg-white/[0.035] px-3.5 py-3 shadow-sm",
                                  statusCardRing(r.status)
                                )}
                              >
                                <div className="flex flex-wrap items-start justify-between gap-2">
                                  <div className="min-w-0 flex-1 space-y-1.5">
                                    <p className="text-[11px] font-semibold uppercase tracking-wide text-[hsl(330,88%,72%)]">
                                      {entryTypeLabel(language, r.entry_type)}
                                    </p>
                                    {showStartEndLine ? (
                                      <p className="text-sm font-medium tabular-nums text-white/88">
                                        {formatTimeRange(r.start_time, r.end_time)}
                                      </p>
                                    ) : null}
                                    {showChips ? (
                                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                                        {r.time_windows.map((w, i) => (
                                          <span
                                            key={`${r.id}-w-${i}`}
                                            className="inline-flex items-center rounded-md border border-white/12 bg-black/30 px-2 py-0.5 font-mono text-[11px] font-medium tabular-nums text-white/85"
                                          >
                                            {w.start}–{w.end}
                                          </span>
                                        ))}
                                      </div>
                                    ) : null}
                                    {r.notes?.trim() ? (
                                      <p className="pt-1 text-xs leading-relaxed text-white/55">{r.notes.trim()}</p>
                                    ) : null}
                                  </div>
                                  <span
                                    className={cn(
                                      "shrink-0 rounded-lg border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                                      statusBadgeClass(r.status)
                                    )}
                                  >
                                    {statusFriendlyLabel(language, r.status)}
                                  </span>
                                </div>
                                {mutable ? (
                                  <div className="mt-3 flex flex-wrap gap-2 border-t border-white/[0.06] pt-3">
                                    <button
                                      type="button"
                                      disabled={submitting || deletingId !== null}
                                      onClick={() => startEdit(r)}
                                      className="rounded-lg border border-white/18 bg-white/[0.06] px-3 py-1.5 text-xs font-medium text-white/85 transition-colors hover:bg-white/12 disabled:cursor-not-allowed disabled:opacity-45"
                                    >
                                      {t(language, "Edit", "Editar")}
                                    </button>
                                    <button
                                      type="button"
                                      disabled={submitting || deletingId !== null}
                                      onClick={() => requestDeleteEntry(r.id)}
                                      className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-500/35 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-200 transition-colors hover:bg-red-500/18 disabled:cursor-not-allowed disabled:opacity-45"
                                    >
                                      {deletingId === r.id ? (
                                        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
                                      ) : null}
                                      {deletingId === r.id
                                        ? t(language, "Deleting…", "Eliminando…")
                                        : t(language, "Delete", "Eliminar")}
                                    </button>
                                  </div>
                                ) : (
                                  <p className="mt-2 border-t border-white/[0.04] pt-2 text-[10px] text-white/38">
                                    {t(
                                      language,
                                      "This entry can no longer be edited from here.",
                                      "Esta entrada ya no se puede editar desde aquí."
                                    )}
                                  </p>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </section>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div
            className="overflow-hidden rounded-2xl border border-white/10 bg-black/40 p-5 backdrop-blur-xl md:order-1"
            style={{
              boxShadow: "0 0 0 1px rgba(255,255,255,0.05), 0 0 24px -8px hsl(330 80% 55% / 0.06)",
            }}
          >
            <div className="mb-4 border-b border-white/10 pb-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-white/90">
                {editingRequest ? t(language, "Edit entry", "Editar entrada") : t(language, "Add entry", "Añadir entrada")}
              </h3>
            </div>

            <div ref={formRef} className="scroll-mt-28">
              {editingRequest && (
                <div className="mb-4 flex flex-col gap-3 rounded-xl border border-[hsl(330,80%,50%)]/35 bg-[hsl(330,80%,55%)]/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-white/85">
                    {t(
                      language,
                      `Editing the entry for ${editingRequest.day}. Save to apply changes, or cancel.`,
                      `Estás editando la entrada del ${editingRequest.day}. Guarda para aplicar los cambios, o cancela.`
                    )}
                  </p>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={handleCancelEdit}
                    className="inline-flex shrink-0 items-center justify-center gap-1.5 self-start rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold text-white/90 transition-colors hover:bg-white/16 disabled:cursor-not-allowed disabled:opacity-45 sm:self-auto"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden />
                    {t(language, "Cancel edit", "Cancelar edición")}
                  </button>
                </div>
              )}

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
                    {submitting
                      ? t(language, "Saving…", "Guardando…")
                      : editingRequest
                        ? t(language, "Save changes", "Guardar cambios")
                        : t(language, "Submit entry", "Enviar entrada")}
                  </FormSubmitButton>
                </motion.div>
              </form>
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
