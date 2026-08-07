"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Calendar, Clock, Gauge, Layers, ListChecks, Palmtree, Plus, StickyNote, Timer, X } from "lucide-react";
import { addDays, getThisWeekMonday, formatWeekLabel, WEEKLY_PROGRAM_DAY_OPTIONS, normalizeWeekStart } from "@/lib/weekly-program";
import { formatTimeRange, formatDateLong, formatScheduleWeekdayDateLine, formatScheduleItemTypeForDisplay } from "@/lib/format";
import { adminModelScheduleUrl, modelScheduleUrl } from "@/lib/routes";
import type {
  ModelAvailabilityTimeWindow,
  ModelScheduleItem,
  ModelPeriodRecord,
  ModelWeeklyAvailabilityRequest,
  ModelTimeOffRequest,
  WeeklyProgramDay,
} from "@/types";
import { formatModelAvailabilityWindows, validateTimeWindows } from "@/lib/model-availability-windows";
import {
  FormField,
  FormInput,
  FormSelect,
  FormTextarea,
  FormSubmitButton,
  selectOptionClass,
} from "@/components/forms";
import { BeautifulDetailModal } from "@/components/beautiful-detail-modal";
import { gradientClassForScheduleItemType } from "@/lib/detail-modal-gradients";
import { useLanguage } from "@/lib/language-provider";
import { useTranslations } from "@/lib/use-translations";
import { cn } from "@/lib/utils";

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

function formatErrorPayload(error: unknown): string {
  if (typeof error === "string" && error.trim()) return error.trim();
  if (error && typeof error === "object" && "error" in error) {
    const e = (error as { error: unknown }).error;
    if (typeof e === "string") return e;
  }
  return "Something went wrong.";
}

type Props = {
  modelId: string;
  weekStart: string;
  currentPeriod: ModelPeriodRecord | null;
  initialTimeOff: ModelTimeOffRequest[];
  initialAction?: string | null;
  /** When true, week nav links stay on admin model-schedules (with model query). */
  adminWeekNav?: boolean;
  /** When true, render Mon–Sun program grid + item modal (admin). Model availability page passes false. */
  showProgramGrid?: boolean;
  /** Below: used only when `showProgramGrid` is true */
  initialItems?: ModelScheduleItem[];
  periodDates?: string[];
  predictedPeriodStart?: string | null;
  initialAvailability?: ModelWeeklyAvailabilityRequest[];
};

