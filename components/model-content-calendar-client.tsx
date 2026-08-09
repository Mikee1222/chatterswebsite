"use client";

/**
 * Model content calendar — week grid (default) + optional month grid.
 * Events: personal (model_personal_events), VA assignments, accepted customs, model_tasks,
 * and model_schedule rows (filming shoots / content_shoot, live, scripts, etc.).
 */

import * as React from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import {
  Calendar,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Clock,
  ListTodo,
  Palette,
  Plus,
  Sparkles,
  X,
  Droplet,
} from "lucide-react";
import { ROUTES } from "@/lib/routes";
import { formatDateEuropean, formatScheduleItemTypeForDisplay, formatTimeRange } from "@/lib/format";
import { addDays, addWeeks, getMondayOfWeek } from "@/lib/weekly-program";
import { cn } from "@/lib/utils";
import {
  extractScheduleLocation,
  sanitizeScheduleDetailsForDisplay,
  scheduleItemVisual,
  MapPin,
} from "@/lib/schedule-item-visuals";
import type {
  CustomRequest,
  ModelPersonalEvent,
  ModelPersonalEventType,
  ModelScheduleItem,
  ModelTaskRecord,
  VaContentAssignmentRecord,
} from "@/types";
import { personalEventEmoji, personalEventLabel } from "@/services/model-personal-events";
import { PeriodStatusBanner, type PeriodStatusBannerProps } from "@/components/period-status-banner";

/** Schedule types already represented by other calendar sources (avoid double pills). */
const SCHEDULE_TYPES_SHOWN_ELSEWHERE = new Set(["custom"]);

