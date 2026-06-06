"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  Calendar,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  LayoutGrid,
  List,
  Loader2,
  Package,
  Sparkles,
} from "lucide-react";
import type { ClientContentModelData } from "@/app/(dashboard)/client/content/page";
import { GlassModal } from "@/components/ui/glass-modal";
import { CustomRequestDetailModal } from "@/components/custom-request-detail-modal";
import { formatDateEuropean } from "@/lib/format";
import { formatDate, formatDateTime as formatDateTimeUk } from "@/lib/format-date";
import { addDays, addWeeks, getMondayOfWeek } from "@/lib/weekly-program";
import { cn } from "@/lib/utils";
import type { CustomRequest, CustomRequestModelStatus, ModelContentAssignmentCardDTO } from "@/types";

type StatusTab = "pending" | "scheduled" | "completed";

type Props = {
  clientId: string;
  models: ClientContentModelData[];
};

type AssignmentWithModel = ModelContentAssignmentCardDTO & {
  modelRecordId: string;
  modelName: string;
};

type CustomWithModel = CustomRequest & {
  modelRecordId: string;
  modelName: string;
};

function deadlineSortKey(iso: string | null): number {
  if (!iso) return Number.POSITIVE_INFINITY;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : Number.POSITIVE_INFINITY;
}

function hoursUntil(iso: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso).getTime();
  if (!Number.isFinite(d)) return null;
  return (d - Date.now()) / (1000 * 60 * 60);
}

function priorityClass(p: string): string {
  const x = (p || "").toLowerCase();
  if (x === "urgent") return "border-rose-500/40 bg-rose-500/15 text-rose-200";
  if (x === "high") return "border-amber-500/35 bg-amber-500/12 text-amber-200";
  if (x === "low") return "border-white/15 bg-white/[0.06] text-white/65";
  return "border-pink-400/30 bg-pink-500/12 text-pink-200";
}

function assignmentInTab(status: string, tab: StatusTab): boolean {
  const s = (status || "").toLowerCase();
  if (tab === "pending") return s === "pending";
  if (tab === "scheduled") return s === "scheduled";
  return s === "completed";
}

function customInTab(req: CustomRequest, tab: StatusTab): boolean {
  const m = req.model_status;
  if (tab === "pending") return m === "waiting_schedule";
  if (tab === "scheduled") return m === "scheduled" || m === "in_progress";
  return m === "uploaded" || m === "completed";
}

function modelStatusLabel(s: CustomRequestModelStatus): string {
  const map: Record<CustomRequestModelStatus, string> = {
    waiting_schedule: "Pending schedule",
    scheduled: "Scheduled",
    in_progress: "In progress",
    completed: "Completed",
    uploaded: "Uploaded",
    declined: "Declined",
  };
  return map[s] ?? "—";
}

function displayType(req: CustomRequest): string {
  return (req.custom_type ?? req.request_title ?? "").trim() || "—";
}

function displayRequestedDate(req: CustomRequest): string {
  const raw = (req.deadline_requested ?? "").trim();
  if (raw) return formatDateEuropean(raw);
  return formatDate((req.created_at ?? "").trim()) || "—";
}

const glassCard =
  "rounded-2xl border border-white/10 bg-gradient-to-br from-white/10 via-white/5 to-white/[0.02] backdrop-blur-xl shadow-[0_20px_60px_-20px_rgba(0,0,0,0.6)]";

type CalEvent = {
  id: string;
  title: string;
  modelName: string;
  date: string;
  kind: "va" | "custom";
  status: string;
  priority?: string;
};

const WEEKDAYS_MON = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

function toYmd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function todayLocalYmd(): string {
  return toYmd(new Date());
}

function parseLocalYmd(ymd: string): Date {
  const [y, mo, d] = ymd.slice(0, 10).split("-").map(Number);
  return new Date(y, mo - 1, d);
}

function eventDateFromIso(raw: string | null | undefined): string {
  if (raw == null) return "";
  const t = String(raw).trim();
  if (!t) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return "";
  return toYmd(d);
}

