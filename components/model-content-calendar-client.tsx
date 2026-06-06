"use client";

/**
 * Model content calendar — week grid (default) + optional month grid.
 * Events: personal (model_personal_events), VA assignments, accepted customs, model_tasks.
 */

import * as React from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Calendar, CalendarClock, ChevronLeft, ChevronRight, Clock, Plus, X, Droplet } from "lucide-react";
import { ROUTES } from "@/lib/routes";
import { formatDateEuropean } from "@/lib/format";
import { addDays, addWeeks, getMondayOfWeek } from "@/lib/weekly-program";
import { cn } from "@/lib/utils";
import type { CustomRequest, ModelPersonalEvent, ModelPersonalEventType, ModelTaskRecord, VaContentAssignmentRecord } from "@/types";
import { personalEventEmoji, personalEventLabel } from "@/services/model-personal-events";
import { PeriodStatusBanner, type PeriodStatusBannerProps } from "@/components/period-status-banner";

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

type CalendarDaySlot =
  | { kind: "personal"; id: string; pe: ModelPersonalEvent }
  | { kind: "content"; id: string; ev: ContentCalendarEvent };

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

function normalizeCalendarStatus(raw: string | undefined | null): string {
  return (raw ?? "—").trim().toLowerCase().replace(/\s+/g, "_");
}

function formatCalendarDisplayDate(value: string): string {
  const t = value.trim();
  const d =
    /^\d{4}-\d{2}-\d{2}$/.test(t) ? new Date(`${t}T12:00:00.000Z`) : new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Europe/Athens",
  }).format(d);
}

