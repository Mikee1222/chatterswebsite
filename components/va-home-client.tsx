"use client";

import * as React from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import {
  Activity,
  AlarmClock,
  ArrowRight,
  Calendar,
  CheckCircle2,
  CircleDot,
  Clock,
  FileText,
  ListTodo,
  PlayCircle,
  Sparkles,
  Timer,
} from "lucide-react";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { formatTimeEuropean, formatDurationMinutes, formatDateEuropean } from "@/lib/format";
import type { VaHomeShiftCardData } from "@/app/(dashboard)/va-home/page";
import type { VaTaskPriority, VaTaskStatus } from "@/types";

export type VaHomeTaskItem = {
  id: string;
  title: string;
  status: VaTaskStatus;
  priority: VaTaskPriority;
};

type ActivityItem = { type: string; label: string; at: string };

type Props = {
  firstName: string;
  displayName: string;
  weekRangeLabel: string;
  totalWorkedHours: string;
  weekHours: string;
  todayHours: string;
  shiftCardData: VaHomeShiftCardData;
  todaysTasks: VaHomeTaskItem[];
  pendingReports: VaHomeTaskItem[];
  recentActivity: ActivityItem[];
};

const sectionItem = {
  hidden: { opacity: 0, y: 14 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.36, ease: [0.22, 1, 0.36, 1] as const },
  },
};

function formatLiveDurationMinutes(date: string, startTime: string | null): number {
  if (!date || !startTime?.trim()) return 0;
  const t = startTime.trim();
  const timePart = t.length >= 5 ? t.slice(0, 5) : t;
  const withSeconds = timePart.length === 5 && timePart.includes(":") ? `${timePart}:00` : timePart;
  const iso = `${date}T${withSeconds}`;
  const start = new Date(iso);
  if (Number.isNaN(start.getTime())) return 0;
  return Math.max(0, Math.floor((Date.now() - start.getTime()) / 60_000));
}

function formatDurationHHMM(totalMinutes: number): string {
  if (!Number.isFinite(totalMinutes) || totalMinutes < 0) return "0:00";
  const h = Math.floor(totalMinutes / 60);
  const m = Math.round(totalMinutes % 60);
  return `${h}:${m.toString().padStart(2, "0")}`;
}

function priorityStyles(p: VaTaskPriority): string {
  if (p === "urgent") return "bg-rose-500/20 text-rose-200 ring-rose-400/25";
  if (p === "high") return "bg-amber-500/15 text-amber-200 ring-amber-400/20";
  if (p === "low") return "bg-white/10 text-white/55 ring-white/10";
  return "bg-pink-500/15 text-pink-200/90 ring-pink-400/20";
}

function statusLabel(s: VaTaskStatus): string {
  if (s === "in_progress") return "In progress";
  if (s === "done") return "Done";
  if (s === "skipped") return "Skipped";
  return "Pending";
}

function ActivityRowIcon({ type }: { type: string }) {
  if (type === "ended") {
    return (
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-violet-300/90 ring-1 ring-white/10">
        <CheckCircle2 className="h-4 w-4" aria-hidden />
      </span>
    );
  }
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-pink-500/15 text-pink-300 ring-1 ring-pink-400/20">
      <PlayCircle className="h-4 w-4" aria-hidden />
    </span>
  );
}

function VaShiftSummary({
  data,
  liveDurationMinutes,
}: {
  data: VaHomeShiftCardData;
  liveDurationMinutes: number;
}) {
  if (data.kind === "live") {
    const startedAt = formatTimeEuropean(data.startTime);
    const durationStr = formatDurationHHMM(liveDurationMinutes);
    const modelsLabel = data.modelNames.length > 0 ? data.modelNames.join(", ") : "—";
    return (
      <div className="mt-4 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.08] px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-emerald-200/80">Live shift</p>
        <p className="mt-1 text-sm text-white/85">
          Started <span className="font-medium text-white">{startedAt}</span> · Running{""}
          <span className="tabular-nums text-emerald-200">{durationStr}</span>
        </p>
        <p className="mt-1 text-xs text-white/55">Models: {modelsLabel}</p>
      </div>
    );
  }
  if (data.kind === "last") {
    const dateStr = formatDateEuropean(data.date);
    const durationStr = formatDurationMinutes(data.durationMinutes);
    const modelsLabel = data.modelNames.length > 0 ? data.modelNames.join(", ") : "—";
    return (
      <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-white/45">Last shift</p>
        <p className="mt-1 text-sm text-white/85">
          <span className="font-medium text-white">{dateStr}</span> · {durationStr}
        </p>
        <p className="mt-1 text-xs text-white/55">Models: {modelsLabel}</p>
      </div>
    );
  }
  return (
    <div className="mt-4 rounded-xl border border-dashed border-white/15 bg-white/[0.02] px-4 py-3 text-sm text-white/55">
      No shifts logged yet. Start your first session from the shift page.
    </div>
  );
}

