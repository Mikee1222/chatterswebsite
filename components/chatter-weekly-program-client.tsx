"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { CalendarCheck, CalendarDays, ChevronLeft, ChevronRight, Users } from "lucide-react";
import { ContentPipelineHero } from "@/components/content-pipeline-ui";
import { LuxuryStatCard } from "@/components/infloww-performance-ui";
import { AdminRowAvatar, ShiftTypeBadge } from "@/components/admin-list-primitives";
import { ModelPeriodNamesRow } from "@/components/model-period-names-row";
import { WeeklyProgramDaySwiper } from "@/components/weekly-program-day-swiper";
import { formatDateEuropean, formatTimeFromISO } from "@/lib/format";
import { ROUTES, weeklyAvailabilityUrl } from "@/lib/routes";
import { addDays, formatWeekLabel, getTodayYmd, shiftCardAccentClass, fallbackShiftStartMinutes, weeklyProgramShiftTypesSummary } from "@/lib/weekly-program";
import {
  parseChatterScheduleViewMode,
  type ChatterScheduleViewMode,
  type ChatterTeamScheduleEntry,
} from "@/lib/weekly-program-chatter-view";
import { addWeeksLocal } from "@/lib/weekly-program-local";
import type { WeeklyProgramRecord } from "@/types";
import { cn } from "@/lib/utils";

const DAY_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

type DisplayEntry = ChatterTeamScheduleEntry & { notes?: string };

function utcStartMinutes(entry: { start_time?: string | null; shift_type: string }): number {
  if (entry.start_time) {
    const start = new Date(entry.start_time);
    if (Number.isFinite(start.getTime())) return start.getUTCHours() * 60 + start.getUTCMinutes();
  }
  return fallbackShiftStartMinutes(entry.shift_type);
}

function isOvernightContinuationStart(startIso: string): boolean {
  const start = new Date(startIso);
  if (!Number.isFinite(start.getTime())) return false;
  const hour = start.getUTCHours();
  return hour >= 0 && hour < 6;
}

function OvernightContinuationBadge() {
  return (
    <span className="inline-flex items-center rounded-full border border-indigo-400/30 bg-indigo-500/10 px-2 py-0.5 text-[11px] font-semibold text-indigo-100">
      +1 cont.
    </span>
  );
}

function ScheduleViewToggle({
  value,
  onChange,
}: {
  value: ChatterScheduleViewMode;
  onChange: (mode: ChatterScheduleViewMode) => void;
}) {
  return (
    <div
      className="flex rounded-xl border border-white/10 bg-white/[0.03] p-1"
      role="tablist"
      aria-label="Schedule view"
    >
      <button
        type="button"
        role="tab"
        aria-selected={value === "everyone"}
        onClick={() => onChange("everyone")}
        className={cn(
          "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
          value === "everyone"
            ? "bg-[#FF1493]/20 text-[#FF69B4] shadow-[0_0_16px_-6px_rgba(255,20,147,0.45)]"
            : "text-white/60 hover:text-white/85",
        )}
      >
        <Users className="h-4 w-4 shrink-0" aria-hidden />
        Everyone
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={value === "mine"}
        onClick={() => onChange("mine")}
        className={cn(
          "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
          value === "mine"
            ? "bg-[#FF1493]/20 text-[#FF69B4] shadow-[0_0_16px_-6px_rgba(255,20,147,0.45)]"
            : "text-white/60 hover:text-white/85",
        )}
      >
        <CalendarDays className="h-4 w-4 shrink-0" aria-hidden />
        My schedule
      </button>
    </div>
  );
}

