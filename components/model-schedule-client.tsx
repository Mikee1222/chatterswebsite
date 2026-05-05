"use client";

import * as React from "react";
import Link from "next/link";
import { addDays, getThisWeekMonday, formatWeekLabel } from "@/lib/weekly-program";
import { formatTimeRange, formatDateLong } from "@/lib/format";
import { ROUTES } from "@/lib/routes";
import type { ModelScheduleItem, ModelPeriodRecord } from "@/types";

const ITEM_TYPE_LABELS: Record<string, { en: string; es: string }> = {
  script: { en: "Script", es: "Guion" },
  mass_message: { en: "Mass message", es: "Mensaje masivo" },
  live_stream: { en: "Live stream", es: "Transmisión en vivo" },
  custom: { en: "Custom", es: "Personalizado" },
  content_shoot: { en: "Content shoot", es: "Grabación de contenido" },
  promo: { en: "Promo", es: "Promo" },
  meeting: { en: "Meeting", es: "Reunión" },
  rest: { en: "Rest", es: "Descanso" },
  other: { en: "Other", es: "Otro" },
};

function t(lang: "en" | "es", en: string, es: string) {
  return lang === "es" ? es : en;
}

function getInstructions(item: ModelScheduleItem, lang: "en" | "es"): string {
  if (lang === "es" && item.instructions_es?.trim()) return item.instructions_es;
  if (item.instructions_en?.trim()) return item.instructions_en;
  return item.instructions || "";
}

function getDetails(item: ModelScheduleItem, lang: "en" | "es"): string {
  if (lang === "es" && item.details_es?.trim()) return item.details_es;
  if (item.details_en?.trim()) return item.details_en;
  return item.details || "";
}

type Props = {
  modelId: string;
  language: "en" | "es";
  initialItems: ModelScheduleItem[];
  /** Monday YYYY-MM-DD for the visible week (from server / URL). */
  weekStart: string;
  periodDates: string[];
  currentPeriod: ModelPeriodRecord | null;
};

export function ModelScheduleClient({
  modelId,
  language,
  initialItems,
  weekStart,
  periodDates,
  currentPeriod,
}: Props) {
  const [items] = React.useState(initialItems);
  const [selectedItem, setSelectedItem] = React.useState<ModelScheduleItem | null>(null);

  const periodDateSet = React.useMemo(() => new Set(periodDates), [periodDates]);

  const weekDates = React.useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  }, [weekStart]);

  const itemsByDate = React.useMemo(() => {
    const map = new Map<string, ModelScheduleItem[]>();
    for (const item of items) {
      if (!item.date) continue;
      const list = map.get(item.date) ?? [];
      list.push(item);
      map.set(item.date, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => (a.start_time || "").localeCompare(b.start_time || ""));
    }
    return map;
  }, [items]);

  const prevWeek = addDays(weekStart, -7);
  const nextWeek = addDays(weekStart, 7);
  const scheduleHref = (monday: string) =>
    `${ROUTES.model.schedule}${monday === getThisWeekMonday() ? "" : `?week=${encodeURIComponent(monday)}`}`;

  const endDateLabel = currentPeriod?.end_date
    ? formatDateLong(currentPeriod.end_date, language === "es" ? "es" : "en-GB")
    : "";

  return (
    <div className="space-y-6">
      {currentPeriod && endDateLabel && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 mb-4 text-red-400 text-sm">
          {language === "es"
            ? `🔴 Estás en tu periodo (termina ${endDateLabel})`
            : `🔴 You are currently in your period (ends ${endDateLabel})`}
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-black/40 p-4 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <Link
            href={scheduleHref(prevWeek)}
            className="rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/90 hover:bg-white/10"
          >
            ← {t(language, "Previous", "Anterior")}
          </Link>
          <Link
            href={scheduleHref(getThisWeekMonday())}
            className="rounded-xl border border-[hsl(330,80%,55%)]/40 bg-[hsl(330,80%,55%)]/15 px-4 py-2.5 text-sm font-medium text-[hsl(330,90%,75%)]"
          >
            {t(language, "This week", "Esta semana")}
          </Link>
          <Link
            href={scheduleHref(nextWeek)}
            className="rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/90 hover:bg-white/10"
          >
            {t(language, "Next", "Siguiente")} →
          </Link>
        </div>
        <span className="text-sm font-medium text-white/80">{formatWeekLabel(weekStart)}</span>
      </div>

      <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {weekDates.map((date) => {
          const dayItems = itemsByDate.get(date) ?? [];
          const dayName = new Date(date + "T12:00:00").toLocaleDateString(language === "es" ? "es" : "en-US", { weekday: "short" });
          return (
            <div key={date} className="rounded-2xl border border-white/10 bg-black/40 p-4 backdrop-blur-xl">
              {periodDateSet.has(date) && (
                <div className="flex items-center gap-1 mb-2">
                  <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-xs text-red-400">
                    {t(language, "Period day", "Día de periodo")}
                  </span>
                </div>
              )}
              <p className="text-xs font-semibold uppercase tracking-wider text-white/50 mb-2">{dayName} · {formatDateLong(date)}</p>
              {dayItems.length === 0 ? (
                <p className="text-sm text-white/40 py-4">{t(language, "No items", "Sin items")}</p>
              ) : (
                <ul className="space-y-2">
                  {dayItems.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedItem(item)}
                        className="w-full rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3 text-left transition-colors hover:bg-white/[0.1] hover:border-white/20"
                      >
                        <span className="font-medium text-white/90">{item.title || (ITEM_TYPE_LABELS[item.item_type] ? t(language, ITEM_TYPE_LABELS[item.item_type].en, ITEM_TYPE_LABELS[item.item_type].es) : item.item_type)}</span>
                        {(item.start_time || item.end_time) && (
                          <span className="ml-2 text-sm text-white/60">
                            {formatTimeRange(item.start_time, item.end_time)}
                          </span>
                        )}
                        {item.duration_minutes != null && (
                          <span className="ml-2 text-xs text-white/50">{item.duration_minutes} min</span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      {selectedItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setSelectedItem(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-[hsl(240,10%,8%)] p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-white">{selectedItem.title || t(language, "Schedule item", "Elemento del horario")}</h3>
            <p className="mt-1 text-sm text-white/60">
              {ITEM_TYPE_LABELS[selectedItem.item_type] ? t(language, ITEM_TYPE_LABELS[selectedItem.item_type].en, ITEM_TYPE_LABELS[selectedItem.item_type].es) : selectedItem.item_type}
              {" · "}{formatDateLong(selectedItem.date)}
              {(selectedItem.start_time || selectedItem.end_time) && ` · ${formatTimeRange(selectedItem.start_time, selectedItem.end_time)}`}
            </p>
            {selectedItem.priority && <p className="mt-1 text-xs text-white/50">{t(language, "Priority", "Prioridad")}: {selectedItem.priority}</p>}
            {selectedItem.status && <p className="mt-1 text-xs text-white/50">{t(language, "Status", "Estado")}: {selectedItem.status}</p>}
            {getDetails(selectedItem, language) && <p className="mt-3 text-sm text-white/80">{getDetails(selectedItem, language)}</p>}
            {getInstructions(selectedItem, language) && <p className="mt-3 text-sm text-white/70 whitespace-pre-wrap">{getInstructions(selectedItem, language)}</p>}
            <button
              type="button"
              onClick={() => setSelectedItem(null)}
              className="mt-6 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/90 hover:bg-white/10"
            >
              {t(language, "Close", "Cerrar")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