function monthMatrixMondayFirst(
  year: number,
  monthIndex0: number,
): { ymd: string; inMonth: boolean }[][] {
  const first = new Date(year, monthIndex0, 1);
  const day = first.getDay();
  const startPad = day === 0 ? 6 : day - 1;
  const daysInMonth = new Date(year, monthIndex0 + 1, 0).getDate();
  const cells: { ymd: string; inMonth: boolean }[] = [];

  const prevMonthIndex = monthIndex0 === 0 ? 11 : monthIndex0 - 1;
  const prevYear = monthIndex0 === 0 ? year - 1 : year;
  const daysInPrevMonth = new Date(prevYear, prevMonthIndex + 1, 0).getDate();
  for (let i = startPad - 1; i >= 0; i--) {
    const d = daysInPrevMonth - i;
    const dayDate = new Date(prevYear, prevMonthIndex, d);
    cells.push({ ymd: toYmd(dayDate), inMonth: false });
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dayDate = new Date(year, monthIndex0, d);
    cells.push({ ymd: toYmd(dayDate), inMonth: true });
  }

  let nextDay = 1;
  const nextMonthIndex = monthIndex0 === 11 ? 0 : monthIndex0 + 1;
  const nextYear = monthIndex0 === 11 ? year + 1 : year;
  while (cells.length % 7 !== 0) {
    const dayDate = new Date(nextYear, nextMonthIndex, nextDay);
    cells.push({ ymd: toYmd(dayDate), inMonth: false });
    nextDay += 1;
  }

  const rows: { ymd: string; inMonth: boolean }[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    rows.push(cells.slice(i, i + 7));
  }
  return rows;
}

function buildCalEvents(models: ClientContentModelData[]): CalEvent[] {
  return models
    .flatMap((m) => [
      ...m.assignments
        .filter((a) => {
          const s = (a.status || "").toLowerCase();
          return s !== "cancelled" && s !== "canceled";
        })
        .map((a) => ({
          id: `va-${a.id}`,
          title: a.title || "VA assignment",
          modelName: m.modelName,
          date: eventDateFromIso(a.scheduled_date) || eventDateFromIso(a.deadline),
          kind: "va" as const,
          status: a.status,
          priority: a.priority,
        })),
      ...m.customRequests
        .filter((c) => c.model_status !== "declined")
        .map((c) => ({
          id: `custom-${c.id}`,
          title: c.request_title || "Custom request",
          modelName: m.modelName,
          date:
            eventDateFromIso(c.model_scheduled_date) || eventDateFromIso(c.deadline_requested),
          kind: "custom" as const,
          status: c.model_status,
        })),
    ])
    .filter((e) => e.date.length > 0);
}

function calEventBorderClass(status: string): string {
  const s = (status || "").toLowerCase().replace(/\s+/g, "_");
  if (s === "pending") return "border-yellow-400/50";
  if (s === "scheduled" || s === "in_progress") return "border-cyan-400/50";
  if (s === "waiting_schedule") return "border-amber-400/50";
  return "border-white/20";
}

