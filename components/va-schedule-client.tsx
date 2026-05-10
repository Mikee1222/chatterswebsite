"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock,
  RotateCcw,
  CheckCircle2,
} from "lucide-react";
import { formatDateEuropean, formatDateTimeAthens } from "@/lib/format";
import { ROUTES } from "@/lib/routes";
import {
  WEEKLY_PROGRAM_DAY_OPTIONS,
  addDays,
  addWeeks,
  formatWeekLabel,
  getMondayOfWeek,
  getThisWeekMonday,
  getTodayYmd,
} from "@/lib/weekly-program";
import { updateVaTaskStatusAction } from "@/app/actions/va-tasks";
import { getNextOccurrence, vaTaskSeriesKey } from "@/lib/recurrence";
import type { Shift, VaTaskRecord, WeeklyProgramDay, WeeklyProgramRecord } from "@/types";
import { cn } from "@/lib/utils";

export type VaScheduleClientProps = {
  weeklyProgram: WeeklyProgramRecord[];
  tasks: VaTaskRecord[];
  activeShifts: Shift[];
  weekStart: string;
  /** Resolve `model_ids` to display names when Airtable does not return `model_names`. */
  modelIdToName?: Record<string, string>;
};

/** Weekly program times are stored as UTC instants; show UTC clock (no locale shift). */
function formatShiftTime(isoString: string | null | undefined): string {
  if (isoString == null || String(isoString).trim() === "") return "?";
  const s = String(isoString).trim();
  if (!s.includes("T")) {
    const m = /^(\d{1,2}):(\d{2})/.exec(s);
    if (m) return `${m[1].padStart(2, "0")}:${m[2]}`;
    return s.slice(0, 5);
  }
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "?";
  const h = d.getUTCHours().toString().padStart(2, "0");
  const min = d.getUTCMinutes().toString().padStart(2, "0");
  return `${h}:${min}`;
}

function formatShiftTimeRange(start: string | null | undefined, end: string | null | undefined): string {
  const a = formatShiftTime(start);
  const b = formatShiftTime(end);
  if (a === "?" && b === "?") return "—";
  if (b === "?") return a;
  if (a === "?") return b;
  return `${a}–${b}`;
}

function collectProgramModelNames(
  p: WeeklyProgramRecord,
  modelIdToName: Record<string, string> | undefined
): string[] {
  const fromRollup = (p.model_names ?? []).map((n) => n.trim()).filter(Boolean);
  if (fromRollup.length) return fromRollup;
  if (!modelIdToName) return [];
  return (p.model_ids ?? [])
    .map((id) => modelIdToName[id]?.trim())
    .filter((n): n is string => Boolean(n));
}

function monthFirstYmd(mondayYmd: string): string {
  const [y, m] = mondayYmd.split("-").map(Number);
  if (!y || !m) return mondayYmd;
  return `${y}-${String(m).padStart(2, "0")}-01`;
}