function TaskRows({ tasks, emptyHint }: { tasks: VaHomeTaskItem[]; emptyHint: string }) {
  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
        <ListTodo className="h-9 w-9 text-white/25" aria-hidden />
        <p className="text-sm text-white/45">{emptyHint}</p>
      </div>
    );
  }
  return (
    <ul className="divide-y divide-white/[0.06]">
      {tasks.map((t, i) => (
        <motion.li
          key={t.id}
          initial={{ opacity: 0, x: -6 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.28, delay: i * 0.04, ease: [0.22, 1, 0.36, 1] }}
        >
          <Link
            href={ROUTES.va.tasks}
            className="flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-white/[0.05]"
          >
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-pink-500/15 text-pink-300 ring-1 ring-pink-400/15">
              <CircleDot className="h-4 w-4" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-medium leading-snug text-white/95">{t.title}</span>
              <span className="mt-1 flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-medium uppercase tracking-wide text-white/40">{statusLabel(t.status)}</span>
                <span
                  className={cn(
                    "rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1",
                    priorityStyles(t.priority)
                  )}
                >
                  {t.priority}
                </span>
              </span>
            </span>
            <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-white/30" aria-hidden />
          </Link>
        </motion.li>
      ))}
    </ul>
  );
}

export function VaHomeClient({
  firstName,
  displayName,
  weekRangeLabel,
  totalWorkedHours,
  weekHours,
  todayHours,
  shiftCardData,
  todaysTasks,
  pendingReports,
  recentActivity,
}: Props) {
  const reduceMotion = useReducedMotion();
  const [liveDurationMinutes, setLiveDurationMinutes] = React.useState(0);
  const liveData = shiftCardData.kind === "live" ? shiftCardData : null;

  React.useEffect(() => {
    if (!liveData) return;
    const tick = () => setLiveDurationMinutes(formatLiveDurationMinutes(liveData.date, liveData.startTime));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [liveData]);

  const stagger = reduceMotion ? 0 : 0.07;
  const delayChildren = reduceMotion ? 0 : 0.03;

  return (
    <motion.div
      className="space-y-8 pb-2 md:space-y-10"
      initial="hidden"
      animate="show"
      variants={{
        hidden: { opacity: 0 },
        show: {
          opacity: 1,
          transition: { staggerChildren: stagger, delayChildren },
        },
      }}
    >
      {/* 1. Welcome */}
      <motion.section
        variants={sectionItem}
        className="relative overflow-hidden rounded-3xl border border-white/10 bg-zinc-950/70 p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl md:p-8"
      >
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <motion.span
              initial={reduceMotion ? false : { scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 22 }}
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-pink-500/25 text-pink-200 shadow-[0_0_32px_-8px_rgba(236,72,153,0.45)] ring-1 ring-pink-400/35"
            >
              <Sparkles className="h-7 w-7" aria-hidden />
            </motion.span>
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-pink-200/75">Welcome back</p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-white md:text-3xl">
                {firstName || displayName}
              </h1>
              {displayName.trim() && (firstName || "").trim() !== displayName.trim() ? (
                <p className="mt-1 text-xs text-white/40">{displayName}</p>
              ) : null}
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/55">
                Your hub for shifts, tasks, and hours — jump in below.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 sm:justify-end">
            <Link
              href={ROUTES.va.shift}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/[0.07] px-4 py-2.5 text-sm font-medium text-white/90 transition-all hover:border-pink-400/35 hover:bg-pink-500/10"
            >
              <Timer className="h-4 w-4 text-pink-300" aria-hidden />
              Log session
              <ArrowRight className="h-4 w-4 opacity-50" aria-hidden />
            </Link>
            <Link
              href={ROUTES.va.tasks}
              className="inline-flex items-center gap-2 rounded-2xl border border-pink-400/30 bg-pink-500/15 px-4 py-2.5 text-sm font-semibold text-pink-100 transition-all hover:bg-pink-500/25"
            >
              <ListTodo className="h-4 w-4" aria-hidden />
              All tasks
            </Link>
          </div>
        </div>
      </motion.section>

      <div className="grid gap-6 lg:grid-cols-5 lg:gap-8">
        {/* 2. Today's tasks */} <motion.section variants={sectionItem} className="lg:col-span-3 overflow-hidden rounded-2xl border border-white/10 bg-black/35 shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_24px_60px_-36px_rgba(0,0,0,0.65)] backdrop-blur-xl" > <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-white/[0.03] px-5 py-4"> <div className="flex items-center gap-3"> <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-pink-500/20 text-pink-300 ring-1 ring-pink-400/20"> <AlarmClock className="h-5 w-5" aria-hidden /> </span> <div> <h2 className="text-base font-semibold text-white">Today&apos;s tasks</h2> <p className="text-xs text-white/45">Due today · open items</p> </div> </div> <Link href={ROUTES.va.tasks} className="text-xs font-medium text-pink-300/90 hover:text-pink-200"> View all </Link> </div> <TaskRows tasks={todaysTasks} emptyHint="Nothing due today. Check all tasks for the rest of the week." /> </motion.section> {/* 3. Work hours this week */} <motion.section variants={sectionItem} className="lg:col-span-2 flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-black/35 shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_24px_60px_-36px_rgba(0,0,0,0.65)] backdrop-blur-xl" > <div className="flex items-center gap-3 border-b border-white/10 bg-white/[0.03] px-5 py-4"> <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-pink-500/20 text-pink-300 ring-1 ring-pink-400/20"> <Clock className="h-5 w-5" aria-hidden /> </span> <div> <h2 className="text-base font-semibold text-white">Work hours</h2> <p className="text-xs text-white/45">{weekRangeLabel}</p> </div> </div> <div className="flex flex-1 flex-col gap-4 p-5"> <div> <p className="text-xs font-medium uppercase tracking-wider text-white/40">This week</p> <p className="mt-1 text-3xl font-bold tabular-nums tracking-tight text-white">{weekHours}</p> </div> <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3"> <p className="text-xs text-white/45">Today</p> <p className="mt-0.5 text-xl font-semibold tabular-nums text-pink-100/95">{todayHours}</p> </div> <VaShiftSummary data={shiftCardData} liveDurationMinutes={liveDurationMinutes} /> <div className="mt-auto flex flex-col gap-2 border-t border-white/10 pt-4"> <p className="text-[11px] text-white/40"> All-time logged: <span className="font-medium text-white/60">{totalWorkedHours}</span> </p> <Link href={ROUTES.hours} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/12 bg-white/[0.06] py-2.5 text-sm font-medium text-white/90 transition-colors hover:border-pink-400/30 hover:bg-pink-500/10" > <Calendar className="h-4 w-4 text-pink-300/90" aria-hidden /> Hours &amp; reports <ArrowRight className="h-4 w-4 opacity-50" aria-hidden /> </Link> </div> </div> </motion.section> </div> {/* 4. Pending reports (overdue open tasks) */} <motion.section variants={sectionItem} className="overflow-hidden rounded-2xl border border-white/10 bg-black/35 shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_24px_60px_-36px_rgba(0,0,0,0.65)] backdrop-blur-xl" > <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-white/[0.03] px-5 py-4"> <div className="flex items-center gap-3"> <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-pink-500/20 text-pink-300 ring-1 ring-pink-400/20"> <FileText className="h-5 w-5" aria-hidden /> </span> <div> <h2 className="text-base font-semibold text-white">Pending reports</h2> <p className="text-xs text-white/45">Open tasks past their due date — clear or reschedule on Tasks.</p> </div> </div> {pendingReports.length > 0 ? ( <span className="rounded-full bg-rose-500/20 px-2.5 py-1 text-xs font-semibold text-rose-200 ring-1 ring-rose-400/30"> {pendingReports.length} overdue </span> ) : null} </div> <TaskRows tasks={pendingReports} emptyHint="You're caught up — no overdue open tasks." />
      </motion.section>

      {/* 5. Recent activity */}
      <motion.section variants={sectionItem}>
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-pink-500/20 text-pink-300 ring-1 ring-pink-400/20">
            <Activity className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-white">Recent activity</h2>
            <p className="text-xs text-white/45">Latest shift events</p>
          </div>
        </div>
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/35 shadow-[0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur-xl">
          {recentActivity.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <Activity className="h-9 w-9 text-white/25" aria-hidden />
              <p className="text-sm text-white/45">No recent shift activity yet.</p>
            </div>
          ) : (
            <ul className="divide-y divide-white/[0.06]">
              {recentActivity.map((a, i) => (
                <motion.li
                  key={`${a.at}-${i}`}
                  initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.28, delay: reduceMotion ? 0 : i * 0.035 }}
                  className="flex items-center gap-3 px-4 py-3.5"
                >
                  <ActivityRowIcon type={a.type} />
                  <span className="min-w-0 flex-1 font-medium text-white/90">{a.label}</span>
                  <span className="shrink-0 text-xs tabular-nums text-white/45">{a.at}</span>
                </motion.li>
              ))}
            </ul>
          )}
        </div>
      </motion.section>
    </motion.div>
  );
}