function calEventKindClass(kind: CalEvent["kind"]): string {
  if (kind === "va") return "bg-pink-500/20 text-pink-100";
  return "bg-pink-500/20 text-pink-100";
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

export function ClientContentHub({ models }: Props) {
  const router = useRouter();
  const [view, setView] = React.useState<"list" | "calendar">("list");
  const [calView, setCalView] = React.useState<"month" | "week">("month");
  const [currentDate, setCurrentDate] = React.useState(() => new Date());
  const [modelTab, setModelTab] = React.useState<string>("all");
  const [statusTab, setStatusTab] = React.useState<StatusTab>("pending");

  const [scheduleAssignment, setScheduleAssignment] = React.useState<AssignmentWithModel | null>(null);
  const [completeAssignment, setCompleteAssignment] = React.useState<AssignmentWithModel | null>(null);
  const [scheduleCustom, setScheduleCustom] = React.useState<CustomWithModel | null>(null);
  const [confirmUpload, setConfirmUpload] = React.useState<CustomWithModel | null>(null);
  const [detailCustom, setDetailCustom] = React.useState<CustomWithModel | null>(null);

  const [scheduleDate, setScheduleDate] = React.useState("");
  const [scheduleNotes, setScheduleNotes] = React.useState("");
  const [completeNotes, setCompleteNotes] = React.useState("");
  const [customDate, setCustomDate] = React.useState("");
  const [customStart, setCustomStart] = React.useState("10:00");
  const [customEnd, setCustomEnd] = React.useState("11:00");
  const [customNotes, setCustomNotes] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const allAssignments: AssignmentWithModel[] = React.useMemo(
    () =>
      models.flatMap((m) =>
        m.assignments.map((a) => ({
          ...a,
          modelRecordId: m.modelRecordId,
          modelName: m.modelName,
        })),
      ),
    [models],
  );

  const allCustoms: CustomWithModel[] = React.useMemo(
    () =>
      models.flatMap((m) =>
        m.customRequests.map((r) => ({
          ...r,
          modelRecordId: m.modelRecordId,
          modelName: m.modelName,
        })),
      ),
    [models],
  );

  const filteredAssignments = React.useMemo(() => {
    const active = allAssignments.filter((a) => (a.status || "").toLowerCase() !== "cancelled");
    const byModel =
      modelTab === "all" ? active : active.filter((a) => a.modelRecordId === modelTab);
    return [...byModel.filter((a) => assignmentInTab(a.status, statusTab))].sort(
      (a, b) => deadlineSortKey(a.deadline) - deadlineSortKey(b.deadline),
    );
  }, [allAssignments, modelTab, statusTab]);

  const filteredCustoms = React.useMemo(() => {
    const byModel =
      modelTab === "all" ? allCustoms : allCustoms.filter((r) => r.modelRecordId === modelTab);
    return byModel.filter((r) => customInTab(r, statusTab));
  }, [allCustoms, modelTab, statusTab]);

  const counts = React.useMemo(() => {
    const activeAssignments = allAssignments.filter(
      (a) => (a.status || "").toLowerCase() !== "cancelled",
    );
    const byModelAssignments =
      modelTab === "all"
        ? activeAssignments
        : activeAssignments.filter((a) => a.modelRecordId === modelTab);
    const byModelCustoms =
      modelTab === "all" ? allCustoms : allCustoms.filter((r) => r.modelRecordId === modelTab);

    return {
      pending:
        byModelAssignments.filter((a) => assignmentInTab(a.status, "pending")).length +
        byModelCustoms.filter((r) => customInTab(r, "pending")).length,
      scheduled:
        byModelAssignments.filter((a) => assignmentInTab(a.status, "scheduled")).length +
        byModelCustoms.filter((r) => customInTab(r, "scheduled")).length,
      completed:
        byModelAssignments.filter((a) => assignmentInTab(a.status, "completed")).length +
        byModelCustoms.filter((r) => customInTab(r, "completed")).length,
    };
  }, [allAssignments, allCustoms, modelTab]);

  const filteredModels = React.useMemo(
    () => (modelTab === "all" ? models : models.filter((m) => m.modelRecordId === modelTab)),
    [models, modelTab],
  );

  const allEvents = React.useMemo(() => buildCalEvents(filteredModels), [filteredModels]);

  React.useEffect(() => {
    console.log("Calendar events:", allEvents.length, allEvents.slice(0, 3));
  }, [allEvents]);

  const weekStartYmd = React.useMemo(
    () => getMondayOfWeek(toYmd(currentDate)),
    [currentDate],
  );

  const weekDaysYmd = React.useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStartYmd, i)),
    [weekStartYmd],
  );

  const monthYear = currentDate.getFullYear();
  const monthIndex0 = currentDate.getMonth();
  const monthMatrix = React.useMemo(
    () => monthMatrixMondayFirst(monthYear, monthIndex0),
    [monthYear, monthIndex0],
  );
  const monthLabel = currentDate.toLocaleString(undefined, { month: "long", year: "numeric" });
  const todayYmd = todayLocalYmd();

  function goCalPrev() {
    if (calView === "week") {
      setCurrentDate(parseLocalYmd(addWeeks(weekStartYmd, -1)));
    } else {
      setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
    }
  }

  function goCalNext() {
    if (calView === "week") {
      setCurrentDate(parseLocalYmd(addWeeks(weekStartYmd, 1)));
    } else {
      setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
    }
  }

  function goCalToday() {
    setCurrentDate(new Date());
  }

  React.useEffect(() => {
    if (scheduleAssignment) {
      setScheduleDate("");
      setScheduleNotes("");
      setError(null);
    }
  }, [scheduleAssignment]);

  React.useEffect(() => {
    if (completeAssignment) {
      setCompleteNotes("");
      setError(null);
    }
  }, [completeAssignment]);

  React.useEffect(() => {
    if (!scheduleCustom) return;
    const d = (scheduleCustom.model_scheduled_date ?? "").trim();
    setCustomDate(d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : "");
    setCustomNotes("");
    setError(null);
  }, [scheduleCustom]);

  React.useEffect(() => {
    if (confirmUpload) setError(null);
  }, [confirmUpload]);

  async function submitScheduleAssignment() {
    if (!scheduleAssignment || !scheduleDate) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/client/content/schedule-assignment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignment_id: scheduleAssignment.id,
          model_id: scheduleAssignment.modelRecordId,
          scheduled_date: scheduleDate,
          notes: scheduleNotes.trim() || undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: unknown };
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not save.");
        return;
      }
      setScheduleAssignment(null);
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  async function submitCompleteAssignment() {
    if (!completeAssignment) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/client/content/complete-assignment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignment_id: completeAssignment.id,
          model_id: completeAssignment.modelRecordId,
          completion_notes: completeNotes.trim() || undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: unknown };
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not save.");
        return;
      }
      setCompleteAssignment(null);
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  async function submitScheduleCustom(e: React.FormEvent) {
    e.preventDefault();
    if (!scheduleCustom) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/client/content/schedule-custom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          record_id: scheduleCustom.id,
          model_id: scheduleCustom.modelRecordId,
          date: customDate,
          start_time: customStart,
          end_time: customEnd,
          notes: customNotes.trim() || undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: unknown };
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not save.");
        return;
      }
      setScheduleCustom(null);
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  async function submitMarkUploaded() {
    if (!confirmUpload) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/client/content/mark-uploaded", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          record_id: confirmUpload.id,
          model_id: confirmUpload.modelRecordId,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: unknown };
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not save.");
        return;
      }
      setConfirmUpload(null);
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  const downloadTarget = (a: ModelContentAssignmentCardDTO) => {
    const att = a.file_attachment.find((x) => x.url);
    if (att?.url) return { href: att.url, label: att.filename || "Download file" };
    if (a.file_url) return { href: a.file_url, label: "Open link" };
    return null;
  };

  if (models.length === 0) {
    return (
      <div className={cn(glassCard, "p-10 text-center")}>
        <LayoutGrid className="mx-auto mb-3 h-10 w-10 text-pink-300/40" aria-hidden />
        <p className="font-medium text-white">No models assigned yet</p>
        <p className="mt-1 text-sm text-white/50">Content for your models will appear here.</p>
      </div>
    );
  }

  const statusTabs: { id: StatusTab; label: string }[] = [
    { id: "pending", label: "Pending" },
    { id: "scheduled", label: "Scheduled" },
    { id: "completed", label: "Completed" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setView("list")}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition",
            view === "list"
              ? "border-pink-400/50 bg-pink-500/20 text-pink-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
              : "border-white/10 bg-black/30 text-white/60 hover:border-white/20 hover:text-white/85",
          )}
        >
          <List className="h-4 w-4 shrink-0" aria-hidden />
          List
        </button>
        <button
          type="button"
          onClick={() => setView("calendar")}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition",
            view === "calendar"
              ? "border-pink-400/50 bg-pink-500/20 text-pink-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
              : "border-white/10 bg-black/30 text-white/60 hover:border-white/20 hover:text-white/85",
          )}
        >
          <Calendar className="h-4 w-4 shrink-0" aria-hidden />
          Calendar
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setModelTab("all")}
          className={cn(
            "rounded-full border px-4 py-2 text-sm font-medium transition",
            modelTab === "all"
              ? "border-pink-400/50 bg-pink-500/20 text-pink-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
              : "border-white/10 bg-black/30 text-white/60 hover:border-white/20 hover:text-white/85",
          )}
        >
          All Models
        </button>
        {models.map((m) => (
          <button
            key={m.modelRecordId}
            type="button"
            onClick={() => setModelTab(m.modelRecordId)}
            className={cn(
              "rounded-full border px-4 py-2 text-sm font-medium transition",
              modelTab === m.modelRecordId
                ? "border-pink-400/50 bg-pink-500/20 text-pink-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                : "border-white/10 bg-black/30 text-white/60 hover:border-white/20 hover:text-white/85",
            )}
          >
            {m.modelName}
          </button>
        ))}
      </div>

      {view === "list" ? (
        <div className="flex flex-wrap gap-2">
        {statusTabs.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setStatusTab(id)}
            className={cn(
              "rounded-full border px-4 py-2 text-sm font-medium transition",
              statusTab === id
                ? "border-pink-400/50 bg-pink-500/20 text-pink-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                : "border-white/10 bg-black/30 text-white/60 hover:border-white/20 hover:text-white/85",
            )}
          >
            {label}
            <span className="ml-1.5 tabular-nums text-white/40">({counts[id]})</span>
          </button>
        ))}
        </div>
      ) : null}

      {view === "calendar" ? (
        <div className={cn(glassCard, "overflow-hidden p-0")}>
          <div className="flex flex-col gap-4 border-b border-white/10 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex rounded-full border border-white/10 bg-black/30 p-0.5">
                <button
                  type="button"
                  onClick={() => setCalView("month")}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-semibold transition",
                    calView === "month"
                      ? "border border-pink-400/50 bg-pink-500/20 text-pink-100"
                      : "text-white/50 hover:text-white/85",
                  )}
                >
                  Month
                </button>
                <button
                  type="button"
                  onClick={() => setCalView("week")}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-semibold transition",
                    calView === "week"
                      ? "border border-pink-400/50 bg-pink-500/20 text-pink-100"
                      : "text-white/50 hover:text-white/85",
                  )}
                >
                  Week
                </button>
              </div>
              <p className="text-sm font-semibold capitalize text-white">
                {calView === "month" ? monthLabel : weekRangeLabel(weekStartYmd)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label={calView === "week" ? "Previous week" : "Previous month"}
                onClick={goCalPrev}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-black/30 text-white/75 transition hover:border-white/20 hover:text-white"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={goCalToday}
                className="rounded-full border border-pink-400/35 bg-pink-500/10 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-pink-100 transition hover:bg-pink-500/18"
              >
                Today
              </button>
              <button
                type="button"
                aria-label={calView === "week" ? "Next week" : "Next month"}
                onClick={goCalNext}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-black/30 text-white/75 transition hover:border-white/20 hover:text-white"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>

          {calView === "month" ? (
            <>
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
                      const day = parseLocalYmd(cell.ymd);
                      const dayEvents = allEvents.filter((e) => e.date === toYmd(day));
                      return (
                        <div
                          key={ci}
                          className={cn(
                            "min-h-[112px] p-1.5 sm:min-h-[132px] sm:p-2",
                            !cell.inMonth && "bg-black/25",
                          )}
                        >
                          <div
                            className={cn(
                              "mb-1 flex items-center justify-end text-xs font-medium tabular-nums",
                              cell.inMonth ? "text-white/70" : "text-white/25",
                              todayYmd === cell.ymd &&
                                "mx-auto w-fit rounded-full bg-pink-500 px-2 py-0.5 font-bold text-white",
                            )}
                          >
                            {day.getDate()}
                          </div>
                          <div className="flex max-h-[5.5rem] flex-col gap-1 overflow-y-auto">
                            {dayEvents.map((ev) => (
                              <div
                                key={ev.id}
                                title={`${ev.title} · ${ev.modelName}`}
                                className={cn(
                                  "truncate rounded-lg border px-1.5 py-0.5 text-[10px] leading-tight",
                                  calEventBorderClass(ev.status),
                                  calEventKindClass(ev.kind),
                                )}
                              >
                                <span className="block truncate font-medium">{ev.title}</span>
                                <span className="block truncate opacity-65">{ev.modelName}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="overflow-x-auto p-4 pb-6 [-webkit-overflow-scrolling:touch]">
              <div className="grid min-w-[44rem] grid-cols-7 gap-2 md:min-w-0">
                {weekDaysYmd.map((ymd, i) => {
                  const d = parseLocalYmd(ymd);
                  const isTodayDay = todayYmd === ymd;
                  const dayEvents = allEvents.filter((e) => e.date === toYmd(d));
                  return (
                    <div key={ymd} className="flex min-w-0 flex-col gap-1">
                      <div className="text-center">
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
                          {WEEKDAYS_MON[i]}
                        </div>
                        <div
                          className={cn(
                            "mx-auto mt-1 flex h-8 w-8 items-center justify-center rounded-full text-lg font-bold tabular-nums",
                            isTodayDay ? "bg-pink-500 text-white" : "text-white",
                          )}
                        >
                          {d.getDate()}
                        </div>
                      </div>
                      <div className="min-h-[8rem] flex-1 space-y-2 rounded-xl border border-white/[0.08] bg-white/[0.03] p-2">
                        {dayEvents.length === 0 ? (
                          <p className="pt-4 text-center text-[10px] text-white/20">—</p>
                        ) : (
                          dayEvents.map((ev) => (
                            <div
                              key={ev.id}
                              title={`${ev.title} · ${ev.modelName}`}
                              className={cn(
                                "rounded-lg border p-2 text-xs",
                                calEventBorderClass(ev.status),
                                calEventKindClass(ev.kind),
                              )}
                            >
                              <p className="truncate font-semibold">{ev.title}</p>
                              <p className="mt-0.5 truncate text-[10px] opacity-70">{ev.modelName}</p>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        <>
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-white">VA Assignments</h2>
        {filteredAssignments.length === 0 ? (
          <p className={cn(glassCard, "px-5 py-8 text-center text-sm text-white/50")}>
            No VA assignments in this tab.
          </p>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {filteredAssignments.map((a) => {
              const st = (a.status || "").toLowerCase();
              const h = hoursUntil(a.deadline);
              const urgent = st !== "completed" && h != null && h > 0 && h < 48;
              const overdue = st !== "completed" && h != null && h < 0;
              const downloadInfo = downloadTarget(a);

              return (
                <li
                  key={a.id}
                  className={cn(
                    glassCard,
                    "relative flex flex-col p-5",
                    urgent || overdue ? "border-pink-500/35" : "border-white/10",
                  )}
                >
                  {(urgent || overdue) && (
                    <div
                      className={cn(
                        "mb-3 flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium",
                        overdue
                          ? "border-rose-500/35 bg-rose-500/10 text-rose-200"
                          : "border-amber-500/35 bg-amber-500/10 text-amber-100",
                      )}
                    >
                      {overdue ? (
                        <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
                      ) : (
                        <Clock className="h-4 w-4 shrink-0" aria-hidden />
                      )}
                      {overdue ? "Past deadline" : "Due within 48 hours"}
                    </div>
                  )}

                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-pink-300/70">
                        {a.modelName}
                      </p>
                      <h3 className="mt-1 text-lg font-semibold leading-snug text-white">
                        {a.title || "—"}
                      </h3>
                    </div>
                    {a.priority ? (
                      <span
                        className={cn(
                          "shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                          priorityClass(a.priority),
                        )}
                      >
                        {a.priority}
                      </span>
                    ) : null}
                  </div>

                  {a.description ? (
                    <p className="mt-2 line-clamp-4 text-sm leading-relaxed text-white/60">
                      {a.description}
                    </p>
                  ) : null}

                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/45">
                    <span className="inline-flex items-center gap-1">
                      <CalendarClock className="h-3.5 w-3.5 text-pink-300/80" aria-hidden />
                      Deadline:{""}
                      <span className={cn("font-medium text-white/70", urgent && "text-pink-200")}>
                        {formatDateTimeUk(a.deadline)}
                      </span>
                    </span>
                    {a.va_name ? (
                      <span>
                        VA: <span className="text-white/65">{a.va_name}</span>
                      </span>
                    ) : null}
                    {a.content_type ? <span>Type: {a.content_type}</span> : null}
                  </div>

                  {st === "scheduled" && a.scheduled_date ? (
                    <p className="mt-2 text-xs text-white/50">
                      Scheduled for{""}
                      <span className="font-medium text-pink-200/95">
                        {formatDateTimeUk(a.scheduled_date)}
                      </span>
                    </p>
                  ) : null}

                  {st === "completed" && a.completed_at ? (
                    <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-emerald-300/90">
                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                      Completed {formatDateTimeUk(a.completed_at)}
                    </p>
                  ) : null}

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    {downloadInfo ? (
                      <a
                        href={downloadInfo.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-pink-600 to-pink-500 px-4 py-2.5 text-sm font-bold text-white shadow-lg ring-1 ring-pink-400/40 transition hover:from-pink-500 hover:to-pink-500"
                      >
                        <Download className="h-4 w-4 shrink-0" aria-hidden />
                        {downloadInfo.label}
                      </a>
                    ) : null}

                    {st === "pending" ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setScheduleAssignment(a)}
                        className="inline-flex min-h-[44px] items-center rounded-xl border border-pink-400/35 bg-pink-500/10 px-4 py-2.5 text-sm font-semibold text-pink-100 transition hover:bg-pink-500/18 disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        Schedule
                      </button>
                    ) : null}

                    {st === "scheduled" ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setCompleteAssignment(a)}
                        className="inline-flex min-h-[44px] items-center rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-4 py-2.5 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/18 disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        Mark complete
                      </button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-white">Custom Requests</h2>
        {filteredCustoms.length === 0 ? (
          <div className={cn(glassCard, "p-8 text-center")}>
            <Package className="mx-auto h-10 w-10 text-white/35" aria-hidden />
            <p className="mt-4 text-sm text-white/60">No custom requests in this tab.</p>
          </div>
        ) : (
          <div className={cn(glassCard, "overflow-hidden")}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-xs uppercase tracking-wider text-white/45">
                    <th className="px-4 py-3 font-semibold">Model</th>
                    <th className="px-4 py-3 font-semibold">Fan</th>
                    <th className="px-4 py-3 font-semibold">Type</th>
                    <th className="px-4 py-3 font-semibold">Price</th>
                    <th className="px-4 py-3 font-semibold">Requested</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCustoms.map((r) => (
                    <tr
                      key={r.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setDetailCustom(r)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === "") {
                          e.preventDefault();
                          setDetailCustom(r);
                        }
                      }}
                      className="cursor-pointer border-b border-white/[0.06] transition-colors hover:bg-pink-500/[0.06]"
                    >
                      <td className="px-4 py-3 text-pink-200/90">{r.modelName}</td>
                      <td className="px-4 py-3 font-medium text-white">{r.fan_username?.trim() || "—"}</td>
                      <td className="max-w-[200px] truncate px-4 py-3 text-white/80">{displayType(r)}</td>
                      <td className="px-4 py-3 text-pink-200/95">{r.price?.trim() || "—"}</td>
                      <td className="px-4 py-3 text-white/60">{displayRequestedDate(r)}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-pink-400/20 bg-pink-500/10 px-2.5 py-1 text-xs font-medium text-pink-100/95">
                          <Sparkles className="h-3.5 w-3.5 opacity-80" aria-hidden />
                          {modelStatusLabel(r.model_status)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
        </>
      )}

      <CustomRequestDetailModal
        open={detailCustom != null}
        onOpenChange={(open) => {
          if (!open) setDetailCustom(null);
        }}
        request={detailCustom}
        language="en"
        variant="model"
        onSchedule={() => {
          if (!detailCustom) return;
          setScheduleCustom(detailCustom);
          setDetailCustom(null);
        }}
        onMarkUploaded={() => {
          if (!detailCustom) return;
          setConfirmUpload(detailCustom);
          setDetailCustom(null);
        }}
      >
        {detailCustom?.model_notes ? (
          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-white/40">Notes</p>
            <p className="mt-2 whitespace-pre-wrap text-sm text-white/70">{detailCustom.model_notes}</p>
          </section>
        ) : null}
      </CustomRequestDetailModal>

      {scheduleAssignment ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => !busy && setScheduleAssignment(null)}
        >
          <div
            className={cn(glassCard, "w-full max-w-md p-6")}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-white">Schedule delivery</h3>
            <p className="mt-1 text-sm text-white/55">
              {scheduleAssignment.modelName} — {scheduleAssignment.title}
            </p>
            <label className="mt-5 block text-xs font-medium uppercase tracking-wide text-white/45">
              Date
              <input
                type="date"
                value={scheduleDate}
                onChange={(e) => setScheduleDate(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-white/15 bg-black/50 px-3 py-2.5 text-sm text-white"
              />
            </label>
            <label className="mt-4 block text-xs font-medium uppercase tracking-wide text-white/45">
              Notes (optional)
              <textarea
                value={scheduleNotes}
                onChange={(e) => setScheduleNotes(e.target.value)}
                rows={3}
                className="mt-1.5 w-full resize-none rounded-xl border border-white/15 bg-black/50 px-3 py-2.5 text-sm text-white placeholder:text-white/30"
              />
            </label>
            {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => setScheduleAssignment(null)}
                className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-medium text-white/80 hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy || !scheduleDate}
                onClick={() => void submitScheduleAssignment()}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-pink-600 to-pink-500 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
              >
                {busy ? (
                  <>
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                    Saving…
                  </>
                ) : (
                  "Save & notify VA"
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {completeAssignment ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => !busy && setCompleteAssignment(null)}
        >
          <div
            className={cn(glassCard, "w-full max-w-md p-6")}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-white">Mark complete</h3>
            <p className="mt-1 text-sm text-white/55">
              {completeAssignment.modelName} — {completeAssignment.title}
            </p>
            <label className="mt-5 block text-xs font-medium uppercase tracking-wide text-white/45">
              Completion notes
              <textarea
                value={completeNotes}
                onChange={(e) => setCompleteNotes(e.target.value)}
                rows={3}
                className="mt-1.5 w-full resize-none rounded-xl border border-white/15 bg-black/50 px-3 py-2.5 text-sm text-white placeholder:text-white/30"
              />
            </label>
            {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => setCompleteAssignment(null)}
                className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-medium text-white/80 hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void submitCompleteAssignment()}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
              >
                {busy ? (
                  <>
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                    Completing…
                  </>
                ) : (
                  "Complete & notify VA"
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <AnimatePresence>
        {scheduleCustom ? (
          <GlassModal
            onClose={() => !busy && setScheduleCustom(null)}
            title="Schedule custom"
            subtitle={`${scheduleCustom.modelName} — ${scheduleCustom.request_title || ""}`}
          >
            <form onSubmit={(e) => void submitScheduleCustom(e)} className="space-y-4 px-4 py-5 md:px-5">
              {error ? (
                <p className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                  {error}
                </p>
              ) : null}
              <div className="space-y-1.5">
                <label className="text-xs font-medium uppercase tracking-wider text-white/45" htmlFor="cr-date">
                  Date
                </label>
                <input
                  id="cr-date"
                  type="date"
                  required
                  value={customDate}
                  onChange={(e) => setCustomDate(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/50 px-3 py-2.5 text-sm text-white outline-none ring-pink-400/30 focus:ring-2"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium uppercase tracking-wider text-white/45" htmlFor="cr-start">
                    Start
                  </label>
                  <input
                    id="cr-start"
                    type="time"
                    required
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-black/50 px-3 py-2.5 text-sm text-white outline-none ring-pink-400/30 focus:ring-2"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium uppercase tracking-wider text-white/45" htmlFor="cr-end">
                    End
                  </label>
                  <input
                    id="cr-end"
                    type="time"
                    required
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-black/50 px-3 py-2.5 text-sm text-white outline-none ring-pink-400/30 focus:ring-2"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium uppercase tracking-wider text-white/45" htmlFor="cr-notes">
                  Notes
                </label>
                <textarea
                  id="cr-notes"
                  value={customNotes}
                  onChange={(e) => setCustomNotes(e.target.value)}
                  rows={3}
                  placeholder="Optional…"
                  className="w-full resize-none rounded-xl border border-white/10 bg-black/50 px-3 py-2.5 text-sm text-white outline-none ring-pink-400/30 focus:ring-2"
                />
              </div>
              <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setScheduleCustom(null)}
                  className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-medium text-white/80 hover:bg-white/[0.06] disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-pink-600 to-pink-500 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {busy ? (
                    <>
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                      Saving…
                    </>
                  ) : (
                    "Save schedule"
                  )}
                </button>
              </div>
            </form>
          </GlassModal>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {confirmUpload ? (
          <GlassModal
            onClose={() => !busy && setConfirmUpload(null)}
            title="Mark as uploaded?"
            subtitle={`${confirmUpload.modelName} — ${confirmUpload.request_title || ""}`}
          >
            <div className="space-y-4 px-4 py-5 md:px-5">
              {error ? (
                <p className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                  {error}
                </p>
              ) : null}
              <p className="text-sm leading-relaxed text-white/65">
                This tells the chatter and admins the custom content is uploaded.
              </p>
              <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setConfirmUpload(null)}
                  className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-medium text-white/80 hover:bg-white/[0.06] disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void submitMarkUploaded()}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-pink-600 to-pink-500 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {busy ? (
                    <>
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                      Updating…
                    </>
                  ) : (
                    "Confirm"
                  )}
                </button>
              </div>
            </div>
          </GlassModal>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