function ShiftBlock({
  entry,
  dateYmd,
  idToName,
  periodDatesByModelId,
  highlight,
  showChatterName,
  showNotes,
}: {
  entry: DisplayEntry;
  dateYmd: string;
  idToName: Record<string, string>;
  periodDatesByModelId: Record<string, string[]>;
  highlight?: boolean;
  showChatterName?: boolean;
  showNotes?: boolean;
}) {
  const timeRange =
    entry.start_time && entry.end_time
      ? `${formatTimeFromISO(entry.start_time)} – ${formatTimeFromISO(entry.end_time)}`
      : "—";

  return (
    <div
      className={cn(
        "rounded-xl border p-4 pl-3.5 transition-colors",
        shiftCardAccentClass(entry.shift_type),
        highlight
          ? "border-[#FF1493]/45 bg-[#FF1493]/[0.08] ring-1 ring-[#FF1493]/25"
          : "border-white/10 bg-white/[0.05] hover:bg-white/[0.07]",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          {showChatterName && entry.chatter_name ? (
            <span className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-black/30 px-2.5 py-1.5">
              <AdminRowAvatar name={entry.chatter_name} size="sm" />
              <span className="truncate text-sm font-semibold text-white/90">{entry.chatter_name}</span>
              {highlight ? (
                <span className="rounded-full bg-[#FF1493]/25 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#FF69B4]">
                  You
                </span>
              ) : null}
            </span>
          ) : null}
          <ShiftTypeBadge shiftType={entry.shift_type} />
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <p className="font-mono text-sm tabular-nums text-white/90">{timeRange}</p>
        {isOvernightContinuationStart(entry.start_time) ? <OvernightContinuationBadge /> : null}
      </div>
      {entry.model_ids.length > 0 ? (
        <div className="mt-3">
          <ModelPeriodNamesRow
            modelIds={entry.model_ids}
            idToName={idToName}
            dateYmd={dateYmd}
            periodDatesByModelId={periodDatesByModelId}
          />
        </div>
      ) : null}
      {showNotes && entry.notes?.trim() ? (
        <p className="mt-2 text-xs leading-relaxed text-white/50">
          {entry.notes.trim().length > 120 ? `${entry.notes.trim().slice(0, 120)}…` : entry.notes.trim()}
        </p>
      ) : null}
    </div>
  );
}

export function ChatterWeeklyProgramClient({
  weekStart,
  chatterId,
  teamEntries,
  myEntries,
  idToName,
  periodDatesByModelId,
}: {
  weekStart: string;
  chatterId: string;
  teamEntries: ChatterTeamScheduleEntry[];
  myEntries: WeeklyProgramRecord[];
  idToName: Record<string, string>;
  periodDatesByModelId: Record<string, string[]>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reduceMotion = useReducedMotion();
  const todayYmd = getTodayYmd();
  const todayWeekday = new Date().toLocaleDateString("en-GB", { weekday: "long" });

  const viewMode = parseChatterScheduleViewMode(searchParams.get("view"));

  const setViewMode = React.useCallback(
    (mode: ChatterScheduleViewMode) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("view", mode);
      router.replace(`${ROUTES.chatter.weeklyProgram}?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  const navigateWeek = React.useCallback(
    (delta: number) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("week_start", addWeeksLocal(weekStart, delta));
      router.push(`${ROUTES.chatter.weeklyProgram}?${params.toString()}`);
    },
    [router, searchParams, weekStart],
  );

  const activeEntries: DisplayEntry[] = React.useMemo(() => {
    if (viewMode === "mine") {
      return myEntries.map(({ id, chatter_id, chatter_name, model_ids, day, shift_type, start_time, end_time, week_start, notes }) => ({
        id,
        chatter_id,
        chatter_name,
        model_ids,
        day,
        shift_type,
        start_time,
        end_time,
        week_start,
        notes,
      }));
    }
    return teamEntries;
  }, [viewMode, myEntries, teamEntries]);

  const byDay = React.useMemo(
    () =>
      DAY_ORDER.map((day) => ({
        day,
        entries: activeEntries
          .filter((e) => e.day === day)
          .sort((a, b) => utcStartMinutes(a) - utcStartMinutes(b)),
      })),
    [activeEntries],
  );

  const swiperByDay = React.useMemo(
    () =>
      byDay.map(({ day, entries }) => ({
        day,
        entries: entries.map((e) => ({
          id: e.id,
          program_id: "",
          chatter_id: e.chatter_id,
          chatter_name: e.chatter_name,
          model_ids: e.model_ids,
          day: e.day as WeeklyProgramRecord["day"],
          shift_type: e.shift_type as WeeklyProgramRecord["shift_type"],
          start_time: e.start_time,
          end_time: e.end_time,
          week_start: e.week_start,
          notes: viewMode === "mine" ? (e.notes ?? "") : "",
          created_at: "",
          updated_at: "",
        })),
      })),
    [byDay, viewMode],
  );

  const totalShifts = activeEntries.length;
  const workingDays = new Set(activeEntries.map((e) => e.day)).size;
  const assignedModelIds = new Set(activeEntries.flatMap((e) => e.model_ids).filter(Boolean));
  const modelCount = assignedModelIds.size;
  const teamChatterCount = new Set(teamEntries.map((e) => e.chatter_id).filter(Boolean)).size;
  const myShiftCount = myEntries.length;

  const weekLabel = formatWeekLabel(weekStart);

  return (
    <div className="space-y-6">
      <ContentPipelineHero
        eyebrow="Team schedule"
        title="Weekly program"
        description={
          <>
            Week of {weekLabel}. {weeklyProgramShiftTypesSummary()}.
            {viewMode === "everyone" ? (
              <span className="mt-1 block text-sm text-white/50">
                Team view shows shift times and model assignments only — no internal notes.
              </span>
            ) : null}
          </>
        }
        actions={
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:min-w-[280px]">
            <ScheduleViewToggle value={viewMode} onChange={setViewMode} />
            <Link
              href={weeklyAvailabilityUrl(weekStart)}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-white/85 transition-colors hover:border-[#FF1493]/35 hover:bg-[#FF1493]/10 hover:text-white"
            >
              <CalendarCheck className="h-4 w-4 shrink-0 text-[#FF69B4]" aria-hidden />
              Submit availability
            </Link>
          </div>
        }
        stats={
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <LuxuryStatCard
              label={viewMode === "everyone" ? "Team shifts" : "My shifts"}
              value={totalShifts}
              accent="pink"
              glow
            />
            <LuxuryStatCard label="Working days" value={workingDays} accent="champagne" />
            <LuxuryStatCard label="Models assigned" value={modelCount} accent="white" />
            {viewMode === "everyone" ? (
              <LuxuryStatCard label="Chatters scheduled" value={teamChatterCount} accent="emerald" />
            ) : (
              <LuxuryStatCard
                label="On team schedule"
                value={myShiftCount}
                hint="Your shifts this week"
                accent="emerald"
              />
            )}
          </div>
        }
      />

      <div className="glass-card flex flex-col gap-4 p-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => navigateWeek(-1)}
            className="inline-flex items-center gap-1 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm font-medium text-white/90 transition-colors hover:bg-white/10"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
            Previous
          </button>
          <button
            type="button"
            onClick={() => {
              const params = new URLSearchParams(searchParams.toString());
              params.delete("week_start");
              router.push(`${ROUTES.chatter.weeklyProgram}?${params.toString()}`);
            }}
            className="rounded-xl border border-[#FF1493]/40 bg-[#FF1493]/15 px-4 py-2 text-sm font-semibold text-[#FF69B4] transition-colors hover:bg-[#FF1493]/25"
          >
            This week
          </button>
          <button
            type="button"
            onClick={() => navigateWeek(1)}
            className="inline-flex items-center gap-1 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm font-medium text-white/90 transition-colors hover:bg-white/10"
          >
            Next
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <p className="text-sm font-medium text-white/75">Week of {weekLabel}</p>
      </div>

      {activeEntries.length > 0 ? (
        <>
          <WeeklyProgramDaySwiper
            byDay={swiperByDay}
            weekStart={weekStart}
            idToName={idToName}
            periodDatesByModelId={periodDatesByModelId}
            showOvernightContinuationBadge
            showChatterName={viewMode === "everyone"}
            highlightChatterId={viewMode === "everyone" ? chatterId : undefined}
            showNotes={viewMode === "mine"}
          />

          <div className="hidden space-y-5 md:block">
            {byDay.map(({ day, entries: dayEntries }) => {
              const dateYmd = addDays(weekStart, DAY_ORDER.indexOf(day));
              const dateLabel = formatDateEuropean(dateYmd);
              const isToday = day === todayWeekday;
              return (
                <motion.section
                  key={day}
                  initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                  className={cn(
                    "overflow-hidden rounded-2xl border backdrop-blur-xl",
                    isToday
                      ? "border-[#FF1493]/30 bg-black/50 shadow-[0_0_32px_-8px_rgba(255,20,147,0.25)]"
                      : "border-white/10 bg-black/40 shadow-[0_0_0_1px_rgba(255,255,255,0.05)]",
                  )}
                >
                  <div
                    className={cn(
                      "flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4",
                      isToday ? "border-[#FF1493]/20 bg-[#FF1493]/[0.06]" : "border-white/10 bg-white/[0.04]",
                    )}
                  >
                    <div>
                      <h2 className="text-sm font-semibold uppercase tracking-wider text-white/90">{day}</h2>
                      <p className="mt-0.5 text-sm text-white/55">{dateLabel}</p>
                    </div>
                    {isToday ? (
                      <span className="rounded-full bg-[#FF1493] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white shadow-[0_2px_12px_-2px_rgba(219,39,119,0.6)]">
                        Today
                      </span>
                    ) : null}
                  </div>
                  <div className="space-y-3 p-4 md:p-5">
                    {dayEntries.length === 0 ? (
                      <div className="flex flex-col items-center justify-center rounded-xl border border-white/5 bg-white/[0.02] py-10 text-center">
                        <p className="text-sm text-white/50">No shifts scheduled</p>
                        <p className="mt-0.5 text-xs text-white/40">Rest day</p>
                      </div>
                    ) : (
                      dayEntries.map((entry) => (
                        <ShiftBlock
                          key={entry.id}
                          entry={entry}
                          dateYmd={dateYmd}
                          idToName={idToName}
                          periodDatesByModelId={periodDatesByModelId}
                          highlight={viewMode === "everyone" && entry.chatter_id === chatterId}
                          showChatterName={viewMode === "everyone"}
                          showNotes={viewMode === "mine"}
                        />
                      ))
                    )}
                  </div>
                </motion.section>
              );
            })}
          </div>
        </>
      ) : (
        <div
          className="glass-card flex flex-col items-center justify-center gap-4 rounded-2xl border border-white/10 p-12 text-center"
          style={{
            boxShadow: "0 0 0 1px rgba(255,255,255,0.05), 0 0 24px -8px hsl(330 80% 55% / 0.06)",
          }}
        >
          <CalendarDays className="h-10 w-10 text-white/30" aria-hidden />
          <p className="text-base font-medium text-white/70">
            {viewMode === "mine"
              ? "No scheduled shifts for you this week yet."
              : "No team shifts published for this week yet."}
          </p>
          <p className="max-w-md text-sm text-white/50">
            {viewMode === "mine"
              ? "Your weekly program will appear here when assigned."
              : "When admins publish the weekly program, everyone’s shifts will show here."}
          </p>
          <Link
            href={weeklyAvailabilityUrl(weekStart)}
            className="mt-2 inline-flex items-center gap-2 rounded-xl border border-[#FF1493]/35 bg-[#FF1493]/10 px-4 py-2.5 text-sm font-medium text-[#FF69B4] transition-colors hover:bg-[#FF1493]/20"
          >
            <CalendarCheck className="h-4 w-4" aria-hidden />
            Submit your availability
          </Link>
        </div>
      )}
    </div>
  );
}