export type ContentCalendarEvent = {
  id: string;
  kind: "va" | "custom" | "task" | "schedule";
  title: string;
  dateYmd: string;
  status: string;
  sublabel: string;
  va?: VaContentAssignmentRecord;
  custom?: CustomRequest;
  task?: ModelTaskRecord;
  schedule?: ModelScheduleItem;
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

/** Tailwind pill + badge classes by event kind / status / schedule item_type */
function getContentEventStyle(ev: ContentCalendarEvent, todayYmdStr: string): string {
  const st = normalizeCalendarStatus(ev.status);
  if (ev.kind === "va") {
    if (st === "completed") return "border-green-500/30 bg-green-500/20 text-green-400";
    if (st === "scheduled") return "border-blue-500/30 bg-blue-500/20 text-blue-400";
    if (st === "cancelled" || st === "canceled") return "border-red-500/30 bg-red-500/20 text-red-400";
    if (st === "pending") return "border-indigo-500/30 bg-indigo-500/20 text-indigo-400";
    return "border-indigo-500/30 bg-indigo-500/20 text-indigo-400";
  }
  if (ev.kind === "custom") {
    if (st === "completed" || st === "uploaded") return "border-green-500/30 bg-green-500/20 text-green-400";
    if (
      st === "scheduled" ||
      st === "in_progress" ||
      st === "recording" ||
      st === "accepted" ||
      st === "delivered"
    ) {
      return "border-blue-500/30 bg-blue-500/20 text-blue-400";
    }
    if (st === "declined" || st === "rejected") return "border-red-500/30 bg-red-500/20 text-red-400";
    return "border-orange-500/30 bg-orange-500/20 text-orange-400";
  }
  if (ev.kind === "schedule") {
    if (st === "completed" || st === "done") return "border-green-500/30 bg-green-500/20 text-green-400";
    if (st === "cancelled" || st === "canceled") return "border-red-500/30 bg-red-500/20 text-red-400";
    const v = scheduleItemVisual(ev.schedule?.item_type);
    return cn(v.surface, v.ring);
  }
  const dueYmd = ev.task?.due_date ? toYmd(ev.task.due_date) : null;
  const open = st !== "done" && st !== "skipped" && st !== "completed";
  const overdueByDue = Boolean(dueYmd && dueYmd < todayYmdStr && open);
  if (st === "done" || st === "completed") return "border-green-500/30 bg-green-500/20 text-green-400";
  if (overdueByDue || st === "overdue" || st === "blocked") return "border-red-500/30 bg-red-500/20 text-red-400";
  return "border-teal-500/30 bg-teal-500/20 text-teal-400";
}

function EventKindIcon({ ev, className }: { ev: ContentCalendarEvent; className?: string }) {
  if (ev.kind === "schedule") {
    const { Icon } = scheduleItemVisual(ev.schedule?.item_type);
    return <Icon className={cn("h-4 w-4 shrink-0", className)} aria-hidden />;
  }
  if (ev.kind === "va") return <Palette className={cn("h-4 w-4 shrink-0", className)} aria-hidden />;
  if (ev.kind === "custom") return <Sparkles className={cn("h-4 w-4 shrink-0", className)} aria-hidden />;
  return <ListTodo className={cn("h-4 w-4 shrink-0", className)} aria-hidden />;
}

function buildEvents(
  assignments: VaContentAssignmentRecord[],
  customs: CustomRequest[],
  tasks: ModelTaskRecord[],
  scheduleItems: ModelScheduleItem[] = []
): ContentCalendarEvent[] {
  const out: ContentCalendarEvent[] = [];
  for (const a of assignments) {
    const dateYmd = toYmd(a.scheduled_date) ?? toYmd(a.deadline) ?? toYmd(a.updated_at);
    if (!dateYmd) continue;
    out.push({
      id: `va-${a.id}`,
      kind: "va",
      title: a.title || "Chatting assignment",
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
  for (const s of scheduleItems) {
    if (SCHEDULE_TYPES_SHOWN_ELSEWHERE.has(s.item_type)) continue;
    const dateYmd = toYmd(s.date);
    if (!dateYmd) continue;
    out.push({
      id: `schedule-${s.id}`,
      kind: "schedule",
      title: s.title?.trim() || formatScheduleItemTypeForDisplay(s.item_type),
      dateYmd,
      status: s.status || "scheduled",
      sublabel: formatScheduleItemTypeForDisplay(s.item_type),
      schedule: s,
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
  if (ev.kind === "schedule") {
    const range = formatTimeRange(ev.schedule?.start_time, ev.schedule?.end_time);
    return range === "—" ? null : range;
  }
  return null;
}

function EventPill({
  slot,
  onClick,
  variant = "compact",
}: {
  slot: CalendarDaySlot;
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  /** compact = grid cell; card = mobile day list */
  variant?: "compact" | "card";
}) {
  if (slot.kind === "personal") {
    const { pe } = slot;
    const sty =
      typeof pe.event_type === "string" && pe.event_type in personalStyles
        ? personalStyles[pe.event_type as ModelPersonalEventType]
        : personalPillFallbackClasses();
    if (variant === "card") {
      return (
        <button
          type="button"
          onClick={onClick}
          title={personalEventLabel(pe)}
          className={cn(
            "flex min-h-[44px] w-full items-center gap-3 rounded-2xl border px-3.5 py-3 text-left transition active:scale-[0.99]",
            sty
          )}
        >
          <span className="text-lg" aria-hidden>
            {personalEventEmoji(pe.event_type)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">{personalEventLabel(pe)}</span>
            {pe.event_time ? <span className="mt-0.5 block text-xs opacity-70">{pe.event_time}</span> : null}
          </span>
        </button>
      );
    }
    return (
      <button
        type="button"
        onClick={onClick}
        title={personalEventLabel(pe)}
        className={cn(
          "flex min-h-[32px] w-full cursor-pointer items-center truncate rounded-lg border px-2 py-1.5 text-left text-[11px] font-medium transition-all hover:opacity-80",
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
  const timeBit = contentTimeSnippet(ev);
  const isShoot = ev.kind === "schedule" && ev.schedule?.item_type === "content_shoot";
  const location = isShoot ? extractScheduleLocation(ev.schedule?.details) : "";
  const visual = ev.kind === "schedule" ? scheduleItemVisual(ev.schedule?.item_type) : null;

  if (variant === "card") {
    return (
      <button
        type="button"
        onClick={onClick}
        title={ev.title}
        className={cn(
          "flex min-h-[44px] w-full gap-3 rounded-2xl border px-3.5 py-3 text-left transition active:scale-[0.99]",
          pillClass,
          isShoot && "py-3.5"
        )}
      >
        <span
          className={cn(
            "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-black/25",
            visual?.accent
          )}
        >
          <EventKindIcon ev={ev} className="h-[18px] w-[18px]" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-start justify-between gap-2">
            <span className="truncate text-sm font-semibold leading-snug text-inherit">{ev.title}</span>
            {timeBit ? (
              <span className="shrink-0 text-xs font-medium tabular-nums opacity-80">{timeBit}</span>
            ) : null}
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] opacity-75">
            <span>{ev.sublabel}</span>
            {isShoot && location ? (
              <span className="inline-flex items-center gap-1 font-medium text-emerald-200/90">
                <MapPin className="h-3 w-3 shrink-0" aria-hidden />
                <span className="truncate">{location}</span>
              </span>
            ) : null}
          </span>
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      title={ev.title}
      className={cn(
        "flex min-h-[32px] w-full cursor-pointer flex-col gap-0.5 rounded-lg border px-2 py-1.5 text-left text-[11px] font-medium transition-all hover:opacity-80",
        pillClass,
        isShoot && "ring-1 ring-emerald-400/20"
      )}
    >
      <span className="flex items-center gap-1 truncate">
        <EventKindIcon ev={ev} className="h-3 w-3 opacity-90" />
        <span className="truncate font-medium">{ev.title}</span>
        {timeBit ? <span className="ml-auto shrink-0 opacity-70">{timeBit}</span> : null}
      </span>
      {isShoot && location ? (
        <span className="flex items-center gap-0.5 truncate text-[10px] font-normal text-emerald-200/85">
          <MapPin className="h-2.5 w-2.5 shrink-0" aria-hidden />
          {location}
        </span>
      ) : null}
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
  const [isMobile, setIsMobile] = React.useState(false);
  const todayStr = todayLocalYmd();
  const reduceMotion = useReducedMotion();

  React.useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const sync = () => setIsMobile(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  React.useEffect(() => {
    if (!open || !anchorEl || isMobile) return;
    const rect = anchorEl.getBoundingClientRect();
    const w = 320;
    const left = Math.max(12, Math.min(rect.left, window.innerWidth - w - 12));
    const spaceBelow = window.innerHeight - rect.bottom;
    const estimated = 420;
    const top = spaceBelow >= estimated ? rect.bottom + 8 : Math.max(12, rect.top - estimated - 8);
    setPos({ top, left });
  }, [open, anchorEl, isMobile]);

  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const p = ref.current;
      if (p?.contains(e.target as Node) || anchorEl?.contains(e.target as Node)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose, anchorEl]);

  if (!open || !slot || typeof document === "undefined") return null;

  let scheduledRaw: string | null = null;
  let deadlineRaw: string | null = null;
  let descriptionText: string | null = null;
  let contentTypeChip: string | null = null;
  let locationLine: string | null = null;
  let timeRangeLabel: string | null = null;
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
    } else if (ev.kind === "schedule") {
      typeBadge =
        ev.schedule?.item_type === "content_shoot"
          ? "FILMING SHOOT"
          : formatScheduleItemTypeForDisplay(ev.schedule?.item_type).toUpperCase() || "SCHEDULE";
      scheduledRaw = ev.schedule?.date ?? null;
      const range = formatTimeRange(ev.schedule?.start_time, ev.schedule?.end_time);
      timeRangeLabel = range === "—" ? null : range;
      deadlineRaw = null;
      descriptionText = sanitizeScheduleDetailsForDisplay(ev.schedule?.details) || null;
      locationLine = extractScheduleLocation(ev.schedule?.details) || null;
      contentTypeChip = formatScheduleItemTypeForDisplay(ev.schedule?.item_type);
    } else {
      typeBadge = "TASK";
      scheduledRaw = null;
      deadlineRaw = ev.task?.due_date ?? null;
      descriptionText = ev.task?.description?.trim() || null;
    }
  }

  const shellClass = isMobile
    ? "fixed inset-x-0 bottom-0 z-[200] max-h-[min(88vh,40rem)] w-full overflow-y-auto rounded-t-3xl border border-white/15 bg-[#0f0f1a] p-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] shadow-2xl"
    : "fixed z-[200] max-h-[min(72vh,28rem)] w-80 overflow-y-auto rounded-2xl border border-white/15 bg-[#0f0f1a] p-4 shadow-2xl";

  const shellStyle = isMobile
    ? ({ boxShadow: "0 -12px 40px rgba(0,0,0,0.55)" } as React.CSSProperties)
    : ({
        top: pos.top,
        left: pos.left,
        boxShadow: "0 0 0 1px rgba(255,255,255,0.08), 0 20px 50px rgba(0,0,0,0.55)",
      } as React.CSSProperties);

  const panel = (
    <motion.div
      ref={ref}
      role="dialog"
      aria-modal="true"
      initial={reduceMotion ? false : isMobile ? { y: 40, opacity: 0 } : { opacity: 0, scale: 0.98 }}
      animate={isMobile ? { y: 0, opacity: 1 } : { opacity: 1, scale: 1 }}
      transition={{ duration: reduceMotion ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] }}
      style={shellStyle}
      className={shellClass}
    >
      {isMobile ? <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20" aria-hidden /> : null}
      {slot.kind === "personal" ? (
        <>
          <div className="mb-3 flex items-start justify-between gap-2">
            <span className={cn("rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-wide", pillStyle)}>
              {typeBadge}
            </span>
            <button
              type="button"
              onClick={() => onClose()}
              className="flex h-11 w-11 items-center justify-center rounded-xl text-white/40 transition hover:bg-white/10 hover:text-white"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <h3 className="mb-3 text-lg font-bold leading-tight text-white">
            <span className="mr-1">{personalEventEmoji(slot.pe.event_type)}</span>
            {personalEventLabel(slot.pe)}
          </h3>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <CalendarClock className="h-3.5 w-3.5 text-white/35" />
            <span className="text-sm text-white/70">
              {formatCalendarDisplayDate(slot.pe.event_date)}
              {slot.pe.event_time ? ` · ${slot.pe.event_time}` : ""}
            </span>
          </div>
          {slot.pe.notes ? (
            <p className="mb-3 whitespace-pre-wrap text-sm leading-relaxed text-white/55">{slot.pe.notes}</p>
          ) : null}
          <button
            type="button"
            disabled={deletingPersonalId === slot.pe.id}
            onClick={() => onDeletePersonal(slot.pe.id)}
            className="flex min-h-[44px] w-full items-center justify-center rounded-xl border border-red-500/30 bg-red-500/20 text-sm font-medium text-red-400 transition hover:bg-red-500/30 disabled:opacity-45"
          >
            Delete event
          </button>
        </>
      ) : (
        (() => {
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
                <span className={cn("rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-wide", pillStyle)}>
                  {typeBadge}
                </span>
                <button
                  type="button"
                  onClick={() => onClose()}
                  className="flex h-11 w-11 items-center justify-center rounded-xl text-white/40 transition hover:bg-white/10 hover:text-white"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <h3 className="mb-2 text-lg font-bold leading-tight text-white">{ev.title}</h3>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className={cn("rounded-full border px-2.5 py-1 text-xs font-semibold uppercase", pillStyle)}>
                  {(ev.status ?? "pending").replace(/-/g, "").toUpperCase()}
                </span>
                {contentTypeChip ? (
                  <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white/50">
                    {contentTypeChip}
                  </span>
                ) : null}
              </div>
              <div className="mb-3 space-y-2">
                {sched || timeRangeLabel ? (
                  <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm">
                    <Calendar className="h-4 w-4 shrink-0 text-blue-400" />
                    <span className="text-white/40">{ev.kind === "task" ? "Due" : "When"}</span>
                    {sched ? <span className="font-medium text-white/80">{formatCalendarDisplayDate(sched)}</span> : null}
                    {timeRangeLabel ? (
                      <span className="font-semibold tabular-nums text-white">{timeRangeLabel}</span>
                    ) : sched && /\d{1,2}:\d{2}/.test(sched) ? (
                      <span className="text-white/35">{formatDateEuropean(sched)}</span>
                    ) : null}
                  </div>
                ) : null}
                {locationLine ? (
                  <div className="flex items-start gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2.5 text-sm">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" aria-hidden />
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-200/70">Location</p>
                      <p className="font-medium text-emerald-50">{locationLine}</p>
                    </div>
                  </div>
                ) : null}
                {ded ? (
                  <div
                    className={cn(
                      "flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2.5 text-sm",
                      deadlinePast && "border-red-500/20 bg-red-500/10",
                      deadlineSoon && !deadlinePast && "border-amber-500/20 bg-amber-500/10",
                      !deadlinePast && !deadlineSoon && "border-white/10 bg-white/5"
                    )}
                  >
                    <Clock
                      className={cn(
                        "h-4 w-4 shrink-0",
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
                    {deadlineSoon && !deadlinePast ? <span className="ml-auto text-amber-400">Soon</span> : null}
                  </div>
                ) : null}
                <div className="flex items-center gap-2 border-t border-white/5 pt-2 text-xs text-white/40">
                  <span>Listed day</span>
                  <span className="font-medium text-white/60">{formatCalendarDisplayDate(ev.dateYmd)}</span>
                  <span className="truncate text-white/30">({ev.sublabel})</span>
                </div>
              </div>
              {descriptionText ? (
                <p className="mb-4 whitespace-pre-wrap text-sm leading-relaxed text-white/55">{descriptionText}</p>
              ) : null}
              <div className="flex flex-col gap-2">
                {ev.kind === "va" ? (
                  <Link
                    href={ROUTES.model.contentAssignments}
                    className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl border border-indigo-500/30 bg-indigo-500/20 text-sm font-medium text-indigo-400 transition-all hover:bg-indigo-500/30"
                    onClick={onClose}
                  >
                    Open Chatting Assignments →
                  </Link>
                ) : null}
                {ev.kind === "custom" ? (
                  <Link
                    href={ROUTES.model.customs}
                    className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl border border-orange-500/30 bg-orange-500/20 text-sm font-medium text-orange-400 transition-all hover:bg-orange-500/30"
                    onClick={onClose}
                  >
                    Open custom request →
                  </Link>
                ) : null}
                {ev.kind === "task" ? (
                  <Link
                    href={ROUTES.model.tasks}
                    className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl border border-teal-500/30 bg-teal-500/20 text-sm font-medium text-teal-300 transition hover:bg-teal-500/30"
                    onClick={onClose}
                  >
                    Open tasks →
                  </Link>
                ) : null}
                {ev.kind === "schedule" ? (
                  <p className="text-center text-xs text-white/35">
                    {ev.schedule?.item_type === "content_shoot"
                      ? "Filming shoot from your schedule"
                      : "From your model schedule"}
                  </p>
                ) : null}
              </div>
            </>
          );
        })()
      )}
    </motion.div>
  );

  return createPortal(
    <>
      {isMobile ? (
        <button
          type="button"
          aria-label="Dismiss"
          className="fixed inset-0 z-[199] bg-black/55 backdrop-blur-[2px]"
          onClick={onClose}
        />
      ) : null}
      {panel}
    </>,
    document.body
  );
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
  /** model_schedule rows (content_shoot / filming, lives, scripts, …). Customs excluded client-side. */
  scheduleItems?: ModelScheduleItem[];
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
  scheduleItems = [],
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
  const [focusDayYmd, setFocusDayYmd] = React.useState(() => todayLocalYmd());
  const daySectionRefs = React.useRef<Record<string, HTMLElement | null>>({});
  const [cursor, setCursor] = React.useState(() => new Date());
  const [typeFilter, setTypeFilter] = React.useState<"all" | "va" | "custom" | "task" | "schedule">("all");
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
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    setMounted(true);
  }, []);

  const allEvents = React.useMemo(
    () => buildEvents(assignments, customs, tasks, scheduleItems),
    [assignments, customs, tasks, scheduleItems]
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

  React.useEffect(() => {
    if (!weekDaysYmd.includes(focusDayYmd)) {
      const today = todayLocalYmd();
      setFocusDayYmd(weekDaysYmd.includes(today) ? today : weekDaysYmd[0]!);
    }
  }, [weekDaysYmd, focusDayYmd]);

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
    setFocusDayYmd(today);
    setCursor(parseLocalYmd(monday));
  }

  function scrollToDay(ymd: string) {
    setFocusDayYmd(ymd);
    const el = daySectionRefs.current[ymd];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
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
                className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/75 transition hover:bg-white/10"
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
                className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/75 transition hover:bg-white/10"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
            <button
              type="button"
              onClick={() => setAddEventOpen(true)}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-pink-500/35 bg-pink-500/20 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-pink-100 transition hover:bg-pink-500/30"
            >
              <Plus className="h-4 w-4" />
              Add personal event
            </button>
          </div>
        </div>

        {periodBannerProps ? <PeriodStatusBanner {...periodBannerProps} /> : null}

        <div className="flex flex-wrap items-center gap-2">
          {(["all", "va", "custom", "task", "schedule"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setTypeFilter(k)}
              className={cn(
                "min-h-[44px] rounded-xl px-3 py-2.5 text-xs font-semibold uppercase tracking-wide transition-colors",
                typeFilter === k
                  ? "bg-pink-500/25 text-pink-100 ring-1 ring-pink-400/40"
                  : "bg-white/[0.06] text-white/55 hover:bg-white/10 hover:text-white/85"
              )}
            >
              {k === "all"
                ? "All types"
                : k === "va"
                  ? "VA"
                  : k === "custom"
                    ? "Customs"
                    : k === "task"
                      ? "Tasks"
                      : "Schedule"}
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
          className="mt-2 space-y-4"
        >
          {/* Mobile: compact week strip + vertical day list */}
          <div className="space-y-4 md:hidden">
            <div className="rounded-2xl border border-white/10 bg-black/40 p-2 backdrop-blur-xl">
              <div className="grid grid-cols-7 gap-1">
                {weekDaysYmd.map((ymd, i) => {
                  const d = parseLocalYmd(ymd);
                  const isTodayDay = todayLocalYmd() === ymd;
                  const isFocus = focusDayYmd === ymd;
                  const count = slotsForDay(ymd).length;
                  const isPeriodDay =
                    ymdInLoggedPeriod(ymd, loggedPeriodSpans) ||
                    ymdInActiveWindow(ymd, activePeriodWindow ?? undefined);
                  return (
                    <button
                      key={ymd}
                      type="button"
                      onClick={() => scrollToDay(ymd)}
                      aria-label={`${WEEKDAYS_MON[i]} ${d.getDate()}`}
                      aria-current={isTodayDay ? "date" : undefined}
                      className={cn(
                        "flex min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-xl px-0.5 py-1.5 transition",
                        isFocus && "bg-pink-500/25 ring-1 ring-pink-400/40",
                        !isFocus && "hover:bg-white/[0.06]",
                        isTodayDay && !isFocus && "ring-1 ring-pink-500/50"
                      )}
                    >
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-white/45">
                        {WEEKDAYS_MON[i]}
                      </span>
                      <span
                        className={cn(
                          "flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold tabular-nums",
                          isTodayDay ? "bg-pink-500 text-white" : isPeriodDay ? "text-rose-300" : "text-white"
                        )}
                      >
                        {d.getDate()}
                      </span>
                      <span className="flex h-1.5 items-center justify-center gap-0.5">
                        {count > 0 ? (
                          <span className="h-1.5 w-1.5 rounded-full bg-white/55" aria-hidden />
                        ) : (
                          <span className="h-1.5 w-1.5" aria-hidden />
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-3">
              {weekDaysYmd.map((ymd, i) => {
                const d = parseLocalYmd(ymd);
                const isTodayDay = todayLocalYmd() === ymd;
                const slots = slotsForDay(ymd);
                const isPeriodDay =
                  ymdInLoggedPeriod(ymd, loggedPeriodSpans) ||
                  ymdInActiveWindow(ymd, activePeriodWindow ?? undefined);
                const isPredictedDay = Boolean(predictedNextStart && ymd === predictedNextStart);
                const dayLabel = d.toLocaleDateString(undefined, {
                  weekday: "long",
                  month: "short",
                  day: "numeric",
                });
                return (
                  <section
                    key={ymd}
                    id={`cal-day-${ymd}`}
                    ref={(el) => {
                      daySectionRefs.current[ymd] = el;
                    }}
                    className={cn(
                      "scroll-mt-24 rounded-2xl border p-3.5 backdrop-blur-xl",
                      isPeriodDay && "border-rose-500/25 bg-rose-500/10",
                      !isPeriodDay && isPredictedDay && "border-amber-500/25 border-dashed bg-amber-500/[0.07]",
                      !isPeriodDay && !isPredictedDay && "border-white/10 bg-black/40",
                      focusDayYmd === ymd && "ring-1 ring-pink-400/30"
                    )}
                  >
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white">
                          {WEEKDAYS_MON[i]}
                          {isTodayDay ? (
                            <span className="ml-2 rounded-full bg-pink-500/25 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-pink-100">
                              Today
                            </span>
                          ) : null}
                        </p>
                        <p className="text-xs text-white/45">{dayLabel}</p>
                      </div>
                      {isPeriodDay ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-rose-300">
                          <Droplet className="h-3 w-3" aria-hidden /> Period
                        </span>
                      ) : null}
                    </div>
                    {slots.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-6 text-center">
                        <p className="text-sm text-white/35">Nothing scheduled</p>
                        <p className="mt-1 text-xs text-white/25">Free day — enjoy the quiet</p>
                      </div>
                    ) : (
                      <ul className="space-y-2">
                        {slots.map((slot) => (
                          <li key={slot.kind + slot.id}>
                            <EventPill
                              slot={slot}
                              variant="card"
                              onClick={(e) =>
                                setPopover({
                                  slot,
                                  anchor: e.currentTarget,
                                })
                              }
                            />
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                );
              })}
            </div>
          </div>

          {/* Desktop: rich 7-column week grid */}
          <div className="hidden gap-2 md:grid md:grid-cols-7">
            {weekDaysYmd.map((ymd, i) => {
              const d = parseLocalYmd(ymd);
              const isTodayDay = todayLocalYmd() === ymd;
              const slots = slotsForDay(ymd);
              const isPeriodDay =
                ymdInLoggedPeriod(ymd, loggedPeriodSpans) ||
                ymdInActiveWindow(ymd, activePeriodWindow ?? undefined);
              const isPredictedDay = Boolean(predictedNextStart && ymd === predictedNextStart);
              return (
                <div key={ymd} className="flex min-w-0 flex-col gap-1.5">
                  <div className="text-center">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
                      {WEEKDAYS_MON[i]}
                    </div>
                    <div className={cn("mt-0.5 flex min-h-[14px] items-center justify-center", isPeriodDay && "text-rose-400")}>
                      {isPeriodDay ? <Droplet className="h-3 w-3 text-rose-400" aria-hidden /> : null}
                    </div>
                    <div
                      className={cn(
                        "mx-auto mt-1 flex h-9 w-9 items-center justify-center rounded-full text-lg font-bold tabular-nums",
                        isTodayDay
                          ? "bg-pink-500 text-white shadow-[0_0_20px_-4px_rgba(236,72,153,0.7)]"
                          : isPeriodDay
                            ? "text-rose-400"
                            : "text-white"
                      )}
                    >
                      {d.getDate()}
                    </div>
                  </div>
                  <div
                    className={cn(
                      "min-h-[10rem] flex-1 space-y-1.5 rounded-2xl border p-2",
                      isPeriodDay && "border-rose-500/20 bg-rose-500/10 ring-1 ring-rose-500/15",
                      !isPeriodDay &&
                        isPredictedDay &&
                        "border-amber-500/20 bg-amber-500/10 ring-1 ring-amber-500/15",
                      !isPeriodDay && !isPredictedDay && "border-white/[0.08] bg-white/[0.03]"
                    )}
                  >
                    {slots.length === 0 ? (
                      <p className="pt-6 text-center text-[11px] text-white/25">Free</p>
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

      {addEventOpen && mounted
        ? createPortal(
            <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm">
              <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0f0f1a] p-5 pb-[calc(env(safe-area-inset-bottom)+76px+1.25rem)] md:p-5">
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
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
