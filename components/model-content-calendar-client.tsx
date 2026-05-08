"use client";

/**
 * Model content calendar — month grid (no `react-big-calendar` dependency).
 * Date placement:
 * - VA assignments: `scheduled_date` if set, else `deadline` (ISO / date → YYYY-MM-DD).
 * - Customs (admin accepted): `model_scheduled_date`, else `deadline_requested`.
 * - Tasks: `created_at` (no native due date on model_tasks).
 */

import * as React from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import {
  CalendarClock,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Gauge,
  ListChecks,
  Plus,
  Sparkles,
  Timer,
  User,
  X,
} from "lucide-react";
import { ROUTES } from "@/lib/routes";
import { formatDateEuropean } from "@/lib/format";
import { formatDateYmd } from "@/lib/format-date";
import { cn } from "@/lib/utils";
import { BeautifulDetailModal } from "@/components/beautiful-detail-modal";
import {
  gradientClassForCalendarKind,
  gradientClassForContentType,
  gradientClassForCustomRequest,
} from "@/lib/detail-modal-gradients";
import type { CustomRequest, ModelPersonalEvent, ModelPersonalEventType, ModelTaskRecord, VaContentAssignmentRecord } from "@/types";
import { personalEventEmoji, personalEventLabel } from "@/services/model-personal-events";

export type ContentCalendarEvent = {
  id: string;
  kind: "va" | "custom" | "task";
  title: string;
  dateYmd: string;
  status: string;
  sublabel: string;
  va?: VaContentAssignmentRecord;
  custom?: CustomRequest;
  task?: ModelTaskRecord;
};

type PersonalEventForm = {
  event_type: ModelPersonalEventType;
  custom_label: string;
  event_date: string;
  event_time: string;
  notes: string;
};