export function ModelScheduleClient({
  modelId,
  weekStart: initialWeekStart,
  currentPeriod,
  initialTimeOff,
  initialAction,
  adminWeekNav = false,
  showProgramGrid = true,
  initialItems = [],
  periodDates = [],
  predictedPeriodStart = null,
  initialAvailability = [],
}: Props) {
  const { t } = useTranslations();
  const { language } = useLanguage();
  const locale = language === "es" ? "es" : "en-GB";

  const itemTypeLabel = React.useCallback(
    (itemType: string) => {
      const key = `schedule.itemTypes.${itemType}` as const;
      const resolved = t(key);
      return resolved !== key ? resolved : itemType;
    },
    [t]
  );

  const router = useRouter();
  const searchParams = useSearchParams();
  const weekStart = normalizeWeekStart(searchParams.get("week_start") || initialWeekStart);
  const actionFromUrl =
    searchParams.get("action") === "submit" || searchParams.get("action") === "request-off"
      ? (searchParams.get("action") as "submit" | "request-off")
      : null;

  const [items, setItems] = React.useState(initialItems);
  const [availability, setAvailability] = React.useState(initialAvailability);
  const [timeOff, setTimeOff] = React.useState(initialTimeOff);
  const [selectedItem, setSelectedItem] = React.useState<ModelScheduleItem | null>(null);

  const [availDay, setAvailDay] = React.useState<WeeklyProgramDay>("Monday");
  const [availWindows, setAvailWindows] = React.useState<ModelAvailabilityTimeWindow[]>([
    { start: "09:00", end: "17:00" },
  ]);
  const [availNotes, setAvailNotes] = React.useState("");
  const [availSubmitting, setAvailSubmitting] = React.useState(false);

  const [offStart, setOffStart] = React.useState(weekStart);
  const [offEnd, setOffEnd] = React.useState(weekStart);
  const [offReason, setOffReason] = React.useState("");
  const [offSubmitting, setOffSubmitting] = React.useState(false);
  const [cancellingOffId, setCancellingOffId] = React.useState<string | null>(null);

  const availabilityFormRef = React.useRef<HTMLDivElement>(null);
  const timeOffFormRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => setItems(initialItems), [initialItems]);
  React.useEffect(() => {
    if (!showProgramGrid) return;
    setAvailability(initialAvailability);
  }, [initialAvailability, weekStart, showProgramGrid]);
  React.useEffect(() => setTimeOff(initialTimeOff), [initialTimeOff, weekStart]);

  const periodDateSet = React.useMemo(() => (showProgramGrid ? new Set(periodDates) : new Set<string>()), [periodDates, showProgramGrid]);

  const weekDates = React.useMemo(
    () => (showProgramGrid ? Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)) : []),
    [weekStart, showProgramGrid]
  );

  const itemsByDate = React.useMemo(() => {
    if (!showProgramGrid) return new Map<string, ModelScheduleItem[]>();
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
  }, [items, showProgramGrid]);

  const availabilityByDay = React.useMemo(() => {
    if (!showProgramGrid) return new Map<WeeklyProgramDay, ModelWeeklyAvailabilityRequest[]>();
    const m = new Map<WeeklyProgramDay, ModelWeeklyAvailabilityRequest[]>();
    for (const d of WEEKLY_PROGRAM_DAY_OPTIONS) m.set(d, []);
    for (const r of availability) {
      if (r.week_start !== weekStart) continue;
      const list = m.get(r.day) ?? [];
      list.push(r);
      m.set(r.day, list);
    }
    return m;
  }, [availability, weekStart, showProgramGrid]);

  const scrollTarget = initialAction ?? actionFromUrl;
  React.useEffect(() => {
    if (scrollTarget === "submit" && availabilityFormRef.current) {
      availabilityFormRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    if (scrollTarget === "request-off" && timeOffFormRef.current) {
      timeOffFormRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [scrollTarget]);

  const scheduleHref = (monday: string) =>
    adminWeekNav
      ? adminModelScheduleUrl({ modelId, weekStart: monday })
      : monday === getThisWeekMonday()
        ? modelScheduleUrl()
        : modelScheduleUrl({ weekStart: monday });

  const prevWeek = addDays(weekStart, -7);
  const nextWeek = addDays(weekStart, 7);

  const endDateLabel = currentPeriod?.end_date ? formatDateLong(currentPeriod.end_date, locale) : "";

  const onSubmitAvailability = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = validateTimeWindows(availWindows);
    if (!v.ok) {
      toast.error(v.error);
      return;
    }
    setAvailSubmitting(true);
    try {
      const res = await fetch("/api/model/availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          week_start: weekStart,
          day: availDay,
          windows: v.normalized,
          notes: availNotes.trim() || undefined,
        }),
      });
      const data = (await res.json()) as { success?: boolean; error?: unknown };
      if (!res.ok) {
        toast.error(formatErrorPayload(data.error));
        return;
      }
      toast.success(t("schedule.availabilitySubmitted"));
      setAvailNotes("");
      setAvailWindows([{ start: "09:00", end: "17:00" }]);
      router.refresh();
    } catch {
      toast.error(t("common.networkError"));
    } finally {
      setAvailSubmitting(false);
    }
  };

  const cancellableTimeOff = React.useMemo(() => {
    return timeOff.filter((t) => {
      const st = (t.status ?? "").trim().toLowerCase();
      return st === "pending" || st === "scheduled" || st === "submitted";
    });
  }, [timeOff]);

  const onCancelTimeOff = async (requestId: string) => {
    setCancellingOffId(requestId);
    try {
      const res = await fetch(`/api/model/time-off/${encodeURIComponent(requestId)}`, {
        method: "DELETE",
      });
      const data = (await res.json().catch(() => ({}))) as { error?: unknown };
      if (!res.ok) {
        toast.error(formatErrorPayload(data.error));
        return;
      }
      toast.success(t("schedule.timeOffCancelled"));
      setTimeOff((prev) => prev.filter((x) => x.id !== requestId));
      router.refresh();
    } catch {
      toast.error(t("common.networkError"));
    } finally {
      setCancellingOffId(null);
    }
  };

  const onSubmitTimeOff = async (e: React.FormEvent) => {
    e.preventDefault();
    setOffSubmitting(true);
    try {
      const res = await fetch("/api/model/time-off", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          start_date: offStart.slice(0, 10),
          end_date: offEnd.slice(0, 10),
          reason: offReason.trim(),
        }),
      });
      const data = (await res.json()) as { success?: boolean; error?: unknown };
      if (!res.ok) {
        toast.error(formatErrorPayload(data.error));
        return;
      }
      toast.success(t("schedule.timeOffSent"));
      setOffReason("");
      router.refresh();
    } catch {
      toast.error(t("common.networkError"));
    } finally {
      setOffSubmitting(false);
    }
  };

  function dateInTimeOff(date: string): ModelTimeOffRequest[] {
    return timeOff.filter((r) => date >= r.start_date && date <= r.end_date);
  }

  return (
    <div className="space-y-8">
      {currentPeriod && endDateLabel && (
        <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
          {t("schedule.inPeriodBanner", { end: endDateLabel })}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-black/40 p-4 backdrop-blur-xl">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={scheduleHref(prevWeek)}
            className="rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/90 hover:bg-white/10"
          >
            ← {t("common.previous")}
          </Link>
          <Link
            href={scheduleHref(getThisWeekMonday())}
            className="rounded-xl border border-[hsl(330,80%,55%)]/40 bg-[hsl(330,80%,55%)]/15 px-4 py-2.5 text-sm font-medium text-[hsl(330,90%,75%)]"
          >
            {t("common.thisWeek")}
          </Link>
          <Link
            href={scheduleHref(nextWeek)}
            className="rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/90 hover:bg-white/10"
          >
            {t("common.next")} →
          </Link>
        </div>
        <span className="text-sm font-medium text-white/80">{formatWeekLabel(weekStart)}</span>
      </div>

      {showProgramGrid ? (
      <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {weekDates.map((date, idx) => {
          const dayItems = itemsByDate.get(date) ?? [];
            const weekday = WEEKLY_PROGRAM_DAY_OPTIONS[idx] ?? "Monday";
            const availRows = availabilityByDay.get(weekday) ?? [];
            const offRows = dateInTimeOff(date);
            const predictedDay = predictedPeriodStart && date === predictedPeriodStart;
            const activePeriodDay = periodDateSet.has(date);
          return (
              <div
                key={date}
                className={cn(
                  "rounded-2xl border p-4 backdrop-blur-xl",
                  activePeriodDay
                    ? "border-rose-400/35 bg-rose-500/10"
                    : predictedDay
                      ? "border-amber-300/45 border-dashed bg-amber-500/[0.06]"
                      : "border-white/10 bg-black/40"
                )}
              >
                {activePeriodDay && (
                  <div className="mb-2 flex items-center gap-1">
                    <div className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
                    <span className="text-xs text-red-400">{t("schedule.periodDay")}</span>
                  </div>
                )}
                {predictedDay && !activePeriodDay && (
                  <div className="mb-2 flex items-center gap-1">
                    <div className="h-2 w-2 rounded-full bg-amber-400" />
                    <span className="text-xs text-amber-300">{t("schedule.predictedPeriod")}</span>
                  </div>
                )}
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/50">{formatScheduleWeekdayDateLine(date, locale)}</p>
                {offRows.length > 0 && (
                  <div className="mb-3 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-100/90">
                    <span className="font-medium">{t("schedule.timeOff")}</span>
                    {offRows.map((o) => (
                      <p key={o.id} className="mt-1 text-white/70">
                        {o.reason.slice(0, 80)}
                        {o.reason.length > 80 ? "…" : ""}
                      </p>
                    ))}
                </div>
              )}
                {availRows.length > 0 && (
                  <ul className="mb-3 space-y-1.5 border-b border-white/10 pb-3">
                    {availRows.map((r) => (
                      <li key={r.id} className="text-xs text-[hsl(330,90%,78%)]/90">
                        <span className="font-medium text-white/80">{r.entry_type}</span>
                        {r.time_windows.length > 0 ? (
                          <span className="ml-1 text-white/60">{formatModelAvailabilityWindows(r.time_windows)}</span>
                        ) : r.start_time && r.end_time ? (
                          <span className="ml-1 text-white/60">{formatTimeRange(r.start_time, r.end_time)}</span>
                        ) : null}
                        {r.notes?.trim() ? <span className="mt-0.5 block text-white/45">{r.notes}</span> : null}
                      </li>
                    ))}
                  </ul>
                )}
              {dayItems.length === 0 ? (
                  <p className="py-4 text-sm text-white/40">{t("schedule.noScheduleItems")}</p>
              ) : (
                <ul className="space-y-2">
                  {dayItems.map((item) => {
                    const locationLine =
                      item.item_type === "content_shoot"
                        ? (item.details?.match(/^Location:\s*(.+)$/m)?.[1]?.trim() || "")
                        : "";
                    return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedItem(item)}
                          className="w-full rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3 text-left transition-colors hover:border-white/20 hover:bg-white/[0.1]"
                      >
                          <div className="flex items-start justify-between gap-2">
                            <span className="min-w-0 flex-1 font-semibold capitalize text-white">
                              {item.title?.trim() || itemTypeLabel(item.item_type)}
                            </span>
                        {(item.start_time || item.end_time) && (
                              <span className="shrink-0 whitespace-nowrap text-xs tabular-nums text-white/50">
                            {formatTimeRange(item.start_time, item.end_time)}
                          </span>
                        )}
                          </div>
                        {item.item_type === "content_shoot" ? (
                          <p className="mt-1 text-xs text-emerald-300/80">
                            {itemTypeLabel(item.item_type)}
                            {locationLine ? ` · ${locationLine}` : ""}
                          </p>
                        ) : null}
                        {item.duration_minutes != null && (
                            <p className="mt-1 text-xs text-white/50">{item.duration_minutes} min</p>
                        )}
                      </button>
                    </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>
      ) : null}

      <div ref={availabilityFormRef} className="scroll-mt-24 space-y-4 rounded-2xl border border-white/10 bg-black/40 p-6 backdrop-blur-xl">
        <h2 className="text-lg font-semibold text-white">{t("schedule.submitAvailability")}</h2>
        <p className="text-sm text-white/55">{t("schedule.availFormHint")}</p>
        <form onSubmit={onSubmitAvailability} className="space-y-4">
          <FormField label={t("common.week")} icon={<Calendar />} htmlFor="sched-avail-week">
            <p id="sched-avail-week" className="text-sm text-white/80">
              {formatWeekLabel(weekStart)}
            </p>
          </FormField>
          <FormField label={t("common.day")} icon={<Calendar />} htmlFor="sched-avail-day">
            <FormSelect
              id="sched-avail-day"
              value={availDay}
              onChange={(e) => setAvailDay(e.target.value as WeeklyProgramDay)}
              className={selectOptionClass}
            >
              {WEEKLY_PROGRAM_DAY_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </FormSelect>
          </FormField>
          <div className="space-y-4">
            {availWindows.map((w, idx) => (
              <div key={idx}>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-white/45">
                  {t("schedule.availWindow", { n: idx + 1 })}
                </p>
                <div className="flex flex-wrap items-end gap-2">
                  <div className="min-w-[100px] flex-1">
                    <FormField label={t("common.startTime")} icon={<Clock />} htmlFor={`sched-avail-start-${idx}`} required>
                      <FormInput
                        id={`sched-avail-start-${idx}`}
                        type="time"
                        value={w.start}
                        onChange={(e) =>
                          setAvailWindows((prev) => {
                            const next = [...prev];
                            next[idx] = { ...next[idx]!, start: e.target.value };
                            return next;
                          })
                        }
                        required
                      />
                    </FormField>
                  </div>
                  <span className="hidden self-center text-sm text-white/40 sm:inline md:pb-2">{t("common.to")}</span>
                  <div className="min-w-[100px] flex-1">
                    <FormField label={t("common.endTime")} icon={<Clock />} htmlFor={`sched-avail-end-${idx}`} required>
                      <FormInput
                        id={`sched-avail-end-${idx}`}
                        type="time"
                        value={w.end}
                        onChange={(e) =>
                          setAvailWindows((prev) => {
                            const next = [...prev];
                            next[idx] = { ...next[idx]!, end: e.target.value };
                            return next;
                          })
                        }
                        required
                      />
                    </FormField>
                  </div>
                  {idx > 0 && (
                    <button
                      type="button"
                      onClick={() => setAvailWindows((prev) => prev.filter((_, i) => i !== idx))}
                      className="mb-3 shrink-0 rounded-lg p-2 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                      aria-label={t("common.remove")}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setAvailWindows((prev) => [...prev, { start: "", end: "" }])}
              className="inline-flex items-center gap-1 text-xs font-medium text-[hsl(330,90%,72%)] hover:text-[hsl(330,90%,82%)]"
            >
              <Plus className="h-3 w-3 shrink-0" />
              {t("schedule.addAnotherWindow")}
            </button>
          </div>
          <FormField label={t("common.notes")} icon={<StickyNote />} htmlFor="sched-avail-notes">
            <FormTextarea id="sched-avail-notes" value={availNotes} onChange={(e) => setAvailNotes(e.target.value)} rows={3} />
          </FormField>
          <FormSubmitButton loading={availSubmitting}>
            {availSubmitting ? t("common.saving") : t("schedule.submitAvailability")}
          </FormSubmitButton>
        </form>
      </div>

      {cancellableTimeOff.length > 0 ? (
        <div className="scroll-mt-24 space-y-4 rounded-2xl border border-amber-500/25 bg-amber-500/[0.07] p-6 backdrop-blur-xl">
          <h2 className="text-lg font-semibold text-white">{t("schedule.pendingTimeOff")}</h2>
          <ul className="space-y-3">
            {cancellableTimeOff.map((req) => (
              <li
                key={req.id}
                className="flex flex-col gap-3 rounded-xl border border-white/10 bg-black/30 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 text-sm">
                  <p className="font-medium text-white">
                    {(req.start_date || "").slice(0, 10)} → {(req.end_date || "").slice(0, 10)}
                  </p>
                  <p className="mt-1 text-white/55">{req.reason?.trim() || "—"}</p>
                  <p className="mt-1 text-xs capitalize text-white/40">{req.status}</p>
                </div>
                <button
                  type="button"
                  disabled={cancellingOffId === req.id}
                  onClick={() => void onCancelTimeOff(req.id)}
                  className="shrink-0 rounded-lg border border-red-500/35 bg-red-500/15 px-3 py-1.5 text-xs font-semibold text-red-300 transition hover:bg-red-500/25 disabled:opacity-45"
                >
                  {cancellingOffId === req.id ? t("common.saving") : t("schedule.cancelTimeOff")}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div ref={timeOffFormRef} className="scroll-mt-24 space-y-4 rounded-2xl border border-white/10 bg-black/40 p-6 backdrop-blur-xl">
        <h2 className="text-lg font-semibold text-white">{t("schedule.requestTimeOff")}</h2>
        <p className="text-sm text-white/55">{t("schedule.timeOffFormHint")}</p>
        <form onSubmit={onSubmitTimeOff} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label={t("schedule.startDate")} icon={<Palmtree />} htmlFor="sched-off-start" required>
              <FormInput id="sched-off-start" type="date" value={offStart.slice(0, 10)} onChange={(e) => setOffStart(e.target.value)} required />
            </FormField>
            <FormField label={t("schedule.endDate")} icon={<Palmtree />} htmlFor="sched-off-end" required>
              <FormInput id="sched-off-end" type="date" value={offEnd.slice(0, 10)} onChange={(e) => setOffEnd(e.target.value)} required />
            </FormField>
          </div>
          <FormField label={t("common.reason")} icon={<StickyNote />} htmlFor="sched-off-reason" required>
            <FormTextarea id="sched-off-reason" value={offReason} onChange={(e) => setOffReason(e.target.value)} rows={4} required />
          </FormField>
          <FormSubmitButton loading={offSubmitting}>
            {offSubmitting ? t("common.saving") : t("schedule.submitRequest")}
          </FormSubmitButton>
        </form>
      </div>

      {showProgramGrid ? (
      <BeautifulDetailModal
        open={selectedItem != null}
        onOpenChange={(open) => {
          if (!open) setSelectedItem(null);
        }}
        title={selectedItem?.title || t("schedule.scheduleItem")}
        subtitle={
          selectedItem
            ? `${(() => {
                const l = itemTypeLabel(selectedItem.item_type);
                return l.startsWith("schedule.itemTypes.")
                  ? formatScheduleItemTypeForDisplay(selectedItem.item_type)
                  : l;
              })()} · ${formatDateLong(selectedItem.date)}${
                selectedItem.start_time || selectedItem.end_time
                  ? ` · ${formatTimeRange(selectedItem.start_time, selectedItem.end_time)}`
                  : ""
              }`
            : ""
        }
        badge={
          selectedItem?.item_type === "live_stream" ? t("schedule.liveStreamDetails") : t("schedule.scheduleDetail")
        }
        headerGradientClass={selectedItem ? gradientClassForScheduleItemType(selectedItem.item_type) : undefined}
        stats={
          selectedItem
            ? [
                {
                  label: t("common.type"),
                  value: (() => {
                    const lbl = itemTypeLabel(selectedItem.item_type);
                    if (lbl.startsWith("schedule.itemTypes.")) {
                      return formatScheduleItemTypeForDisplay(selectedItem.item_type);
                    }
                    return lbl;
                  })(),
                  accent: "pink" as const,
                  icon: <Layers className="h-5 w-5" aria-hidden />,
                },
                {
                  label: t("common.status"),
                  value: selectedItem.status || "—",
                  accent: "purple" as const,
                  icon: <ListChecks className="h-5 w-5" aria-hidden />,
                },
                {
                  label: t("common.priority"),
                  value: selectedItem.priority || "—",
                  accent: "amber" as const,
                  icon: <Gauge className="h-5 w-5" aria-hidden />,
                },
                {
                  label: t("common.duration"),
                  value: selectedItem.duration_minutes != null ? `${selectedItem.duration_minutes} min` : "—",
                  accent: "blue" as const,
                  icon: <Timer className="h-5 w-5" aria-hidden />,
                },
              ]
            : []
        }
        description={selectedItem ? getDetails(selectedItem, language) || undefined : undefined}
        footer={
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setSelectedItem(null)}
              className="rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/90 hover:bg-white/10"
            >
              {t("common.close")}
            </button>
          </div>
        }
      >
        {selectedItem && getInstructions(selectedItem, language) ? (
          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-white/45">{t("common.instructions")}</p>
            <p className="mt-2 whitespace-pre-wrap text-sm text-white/75">{getInstructions(selectedItem, language)}</p>
          </section>
        ) : null}
      </BeautifulDetailModal>
      ) : null}
    </div>
  );
}
