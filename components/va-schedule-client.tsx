"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { formatDateEuropean, formatDateTimeAthens, formatTimeFromISO } from "@/lib/format";
import { ROUTES } from "@/lib/routes";
import {
  WEEKLY_PROGRAM_DAY_OPTIONS,
  addDays,
  addWeeks,
  formatWeekLabel,
  getMondayOfWeek,
} from "@/lib/weekly-program";
import { updateVaTaskStatusAction } from "@/app/actions/va-tasks";
import type { Shift, VaTaskRecord, VaTaskPriority, WeeklyProgramDay, WeeklyProgramRecord } from "@/types";
import { cn } from "@/lib/utils";

export type VaScheduleClientProps = {
  weeklyProgram: WeeklyProgramRecord[];
  tasks: VaTaskRecord[];
  activeShifts: Shift[];
  weekStart: string;
};

function toLocalYmd(isoLike: string | null): string {
  if (!isoLike?.trim()) return "";
  const d = new Date(isoLike.trim());
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function monthFirstYmd(mondayYmd: string): string {
  const [y, m] = mondayYmd.split("-").map(Number);
  if (!y || !m) return mondayYmd;
  return `${y}-${String(m).padStart(2, "0")}-01`;
}

function taskPillClass(task: VaTaskRecord): string {
  if (task.status === "done") return "border-emerald-500/25 bg-emerald-500/10 text-emerald-400 line-through";
  if (task.priority === "urgent") return "border-red-500/30 bg-red-500/20 text-red-300";
  if (task.priority === "high") return "border-amber-500/30 bg-amber-500/20 text-amber-300";
  return "border-white/10 bg-white/5 text-white/70";
}

export function VaScheduleClient({ weeklyProgram, tasks, activeShifts, weekStart }: VaScheduleClientProps) {
  const router = useRouter();
  const [view, setView] = React.useState<"week" | "month">("week");
  const [detailTask, setDetailTask] = React.useState<VaTaskRecord | null>(null);
  const [completing, setCompleting] = React.useState(false);

  const weekDates = React.useMemo(() => {
    return WEEKLY_PROGRAM_DAY_OPTIONS.map((day, i) => ({
      day,
      ymd: addDays(weekStart, i),
    }));
  }, [weekStart]);

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

  const tasksByYmd = React.useMemo(() => {
    const m = new Map<string, VaTaskRecord[]>();
    for (const t of tasks) {
      if (!t.due_date?.trim()) continue;
      const y = toLocalYmd(t.due_date);
      if (!y) continue;
      const list = m.get(y) ?? [];
      list.push(t);
      m.set(y, list);
    }
    return m;
  }, [tasks]);

  const shiftsByYmd = React.useMemo(() => {
    const m = new Map<string, Shift[]>();
    for (const s of activeShifts) {
      const d = (s.date ?? "").trim().slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) continue;
      const list = m.get(d) ?? [];
      list.push(s);
      m.set(d, list);
    }
    return m;
  }, [activeShifts]);

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

  const prevWeek = addWeeks(weekStart, -1);
  const nextWeek = addWeeks(weekStart, 1);

  function cellContent(ymd: string, day: WeeklyProgramDay, programWeekMonday: string) {
    const ws = programWeekMonday.trim();
    const programs = weeklyProgram.filter((p) => p.day === day && (p.week_start ?? "").trim() === ws);
    const dayTasks = tasksByYmd.get(ymd) ?? [];
    const dayShifts = shiftsByYmd.get(ymd) ?? [];

    return (
      <div className="min-h-[120px] space-y-1.5 rounded-xl border border-white/8 bg-black/30 p-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-white/35">{formatDateEuropean(ymd)}</p>
        {dayShifts.map((s) => (
          <div
            key={s.id}
            className="truncate rounded-lg border border-purple-500/30 bg-purple-500/15 px-2 py-1 text-[11px] text-purple-200"
            title={s.scheduled_shift}
          >
            {s.start_time && s.end_time
              ? `${formatTimeFromISO(s.start_time)}–${formatTimeFromISO(s.end_time)}`
              : s.scheduled_shift || "Shift"}
          </div>
        ))}
        {programs.map((p) => (
          <div
            key={p.id}
            className="truncate rounded-lg border border-purple-500/30 bg-purple-500/15 px-2 py-1 text-[11px] text-purple-200"
          >
            {p.shift_type} · {formatTimeFromISO(p.start_time)}–{formatTimeFromISO(p.end_time)}
          </div>
        ))}
        {dayTasks.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setDetailTask(t)}
            className={cn(
              "block w-full truncate rounded-lg border px-2 py-1 text-left text-[11px] transition hover:opacity-90",
              taskPillClass(t)
            )}
          >
            {t.title}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-sky-400/60">Schedule</p>
          <h1 className="mt-1 text-2xl font-bold text-white md:text-3xl">My schedule</h1>
          <p className="mt-1 text-sm text-white/45">Weekly program, tasks, and active shifts in one view.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl border border-white/10 bg-white/5 p-1">
            <button
              type="button"
              onClick={() => setView("week")}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-semibold transition",
                view === "week" ? "bg-white/15 text-white" : "text-white/50 hover:text-white/80"
              )}
            >
              Week
            </button>
            <button
              type="button"
              onClick={() => setView("month")}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-semibold transition",
                view === "month" ? "bg-white/15 text-white" : "text-white/50 hover:text-white/80"
              )}
            >
              Month
            </button>
          </div>
          <Link
            href={`${ROUTES.va.schedule}?week_start=${encodeURIComponent(prevWeek)}`}
            className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 transition hover:bg-white/10"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
            Prev
          </Link>
          <Link
            href={ROUTES.va.schedule}
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 transition hover:bg-white/10"
          >
            This week
          </Link>
          <Link
            href={`${ROUTES.va.schedule}?week_start=${encodeURIComponent(nextWeek)}`}
            className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 transition hover:bg-white/10"
          >
            Next
            <ChevronRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </div>

      {activeShifts.length > 0 ? (
        <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          <span className="font-semibold">On shift now</span>
          <span className="text-white/60"> — </span>
          {activeShifts.map((s) => (
            <span key={s.id} className="text-white/85">
              {s.scheduled_shift}
              {s.start_time ? ` (${formatTimeFromISO(s.start_time)})` : ""}
            </span>
          ))}
        </div>
      ) : null}

      <p className="text-sm text-white/50">
        {view === "week" ? `Week of ${formatWeekLabel(weekStart)}` : `Month around ${formatWeekLabel(weekStart)}`}
      </p>

      {view === "week" ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-7">
          {weekDates.map(({ day, ymd }) => (
            <div key={ymd}>
              <p className="mb-2 text-center text-xs font-semibold uppercase tracking-wide text-white/50">{day}</p>
              {cellContent(ymd, day, weekStart)}
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2 overflow-x-auto">
          <div className="grid min-w-[720px] grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase text-white/40">
            {WEEKLY_PROGRAM_DAY_OPTIONS.map((d) => (
              <div key={d}>{d.slice(0, 3)}</div>
            ))}
          </div>
          {monthGrid.map((row, ri) => (
            <div key={ri} className="grid min-w-[720px] grid-cols-7 gap-1">
              {row.map(({ ymd, day }) => (
                <div key={ymd}>{cellContent(ymd, day, getMondayOfWeek(ymd))}</div>
              ))}
            </div>
          ))}
        </div>
      )}

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
            <p className="mt-1 text-xs uppercase text-white/40">{detailTask.status.replace(/_/g, " ")} · {detailTask.priority}</p>
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