function calendarYmdDaysFromToday(deadlineYmd: string, todayYmdStr: string): number {
  const a = Date.parse(`${todayYmdStr}T12:00:00.000Z`);
  const b = Date.parse(`${deadlineYmd}T12:00:00.000Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return NaN;
  return Math.ceil((b - a) / 86400000);
}

function isCalendarPastDeadline(deadline: string, todayYmdStr: string): boolean {
  const y = toYmd(deadline);
  if (y) return y < todayYmdStr;
  const t = new Date(deadline).getTime();
  return Number.isFinite(t) && t < Date.now();
}

function isCalendarDueSoon(deadline: string, todayYmdStr: string): boolean {
  const y = toYmd(deadline);
  if (y) {
    const days = calendarYmdDaysFromToday(y, todayYmdStr);
    if (Number.isNaN(days)) return false;
    return days >= 0 && days <= 3;
  }
  const d = new Date(deadline);
  if (Number.isNaN(d.getTime())) return false;
  const ms = d.getTime() - Date.now();
  const days = Math.ceil(ms / 86400000);
  return days >= 0 && days <= 3;
}

/** Tailwind pill + badge classes by event kind / status */
function getContentEventStyle(ev: ContentCalendarEvent, todayYmdStr: string): string {
  const st = normalizeCalendarStatus(ev.status);
  if (ev.kind === "va") {
    if (st === "completed") return "bg-green-500/20 border-green-500/30 text-green-400";
    if (st === "scheduled") return "bg-blue-500/20 border-blue-500/30 text-blue-400";
    if (st === "cancelled" || st === "canceled") return "bg-red-500/20 border-red-500/30 text-red-400";
    if (st === "pending") return "bg-indigo-500/20 border-indigo-500/30 text-indigo-400";
    return "bg-indigo-500/20 border-indigo-500/30 text-indigo-400";
  }
  if (ev.kind === "custom") {
    if (st === "completed" || st === "uploaded") return "bg-green-500/20 border-green-500/30 text-green-400";
    if (
      st === "scheduled" ||
      st === "in_progress" ||
      st === "recording" ||
      st === "accepted" ||
      st === "delivered"
    ) {
      return "bg-blue-500/20 border-blue-500/30 text-blue-400";
    }
    if (st === "declined" || st === "rejected") return "bg-red-500/20 border-red-500/30 text-red-400";
    return "bg-orange-500/20 border-orange-500/30 text-orange-400";
  }
  const dueYmd = ev.task?.due_date ? toYmd(ev.task.due_date) : null;
  const open = st !== "done" && st !== "skipped" && st !== "completed";
  const overdueByDue = Boolean(dueYmd && dueYmd < todayYmdStr && open);
  if (st === "done" || st === "completed") return "bg-green-500/20 border-green-500/30 text-green-400";
  if (overdueByDue || st === "overdue" || st === "blocked") return "bg-red-500/20 border-red-500/30 text-red-400";
  return "bg-teal-500/20 border-teal-500/30 text-teal-400";
}

function getStatusDot(statusRaw: string | undefined | null): string {
  const s = normalizeCalendarStatus(statusRaw);
  switch (s) {
    case "completed":
    case "done":
    case "uploaded":
    case "delivered":
      return "";
    case "scheduled":
    case "in_progress":
    case "recording":
      return "";
    case "pending":
    case "waiting_schedule":
      return "";
    case "cancelled":
    case "canceled":
    case "declined":
    case "rejected":
    case "blocked":
      return "";
    default:
      return "";
  }
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
    const dateYmd = toYmd(t.due_date) ?? toYmd(t.created_at);
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

const WEEKDAYS_MON = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

function parseLocalYmd(ymd: string): Date {
  const [y, mo, d] = ymd.slice(0, 10).split("-").map(Number);
  return new Date(y, mo - 1, d);
}

function todayLocalYmd(): string {
  const n = new Date();
  const y = n.getFullYear();
  const m = String(n.getMonth() + 1).padStart(2, "0");
  const d = String(n.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function monthMatrixMondayFirst(year: number, monthIndex0: number): { ymd: string | null; inMonth: boolean }[][] {
  const first = new Date(year, monthIndex0, 1);
  const day = first.getDay();
  const startPad = day === 0 ? 6 : day - 1;
  const daysInMonth = new Date(year, monthIndex0 + 1, 0).getDate();
  const cells: { ymd: string | null; inMonth: boolean }[] = [];
  for (let i = 0; i < startPad; i++) {
    cells.push({ ymd: null, inMonth: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const m = String(monthIndex0 + 1).padStart(2, "0");
    const dayNum = String(d).padStart(2, "0");
    cells.push({ ymd: `${year}-${m}-${dayNum}`, inMonth: true });
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

const personalStyles: Record<ModelPersonalEventType, string> = {
  nails: "bg-pink-500/20 border-pink-500/30 text-pink-400",
  lashes: "bg-purple-500/20 border-purple-500/30 text-purple-400",
  hairdresser: "bg-blue-500/20 border-blue-500/30 text-blue-400",
  surgery: "bg-red-500/20 border-red-500/30 text-red-400",
  fillers: "bg-amber-500/20 border-amber-500/30 text-amber-400",
  custom: "bg-white/10 border-white/20 text-white/70",
};

function personalPillFallbackClasses(): string {
  return "bg-pink-500/20 border-pink-500/30 text-pink-400";
}

function contentTimeSnippet(ev: ContentCalendarEvent): string | null {
  if (ev.kind === "va" && ev.va?.scheduled_date) {
    const s = ev.va.scheduled_date;
    return /\d{1,2}:\d{2}/.test(s) ? formatDateEuropean(s) : null;
  }
  return null;
}

function EventPill({
  slot,
  onClick,
}: {
  slot: CalendarDaySlot;
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  if (slot.kind === "personal") {
    const { pe } = slot;
    const sty =
      typeof pe.event_type === "string" && pe.event_type in personalStyles
        ? personalStyles[pe.event_type as ModelPersonalEventType]
        : personalPillFallbackClasses();
    return (
      <button
        type="button"
        onClick={onClick}
        title={personalEventLabel(pe)}
        className={cn(
          "w-full cursor-pointer truncate rounded-lg border px-2 py-1 text-left text-[11px] font-medium transition-all hover:opacity-80",
          sty
        )}
      >
        <span>{personalEventEmoji(pe.event_type)}</span> <span className="font-medium">{personalEventLabel(pe)}</span>
        {pe.event_time ? <span className="ml-1 opacity-70">{pe.event_time}</span> : null}
      </button>
    );
  }

  const { ev } = slot;
  const todayStr = todayLocalYmd();
  const pillClass = getContentEventStyle(ev, todayStr);
  const dot = getStatusDot(ev.status);
  const timeBit = contentTimeSnippet(ev);
  return (
    <button
      type="button"
      onClick={onClick}
      title={ev.title}
      className={cn(
        "w-full cursor-pointer truncate rounded-lg border px-2 py-1 text-left text-[11px] font-medium transition-all hover:opacity-80",
        pillClass
      )}
    >
      <span className="mr-0.5">{dot}</span>
      <span className="font-medium">{ev.title}</span>
      {timeBit ? <span className="ml-1 opacity-60">{timeBit}</span> : null}
    </button>
  );
}

function CalendarEventPopover(props: {
  open: boolean;
  anchorEl: HTMLElement | null;
  slot: CalendarDaySlot | null;
  onClose: () => void;
  onDeletePersonal: (id: string) => void;
  deletingPersonalId: string | null;
}) {
  const { open, anchorEl, slot, onClose, onDeletePersonal, deletingPersonalId } = props;
  const ref = React.useRef<HTMLDivElement>(null);
  const [pos, setPos] = React.useState({ top: 0, left: 0 });
  const todayStr = todayLocalYmd();

  React.useEffect(() => {
    if (!open || !anchorEl) return;
    const rect = anchorEl.getBoundingClientRect();
    const w = 288;
    const left = Math.max(12, Math.min(rect.left, window.innerWidth - w - 12));
    const spaceBelow = window.innerHeight - rect.bottom;
    const estimated = 400;
    const top = spaceBelow >= estimated ? rect.bottom + 8 : Math.max(12, rect.top - estimated - 8);
    setPos({ top, left });
  }, [open, anchorEl]);

  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const p = ref.current;
      if (p?.contains(e.target as Node) || anchorEl?.contains(e.target as Node)) return;
      onClose();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open, onClose, anchorEl]);

  if (!open || !slot || typeof document === "undefined") return null;

  let scheduledRaw: string | null = null;
  let deadlineRaw: string | null = null;
  let descriptionText: string | null = null;
  let contentTypeChip: string | null = null;
  let pillStyle = "";
  let typeBadge = "";

  if (slot.kind === "personal") {
    pillStyle =
      typeof slot.pe.event_type === "string" && slot.pe.event_type in personalStyles
        ? personalStyles[slot.pe.event_type as ModelPersonalEventType]
        : personalPillFallbackClasses();
    typeBadge = "PERSONAL";
  } else {
    const ev = slot.ev;
    pillStyle = getContentEventStyle(ev, todayStr);
    if (ev.kind === "va") {
      typeBadge = "VA ASSIGNMENT";
      scheduledRaw = ev.va?.scheduled_date ?? null;
      deadlineRaw = ev.va?.deadline ?? null;
      descriptionText = ev.va?.description?.trim() || null;
      contentTypeChip = ev.va?.content_type?.trim() || null;
    } else if (ev.kind === "custom") {
      typeBadge = "CUSTOM";
      scheduledRaw =
        ev.custom?.model_scheduled_date ??
        ev.custom?.model_scheduled_start ??
        null;
      deadlineRaw = ev.custom?.deadline_requested ?? null;
      descriptionText = ev.custom?.request_details?.trim() || null;
    } else {
      typeBadge = "TASK";
      scheduledRaw = null;
      deadlineRaw = ev.task?.due_date ?? null;
      descriptionText = ev.task?.description?.trim() || null;
    }
  }

  const portal =
    slot.kind === "personal" ? (
      <div
        ref={ref}
        style={{
          top: pos.top,
          left: pos.left,
          boxShadow: "0 0 0 1px rgba(255,255,255,0.08), 0 20px 50px rgba(0,0,0,0.55)",
        }}
        className="fixed z-[200] w-72 overflow-y-auto rounded-2xl border border-white/15 bg-[#0f0f1a] p-4 shadow-2xl"
      >
        <div className="mb-3 flex items-start justify-between gap-2">
          <span
            className={cn(
              "rounded-full border px-2 py-0.5 text-xs font-semibold uppercase tracking-wide",
              pillStyle
            )}
          >
            {typeBadge}
          </span>
          <button type="button" onClick={() => onClose()} className="text-white/30 transition hover:text-white" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <h3 className="mb-3 text-base font-bold leading-tight text-white">
          <span className="mr-1">{personalEventEmoji(slot.pe.event_type)}</span>
          {personalEventLabel(slot.pe)}
        </h3>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <CalendarClock className="h-3.5 w-3.5 text-white/35" />
          <span className="text-xs text-white/70">
            {formatCalendarDisplayDate(slot.pe.event_date)}
            {slot.pe.event_time ? ` · ${slot.pe.event_time}` : ""}
          </span>
        </div>
        {slot.pe.notes ? (
          <p className="mb-3 line-clamp-3 text-xs leading-relaxed text-white/50">{slot.pe.notes}</p>
        ) : null}
        <button
          type="button"
          disabled={deletingPersonalId === slot.pe.id}
          onClick={() => onDeletePersonal(slot.pe.id)}
          className="w-full rounded-xl border border-red-500/30 bg-red-500/20 py-2 text-sm font-medium text-red-400 transition hover:bg-red-500/30 disabled:opacity-45"
        >
          Delete event
        </button>
      </div>
    ) : (
      <div
        ref={ref}
        style={{
          top: pos.top,
          left: pos.left,
          boxShadow: "0 0 0 1px rgba(255,255,255,0.08), 0 20px 50px rgba(0,0,0,0.55)",
        }}
        className="fixed z-[200] max-h-[min(72vh,28rem)] w-72 overflow-y-auto rounded-2xl border border-white/15 bg-[#0f0f1a] p-4 shadow-2xl"
      >
        {(() => {
          const ev = slot.ev;
          const sched = scheduledRaw?.trim();
          const ded = deadlineRaw?.trim();

          let deadlinePast = false;
          let deadlineSoon = false;
          if (ded) {
            deadlinePast = isCalendarPastDeadline(ded, todayStr);
            deadlineSoon = isCalendarDueSoon(ded, todayStr) && !deadlinePast;
          }

          return (
            <>
              <div className="mb-3 flex items-start justify-between gap-2">
                <span
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-xs font-semibold uppercase tracking-wide",
                    pillStyle
                  )}
                >
                  {typeBadge}
                </span>
                <button type="button" onClick={() => onClose()} className="text-white/30 transition hover:text-white" aria-label="Close">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <h3 className="mb-2 text-base font-bold leading-tight text-white">{ev.title}</h3>

              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className={cn("rounded-full border px-2.5 py-1 text-xs font-semibold uppercase", pillStyle)}>
                  {(ev.status ?? "pending").replace(/-/g, "").toUpperCase()}
                </span>
                {contentTypeChip ? (
                  <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-white/50">
                    {contentTypeChip}
                  </span>
                ) : null}
              </div>

              <div className="mb-3 space-y-1.5">
                {sched ? (
                  <div className="flex items-center gap-2 text-xs">
                    <Calendar className="h-3.5 w-3.5 shrink-0 text-blue-400" />
                    <span className="text-white/40">{ev.kind === "task" ? "Due / calendar" : "Scheduled"}</span>
                    <span className="font-medium text-white/70">{formatCalendarDisplayDate(sched)}</span>
                    {/\d{1,2}:\d{2}/.test(sched) ? (
                      <span className="text-white/35">{formatDateEuropean(sched)}</span>
                    ) : null}
                  </div>
                ) : null}

                {ded ? (
                  <div
                    className={cn(
                      "flex flex-wrap items-center gap-2 rounded-lg border px-2 py-1 text-xs",
                      deadlinePast && "border-red-500/20 bg-red-500/10",
                      deadlineSoon && !deadlinePast && "border-amber-500/20 bg-amber-500/10",
                      !deadlinePast && !deadlineSoon && "border-white/10 bg-white/5"
                    )}
                  >
                    <Clock
                      className={cn(
                        "h-3.5 w-3.5 shrink-0",
                        deadlinePast && "text-red-400",
                        deadlineSoon && !deadlinePast && "text-amber-400",
                        !deadlinePast && !deadlineSoon && "text-white/40"
                      )}
                    />
                    <span
                      className={cn(
                        deadlinePast && "text-red-400",
                        deadlineSoon && !deadlinePast && "text-amber-400",
                        !deadlinePast && !deadlineSoon && "text-white/40"
                      )}
                    >
                      Deadline
                    </span>
                    <span
                      className={cn(
                        "font-semibold",
                        deadlinePast && "text-red-300",
                        deadlineSoon && !deadlinePast && "text-amber-300",
                        !deadlinePast && !deadlineSoon && "text-white/70"
                      )}
                    >
                      {formatCalendarDisplayDate(ded)}
                    </span>
                    {deadlinePast ? <span className="ml-auto text-red-400">Overdue</span> : null}
                    {deadlineSoon && !deadlinePast ? <span className="ml-auto text-amber-400">⏰ Soon</span> : null}
                  </div>
                ) : null}

                <div className="flex items-center gap-2 border-t border-white/5 pt-1.5 text-[11px] text-white/40">
                  <span>Listed day</span>
                  <span className="font-medium text-white/60">{formatCalendarDisplayDate(ev.dateYmd)}</span>
                  <span className="truncate text-white/30">({ev.sublabel})</span>
                </div>
              </div>

              {descriptionText ? (
                <p className="mb-3 line-clamp-3 text-xs leading-relaxed text-white/50">{descriptionText}</p>
              ) : null}

              <div className="flex flex-col gap-2">
                {ev.kind === "va" ? (
                  <Link
                    href={ROUTES.model.contentAssignments}
                    className="inline-flex w-full items-center justify-center rounded-xl border border-indigo-500/30 bg-indigo-500/20 py-2 text-sm font-medium text-indigo-400 transition-all hover:bg-indigo-500/30"
                    onClick={onClose}
                  >
                    Open VA content →
                  </Link>
                ) : null}
                {ev.kind === "custom" ? (
                  <Link
                    href={ROUTES.model.customs}
                    className="inline-flex w-full items-center justify-center rounded-xl border border-orange-500/30 bg-orange-500/20 py-2 text-sm font-medium text-orange-400 transition-all hover:bg-orange-500/30"
                    onClick={onClose}
                  >
                    Open custom request →
                  </Link>
                ) : null}
                {ev.kind === "task" ? (
                  <Link
                    href={ROUTES.model.tasks}
                    className="inline-flex w-full items-center justify-center rounded-xl border border-teal-500/30 bg-teal-500/20 py-2 text-sm font-medium text-teal-300 transition hover:bg-teal-500/30"
                    onClick={onClose}
                  >
                    Open tasks →
                  </Link>
                ) : null}
              </div>
            </>
          );
        })()}
      </div>
    );

  return createPortal(portal, document.body);
}

function ymdInLoggedPeriod(ymd: string, periods: { start_date: string; end_date: string }[]): boolean {
  if (!periods.length || !ymd) return false;
  return periods.some((p) => p.start_date <= ymd && ymd <= p.end_date);
}

function ymdInActiveWindow(ymd: string, win: { start_date: string; end_date: string } | null | undefined): boolean {
  if (!ymd || !win?.start_date || !win?.end_date) return false;
  return win.start_date <= ymd && ymd <= win.end_date;
}

function weekRangeLabel(mondayYmd: string): string {
  const sun = addDays(mondayYmd, 6);
  const a = parseLocalYmd(mondayYmd);
  const b = parseLocalYmd(sun);
  const moA = a.toLocaleString(undefined, { month: "long" });
  const moB = b.toLocaleString(undefined, { month: "long" });
  const yA = a.getFullYear();
  const yB = b.getFullYear();
  if (moA === moB && yA === yB) return `${moA} ${yA}`;
  if (yA === yB) return `${moA} – ${moB} ${yA}`;
  return `${moA} ${yA} – ${moB} ${yB}`;
}

export type ModelContentCalendarClientProps = {
  assignments: VaContentAssignmentRecord[];
  customs: CustomRequest[];
  tasks: ModelTaskRecord[];
  personalEvents: ModelPersonalEvent[];
  modelName?: string;
  openAddEventInitially?: boolean;
  /** When non-null (server only sends when tracking is enabled), renders the period strip below the calendar header. */
  periodBannerProps?: PeriodStatusBannerProps | null;
  /** Logged period windows for day-cell shading (tracking opted-in models only). */
  loggedPeriodSpans?: { start_date: string; end_date: string }[];
  /** Current bleed window from server (matches getCurrentPeriod computed end). */
  activePeriodWindow?: { start_date: string; end_date: string } | null;
  predictedNextStart?: string | null;
};

export function ModelContentCalendarClient({
  assignments,
  customs,
  tasks,
  personalEvents: initialPersonalEvents,
  modelName,
  openAddEventInitially = false,
  periodBannerProps = null,
  loggedPeriodSpans = [],
  activePeriodWindow = null,
  predictedNextStart = null,
}: ModelContentCalendarClientProps) {
  const reduceMotion = useReducedMotion();
  const [view, setView] = React.useState<"week" | "month">("week");
  const [weekStartYmd, setWeekStartYmd] = React.useState(() => getMondayOfWeek(todayLocalYmd()));
  const [cursor, setCursor] = React.useState(() => new Date());
  const [typeFilter, setTypeFilter] = React.useState<"all" | "va" | "custom" | "task">("all");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
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

  const [popover, setPopover] = React.useState<{
    slot: CalendarDaySlot;
    anchor: HTMLElement;
  } | null>(null);

  const allEvents = React.useMemo(
    () => buildEvents(assignments, customs, tasks),
    [assignments, customs, tasks]
  );

  const statusOptions = React.useMemo(() => {
    const s = new Set<string>();
    for (const e of allEvents) s.add(e.status);
    return ["all", ...[...s].sort()];
  }, [allEvents]);

  const filteredContent = React.useMemo(() => {
    return allEvents.filter((e) => {
      if (typeFilter !== "all" && e.kind !== typeFilter) return false;
      if (statusFilter !== "all" && e.status !== statusFilter) return false;
      return true;
    });
  }, [allEvents, typeFilter, statusFilter]);

  const byDay = React.useMemo(() => {
    const m = new Map<string, ContentCalendarEvent[]>();
    for (const e of filteredContent) {
      const list = m.get(e.dateYmd) ?? [];
      list.push(e);
      m.set(e.dateYmd, list);
    }
    return m;
  }, [filteredContent]);

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

  const weekDaysYmd = React.useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStartYmd, i)), [weekStartYmd]);

  const year = cursor.getFullYear();
  const monthIndex0 = cursor.getMonth();
  const monthMatrix = React.useMemo(() => monthMatrixMondayFirst(year, monthIndex0), [year, monthIndex0]);

  const monthLabel = cursor.toLocaleString(undefined, { month: "long", year: "numeric" });

  function slotsForDay(ymd: string): CalendarDaySlot[] {
    const slots: CalendarDaySlot[] = [];
    if (typeFilter === "all") {
      for (const pe of personalByDay.get(ymd) ?? []) {
        slots.push({ kind: "personal", id: pe.id, pe });
      }
    }
    for (const ev of byDay.get(ymd) ?? []) {
      slots.push({ kind: "content", id: ev.id, ev });
    }
    return slots;
  }

  React.useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 3200);
    return () => clearTimeout(t);
  }, [notice]);

  function goPrev() {
    if (view === "week") setWeekStartYmd((s) => addWeeks(s, -1));
    else setCursor((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  }

  function goNext() {
    if (view === "week") setWeekStartYmd((s) => addWeeks(s, 1));
    else setCursor((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  }

  function goThisWeek() {
    const today = todayLocalYmd();
    const monday = getMondayOfWeek(today);
    setWeekStartYmd(monday);
    setCursor(parseLocalYmd(monday));
  }

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
        [...prev, data.record!].sort(
          (a, b) =>
            a.event_date.localeCompare(b.event_date) || (a.event_time ?? "").localeCompare(b.event_time ?? "")
        )
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
      if (popover?.slot.kind === "personal" && popover.slot.pe.id === id) setPopover(null);
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
        className="flex flex-col gap-4"
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 gap-y-3">
              <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">Calendar</h1>
              <div className="flex rounded-xl border border-white/10 bg-white/[0.04] p-0.5">
                <button
                  type="button"
                  onClick={() => setView("week")}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-xs font-semibold transition",
                    view === "week" ? "bg-pink-500 text-white shadow-md" : "text-white/50 hover:text-white"
                  )}
                >
                  Week
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setView("month");
                    setCursor(parseLocalYmd(weekStartYmd));
                  }}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-xs font-semibold transition",
                    view === "month" ? "bg-pink-500 text-white shadow-md" : "text-white/50 hover:text-white"
                  )}
                >
                  Month
                </button>
              </div>
            </div>
            <p className="mt-1 text-sm text-white/55">
              {modelName ? <span>{modelName} · </span> : null}
              <span>{view === "week" ? weekRangeLabel(weekStartYmd) : monthLabel}</span>
            </p>
          </div>
          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:flex-wrap lg:justify-end">
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label={view === "week" ? "Previous week" : "Previous month"}
                onClick={goPrev}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/75 transition hover:bg-white/10"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              {view === "week" ? (
                <button
                  type="button"
                  onClick={goThisWeek}
                  className="rounded-xl border border-white/15 bg-white/[0.08] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-white/90 hover:bg-white/12"
                >
                  This week
                </button>
              ) : null}
              <button
                type="button"
                aria-label={view === "week" ? "Next week" : "Next month"}
                onClick={goNext}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/75 transition hover:bg-white/10"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
            <button
              type="button"
              onClick={() => setAddEventOpen(true)}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-pink-500/35 bg-pink-500/20 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-pink-100 transition hover:bg-pink-500/30"
            >
              <Plus className="h-4 w-4" />
              Add personal event
            </button>
          </div>
        </div>

        {periodBannerProps ? <PeriodStatusBanner {...periodBannerProps} /> : null}

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
        <p className="rounded-xl border border-white/10 bg-white/[0.06] px-4 py-2 text-center text-sm text-white/80">{notice}</p>
      ) : null}

      {view === "week" ? (
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 overflow-x-auto pb-2 [-webkit-overflow-scrolling:touch]"
        >
          <div className="grid min-w-[44rem] grid-cols-7 gap-1 md:min-w-0 md:gap-2">
          {weekDaysYmd.map((ymd, i) => {
            const d = parseLocalYmd(ymd);
            const isTodayDay = todayLocalYmd() === ymd;
            const slots = slotsForDay(ymd);
            const isPeriodDay =
              ymdInLoggedPeriod(ymd, loggedPeriodSpans) || ymdInActiveWindow(ymd, activePeriodWindow ?? undefined);
            const isPredictedDay = Boolean(predictedNextStart && ymd === predictedNextStart);
            return (
              <div key={ymd} className="flex min-w-0 flex-col gap-1">
                <div className="text-center">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-white/40">{WEEKDAYS_MON[i]}</div>
                  <div className={cn("mt-0.5 flex min-h-[14px] items-center justify-center", isPeriodDay && "text-rose-400")}>
                    {isPeriodDay ? <Droplet className="h-3 w-3 text-rose-400" aria-hidden /> : null}
                  </div>
                  <div
                    className={cn(
                      "mx-auto mt-1 flex h-8 w-8 items-center justify-center rounded-full text-lg font-bold tabular-nums",
                      isTodayDay ? "bg-pink-500 text-white" : isPeriodDay ? "text-rose-400" : "text-white"
                    )}
                  >
                    {d.getDate()}
                  </div>
                </div>
                <div
                  className={cn(
                    "min-h-[8rem] flex-1 space-y-1 rounded-xl border p-2",
                    isPeriodDay && "border-rose-500/20 bg-rose-500/10 ring-1 ring-rose-500/15",
                    !isPeriodDay &&
                      isPredictedDay &&
                      "border-amber-500/20 bg-amber-500/10 ring-1 ring-amber-500/15",
                    !isPeriodDay && !isPredictedDay && "border-white/[0.08] bg-white/[0.03]"
                  )}
                >
                  {slots.length === 0 ? (
                    <p className="pt-4 text-center text-[10px] text-white/20">—</p>
                  ) : (
                    slots.map((slot) => (
                      <EventPill
                        key={slot.kind + slot.id}
                        slot={slot}
                        onClick={(e) =>
                          setPopover({
                            slot,
                            anchor: e.currentTarget,
                          })
                        }
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
          </div>
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
              onClick={goPrev}
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <span className="text-sm font-semibold capitalize tracking-wide text-white">{monthLabel}</span>
            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center rounded-xl text-white/70 transition hover:bg-white/10 hover:text-white"
              aria-label="Next month"
              onClick={goNext}
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          <div className="grid grid-cols-7 border-b border-white/10 text-center text-[11px] font-semibold uppercase tracking-wider text-white/40">
            {WEEKDAYS_MON.map((d) => (
              <div key={d} className="border-r border-white/5 py-2 last:border-r-0">
                {d}
              </div>
            ))}
          </div>

          <div className="divide-y divide-white/10">
            {monthMatrix.map((row, ri) => (
              <div key={ri} className="grid grid-cols-7 divide-x divide-white/10">
                {row.map((cell, ci) => {
                  const slots = cell.ymd ? slotsForDay(cell.ymd) : [];
                  const isPeriodDay = cell.ymd
                    ? ymdInLoggedPeriod(cell.ymd, loggedPeriodSpans) ||
                      ymdInActiveWindow(cell.ymd, activePeriodWindow ?? undefined)
                    : false;
                  const isPredictedDay = Boolean(cell.ymd && predictedNextStart && cell.ymd === predictedNextStart);
                  return (
                    <div
                      key={ci}
                      className={cn(
                        "min-h-[112px] p-1.5 sm:min-h-[132px] sm:p-2",
                        !cell.inMonth && "bg-black/25",
                        cell.inMonth && !isPeriodDay && !isPredictedDay && "bg-transparent",
                        cell.inMonth && isPeriodDay && "border border-rose-500/20 bg-rose-500/[0.10]",
                        cell.inMonth && !isPeriodDay && isPredictedDay && "border border-amber-500/20 bg-amber-500/[0.10]"
                      )}
                    >
                      {cell.ymd ? (
                        <>
                          <div
                            className={cn(
                              "mb-1 flex items-center justify-end gap-1 text-xs font-medium tabular-nums",
                              cell.inMonth ? "text-white/70" : "text-white/25",
                              todayLocalYmd() === cell.ymd && "rounded-full bg-pink-500 px-2 py-0.5 font-bold text-white",
                              cell.inMonth && isPeriodDay && todayLocalYmd() !== cell.ymd && "text-rose-400"
                            )}
                          >
                            {isPeriodDay ? <Droplet className="mr-0.5 h-2.5 w-2.5 text-rose-400" aria-hidden /> : null}
                            {isPredictedDay && !isPeriodDay ? (
                              <Calendar className="mr-0.5 h-2.5 w-2.5 text-amber-400" aria-hidden />
                            ) : null}
                            {Number(cell.ymd.slice(8, 10))}
                          </div>
                          <div className="flex max-h-[5.5rem] flex-col gap-1 overflow-y-auto">
                            {slots.map((slot) => (
                              <EventPill
                                key={slot.kind + slot.id}
                                slot={slot}
                                onClick={(e) =>
                                  setPopover({
                                    slot,
                                    anchor: e.currentTarget,
                                  })
                                }
                              />
                            ))}
                          </div>
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

      <CalendarEventPopover
        open={popover != null}
        anchorEl={popover?.anchor ?? null}
        slot={popover?.slot ?? null}
        onClose={() => setPopover(null)}
        onDeletePersonal={deletePersonalEvent}
        deletingPersonalId={deletingEventId}
      />

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
                  <option value="nails"> Nails</option>
                  <option value="lashes"> Lashes</option>
                  <option value="hairdresser"> Hairdresser</option>
                  <option value="surgery"> Surgery</option>
                  <option value="fillers"> Fillers</option>
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