function toYmd(raw: string | null | undefined): string | null {
  if (raw == null || String(raw).trim() === "") return null;
  const t = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function buildEvents(
  assignments: VaContentAssignmentRecord[],
  customs: CustomRequest[],
  tasks: ModelTaskRecord[]
): ContentCalendarEvent[] {
  const out: ContentCalendarEvent[] = [];
  for (const a of assignments) {
    const dateYmd = toYmd(a.scheduled_date) ?? toYmd(a.deadline) ?? toYmd(a.updated_at);
    if (!dateYmd) continue;
    out.push({
      id: `va-${a.id}`,
      kind: "va",
      title: a.title || "VA assignment",
      dateYmd,
      status: a.status || "—",
      sublabel: a.content_type || "Content",
      va: a,
    });
  }
  for (const c of customs) {
    const dateYmd = toYmd(c.model_scheduled_date) ?? toYmd(c.deadline_requested) ?? toYmd(c.updated_at);
    if (!dateYmd) continue;
    out.push({
      id: `custom-${c.id}`,
      kind: "custom",
      title: c.request_title || "Custom",
      dateYmd,
      status: c.model_status,
      sublabel: c.fan_username || "Custom",
      custom: c,
    });
  }
  for (const t of tasks) {
    const dateYmd = toYmd(t.created_at);
    if (!dateYmd) continue;
    out.push({
      id: `task-${t.id}`,
      kind: "task",
      title: t.title || "Task",
      dateYmd,
      status: t.status,
      sublabel: t.type || "Task",
      task: t,
    });
  }
  return out;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function monthMatrix(year: number, monthIndex0: number): { ymd: string | null; inMonth: boolean }[][] {
  const first = new Date(year, monthIndex0, 1);
  const startPad = first.getDay();
  const daysInMonth = new Date(year, monthIndex0 + 1, 0).getDate();
  const cells: { ymd: string | null; inMonth: boolean }[] = [];
  for (let i = 0; i < startPad; i++) {
    cells.push({ ymd: null, inMonth: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const m = String(monthIndex0 + 1).padStart(2, "0");
    const day = String(d).padStart(2, "0");
    cells.push({ ymd: `${year}-${m}-${day}`, inMonth: true });
  }
  while (cells.length % 7 !== 0) {
    cells.push({ ymd: null, inMonth: false });
  }
  const rows: { ymd: string | null; inMonth: boolean }[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    rows.push(cells.slice(i, i + 7));
  }
  return rows;
}

const kindStyles: Record<ContentCalendarEvent["kind"], string> = {
  va: "border-violet-400/35 bg-violet-500/15 text-violet-100",
  custom: "border-amber-400/35 bg-amber-500/12 text-amber-100",
  task: "border-emerald-400/35 bg-emerald-500/12 text-emerald-100",
};

const personalEventStyles: Record<ModelPersonalEventType, string> = {
  nails: "bg-pink-500/20 border-pink-500/30 text-pink-400",
  lashes: "bg-purple-500/20 border-purple-500/30 text-purple-300",
  hairdresser: "bg-blue-500/20 border-blue-500/30 text-blue-300",
  surgery: "bg-red-500/20 border-red-500/30 text-red-300",
  fillers: "bg-amber-500/20 border-amber-500/30 text-amber-300",
  custom: "bg-slate-500/20 border-slate-500/30 text-slate-200",
};

function detailHeaderGradient(ev: ContentCalendarEvent | null): string | undefined {
  if (!ev) return undefined;
  if (ev.kind === "custom" && ev.custom) return gradientClassForCustomRequest(ev.custom);
  if (ev.kind === "va" && ev.va) return gradientClassForContentType(ev.va.content_type);
  if (ev.kind === "task") return gradientClassForCalendarKind(ev.task?.type ?? "task");
  return undefined;
}

export type ModelContentCalendarClientProps = {
  assignments: VaContentAssignmentRecord[];
  customs: CustomRequest[];
  tasks: ModelTaskRecord[];
  personalEvents: ModelPersonalEvent[];
  modelName?: string;
  openAddEventInitially?: boolean;
};

export function ModelContentCalendarClient({
  assignments,
  customs,
  tasks,
  personalEvents: initialPersonalEvents,
  modelName,
  openAddEventInitially = false,
}: ModelContentCalendarClientProps) {
  const reduceMotion = useReducedMotion();
  const [cursor, setCursor] = React.useState(() => new Date());
  const [typeFilter, setTypeFilter] = React.useState<"all" | "va" | "custom" | "task">("all");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [selected, setSelected] = React.useState<ContentCalendarEvent | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [personalEvents, setPersonalEvents] = React.useState<ModelPersonalEvent[]>(initialPersonalEvents);
  const [savingEvent, setSavingEvent] = React.useState(false);
  const [deletingEventId, setDeletingEventId] = React.useState<string | null>(null);
  const [eventFormError, setEventFormError] = React.useState<string | null>(null);
  const [addEventOpen, setAddEventOpen] = React.useState(openAddEventInitially);
  const [eventForm, setEventForm] = React.useState<PersonalEventForm>({
    event_type: "nails",
    custom_label: "",
    event_date: new Date().toISOString().slice(0, 10),
    event_time: "",
    notes: "",
  });

  const allEvents = React.useMemo(
    () => buildEvents(assignments, customs, tasks),
    [assignments, customs, tasks]
  );

  const statusOptions = React.useMemo(() => {
    const s = new Set<string>();
    for (const e of allEvents) s.add(e.status);
    return ["all", ...[...s].sort()];
  }, [allEvents]);

  const events = React.useMemo(() => {
    return allEvents.filter((e) => {
      if (typeFilter !== "all" && e.kind !== typeFilter) return false;
      if (statusFilter !== "all" && e.status !== statusFilter) return false;
      return true;
    });
  }, [allEvents, typeFilter, statusFilter]);

  const year = cursor.getFullYear();
  const monthIndex0 = cursor.getMonth();
  const matrix = React.useMemo(() => monthMatrix(year, monthIndex0), [year, monthIndex0]);

  const byDay = React.useMemo(() => {
    const m = new Map<string, ContentCalendarEvent[]>();
    for (const e of events) {
      const list = m.get(e.dateYmd) ?? [];
      list.push(e);
      m.set(e.dateYmd, list);
    }
    return m;
  }, [events]);
  const personalByDay = React.useMemo(() => {
    const m = new Map<string, ModelPersonalEvent[]>();
    for (const ev of personalEvents) {
      const list = m.get(ev.event_date) ?? [];
      list.push(ev);
      m.set(ev.event_date, list);
    }
    for (const list of m.values()) {
      list.sort((a, b) => (a.event_time ?? "").localeCompare(b.event_time ?? ""));
    }
    return m;
  }, [personalEvents]);

  const monthLabel = cursor.toLocaleString(undefined, { month: "long", year: "numeric" });

  React.useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 3200);
    return () => clearTimeout(t);
  }, [notice]);

  async function submitPersonalEvent() {
    setEventFormError(null);
    if (!eventForm.event_date) {
      setEventFormError("Date is required.");
      return;
    }
    if (eventForm.event_type === "custom" && !eventForm.custom_label.trim()) {
      setEventFormError("Custom label is required.");
      return;
    }
    setSavingEvent(true);
    try {
      const res = await fetch("/api/model/personal-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_type: eventForm.event_type,
          custom_label: eventForm.custom_label.trim() || undefined,
          event_date: eventForm.event_date,
          event_time: eventForm.event_time.trim() || undefined,
          notes: eventForm.notes.trim() || undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; record?: ModelPersonalEvent };
      if (!res.ok || !data.record) throw new Error(data.error ?? "Failed to create event");
      setPersonalEvents((prev) =>
        [...prev, data.record!].sort((a, b) => a.event_date.localeCompare(b.event_date) || (a.event_time ?? "").localeCompare(b.event_time ?? ""))
      );
      setAddEventOpen(false);
      setEventForm({
        event_type: "nails",
        custom_label: "",
        event_date: new Date().toISOString().slice(0, 10),
        event_time: "",
        notes: "",
      });
      setNotice("Personal event added to calendar.");
    } catch (error) {
      setEventFormError(error instanceof Error ? error.message : "Could not save event.");
    } finally {
      setSavingEvent(false);
    }
  }

  async function deletePersonalEvent(id: string) {
    setDeletingEventId(id);
    try {
      const res = await fetch(`/api/model/personal-events/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Failed to delete event");
      }
      setPersonalEvents((prev) => prev.filter((e) => e.id !== id));
      setNotice("Personal event removed.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not delete event.");
    } finally {
      setDeletingEventId(null);
    }
  }

  return (
    <div className="space-y-6 pb-8 md:space-y-8">
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">Content calendar</h1>
          {modelName ? (
            <p className="mt-1 text-sm text-white/50">
              {modelName} · personal events, VA assignments, approved customs, and tasks
            </p>
          ) : (
            <p className="mt-1 text-sm text-white/50">Personal events, VA assignments, approved customs, and tasks</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setAddEventOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl border border-pink-500/35 bg-pink-500/20 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-pink-100 transition hover:bg-pink-500/30"
        >
          <Plus className="h-4 w-4" />
          Add personal event
        </button>
        <div className="flex flex-wrap items-center gap-2">
          {(["all", "va", "custom", "task"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setTypeFilter(k)}
              className={cn(
                "rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-wide transition-colors",
                typeFilter === k
                  ? "bg-pink-500/25 text-pink-100 ring-1 ring-pink-400/40"
                  : "bg-white/[0.06] text-white/55 hover:bg-white/10 hover:text-white/85"
              )}
            >
              {k === "all" ? "All types" : k === "va" ? "VA" : k === "custom" ? "Customs" : "Tasks"}
            </button>
          ))}
          <label className="flex items-center gap-2 text-xs text-white/50">
            <span className="sr-only">Status</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-white/10 bg-black/50 px-3 py-2 text-xs font-medium text-white focus:border-pink-400/40 focus:outline-none"
            >
              {statusOptions.map((s) => (
                <option key={s} value={s}>
                  {s === "all" ? "All statuses" : s}
                </option>
              ))}
            </select>
          </label>
        </div>
      </motion.div>

      {notice ? (
        <p className="rounded-xl border border-white/10 bg-white/[0.06] px-4 py-2 text-center text-sm text-white/80">
          {notice}
        </p>
      ) : null}

      {events.length === 0 ? (
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-dashed border-white/15 bg-black/30 px-6 py-16 text-center"
        >
          <p className="text-lg font-medium text-white/80">Nothing on the calendar</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-white/45">
            {typeFilter !== "all" || statusFilter !== "all"
              ? "Try clearing filters, or check back when assignments and customs are scheduled."
              : "When VA assignments, accepted customs, or tasks have dates, they will appear here."}
          </p>
        </motion.div>
      ) : (
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.38, delay: 0.04, ease: [0.22, 1, 0.36, 1] }}
          className="overflow-hidden rounded-2xl border border-white/10 bg-black/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-xl"
        >
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center rounded-xl text-white/70 transition hover:bg-white/10 hover:text-white"
              aria-label="Previous month"
              onClick={() => setCursor(new Date(year, monthIndex0 - 1, 1))}
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <span className="text-sm font-semibold capitalize tracking-wide text-white">{monthLabel}</span>
            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center rounded-xl text-white/70 transition hover:bg-white/10 hover:text-white"
              aria-label="Next month"
              onClick={() => setCursor(new Date(year, monthIndex0 + 1, 1))}
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          <div className="grid grid-cols-7 border-b border-white/10 text-center text-[11px] font-semibold uppercase tracking-wider text-white/40">
            {WEEKDAYS.map((d) => (
              <div key={d} className="border-r border-white/5 py-2 last:border-r-0">
                {d}
              </div>
            ))}
          </div>

          <div className="divide-y divide-white/10">
            {matrix.map((row, ri) => (
              <div key={ri} className="grid grid-cols-7 divide-x divide-white/10">
                {row.map((cell, ci) => {
                  const dayEvents = cell.ymd ? byDay.get(cell.ymd) ?? [] : [];
                  const dayPersonalEvents = cell.ymd ? personalByDay.get(cell.ymd) ?? [] : [];
                  return (
                    <div
                      key={ci}
                      className={cn(
                        "min-h-[100px] p-1.5 sm:min-h-[120px] sm:p-2",
                        !cell.inMonth && "bg-black/25",
                        cell.inMonth && "bg-transparent"
                      )}
                    >
                      {cell.ymd ? (
                        <>
                          <div
                            className={cn(
                              "mb-1 text-right text-xs font-medium tabular-nums",
                              cell.inMonth ? "text-white/70" : "text-white/25"
                            )}
                          >
                            {Number(cell.ymd.slice(8, 10))}
                          </div>
                          <ul className="space-y-1">
                            {dayPersonalEvents.map((ev) => (
                              <li key={ev.id}>
                                <div
                                  className={cn(
                                    "group flex items-center gap-1 rounded-full border px-2 py-0.5 text-left text-[10px] font-medium sm:text-[11px]",
                                    personalEventStyles[ev.event_type]
                                  )}
                                >
                                  <span className="truncate">
                                    {personalEventEmoji(ev.event_type)} {personalEventLabel(ev)}
                                    {ev.event_time ? ` · ${ev.event_time}` : ""}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => deletePersonalEvent(ev.id)}
                                    disabled={deletingEventId === ev.id}
                                    className="ml-auto opacity-0 transition group-hover:opacity-100 disabled:opacity-70"
                                    aria-label="Delete personal event"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </div>
                              </li>
                            ))}
                            {dayEvents.slice(0, 3).map((ev) => (
                              <li key={ev.id}>
                                <button
                                  type="button"
                                  onClick={() => setSelected(ev)}
                                  className={cn(
                                    "w-full truncate rounded-lg border px-1.5 py-1 text-left text-[10px] font-medium leading-tight transition hover:brightness-110 sm:text-[11px]",
                                    kindStyles[ev.kind]
                                  )}
                                >
                                  {ev.title}
                                </button>
                              </li>
                            ))}
                            {dayEvents.length > 3 ? (
                              <li className="text-center text-[10px] text-white/40">+{dayEvents.length - 3} more</li>
                            ) : null}
                          </ul>
                        </>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </motion.div>
      )}

      <BeautifulDetailModal
        open={selected != null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        title={selected?.title ?? "Details"}
        subtitle={selected ? `${selected.kind.toUpperCase()} · ${formatDateYmd(selected.dateYmd)}` : ""}
        badge={selected?.kind === "custom" ? "Custom request" : selected?.kind === "va" ? "VA assignment" : "Task"}
        headerGradientClass={detailHeaderGradient(selected)}
        stats={
          selected?.kind === "va" && selected.va
            ? [
                {
                  label: "Status",
                  value: selected.va.status,
                  accent: "blue" as const,
                  icon: <ListChecks className="h-5 w-5" aria-hidden />,
                },
                {
                  label: "Priority",
                  value: selected.va.priority || "—",
                  accent: "purple" as const,
                  icon: <Gauge className="h-5 w-5" aria-hidden />,
                },
                {
                  label: "Deadline",
                  value: formatDateEuropean(selected.va.deadline),
                  accent: "amber" as const,
                  icon: <CalendarClock className="h-5 w-5" aria-hidden />,
                },
                {
                  label: "Scheduled",
                  value: formatDateEuropean(selected.va.scheduled_date),
                  accent: "pink" as const,
                  icon: <Timer className="h-5 w-5" aria-hidden />,
                },
              ]
            : selected?.kind === "custom" && selected.custom
              ? [
                  {
                    label: "Fan",
                    value: selected.custom.fan_username || "—",
                    accent: "pink" as const,
                    icon: <User className="h-5 w-5" aria-hidden />,
                  },
                  {
                    label: "Status",
                    value: selected.custom.model_status,
                    accent: "purple" as const,
                    icon: <Sparkles className="h-5 w-5" aria-hidden />,
                  },
                  {
                    label: "Scheduled date",
                    value: formatDateEuropean(selected.custom.model_scheduled_date),
                    accent: "amber" as const,
                    icon: <CalendarClock className="h-5 w-5" aria-hidden />,
                  },
                  {
                    label: "Price",
                    value: selected.custom.price || "—",
                    accent: "blue" as const,
                    icon: <CircleDollarSign className="h-5 w-5" aria-hidden />,
                  },
                ]
              : selected?.kind === "task" && selected.task
                ? [
                    {
                      label: "Status",
                      value: selected.task.status,
                      accent: "emerald" as const,
                      icon: <ListChecks className="h-5 w-5" aria-hidden />,
                    },
                    {
                      label: "Task type",
                      value: selected.task.type || "—",
                      accent: "slate" as const,
                      icon: <CheckSquare className="h-5 w-5" aria-hidden />,
                    },
                    {
                      label: "Date",
                      value: formatDateYmd(selected.dateYmd),
                      accent: "amber" as const,
                      icon: <CalendarClock className="h-5 w-5" aria-hidden />,
                    },
                  ]
                : []
        }
        description={
          selected?.kind === "va"
            ? selected.va?.description || undefined
            : selected?.kind === "custom"
              ? selected.custom?.request_details || undefined
              : selected?.task?.description || undefined
        }
        footer={
          <div className="flex flex-wrap gap-2">
            {selected?.kind === "custom" ? (
              <>
                <Link
                  href={ROUTES.model.customs}
                  className="inline-flex flex-1 items-center justify-center rounded-xl border border-white/15 bg-white/[0.06] px-4 py-2.5 text-sm font-medium text-white transition hover:border-pink-400/35 hover:bg-pink-500/10"
                >
                  View details
                </Link>
                <button
                  type="button"
                  className="inline-flex flex-1 items-center justify-center rounded-xl border border-pink-400/30 bg-pink-500/15 px-4 py-2.5 text-sm font-medium text-pink-100 transition hover:bg-pink-500/25"
                  onClick={() => {
                    setSelected(null);
                    setNotice("Scheduling from the calendar is coming soon — use Customs to set dates.");
                  }}
                >
                  Mark as scheduled
                </button>
              </>
            ) : null}
            {selected?.kind === "va" ? (
              <button
                type="button"
                className="inline-flex w-full items-center justify-center rounded-xl border border-white/15 bg-white/[0.06] px-4 py-2.5 text-sm font-medium text-white transition hover:border-pink-400/35 hover:bg-pink-500/10"
                onClick={() => {
                  setSelected(null);
                  setNotice("VA assignment updates from the calendar are coming soon.");
                }}
              >
                View details
              </button>
            ) : null}
            {selected?.kind === "task" ? (
              <Link
                href={ROUTES.model.tasks}
                className="inline-flex w-full items-center justify-center rounded-xl border border-white/15 bg-white/[0.06] px-4 py-2.5 text-sm font-medium text-white transition hover:border-pink-400/35 hover:bg-pink-500/10"
              >
                View tasks
              </Link>
            ) : null}
          </div>
        }
      >
        {selected?.kind === "va" && selected.va?.file_url ? (
          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-white/45">Upload info</p>
            <a href={selected.va.file_url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm text-pink-300 underline">
              Open file URL
            </a>
          </section>
        ) : null}
      </BeautifulDetailModal>

      {addEventOpen ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0f0f1a] p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Add personal event</h2>
              <button type="button" onClick={() => setAddEventOpen(false)} className="rounded-lg p-1 text-white/70 hover:bg-white/10 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid gap-3">
              <label className="text-xs text-white/65">
                Event type
                <select
                  value={eventForm.event_type}
                  onChange={(e) => setEventForm((prev) => ({ ...prev, event_type: e.target.value as ModelPersonalEventType }))}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                >
                  <option value="nails">💅 Nails</option>
                  <option value="lashes">👁️ Lashes</option>
                  <option value="hairdresser">💇 Hairdresser</option>
                  <option value="surgery">🔪 Surgery</option>
                  <option value="fillers">💉 Fillers</option>
                  <option value="custom">⭐ Custom event</option>
                </select>
              </label>
              {eventForm.event_type === "custom" ? (
                <label className="text-xs text-white/65">
                  Label
                  <input
                    value={eventForm.custom_label}
                    onChange={(e) => setEventForm((prev) => ({ ...prev, custom_label: e.target.value }))}
                    placeholder="e.g. Botox, Waxing..."
                    className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                  />
                </label>
              ) : null}
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs text-white/65">
                  Date
                  <input
                    type="date"
                    value={eventForm.event_date}
                    onChange={(e) => setEventForm((prev) => ({ ...prev, event_date: e.target.value }))}
                    className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                  />
                </label>
                <label className="text-xs text-white/65">
                  Time (optional)
                  <input
                    value={eventForm.event_time}
                    onChange={(e) => setEventForm((prev) => ({ ...prev, event_time: e.target.value }))}
                    placeholder="14:00"
                    className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                  />
                </label>
              </div>
              <label className="text-xs text-white/65">
                Notes (optional)
                <textarea
                  rows={3}
                  value={eventForm.notes}
                  onChange={(e) => setEventForm((prev) => ({ ...prev, notes: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                />
              </label>
              {eventFormError ? <p className="text-sm text-red-300">{eventFormError}</p> : null}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAddEventOpen(false)}
                  className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white/80"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submitPersonalEvent}
                  disabled={savingEvent}
                  className="rounded-xl border border-pink-500/35 bg-pink-500/20 px-3 py-2 text-sm font-medium text-pink-100 disabled:opacity-60"
                >
                  {savingEvent ? "Saving..." : "Add to calendar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