function toLocalYmd(isoLike: string | null): string {
  if (!isoLike?.trim()) return "";
  const d = new Date(isoLike.trim());
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getRecurringPreviewDates(
  task: VaTaskRecord,
  calendarStart: string,
  calendarEnd: string,
  maxOccurrences = 20
): string[] {
  if (!task.is_recurring || !task.due_date?.trim() || !task.recurrence_type) return [];

  const dates: string[] = [];
  let current = task.due_date.trim();
  let count = 0;

  while (count < maxOccurrences) {
    const next = getNextOccurrence(
      current,
      task.recurrence_type,
      task.recurrence_interval ?? 1,
      task.recurrence_days ?? [],
      task.recurrence_end_date
    );

    if (!next) break;

    const nextYmd = toLocalYmd(next) || next.slice(0, 10);
    if (!nextYmd) break;
    if (nextYmd > calendarEnd) break;
    if (nextYmd >= calendarStart) dates.push(nextYmd);

    current = next;
    count++;
  }

  return dates;
}

const SHIFT_TYPE_CONFIG = {
  Morning: {
    label: "Morning",
    emoji: "☀️",
    color: "from-amber-500/20 to-orange-500/10",
    border: "border-amber-500/25",
    text: "text-amber-400",
    dot: "bg-amber-400",
  },
  Night: {
    label: "Night",
    emoji: "🌙",
    color: "from-blue-500/20 to-indigo-500/10",
    border: "border-blue-500/25",
    text: "text-blue-400",
    dot: "bg-blue-400",
  },
  Custom: {
    label: "Custom",
    emoji: "⚡",
    color: "from-purple-500/20 to-pink-500/10",
    border: "border-purple-500/25",
    text: "text-purple-400",
    dot: "bg-purple-400",
  },
} as const;

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export function VaScheduleClient({
  weeklyProgram,
  tasks,
  activeShifts,
  weekStart,
  modelIdToName,
}: VaScheduleClientProps) {
  const router = useRouter();
  const [view, setView] = React.useState<"week" | "month">("week");
  const [selectedDay, setSelectedDay] = React.useState<string | null>(null);
  const [detailTask, setDetailTask] = React.useState<VaTaskRecord | null>(null);
  const [completing, setCompleting] = React.useState(false);

  const todayYmd = getTodayYmd();
  const thisWeekMonday = getThisWeekMonday();

  const weekDates = React.useMemo(
    () =>
      WEEKLY_PROGRAM_DAY_OPTIONS.map((day, i) => ({
        day,
        ymd: addDays(weekStart, i),
      })),
    [weekStart]
  );

  const monthGrid = React.useMemo(() => {
    const first = monthFirstYmd(weekStart);
    const gridStart = getMondayOfWeek(first);
    const rows: { ymd: string; day: WeeklyProgramDay }[][] = [];
    for (let r = 0; r < 6; r++) {
      const mon = addWeeks(gridStart, r);
      const row: { ymd: string; day: WeeklyProgramDay }[] = [];
      for (let c = 0; c < 7; c++) {
        const ymd = addDays(mon, c);
        const di = new Date(ymd + "T12:00:00.000Z").getUTCDay();
        const day = WEEKLY_PROGRAM_DAY_OPTIONS[(di + 6) % 7];
        row.push({ ymd, day });
      }
      rows.push(row);
    }
    return rows;
  }, [weekStart]);

  const programsByYmd = React.useMemo(() => {
    const m = new Map<string, WeeklyProgramRecord[]>();
    for (const p of weeklyProgram) {
      const monday = (p.week_start ?? "").trim().slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(monday)) continue;
      const di = WEEKLY_PROGRAM_DAY_OPTIONS.indexOf(p.day);
      if (di < 0) continue;
      const ymd = addDays(monday, di);
      const list = m.get(ymd) ?? [];
      list.push(p);
      m.set(ymd, list);
    }
    return m;
  }, [weeklyProgram]);

  const tasksByYmd = React.useMemo(() => {
    const map = new Map<string, VaTaskRecord[]>();
    for (const t of tasks) {
      if (!t.due_date?.trim()) continue;
      const y = toLocalYmd(t.due_date);
      if (!y) continue;
      const list = map.get(y) ?? [];
      list.push(t);
      map.set(y, list);
    }
    return map;
  }, [tasks]);

  const { calendarStart, calendarEnd } = React.useMemo(() => {
    if (view === "week") {
      const start = weekDates[0]?.ymd ?? weekStart;
      const end = weekDates[weekDates.length - 1]?.ymd ?? weekStart;
      return { calendarStart: start, calendarEnd: end };
    }
    const flat = monthGrid.flat().map((c) => c.ymd);
    const sorted = [...flat].sort();
    return {
      calendarStart: sorted[0] ?? weekStart,
      calendarEnd: sorted[sorted.length - 1] ?? weekStart,
    };
  }, [view, weekDates, monthGrid, weekStart]);

  const recurringPreviews = React.useMemo(() => {
    const map: Record<string, VaTaskRecord[]> = {};
    const seriesMap = new Map<string, VaTaskRecord>();
    for (const task of tasks) {
      if (!task.is_recurring || !task.due_date?.trim()) continue;
      if (task.status !== "pending" && task.status !== "in_progress") continue;

      const key = vaTaskSeriesKey(task);
      const existing = seriesMap.get(key);
      const td = new Date(task.due_date.trim()).getTime();
      const ed = existing?.due_date ? new Date(existing.due_date.trim()).getTime() : NaN;
      if (!existing || (!Number.isNaN(td) && (Number.isNaN(ed) || td > ed))) {
        seriesMap.set(key, task);
      }
    }

    for (const [, task] of seriesMap) {
      const futureDates = getRecurringPreviewDates(task, calendarStart, calendarEnd);
      const series = vaTaskSeriesKey(task);

      for (const date of futureDates) {
        const alreadyHasRealTask = tasks.some((t) => {
          const y = toLocalYmd(t.due_date);
          return y === date && vaTaskSeriesKey(t) === series;
        });
        if (alreadyHasRealTask) continue;

        if (!map[date]) map[date] = [];
        if (!map[date].some((t) => t.id === task.id)) map[date].push(task);
      }
    }

    return map;
  }, [tasks, calendarStart, calendarEnd]);

  function navigateWeeks(delta: number) {
    const next = addWeeks(weekStart, delta);
    router.push(`${ROUTES.va.schedule}?week_start=${encodeURIComponent(next)}`);
  }

  function goToThisWeek() {
    router.push(`${ROUTES.va.schedule}?week_start=${encodeURIComponent(thisWeekMonday)}`);
  }

  const isCurrentWeek = weekStart === thisWeekMonday;

  const selectedPrograms = selectedDay ? (programsByYmd.get(selectedDay) ?? []) : [];
  const selectedTasks = selectedDay ? (tasksByYmd.get(selectedDay) ?? []) : [];

  async function markTaskDone(task: VaTaskRecord) {
    setCompleting(true);
    try {
      const res = await updateVaTaskStatusAction({
        taskId: task.id,
        status: "done",
        completed_notes: "",
      });
      if (res.success) {
        setDetailTask(null);
        router.refresh();
      }
    } finally {
      setCompleting(false);
    }
  }

  function formatDayNum(ymd: string): string {
    return new Date(ymd + "T12:00:00.000Z").toLocaleDateString("en-GB", {
      day: "numeric",
      timeZone: "UTC",
    });
  }

  function formatMonthYearFromMonday(mondayYmd: string): string {
    const first = monthFirstYmd(mondayYmd);
    return new Date(first + "T12:00:00.000Z").toLocaleDateString("en-GB", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });
  }

  function DayCell({ ymd, compact }: { ymd: string; compact?: boolean }) {
    const programs = programsByYmd.get(ymd) ?? [];
    const dayTasks = (tasksByYmd.get(ymd) ?? []).filter((t) => t.status === "pending" || t.status === "in_progress");
    const previews = recurringPreviews[ymd] ?? [];
    const todayCell = ymd === todayYmd;
    const isSelected = selectedDay === ymd;
    const isCurrentMonth = ymd.slice(0, 7) === monthFirstYmd(weekStart).slice(0, 7);

    return (
      <div
        role="button"
        tabIndex={0}
        onClick={() => setSelectedDay(isSelected ? null : ymd)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setSelectedDay(isSelected ? null : ymd);
          }
        }}
        className={cn(
          "relative min-h-[90px] cursor-pointer rounded-2xl border transition-all",
          compact && "min-h-[72px]",
          !compact && "min-h-[110px]",
          isSelected && "border-pink-500/40 bg-pink-500/[0.08]",
          !isSelected && todayCell && "border-pink-500/25 bg-pink-500/[0.05]",
          !isSelected &&
            !todayCell &&
            (view === "week" || isCurrentMonth) &&
            "border-white/10 bg-white/[0.02] hover:bg-white/[0.05]",
          !isSelected && !todayCell && view === "month" && !isCurrentMonth && "border-white/5 bg-white/[0.01] hover:bg-white/[0.03]"
        )}
      >
        <div className="flex items-center justify-between px-3 pb-1 pt-2.5">
          <div
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-xl text-xs font-bold",
              todayCell && "bg-gradient-to-br from-pink-500 to-rose-500 text-white shadow-lg shadow-pink-500/30",
              !todayCell && (view === "week" || isCurrentMonth) && "text-white/70",
              !todayCell && view === "month" && !isCurrentMonth && "text-white/25"
            )}
          >
            {formatDayNum(ymd)}
          </div>
          {(programs.length > 0 || dayTasks.length > 0) && (
            <div className="flex gap-1">
              {programs.length > 0 ? <div className="h-1.5 w-1.5 rounded-full bg-purple-400" aria-hidden /> : null}
              {dayTasks.length > 0 ? <div className="h-1.5 w-1.5 rounded-full bg-pink-400" aria-hidden /> : null}
            </div>
          )}
        </div>

        <div className="space-y-1 px-2 pb-2">
          {programs.slice(0, 2).map((p) => {
            const cfg = SHIFT_TYPE_CONFIG[p.shift_type] ?? SHIFT_TYPE_CONFIG.Custom;
            const timeLabel = formatShiftTimeRange(p.start_time, p.end_time);
            return (
              <div
                key={p.id}
                className={cn(
                  "flex items-center gap-1.5 truncate rounded-xl border bg-gradient-to-r px-2 py-1",
                  cfg.color,
                  cfg.border
                )}
              >
                <span className="text-xs" aria-hidden>
                  {cfg.emoji}
                </span>
                <span className={cn("truncate text-xs font-semibold", cfg.text)}>{timeLabel}</span>
              </div>
            );
          })}
          {programs.length > 2 ? (
            <p className="px-1 text-xs text-white/30">+{programs.length - 2} more shifts</p>
          ) : null}

          {dayTasks.slice(0, 1).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setDetailTask(t);
              }}
              className={cn(
                "flex w-full items-center gap-1.5 truncate rounded-xl border px-2 py-1 text-left text-xs transition hover:opacity-90",
                t.status === "in_progress" ? "border-blue-500/20 bg-blue-500/10" : "border-white/10 bg-white/5"
              )}
            >
              <span aria-hidden>{t.is_recurring ? "🔄" : "📋"}</span>
              <span className="truncate text-white/70">{t.title}</span>
            </button>
          ))}

          {previews.slice(0, 1).map((t) => (
            <div
              key={`preview-${t.id}-${ymd}`}
              className="flex items-center gap-1.5 truncate rounded-xl border border-dashed border-purple-500/20 bg-purple-500/5 px-2 py-1"
              title={`Upcoming recurring: ${t.title}`}
            >
              <span className="text-xs" aria-hidden>
                🔄
              </span>
              <span className="truncate text-xs text-purple-400/60">{t.title}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="mb-1 text-xs font-bold uppercase tracking-widest text-pink-400/70">My schedule</p>
          <h1 className="text-2xl font-bold text-white md:text-3xl">
            {view === "week" ? `Week of ${formatWeekLabel(weekStart)}` : formatMonthYearFromMonday(weekStart)}
          </h1>
          <p className="mt-1 text-sm text-white/45">Weekly program, tasks, and active shifts.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-2xl border border-white/10 bg-white/5 p-1">
            {(["week", "month"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={cn(
                  "rounded-xl px-4 py-2 text-xs font-semibold capitalize transition-all",
                  view === v
                    ? "bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-lg shadow-pink-500/20"
                    : "text-white/40 hover:text-white"
                )}
              >
                {v}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => navigateWeeks(-1)}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/50 transition hover:bg-white/10 hover:text-white"
              aria-label="Previous week"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {!isCurrentWeek ? (
              <button
                type="button"
                onClick={goToThisWeek}
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/50 transition hover:bg-white/10 hover:text-white"
              >
                <RotateCcw className="h-3 w-3" aria-hidden />
                This week
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => navigateWeeks(1)}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/50 transition hover:bg-white/10 hover:text-white"
              aria-label="Next week"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-4 text-xs text-white/35">
        {[
          { dot: "bg-amber-400", label: "Morning shift" },
          { dot: "bg-blue-400", label: "Night shift" },
          { dot: "bg-purple-400", label: "Custom / program" },
          { dot: "bg-pink-400", label: "Task due" },
        ].map((l) => (
          <div key={l.label} className="flex items-center gap-1.5">
            <div className={cn("h-2 w-2 rounded-full", l.dot)} />
            <span>{l.label}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded border border-dashed border-purple-500/40" />
          <span>Upcoming recurring</span>
        </div>
      </div>

      {activeShifts.length > 0 ? (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3">
          <div className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-emerald-400" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-emerald-200">On shift now</p>
            <p className="mt-0.5 truncate text-xs text-emerald-100/70">
              {activeShifts
                .map(
                  (s) =>
                    `${s.scheduled_shift || s.shift_type || "Shift"}${s.start_time ? ` (${formatShiftTime(s.start_time)})` : ""}`
                )
                .join(" · ")}
            </p>
          </div>
          <span className="shrink-0 text-xs text-emerald-300/60">Live</span>
        </div>
      ) : null}

      {view === "week" ? (
        <div>
          <div className="mb-2 grid grid-cols-7 gap-2">
            {weekDates.map(({ ymd }, i) => (
              <div key={ymd} className="text-center">
                <p className={cn("text-xs font-bold uppercase tracking-wider", ymd === todayYmd ? "text-pink-400" : "text-white/30")}>
                  {DAY_LABELS[i]}
                </p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-2">
            {weekDates.map(({ ymd }) => (
              <DayCell key={ymd} ymd={ymd} />
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-2 overflow-x-auto">
          <div className="grid min-w-[720px] grid-cols-7 gap-1.5">
            {DAY_LABELS.map((d) => (
              <div key={d} className="text-center">
                <p className="text-xs font-bold uppercase tracking-wider text-white/25">{d}</p>
              </div>
            ))}
          </div>
          {monthGrid.map((row, ri) => (
            <div key={ri} className="grid min-w-[720px] grid-cols-7 gap-1.5">
              {row.map(({ ymd }) => (
                <DayCell key={ymd} ymd={ymd} compact />
              ))}
            </div>
          ))}
        </div>
      )}

      {selectedDay ? (
        selectedPrograms.length > 0 || selectedTasks.length > 0 ? (
          <div className="mt-5 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03]">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <div>
                <p className="font-bold text-white">{formatDateEuropean(selectedDay)}</p>
                <p className="mt-0.5 text-xs text-white/35">
                  {selectedPrograms.length} shift{selectedPrograms.length !== 1 ? "s" : ""} · {selectedTasks.length} task
                  {selectedTasks.length !== 1 ? "s" : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDay(null)}
                className="text-2xl leading-none text-white/35 transition hover:text-white"
                aria-label="Close day detail"
              >
                ×
              </button>
            </div>

            <div className="space-y-4 px-5 py-4">
              {selectedPrograms.map((p) => {
                const cfg = SHIFT_TYPE_CONFIG[p.shift_type] ?? SHIFT_TYPE_CONFIG.Custom;
                return (
                  <div key={p.id} className={cn("rounded-2xl border bg-gradient-to-r p-4", cfg.color, cfg.border)}>
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-xl",
                          cfg.border,
                          "bg-white/10"
                        )}
                        aria-hidden
                      >
                        {cfg.emoji}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="mb-0.5 flex flex-wrap items-center gap-2">
                          <span className={cn("text-sm font-bold", cfg.text)}>{cfg.label} shift</span>
                          <span className={cn("rounded-full bg-white/10 px-2 py-0.5 text-xs", cfg.text)}>{p.shift_type}</span>
                        </div>
                        <p className="flex items-center gap-1 text-sm text-white/60">
                          <Clock className="h-3 w-3 shrink-0" aria-hidden />
                          {formatShiftTime(p.start_time)} – {formatShiftTime(p.end_time)}
                        </p>
                      </div>
                    </div>
                    {(() => {
                      const names = collectProgramModelNames(p, modelIdToName);
                      if (names.length === 0) return null;
                      return (
                        <div className="mt-3">
                          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-white/25">Models</p>
                          <div className="flex flex-wrap gap-1.5">
                            {names.map((mn) => (
                              <span
                                key={mn}
                                className={cn(
                                  "flex items-center gap-1.5 rounded-xl border bg-white/10 px-2.5 py-1.5 text-xs font-medium",
                                  cfg.border,
                                  cfg.text
                                )}
                              >
                                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-bold">
                                  {(mn || "?").trim().slice(0, 1).toUpperCase()}
                                </span>
                                {mn}
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                    {p.notes?.trim() ? <p className="mt-2 text-xs text-white/40">{p.notes}</p> : null}
                  </div>
                );
              })}

              {selectedTasks.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setDetailTask(t)}
                  className={cn(
                    "w-full rounded-2xl border p-4 text-left transition hover:opacity-95",
                    t.status === "in_progress" ? "border-blue-500/20 bg-blue-500/5" : "border-white/10 bg-white/[0.02]"
                  )}
                >
                  <div className="flex items-center gap-3">
                    {t.status === "in_progress" ? (
                      <CheckCircle2 className="h-5 w-5 shrink-0 text-blue-400" aria-hidden />
                    ) : (
                      <Circle className="h-5 w-5 shrink-0 text-white/30" aria-hidden />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-white">{t.title}</p>
                      {t.description ? <p className="mt-0.5 truncate text-xs text-white/40">{t.description}</p> : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {t.is_recurring ? (
                        <span className="rounded-full border border-purple-500/20 bg-purple-500/10 px-2 py-0.5 text-xs text-purple-400">
                          🔄
                        </span>
                      ) : null}
                      <span
                        className={cn(
                          "rounded-full border px-2 py-0.5 text-xs font-semibold",
                          t.priority === "urgent" && "border-red-500/20 bg-red-500/10 text-red-400",
                          t.priority === "high" && "border-amber-500/20 bg-amber-500/10 text-amber-400",
                          t.priority !== "urgent" && t.priority !== "high" && "border-white/10 bg-white/5 text-white/40"
                        )}
                      >
                        {t.priority}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-5 rounded-3xl border border-white/10 bg-white/[0.02] px-5 py-8 text-center">
            <Calendar className="mx-auto mb-2 h-8 w-8 text-white/20" aria-hidden />
            <p className="text-sm text-white/35">Nothing scheduled for this day</p>
          </div>
        )
      ) : null}

      {detailTask ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => setDetailTask(null)}
          role="presentation"
        >
          <div
            className="w-full max-w-md rounded-2xl border border-white/15 bg-[#0f0f1a] p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal
          >
            <h3 className="text-lg font-semibold text-white">{detailTask.title}</h3>
            <p className="mt-1 text-xs uppercase text-white/40">
              {detailTask.status.replace(/_/g, " ")} · {detailTask.priority}
            </p>
            {detailTask.description ? <p className="mt-3 text-sm text-white/55">{detailTask.description}</p> : null}
            {detailTask.due_date ? (
              <p className="mt-3 text-sm text-white/50">Due {formatDateTimeAthens(detailTask.due_date)}</p>
            ) : null}
            <div className="mt-5 flex flex-wrap gap-2">
              {detailTask.status !== "done" && detailTask.status !== "skipped" ? (
                <button
                  type="button"
                  disabled={completing}
                  onClick={() => void markTaskDone(detailTask)}
                  className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/35 bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-500/25 disabled:opacity-40"
                >
                  <Check className="h-4 w-4" aria-hidden />
                  {completing ? "Saving…" : "Mark done"}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setDetailTask(null)}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/60 hover:bg-white/10"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
