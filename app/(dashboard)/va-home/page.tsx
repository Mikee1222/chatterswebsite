import { redirect } from "next/navigation";
import { getEffectiveStaffRole } from "@/lib/staff-session-role";
import { getSessionFromCookies } from "@/lib/auth";
import { ROUTES } from "@/lib/routes";
import { assertVaTypeCanAccessNavHref } from "@/lib/va-type-access";
import {
  getShiftsByChatter,
  getActiveShiftByStaff,
  listShiftModels,
} from "@/services/shifts";
import { formatDateEuropean, formatDateTimeEuropean } from "@/lib/format";
import { addDays } from "@/lib/weekly-program";
import { VaHomeClient, type VaHomeTaskItem } from "@/components/va-home-client";
import { SopResumeBanner } from "@/components/sop-resume-banner";
import { getAcademyResumeForMember } from "@/lib/sop-academy";
import { getVaTasksForUser } from "@/services/va-tasks";
import type { Shift, VaTaskPriority, VaTaskRecord, VaTaskStatus } from "@/types";

function localYmdFromDue(isoLike: string | null): string {
  if (!isoLike?.trim()) return "";
  const d = new Date(isoLike.trim());
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function todayYmdLocal(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}

export type VaHomeShiftCardData =
  | {
      kind: "live";
      date: string;
      startTime: string | null;
      modelsCount: number;
      modelNames: string[];
    }
  | {
      kind: "last";
      date: string;
      durationMinutes: number | null;
      modelNames: string[];
    }
  | { kind: "none" };

async function getVaHomeShiftCardData(vaId: string): Promise<VaHomeShiftCardData> {
  const activeShift = await getActiveShiftByStaff(vaId, "virtual_assistant").catch(() => null);
  if (activeShift) {
    const shiftModels = await listShiftModels(activeShift.id).catch(() => []);
    const modelNames = shiftModels.map((sm) => sm.model_name?.trim()).filter(Boolean) as string[];
    const startTime = activeShift.start_time ?? null;
    return {
      kind: "live",
      date: activeShift.date ?? "",
      startTime,
      modelsCount: activeShift.models_count ?? 0,
      modelNames,
    };
  }
  const shifts = await getShiftsByChatter(vaId, "virtual_assistant").catch(() => []);
  const completed = shifts.filter((s) => s.status === "completed");
  const sorted = [...completed].sort((a, b) => {
    const d = (b.date ?? "").localeCompare(a.date ?? "");
    if (d !== 0) return d;
    return (b.updated_at ?? "").localeCompare(a.updated_at ?? "");
  });
  const lastShift = sorted[0];
  if (!lastShift) return { kind: "none" };
  const shiftModels = await listShiftModels(lastShift.id).catch(() => []);
  const modelNames = shiftModels.map((sm) => sm.model_name?.trim()).filter(Boolean) as string[];
  const durationMinutes = lastShift.worked_minutes ?? lastShift.total_minutes ?? null;
  return {
    kind: "last",
    date: lastShift.date ?? "",
    durationMinutes,
    modelNames,
  };
}

function minutesFromShift(s: Shift, now: Date): number {
  const start = s.start_time ? new Date(s.start_time).getTime() : 0;
  if (!start) return 0;
  const end = s.end_time ? new Date(s.end_time).getTime() : now.getTime();
  const rawMs = end - start;
  const breakMs = (s.break_minutes ?? 0) * 60 * 1000;
  return Math.max(0, Math.round((rawMs - breakMs) / 60000));
}

function hoursFromMinutes(m: number): string {
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const min = m % 60;
  return min ? `${h}h ${min}m` : `${h}h`;
}

const PRIORITY_ORDER: Record<VaTaskPriority, number> = {
  urgent: 0,
  high: 1,
  normal: 2,
  low: 3,
};

function isOpenTask(status: VaTaskStatus): boolean {
  return status === "pending" || status === "in_progress";
}

function toHomeTaskRow(t: VaTaskRecord): VaHomeTaskItem {
  return {
    id: t.id,
    title: t.title?.trim() || "Task",
    status: t.status,
    priority: t.priority,
  };
}

function sortTasksForHome(a: VaTaskRecord, b: VaTaskRecord): number {
  const pa = PRIORITY_ORDER[a.priority] ?? 2;
  const pb = PRIORITY_ORDER[b.priority] ?? 2;
  if (pa !== pb) return pa - pb;
  return (a.due_date ?? "").localeCompare(b.due_date ?? "");
}

export default async function VaHomePage() {
  const user = await getSessionFromCookies();
  if (!user || getEffectiveStaffRole(user) !== "virtual_assistant") redirect(ROUTES.dashboard);
  await assertVaTypeCanAccessNavHref(user, ROUTES.va.home);

  const vaId = user.airtableUserId ?? user.id;
  const displayName = (user.fullName ?? user.email ?? "VA").trim();
  const firstName = displayName.split(/\s+/)[0] ?? displayName;
  const [allShifts, shiftCardData, vaTasks, sopResume] = await Promise.all([
    getShiftsByChatter(vaId, "virtual_assistant").catch(() => []),
    getVaHomeShiftCardData(vaId),
    getVaTasksForUser(vaId).catch(() => []),
    getAcademyResumeForMember(vaId, {
      airtableUserId: user.airtableUserId,
      staffRole: "virtual_assistant",
    }).catch(() => null),
  ]);

  const todayY = todayYmdLocal();

  const todaysTasks = vaTasks
    .filter((t) => isOpenTask(t.status) && t.due_date && localYmdFromDue(t.due_date) === todayY)
    .sort(sortTasksForHome)
    .slice(0, 10)
    .map(toHomeTaskRow);

  const overdueTasks = vaTasks
    .filter((t) => {
      if (!isOpenTask(t.status) || !t.due_date) return false;
      const y = localYmdFromDue(t.due_date);
      return y !== "" && y < todayY;
    })
    .sort(sortTasksForHome)
    .slice(0, 12)
    .map(toHomeTaskRow);

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const weekStart = (() => {
    const d = new Date(now);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    return d.toISOString().slice(0, 10);
  })();

  let totalMinutes = 0;
  let weekMinutes = 0;
  let todayMinutes = 0;
  for (const s of allShifts) {
    const mins = minutesFromShift(s, now);
    totalMinutes += mins;
    if (s.date >= weekStart) weekMinutes += mins;
    if (s.date >= todayStart.slice(0, 10)) todayMinutes += mins;
  }

  const recentActivity: { type: string; label: string; at: string }[] = [];
  const sorted = [...allShifts].sort((a, b) => (b.start_time ?? "").localeCompare(a.start_time ?? ""));
  for (const s of sorted.slice(0, 15)) {
    if (s.start_time) {
      recentActivity.push({
        type: "started",
        label: "Started shift",
        at: formatDateTimeEuropean(s.start_time),
      });
    }
    if (s.end_time) {
      recentActivity.push({
        type: "ended",
        label: "Ended shift",
        at: formatDateTimeEuropean(s.end_time),
      });
    }
  }
  recentActivity.sort((a, b) => b.at.localeCompare(a.at));
  const recent = recentActivity.slice(0, 10);

  const weekEndY = addDays(weekStart, 6);
  const weekRangeLabel = `${formatDateEuropean(weekStart)} – ${formatDateEuropean(weekEndY)}`;

  return (
    <div className="pb-4 md:pb-6">
      {sopResume ? (
        <div className="mb-6">
          <SopResumeBanner resume={sopResume} />
        </div>
      ) : null}
      <VaHomeClient
        firstName={firstName}
        displayName={displayName}
        weekRangeLabel={weekRangeLabel}
        totalWorkedHours={hoursFromMinutes(totalMinutes)}
        weekHours={hoursFromMinutes(weekMinutes)}
        todayHours={hoursFromMinutes(todayMinutes)}
        shiftCardData={shiftCardData}
        todaysTasks={todaysTasks}
        overdueTasks={overdueTasks}
        recentActivity={recent}
      />
    </div>
  );
}
